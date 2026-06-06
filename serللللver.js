/**
 * =============================================================
 *  Chat Server  —  متوافق 100% مع x3_final.js
 * =============================================================
 *
 *  البروتوكول:
 *    - كل رسالة socket.io تنتقل تحت الحدث  "msg"
 *      الصيغة:  { cmd: decodeCmd(commandName), data: payload }
 *    - تشفير الأوامر: XOR بسيط (نفس decodeCmd في العميل)
 *    - rc2 يُرسَل مباشرة كحدث منفصل (بدون تشفير)
 *
 *  أسماء الحقول مطابقة لما يرسله / يتوقعه x3_final.js:
 *    login  : { username, password, stealth, fp, refr, r }
 *    g      : { username, fp, refr, r }
 *    reg    : { username, password, fp, refr, r }
 *    rjoin  : { id, pwd }
 *    msg    : { msg, mi }
 *    bc     : { msg, bid }
 *    pm     : { msg, id }
 *    p2     : { t, id, dir, data }
 *    call   : { t, id }
 *    ty     : [targetId, 0|1]
 *    mic    : slotIndex | -1
 * =============================================================
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bcrypt     = require('bcryptjs');

// ─── إعدادات ─────────────────────────────────────────────────────────────────
const PORT          = process.env.PORT          || 5000;
const ADMIN_KEY     = process.env.ADMIN_KEY     || 'admin123';
const MAX_MIC_SLOTS = parseInt(process.env.MAX_MIC_SLOTS)  || 5;
const MAX_WALL      = parseInt(process.env.MAX_WALL_MSGS)  || 200;
const SALT_ROUNDS   = 8;

// ─── تشفير الأوامر — نفس decodeCmd في x3_final.js ───────────────────────────
function decodeCmd(str) {
  const chars = (str || '').split('');
  const len   = chars.length;
  for (let i = 0; i < len; i++) {
    chars[i] = String.fromCharCode(str.charCodeAt(i) ^ 2);
    i += i < 20 ? 1 : i < 200 ? 4 : 16;
  }
  return chars.join('');
}

// ─── تهيئة Express + Socket.IO ───────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  pingTimeout:  25000,
  pingInterval: 10000,
  transports:   ['websocket', 'polling']
});

app.use(express.static('public'));
app.use(express.json());

// ─── قواعد البيانات في الذاكرة ───────────────────────────────────────────────
/** socketId → User   */  const users    = new Map();
/** roomId   → Room   */  const rooms    = new Map();
/** nameKey  → AccObj */  const accounts = new Map();   // الأعضاء المسجلون

// ─── هيكل المستخدم ───────────────────────────────────────────────────────────
class User {
  constructor(socketId, fields = {}) {
    this.socketId = socketId;
    this.id       = fields.id    || genId();
    this.lid      = fields.lid   || this.id;       // login-id (دائم للأعضاء)
    this.topic    = fields.topic || 'زائر';
    this.msg      = fields.msg   || '';
    this.pic      = fields.pic   || 'pic.png';
    this.ico      = fields.ico   || '';
    this.co       = fields.co    || '--';
    this.bg       = fields.bg    || '';
    this.ucol     = fields.ucol  || '';
    this.rep      = fields.rep   || 0;
    this.power    = fields.power || '';
    this.rank     = fields.rank  || 0;
    this.roomid   = null;
    this.token    = genId();
    this._fp      = fields._fp   || '';
    this._ip      = fields._ip   || '';
    this.s        = fields.s     || false;   // stealth
    this.nopm     = false;
    this.nonot    = false;
    this.refr     = fields.refr  || '';
    this.created  = Date.now();
    this.last     = Date.now();
  }

  /** ما يُرسَل للعملاء الآخرين */
  pub() {
    return {
      id:     this.id,
      lid:    this.lid,
      topic:  this.topic,
      msg:    this.msg,
      pic:    this.pic,
      ico:    this.ico,
      co:     this.co,
      bg:     this.bg,
      ucol:   this.ucol,
      rep:    this.rep,
      power:  this.power,
      rank:   this.rank,
      roomid: this.roomid,
      s:      this.s
    };
  }
}

// ─── هيكل الغرفة ─────────────────────────────────────────────────────────────
class Room {
  constructor(id, name, pass = '') {
    this.id       = id;
    this.name     = name;           // x3 يستخدم .name وليس .topic للغرف
    this.pass     = pass ? bcrypt.hashSync(pass, SALT_ROUNDS) : '';
    this.needpass = pass !== '';
    this.pic      = 'room.png';
    this.bg       = '';
    this.ucol     = '';
    this.owner    = null;           // lid مالك الغرفة
    this.settings = {
      mic: true, setpower: false, ban: false, owner: false,
      calls: true, mlikes: true, bclikes: true, mreply: false, bcreply: false
    };
    this.powers   = [];             // رتب الغرفة
    this.ops      = [];             // lid[] المشرفون
    this.sicos    = [];
    this.emos     = [];
    this.colors   = [];
    this.mic      = new Array(MAX_MIC_SLOTS).fill(0);
    this.members  = new Map();      // socketId → User
    this.wall     = [];             // رسائل الحائط (max MAX_WALL)
    this.bots     = new Map();
    this.bans     = [];             // { id, type, fp, ip, name, expires, count, last }
  }
}

