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

// ─── قائمة الدول — مطابقة لـ uf / countryFlags في appr.js ────────────────────
const countryFlags = {
  'kw': "الكويت",
  'et': "إثيوبيا",
  'az': "أذربيجان",
  'am': "أرمينيا",
  'aw': "أروبا",
  'er': "إريتريا",
  'es': "أسبانيا",
  'au': "أستراليا",
  'ee': "إستونيا",
  'il': "إسرائيل",
  'af': "أفغانستان",
  'ec': "إكوادور",
  'ar': "الأرجنتين",
  'jo': "الأردن",
  'ae': "الإمارات العربية المتحدة",
  'al': "ألبانيا",
  'bh': "مملكة البحرين",
  'br': "البرازيل",
  'pt': "البرتغال",
  'ba': "البوسنة والهرسك",
  'ga': "الجابون",
  'dz': "الجزائر",
  'dk': "الدانمارك",
  'cv': "الرأس الأخضر",
  'ps': "فلسطين",
  'sv': "السلفادور",
  'sn': "السنغال",
  'sd': "السودان",
  'se': "السويد",
  'so': "الصومال",
  'cn': "الصين",
  'iq': "العراق",
  'ph': "الفلبين",
  'cm': "الكاميرون",
  'cg': "الكونغو",
  'cd': "جمهورية الكونغو الديمقراطية",
  'de': "ألمانيا",
  'hu': "المجر",
  'ma': "المغرب",
  'mx': "المكسيك",
  'sa': "المملكة العربية السعودية",
  'uk': "المملكة المتحدة",
  'gb': "المملكة المتحدة",
  'no': "النرويج",
  'at': "النمسا",
  'ne': "النيجر",
  'in': "الهند",
  'us': "الولايات المتحدة",
  'jp': "اليابان",
  'ye': "اليمن",
  'gr': "اليونان",
  'ag': "أنتيغوا وبربودا",
  'id': "إندونيسيا",
  'ao': "أنغولا",
  'ai': "أنغويلا",
  'uy': "أوروجواي",
  'uz': "أوزبكستان",
  'ug': "أوغندا",
  'ua': "أوكرانيا",
  'ir': "إيران",
  'ie': "أيرلندا",
  'is': "أيسلندا",
  'it': "إيطاليا",
  'pg': "بابوا-غينيا الجديدة",
  'py': "باراجواي",
  'bb': "باربادوس",
  'pk': "باكستان",
  'pw': "بالاو",
  'bm': "برمودا",
  'bn': "بروناي",
  'be': "بلجيكا",
  'bg': "بلغاريا",
  'bd': "بنجلاديش",
  'pa': "بنما",
  'bj': "بنين",
  'bt': "بوتان",
  'bw': "بوتسوانا",
  'pr': "بورتو ريكو",
  'bf': "بوركينا فاسو",
  'bi': "بوروندي",
  'pl': "بولندا",
  'bo': "بوليفيا",
  'pf': "بولينزيا الفرنسية",
  'pe': "بيرو",
  'by': "بيلاروس",
  'bz': "بيليز",
  'th': "تايلاند",
  'tw': "تايوان",
  'tm': "تركمانستان",
  'tr': "تركيا",
  'tt': "ترينيداد وتوباجو",
  'td': "تشاد",
  'cl': "تشيلي",
  'tz': "تنزانيا",
  'tg': "توجو",
  'tv': "توفالو",
  'tk': "توكيلاو",
  'to': "تونجا",
  'tn': "تونس",
  'tp': "تيمور الشرقية",
  'jm': "جامايكا",
  'gm': "جامبيا",
  'gl': "جرينلاند",
  'pn': "جزر البتكارين",
  'bs': "جزر البهاما",
  'km': "جزر القمر",
  'cf': "أفريقيا الوسطى",
  'cz': "جمهورية التشيك",
  'do': "جمهورية الدومينيكان",
  'za': "جنوب أفريقيا",
  'gt': "جواتيمالا",
  'gp': "جواديلوب",
  'gu': "جوام",
  'ge': "جورجيا",
  'gs': "جورجيا الجنوبية",
  'gy': "جيانا",
  'gf': "جيانا الفرنسية",
  'dj': "جيبوتي",
  'je': "جيرسي",
  'gg': "جيرنزي",
  'va': "دولة الفاتيكان",
  'dm': "دومينيكا",
  'rw': "رواندا",
  'ru': "روسيا",
  'ro': "رومانيا",
  're': "ريونيون",
  'zm': "زامبيا",
  'zw': "زيمبابوي",
  'ws': "ساموا",
  'sm': "سان مارينو",
  'sk': "سلوفاكيا",
  'si': "سلوفينيا",
  'sg': "سنغافورة",
  'sz': "سوازيلاند",
  'sy': "سوريا",
  'sr': "سورينام",
  'ch': "سويسرا",
  'sl': "سيراليون",
  'lk': "سيريلانكا",
  'sc': "سيشل",
  'rs': "صربيا",
  'tj': "طاجيكستان",
  'om': "عمان",
  'gh': "غانا",
  'gd': "غرينادا",
  'gn': "غينيا",
  'gq': "غينيا الاستوائية",
  'gw': "غينيا بيساو",
  'vu': "فانواتو",
  'fr': "فرنسا",
  've': "فنزويلا",
  'fi': "فنلندا",
  'vn': "فيتنام",
  'cy': "قبرص",
  'qa': "قطر",
  'kg': "قيرقيزستان",
  'kz': "كازاخستان",
  'nc': "كاليدونيا الجديدة",
  'kh': "كامبوديا",
  'hr': "كرواتيا",
  'ca': "كندا",
  'cu': "كوبا",
  'ci': "ساحل العاج",
  'kr': "كوريا",
  'kp': "كوريا الشمالية",
  'cr': "كوستاريكا",
  'co': "كولومبيا",
  'ki': "كيريباتي",
  'ke': "كينيا",
  'lv': "لاتفيا",
  'la': "لاوس",
  'lb': "لبنان",
  'li': "لشتنشتاين",
  'lu': "لوكسمبورج",
  'ly': "ليبيا",
  'lr': "ليبيريا",
  'lt': "ليتوانيا",
  'ls': "ليسوتو",
  'mq': "مارتينيك",
  'mo': "ماكاو",
  'fm': "ماكرونيزيا",
  'mw': "مالاوي",
  'mt': "مالطا",
  'ml': "مالي",
  'my': "ماليزيا",
  'yt': "مايوت",
  'mg': "مدغشقر",
  'eg': "مصر",
  'mk': "مقدونيا، يوغوسلافيا",
  'mn': "منغوليا",
  'mr': "موريتانيا",
  'mu': "موريشيوس",
  'mz': "موزمبيق",
  'md': "مولدوفا",
  'mc': "موناكو",
  'ms': "مونتسيرات",
  'me': "مونتينيغرو",
  'mm': "ميانمار",
  'na': "ناميبيا",
  'nr': "ناورو",
  'np': "نيبال",
  'ng': "نيجيريا",
  'ni': "نيكاراجوا",
  'nu': "نيوا",
  'nz': "نيوزيلندا",
  'ht': "هايتي",
  'hn': "هندوراس",
  'nl': "هولندا",
  'hk': "هونغ كونغ",
  'wf': "واليس وفوتونا",
  // رموز خاصة
  '--': "غير محدد",
  'a1': "مجهول / بروكسي",
  'a2': "مزود خدمة",
  'eu': "أوروبا",
  't1': "شبكة Tor"
};

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
    this.mcol     = fields.mcol  || '';   // لون نص الرسائل — appr.js: activeUserObj.mcol
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
      id:       this.id,
      lid:      this.lid,
      topic:    this.topic,
      username: this.lid,         // appr.js: userObj.username — يُستخدم في hash الزيارة
      msg:      this.msg,
      pic:      this.pic,
      ico:      this.ico,
      co:       this.co,
      bg:       this.bg,
      ucol:     this.ucol,
      mcol:     this.mcol || '',  // appr.js: activeUserObj.mcol (لون نص الرسائل)
      rep:      this.rep,
      power:    this.power,
      rank:     this.rank,
      roomid:   this.roomid,
      s:        this.s
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
    this.c        = '#000000';      // appr.js: roomPayloadObj.c (لون اسم الغرفة)
    this.about    = '';             // appr.js: roomPayloadObj.about (وصف الغرفة)
    this.welcome  = '';             // رسالة الترحيب عند الدخول
    this.max      = 20;             // appr.js: roomPayloadObj.max (الحد الأقصى للزوار)
    this.botsConfig = {             // إعدادات البوتات
      active: false, minStay: 0, maxStay: 0, minLeave: 0, maxLeave: 0
    };
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
    mcol:  sender.mcol || '',   // appr.js: messagePayload.mcol (لون نص الرسالة)
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
    topic:    room.name,          // appr.js يقرأ .topic
    pic:      room.pic,
    needpass: room.needpass,
    about:    room.about  || '',  // appr.js: roomPayloadObj.about
    c:        room.c      || '#000000', // appr.js: roomPayloadObj.c (لون النص)
    v:        room.settings?.mic || false, // appr.js: roomPayloadObj.v (مايك)
    max:      room.max    || 20,  // appr.js: uco/max
    online:   room.members.size,
    uco:      room.members.size   // appr.js يقرأ .uco كعداد الزوار
  };
}

