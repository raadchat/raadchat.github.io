/**
 * ===================================================
 * Chat Application Server
 * يتوافق مع ملف العميل: decoded_x3_final.js
 * ===================================================
 *
 * الأوامر المدعومة (Commands):
 *   online / online+ / online-  - قائمة المتصلين
 *   msg                         - رسالة دردشة
 *   bc                          - رسالة الحائط (broadcast)
 *   power                       - صلاحيات المستخدم
 *   ban / kick                  - حظر / طرد
 *   mic / uml / micstat         - إدارة المايك
 *   p2                          - إشارات WebRTC
 *   call                        - مكالمة صوتية
 *   login                       - تسجيل الدخول
 *   logout                      - تسجيل الخروج
 *   settings                    - إعدادات الغرفة
 *   rc2                         - إعادة الاتصال بالرمز
 *   ty                          - مؤشر الكتابة
 *   cp                          - لوحة التحكم
 *   nopm                        - حظر الرسائل الخاصة
 * ===================================================
 */

require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bcrypt  = require('bcryptjs');

// ─── الإعدادات الأساسية ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';       // مفتاح لوحة التحكم
const MAX_MIC_SLOTS = 5;                                      // عدد خانات المايك

// ─── تهيئة Express و Socket.IO ───────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  pingTimeout: 20000,
  pingInterval: 10000,
  transports: ['websocket', 'polling']
});

app.use(express.static('public'));   // مجلد الملفات الثابتة (HTML/CSS/JS)
app.use(express.json());

// ─── البيانات في الذاكرة ─────────────────────────────────────────────────────

/** @type {Map<string, Room>} */
const rooms = new Map();

/** @type {Map<string, User>} */
const users = new Map();          // socketId => User

/** @type {Map<string, BanEntry[]>} */
const bans  = new Map();          // roomId => list of banned fingerprints/IPs

// قائمة الإيموجيات الافتراضية (أسماء ملفات داخل مجلد emo/)
const defaultEmos = [
  'smile.png','laugh.png','wink.png','heart.png','sad.png',
  'angry.png','surprised.png','cool.png','thumbup.png','fire.png'
];

// إعدادات الغرفة الافتراضية
function defaultSettings() {
  return {
    mic:     true,   // السماح بطلب المايك
    setpower:false,  // صلاحية منح الرتب
    ban:     false,  // صلاحية الحظر
    owner:   false,  // صلاحية المالك
    calls:   true,   // السماح بالمكالمات الصوتية
    mlikes:  true,   // الإعجابات على الرسائل الخاصة
    bclikes: true,   // الإعجابات على الحائط
    mreply:  false,  // الرد في الرسائل الخاصة
    bcreply: false   // الرد في الحائط
  };
}

// ─── هياكل البيانات ───────────────────────────────────────────────────────────

class Room {
  constructor(id, topic, pass = '') {
    this.id       = id;
    this.topic    = topic;
    this.pass     = pass ? bcrypt.hashSync(pass, 8) : '';
    this.needpass = pass !== '';
    this.pic      = 'room.png';
    this.bg       = '';
    this.ucol     = '';
    this.settings = defaultSettings();
    this.powers   = [];       // قائمة الرتب [{name, rank, ...}]
    this.ops      = [];       // معرفات المشرفين
    this.sicos    = [];       // صور الغرف (sico)
    this.emos     = [...defaultEmos];
    this.colors   = [];       // قائمة الألوان (dro3)
    this.mic      = new Array(MAX_MIC_SLOTS).fill(0);   // 0 = فارغ
    this.members  = new Map(); // socketId => User
    this.wall     = [];        // آخر رسائل الحائط
    this.bots     = new Map(); // بوتات الغرفة
    this.bans     = [];        // قائمة الحظر
  }
}