// ─── مساعدات ─────────────────────────────────────────────────────────────────
function genId() {
  return uuidv4().replace(/-/g, '').slice(0, 16);
}

function sanitize(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, maxLen);
}

function makeBid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '00';
}

/** إرسال أمر مشفر لمقبس واحد */
function send(socket, cmd, data) {
  socket.emit('msg', { cmd: decodeCmd(cmd), data });
}

/** إرسال لجميع أعضاء الغرفة (مع استثناء اختياري) */
function toRoom(roomId, cmd, data, exceptSid = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.members.forEach((_, sid) => {
    if (sid === exceptSid) return;
    const s = io.sockets.sockets.get(sid);
    if (s) send(s, cmd, data);
  });
}

/** إيجاد مستخدم بـ id */
function byUID(uid) {
  for (const u of users.values()) if (u.id === uid) return u;
  return null;
}

/** إيجاد مستخدم بـ lid */
function byLID(lid) {
  for (const u of users.values()) if (u.lid === lid) return u;
  return null;
}

/** هل المستخدم محظور من الغرفة؟ */
function isBanned(room, user) {
  return room.bans.some(b => {
    if (!b.active) return false;
    if (b.fp  && b.fp  === user._fp)  return true;
    if (b.ip  && b.ip  === user._ip)  return true;
    if (b.lid && b.lid === user.lid)  return true;
    return false;
  });
}

/** هل لديه صلاحية مشرف؟ */
function isAdmin(user, room = null) {
  if (user.rank >= 9000) return true;
  if (room && room.ops.includes(user.lid)) return true;
  return false;
}

/** بناء payload الصلاحيات لمستخدم في غرفة */
function buildPower(user, room) {
  const admin = user.rank >= 9000;
  const mod   = room ? room.ops.includes(user.lid) : false;
  return {
    mic:       true,
    setpower:  admin || (mod && room?.settings?.setpower),
    ban:       admin || (mod && room?.settings?.ban),
    owner:     admin || (room?.owner === user.lid),
    cp:        admin || mod,
    calls:     true,
    publicmsg: 0,
    roomowner: room?.owner === user.lid
  };
}

/** بناء رسالة موحدة */
function buildMsg(sender, text, extra = {}) {
  return Object.assign({
    uid:   sender.id,
    lid:   sender.lid,
    pic:   sender.pic,
    ico:   sender.ico  || '',
    ucol:  sender.ucol || '',
    topic: sender.topic,
    t:     Date.now(),
    msg:   sanitize(text || '')
  }, extra);
}

/** قائمة غرف مُشكَّلة لـ rlist / r+ / r^ */
function roomListItem(room) {
  return {
    id:       room.id,
    name:     room.name,
    pic:      room.pic,
    needpass: room.needpass,
    online:   room.members.size
  };
}

/** إرسال تحديث الغرفة لجميع المتصلين */
function broadcastRoomUpdate(room) {
  io.emit('msg', { cmd: decodeCmd('r^'), data: roomListItem(room) });
}

/** قائمة مشرفي الغرفة المتصلين */
function buildRops(room) {
  return room.ops
    .map(lid => {
      for (const u of room.members.values()) {
        if (u.lid === lid) return { id: u.id, lid: u.lid, name: u.topic, pic: u.pic };
      }
      return null;
    })
    .filter(Boolean);
}

/** حفظ بيانات في حساب العضو */
function saveAccount(user, fields) {
  for (const [, acc] of accounts) {
    if (acc.lid === user.lid) { Object.assign(acc, fields); return; }
  }
}

// ─── إنشاء غرف افتراضية ──────────────────────────────────────────────────────
function seedRooms() {
  [
    { id: 'main',   name: '( 1 ) الغرفة الرئيسية' },
    { id: 'games',  name: '( 2 ) العاب'            },
    { id: 'music',  name: '( 3 ) موسيقى'           }
  ].forEach(d => {
    const r = new Room(d.id, d.name);
    rooms.set(r.id, r);
  });
  console.log('[Server] الغرف الافتراضية جاهزة:', [...rooms.keys()].join(', '));
}