/** إرسال تحديث الغرفة لجميع المتصلين */
function broadcastRoomUpdate(room) {
  // appr.js case 'r^' يتوقع: id, topic, name, pic, c, about, needpass, v, max, m, ops
  const payload = Object.assign(roomListItem(room), {
    m:   room.mic,        // مصفوفة المايك — يقرأها appr.js كـ commandPayload.m
    ops: room.ops         // قائمة المشرفين
  });
  io.emit('msg', { cmd: decodeCmd('r^'), data: payload });
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
  // 'setroom' محذوف: appr.js يستقبل معرف الغرفة عبر case 'mv' (commandPayload.id)
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
    toRoom(room.id, 'r^', Object.assign(roomListItem(room), {
          m: room.mic, ops: room.ops
        }));
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
          toRoom(user.roomid, 'r^', Object.assign(roomListItem(room), {
          m: room.mic, ops: room.ops
        }));
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
      toRoom(user.roomid, 'r^', Object.assign(roomListItem(room), {
          m: room.mic, ops: room.ops
        }));

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
        toRoom(user.roomid, 'r^', Object.assign(roomListItem(room), {
          m: room.mic, ops: room.ops
        }));
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
      toRoom(user.roomid, 'r^', Object.assign(roomListItem(room), {
          m: room.mic, ops: room.ops
        }));
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
      // upro: appr.js لا يعالجه (يفتح profile محلياً)
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
    // تغيير الصورة الشخصية   { pic }
    // ══════════════════════════════════════════════════════════════════════════
    case 'setpic': {
      if (!user.roomid) return;
      const { pic } = data || {};
      if (!pic || typeof pic !== 'string') return;
      user.pic = pic;
      saveAccount(user, { pic });
      toRoom(user.roomid, 'online+', user.pub());
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تحديث الملف الشخصي   { topic, msg, ucol, mcol, bg }
    // ══════════════════════════════════════════════════════════════════════════
    case 'setprofile': {
      if (!user.roomid) return;
      const { topic, msg: statusMsg, ucol, mcol, bg } = data || {};
      if (topic && typeof topic === 'string') user.topic = sanitize(topic, 60);
      if (statusMsg !== undefined)            user.msg   = sanitize(statusMsg, 200);
      if (ucol  !== undefined)                user.ucol  = sanitize(ucol,  30);
      if (mcol  !== undefined)                user.mcol  = sanitize(mcol,  30); // لون نص الرسائل
      if (bg    !== undefined)                user.bg    = sanitize(bg,    30);
      saveAccount(user, { topic: user.topic, msg: user.msg, ucol: user.ucol, mcol: user.mcol, bg: user.bg });
      toRoom(user.roomid, 'online+', user.pub());
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // رسالة خاصة — ملف / ميديا   { pm, link }
    // ══════════════════════════════════════════════════════════════════════════
    case 'file': {
      const { pm: toId, link } = data || {};
      if (!toId || !link) return;
      const target = byUID(toId);
      if (!target) return;
      if (target.nopm) { send(socket, 'nopm', { id: toId }); return; }
      const ts = io.sockets.sockets.get(target.socketId);
      if (!ts) return;
      const payload = buildMsg(user, '', { pm: user.id, link, bid: makeBid() });
      send(ts, 'file', payload);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // إعجاب على رسالة عامة   mi (string)
    // ══════════════════════════════════════════════════════════════════════════
    case 'likem': {
      if (!user.roomid) return;
      const mi = data;
      if (!mi) return;
      toRoom(user.roomid, 'mi+', mi);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // حذف رسالة عامة بـ mi   { mi }
    // ══════════════════════════════════════════════════════════════════════════
    case 'dmsg': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
      const { mi } = data || {};
      if (!mi) return;
      toRoom(user.roomid, 'dmsg', { mi });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // بث إعلان عام لجميع أعضاء الغرفة   { msg }
    // ══════════════════════════════════════════════════════════════════════════
    case 'pmsg': {
      if (!isAdmin(user)) return;
      if (!user.roomid) return;
      const { msg: text } = data || {};
      if (!text) return;
      toRoom(user.roomid, 'pmsg', {
        uid: user.id, topic: user.topic, pic: user.pic,
        msg: sanitize(text, 500), t: Date.now()
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // خاص جماعي لجميع المتصلين   { msg }
    // ══════════════════════════════════════════════════════════════════════════
    case 'ppmsg': {
      if (!isAdmin(user)) return;
      const { msg: text } = data || {};
      if (!text) return;
      const payload = {
        uid: user.id, topic: user.topic, pic: user.pic,
        msg: sanitize(text, 500), t: Date.now(), bid: makeBid()
      };
      users.forEach((u) => {
        const ts = io.sockets.sockets.get(u.socketId);
        if (ts) send(ts, 'ppmsg', payload);
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // إنشاء غرفة جديدة   { topic, pass, max, about, welcome, pic, c, l, vl, delete }
    // ══════════════════════════════════════════════════════════════════════════
    case 'r+': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!isAdmin(user, room)) return;
      const rName = sanitize(data.topic || data.name || '', 80);
      if (!rName) return;
      const newRoom = new Room('r_' + Date.now(), rName, data.pass || '');
      newRoom.owner   = user.lid;
      newRoom.pic     = data.pic || 'room.png';
      newRoom.about   = sanitize(data.about || '', 300);
      newRoom.welcome = sanitize(data.welcome || '', 300);
      newRoom.max     = parseInt(data.max) || 20;
      newRoom.c       = data.c || '#000000';
      rooms.set(newRoom.id, newRoom);
      io.emit('msg', { cmd: decodeCmd('r+'), data: roomListItem(newRoom) });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تعديل غرفة   { id, topic, pass, max, about, welcome, pic, c, l, vl }
    // ══════════════════════════════════════════════════════════════════════════
    case 'r^': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!isAdmin(user, room)) return;
      const editId = data.id || user.roomid;
      const targetRoom = rooms.get(editId);
      if (!targetRoom) return;
      if (data.topic)   targetRoom.name    = sanitize(data.topic, 80);
      if (data.pic)     targetRoom.pic     = data.pic;
      if (data.c)       targetRoom.c       = data.c;
      if (data.about !== undefined)   targetRoom.about   = sanitize(data.about, 300);
      if (data.welcome !== undefined) targetRoom.welcome = sanitize(data.welcome, 300);
      if (data.max)     targetRoom.max     = parseInt(data.max) || 20;
      if ('pass' in data) {
        targetRoom.pass     = data.pass ? require('bcryptjs').hashSync(data.pass, SALT_ROUNDS) : '';
        targetRoom.needpass = !!data.pass;
      }
      broadcastRoomUpdate(targetRoom);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // حذف غرفة   { id }
    // ══════════════════════════════════════════════════════════════════════════
    case 'r-': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!isAdmin(user, room)) return;
      const delId = data.id;
      const delRoom = rooms.get(delId);
      if (!delRoom) return;
      delRoom.members.forEach((_, sid) => {
        const s = io.sockets.sockets.get(sid);
        if (s) send(s, 'kick', { reason: 'room_deleted' });
      });
      rooms.delete(delId);
      io.emit('msg', { cmd: decodeCmd('r-'), data: delId });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تحكم في مايك الغرفة (cmic/v)   { id, v }
    // ══════════════════════════════════════════════════════════════════════════
    case 'v': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
      const targetRoom = data.id ? rooms.get(data.id) : room;
      if (!targetRoom) return;
      targetRoom.settings.mic = !!data.v;
      toRoom(targetRoom.id, 'settings', targetRoom.settings);
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // طلب قائمة مشرفي غرفة   { roomid }
    // ══════════════════════════════════════════════════════════════════════════
    case 'ops': {
      const { roomid } = data || {};
      const targetRoom = rooms.get(roomid || user.roomid);
      if (!targetRoom) return;
      send(socket, 'ops', buildRops(targetRoom));
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ترفيع عضو مشرفاً   { lid }
    // ══════════════════════════════════════════════════════════════════════════
    case 'op+': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
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

    // ══════════════════════════════════════════════════════════════════════════
    // سحب رتبة مشرف   { lid }
    // ══════════════════════════════════════════════════════════════════════════
    case 'op-': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
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

    // ══════════════════════════════════════════════════════════════════════════
    // تعيين لايكات   { id, likes }
    // ══════════════════════════════════════════════════════════════════════════
    case 'setLikes': {
      if (!isAdmin(user)) return;
      const target = byUID(data.id);
      if (!target) return;
      target.rep = parseInt(data.likes) || 0;
      saveAccount(target, { rep: target.rep });
      if (target.roomid) toRoom(target.roomid, 'u++', { id: target.id, rep: target.rep });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // تغيير نك نيم مستخدم   { id, nick }
    // ══════════════════════════════════════════════════════════════════════════
    case 'unick': {
      if (!isAdmin(user)) return;
      const target = byUID(data.id);
      if (!target) return;
      const newNick = sanitize(data.nick || '', 60);
      if (!newNick) return;
      target.topic = newNick;
      saveAccount(target, { topic: newNick });
      if (target.roomid) toRoom(target.roomid, 'online+', target.pub());
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // دعوة مستخدم لغرفة أخرى   { id, rid, pwd }
    // ══════════════════════════════════════════════════════════════════════════
    case 'rinvite': {
      if (!isAdmin(user)) return;
      const target = byUID(data.id);
      if (!target) return;
      const invRoom = rooms.get(data.rid);
      if (!invRoom) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'rinvite', { rid: data.rid, name: invRoom.name, pwd: data.pwd || '' });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // إضافة بنر ترحيب لمستخدم   { u2, bnr }
    // ══════════════════════════════════════════════════════════════════════════
    case 'bnr': {
      if (!isAdmin(user)) return;
      const target = byUID(data.u2);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'bnr', { bnr: data.bnr, uid: user.id });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // إزالة بنر مستخدم   { u2 }
    // ══════════════════════════════════════════════════════════════════════════
    case 'bnr-': {
      if (!isAdmin(user)) return;
      const target = byUID(data.u2);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'bnr-', { uid: user.id });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // إجراءات عامة (action)   { cmd, id, ... }
    //   cmd: like | report | kick | delpic | roomkick | ban | not | gift
    // ══════════════════════════════════════════════════════════════════════════
    case 'action': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      const { cmd: aCmd, id: tId } = data || {};
      const target = byUID(tId);

      switch (aCmd) {

        case 'like': {
          if (!target) return;
          target.rep++;
          saveAccount(target, { rep: target.rep });
          if (target.roomid) toRoom(target.roomid, 'u++', { id: target.id, rep: target.rep });
          break;
        }

        case 'report': {
          // يُسجَّل فقط (يمكن الإضافة للـ logs لاحقاً)
          console.log(`[Report] ${user.topic} → ${target?.topic || tId}`);
          break;
        }

        case 'kick': {
          if (!modOk(user, room)) return;
          if (!target) return;
          const ts = io.sockets.sockets.get(target.socketId);
          if (ts) { send(ts, 'kick', { reason: 'kicked' }); ts.disconnect(true); }
          break;
        }

        case 'delpic': {
          if (!modOk(user, room)) return;
          if (!target) return;
          target.pic = 'pic.png';
          saveAccount(target, { pic: 'pic.png' });
          if (target.roomid) toRoom(target.roomid, 'online+', target.pub());
          break;
        }

        case 'roomkick': {
          if (!room || !modOk(user, room)) return;
          if (!target) return;
          const ts = io.sockets.sockets.get(target.socketId);
          if (ts) send(ts, 'kick', { reason: 'roomkick' });
          leaveRoom(io.sockets.sockets.get(target.socketId), target);
          break;
        }

        case 'ban': {
          if (!room || !modOk(user, room)) return;
          if (!target) return;
          room.bans.push({
            id: target.id, lid: target.lid, name: target.topic,
            type: 'fp', fp: target._fp, ip: target._ip,
            expires: null, reason: '', count: 0, last: Date.now(), active: true
          });
          const ts = io.sockets.sockets.get(target.socketId);
          if (ts) { send(ts, 'kick', { reason: 'banned' }); ts.disconnect(true); }
          break;
        }

        case 'not': {
          if (!modOk(user, room)) return;
          if (!target) return;
          const ts = io.sockets.sockets.get(target.socketId);
          if (ts) send(ts, 'not', { msg: sanitize(data.msg || '', 300), uid: user.id, topic: user.topic });
          break;
        }

        case 'gift': {
          if (!target) return;
          const ts = io.sockets.sockets.get(target.socketId);
          if (ts) send(ts, 'gift', { gift: data.gift, uid: user.id, topic: user.topic, pic: user.pic });
          break;
        }
      }
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // كتم مايك مستخدم (umm)   userId
    // ══════════════════════════════════════════════════════════════════════════
    case 'umm': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
      const target = byUID(data);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'umm', { id: user.id });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // منح مايك لمستخدم (uma)   userId
    // ══════════════════════════════════════════════════════════════════════════
    case 'uma': {
      if (!user.roomid) return;
      const room = rooms.get(user.roomid);
      if (!room || !isAdmin(user, room)) return;
      const target = byUID(data);
      if (!target) return;
      // نضع المستخدم في أول خانة فارغة
      const idx = room.mic.findIndex(v => v === 0);
      if (idx === -1) return;
      room.mic[idx] = target.id;
      toRoom(room.id, 'r^', Object.assign(roomListItem(room), {
          m: room.mic, ops: room.ops
        }));
      // إبلاغ بقية أصحاب المايك لبدء WebRTC
      room.mic.forEach(uid => {
        if (typeof uid !== 'string' || uid === target.id) return;
        const peer = byUID(uid);
        if (!peer) return;
        const ps = io.sockets.sockets.get(peer.socketId);
        if (ps) send(ps, 'p2', { t: 'start', id: target.id });
      });
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
      // التحقق من صحة رمز الدولة إن وُجد
      if (data.co !== undefined) {
        const coLower = (data.co || '').toLowerCase();
        if (coLower !== '' && countryFlags[coLower] == null) return;
        data.co = data.co.toUpperCase();
      }
      Object.assign(bot, data);
      room.bots.set(data.id, bot);
      send(socket, 'cp_bots', [...room.bots.values()]);
      break;
    }

    // ── تعيين دولة مستخدم (من لوحة التحكم) ──────────────────────────────
    case 'setco': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      const coLower = (data.co || '').toLowerCase();
      if (countryFlags[coLower] == null && coLower !== '--') return;
      target.co = (data.co || '--').toUpperCase();
      saveAccount(target, { co: target.co });
      if (target.roomid) toRoom(target.roomid, 'online+', target.pub());
      break;
    }

    // ── قائمة الدول للعميل ────────────────────────────────────────────────
    case 'countries': {
      if (!modOk) return;
      send(socket, 'countries', countryFlags);
      break;
    }


    // ── بحث تاريخ الـ FP (بصمة الأجهزة)   { q, i }
    case 'fps': {
      if (!modOk) return;
      const q = (data.q || '').toLowerCase();
      const offset = parseInt(data.i) || 0;
      const results = [];
      users.forEach(u => {
        if (!q || (u._fp && u._fp.toLowerCase().includes(q))) {
          results.push({
            id: u.id, lid: u.lid, name: u.topic,
            fp: u._fp, ip: u._ip, last: u.last
          });
        }
      });
      send(socket, 'cp_fps', results.slice(offset, offset + 200));
      break;
    }

    // ── بحث في سجل الدخول   { q, i }
    case 'logins': {
      if (!modOk) return;
      const q = (data.q || '').toLowerCase();
      const offset = parseInt(data.i) || 0;
      const results = [];
      users.forEach(u => {
        const haystack = (u.topic + ' ' + u._ip + ' ' + u.lid).toLowerCase();
        if (!q || haystack.includes(q.replace(/^\*+=/,''))) {
          results.push({
            id: u.id, lid: u.lid, name: u.topic, nick: u.topic,
            ip: u._ip, ua: '', power: u.power, likes: u.rep,
            last: u.last, created: u.created
          });
        }
      });
      send(socket, 'cp_logins', { list: results.slice(offset, offset + 100), i: offset });
      break;
    }

    // ── سجل الإجراءات   { q, i }
    case 'actions': {
      if (!modOk) return;
      // يُرسل قائمة فارغة — يمكن ربطها بـ DB لاحقاً
      send(socket, 'cp_actions', { list: [], i: 0 });
      break;
    }

    // ── حذف رسالة تلقائية / ترحيب   { id }
    case 'msgsdel': {
      if (!adminOk || !room) return;
      // حذف من wall إن وجد
      room.wall = room.wall.filter(m => m.bid !== data.id && m.id !== data.id);
      send(socket, 'cp_msgs', room.wall.slice(-50));
      break;
    }

    // ── تصفية رسائل (فلتر)   { path, v }
    case 'fltrit': {
      if (!adminOk) return;
      // يُسجَّل — يمكن ربطه بنظام فلترة لاحقاً
      console.log(`[Filter] path=${data.path} v=${data.v}`);
      break;
    }

    // ── حذف فلتر   { path, id }
    case 'fltrdel': {
      if (!adminOk) return;
      // cp_fltrs: appr.js لا يعالجه
      break;
    }

    // ── حذف فلتر مُخالفة   { id }
    case 'fltrdelx': {
      if (!adminOk) return;
      break;
    }

    // ── حفظ اختصارات لوحة التحكم   { name }
    case 'shrtdel': {
      if (!adminOk) return;
      break;
    }

    // ── إضافة أيقونة مشرف   { pid, tar }
    case 'addico': {
      if (!adminOk || !room) return;
      const tar = data.tar || 'sico';
      if (tar === 'sico') {
        if (!room.sicos.includes(data.pid)) room.sicos.push(data.pid);
        toRoom(room.id, 'sico', room.sicos);
      } else if (tar === 'emo') {
        if (!room.emos.includes(data.pid)) room.emos.push(data.pid);
        toRoom(room.id, 'emos', room.emos);
      } else if (tar === 'dro3') {
        if (!room.colors.includes(data.pid)) room.colors.push(data.pid);
        toRoom(room.id, 'dro3', room.colors);
      }
      send(socket, 'ico+', data.pid);
      break;
    }

    // ── حذف أيقونة مشرف   { pid }
    case 'delico': {
      if (!adminOk || !room) return;
      const pid = data.pid || '';
      room.sicos  = room.sicos.filter(x => x !== pid);
      room.emos   = room.emos.filter(x => x !== pid);
      room.colors = room.colors.filter(x => x !== pid);
      toRoom(room.id, 'ico-', pid);
      send(socket, 'ico-', pid);
      break;
    }

    // ── حذف صورة مستخدم   { id }
    case 'delpic': {
      if (!modOk) return;
      const target = byUID(data.id);
      if (!target) return;
      target.pic = 'pic.png';
      saveAccount(target, { pic: 'pic.png' });
      if (target.roomid) toRoom(target.roomid, 'online+', target.pub());
      break;
    }

    // ── ترتيب الإيموجي   { d: [] }
    case 'emo_order': {
      if (!adminOk || !room) return;
      if (Array.isArray(data.d)) {
        room.emos = data.d;
        toRoom(room.id, 'emos', room.emos);
      }
      break;
    }

    // ── حفظ إعدادات البوتات   { bots_active, bots_minStay, bots_maxStay, ... }
    case 'bot_save': {
      if (!adminOk || !room) return;
      room.botsConfig = {
        active:   data.bots_active   === true || data.bots_active === 'true',
        minStay:  parseInt(data.bots_minStay)  || 0,
        maxStay:  parseInt(data.bots_maxStay)  || 0,
        minLeave: parseInt(data.bots_minLeave) || 0,
        maxLeave: parseInt(data.bots_maxLeave) || 0
      };
      send(socket, 'cp_bots', [...room.bots.values()]);
      break;
    }

    // ── قائمة البوتات
    case 'bots': {
      if (!adminOk || !room) return;
      send(socket, 'cp_bots', [...room.bots.values()]);
      break;
    }

    // ── هدية من لوحة التحكم   { id, gift }
    case 'gift': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'gift', { gift: data.gift, uid: user.id, topic: user.topic, pic: user.pic });
      break;
    }

    // ── إشعار لمستخدم   { id, msg }
    case 'not': {
      if (!modOk) return;
      const target = byUID(data.id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'not', { msg: sanitize(data.msg || '', 300), uid: user.id, topic: user.topic });
      break;
    }

    // ── حفظ إعدادات النطاق   { data: { domain, name, ... } }
    case 'domainsave': {
      if (!adminOk) return;
      // يُحفظ في الذاكرة — يمكن استبداله بـ DB
      if (!global.siteSettings) global.siteSettings = {};
      Object.assign(global.siteSettings, data.data || {});
      send(socket, 'ok', null); // domainsave → ok
      break;
    }

    // ── حفظ إعدادات الموقع   { data: { name, title, ... } }
    case 'sitesave': {
      if (!adminOk) return;
      if (!global.siteSettings) global.siteSettings = {};
      Object.assign(global.siteSettings, data.data || {});
      send(socket, 'ok', null); // sitesave → ok
      break;
    }

    // ── حظر بالنوع (type = fp/ip/lid أو نمط)   { type }
    case 'ban': {
      if (!modOk || !room) return;
      const entry = {
        id: data.id || '', lid: '', name: '',
        type: data.type || 'fp',
        fp: '', ip: '',
        expires: data.expires || null,
        reason: data.reason || '',
        count: 0, last: Date.now(), active: true
      };
      // ربط النمط إذا كان بصمة أو IP
      const target = data.id ? byUID(data.id) : null;
      if (target) {
        entry.lid  = target.lid;
        entry.name = target.topic;
        entry.fp   = target._fp;
        entry.ip   = target._ip;
        const ts = io.sockets.sockets.get(target.socketId);
        if (ts) { send(ts, 'kick', { reason: 'banned' }); ts.disconnect(true); }
      }
      room.bans.push(entry);
      send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ── طرد من الغرفة فقط   { id }
    case 'roomkick': {
      if (!modOk || !room) return;
      const target = byUID(data.id);
      if (!target) return;
      const targetSock = io.sockets.sockets.get(target.socketId);
      if (targetSock) {
        send(targetSock, 'kick', { reason: 'roomkick' });
        leaveRoom(targetSock, target);
      }
      break;
    }

    // ── حفظ صلاحية   { power: { name, rank, ... } }
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

    // ── حذف صلاحية   { name }
    case 'powers_del': {
      if (!adminOk || !room) return;
      room.powers = room.powers.filter(p => p.name !== data.name);
      toRoom(room.id, 'powers', room.powers);
      break;
    }

    // ── تعديل لايكات (من cp)   { id, likes }
    case 'like': {
      if (!modOk) return;
      const target = byUID(data.id);
      if (!target) return;
      target.rep = (target.rep || 0) + 1;
      saveAccount(target, { rep: target.rep });
      if (target.roomid) toRoom(target.roomid, 'u++', { id: target.id, rep: target.rep });
      break;
    }

    // ── تقرير   { id }
    case 'report': {
      if (!modOk) return;
      console.log(`[CP-Report] ${user.topic} → uid=${data.id}`);
      break;
    }

    default:
      if (process.env.DEBUG) console.log(`[CP] أمر مجهول: "${cmd}"`);
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────

/** قائمة الدول */
app.get('/api/countries', (_, res) => {
  res.json(countryFlags);
});

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
