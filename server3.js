/**
 * =============================================================
 *  Chat Server  —  متوافق 100% مع appraad.js
 * =============================================================
 *
 *  الفروقات الرئيسية عن x3_final.js التي تم إصلاحها:
 *
 *  1. أسماء الأحداث:
 *     - appraad.js يرسل 'online+' ويستقبل 'online+' (وليس 'u+' أو 'online')
 *     - appraad.js يرسل 'online-' ويستقبل 'online-' (وليس 'u-')
 *     - appraad.js case 'ulist'  ← يجب إرسال 'ulist'
 *     - appraad.js case 'rlist'  ← يجب إرسال 'rlist'
 *     - appraad.js case 'emos'   ← يجب إرسال 'emos'
 *     - appraad.js case 'dro3'   ← يجب إرسال 'dro3'
 *     - appraad.js case 'sico'   ← يجب إرسال 'sico'
 *     - appraad.js case 'mic'    ← يجب إرسال 'mic' (مصفوفة)
 *     - appraad.js case 'r^'     ← يجب أن يحتوي m, ops
 *     - appraad.js case 'login'  ← يتوقع { msg, id, k, ttoken, r }
 *
 *  2. أوامر الكلاينت الواردة:
 *     - 'tmic' → هو الأمر المرسل من tmic() وليس 'mic'
 *       (تحقق: tmic() تستدعي send("mic", slotIndex))
 *     - 'upro'  → يُرسل uid فقط (string)
 *     - 'gift'  → { uid, gift }
 *     - 'ubnr'  → { id }
 *     - 'cpi'   → [windowCpi, eventData]  (ريلاي لوحة التحكم)
 *     - 'op+'   → { lid }
 *     - 'op-'   → { lid }
 *     - 'cp'    → { cmd, ...data }
 *
 *  3. بنية بيانات المستخدم المرسلة للكلاينت:
 *     - يجب إرسال حقل 'h' (hash رقم التذكرة) — appraad.js يولده محلياً
 *       لكن يجب توافق 'username' مع lid
 *     - 'username' → lid (يستخدمه appraad.js في executeHashAlgorithm)
 *
 *  البروتوكول:
 *    - كل رسالة socket.io تنتقل تحت الحدث "msg"
 *      الصيغة:  { cmd: decodeCmd(commandName), data: payload }
 *    - تشفير الأوامر: XOR بسيط (نفس decryptCommand في appraad.js)
 *    - rc2 يُرسَل مباشرة كحدث منفصل (بدون تشفير)
 * =============================================================
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bcrypt     = require('bcryptjs');

// ─── إعدادات ──────────────────────────────────────────────────────────────────
const PORT          = process.env.PORT          || 8000;
const ADMIN_KEY     = process.env.ADMIN_KEY     || 'admin123';
const MAX_MIC_SLOTS = parseInt(process.env.MAX_MIC_SLOTS)  || 5;
const MAX_WALL      = parseInt(process.env.MAX_WALL_MSGS)  || 200;
const SALT_ROUNDS   = 8;

// ─── تشفير الأوامر — نفس decryptCommand في appraad.js ────────────────────────
// appraad.js: charCode XOR 0x2  ،  skip pattern: i += i<20?1 : i<200?4 : 16
function decodeCmd(str) {
  const chars = (str || '').split('');
  const len   = chars.length;
  for (let i = 0; i < len; i++) {
    chars[i] = String.fromCharCode(str.charCodeAt(i) ^ 2);
    i += i < 20 ? 1 : i < 200 ? 4 : 16;
  }
  return chars.join('');
}

// ─── تهيئة Express + Socket.IO ────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  pingTimeout:  25000,
  pingInterval: 10000,
  transports:   ['websocket', 'polling']
});

app.use(express.static('public'));
app.use(express.json());

// ─── قواعد البيانات في الذاكرة ────────────────────────────────────────────────
/** socketId → User   */  const users    = new Map();
/** roomId   → Room   */  const rooms    = new Map();
/** nameKey  → AccObj */  const accounts = new Map();