// ─── الانضمام لغرفة ──────────────────────────────────────────────────────────
function joinRoom(socket, user, room, pwd = '') {

  // التحقق من كلمة المرور
  if (room.needpass && room.pass) {
    if (!pwd) { send(socket, 'login', { msg: 'needpass' }); return; }
    if (!bcrypt.compareSync(pwd, room.pass)) {
      send(socket, 'login', { msg: 'wrong' }); return;
    }
  }

  // التحقق من الحظر
  if (isBanned(room, user)) {
    send(socket, 'login', { msg: 'banned' }); return;
  }

  user.roomid = room.id;
  user.last   = Date.now();
  room.members.set(socket.id, user);

  // ─── إرسال بيانات الغرفة للمستخدم ────────────────────────────────────
  send(socket, 'rc',       null);                        // بداية تحميل الغرفة
  send(socket, 'setroom',  room.id);                     // إبلاغ العميل برقم الغرفة
  send(socket, 'ulist',    [...room.members.values()].map(u => u.pub()));
  send(socket, 'rlist',    [...rooms.values()].map(roomListItem));
  send(socket, 'emos',     room.emos.length ? room.emos : []);
  send(socket, 'dro3',     room.colors);
  send(socket, 'sico',     room.sicos);
  send(socket, 'powers',   room.powers);
  send(socket, 'settings', room.settings);
  send(socket, 'power',    buildPower(user, room));
  send(socket, 'mic',      room.mic);
  send(socket, 'bclist',   room.wall);
  send(socket, 'rops',     buildRops(room));
  send(socket, 'rcd',      []);                          // نهاية تحميل الغرفة

  // إبلاغ بقية الأعضاء
  toRoom(room.id, 'online+', user.pub(), socket.id);

  // تحديث عداد الغرفة للجميع
  broadcastRoomUpdate(room);

  console.log(`[Room] "${user.topic}" دخل → "${room.name}"`);
}

// ─── مغادرة الغرفة ───────────────────────────────────────────────────────────
function leaveRoom(socket, user) {
  if (!user.roomid) return;
  const room = rooms.get(user.roomid);
  if (!room) return;

  // تحرير خانة المايك
  const mi = room.mic.indexOf(user.id);
  if (mi !== -1) {
    room.mic[mi] = 0;
    toRoom(room.id, 'mic', room.mic, socket.id);
    // إبلاغ أعضاء P2P بقطع الاتصال
    room.mic.forEach(uid => {
      if (typeof uid === 'string' && uid !== user.id) {
        const peer = byUID(uid);
        if (peer) {
          const ps = io.sockets.sockets.get(peer.socketId);
          if (ps) send(ps, 'p2', { t: 'x', id: user.id });
        }
      }
    });
  }

  room.members.delete(socket.id);
  user.roomid = null;

  toRoom(room.id, 'online-', user.id);
  broadcastRoomUpdate(room);
}

// ─── Socket.IO الاتصالات ──────────────────────────────────────────────────────
io.on('connection', socket => {
  const ip   = (socket.handshake.headers['x-forwarded-for'] || '').split(',')[0].trim()
             || socket.handshake.address;
  const user = new User(socket.id, { _ip: ip });
  users.set(socket.id, user);

  // ── الحدث الرئيسي: كل الرسائل تمر هنا ─────────────────────────────────
  socket.on('msg', packet => {
    if (!packet || typeof packet.cmd !== 'string') return;
    const cmd  = decodeCmd(packet.cmd);
    const data = packet.data;
    try { dispatch(socket, user, cmd, data); }
    catch (err) { console.error(`[!] "${cmd}":`, err.message); }
  });

  // ── إعادة الاتصال بالرمز (rc2 لا يمر عبر 'msg') ────────────────────────
  socket.on('rc2', ({ token, n } = {}) => {
    // البحث عن مستخدم بنفس التوكن (اتصال منقطع)
    let found = false;
    for (const u of users.values()) {
      if (u.token === token && u.socketId !== socket.id) {
        // نقل البيانات للمقبس الجديد
        const roomId = u.roomid;
        Object.assign(user, {
          id: u.id, lid: u.lid, topic: u.topic, msg: u.msg,
          pic: u.pic, ico: u.ico, co: u.co, bg: u.bg, ucol: u.ucol,
          rep: u.rep, power: u.power, rank: u.rank, token: token,
          _fp: u._fp, s: u.s
        });

        // تحديث socketId في الغرفة
        if (roomId) {
          const room = rooms.get(roomId);
          if (room && room.members.has(u.socketId)) {
            room.members.delete(u.socketId);
            room.members.set(socket.id, user);
            user.roomid = roomId;
          }
        }
        found = true;
        break;
      }
    }

    // إرسال البيانات الأساسية
    send(socket, 'online',   [...users.values()]
      .filter(u => !u.s)
      .slice(-60)
      .map(u => u.pub()));
    send(socket, 'rlist',    [...rooms.values()].map(roomListItem));
    send(socket, 'emos',     []);
    send(socket, 'dro3',     []);
    send(socket, 'sico',     []);
    send(socket, 'powers',   []);
    send(socket, 'settings', rooms.get(user.roomid)?.settings || {});
    send(socket, 'server',   { online: io.engine.clientsCount });

    if (user.roomid) {
      const room = rooms.get(user.roomid);
      if (room) {
        // إعادة إرسال بيانات الغرفة
        send(socket, 'rc',       null);
        send(socket, 'ulist',    [...room.members.values()].map(u => u.pub()));
        send(socket, 'mic',      room.mic);
        send(socket, 'bclist',   room.wall);
        send(socket, 'power',    buildPower(user, room));
        send(socket, 'rops',     buildRops(room));
        send(socket, 'rcd',      []);
        toRoom(room.id, 'online+', user.pub(), socket.id);
      }
    }
  });

  // ── انقطاع الاتصال ───────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    leaveRoom(socket, user);
    users.delete(socket.id);
    console.log(`[-] انقطع: ${user.topic} (${socket.id})`);
  });
});

