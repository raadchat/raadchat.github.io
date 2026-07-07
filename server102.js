/**
 * =============================================================
 * Chat Server  —  متوافق 100% مع توثيق appraad2.js الشامل
 * =============================================================
 */

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: "*" }
});
const bcrypt = require('bcryptjs');
const path = require('path');

// السماح للسيرفر بقراءة ملفات الواجهة من مجلد public
app.use(express.static('public'));
app.use(express.json());

// مسار لوحة التحكم (CP) لعرضها كنافذة منبثقة
app.get('/cp', (req, res) => {
  const cpId = req.query.cp;
  if (!cpId) return res.redirect('/');
  
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath);
});


const PORT = process.env.PORT || 8000;
const SALT_ROUNDS = 10;

// ─── قواعد البيانات المؤقتة (In-Memory Database) ──────────────────────────────
const users = new Map();         // socket.id -> user session
const accounts = new Map();      // username (lowercase) -> registered account
const rooms = new Map();         // room.id -> room data
const globalPowers = [];         // قائمة الصلاحيات المخصصة لـ CP
const bans = new Map();          // الحظر (IP / Fingerprint / Account)

// ─── دالة التشفير وفك التشفير XOR ─────────────────────────────────────────────
// متوافقة مع دالة التشفير في الكلاينت (_0x37cfff)
function xor(str, key = "raad_secret_key") {
  if (!str) return '';
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

// ─── دالة تنظيف النصوص والروابط لضمان الحماية ───────────────────────────────────
function sanitize(str, maxLen = 200) {
  if (!str) return '';
  return str.toString().substring(0, maxLen).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── معرفات فرعية عشوائية للأحداث والرسائل ──────────────────────────────────────
function makeBid() {
  return Math.random().toString(36).substring(2, 11);
}

// ─── دالات البحث المتقدمة عن الأعضاء المتصلين وغير المتصلين ───────────────────────
function byUID(uid) {
  for (const u of users.values()) {
    if (u.id === uid) return u;
  }
  return null;
}

function byLID(lid) {
  for (const acc of accounts.values()) {
    if (acc.lid === lid) return acc;
  }
  return null;
}

function removeRecentLogin(uid) {
  for (const [sid, u] of users.entries()) {
    if (u.id === uid) { users.delete(sid); break; }
  }
}

// ─── دالات البث والإرسال المهيكلة ──────────────────────────────────────────────
function send(socket, cmd, data) {
  if (!socket) return;
  socket.emit('msg', {
    cmd: xor(cmd),
    data: data
  });
}

function toRoom(roomId, cmd, data) {
  const r = rooms.get(roomId);
  if (!r) return;
  for (const sid of r.members) {
    const s = io.sockets.sockets.get(sid);
    if (s) send(s, cmd, data);
  }
}

// ─── بناء هياكل البيانات الصادرة طبقاً لـ appraad2.js ─────────────────────────
function buildMsg(user, text, extra = {}) {
  return {
    id: user.id,
    user: user.name,
    msg: sanitize(text, 1000),
    c: user.c || '#000000',
    f: user.f || 'Arial',
    s: user.s || '14',
    b: user.b || 0,
    t: Date.now(),
    ...extra
  };
}

function buildPower(user, room) {
  // يدمج صلاحيات الرتبة العامة مع صلاحيات الغرفة الحالية
  return {
    admin: user.rank >= 9,
    super: user.rank >= 7,
    master: user.rank >= 5,
    mic: true,
    kick: user.rank >= 4,
    ban: user.rank >= 6
  };
}

function broadcastPowers(roomId) {
  const r = rooms.get(roomId);
  if (!r) return;
  for (const sid of r.members) {
    const s = io.sockets.sockets.get(sid);
    const u = users.get(sid);
    if (s && u) {
      send(s, 'powers', globalPowers);
    }
  }
}

// ─── إعداد البيانات الافتراضية للغرف والإدارة ────────────────────────────────────
function seedRooms() {
  if (rooms.size === 0) {
    rooms.set('main', {
      id: 'main', name: 'الصالون العام', owner: 'Admin',
      max: 100, members: new Set(), needpass: false,
      mics: Array(5).fill(null)
    });
  }
}

function seedAdmin() {
  const adminKey = 'admin';
  if (!accounts.has(adminKey)) {
    accounts.set(adminKey, {
      lid: 'admin_lid', name: 'Admin', pass: bcrypt.hashSync('admin123', SALT_ROUNDS),
      power: 'المدير العام', rank: 10, created: Date.now(), last: Date.now(), powerEnd: 0
    });
  }
}

// ─── مغادرة الغرف وتنظيف المتصلين ──────────────────────────────────────────────
function leaveRoom(socket, user, reason = '') {
  if (!user.roomid) return;
  const r = rooms.get(user.roomid);
  if (r) {
    r.members.delete(socket.id);
    // تفريغ المايك إذا كان العضو يتحدث
    for (let i = 0; i < r.mics.length; i++) {
      if (r.mics[i] === user.id) r.mics[i] = null;
    }
    toRoom(r.id, 'u-', { id: user.id }); // حدث الخروج الرسمي u- متوافق مع appraad2.js
    toRoom(r.id, 'mic', r.mics);
  }
  user.roomid = null;
}

// ─── معالجة الاتصالات الصادرة والواردة لـ Socket.IO ──────────────────────────────
io.on('connection', (socket) => {

  socket.on('msg', (packet) => {
    if (!packet || !packet.cmd) return;
    const cmd = xor(packet.cmd);
    const data = packet.data || {};

    let user = users.get(socket.id);

    // إذا كان الأمر ينتمي للوحة التحكم يتم توجيهه مباشرة لدالة الـ CP
    if (cmd.startsWith('cp_') || ['setpower', 'subs', 'delu', 'pwd', 'rooms', 'logins', 'powers_del'].includes(cmd)) {
      if (user) {
        dispatchCP(socket, user, cmd, data);
      }
      return;
    }

    dispatch(socket, user, cmd, data);
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      leaveRoom(socket, user, 'disconnect');
      users.delete(socket.id);
    }
  });
});

// ─── المحرك الأساسي للأوامر العامة (Client Commands) ──────────────────────────
function dispatch(socket, user, cmd, data) {
  switch (cmd) {

    // ── طلب الاتصال الأولي واستلام الإعدادات العامة
    case 'online': {
      send(socket, 'server', { version: '2.23', secure: true });
      send(socket, 'rlist', [...rooms.values()].map(r => ({ id: r.id, name: r.name, online: r.members.size })));
      send(socket, 'emos', []); 
      send(socket, 'dro3', []); 
      send(socket, 'sico', []); 
      send(socket, 'powers', globalPowers);
      send(socket, 'settings', { allow_guests: true, max_msg_len: 1000 });
      break;
    }

    // ── تسجيل دخول زائر { username, fp, refr, r }
    case 'g': {
      removeRecentLogin(socket.id);
      const name = sanitize(data.username, 20).trim() || 'Guest_' + makeBid();
      const newUser = {
        id: 'g_' + makeBid(), lid: 'guest', name, socketId: socket.id,
        rank: 0, power: 'زائر', roomid: null, pic: 'guest.png'
      };
      users.set(socket.id, newUser);
      send(socket, 'ok', {});
      send(socket, 'login', { msg: 'ok', id: newUser.id, k: 'g', ttoken: 't_' + makeBid(), r: data.r || 'main' });
      break;
    }

    // ── تسجيل دخول عضو مسجل { username, password, stealth, fp, refr, r }
    case 'login': {
      removeRecentLogin(socket.id);
      const usernameKey = (data.username || '').toLowerCase().trim();
      const acc = accounts.get(usernameKey);
      if (!acc || !bcrypt.compareSync(data.password || '', acc.pass)) {
        send(socket, 'login', { msg: 'بيانات الاعتماد غير صحيحة' });
        return;
      }

      // التحقق من انتهاء الصلاحية الممنوحة
      if (acc.powerEnd > 0 && Date.now() > acc.powerEnd) {
        acc.power = '';
        acc.rank = 0;
        acc.powerEnd = 0;
      }

      const newUser = {
        id: 'u_' + makeBid(), lid: acc.lid, name: acc.name, socketId: socket.id,
        rank: acc.rank, power: acc.power, roomid: null, pic: acc.pic || 'member.png'
      };
      users.set(socket.id, newUser);
      acc.last = Date.now();

      send(socket, 'ok', {});
      send(socket, 'login', { msg: 'ok', id: newUser.id, k: 'u', ttoken: 't_' + makeBid(), r: data.r || 'main' });
      break;
    }

    // ── تسجيل حساب جديد { username, password, fp }
    case 'reg': {
      const name = (data.username || '').trim();
      const usernameKey = name.toLowerCase();
      if (usernameKey.length < 3 || accounts.has(usernameKey)) {
        send(socket, 'login', { msg: 'الاسم غير متاح أو مكرر' });
        return;
      }
      const lid = 'l_' + makeBid();
      accounts.set(usernameKey, {
        lid, name, pass: bcrypt.hashSync(data.password, SALT_ROUNDS),
        power: '', rank: 1, created: Date.now(), last: Date.now(), powerEnd: 0
      });
      send(socket, 'ok', {});
      // تسجيل الدخول المباشر بعد التسجيل بنجاح
      const newUser = { id: 'u_' + makeBid(), lid, name, socketId: socket.id, rank: 1, power: '', roomid: null, pic: 'member.png' };
      users.set(socket.id, newUser);
      send(socket, 'login', { msg: 'ok', id: newUser.id, k: 'u', ttoken: 't_' + makeBid(), r: 'main' });
      break;
    }

    // ── دخول الغرفة وبناء مصفوفة rcd الضخمة المتزامنة { r }
    case 'rjoin': {
      if (!user) return;
      leaveRoom(socket, user, 'join_other');

      const targetRoomId = data.r || 'main';
      let r = rooms.get(targetRoomId);
      if (!r) {
        send(socket, 'not', { msg: 'الغرفة غير موجودة' });
        return;
      }

      user.roomid = r.id;
      r.members.add(socket.id);

      // إرسال كتل تهيئة الغرفة المتتابعة للعميل
      send(socket, 'rc', { id: r.id, name: r.name });
      
      // بناء مصفوفة الغرفة المباشرة rcd التي تجمع القوائم والحالات والمايكات المتزامنة مع التطبيق
      const roomMembersList = [...r.members].map(sid => {
        const u = users.get(sid);
        return u ? [u.id, u.name, u.pic, u.rank, u.power] : null;
      }).filter(Boolean);

      const rcdPayload = [
        [ [r.id, r.name, r.max, r.members.size] ], // rlist
        [],                                        // emos
        roomMembersList,                           // ulist
        [user.id, r.id],                           // ur status
        r.mics,                                    // mic slots
        [],                                        // bclist
        []                                         // rops
      ];

      send(socket, 'rcd', rcdPayload);
      send(socket, 'power', buildPower(user, r));
      
      // بث دخول المستخدم u+ لبقية أعضاء الغرفة
      toRoom(r.id, 'u+', { id: user.id, name: user.name, pic: user.pic, rank: user.rank, power: user.power });
      send(socket, 'r^', { id: r.id });
      break;
    }

    // ── إرسال نص في الغرفة العامة { msg }
    case 'msg': {
      if (!user || !user.roomid) return;
      const payload = buildMsg(user, data.msg, { bid: makeBid() });
      toRoom(user.roomid, 'msg', payload);
      break;
    }

    // ── إرسال رسالة حائط / برودكاست { msg, link }
    case 'bc': {
      if (!user || !user.roomid || user.rank < 2) return;
      const payload = buildMsg(user, data.msg, { link: sanitize(data.link, 500), bid: makeBid() });
      toRoom(user.roomid, 'bc', payload);
      break;
    }

    // ── إرسال رسالة خاصة { pm, msg }
    case 'pm': {
      if (!user) return;
      const target = byUID(data.pm);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) {
        const payload = buildMsg(user, data.msg, { pm: user.id, bid: makeBid() });
        send(ts, 'pm', payload);
      }
      break;
    }

    // ── ميديا أو ملف في الغرفة العامة أو الخاص { pm, link }
    case 'file': {
      if (!user) return;
      const { pm: destId, link } = data || {};
      if (!destId || !link) return;

      // 1. التحقق إذا كانت الوجهة عبارة عن غرفة نشطة
      const targetRoom = rooms.get(destId);
      if (targetRoom) {
        const payload = buildMsg(user, '', {
          link: sanitize(link, 500),
          bid: makeBid(),
          mi: makeBid()
        });
        toRoom(targetRoom.id, 'msg', payload);
        break;
      }

      // 2. إذا لم تكن غرفة، يتم التحقق منها وإرسالها كملف خاص للـ UID
      const targetUser = byUID(destId);
      if (!targetUser) return;
      if (targetUser.nopm) { send(socket, 'nopm', { id: destId }); return; }
      
      const ts = io.sockets.sockets.get(targetUser.socketId);
      if (!ts) return;
      const payload = buildMsg(user, '', { pm: user.id, link: sanitize(link, 500), bid: makeBid() });
      send(ts, 'file', payload);
      break;
    }

    // ── التحدث عبر المايك الجماعي وضبط حجز الخانات { slot }
    case 'mic': {
      if (!user || !user.roomid) return;
      const r = rooms.get(user.roomid);
      if (!r) return;

      const slotIdx = parseInt(data.slot);
      if (slotIdx === -1) {
        // ترك المايك
        for (let i = 0; i < r.mics.length; i++) {
          if (r.mics[i] === user.id) r.mics[i] = null;
        }
      } else if (slotIdx >= 0 && slotIdx < r.mics.length) {
        // حجز خانة المايك إن كانت فارغة
        if (r.mics[slotIdx] === null) {
          // إلغاء حجزه من أي مكان آخر أولاً
          for (let i = 0; i < r.mics.length; i++) {
            if (r.mics[i] === user.id) r.mics[i] = null;
          }
          r.mics[slotIdx] = user.id;
        }
      }
      toRoom(r.id, 'mic', r.mics);
      break;
    }

    // ── تعديل العضو لبيانات ملفه الشخصي وعناصر التصميم
    case 'setprofile': {
      if (!user) return;
      user.c = sanitize(data.c, 7);
      user.f = sanitize(data.f, 30);
      user.s = sanitize(data.s, 2);
      if (user.roomid) {
        toRoom(user.roomid, 'u^', { id: user.id, c: user.c, f: user.f, s: user.s });
      }
      break;
    }

    // ── تسجيل الخروج الطوعي للعميل
    case 'logout': {
      if (user) {
        leaveRoom(socket, user, 'logout');
        users.delete(socket.id);
        send(socket, 'close', {});
      }
      break;
    }

    default:
      if (process.env.DEBUG) console.log(`أمر غير معروف: ${cmd}`);
  }
}