// ─── هيكل المستخدم ────────────────────────────────────────────────────────────
class User {
  constructor(socketId, fields = {}) {
    this.socketId = socketId;
    this.id       = fields.id    || genId();
    this.lid      = fields.lid   || this.id;
    this.topic    = fields.topic || 'زائر';
    this.msg      = fields.msg   || '';
    this.pic      = fields.pic   || 'pic.png';
    this.ico      = fields.ico   || '';
    this.co       = fields.co    || '--';
    this.bg       = fields.bg    || '';
    this.ucol     = fields.ucol  || '';
    this.mcol     = fields.mcol  || '';
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

  /**
   * ما يُرسَل للعملاء الآخرين
   * appraad.js يستخدم:
   *   userObj.id, userObj.lid, userObj.topic, userObj.username
   *   userObj.msg, userObj.pic, userObj.ico, userObj.co
   *   userObj.bg, userObj.ucol, userObj.mcol
   *   userObj.rep, userObj.power, userObj.rank
   *   userObj.roomid, userObj.s
   *   userObj.h (يولده appraad.js من username)
   */
  pub() {
    return {
      id:       this.id,
      lid:      this.lid,
      username: this.lid,    // appraad.js: executeHashAlgorithm([userObj.username||'ff'])
      topic:    this.topic,
      msg:      this.msg,
      pic:      this.pic,
      ico:      this.ico,
      co:       this.co,
      bg:       this.bg,
      ucol:     this.ucol,
      mcol:     this.mcol || '',
      rep:      this.rep,
      power:    this.power,
      rank:     this.rank,
      roomid:   this.roomid,
      s:        this.s || null   // appraad.js: logItem.s == null → غير متخفٍ
    };
  }
}

// ─── هيكل الغرفة ──────────────────────────────────────────────────────────────
class Room {
  constructor(id, name, pass = '') {
    this.id       = id;
    this.name     = name;
    this.pass     = pass ? bcrypt.hashSync(pass, SALT_ROUNDS) : '';
    this.needpass = pass !== '';
    this.pic      = 'room.png';
    this.bg       = '';
    this.ucol     = '';
    this.c        = '#000000';
    this.about    = '';
    this.welcome  = '';
    this.max      = 20;
    this.owner    = null;
    this.botsConfig = { active: false, minStay: 0, maxStay: 0, minLeave: 0, maxLeave: 0 };
    this.settings = {
      mic: true, setpower: false, ban: false, owner: false,
      calls: true, mlikes: true, bclikes: true, mreply: false, bcreply: false
    };
    this.powers   = [];
    this.ops      = [];          // lid[] المشرفون
    this.sicos    = [];
    this.emos     = [];
    this.colors   = [];          // dro3
    // *** appraad.js يقرأ mic كمصفوفة: mic[index] = userId|0|false
    // mic[i]=0 → فارغ، mic[i]=false → مقفول، mic[i]=string → يتحدث
    this.mic      = new Array(MAX_MIC_SLOTS).fill(0);
    this.members  = new Map();   // socketId → User
    this.wall     = [];
    this.bots     = new Map();
    this.bans     = [];
  }
}

// ─── مساعدات ──────────────────────────────────────────────────────────────────
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

/** بث لجميع المتصلين */
function toAll(cmd, data) {
  io.emit('msg', { cmd: decodeCmd(cmd), data });
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

/** هل المستخدم محظور؟ */
function isBanned(room, user) {
  return room.bans.some(b => {
    if (!b.active) return false;
    if (b.fp  && b.fp  === user._fp)  return true;
    if (b.ip  && b.ip  === user._ip)  return true;
    if (b.lid && b.lid === user.lid)  return true;
    return false;
  });
}

/** هل مشرف؟ */
function isAdmin(user, room = null) {
  if (user.rank >= 9000) return true;
  if (room && room.ops.includes(user.lid)) return true;
  return false;
}

/** هل مشرف أو مود؟ */
function isMod(user, room = null) {
  return isAdmin(user, room);
}

/**
 * بناء payload الصلاحيات لمستخدم
 * appraad.js يقرأ: power.mic, power.setpower, power.ban,
 *   power.owner, power.cp, power.calls, power.publicmsg,
 *   power.roomowner, power.name, power.rank
 */
function buildPower(user, room) {
  const admin = user.rank >= 9000;
  const mod   = room ? room.ops.includes(user.lid) : false;
  return {
    name:      user.power || '',
    rank:      user.rank  || 0,
    mic:       true,
    setpower:  admin || (mod && !!room?.settings?.setpower),
    ban:       admin || (mod && !!room?.settings?.ban),
    owner:     admin || room?.owner === user.lid,
    cp:        admin || mod,
    calls:     true,
    publicmsg: admin ? 1 : 0,
    roomowner: room?.owner === user.lid || false
  };
}

/** بناء رسالة موحدة */
function buildMsg(sender, text, extra = {}) {
  return Object.assign({
    uid:   sender.id,
    lid:   sender.lid,
    pic:   sender.pic,
    ico:   sender.ico   || '',
    ucol:  sender.ucol  || '',
    mcol:  sender.mcol  || '',
    topic: sender.topic,
    t:     Date.now(),
    msg:   sanitize(text || '')
  }, extra);
}

/**
 * قائمة غرفة مُشكَّلة لـ rlist / r+ / r^
 * appraad.js يقرأ:
 *   roomPayloadObj.id, .name, .topic, .pic, .needpass
 *   .about, .c, .v (mic enabled), .max, .uco, .online
 *   .m (mic array) — في r^ فقط
 *   .ops — في r^ فقط
 */
function roomListItem(room) {
  return {
    id:       room.id,
    name:     room.name,
    topic:    room.name,           // appraad.js يقرأ .topic للغرفة
    pic:      room.pic,
    needpass: room.needpass,
    about:    room.about   || '',
    c:        room.c       || '#000000',
    v:        !!(room.settings?.mic),  // appraad.js: destRoomObj.v == true → إظهار #mic
    max:      room.max     || 20,
    online:   room.members.size,
    uco:      room.members.size        // appraad.js: roomPayloadObj.uco
  };
}

/** تحديث الغرفة لجميع المتصلين (r^) */
function broadcastRoomUpdate(room) {
  const payload = Object.assign(roomListItem(room), {
    m:   room.mic,    // appraad.js case 'r^': commandPayload.m → تحديث مصفوفة المايك
    ops: room.ops
  });
  toAll('r^', payload);
}

/** قائمة المشرفين المتصلين في الغرفة */
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

// ─── إنشاء غرف افتراضية ───────────────────────────────────────────────────────
function seedRooms() {
  [
    { id: 'main',   name: '( 1 ) الغرفة الرئيسية' },
    { id: 'games',  name: '( 2 ) العاب'            },
    { id: 'music',  name: '( 3 ) موسيقى'           }
  ].forEach(d => {
    const r = new Room(d.id, d.name);
    rooms.set(r.id, r);
  });
  console.log('[Server] الغرف جاهزة:', [...rooms.keys()].join(', '));
}

// ─── الانضمام لغرفة ───────────────────────────────────────────────────────────
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

  // ─── إرسال بيانات الغرفة للمستخدم ─────────────────────────────────────
  // appraad.js case 'rc' → لا يوجد handler خاص، لكن يُستخدم كإشارة بدء
  send(socket, 'rc',       null);

  // appraad.js case 'ulist' → ignoredUsersList = commandPayload
  send(socket, 'ulist',    [...room.members.values()].map(u => u.pub()));

  // appraad.js case 'rlist' → بناء قائمة الغرف
  send(socket, 'rlist',    [...rooms.values()].map(roomListItem));

  // appraad.js case 'emos' → chatEmojisList = commandPayload
  send(socket, 'emos',     room.emos.length ? room.emos : []);

  // appraad.js case 'dro3' → groupIcons = commandPayload
  send(socket, 'dro3',     room.colors);

  // appraad.js case 'sico' → activeBansList = commandPayload
  send(socket, 'sico',     room.sicos);

  // appraad.js case 'powers' → activeAlerts = commandPayload
  send(socket, 'powers',   room.powers);

  // appraad.js case 'settings' → chatInteractionsConfig = commandPayload
  send(socket, 'settings', room.settings);

  // appraad.js case 'power' → userPermissionsConfig = commandPayload
  send(socket, 'power',    buildPower(user, room));

  // appraad.js: mic = destRoomObj.m → يُحدَّث عبر r^
  // لكن في joinRoom نرسل r^ بعد التحديث ← أو نرسل mic مباشرة
  // appraad.js لا يملك case 'mic' مستقلاً للتهيئة، يعتمد على r^ → commandPayload.m
  // نرسل r^ مع m لتهيئة مصفوفة المايك
  send(socket, 'mic',      room.mic);

  // appraad.js case 'bclist' → $.each + injectBroadcastItemToUi
  send(socket, 'bclist',   room.wall);

  // appraad.js case 'rops' → currentRoomObj.ops = []
  send(socket, 'rops',     buildRops(room));

  // appraad.js: 'rcd' → نهاية تحميل الغرفة (إن وُجد)
  send(socket, 'rcd',      []);

  // إبلاغ بقية الأعضاء بدخول المستخدم
  // appraad.js case 'online+':
  //   actionType==1 → prepend user row
  toRoom(room.id, 'online+', user.pub(), socket.id);

  // تحديث عداد الغرفة لجميع المتصلين (r^)
  broadcastRoomUpdate(room);

  // رسالة ترحيب اختيارية
  if (room.welcome) {
    send(socket, 'msg', buildMsg(
      { id: 'srv', lid: 'srv', pic: 'room.png', ico: '', ucol: '', mcol: '', topic: room.name },
      room.welcome,
      { bid: makeBid(), mi: makeBid() }
    ));
  }

  console.log(`[Room] "${user.topic}" → "${room.name}"`);
}

// ─── مغادرة الغرفة ────────────────────────────────────────────────────────────
function leaveRoom(socket, user) {
  if (!user.roomid) return;
  const room = rooms.get(user.roomid);
  if (!room) { user.roomid = null; return; }

  // تحرير خانة المايك
  const mi = room.mic.indexOf(user.id);
  if (mi !== -1) {
    room.mic[mi] = 0;
    // إبلاغ أعضاء P2P
    room.mic.forEach(uid => {
      if (typeof uid !== 'string' || uid === user.id) return;
      const peer = byUID(uid);
      if (!peer) return;
      const ps = io.sockets.sockets.get(peer.socketId);
      if (ps) send(ps, 'p2', { t: 'x', id: user.id });
    });
    broadcastRoomUpdate(room);
  }

  room.members.delete(socket.id);
  user.roomid = null;

  // appraad.js case 'online-': actionType==2 → remove user row
  toRoom(room.id, 'online-', user.id);
  broadcastRoomUpdate(room);
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  const ip   = (socket.handshake.headers['x-forwarded-for'] || '')
                 .split(',')[0].trim() || socket.handshake.address;
  const user = new User(socket.id, { _ip: ip });
  users.set(socket.id, user);

  // الحدث الرئيسي: كل الرسائل تمر هنا
  socket.on('msg', packet => {
    if (!packet || typeof packet.cmd !== 'string') return;
    const cmd  = decodeCmd(packet.cmd);
    const data = packet.data;
    try { dispatch(socket, user, cmd, data); }
    catch (err) { console.error(`[!] "${cmd}":`, err.message); }
  });

  // إعادة الاتصال بالرمز (rc2 يُرسَل مباشرة بدون تشفير)
  // appraad.js: socketClient.emit("rc2", { token: userAuthHash, n: userSessionToken })
  socket.on('rc2', ({ token, n } = {}) => {
    let found = null;
    for (const u of users.values()) {
      if (u.token === token && u.socketId !== socket.id) {
        found = u;
        break;
      }
    }
    if (found) {
      const roomId = found.roomid;
      Object.assign(user, {
        id: found.id, lid: found.lid, topic: found.topic,
        msg: found.msg, pic: found.pic, ico: found.ico,
        co: found.co, bg: found.bg, ucol: found.ucol,
        mcol: found.mcol, rep: found.rep, power: found.power,
        rank: found.rank, token: token, _fp: found._fp, s: found.s
      });
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.members.has(found.socketId)) {
          room.members.delete(found.socketId);
          room.members.set(socket.id, user);
          user.roomid = roomId;
        }
      }
    }

    // إرسال بيانات إعادة الاتصال
    send(socket, 'server', { online: io.engine.clientsCount });
    send(socket, 'rlist',  [...rooms.values()].map(roomListItem));
    send(socket, 'emos',   []);
    send(socket, 'dro3',   []);
    send(socket, 'sico',   []);
    send(socket, 'powers', []);
    send(socket, 'settings', rooms.get(user.roomid)?.settings || {});

    if (user.roomid) {
      const room = rooms.get(user.roomid);
      if (room) {
        send(socket, 'rc',      null);
        send(socket, 'ulist',   [...room.members.values()].map(u => u.pub()));
        send(socket, 'mic',     room.mic);
        send(socket, 'bclist',  room.wall);
        send(socket, 'power',   buildPower(user, room));
        send(socket, 'rops',    buildRops(room));
        send(socket, 'rcd',     []);
        toRoom(room.id, 'online+', user.pub(), socket.id);
      }
    }

    // إرسال ok + login لاستئناف الجلسة
    send(socket, 'ok', null);
    send(socket, 'login', {
      msg:    'ok',
      id:     user.id,
      k:      user.token,
      ttoken: user.token,
      r:      user.roomid
    });
  });

  socket.on('disconnect', () => {
    leaveRoom(socket, user);
    users.delete(socket.id);
    console.log(`[-] ${user.topic} (${socket.id})`);
  });
});