class User {
  constructor(socketId, data = {}) {
    this.socketId = socketId;
    this.id       = data.id    || uuidv4().replace(/-/g, '').substring(0, 16);
    this.lid      = data.lid   || this.id;   // معرف تسجيل الدخول
    this.topic    = data.topic || 'زائر';
    this.msg      = data.msg   || '';
    this.pic      = data.pic   || 'pic.png';
    this.ico      = data.ico   || '';
    this.co       = data.co    || '--';
    this.bg       = data.bg    || '';
    this.ucol     = data.ucol  || '';
    this.rep      = data.rep   || 0;         // الإعجابات / السمعة
    this.power    = data.power || '';        // اسم الرتبة
    this.rank     = data.rank  || 0;
    this.roomid   = null;                    // الغرفة الحالية
    this.token    = null;                    // رمز إعادة الاتصال
    this._fp      = data._fp  || '';         // البصمة
    this._ip      = data._ip  || '';
    this.s        = data.s    || false;      // مخفي
  }

  /** تحويل إلى كائن يُرسل للعميل */
  toPublic() {
    return {
      id:    this.id,
      lid:   this.lid,
      topic: this.topic,
      msg:   this.msg,
      pic:   this.pic,
      ico:   this.ico,
      co:    this.co,
      bg:    this.bg,
      ucol:  this.ucol,
      rep:   this.rep,
      power: this.power,
      rank:  this.rank,
      roomid:this.roomid,
      s:     this.s
    };
  }
}

// ─── مساعدات ─────────────────────────────────────────────────────────────────

/** ترميز/فك الأوامر بنفس خوارزمية العميل */
function decodeCmd(str) {
  const chars = (str || '').split('');
  const len   = chars.length;
  for (let i = 0; i < len; i++) {
    chars[i] = String.fromCharCode(str.charCodeAt(i) ^ 2);
    i += i < 20 ? 1 : i < 200 ? 4 : 16;
  }
  return chars.join('');
}

function send(socket, cmd, data) {
  socket.emit('msg', { cmd: decodeCmd(cmd), data });
}

function sendToRoom(roomId, cmd, data, exceptSocketId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.members.forEach((user, socketId) => {
    if (socketId === exceptSocketId) return;
    const s = io.sockets.sockets.get(socketId);
    if (s) send(s, cmd, data);
  });
}

function getUserByUID(uid) {
  for (const [, u] of users) {
    if (u.id === uid) return u;
  }
  return null;
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function isBanned(room, user) {
  return room.bans.some(b =>
    b === user._fp || b === user._ip ||
    (b.startsWith('*=') && user._fp.includes(b.slice(2))) ||
    (b.startsWith('**=') && user._fp.includes(b.slice(3)))
  );
}

// ─── إعداد غرف افتراضية ──────────────────────────────────────────────────────
function createDefaultRooms() {
  const r1 = new Room('room_main', 'الغرفة الرئيسية');
  const r2 = new Room('room_games', 'العاب');
  const r3 = new Room('room_music', 'موسيقى');
  rooms.set(r1.id, r1);
  rooms.set(r2.id, r2);
  rooms.set(r3.id, r3);
  console.log('[Server] تم إنشاء الغرف الافتراضية.');
}

// ─── منطق الاتصال بـ Socket.IO ───────────────────────────────────────────────
io.on('connection', (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  const user = new User(socket.id, { _ip: ip });
  users.set(socket.id, user);

  console.log(`[+] اتصال جديد: ${socket.id} | IP: ${ip}`);

  // ── استقبال كل الأوامر من العميل ─────────────────────────────────────────
  socket.on('msg', (payload) => {
    if (!payload || typeof payload.cmd !== 'string') return;
    const cmd  = decodeCmd(payload.cmd);
    const data = payload.data;

    try {
      handleClientCmd(socket, user, cmd, data);
    } catch (err) {
      console.error(`[!] خطأ في معالجة الأمر "${cmd}":`, err.message);
    }
  });

  // ── إعادة الاتصال بالرمز (rc2) ───────────────────────────────────────────
  socket.on('rc2', ({ token, n }) => {
    // البحث عن مستخدم سابق بنفس الرمز
    for (const [, u] of users) {
      if (u.token === token && u.socketId !== socket.id) {
        user.id     = u.id;
        user.lid    = u.lid;
        user.topic  = u.topic;
        user.msg    = u.msg;
        user.pic    = u.pic;
        user.ico    = u.ico;
        user.co     = u.co;
        user.bg     = u.bg;
        user.ucol   = u.ucol;
        user.rep    = u.rep;
        user.power  = u.power;
        user.rank   = u.rank;
        user.roomid = u.roomid;
        user.token  = token;
        break;
      }
    }
    send(socket, 'online', []);
  });

  // ── قطع الاتصال ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] انقطع الاتصال: ${socket.id}`);
    handleDisconnect(socket, user);
    users.delete(socket.id);
  });
});