// ─── محرك لوحة التحكم والإدارة (Control Panel Commands) ────────────────────────
function dispatchCP(socket, user, cmd, data) {
  const adminOk = user && user.rank >= 7;
  const room = user.roomid ? rooms.get(user.roomid) : null;

  switch (cmd) {

    // ── جلب معلومات وإحصائيات السيرفر للوحة التحكم
    case 'cp_info': {
      if (!adminOk) return;
      send(socket, 'cp_info', {
        server_name: "Raad Server",
        uptime: process.uptime(),
        total_users: accounts.size,
        online_users: users.size,
        rooms_count: rooms.size
      });
      break;
    }

    // ── منح صلاحية أو تعديل رتبة حساب { id, power, days }
    case 'setpower': {
      if (!adminOk) return;
      const targetId = data.id;
      const days = parseInt(data.days) || 0;
      const targetUser = byUID(targetId) || byLID(targetId);
      const targetLid = targetUser ? targetUser.lid : targetId;

      // تحديث الحساب في السجلات وإضافة تواريخ الصلاحية ديناميكياً
      for (const [, acc] of accounts) {
        if (acc.lid === targetLid) {
          acc.power = data.power || '';
          acc.powerEnd = days > 0 ? Date.now() + (days * 86400000) : 0; // 86400000 ملي ثانية لليوم

          if (acc.power) {
            const def = globalPowers.find(p => p.name === acc.power);
            acc.rank = (def && typeof def.rank === 'number') ? def.rank : 3;
          } else {
            acc.rank = 1;
          }
          break;
        }
      }

      // إذا كان المستخدم المستهدف متصلاً الآن، يتم تحديث رتبته وجلسته فوراً
      if (targetUser && targetUser.socketId) {
        targetUser.power = data.power || '';
        const accLive = byLID(targetUser.lid);
        if (accLive) targetUser.rank = accLive.rank;

        const ts = io.sockets.sockets.get(targetUser.socketId);
        if (ts) {
          const targetRoom = targetUser.roomid ? rooms.get(targetUser.roomid) : room;
          if (targetRoom) send(ts, 'power', buildPower(targetUser, targetRoom));
        }
        if (targetUser.roomid) {
          toRoom(targetUser.roomid, 'u^', { id: targetUser.id, power: targetUser.power, rank: targetUser.rank });
        }
      }
      break;
    }

    // ── استعراض الصلاحيات والاشتراكات النشطة والأيام المتبقية
    case 'subs': {
      if (!adminOk) return;
      const now = Date.now();
      const subList = [];
      accounts.forEach((acc, key) => {
        if (!acc.power && acc.rank <= 1) return;
        
        // احتساب المدة المتبقية بصورة لحظية بدقة
        const remainingDays = acc.powerEnd > now ? Math.ceil((acc.powerEnd - now) / 86400000) : (acc.powerEnd === 0 ? 'دائم' : 0);
        
        subList.push({
          id: acc.lid,
          user: acc.name || key,
          power: acc.power || 'عضو',
          topic: acc.name || key,
          days: remainingDays,
          end: acc.powerEnd || 0,
          ls: acc.last || now,
          rank: acc.rank || 0
        });
      });
      send(socket, 'cp_subs', subList);
      break;
    }

    // ── حذف حساب وعضوية بالكامل لمتصل أو غير متصل { id }
    case 'delu': {
      if (!adminOk) return;
      const targetId = data.id;
      const targetUser = byUID(targetId);
      const targetLid = targetUser ? targetUser.lid : targetId;

      // 1. الحذف الجذري من قاعدة البيانات المؤقتة للأعضاء غير المتصلين والنشطين
      for (const [key, acc] of accounts) {
        if (acc.lid === targetLid) { accounts.delete(key); break; }
      }

      // 2. إذا كان متصلاً بالخادم حالياً، يتم فصله وقطع جلسته وإخراجه من الغرف
      if (targetUser) {
        const ts = io.sockets.sockets.get(targetUser.socketId);
        if (ts) {
          if (targetUser.roomid) leaveRoom(ts, targetUser, 'deleted');
          removeRecentLogin(targetUser.id);
          send(ts, 'not', { msg: 'تم حذف حسابك وعضويتك من قبل الإدارة' });
          send(ts, 'close', {});
          setTimeout(() => { try { ts.disconnect(true); } catch (_) {} }, 1000);
        }
      }
      break;
    }

    // ── تغيير كلمة مرور مستخدم متصل أو غير متصل { id, pwd }
    case 'pwd': {
      if (!adminOk) return;
      const targetId = data.id;
      const newPwdHash = bcrypt.hashSync(data.pwd || '123456', SALT_ROUNDS);
      const targetUser = byUID(targetId);
      const targetLid = targetUser ? targetUser.lid : targetId;

      for (const [, acc] of accounts) {
        if (acc.lid === targetLid) { 
          acc.pass = newPwdHash; 
          break; 
        }
      }
      break;
    }

    // ── حذف صلاحية مخصصة من النظام { name }
    case 'powers_del': {
      if (!adminOk) return;
      const pwName = data.name;
      if (!pwName) return;
      
      const idx = globalPowers.findIndex(p => p.name === pwName);
      if (idx !== -1) {
        globalPowers.splice(idx, 1);
        if (room) broadcastPowers(room.id);
        
        // تحديث جدول لوحة التحكم فوراً بعد الحذف
        send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
          id: r.id, name: r.name, topic: r.name,
          user: r.owner || '', pic: r.pic || 'room.png',
          online: r.members.size, uco: r.members.size,
          needpass: r.needpass, owner: r.owner || '', powers: globalPowers
        })));
      }
      break;
    }

    // ── عرض ومزامنة قائمة الغرف للوحة التحكم
    case 'rooms': {
      if (!adminOk) return;
      send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
        id: r.id, name: r.name, topic: r.name,
        user: r.owner || '', pic: r.pic || 'room.png',
        online: r.members.size, uco: r.members.size,
        needpass: r.needpass, owner: r.owner || '', powers: globalPowers
      })));
      break;
    }

    // ── عرض ومزامنة المسجلين للوحة التحكم
    case 'logins': {
      if (!adminOk) return;
      const list = [];
      for (const [key, acc] of accounts) {
        list.push({
          id: acc.lid,
          username: acc.name,
          topic: acc.name,
          power: acc.power || 'عضو',
          created: acc.created,
          last: acc.last
        });
      }
      send(socket, 'cp_logins', list);
      break;
    }

    default:
      if (process.env.DEBUG) console.log(`[CP] أمر لوحة تحكم غير معروف: "${cmd}"`);
  }
}

// ─── بدء واستماع السيرفر ───────────────────────────────────────────────────────
seedRooms();
seedAdmin();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n===============================================================`);
  console.log(`🚀 السيرفر جاهز ويعمل بالكامل على المنفذ: ${PORT}`);
  console.log(`📅 متوافق تماماً مع حزم وأحداث وتشفير وثيقة appraad2.js`);
  console.log(`===============================================================\n`);
});