// ─── الموزع الرئيسي للأوامر ──────────────────────────────────────────────────
function dispatch(socket, user, cmd, data) {
  // الغرفة الحالية (اختصار)
  const room = user.roomid ? rooms.get(user.roomid) : null;
  const adminOk = isAdmin(user, room);
  const modOk   = isMod(user, room);

  switch (cmd) {

    // ════════════════════════════════════════════════════════════════════════
    // الاتصال الأولي
    // appraad.js: send("online", {}) عند الاتصال لأول مرة
    // ════════════════════════════════════════════════════════════════════════
    case 'online': {
      user.token = genId();
      // appraad.js case 'server' → isStreamActive=true, عرض عداد المتصلين
      send(socket, 'server',   { online: io.engine.clientsCount });
      // appraad.js case 'rlist' → بناء قائمة الغرف
      send(socket, 'rlist',    [...rooms.values()].map(roomListItem));
      send(socket, 'emos',     []);
      send(socket, 'dro3',     []);
      send(socket, 'sico',     []);
      send(socket, 'powers',   []);
      // appraad.js case 'settings' → chatInteractionsConfig
      send(socket, 'settings', {
        mlikes: true, bclikes: true, mreply: false,
        bcreply: false, calls: false
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // دخول كزائر  { username, fp, refr, r }
    // appraad.js: send('g', { username, fp, refr, r })
    // ════════════════════════════════════════════════════════════════════════
    case 'g': {
      const { username, fp, refr, r } = data || {};
      const name = (username || '').trim();
      if (!name) { send(socket, 'login', { msg: 'badname' }); return; }

      user.topic = sanitize(name, 60);
      user._fp   = fp ? (typeof fp === 'object' ? JSON.stringify(fp).slice(0, 300) : String(fp)) : '';
      user.refr  = refr || '';

      const targetRoom = r ? rooms.get(r) : [...rooms.values()][0];

      // appraad.js يستقبل ok ثم login
      send(socket, 'ok', null);
      send(socket, 'login', {
        msg:    'ok',
        id:     user.id,
        k:      user.token,
        ttoken: user.token,
        r:      targetRoom ? targetRoom.id : null
      });

      if (targetRoom) joinRoom(socket, user, targetRoom, '');
      console.log(`[+] زائر: "${user.topic}" | ${user._ip}`);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تسجيل دخول عضو  { username, password, stealth, fp, refr, r }
    // appraad.js: send("login", { username, stealth, password, fp, refr, r })
    // ════════════════════════════════════════════════════════════════════════
    case 'login': {
      const { username, password, stealth, fp, refr, r } = data || {};
      const name = (username || '').trim();
      if (!name) { send(socket, 'login', { msg: 'badname' }); return; }

      const nameKey = name.toLowerCase();
      const acc     = accounts.get(nameKey);
      if (!acc)                                        { send(socket, 'login', { msg: 'noname' }); return; }
      if (!bcrypt.compareSync(password || '', acc.pass)) { send(socket, 'login', { msg: 'wrong'  }); return; }

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
      user.mcol  = acc.mcol  || '';
      user.msg   = acc.msg   || '';
      user.s     = stealth   === true;
      user._fp   = fp ? (typeof fp === 'object' ? JSON.stringify(fp).slice(0, 300) : String(fp)) : '';
      user.refr  = refr || '';
      acc.last   = Date.now();

      const targetRoom = r ? rooms.get(r) : [...rooms.values()][0];

      send(socket, 'ok', null);
      send(socket, 'login', {
        msg:    'ok',
        id:     user.id,
        k:      user.token,
        ttoken: user.token,
        r:      targetRoom ? targetRoom.id : null
      });

      if (targetRoom) joinRoom(socket, user, targetRoom, password || '');
      console.log(`[+] عضو: "${user.topic}" rank=${user.rank}`);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تسجيل عضوية جديدة  { username, password, fp, refr, r }
    // appraad.js: send("reg", { username, password, fp, refr, r })
    // appraad.js case 'reg' في login → showNotificationToast("success","تم تسجيل العضويه")
    // ════════════════════════════════════════════════════════════════════════
    case 'reg': {
      const { username, password, fp } = data || {};
      const name = (username || '').trim();
      if (!name)                             { send(socket, 'login', { msg: 'badname'  }); return; }
      if (!password || password.length < 4)  { send(socket, 'login', { msg: 'badpass'  }); return; }
      const nameKey = name.toLowerCase();
      if (accounts.has(nameKey))             { send(socket, 'login', { msg: 'usedname' }); return; }

      const newLid = genId();
      accounts.set(nameKey, {
        lid: newLid, name: sanitize(name, 60),
        pass: bcrypt.hashSync(password, SALT_ROUNDS),
        pic: 'pic.png', ico: '', rep: 0, power: '',
        rank: 0, co: '--', bg: '', ucol: '', mcol: '', msg: '',
        created: Date.now(), last: Date.now()
      });
      send(socket, 'login', { msg: 'reg' });
      console.log(`[+] تسجيل: "${name}"`);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تسجيل الخروج
    // appraad.js: send("logout", {})
    // ════════════════════════════════════════════════════════════════════════
    case 'logout': {
      leaveRoom(socket, user);
      user.token = genId();
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // الانضمام لغرفة  { id, pwd }
    // appraad.js: send('rjoin', { roomid, pwd })
    // (appraad.js يرسل roomid وليس id أحياناً — ندعم كليهما)
    // ════════════════════════════════════════════════════════════════════════
    case 'rjoin': {
      const id  = data?.id || data?.roomid;
      const pwd = data?.pwd || '';
      const targetRoom = rooms.get(id);
      if (!targetRoom) return;
      leaveRoom(socket, user);
      joinRoom(socket, user, targetRoom, pwd);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // مغادرة الغرفة
    // ════════════════════════════════════════════════════════════════════════
    case 'rleave': {
      leaveRoom(socket, user);
      send(socket, 'rlist', [...rooms.values()].map(roomListItem));
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رسالة عامة  { msg, mi }
    // appraad.js: Tsend() → send('msg', { msg, mi })
    // appraad.js case 'msg' → injectBroadcastItemToUi('#d2', commandPayload)
    // ════════════════════════════════════════════════════════════════════════
    case 'msg': {
      if (!room) return;
      const { msg: text, mi, link } = data || {};
      if (!text && !link) return;
      const payload = buildMsg(user, text || '', { bid: makeBid(), mi: mi || makeBid() });
      if (link)   payload.link = sanitize(link, 500);
      if (mi)     payload.mi   = mi;
      toRoom(user.roomid, 'msg', payload);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رسالة الحائط  { msg, link, bid }
    // appraad.js: sendbc() → send('bc', { msg, link, bid })
    // appraad.js case 'bc' → injectBroadcastItemToUi("#d2bc", commandPayload)
    // ════════════════════════════════════════════════════════════════════════
    case 'bc': {
      if (!room) return;
      const { msg: text, link, bid: clientBid } = data || {};
      if (!text && !link) return;
      const payload = buildMsg(user, text || '', { bid: clientBid || makeBid() });
      if (link) payload.link = sanitize(link, 500);
      room.wall.push(payload);
      if (room.wall.length > MAX_WALL) room.wall.shift();
      toRoom(user.roomid, 'bc', payload);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رسالة خاصة  { msg, id }
    // appraad.js: pmsg() → send('pm', { msg, id })
    // appraad.js case 'pm' → openw + injectBroadcastItemToUi
    // ════════════════════════════════════════════════════════════════════════
    case 'pm': {
      const { msg: text, id: toId } = data || {};
      if (!text || !toId) return;
      const target = byUID(toId);
      if (!target) return;
      if (target.nopm) { send(socket, 'nopm', { id: toId }); return; }
      const ts = io.sockets.sockets.get(target.socketId);
      if (!ts) return;
      const payload = buildMsg(user, text, { pm: user.id, bid: makeBid(), uid: user.id });
      send(ts, 'pm', payload);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // إعجاب على منشور الحائط  { bid }
    // appraad.js: send('likebc', { bid })
    // appraad.js case 'bc^' → likeHeartIcon.text(+1)
    // ════════════════════════════════════════════════════════════════════════
    case 'likebc': {
      if (!room || !room.settings.bclikes) return;
      const { bid } = data || {};
      if (!bid) return;
      const wallMsg = room.wall.find(m => m.bid === bid);
      if (wallMsg) {
        wallMsg.likes = (wallMsg.likes || 0) + 1;
        const sender = byUID(wallMsg.uid);
        if (sender && sender.id !== user.id) {
          sender.rep++;
          saveAccount(sender, { rep: sender.rep });
          toRoom(room.id, 'u^', { id: sender.id, rep: sender.rep });
        }
      }
      toRoom(user.roomid, 'bc^', { bid, likes: wallMsg ? wallMsg.likes : 1 });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // إعجاب على رسالة عامة  { bid } أو bid (string)
    // appraad.js: send('likemsg', { bid }) أو send('likem', bid)
    // appraad.js case 'mi+' → messageHeartIcon.text(+1)
    // ════════════════════════════════════════════════════════════════════════
    case 'likemsg':
    case 'likem': {
      if (!room || !room.settings.mlikes) return;
      const bid = (data && typeof data === 'object') ? data.bid : data;
      if (!bid) return;
      toRoom(user.roomid, 'mi+', bid);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // حذف منشور حائط  { bid }
    // appraad.js case 'delbc' → $(".bid"+bid).remove()
    // ════════════════════════════════════════════════════════════════════════
    case 'delbc': {
      if (!room || !adminOk) return;
      const { bid } = data || {};
      if (!bid) return;
      room.wall = room.wall.filter(m => m.bid !== bid);
      toRoom(user.roomid, 'delbc', { bid });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // حذف رسالة عامة  { bid } أو { mi }
    // appraad.js case 'dmsg' → $(".mi"+commandPayload).remove()
    // ════════════════════════════════════════════════════════════════════════
    case 'delmsg':
    case 'dmsg': {
      if (!room || !adminOk) return;
      const id = data?.bid || data?.mi || data;
      if (!id) return;
      toRoom(user.roomid, 'dmsg', id);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // المايك  slotIndex | -1
    // appraad.js: tmic(index) → send("mic", index)
    //   mic(-1)  → مغادرة المايك
    //   mic(n)   → طلب خانة n أو أول فارغة
    // ════════════════════════════════════════════════════════════════════════
    case 'mic': {
      if (!room || !room.settings.mic) return;
      const slot = data;

      if (slot === -1) {
        // مغادرة المايك
        const i = room.mic.indexOf(user.id);
        if (i !== -1) {
          room.mic[i] = 0;
          // إبلاغ P2P
          room.mic.forEach(uid => {
            if (typeof uid !== 'string' || uid === user.id) return;
            const peer = byUID(uid);
            if (!peer) return;
            const ps = io.sockets.sockets.get(peer.socketId);
            if (ps) send(ps, 'p2', { t: 'x', id: user.id, dir: 0 });
          });
          broadcastRoomUpdate(room);
        }
        return;
      }

      // طلب خانة
      const idx = (typeof slot === 'number' && slot >= 0 && slot < MAX_MIC_SLOTS)
        ? slot
        : room.mic.findIndex(v => v === 0);
      if (idx === -1) return;
      if (room.mic[idx] !== 0) return; // الخانة مشغولة أو مقفولة

      // إزالة من خانة سابقة إن وُجدت
      const prev = room.mic.indexOf(user.id);
      if (prev !== -1) room.mic[prev] = 0;

      room.mic[idx] = user.id;
      broadcastRoomUpdate(room);

      // إبلاغ المايكات الأخرى لبدء WebRTC
      room.mic.forEach((uid, i) => {
        if (i === idx) return;
        if (typeof uid !== 'string') return;
        const peer = byUID(uid);
        if (!peer) return;
        const ps = io.sockets.sockets.get(peer.socketId);
        if (ps) send(ps, 'p2', { t: 'start', id: user.id, dir: 0 });
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // سحب المايك من مستخدم (مشرف)  userId (string)
    // appraad.js: send("uml", currentMicUser)
    // ════════════════════════════════════════════════════════════════════════
    case 'uml': {
      if (!room || !adminOk) return;
      const targetId = typeof data === 'string' ? data : data?.id;
      const i = room.mic.indexOf(targetId);
      if (i !== -1) {
        room.mic[i] = 0;
        broadcastRoomUpdate(room);
        // إبلاغ المستخدم المسحوب منه
        const t = byUID(targetId);
        if (t) {
          const ts = io.sockets.sockets.get(t.socketId);
          if (ts) {
            send(ts, 'p2', { t: 'x', id: user.id, dir: 0 });
          }
        }
      }
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تغيير حالة خانة مايك  { i, v }
    // appraad.js: send("micstat", { i: currentMicIdx, v: false/true })
    // ════════════════════════════════════════════════════════════════════════
    case 'micstat': {
      if (!room || !adminOk) return;
      const { i: mi, v: mv } = data || {};
      if (typeof mi !== 'number' || mi < 0 || mi >= MAX_MIC_SLOTS) return;
      room.mic[mi] = mv ? 0 : false; // false = مقفول
      broadcastRoomUpdate(room);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // WebRTC P2P  { t, id, dir, data }
    // appraad.js: send('p2', { t, id, dir, data })
    // appraad.js case 'p2' → switch(commandPayload.t)
    // ════════════════════════════════════════════════════════════════════════
    case 'p2': {
      const { id: toId, t: sigT, data: sigD, dir } = data || {};
      const target = byUID(toId);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (!ts) return;
      send(ts, 'p2', {
        t:   sigT,
        id:  user.id,
        data: sigD,
        dir: dir === 1 ? 0 : 1
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // مكالمة صوتية  { t, id, data }
    // appraad.js: send("call", { t, id, data })
    // appraad.js case 'call' → switch(commandPayload.t)
    // ════════════════════════════════════════════════════════════════════════
    case 'call': {
      const { t: callT, id: callTo, data: callData } = data || {};
      if (!callTo) return;
      const target = byUID(callTo);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (!ts) return;
      send(ts, 'call', { t: callT, id: user.id, data: callData });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // مؤشر الكتابة  [targetId, 0|1]
    // appraad.js: send('ty', [currentPrivateUser, 1|0])
    // appraad.js case 'ty' → typingIndicator.show()/hide()
    // ════════════════════════════════════════════════════════════════════════
    case 'ty': {
      if (!Array.isArray(data) || data.length < 2) return;
      const [toId, val] = data;
      const target = byUID(toId);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'ty', [user.id, val]);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رفض الرسائل الخاصة  { id }
    // appraad.js: send("nopm", { id: targetUserId })
    // ════════════════════════════════════════════════════════════════════════
    case 'nopm': {
      user.nopm = true;
      const target = byUID(data?.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'nopm', { id: user.id });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // إيقاف الإشعارات
    // appraad.js: send("nonot", { id: commandPayload.user })
    // ════════════════════════════════════════════════════════════════════════
    case 'nonot': {
      user.nonot = true;
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // DND / مشغول  { busy }
    // ════════════════════════════════════════════════════════════════════════
    case 'busy': {
      user.nopm = data?.busy === true || data?.busy === 1;
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // طلب ملف مستخدم  uid (string)
    // appraad.js: send('upro', uid)  → فتح البروفايل محلياً
    // appraad.js window.upro = upro
    // ════════════════════════════════════════════════════════════════════════
    case 'upro': {
      const uid = typeof data === 'string' ? data : data?.id;
      const target = byUID(uid);
      if (!target) return;
      // إرسال بيانات المستخدم للعرض في البروفايل
      send(socket, 'upro', target.pub());
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تحديث الملف الشخصي  { topic, msg, ucol, mcol, bg }
    // appraad.js: setprofile() → send("setprofile", { topic, msg, ucol, mcol, bg })
    // appraad.js case 'online+' → يحدث واجهة العضو
    // ════════════════════════════════════════════════════════════════════════
    case 'setprofile': {
      if (!room) return;
      const { topic, msg: statusMsg, ucol, mcol, bg } = data || {};
      if (topic     !== undefined) user.topic = sanitize(topic, 60);
      if (statusMsg !== undefined) user.msg   = sanitize(statusMsg, 200);
      if (ucol      !== undefined) user.ucol  = sanitize(ucol, 30);
      if (mcol      !== undefined) user.mcol  = sanitize(mcol, 30);
      if (bg        !== undefined) user.bg    = sanitize(bg, 30);
      saveAccount(user, {
        topic: user.topic, msg: user.msg,
        ucol:  user.ucol,  mcol: user.mcol, bg: user.bg
      });
      // appraad.js case 'online+' actionType==0 → rebuild أو actionType==1 → prepend
      // نرسل u^ (تحديث عضو) وليس online+ كامل لتجنب إعادة البناء
      toRoom(user.roomid, 'u^', user.pub());
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تغيير الصورة الشخصية  { pic }
    // appraad.js: sendpic() → send('setpic', { pic })
    // ════════════════════════════════════════════════════════════════════════
    case 'setpic': {
      if (!room) return;
      const { pic } = data || {};
      if (!pic) return;
      user.pic = sanitize(pic, 200);
      saveAccount(user, { pic: user.pic });
      toRoom(user.roomid, 'u^', user.pub());
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // بصمة الجهاز  { ...fp }
    // ════════════════════════════════════════════════════════════════════════
    case 'fp': {
      user._fp = JSON.stringify(data || {}).slice(0, 300);
      saveAccount(user, { fp: user._fp });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // إعلان عام في الغرفة  { msg }
    // appraad.js: pmsg() → send('pmsg', { msg })   [مشرف فقط]
    // appraad.js case 'pmsg' → إظهار لافتة إعلانية
    // ════════════════════════════════════════════════════════════════════════
    case 'pmsg': {
      if (!adminOk || !room) return;
      const { msg: text } = data || {};
      if (!text) return;
      toRoom(user.roomid, 'pmsg', {
        uid:   user.id,
        topic: user.topic,
        pic:   user.pic,
        msg:   sanitize(text, 500),
        t:     Date.now(),
        bid:   makeBid()
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // خاص جماعي لجميع المتصلين  { msg }  [مشرف فقط]
    // appraad.js case 'ppmsg' → يعرضها كرسالة في #d2
    // ════════════════════════════════════════════════════════════════════════
    case 'ppmsg': {
      if (!adminOk) return;
      const { msg: text } = data || {};
      if (!text) return;
      const payload = {
        uid:   user.id, topic: user.topic, pic: user.pic,
        msg:   sanitize(text, 500), t: Date.now(), bid: makeBid()
      };
      users.forEach(u => {
        const ts = io.sockets.sockets.get(u.socketId);
        if (ts) send(ts, 'ppmsg', payload);
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // هدية  { uid, gift }
    // appraad.js: gift(uid, giftFile) → send('gift', { uid, gift })
    // appraad.js case 'gift' → عرض نافذة الهدية
    // ════════════════════════════════════════════════════════════════════════
    case 'gift': {
      const { uid: toId, gift } = data || {};
      if (!toId || !gift) return;
      const target = byUID(toId);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'gift', {
        gift:  sanitize(gift, 100),
        uid:   user.id,
        topic: user.topic,
        pic:   user.pic
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // إشعار  { id, msg }
    // appraad.js case 'not' → عرض نافذة تنبيه
    // ════════════════════════════════════════════════════════════════════════
    case 'not': {
      if (!modOk) return;
      const { id: toId, msg: notMsg } = data || {};
      const target = byUID(toId);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'not', {
        msg:  sanitize(notMsg || '', 300),
        user: user.id,
        uid:  user.id,
        topic: user.topic,
        pic:  user.pic
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // حظر مستخدم  { id }
    // appraad.js: ubnr(id) → send('ubnr', { id })
    // ════════════════════════════════════════════════════════════════════════
    case 'ubnr': {
      // تجاهل في البث (حماية محلية)
      const { id: toId } = data || {};
      const target = byUID(toId);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'ubnr', { id: user.id });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // بحث تاريخ مستخدم  lid (string)  [مشرف فقط]
    // appraad.js case 'uh' → جدول سجل النكات والآيبي
    // ════════════════════════════════════════════════════════════════════════
    case 'uh': {
      if (!adminOk) return;
      const lid = typeof data === 'string' ? data : data?.lid;
      const history = [];
      users.forEach(u => {
        if (u.lid === lid) {
          history.push({
            u:   u.topic,
            t:   u.topic,
            _ip: u._ip,
            _fp: u._fp || '',
            c:   u.last || Date.now()
          });
        }
      });
      // إضافة عنصر أخير للسيرفر
      history.push({ d: Date.now() });
      send(socket, 'uh', history);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تحديث إعدادات الغرفة  { mic, calls, ... }  [مشرف]
    // appraad.js: sett_save() → send('settings', { ... })
    // appraad.js case 'settings' → chatInteractionsConfig = commandPayload
    // ════════════════════════════════════════════════════════════════════════
    case 'settings': {
      if (!room || !adminOk) return;
      const allowed = ['mic','setpower','ban','owner','calls','mlikes','bclikes','mreply','bcreply'];
      allowed.forEach(k => { if (k in (data || {})) room.settings[k] = !!data[k]; });
      toRoom(user.roomid, 'settings', room.settings);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // طلب قائمة مشرفي الغرفة  { roomid }
    // appraad.js: openw → send('ops', { roomid })
    // appraad.js case 'ops' → عرض قائمة المشرفين
    // ════════════════════════════════════════════════════════════════════════
    case 'ops': {
      const { roomid } = data || {};
      const targetRoom = rooms.get(roomid || user.roomid);
      if (!targetRoom) return;
      send(socket, 'ops', buildRops(targetRoom));
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ترفيع مشرف  { lid }
    // appraad.js: send('op+', { lid })
    // ════════════════════════════════════════════════════════════════════════
    case 'op+': {
      if (!room || !adminOk) return;
      const { lid } = data || {};
      if (!lid || room.ops.includes(lid)) return;
      room.ops.push(lid);
      toRoom(room.id, 'rops', buildRops(room));
      const target = byLID(lid);
      if (target) {
        const ts = io.sockets.sockets.get(target.socketId);
        if (ts) send(ts, 'power', buildPower(target, room));
      }
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // إزالة مشرف  { lid }
    // appraad.js: send('op-', { lid })
    // ════════════════════════════════════════════════════════════════════════
    case 'op-': {
      if (!room || !adminOk) return;
      const { lid } = data || {};
      if (!lid) return;
      room.ops = room.ops.filter(l => l !== lid);
      toRoom(room.id, 'rops', buildRops(room));
      const target = byLID(lid);
      if (target) {
        const ts = io.sockets.sockets.get(target.socketId);
        if (ts) send(ts, 'power', buildPower(target, room));
      }
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // إنشاء غرفة جديدة  { topic/name, pass, max, about, welcome, pic, c }
    // appraad.js: mkr() → send('r+', { ... })
    // appraad.js case 'r+' → بناء عنصر الغرفة في #rooms
    // ════════════════════════════════════════════════════════════════════════
    case 'r+': {
      if (!adminOk) return;
      const rName = sanitize(data?.topic || data?.name || '', 80);
      if (!rName) return;
      const newRoom = new Room('r_' + Date.now(), rName, data?.pass || '');
      newRoom.owner   = user.lid;
      newRoom.pic     = data?.pic     || 'room.png';
      newRoom.about   = sanitize(data?.about   || '', 300);
      newRoom.welcome = sanitize(data?.welcome || '', 300);
      newRoom.max     = parseInt(data?.max)    || 20;
      newRoom.c       = data?.c       || '#000000';
      rooms.set(newRoom.id, newRoom);
      toAll('r+', roomListItem(newRoom));
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تعديل غرفة  { id, topic, pass, max, about, welcome, pic, c }
    // appraad.js: redit() → send('r^', { ... })
    // appraad.js case 'r^' → تحديث بيانات الغرفة
    // ════════════════════════════════════════════════════════════════════════
    case 'r^': {
      if (!adminOk) return;
      const editId = data?.id || user.roomid;
      const targetRoom = rooms.get(editId);
      if (!targetRoom) return;
      if (data?.topic)   targetRoom.name    = sanitize(data.topic, 80);
      if (data?.name)    targetRoom.name    = sanitize(data.name, 80);
      if (data?.pic)     targetRoom.pic     = data.pic;
      if (data?.c)       targetRoom.c       = data.c;
      if (data?.about    !== undefined) targetRoom.about   = sanitize(data.about, 300);
      if (data?.welcome  !== undefined) targetRoom.welcome = sanitize(data.welcome, 300);
      if (data?.max)     targetRoom.max     = parseInt(data.max) || 20;
      if ('pass' in (data || {})) {
        targetRoom.pass     = data.pass ? bcrypt.hashSync(data.pass, SALT_ROUNDS) : '';
        targetRoom.needpass = !!data.pass;
      }
      broadcastRoomUpdate(targetRoom);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // حذف غرفة  { id }
    // appraad.js: send('r-', { id })
    // appraad.js case 'r-' → إزالة عنصر الغرفة
    // ════════════════════════════════════════════════════════════════════════
    case 'r-': {
      if (!adminOk) return;
      const delId   = data?.id;
      const delRoom = rooms.get(delId);
      if (!delRoom) return;
      delRoom.members.forEach((_, sid) => {
        const s = io.sockets.sockets.get(sid);
        if (s) send(s, 'kick', { reason: 'room_deleted' });
      });
      rooms.delete(delId);
      toAll('r-', delId);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تحكم مايك الغرفة  { id, v }  [مشرف]
    // appraad.js: send("v", { id, v })  لتفعيل/تعطيل المايك في غرفة
    // ════════════════════════════════════════════════════════════════════════
    case 'v': {
      if (!adminOk) return;
      const targetRoom = data?.id ? rooms.get(data.id) : room;
      if (!targetRoom) return;
      targetRoom.settings.mic = !!data?.v;
      toRoom(targetRoom.id, 'settings', targetRoom.settings);
      broadcastRoomUpdate(targetRoom);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // بيانات لوحة التحكم  [windowCpi, eventData]
    // appraad.js: send("cpi", [senderWindow.cpi, eventData])
    // ════════════════════════════════════════════════════════════════════════
    case 'cpi': {
      if (!adminOk) return;
      if (!room) return;
      // إرسال البيانات الأساسية للوحة التحكم
      send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
        id: r.id, name: r.name, owner: r.owner || '',
        online: r.members.size, needpass: r.needpass
      })));
      if (room) send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // أوامر لوحة التحكم  { cmd, ...data }
    // appraad.js: send('cp', { cmd, ... })
    // ════════════════════════════════════════════════════════════════════════
    case 'cp': {
      dispatchCP(socket, user, room, data, adminOk, modOk);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ملف / ميديا في الخاص  { pm, link }
    // appraad.js: sendfilea() → send('file', { pm, link })
    // appraad.js case 'file' → عرض رابط الملف في صندوق الخاص
    // ════════════════════════════════════════════════════════════════════════
    case 'file': {
      const { pm: toId, link } = data || {};
      if (!toId || !link) return;
      const target = byUID(toId);
      if (!target) return;
      if (target.nopm) { send(socket, 'nopm', { id: toId }); return; }
      const ts = io.sockets.sockets.get(target.socketId);
      if (!ts) return;
      const payload = buildMsg(user, '', { pm: user.id, link: sanitize(link, 500), bid: makeBid() });
      send(ts, 'file', payload);
      break;
    }

    default:
      if (process.env.DEBUG) console.log(`[?] أمر غير معروف: "${cmd}"`);
  }
}

// ─── أوامر لوحة التحكم CP ─────────────────────────────────────────────────────
function dispatchCP(socket, user, room, data, adminOk, modOk) {
  const cmd = data?.cmd;
  if (!cmd) return;

  switch (cmd) {

    // ── طرد مستخدم  { id }
    case 'kick': {
      if (!modOk || !room) return;
      const target = byUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) {
        send(ts, 'kick', { reason: 'kicked' });
        leaveRoom(ts, target);
      }
      break;
    }

    // ── حظر مستخدم  { id, type, expires, reason }
    case 'ban': {
      if (!modOk || !room) return;
      const target = data.id ? byUID(data.id) : null;
      const entry = {
        id: data.id || '', lid: '', name: '',
        type: data.type || 'fp',
        fp: target?._fp || '', ip: target?._ip || '',
        expires: data.expires || null, reason: data.reason || '',
        count: 0, last: Date.now(), active: true
      };
      if (target) {
        entry.lid  = target.lid;
        entry.name = target.topic;
        const ts = io.sockets.sockets.get(target.socketId);
        if (ts) { send(ts, 'kick', { reason: 'banned' }); leaveRoom(ts, target); }
      }
      room.bans.push(entry);
      send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ── رفع حظر  { id }
    case 'aban': {
      if (!modOk || !room) return;
      room.bans = room.bans.map(b => b.id === data.id ? { ...b, active: false } : b);
      send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ── قائمة الحظر
    case 'bans': {
      if (!modOk || !room) return;
      send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ── تغيير كلمة مرور عضو  { id, pwd }
    case 'pwd': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      for (const [, acc] of accounts) {
        if (acc.lid === target.lid) {
          acc.pass = bcrypt.hashSync(data.pwd || '', SALT_ROUNDS);
          break;
        }
      }
      break;
    }

    // ── تعديل لايكات  { id, likes }
    case 'likes': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      target.rep = parseInt(data.likes) || 0;
      saveAccount(target, { rep: target.rep });
      if (target.roomid) toRoom(target.roomid, 'u^', { id: target.id, rep: target.rep });
      break;
    }

    // ── منح صلاحية  { id, power, days }
    case 'setpower': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      target.power = data.power || '';
      saveAccount(target, { power: target.power });
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts && room) send(ts, 'power', buildPower(target, room));
      if (target.roomid) toRoom(target.roomid, 'u^', target.pub());
      break;
    }

    // ── حذف عضوية  { id }
    case 'delu': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      // حذف من الحسابات
      for (const [key, acc] of accounts) {
        if (acc.lid === target.lid) { accounts.delete(key); break; }
      }
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) { send(ts, 'kick', { reason: 'deleted' }); ts.disconnect(true); }
      break;
    }

    // ── قائمة بصمات FPS  { q, i }
    case 'fps': {
      if (!adminOk) return;
      const query  = data.q || '';
      const offset = parseInt(data.i) || 0;
      const list   = [];
      users.forEach(u => {
        if (!query || u._fp.includes(query) || u.topic.includes(query)) {
          list.push({
            username: u.lid, topic: u.topic,
            ip: u._ip, co: u.co, fp: u._fp,
            refr: u.refr || '', r: '',
            created: Date.now() - u.created,
            isreg: !!accounts.has(u.lid)
          });
        }
      });
      const chunk = list.slice(offset, offset + 200);
      chunk.push({ d: Date.now(), i: offset });
      send(socket, 'cp_fps', chunk);
      break;
    }

    // ── بحث FPS بالبصمة  { q }
    case 'fp_search':
    case 'fps_do': {
      if (!adminOk) return;
      const fp  = data.q || data.fp || '';
      const res = [];
      users.forEach(u => {
        if (u._fp === fp || u._fp.includes(fp)) {
          res.push({ username: u.lid, topic: u.topic, ip: u._ip, co: u.co, fp: u._fp });
        }
      });
      send(socket, 'cp_fps', res.concat([{ d: Date.now(), i: 0 }]));
      break;
    }

    // ── سجل العمليات
    case 'actions': {
      if (!adminOk) return;
      send(socket, 'cp_actions', [{ d: Date.now(), i: 0 }]);
      break;
    }

    // ── قائمة الدروع / الهدايا / الفيسات
    case 'sico': {
      if (!adminOk || !room) return;
      send(socket, 'cp_sico', room.sicos);
      break;
    }

    // ── ترتيب الفيسات  { d: [] }
    case 'emo_order': {
      if (!adminOk || !room) return;
      if (Array.isArray(data.d)) {
        room.emos = data.d;
        toRoom(room.id, 'emos', room.emos);
      }
      break;
    }

    // ── حفظ صلاحية  { power: { name, rank, ... } }
    case 'powers_save': {
      if (!adminOk || !room) return;
      const pw = data.power;
      if (!pw || !pw.name) return;
      const idx = room.powers.findIndex(p => p.name === pw.name);
      if (idx !== -1) room.powers[idx] = pw;
      else room.powers.push(pw);
      toRoom(room.id, 'powers', room.powers);
      break;
    }

    // ── حذف صلاحية  { name }
    case 'powers_del': {
      if (!adminOk || !room) return;
      room.powers = room.powers.filter(p => p.name !== data.name);
      toRoom(room.id, 'powers', room.powers);
      break;
    }

    // ── إضافة أيقونة  { pid, tar }
    case 'addico': {
      if (!adminOk || !room) return;
      const tar = data.tar || 'sico';
      if (tar === 'sico' && !room.sicos.includes(data.pid)) room.sicos.push(data.pid);
      else if (tar === 'emo' && !room.emos.includes(data.pid)) room.emos.push(data.pid);
      else if (tar === 'dro3' && !room.colors.includes(data.pid)) room.colors.push(data.pid);
      send(socket, 'ico+', data.pid);
      break;
    }

    // ── حذف أيقونة  { pid }
    case 'delico': {
      if (!adminOk || !room) return;
      const pid = data.pid || '';
      room.sicos  = room.sicos.filter(x => x !== pid);
      room.emos   = room.emos.filter(x => x !== pid);
      room.colors = room.colors.filter(x => x !== pid);
      toRoom(room.id, 'ico-', pid);
      break;
    }

    // ── طرد من الغرفة فقط  { id }
    case 'roomkick': {
      if (!modOk || !room) return;
      const target = byUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) { send(ts, 'kick', { reason: 'roomkick' }); leaveRoom(ts, target); }
      break;
    }

    // ── هدية من لوحة التحكم  { id, gift }
    case 'gift': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'gift', { gift: data.gift, uid: user.id, topic: user.topic, pic: user.pic });
      break;
    }

    // ── إشعار من لوحة التحكم  { id, msg }
    case 'not': {
      if (!modOk) return;
      const target = byUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'not', {
        msg: sanitize(data.msg || '', 300), user: user.id, uid: user.id,
        topic: user.topic, pic: user.pic
      });
      break;
    }

    // ── حفظ إعدادات الموقع
    case 'sitesave':
    case 'domainsave': {
      if (!adminOk) return;
      if (!global.siteSettings) global.siteSettings = {};
      Object.assign(global.siteSettings, data.data || {});
      send(socket, 'ok', null);
      break;
    }

    // ── رسائل الترحيب التلقائية
    case 'msgs': {
      if (!adminOk || !room) return;
      send(socket, 'cp_msgs', []);
      break;
    }

    // ── قائمة الغرف
    case 'cp_rooms': {
      if (!adminOk) return;
      send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
        id: r.id, name: r.name, owner: r.owner || '',
        online: r.members.size, needpass: r.needpass
      })));
      break;
    }

    // ── إعدادات البوتات
    case 'bot_save': {
      if (!adminOk || !room) return;
      room.botsConfig = {
        active:   data.bots_active  === true,
        minStay:  parseInt(data.bots_minStay)  || 0,
        maxStay:  parseInt(data.bots_maxStay)  || 0,
        minLeave: parseInt(data.bots_minLeave) || 0,
        maxLeave: parseInt(data.bots_maxLeave) || 0
      };
      send(socket, 'cp_bots', [...(room.bots || new Map()).values()]);
      break;
    }

    case 'bots': {
      if (!adminOk || !room) return;
      send(socket, 'cp_bots', []);
      break;
    }

    default:
      if (process.env.DEBUG) console.log(`[CP] أمر مجهول: "${cmd}"`);
  }
}

// ─── REST API ──────────────────────────────────────────────────────────────────

app.get('/api/status', (_, res) => {
  res.json({
    users: users.size,
    rooms: [...rooms.values()].map(r => ({
      id: r.id, name: r.name, online: r.members.size
    }))
  });
});

app.post('/api/rooms', (req, res) => {
  const { key, name, pass } = req.body || {};
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'غير مسموح' });
  if (!name)             return res.status(400).json({ error: 'name مطلوب' });
  const r = new Room('r_' + Date.now(), sanitize(name, 80), pass || '');
  rooms.set(r.id, r);
  toAll('r+', roomListItem(r));
  res.json({ id: r.id, name: r.name });
});

app.delete('/api/rooms/:id', (req, res) => {
  const { key } = req.body || {};
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'غير مسموح' });
  const r = rooms.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'غير موجودة' });
  r.members.forEach((_, sid) => {
    const s = io.sockets.sockets.get(sid);
    if (s) send(s, 'kick', { reason: 'room_deleted' });
  });
  rooms.delete(req.params.id);
  toAll('r-', req.params.id);
  res.json({ deleted: true });
});

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
    rank: parseInt(rank) || 0, co: '--', bg: '', ucol: '', mcol: '', msg: '',
    created: Date.now(), last: Date.now()
  });
  res.json({ ok: true, lid });
});

// ─── تشغيل السيرفر ────────────────────────────────────────────────────────────
seedRooms();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`    http://localhost:${PORT}\n`);
  console.log('  ═══ جدول الأحداث المتوافق مع appraad.js ═══');
  console.log('  Client → Server │ Server → Client');
  console.log('  ─────────────────┼──────────────────');
  console.log('  online           │ server, rlist, emos, dro3, sico, powers, settings');
  console.log('  g / login / reg  │ ok, login{msg,id,k,ttoken,r}');
  console.log('  rjoin            │ rc, ulist, rlist, emos, dro3, sico, powers,');
  console.log('                   │ settings, power, mic, bclist, rops, rcd, online+, r^');
  console.log('  msg              │ msg → toRoom');
  console.log('  bc               │ bc → toRoom');
  console.log('  pm               │ pm → target');
  console.log('  mic (slot/-1)    │ r^ (m,ops) → toRoom');
  console.log('  uml              │ r^ + p2{t:x} → target');
  console.log('  p2               │ p2 → target');
  console.log('  call             │ call → target');
  console.log('  ty               │ ty → target');
  console.log('  setprofile       │ u^ → toRoom');
  console.log('  cp{cmd}          │ cp_* → socket\n');
});