// ─── الموزع الرئيسي للأوامر ──────────────────────────────────────────────────
function dispatch(socket, user, cmd, data) {
  switch (cmd) {

    // ══════════════════════════════════════════════════════════════════════════
    // الاتصال الأولي
    // ══════════════════════════════════════════════════════════════════════════
    case 'online': {
      user.token = genId();
      send(socket, 'server',   { online: io.engine.clientsCount });
      send(socket, 'rlist',    [...rooms.values()].map(roomListItem));
      send(socket, 'emos',     []);
      send(socket, 'dro3',     []);
      send(socket, 'sico',     []);
      send(socket, 'powers',   []);
      send(socket, 'settings', {});
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // دخول كزائر   { username, fp, refr, r }
    // ══════════════════════════════════════════════════════════════════════════
    case 'g': {
      const { username, fp, refr, r } = data || {};
      const name = (username || '').trim();
      if (!name) { send(socket, 'login', { msg: 'badname' }); return; }

      user.topic = sanitize(name, 60);
      user._fp   = typeof fp === 'object' ? JSON.stringify(fp).slice(0, 300) : String(fp || '');
      user.refr  = refr || '';

      const targetRoom = r ? rooms.get(r) : rooms.values().next().value;

      send(socket, 'ok',    null);
      send(socket, 'login', {
        msg:    'ok',
        id:     user.id,
        k:      user.token,
        ttoken: user.token,
        r:      targetRoom ? targetRoom.id : null
      });

      if (targetRoom) joinRoom(socket, user, targetRoom, '');
      console.log(`[+] زائر: "${user.topic}" | IP: ${user._ip}`);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تسجيل دخول عضو   { username, password, stealth, fp, refr, r }
    // ══════════════════════════════════════════════════════════════════════════
    case 'login': {
      const { username, password, stealth, fp, refr, r } = data || {};
      const name = (username || '').trim();
      if (!name) { send(socket, 'login', { msg: 'badname' }); return; }

      const nameKey = name.toLowerCase();
      const acc     = accounts.get(nameKey);

      if (!acc) {
        send(socket, 'login', { msg: 'noname' }); return;
      }
      if (!bcrypt.compareSync(password || '', acc.pass)) {
        send(socket, 'login', { msg: 'wrong' }); return;
      }

      // استعادة بيانات الحساب
      user.lid   = acc.lid;
      user.topic = sanitize(name, 60);
      user.pic   = acc.pic   || 'pic.png';
      user.ico   = acc.ico   || '';
      user.rep   = acc.rep   || 0;
      user.power = acc.power || '';
      user.rank  = acc.rank  || 0;
      user.co    = acc.co    || '--';
      user.bg    = acc.bg    || '';
      user.ucol  = acc.ucol  || '';
      user.msg   = acc.msg   || '';
      user.s     = stealth   === true;
      user._fp   = typeof fp === 'object' ? JSON.stringify(fp).slice(0, 300) : String(fp || '');
      user.refr  = refr || '';
      acc.last   = Date.now();

      const targetRoom = r ? rooms.get(r) : rooms.values().next().value;

      send(socket, 'ok',    null);
      send(socket, 'login', {
        msg:    'ok',
        id:     user.id,
        k:      user.token,
        ttoken: user.token,
        r:      targetRoom ? targetRoom.id : null
      });

      if (targetRoom) joinRoom(socket, user, targetRoom, password || '');
      console.log(`[+] عضو: "${user.topic}" | Rank: ${user.rank}`);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تسجيل عضوية جديدة   { username, password, fp, refr, r }
    // ══════════════════════════════════════════════════════════════════════════
    case 'reg': {
      const { username, password, fp, r } = data || {};
      const name = (username || '').trim();
      if (!name) { send(socket, 'login', { msg: 'badname' }); return; }
      if (!password || password.length < 4) {
        send(socket, 'login', { msg: 'badpass' }); return;
      }
      const nameKey = name.toLowerCase();
      if (accounts.has(nameKey)) {
        send(socket, 'login', { msg: 'usedname' }); return;
      }

      const newLid = genId();
      accounts.set(nameKey, {
        lid:     newLid,
        name:    sanitize(name, 60),
        pass:    bcrypt.hashSync(password, SALT_ROUNDS),
        pic:     'pic.png', ico: '', rep: 0, power: '',
        rank:    0, co: '--', bg: '', ucol: '', msg: '',
        created: Date.now(), last: Date.now()
      });

      send(socket, 'login', { msg: 'reg' });
      console.log(`[+] تسجيل: "${name}"`);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تسجيل الخروج
    // ══════════════════════════════════════════════════════════════════════════
    case 'logout': {
      leaveRoom(socket, user);
      user.token = genId();
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // الانضمام لغرفة   { id, pwd }
    // ══════════════════════════════════════════════════════════════════════════
    case 'rjoin': {
      const { id, pwd } = data || {};
      const room = rooms.get(id);
      if (!room) return;
      leaveRoom(socket, user);
      joinRoom(socket, user, room, pwd || '');
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // مغادرة الغرفة الحالية
    // ══════════════════════════════════════════════════════════════════════════
    case 'rleave': {
      leaveRoom(socket, user);
      send(socket, 'rlist', [...rooms.values()].map(roomListItem));
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // رسالة عامة في الغرفة   { msg, mi }
    // ══════════════════════════════════════════════════════════════════════════
    case 'msg': {
      if (!user.roomid) return;
      const { msg: text, mi } = data || {};
      if (!text) return;
      const payload = buildMsg(user, text, { bid: makeBid() });
      if (mi) payload.mi = mi;
      toRoom(user.roomid, 'msg', payload);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // رسالة الحائط   { msg, bid }
    // ══════════════════════════════════════════════════════════════════════════
    case 'bc': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room) return;
      const { msg: text, bid: clientBid } = data || {};
      if (!text) return;

      const payload = buildMsg(user, text, { bid: clientBid || makeBid() });
      room.wall.push(payload);
      if (room.wall.length > MAX_WALL) room.wall.shift();
      toRoom(user.roomid, 'bc', payload);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // رسالة خاصة   { msg, id }
    // ══════════════════════════════════════════════════════════════════════════
    case 'pm': {
      const { msg: text, id: toId } = data || {};
      if (!text || !toId) return;
      const target = byUID(toId);
      if (!target) return;
      if (target.nopm) { send(socket, 'nopm', { id: toId }); return; }
      const ts = io.sockets.sockets.get(target.socketId);
      if (!ts) return;
      const payload = buildMsg(user, text, { pm: user.id, bid: makeBid() });
      send(ts, 'pm', payload);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // إعجاب على رسالة الحائط   { bid }
    // ══════════════════════════════════════════════════════════════════════════
    case 'likebc': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !room.settings.bclikes) return;
      const { bid } = data || {};
      if (!bid) return;

      const wallMsg = room.wall.find(m => m.bid === bid);
      if (wallMsg) {
        wallMsg.likes = (wallMsg.likes || 0) + 1;
        // رفع سمعة المرسل
        const sender = byUID(wallMsg.uid);
        if (sender && sender.id !== user.id) {
          sender.rep++;
          saveAccount(sender, { rep: sender.rep });
          toRoom(room.id, 'u++', { id: sender.id, rep: sender.rep });
        }
      }
      toRoom(user.roomid, 'bc^', { bid, likes: wallMsg ? wallMsg.likes : 1 });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // إعجاب على رسالة عامة   { bid }
    // ══════════════════════════════════════════════════════════════════════════
    case 'likemsg': {
      if (!user.roomid) return;
      const { bid } = data || {};
      if (!bid) return;
      toRoom(user.roomid, 'mi+', bid);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // حذف رسالة الحائط   { bid }
    // ══════════════════════════════════════════════════════════════════════════
    case 'delbc': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
      const { bid } = data || {};
      if (!bid) return;
      room.wall = room.wall.filter(m => m.bid !== bid);
      toRoom(user.roomid, 'delbc', { bid });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // حذف رسالة عامة   { bid }
    // ══════════════════════════════════════════════════════════════════════════
    case 'delmsg': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
      const { bid } = data || {};
      if (!bid) return;
      toRoom(user.roomid, 'dmsg', bid);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // المايك   slotIndex | -1
    // ══════════════════════════════════════════════════════════════════════════
    case 'mic': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !room.settings.mic) return;

      const slot = data;

      // مغادرة المايك
      if (slot === -1) {
        const i = room.mic.indexOf(user.id);
        if (i !== -1) {
          room.mic[i] = 0;
          toRoom(user.roomid, 'mic', room.mic);
          // إبلاغ أعضاء P2P
          room.mic.forEach(uid => {
            if (typeof uid !== 'string' || uid === user.id) return;
            const peer = byUID(uid);
            if (!peer) return;
            const ps = io.sockets.sockets.get(peer.socketId);
            if (ps) send(ps, 'p2', { t: 'x', id: user.id });
          });
        }
        return;
      }

      // طلب خانة معينة أو أول خانة فارغة
      const idx = (typeof slot === 'number' && slot >= 0 && slot < MAX_MIC_SLOTS)
        ? slot
        : room.mic.findIndex(v => v === 0);
      if (idx === -1) return;
      if (room.mic[idx] !== 0) return;

      // إزالة من أي خانة سابقة
      const prev = room.mic.indexOf(user.id);
      if (prev !== -1) room.mic[prev] = 0;

      room.mic[idx] = user.id;
      toRoom(user.roomid, 'mic', room.mic);

      // إبلاغ المايكات الأخرى لبدء WebRTC
      room.mic.forEach(uid => {
        if (typeof uid !== 'string' || uid === user.id) return;
        const peer = byUID(uid);
        if (!peer) return;
        const ps = io.sockets.sockets.get(peer.socketId);
        if (ps) send(ps, 'p2', { t: 'start', id: user.id });
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // سحب المايك من مستخدم (مشرف)
    // ══════════════════════════════════════════════════════════════════════════
    case 'uml': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
      const targetId = data;
      const i = room.mic.indexOf(targetId);
      if (i !== -1) {
        room.mic[i] = 0;
        toRoom(user.roomid, 'mic', room.mic);
        const t = byUID(targetId);
        if (t) {
          const ts = io.sockets.sockets.get(t.socketId);
          if (ts) send(ts, 'mic', room.mic);
        }
      }
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تغيير حالة خانة مايك   { i, v }
    // ══════════════════════════════════════════════════════════════════════════
    case 'micstat': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
      const { i: mi, v: mv } = data || {};
      if (mi < 0 || mi >= MAX_MIC_SLOTS) return;
      if (!mv) room.mic[mi] = 0;
      toRoom(user.roomid, 'mic', room.mic);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // WebRTC P2P   { t, id, dir, data }
    // ══════════════════════════════════════════════════════════════════════════
    case 'p2': {
      const { id: toId, t: sigT, data: sigD, dir } = data || {};
      const target = byUID(toId);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (!ts) return;
      // قلب اتجاه dir للطرف الآخر
      send(ts, 'p2', { t: sigT, id: user.id, data: sigD, dir: dir === 1 ? 0 : 1 });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // مكالمة صوتية   { t, id, data }
    // ══════════════════════════════════════════════════════════════════════════
    case 'call': {
      const { t: callT, id: callTo } = data || {};
      if (!callTo) return;
      const target = byUID(callTo);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (!ts) return;
      // إرسال نوع المكالمة كحدث مستقل للعميل
      send(ts, callT || 'call', { id: user.id });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // مؤشر الكتابة   [targetId, 0|1]
    // ══════════════════════════════════════════════════════════════════════════
    case 'ty': {
      if (!Array.isArray(data) || data.length < 2) return;
      const [toId, val] = data;
      const target = byUID(toId);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'ty', [user.id, val]);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // رفض الرسائل الخاصة   { id }
    // ══════════════════════════════════════════════════════════════════════════
    case 'nopm': {
      user.nopm = true;
      const target = byUID(data?.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'nopm', { id: user.id });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // إيقاف الإشعارات   { id }
    // ══════════════════════════════════════════════════════════════════════════
    case 'nonot': {
      user.nonot = true;
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تحديث حالة DND   { busy }
    // ══════════════════════════════════════════════════════════════════════════
    case 'busy': {
      user.nopm = data?.busy === true || data?.busy === 1;
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // طلب ملف مستخدم   uid (string)
    // ══════════════════════════════════════════════════════════════════════════
    case 'upro': {
      const uid    = data;
      const target = byUID(uid);
      if (!target) return;
      send(socket, 'upro', target.pub());
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // بصمة الجهاز   { fp object }
    // ══════════════════════════════════════════════════════════════════════════
    case 'fp': {
      user._fp = JSON.stringify(data || {}).slice(0, 300);
      saveAccount(user, { fp: user._fp });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // بحث تاريخ مستخدم   lid (string)
    // ══════════════════════════════════════════════════════════════════════════
    case 'uh': {
      if (!isAdmin(user)) return;
      const lid     = data;
      const history = [];
      users.forEach(u => {
        if (u.lid === lid) {
          history.push({
            name: u.topic, nick: u.topic,
            ip: u._ip, ua: '', lid: u.lid,
            _c: u.last || Date.now()
          });
        }
      });
      send(socket, 'uh', history);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تحديث إعدادات الغرفة   { mic, calls, ... }
    // ══════════════════════════════════════════════════════════════════════════
    case 'settings': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
      const allowed = ['mic','setpower','ban','owner','calls','mlikes','bclikes','mreply','bcreply'];
      allowed.forEach(k => { if (k in (data || {})) room.settings[k] = !!data[k]; });
      toRoom(user.roomid, 'settings', room.settings);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // طلب بيانات لوحة التحكم
    // ══════════════════════════════════════════════════════════════════════════
    case 'cpi': {
      if (!isAdmin(user)) return;
      const room = user.roomid ? rooms.get(user.roomid) : null;
      // قائمة الغرف
      send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
        id: r.id, name: r.name, owner: r.owner || '',
        online: r.members.size, needpass: r.needpass
      })));
      // قائمة الحظر
      if (room) send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // لوحة التحكم   { cmd, ...params }
    // ══════════════════════════════════════════════════════════════════════════
    case 'cp': {
      cpDispatch(socket, user, data || {});
      break;
    }

    default:
      if (process.env.DEBUG) console.log(`[?] أمر مجهول: "${cmd}"`, data);
  }
}

// ─── لوحة التحكم ─────────────────────────────────────────────────────────────
function cpDispatch(socket, user, data) {
  const { cmd } = data;
  const adminOk  = user.rank >= 9000;
  const room     = user.roomid ? rooms.get(user.roomid) : null;
  const modOk    = adminOk || (room && room.ops.includes(user.lid));

  switch (cmd) {

    // ── حظر مستخدم ────────────────────────────────────────────────────────
    case 'ban': {
      if (!modOk || !room) return;
      const target = byUID(data.id);
      const entry  = {
        id:      data.id      || '',
        lid:     target?.lid  || '',
        name:    target?.topic || '',
        type:    data.type    || 'fp',
        fp:      data.type === 'fp'  ? (target?._fp  || '') : '',
        ip:      data.type === 'ip'  ? (target?._ip  || '') : '',
        expires: data.expires || null,
        reason:  data.reason  || '',
        count:   0, last: Date.now(), active: true
      };
      room.bans.push(entry);

      // طرد المستخدم المحظور
      if (target) {
        const ts = io.sockets.sockets.get(target.socketId);
        if (ts) { send(ts, 'kick', { reason: 'banned' }); ts.disconnect(true); }
      }
      send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ── رفع الحظر ─────────────────────────────────────────────────────────
    case 'aban':
    case 'unban': {
      if (!modOk || !room) return;
      room.bans = room.bans.filter(b => b.id !== data.id);
      send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ── طرد مستخدم ────────────────────────────────────────────────────────
    case 'kick': {
      if (!modOk) return;
      const target = byUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) { send(ts, 'kick', { reason: data.reason || 'kicked' }); ts.disconnect(true); }
      break;
    }

    // ── منح / تعديل رتبة ──────────────────────────────────────────────────
    case 'setpower': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      target.power = data.power || '';
      target.rank  = data.rank  != null ? parseInt(data.rank) : 0;
      saveAccount(target, { power: target.power, rank: target.rank });
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'power', buildPower(target, room));
      if (room) toRoom(room.id, 'online+', target.pub());
      break;
    }

    // ── إضافة مشرف ────────────────────────────────────────────────────────
    case 'addop': {
      if (!adminOk || !room) return;
      const target = byUID(data.id);
      if (!target || room.ops.includes(target.lid)) return;
      room.ops.push(target.lid);
      toRoom(room.id, 'rops', buildRops(room));
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'power', buildPower(target, room));
      break;
    }

    // ── حذف مشرف ──────────────────────────────────────────────────────────
    case 'delop': {
      if (!adminOk || !room) return;
      room.ops = room.ops.filter(l => l !== data.lid);
      toRoom(room.id, 'rops', buildRops(room));
      // تحديث صلاحيات المشرف المُزال
      const target = byLID(data.lid);
      if (target) {
        const ts = io.sockets.sockets.get(target.socketId);
        if (ts) send(ts, 'power', buildPower(target, room));
      }
      break;
    }

    // ── تعديل سمعة ────────────────────────────────────────────────────────
    case 'likes': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      target.rep = parseInt(data.likes) || 0;
      saveAccount(target, { rep: target.rep });
      toRoom(target.roomid || '', 'u++', { id: target.id, rep: target.rep });
      break;
    }

    // ── تغيير كلمة مرور ───────────────────────────────────────────────────
    case 'pwd': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target || !data.pass || data.pass.length < 4) return;
      for (const acc of accounts.values()) {
        if (acc.lid === target.lid) {
          acc.pass = bcrypt.hashSync(data.pass, SALT_ROUNDS);
          break;
        }
      }
      break;
    }

    // ── فصل مستخدم ────────────────────────────────────────────────────────
    case 'delu': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) ts.disconnect(true);
      break;
    }

    // ── تعديل غرفة ────────────────────────────────────────────────────────
    case 'cp_rooms_edit':
    case 'edit_room': {
      if (!adminOk) return;
      const editRoom = rooms.get(data.id);
      if (!editRoom) return;
      if (data.name)  editRoom.name     = sanitize(data.name, 80);
      if (data.pic)   editRoom.pic      = data.pic;
      if (data.bg)    editRoom.bg       = data.bg;
      if (data.ucol)  editRoom.ucol     = data.ucol;
      if ('pass' in data) {
        editRoom.pass     = data.pass ? bcrypt.hashSync(data.pass, SALT_ROUNDS) : '';
        editRoom.needpass = !!data.pass;
      }
      broadcastRoomUpdate(editRoom);
      break;
    }

    // ── إضافة / حذف غرفة ──────────────────────────────────────────────────
    case 'add_room': {
      if (!adminOk) return;
      if (!data.name) return;
      const newRoom = new Room('r_' + Date.now(), sanitize(data.name, 80), data.pass || '');
      newRoom.owner = user.lid;
      rooms.set(newRoom.id, newRoom);
      io.emit('msg', { cmd: decodeCmd('r+'), data: roomListItem(newRoom) });
      break;
    }
    case 'del_room': {
      if (!adminOk) return;
      const delRoom = rooms.get(data.id);
      if (!delRoom) return;
      delRoom.members.forEach((_, sid) => {
        const s = io.sockets.sockets.get(sid);
        if (s) send(s, 'kick', { reason: 'room_deleted' });
      });
      rooms.delete(data.id);
      io.emit('msg', { cmd: decodeCmd('r-'), data: data.id });
      break;
    }

    // ── إدارة بيانات لوحة التحكم ──────────────────────────────────────────
    case 'cp_rooms': {
      if (!modOk) return;
      send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
        id: r.id, name: r.name, owner: r.owner || '',
        online: r.members.size, needpass: r.needpass
      })));
      break;
    }
    case 'cp_bans': {
      if (!modOk || !room) return;
      send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }
    case 'cp_logins': {
      if (!modOk) return;
      const list = [];
      users.forEach(u => {
        if (!u.roomid) return;
        list.push({
          id: u.id, lid: u.lid, name: u.topic, nick: u.topic,
          ip: u._ip, ua: '', power: u.power, likes: u.rep,
          last: u.last, created: u.created
        });
      });
      send(socket, 'cp_logins', list);
      break;
    }
    case 'cp_msgs': {
      if (!modOk || !room) return;
      send(socket, 'cp_msgs', room.wall.slice(-50));
      break;
    }

    // ── رتب الغرفة ────────────────────────────────────────────────────────
    case 'addpower': {
      if (!adminOk || !room) return;
      room.powers.push(data.power || data);
      toRoom(room.id, 'powers', room.powers);
      break;
    }
    case 'delpower': {
      if (!adminOk || !room) return;
      room.powers = room.powers.filter(p => p.name !== data.name);
      toRoom(room.id, 'powers', room.powers);
      break;
    }

    // ── إدارة البوتات ─────────────────────────────────────────────────────
    case 'bot': {
      if (!adminOk || !room) return;
      const bot = room.bots.get(data.id) || {};
      Object.assign(bot, data);
      room.bots.set(data.id, bot);
      send(socket, 'cp_bots', [...room.bots.values()]);
      break;
    }

    default:
      if (process.env.DEBUG) console.log(`[CP] أمر مجهول: "${cmd}"`);
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────

/** حالة السيرفر */
app.get('/api/status', (_, res) => {
  res.json({
    users: users.size,
    rooms: [...rooms.values()].map(r => ({
      id: r.id, name: r.name, count: r.members.size
    }))
  });
});

/** إنشاء غرفة عبر API */
app.post('/api/rooms', (req, res) => {
  const { key, name, pass } = req.body || {};
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'غير مسموح' });
  if (!name)             return res.status(400).json({ error: 'name مطلوب' });
  const room = new Room('r_' + Date.now(), sanitize(name, 80), pass || '');
  rooms.set(room.id, room);
  io.emit('msg', { cmd: decodeCmd('r+'), data: roomListItem(room) });
  res.json({ id: room.id, name: room.name });
});

/** حذف غرفة عبر API */
app.delete('/api/rooms/:id', (req, res) => {
  const { key } = req.body || {};
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'غير مسموح' });
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' });
  room.members.forEach((_, sid) => {
    const s = io.sockets.sockets.get(sid);
    if (s) send(s, 'kick', { reason: 'room_deleted' });
  });
  rooms.delete(req.params.id);
  io.emit('msg', { cmd: decodeCmd('r-'), data: req.params.id });
  res.json({ deleted: true });
});

/** بث رسالة لغرفة أو الكل */
app.post('/api/broadcast', (req, res) => {
  const { key, msg, roomId } = req.body || {};
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'غير مسموح' });
  const payload = {
    uid: 'srv', pic: 'room.png', ico: '', ucol: '',
    topic: 'النظام', t: Date.now(),
    msg: sanitize(msg || ''), bid: makeBid()
  };
  if (roomId) toRoom(roomId, 'bc', payload);
  else rooms.forEach(r => toRoom(r.id, 'bc', payload));
  res.json({ ok: true });
});

/** تسجيل عضو عبر API (للإعداد الأولي) */
app.post('/api/register', (req, res) => {
  const { key, username, password, rank = 0 } = req.body || {};
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'غير مسموح' });
  if (!username || !password) return res.status(400).json({ error: 'username & password مطلوبان' });
  const nameKey = username.toLowerCase();
  if (accounts.has(nameKey)) return res.status(409).json({ error: 'الاسم مستخدم' });
  const lid = genId();
  accounts.set(nameKey, {
    lid, name: sanitize(username, 60),
    pass: bcrypt.hashSync(password, SALT_ROUNDS),
    pic: 'pic.png', ico: '', rep: 0, power: '',
    rank: parseInt(rank) || 0, co: '--', bg: '', ucol: '', msg: '',
    created: Date.now(), last: Date.now()
  });
  res.json({ ok: true, lid });
});

// ─── تشغيل السيرفر ───────────────────────────────────────────────────────────
seedRooms();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`    ضع ملفات الواجهة في مجلد: public/\n`);
});