// ─── معالجة أوامر العميل ─────────────────────────────────────────────────────
function handleClientCmd(socket, user, cmd, data) {

  switch (cmd) {

    // ════════════════════════════════════════════════════════════════════════
    // الاتصال الأولي - يُرسل قائمة الغرف والإعداد للعميل
    // ════════════════════════════════════════════════════════════════════════
    case 'online': {
      // إرسال رمز جلسة
      user.token = uuidv4();
      send(socket, 'online', []);        // قائمة المتصلين في اللوبي (فارغة هنا)
      send(socket, 'rlist', buildRoomList());
      send(socket, 'emos',  defaultEmos);
      send(socket, 'dro3',  []);
      send(socket, 'sico',  buildSicoList());
      send(socket, 'powers', []);
      send(socket, 'settings', defaultSettings());
      send(socket, 'server', { online: io.engine.clientsCount });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تسجيل الدخول
    // ════════════════════════════════════════════════════════════════════════
    case 'login': {
      const { u1, u2, pass1, or: roomId, fp } = data || {};
      user.topic  = sanitize(u1) || 'زائر';
      user.msg    = sanitize(u2) || '';
      user._fp    = fp || '';
      user.token  = uuidv4();

      // أرسل "ok" و معرف المستخدم
      send(socket, 'ok', null);
      send(socket, 'login', { msg: 'ok', id: user.id, k: user.token });

      // انضم للغرفة المطلوبة أو الأولى
      const targetRoom = roomId ? rooms.get(roomId) : rooms.values().next().value;
      if (targetRoom) joinRoom(socket, user, targetRoom, pass1 || '');
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تسجيل الخروج
    // ════════════════════════════════════════════════════════════════════════
    case 'logout': {
      leaveCurrentRoom(socket, user);
      user.roomid = null;
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // الانضمام لغرفة أخرى
    // ════════════════════════════════════════════════════════════════════════
    case 'or': {
      const room = rooms.get(data?.id || data);
      if (!room) return;
      leaveCurrentRoom(socket, user);
      joinRoom(socket, user, room, data?.pass || '');
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رسالة دردشة خاصة (msg)
    // ════════════════════════════════════════════════════════════════════════
    case 'msg': {
      const { id: toId, msg: msgText, link, bid } = data || {};
      if (!msgText && !link) return;
      const target = getUserByUID(toId);
      if (!target) return;

      const payload = {
        id:   user.id,
        msg:  sanitize(msgText),
        link: link || null,
        bid:  bid  || null
      };
      send(io.sockets.sockets.get(target.socketId), 'msg', payload);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رسالة الحائط (bc - broadcast)
    // ════════════════════════════════════════════════════════════════════════
    case 'bc': {
      const { msg: msgText, link, bid } = data || {};
      if (!msgText && !link) return;
      if (!user.roomid) return;
      const room = getRoom(user.roomid);
      if (!room) return;

      const payload = {
        id:   user.id,
        msg:  sanitize(msgText),
        link: link  || null,
        bid:  bid   || null
      };
      room.wall.push(payload);
      if (room.wall.length > 200) room.wall.shift();
      sendToRoom(user.roomid, 'bc', payload);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // طلب المايك / مغادرته
    // ════════════════════════════════════════════════════════════════════════
    case 'mic': {
      if (!user.roomid) return;
      const room = getRoom(user.roomid);
      if (!room) return;

      const slotIndex = data; // رقم الخانة أو -1 للمغادرة

      // مغادرة المايك
      if (slotIndex === -1) {
        const i = room.mic.indexOf(user.id);
        if (i !== -1) {
          room.mic[i] = 0;
          sendToRoom(user.roomid, 'mic', room.mic);
          notifyPeersLeave(room, user);
        }
        return;
      }

      // طلب خانة
      const idx = slotIndex >= 0 && slotIndex < MAX_MIC_SLOTS ? slotIndex
        : room.mic.findIndex(v => v === 0);
      if (idx === -1) return; // لا توجد خانات فارغة

      // تأكد من أن الخانة فارغة أو مقفلة برقم 0
      if (room.mic[idx] !== 0) return;

      room.mic[idx] = user.id;
      sendToRoom(user.roomid, 'mic', room.mic);

      // أبلغ المستخدمين الآخرين في المايك لبدء WebRTC
      room.mic.forEach((uid, i) => {
        if (typeof uid === 'string' && uid !== user.id) {
          const peer = getUserByUID(uid);
          if (peer) {
            const ps = io.sockets.sockets.get(peer.socketId);
            if (ps) send(ps, 'p2', { t: 'start', id: user.id });
          }
        }
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // سحب المايك من مستخدم آخر
    // ════════════════════════════════════════════════════════════════════════
    case 'uml': {
      const room = user.roomid ? getRoom(user.roomid) : null;
      if (!room) return;
      const hasPower = room.settings.mic || room.ops.includes(user.lid);
      if (!hasPower) return;

      const i = room.mic.indexOf(data);
      if (i !== -1) {
        room.mic[i] = 0;
        sendToRoom(user.roomid, 'mic', room.mic);
      }
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تغيير حالة المايك (قفل / تفعيل)
    // ════════════════════════════════════════════════════════════════════════
    case 'micstat': {
      const { i: mIdx, v: mVal } = data || {};
      const room = user.roomid ? getRoom(user.roomid) : null;
      if (!room) return;
      if (!room.ops.includes(user.lid) && !room.settings.mic) return;
      // 0 = قفل, معرف = تفعيل
      room.mic[mIdx] = mVal ? room.mic[mIdx] : 0;
      sendToRoom(user.roomid, 'mic', room.mic);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // إشارات WebRTC (p2)
    // ════════════════════════════════════════════════════════════════════════
    case 'p2': {
      const { id: targetId, t: sigType, data: sigData, dir } = data || {};
      const targetUser = getUserByUID(targetId);
      if (!targetUser) return;
      const ts = io.sockets.sockets.get(targetUser.socketId);
      if (!ts) return;
      send(ts, 'p2', { t: sigType, id: user.id, data: sigData, dir: dir === 1 ? 0 : 1 });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // مكالمة صوتية (call)
    // ════════════════════════════════════════════════════════════════════════
    case 'call': {
      const { id: callTargetId, t: callType, data: callData } = data || {};
      const targetUser = getUserByUID(callTargetId);
      if (!targetUser) return;
      const ts = io.sockets.sockets.get(targetUser.socketId);
      if (!ts) return;
      send(ts, 'call', { t: callType, id: user.id, data: callData });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // مؤشر الكتابة (ty)
    // ════════════════════════════════════════════════════════════════════════
    case 'ty': {
      const [toId, typingVal] = Array.isArray(data) ? data : [];
      const targetUser = getUserByUID(toId);
      if (!targetUser) return;
      const ts = io.sockets.sockets.get(targetUser.socketId);
      if (ts) send(ts, 'ty', [user.id, typingVal]);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رفض رسالة خاصة (nopm)
    // ════════════════════════════════════════════════════════════════════════
    case 'nopm': {
      const targetUser = getUserByUID(data?.id);
      if (!targetUser) return;
      const ts = io.sockets.sockets.get(targetUser.socketId);
      if (ts) send(ts, 'nopm', { id: user.id });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // لوحة التحكم (cp)
    // ════════════════════════════════════════════════════════════════════════
    case 'cp': {
      handleCpCmd(socket, user, data);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تحديث بيانات المستخدم الخاصة
    // ════════════════════════════════════════════════════════════════════════
    case 'upd': {
      const { topic, msg, pic, co, bg, ucol } = data || {};
      if (topic !== undefined) user.topic = sanitize(topic);
      if (msg   !== undefined) user.msg   = sanitize(msg);
      if (pic   !== undefined) user.pic   = pic;
      if (co    !== undefined) user.co    = co;
      if (bg    !== undefined) user.bg    = bg;
      if (ucol  !== undefined) user.ucol  = ucol;

      if (user.roomid) {
        sendToRoom(user.roomid, 'online+', user.toPublic(), null);
      }
      break;
    }

    default:
      console.log(`[?] أمر غير معروف: "${cmd}"`, data);
  }
}

// ─── معالجة أوامر لوحة التحكم (cp) ──────────────────────────────────────────
function handleCpCmd(socket, user, data) {
  const { cmd } = data || {};

  // التحقق من الصلاحية
  const isAdmin = user.rank >= 9000 || user.lid === ADMIN_KEY;

  switch (cmd) {

    case 'ban': {
      const room = user.roomid ? getRoom(user.roomid) : null;
      if (!room || !isAdmin) return;
      room.bans.push(data.type);
      // طرد المحظور إذا كان موجوداً
      room.members.forEach((u, sid) => {
        if (isBanned(room, u)) {
          const s = io.sockets.sockets.get(sid);
          if (s) { send(s, 'kick', { reason: 'banned' }); s.disconnect(true); }
        }
      });
      send(socket, 'cp', { cmd: 'bans', data: room.bans });
      break;
    }

    case 'aban': {
      const room = user.roomid ? getRoom(user.roomid) : null;
      if (!room || !isAdmin) return;
      room.bans = room.bans.filter(b => b !== data.type);
      send(socket, 'cp', { cmd: 'bans', data: room.bans });
      break;
    }

    case 'kick': {
      if (!isAdmin) return;
      const target = getUserByUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) { send(ts, 'kick', {}); ts.disconnect(true); }
      break;
    }

    case 'setpower': {
      if (!isAdmin) return;
      const target = getUserByUID(data.id);
      if (!target) return;
      target.power = data.power || '';
      target.rank  = data.days === 0 ? 9000 : 0;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'power', buildPowerPayload(target));
      break;
    }

    case 'bot': {
      if (!isAdmin) return;
      const room = user.roomid ? getRoom(user.roomid) : null;
      if (!room) return;
      const bot = room.bots.get(data.id) || {};
      Object.assign(bot, data);
      room.bots.set(data.id, bot);
      break;
    }

    case 'likes': {
      if (!isAdmin) return;
      const target = getUserByUID(data.id);
      if (target) target.rep = data.likes;
      break;
    }

    case 'pwd': {
      // تغيير كلمة المرور – يُكمَل لاحقاً حسب نظام التخزين
      break;
    }

    case 'delu': {
      if (!isAdmin) return;
      const target = getUserByUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) ts.disconnect(true);
      break;
    }

    case 'addico':
    case 'delico': {
      // إدارة الأيقونات – تُخزَّن في الغرفة
      const room = user.roomid ? getRoom(user.roomid) : null;
      if (!room || !isAdmin) return;
      if (cmd === 'addico') room.sicos.push(data.pid);
      else room.sicos = room.sicos.filter(s => s !== data.pid);
      sendToRoom(user.roomid, 'sico', buildSicoList());
      break;
    }

    default:
      console.log(`[CP] أمر غير معروف: "${cmd}"`);
  }
}

// ─── الانضمام لغرفة ───────────────────────────────────────────────────────────
function joinRoom(socket, user, room, pass = '') {
  // التحقق من كلمة المرور
  if (room.needpass && room.pass) {
    if (!bcrypt.compareSync(pass, room.pass)) {
      send(socket, 'login', { msg: 'wrongpass' });
      return;
    }
  }

  // التحقق من الحظر
  if (isBanned(room, user)) {
    send(socket, 'login', { msg: 'banned' });
    return;
  }

  user.roomid = room.id;
  room.members.set(socket.id, user);

  // أرسل للمستخدم بيانات الغرفة
  send(socket, 'rc', null);               // بداية حزمة الغرفة
  send(socket, 'ulist', buildUserList(room));
  send(socket, 'rlist', buildRoomList());
  send(socket, 'emos',  room.emos);
  send(socket, 'dro3',  room.colors);
  send(socket, 'sico',  buildSicoList());
  send(socket, 'powers', room.powers);
  send(socket, 'settings', room.settings);
  send(socket, 'power', buildPowerPayload(user));
  send(socket, 'mic',   room.mic);
  send(socket, 'rcd', []); // انتهاء حزمة الغرفة

  // أبلغ بقية أعضاء الغرفة
  sendToRoom(room.id, 'online+', user.toPublic(), socket.id);

  console.log(`[Room] ${user.topic} انضم إلى "${room.topic}"`);
}

// ─── مغادرة الغرفة الحالية ───────────────────────────────────────────────────
function leaveCurrentRoom(socket, user) {
  if (!user.roomid) return;
  const room = getRoom(user.roomid);
  if (!room) return;

  // إزالة من قائمة المايك
  const micIdx = room.mic.indexOf(user.id);
  if (micIdx !== -1) {
    room.mic[micIdx] = 0;
    sendToRoom(user.roomid, 'mic', room.mic, socket.id);
    notifyPeersLeave(room, user);
  }

  room.members.delete(socket.id);
  sendToRoom(user.roomid, 'online-', user.id);
  user.roomid = null;
}

// ─── إبلاغ أعضاء المايك بمغادرة مستخدم (WebRTC cleanup) ─────────────────────
function notifyPeersLeave(room, user) {
  room.mic.forEach((uid) => {
    if (typeof uid === 'string' && uid !== user.id) {
      const peer = getUserByUID(uid);
      if (peer) {
        const ps = io.sockets.sockets.get(peer.socketId);
        if (ps) send(ps, 'p2', { t: 'x', id: user.id });
      }
    }
  });
}

// ─── معالجة قطع الاتصال ──────────────────────────────────────────────────────
function handleDisconnect(socket, user) {
  leaveCurrentRoom(socket, user);
}

// ─── بناء البيانات للإرسال ───────────────────────────────────────────────────

function buildUserList(room) {
  const list = [];
  room.members.forEach(u => list.push(u.toPublic()));
  return list;
}

function buildRoomList() {
  const list = [];
  rooms.forEach(r => {
    list.push({
      id:       r.id,
      topic:    r.topic,
      pic:      r.pic,
      needpass: r.needpass,
      count:    r.members.size
    });
  });
  return list;
}

function buildSicoList() {
  const list = [];
  rooms.forEach(r => {
    list.push({ id: r.id, topic: r.topic, pic: r.pic });
  });
  return list;
}

function buildPowerPayload(user) {
  return {
    mic:      true,
    setpower: user.rank >= 9000,
    ban:      user.rank >= 5000,
    owner:    user.rank >= 9000,
    cp:       user.rank >= 9000
  };
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 500);
}

// ─── REST API بسيط ───────────────────────────────────────────────────────────

/** معلومات السيرفر */
app.get('/api/status', (req, res) => {
  res.json({
    users: users.size,
    rooms: [...rooms.values()].map(r => ({
      id: r.id, topic: r.topic, count: r.members.size
    }))
  });
});

/** إنشاء غرفة جديدة */
app.post('/api/rooms', (req, res) => {
  const { key, topic, pass } = req.body;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'غير مسموح' });
  if (!topic) return res.status(400).json({ error: 'اسم الغرفة مطلوب' });
  const room = new Room('room_' + Date.now(), topic, pass || '');
  rooms.set(room.id, room);
  io.emit('msg', { cmd: decodeCmd('rlist'), data: buildRoomList() });
  res.json({ id: room.id, topic: room.topic });
});

/** حذف غرفة */
app.delete('/api/rooms/:id', (req, res) => {
  const { key } = req.body;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'غير مسموح' });
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' });
  // طرد الأعضاء
  room.members.forEach((u, sid) => {
    const s = io.sockets.sockets.get(sid);
    if (s) send(s, 'kick', { reason: 'room_deleted' });
  });
  rooms.delete(req.params.id);
  io.emit('msg', { cmd: decodeCmd('rlist'), data: buildRoomList() });
  res.json({ deleted: true });
});

// ─── تشغيل السيرفر ───────────────────────────────────────────────────────────
createDefaultRooms();

server.listen(PORT, () => {
  console.log(`\n✅ السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`   http://localhost:${PORT}\n`);
});
