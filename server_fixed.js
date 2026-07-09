/**
 * =============================================================
 *  Chat Server  —  متوافق 100% مع appraad.js
 * =============================================================
 *
 *  الفروقات الرئيسية عن x3_final.js التي تم إصلاحها:
 *
 *  1. أسماء الأحداث المُصحَّحة:
 *     - 'online+' / 'online-'  → 'u+' / 'u-'  (appraad.js يستمع لـ u+ وu-)
 *     - ترتيب joinRoom: rc → ulist/rlist/... → u+ → r^ → rcd
 *     - ترتيب rc2:      server → rlist → rc → ulist → rcd → ok → login
 *
 *  2. أوامر الكلاينت:
 *     - 'g'      → زائر  { username, fp, refr, r }
 *     - 'login'  → عضو   { username, password, stealth, fp, refr, r }
 *     - 'reg'    → تسجيل { username, password, fp }
 *     - 'mic'    → index | -1
 *     - 'upro'   → uid (string)
 *
 *  3. تدفق تسجيل الدخول الصحيح:
 *     Client → send('online')
 *     Server → server, rlist, emos, dro3, sico, powers, settings
 *     Client → send('g'|'login'|'reg')
 *     Server → ok, login{msg:ok,id,k,ttoken,r}
 *     Server → rc
 *     Server → rcd([[rlist,...],[emos,...],[ulist,...],[ur,[id,roomId]],[mic,...],[rops,...],[power,...]])
 *     Server → u+ (للأعضاء الآخرين), r^ (لجميع)
 *
 *  4. لماذا rcd يحمل كل البيانات (وليس إرسالها بين rc و rcd؟)
 *     appraad.js case 'rcd': systemCommandQueue = [];  ← تُمسح القائمة!
 *     combinedQueueData = commandPayload.concat([]); = commandPayload فقط
 *     → الأوامر المُرسَلة بين rc و rcd تضيع تماماً
 *     → الحل الوحيد: payload الـ rcd نفسه = [[cmd,data],...]
 *
 *  5. ترتيب العناصر داخل rcd مهم:
 *     rlist → ulist → ur (يضبط myroom) → mic (ur تُفرّغها) → rops → power
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

const path       = require('path');
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

// ─── مسار لوحة التحكم ─────────────────────────────────────────────────────────
// appraad2.js: $("#settings .cp").attr("href","cp?cp="+myid) → target="_blank" rel="opener"
// → المتصفح يطلب GET /cp?cp=MYID → يُعاد index.html
// المصادقة الأولية: سيرفر يتحقق من وجود المستخدم وصلاحية cp
// المصادقة الكاملة داخل العميل: window.opener.myid == _0x51f8c1
app.get('/cp', (req, res) => {
  const cpId = req.query.cp;
  if (!cpId) return res.redirect('/');

  const cpUser = byUID(cpId);
  if (!cpUser) return res.redirect('/');

  const indexPath = path.join(__dirname, 'public', 'index.html');
  let html;
  try { html = require('fs').readFileSync(indexPath, 'utf8'); }
  catch (e) { return res.sendFile(indexPath); }

  // ▲ إصلاح جوهري: كان السكربت يُحقَن قبل </body> (متأخر جداً). الحاسم في
  //   تنفيذ مستمعي "message" المُسجَّلين على نفس الـ target (window) هو
  //   ترتيب التسجيل فقط — وليس علم useCapture كما افتُرض سابقاً (فرق
  //   capture/bubble لا معنى له إلا عبر مسار انتشار بين عناصر أب/ابن
  //   مختلفة، وwindow هو نفسه الهدف هنا). لذا كان مستمع appraad2.js
  //   (يُسجَّل مبكراً جداً ضمن التهيئة الأساسية) يسبق مستمعنا دائماً مهما
  //   وضعنا useCapture=true، فتصل stopImmediatePropagation متأخرة جداً —
  //   بعد أن يكون appraad2.js قد نفّذ close بالفعل (window.close() + علم
  //   داخلي يُجمِّد كل معالجة لاحقة نهائياً). وهذا بالضبط سبب "التجمد" عند
  //   الفتح حين يرفض المتصفح إغلاق النافذة فعلياً فتبقى ظاهرة لكن مُجمَّدة.
  //   الحل: الحقن الآن أول شيء داخل <head> لضمان تسجيل مستمعنا قبل أي
  //   سكربت آخر بالصفحة، بصرف النظر عن مكان appraad2.js بالملف الأصلي.
  //
  // كذلك أُضيفت الخطوة الثانية (إظهار #cp وإخفاء #room بعد con) التي كانت
  // موصوفة فقط بالتعليق القديم وغير مُنفَّذة إطلاقاً في الكود الفعلي.
  const scriptLines = [
    '(function(){',
    '  if(location.pathname!=="/cp")return;',
    '  var done=false,t0=Date.now();',
    '  window.addEventListener("message",function(e){',
    '    if(!Array.isArray(e.data))return;',
    '    if(e.data[0]==="con"){',
    '      done=true;',
    // إظهار #cp وإخفاء #room فعلياً بعد اكتمال المصافحة
    '      setTimeout(function(){',
    '        try{ if(window.jQuery){ jQuery("#cp").show(); jQuery("#room").hide(); } }catch(err){}',
    '      },120);',
    // حجب close المبكر فقط قبل اكتمال con، وضمن سقف أمان 5 ثوانٍ
    // (لتفادي حجب رسائل إغلاق مشروعة لاحقة إذا تأخرت con لأي سبب)
    '    }else if(e.data[0]==="close"&&!done&&(Date.now()-t0)<5000){',
    '      e.stopImmediatePropagation();',
    '    }',
    '  });',
    '})();'
  ];
  const fixScript = '<script>' + scriptLines.join('') + '<' + '/script>';

  // مطابقة <head> بأي خصائص (مثل <head lang="ar">)، مع fallback على <html>
  // ثم بداية الملف كحل أخير
  const headTagMatch = html.match(/<head[^>]*>/i);
  if (headTagMatch) {
    html = html.replace(headTagMatch[0], headTagMatch[0] + fixScript);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/<html[^>]*>/i, m => m + fixScript);
  } else {
    html = fixScript + html;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ─── قواعد البيانات في الذاكرة ────────────────────────────────────────────────
/** socketId → User   */  const users    = new Map();
/** roomId   → Room   */  const rooms    = new Map();
/** nameKey  → AccObj */  const accounts = new Map();
/** token → session   */  const sessions = new Map();  // للحفاظ على الجلسة بعد قطع الاتصال
/** آخر 30 مستخدم سجّلوا دخولاً (للقائمة قبل تسجيل الدخول #lonline) */
const recentLogins = [];
const MAX_RECENT   = 30;

/** حائط عالمي مشترك بين جميع الغرف والمتصلين */
const globalWall = [];

// ▲ إصلاح/إضافة: case 'actions' (تبويب "الحالات" في لوحة التحكم) كان مجرد
//   stub يُرجع دائماً قائمة فارغة، رغم أن واجهة العميل (cp_actions مع دعم
//   بحث q وترقيم صفحات i) مبنية بالكامل لعرض سجل فعلي — تماماً كما هو
//   الحال في fps/logins. أضفنا سجلاً حقيقياً في الذاكرة (actionsLog).
// ▲ إصلاح إضافي (مهم جداً): appraad2.js يقرأ من كل عنصر تحديداً الحقول:
//   type, u1, u2, room, ip, created (راجع case "cp_actions" في العميل) —
//   المحاولة الأولى استخدمت أسماء حقول مختلفة كلياً (action, by, byLid, t,
//   details) فكان الجدول بأكمله يظهر "undefined" كما في الصورة المرفقة.
//   الأسماء الآن مطابقة حرفياً لما يقرأه العميل.
const actionsLog = [];
const MAX_ACTIONS_LOG = 5000;
function logAction(actor, type, target = null, extra = '') {
  const targetLabel = typeof target === 'string'
    ? target
    : (target?.topic || target?.lid || '');
  actionsLog.push({
    type,                                     // appraad: "الحاله"
    u1:      actor?.topic || actor?.lid || '', // appraad: "العضو" (من قام بالإجراء)
    u2:      targetLabel + (extra ? ` — ${extra}` : ''), // appraad: "العضو الثاني" (الهدف)
    room:    (actor?.roomid && rooms.get(actor.roomid)?.name) || '',
    ip:      actor?._ip || '',
    created: Date.now()                       // appraad: يُستخدم لحساب "الوقت"
  });
  if (actionsLog.length > MAX_ACTIONS_LOG) actionsLog.shift();
}

const SESSION_TTL = 5 * 60 * 1000; // 5 دقائق

// ─── هيكل المستخدم ────────────────────────────────────────────────────────────
class User {
  constructor(socketId, fields = {}) {
    this.socketId = socketId;   // ← يُحدَّث عند كل rc2
    this.id       = fields.id    || genId();
    this.lid      = fields.lid   || this.id;  // الزائر: lid = id
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
    this.s        = fields.s     || false;
    this.nopm     = false;
    this.nonot    = false;
    this.b        = fields.b     || '';   // أيقونة خاصة مباشرة (sico override)
    this.refr     = fields.refr  || '';
    this.created  = Date.now();
    // ▲ إضافة: تاريخ إنشاء الحساب الفعلي (يُستخدم لشرط wall_minutes) —
    //   افتراضياً يساوي created (وقت بدء الجلسة، أي للزوار)، ويُستبدَل
    //   بتاريخ الحساب الحقيقي acc.created عند تسجيل الدخول كعضو.
    this.accCreated = this.created;
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
      b:        this.b    || null,   // أيقونة خاصة — appraad.js: if(userObj.b) return "sico/"+userObj.b
      s:        this.s || null   // appraad.js: logItem.s == null → غير متخفٍ
    };
  }
}

// ─── صلاحية الإدارة الافتراضية ────────────────────────────────────────────────
// الحقول مرتبة حسب مصفوفة appraad2.js السطر 5425 مطابقةً 100%
const DEFAULT_ADMIN_POWER = {
  rank:       9999,
  name:       'adminster',
  ico:        '',
  kick:       100,        // عدد — الطرد
  delbc:      true,       // حذف الحائط
  alert:      true,       // التنبيهات
  mynick:     true,       // تغيير نك نفسه
  unick:      true,       // تغيير نكات الآخرين
  ban:        true,       // الباند
  publicmsg:  true,       // الإعلانات
  ppmsg:      true,       // إعلانات السوابر
  forcepm:    true,       // فتح الخاص
  roomowner:  true,       // إدارة الغرف
  createroom: true,       // إنشاء الغرف
  rooms:      10,         // عدد — أقصى حد للغرف الثابتة
  edituser:   true,       // إدارة العضويات
  setpower:   true,       // تعديل الصلاحيات
  upgrades:   true,       // الهدايا
  history:    true,       // كشف النكات
  cp:         true,       // لوحة التحكم
  rjoin:      true,       // دخول الغرف المغلقة
  stealth:    true,       // مخفي
  setLikes:   true,       // لايكات
  dmsg:       true,       // مسح الرسائل
  rinvite:    true,       // نقل الزوار
  mic:        true,       // سحب المايك
  cmic:       true,       // تفعيل المايك
  owner:      true        // إدارة الموقع
};

// ─── مصفوفة الصلاحيات العامة للموقع (مشتركة بين كل الغرف) ───────────────────────
// appraad2.js يستخدم _0x5a3802 كمصفوفة واحدة مشتركة — نفس المنطق هنا
const globalPowers = [{ ...DEFAULT_ADMIN_POWER }];

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
    this.l        = 0;           // appraad.js .rl  → أقل مستوى/مطلوب للدخول
    this.vl       = 0;           // appraad.js .rvl → أقل مستوى VIP مطلوب للدخول
    this.owner    = null;
    this.botsConfig = { active: false, minStay: 0, maxStay: 0, minLeave: 0, maxLeave: 0 };
    this.settings = {
      mic: true, setpower: true, ban: true, owner: true,
      calls: true, mlikes: true, bclikes: true, mreply: true, bcreply: true
    };
    this.ops      = [];          // lid[] المشرفون
    this.sicos    = [];
    this.emos     = [];
    this.colors   = [];          // dro3
    // *** appraad.js يقرأ mic كمصفوفة: mic[index] = userId|0|false
    // mic[i]=0 → فارغ، mic[i]=false → مقفول، mic[i]=string → يتحدث
    this.mic      = new Array(MAX_MIC_SLOTS).fill(0);
    this.members  = new Map();   // socketId → User
    // ▲ حذف: this.wall كانت خاصية ميتة تماماً (تُنشأ فارغة ولا يملؤها أي
    //   كود إطلاقاً) — الحائط عالمي فعلياً ويُخزَّن بالكامل في globalWall
    //   (متغيّر عام مشترك بين كل الغرف، راجع case 'bc'/'likebc'/'delbc'/
    //   'cleanbc')، فلا داعي لأي خاصية wall خاصة بكل غرفة على حدة.
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

// ▲ إصلاح/إضافة: نظام فلتر الكلمات (global.filters) كان قابلاً للإدارة
//   بالكامل من لوحة التحكم (إضافة/حذف كلمات عبر fltrit/fltrdel) لكنه لم
//   يكن مُطبَّقاً إطلاقاً — لا شيء كان يتحقق من أي رسالة أو منشور أو خاص
//   مقابل هذه القائمة، فكانت كل الكلمات المُضافة بلا أي أثر فعلي. كذلك
//   global.filtersTemp (سجل الرسائل المحظورة المعروض في تبويب الفلتر) لم
//   يكن يُملأ أبداً، وحتى زر حذفه (fltrdelx) كان stub فارغاً تماماً.
// ▲ إعادة تصميم كاملة لنظام الفلتر:
//   1) كان global.filters كائناً يُخزَّن فيه كل عنصر بمفتاح = data.path
//      المُرسل من العميل مباشرة؛ إذا أرسلت الواجهة نفس path لكل إضافة (كما
//      يبدو من الشكوى) كانت كل إضافة جديدة تستبدل السابقة عند نفس المفتاح —
//      أي "كلمة واحدة فقط لكل تصنيف تُحفظ فعلياً". الحل: مصفوفة، وكل إضافة
//      تحصل على معرّف فريد يُولَّد في السيرفر نفسه (بصرف النظر عمّا يرسله
//      العميل في path)، فتُضاف دوماً كعنصر جديد مستقل بلا حد أقصى للعدد.
//   2) ثلاث تصنيفات حقيقية الآن بدل تصنيف واحد ("ممنوع" فقط سابقاً):
//      - allow (مسموح): كلمات مستثناة صراحة؛ لها الأولوية على كل شيء آخر.
//      - watch (مراقبة): يُسمح بإرسال الرسالة لكنها تُسجَّل في سجل الفلتر.
//      - ban   (ممنوع):  يُمنع الإرسال فوراً مع تنبيه للمرسل.
//      يُستنتج التصنيف من بادئة path (قبل أول '/') إن كانت إحدى القيم
//      الثلاث أعلاه، أو من حقل type مباشرة إن أُرسل، وإلا فالافتراضي "ban"
//      (الأكثر أماناً، ومطابق للسلوك القديم الذي كان يُعامل كل شيء كحظر).
let _filtersTempSeq = 1;
/** قراءة إعداد عام من إعدادات الموقع (global.siteSettings) بقيمة افتراضية */
function siteSetting(key, def) {
  const v = (global.siteSettings || {})[key];
  return v === undefined || v === null ? def : v;
}

function getFiltersArr() {
  if (!Array.isArray(global.filters)) global.filters = [];
  return global.filters;
}
// ▲ إضافة: الاختصارات (global.shortcuts) كانت قابلة للإدارة بالكامل من لوحة
//   التحكم (إضافة/حذف عبر shrtadd/shrtdel) لكن غير مُطبَّقة إطلاقاً على أي
//   رسالة — لا appraad2.js نفسه يملك أي منطق استبدال محلي عند الكتابة
//   (تحققتُ من ذلك، لا وجود لكلمة "shortcut" في كامل الملف)، ولا كان
//   السيرفر يستبدلها أبداً. المنطق الأبسط والأكثر أماناً: إذا كان نص
//   الرسالة (بعد إزالة المسافات) يطابق تماماً اسم اختصار مُسجَّل (بغض النظر
//   عن حالة الأحرف)، يُستبدَل النص بالكامل بقيمة الاختصار قبل الإرسال.
function expandShortcut(text) {
  if (!text || !global.shortcuts) return text;
  const key = String(text).trim();
  if (!key) return text;
  const lowerKey = key.toLowerCase();
  for (const [name, value] of Object.entries(global.shortcuts)) {
    if (String(name).trim().toLowerCase() === lowerKey) return value;
  }
  return text;
}

function checkFilters(text) {
  if (!text) return null;
  const arr = getFiltersArr();
  const lower = String(text).toLowerCase();
  // "مسموح" لها الأولوية المطلقة — تُعفي النص من أي فحص لاحق
  for (const f of arr) {
    if (f.type === 'allow' && f.v && lower.includes(String(f.v).toLowerCase())) return null;
  }
  // "ممنوع" — يمنع الإرسال فوراً
  for (const f of arr) {
    if (f.type === 'ban' && f.v && lower.includes(String(f.v).toLowerCase())) {
      return { action: 'ban', v: f.v };
    }
  }
  // "مراقبة" — يُسمح بالإرسال لكن يُسجَّل
  for (const f of arr) {
    if (f.type === 'watch' && f.v && lower.includes(String(f.v).toLowerCase())) {
      return { action: 'watch', v: f.v };
    }
  }
  return null;
}
function logFilteredMessage(sender, matchedWord, fullMsg, action = 'ban') {
  if (!global.filtersTemp) global.filtersTemp = [];
  global.filtersTemp.push({
    id: _filtersTempSeq++,
    v:  matchedWord,
    action,
    msg: sanitize(String(fullMsg || ''), 500),
    topic: sender?.topic || '',
    ip: sender?._ip || ''
  });
  if (global.filtersTemp.length > 500) global.filtersTemp.shift();
}

function makeBid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '00';
}

/** سياق cpi: يُعيَّن أثناء dispatchCP لتوجيه الردود لنافذة لوحة التحكم */
let _cpiContext = null;

/** إرسال أمر مشفر لمقبس واحد */
function send(socket, cmd, data) {
  let payload = data;
  if (_cpiContext && socket.id === _cpiContext.socketId) {
    payload = { cpi: _cpiContext.cpiId, data };
  }
  socket.emit('msg', { cmd: decodeCmd(cmd), data: payload });
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

/**
 * بث قائمة الصلاحيات لأعضاء الغرفة مع تضمين DEFAULT_ADMIN_POWER للأدمن.
 *
 * لماذا؟
 *   appraad2.js — case 'powers' يُنفِّذ:
 *     _0x41c3fc = _0x3e8a07(user.power)   ← يبحث باسم الصلاحية في مصفوفة _0x5a3802
 *   إذا لم يجد اسم الصلاحية (_0x35b969.power='adminster') في المصفوفة،
 *   يُعيد كائناً فارغاً (كل القيم صفر/false) → _0x41c3fc.cp = false
 *   → _0x515435() تُرسل ['close',{}] لجميع نوافذ CP المفتوحة → تُغلقها فوراً!
 *
 * الحل: أدرج DEFAULT_ADMIN_POWER في المصفوفة المُرسَلة لمن صلاحيته الاسمية تطابقها فقط
 * حتى يجدها _0x3e8a07 ويبقى _0x41c3fc.cp = true.
 */
// ▲ إصلاح جوهري: كانت تُرسل التحديث فقط لأعضاء غرفة واحدة (غرفة المشرف
//   وقت الحفظ)، رغم أن globalPowers قائمة عامة على مستوى الموقع بالكامل لا
//   علاقة لها بأي غرفة تحديداً. النتيجة: أي عضو متصل في غرفة أخرى (أو خارج
//   أي غرفة) لا يستلم التحديث إطلاقاً إلا عند انضمامه/تبديله لغرفة لاحقاً
//   (حيث تُرسَل powers الحديثة ضمن rcd من جديد) — وهذا يُفسِّر عدم "تعرّف
//   الموقع" على صلاحية أو فلتر مُضاف حتى تغيير الغرفة. الحل: البث لكل
//   المتصلين بالموقع دون استثناء.
function broadcastPowers() {
  users.forEach((memberUser, sid) => {
    const s = io.sockets.sockets.get(sid);
    if (!s) return;
    // من اسم صلاحيته يطابق DEFAULT_ADMIN_POWER: أضفه إذا غاب عن المصفوفة (بدون أي تحقق بالرنك)
    const powersArr = memberUser.power === DEFAULT_ADMIN_POWER.name
      ? globalPowers.some(p => p.name === DEFAULT_ADMIN_POWER.name)
        ? globalPowers
        : [...globalPowers, DEFAULT_ADMIN_POWER]
      : globalPowers;
    send(s, 'powers', powersArr);
    // ▲ إضافة: بث كائن الصلاحية المحسوبة الخاص بكل عضو أيضاً (وليس فقط
    //   القائمة الخام)، حتى تنعكس الأزرار/الصلاحيات الفعلية في واجهته فوراً
    //   دون انتظار أي حدث آخر (مثل تبديل الغرفة الذي كان يُعيد حسابها).
    const memberRoom = memberUser.roomid ? rooms.get(memberUser.roomid) : null;
    send(s, 'power', buildPower(memberUser, memberRoom));
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
// ▲ إصلاح: أُضيف دعم الحظر بالبصمة (fp) بمستويات "عمق" مختلفة، مطابقةً لقوائم
//   appraad2.js (حظر / حظر عميق 1-4) القادمة عبر cp_fps و uh (كشف النكات).
//   كلما زاد العمق (depth) قصرت البادئة المطلوب تطابقها من الـ fp → حظر أوسع
//   يشمل بصمات أكثر تشابهاً جزئياً (نفس الجهاز/الشبكة تقريباً).
const BAN_DEPTH_PREFIX_LEN = [Infinity, 24, 16, 10, 6]; // [0]=مطابقة كاملة
function isBanned(room, user) {
  return room.bans.some(b => {
    if (!b.active) return false;
    if (b.lid && b.lid === user.lid) return true;
    if (b.ip  && b.ip  === user._ip) return true;
    if (b.fp) {
      const depth = Math.min(b.depth || 0, BAN_DEPTH_PREFIX_LEN.length - 1);
      const len   = BAN_DEPTH_PREFIX_LEN[depth];
      const bfp   = len === Infinity ? b.fp        : b.fp.slice(0, len);
      const ufp   = len === Infinity ? user._fp    : (user._fp || '').slice(0, len);
      if (bfp && ufp && bfp === ufp) return true;
    }
    return false;
  });
}

/** هل مشرف؟ — عبر صلاحية owner المُستخرجة بالاسم (buildPower)، بدون أي تحقق بالرنك */
function isAdmin(user, room = null) {
  if (buildPower(user, room).owner) return true;
  if (room && room.ops.includes(user.lid)) return true;
  return false;
}

/** هل مشرف أو مود؟ */
function isMod(user, room = null) {
  if (isAdmin(user, room)) return true;
  // ▲ إصلاح: كانت تشترط room (نفس علة buildPower أعلاه) فتفقد أي عضو صفة
  //   "مود" بمجرد خروجه من أي غرفة رغم امتلاكه صلاحية مسماة فعلية.
  if (user.power && globalPowers.some(p => p.name === user.power)) return true;
  return false;
}

// ▲ إضافة: فرض تسلسل الرتب على كل إجراء إداري بين عضوين (طرد/حظر/حذف
//   عضوية/تعديل بيانات/تغيير صلاحية) — لم يكن هذا التحقق موجوداً إطلاقاً،
//   فكان أي عضو له أي صلاحية إدارية (adminOk) يستطيع اتخاذ إجراء على عضو
//   آخر بصرف النظر عن رتبته، حتى لو كانت رتبة الهدف أعلى أو مساوية له.
//   القاعدة: يُمنع الإجراء إذا كانت رتبة الهدف >= رتبة الفاعل، إلا إذا كان
//   الفاعل مالكاً حقيقياً للموقع (buildPower(...).owner)، فهو يتجاوز الرتب.
function canActOnRank(actor, target, room = null) {
  if (!target) return true;               // لا يوجد هدف فعلي (مثلاً حظر بصمة بلا حساب متصل)
  if (buildPower(actor, room).owner) return true;
  const actorRank  = actor.rank  || 0;
  const targetRank = target.rank || 0;
  return actorRank > targetRank;
}

/** رتبة اسم صلاحية مُعيَّن من globalPowers (0 إذا كان الاسم فارغاً أو غير موجود) */
function rankOfPowerName(name) {
  if (!name) return 0;
  const def = globalPowers.find(p => p.name === name);
  return (def && typeof def.rank === 'number') ? def.rank : 0;
}

/** هل لدى المستخدم صلاحية محددة في power definition؟ — بالكامل عبر buildPower (بدون رنك) */
function hasPower(user, room, perm) {
  return !!buildPower(user, room)[perm];
}

/**
 * بناء payload الصلاحيات لمستخدم
 * appraad.js يقرأ: power.mic, power.setpower, power.ban,
 *   power.owner, power.cp, power.calls, power.publicmsg,
 *   power.roomowner, power.name, power.rank
 */
function buildPower(user, room) {
  // القيمة الصفرية — عضو عادي بدون أي صلاحية
  const EMPTY = {
    rank: 0, name: '', ico: '',
    kick: 0, delbc: false, alert: false, mynick: false, unick: false,
    ban: false, publicmsg: false, ppmsg: false, forcepm: false,
    roomowner: false, createroom: false, rooms: 0,
    edituser: false, setpower: false, upgrades: false, history: false,
    cp: false, rjoin: false, stealth: false, setLikes: false,
    dmsg: false, rinvite: false, mic: false, cmic: false, owner: false
  };

  // ▲ إصلاح جوهري: كان الشرط (room && user.power) يمنع العثور على تعريف
  //   صلاحية العضو كلياً بمجرد عدم وجوده داخل أي غرفة (مثلاً بعد 'rleave')
  //   رغم أن globalPowers قائمة عامة على مستوى الموقع لا علاقة لها بغرفة
  //   معينة إطلاقاً! النتيجة: أي عضو يخرج من الغرفة تنهار كل صلاحياته فوراً
  //   (upgrades, mic, cmic, setLikes, ban, kick, dmsg...) وتتعطل كل الأوامر
  //   المبنية عليها (إعلانات pmsg/ppmsg, تنبيه not, إلخ) — البحث عن الصلاحية
  //   يجب أن يعتمد على user.power فقط. أما "مالك الغرفة" (roomowner/owner
  //   عبر room.owner) فهذا وحده يبقى مرتبطاً بوجود غرفة فعلياً (منطقي).
  const def = user.power
    ? globalPowers.find(p => p.name === user.power)
    : null;

  if (!def) {
    // مالك الغرفة بدون صلاحية مسماة
    if (room && room.owner === user.lid) {
      return { ...EMPTY, name: user.power || '', rank: user.rank || 0, roomowner: true, owner: true };
    }
    return { ...EMPTY, name: user.power || '', rank: user.rank || 0 };
  }

  // أعد الكائن الكامل مع ضمان أن جميع الحقول موجودة
  return {
    rank:       typeof def.rank       === 'number'  ? def.rank       : 0,
    name:       def.name       ?? '',
    ico:        def.ico        ?? '',
    kick:       typeof def.kick       === 'number'  ? def.kick       : 0,
    delbc:      !!def.delbc,
    alert:      !!def.alert,
    mynick:     !!def.mynick,
    unick:      !!def.unick,
    ban:        !!def.ban,
    publicmsg:  !!def.publicmsg,
    ppmsg:      !!def.ppmsg,
    forcepm:    !!def.forcepm,
    roomowner:  !!(def.roomowner || (room && room.owner === user.lid)),
    createroom: !!def.createroom,
    rooms:      typeof def.rooms      === 'number'  ? def.rooms      : 0,
    edituser:   !!def.edituser,
    setpower:   !!def.setpower,
    upgrades:   !!def.upgrades,
    history:    !!def.history,
    cp:         !!def.cp,
    rjoin:      !!def.rjoin,
    stealth:    !!def.stealth,
    setLikes:   !!def.setLikes,
    dmsg:       !!def.dmsg,
    rinvite:    !!def.rinvite,
    mic:        !!def.mic,
    cmic:       !!def.cmic,
    owner:      !!def.owner
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

/** بناء رسالة نظام (بدون تهريب HTML — للرسائل المولودة من السيرفر فقط) */
function buildSysMsg(sender, htmlText, extra = {}) {
  return Object.assign({
    uid:   sender.id,
    lid:   sender.lid,
    pic:   sender.pic,
    ico:   '',
    ucol:  sender.ucol  || '',
    mcol:  '',
    topic: sender.topic,
    t:     Date.now(),
    msg:   htmlText
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
    welcome:  room.welcome || '',  // appraad.js redit() يقرأها من rcach[id].welcome
    c:        room.c       || '#000000',
    v:        !!(room.settings?.mic),  // appraad.js: destRoomObj.v == true → إظهار #mic
    max:      room.max     || 20,
    l:        room.l       || 0,   // appraad.js redit() يقرأها من rcach[id].l
    vl:       room.vl      || 0,   // appraad.js redit() يقرأها من rcach[id].vl
    online:   room.members.size,
    uco:      room.members.size        // appraad.js: roomPayloadObj.uco
  };
}

/** إضافة مستخدم لقائمة recentLogins وإبلاغ الجميع */
function addRecentLogin(user) {
  // أزل النسخة القديمة إن وجدت
  const idx = recentLogins.findIndex(u => u.id === user.id);
  if (idx !== -1) recentLogins.splice(idx, 1);
  recentLogins.push(user.pub());
  if (recentLogins.length > MAX_RECENT) recentLogins.shift();
  toAll('online+', user.pub());
}

/** إزالة مستخدم من recentLogins وإبلاغ الجميع */
function removeRecentLogin(userId) {
  const idx = recentLogins.findIndex(u => u.id === userId);
  if (idx !== -1) recentLogins.splice(idx, 1);
  toAll('online-', userId);
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
// نفس الحقول التي يستخدمها أمر إنشاء الغرفة 'r+' (topic/pass/pic/about/welcome/max/c)
function seedRooms() {
  [
    {
      id:      'main',
      name:    '( 1 ) الغرفة الرئيسية',
      pass:    '',
      pic:     'room.png',
      bg:      '',           // خلفية الغرفة (URL أو لون)
      c:       '#000000',    // لون النص
      max:     30,           // أقصى عدد أعضاء
      l:       0,            // أقل رتبة للدخول (appraad: .rl)
      vl:      0,            // أقل رتبة VIP للدخول (appraad: .rvl)
      about:   'الغرفة الرئيسية للموقع — مرحباً بجميع الأعضاء والزوار',
      welcome: 'أهلاً وسهلاً بك في الغرفة الرئيسية 🌹',
      settings: {
        mic: true, setpower: true, ban: true, owner: true,
        calls: true, mlikes: true, bclikes: true, mreply: true, bcreply: true
      }
    },
    {
      id:      'games',
      name:    '( 2 ) العاب',
      pass:    '',
      pic:     'room.png',
      bg:      '',
      c:       '#000000',
      max:     20,
      l:       0,
      vl:      0,
      about:   'غرفة مخصصة لمحبي الألعاب والتسلية',
      welcome: 'أهلاً بك في غرفة الألعاب 🎮',
      settings: {
        mic: true, setpower: true, ban: true, owner: true,
        calls: true, mlikes: true, bclikes: true, mreply: true, bcreply: true
      }
    },
    {
      id:      'music',
      name:    '( 3 ) موسيقى',
      pass:    '',
      pic:     'room.png',
      bg:      '',
      c:       '#000000',
      max:     20,
      l:       0,
      vl:      0,
      about:   'غرفة مخصصة لعشاق الموسيقى والطرب',
      welcome: 'أهلاً بك في غرفة الموسيقى 🎵',
      settings: {
        mic: true, setpower: true, ban: true, owner: true,
        calls: true, mlikes: true, bclikes: true, mreply: true, bcreply: true
      }
    }
  ].forEach(d => {
    const r      = new Room(d.id, d.name, d.pass || '');
    r.pic        = d.pic            || 'room.png';
    r.bg         = d.bg             || '';
    r.c          = d.c              || '#000000';
    r.max        = parseInt(d.max)  || 20;
    r.l          = d.l              || 0;
    r.vl         = d.vl             || 0;
    r.about      = sanitize(d.about   || '', 300);
    r.welcome    = sanitize(d.welcome || '', 300);
    r.settings   = Object.assign(r.settings, d.settings || {});
    // powers تبقى كما أنشأها Room constructor (DEFAULT_ADMIN_POWER)
    rooms.set(r.id, r);
  });
  console.log('[Server] الغرف جاهزة:', [...rooms.keys()].join(', '));
}

// ─── إنشاء حساب الأدمن الافتراضي ─────────────────────────────────────────────
function seedAdmin() {
  const adminName = process.env.ADMIN_NAME || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin123';
  const nameKey   = adminName.toLowerCase();

  // إعادة البناء دائماً — يحافظ على lid إذا كان الحساب موجوداً
  const existing  = accounts.get(nameKey);
  const lid       = existing?.lid || genId();

  accounts.set(nameKey, {
    lid,
    name:    adminName,
    pass:    bcrypt.hashSync(adminPass, SALT_ROUNDS),
    // الصلاحية الفعلية (cp/ban/owner/...) تُستخرَج بالاسم عبر buildPower وليس بالرنك
    power:   'adminster',
    // rank يُستخدم الآن فقط لاستثناء البوتات (يطابق شرط appraad2.js: rank > 0x2326 && owner)
    rank:    9999,
    pic:     existing?.pic  || 'pic.png',
    ico:     existing?.ico  || '',
    rep:     existing?.rep  || 0,
    co:      existing?.co   || '--',
    bg:      existing?.bg   || '',
    ucol:    existing?.ucol || '',
    mcol:    existing?.mcol || '',
    msg:     existing?.msg  || '',
    b:       existing?.b    || '',
    created: existing?.created || Date.now(),
    last:    Date.now()
  });

  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║       حساب الأدمن الافتراضي          ║');
  console.log(`  ║  اسم المستخدم : ${adminName.padEnd(20)}║`);
  console.log(`  ║  كلمة المرور  : ${adminPass.padEnd(20)}║`);
  console.log('  ║  الرتبة       : 9999 (الادارة)       ║');
  console.log('  ║  غيّر كلمة المرور فور تسجيل الدخول  ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
}

// ─── الانضمام لغرفة ───────────────────────────────────────────────────────────
// ▲ إصلاح: appraad2.js لا يملك أي حالة (case) لـ login.msg بقيمة
//   'needpass' أو 'wrong' أو 'banned' داخل مُستقبِل تسجيل الدخول
//   (الحالات المدعومة فقط: ok, noname, badname, usedname, badpass, wrong, reg)
//   — تحديداً 'needpass' و'banned' غير مدعومتين إطلاقاً، فكان رفض الانضمام
//   لغرفة محمية بكلمة مرور أو محظور منها لا يُظهر للعضو أي رسالة على الإطلاق.
//   الحل: استخراج التحقق في دالة منفصلة (checkJoinable) تُستخدم *قبل*
//   مغادرة الغرفة الحالية (في حالة 'rjoin')، مع إرسال إشعار 'not' (الذي
//   يفهمه العميل فعلياً) بدل الاعتماد فقط على 'login' غير المفهومة هنا.
function checkJoinable(room, user, pwd = '', force = false) {
  if (force) return { ok: true };
  if (room.needpass && room.pass) {
    if (!pwd) return { ok: false, reason: 'needpass', msg: 'هذه الغرفة تتطلب كلمة مرور' };
    if (!bcrypt.compareSync(pwd, room.pass)) {
      return { ok: false, reason: 'wrong', msg: 'كلمة المرور غير صحيحة' };
    }
  }
  if (isBanned(room, user)) {
    return { ok: false, reason: 'banned', msg: 'أنت محظور من هذه الغرفة' };
  }
  // ▲ إضافة: شرطا l (الحد الأدنى من الإعجابات) وvl (الحد الأدنى من رتبة
  //   الصلاحية VIP) لدخول الغرفة — كانا محفوظين مع بيانات الغرفة (يُضبطان
  //   عبر r+/r^ ويُعرَضان في نافذة تعديل الغرفة بالعميل) لكن غير مُطبَّقين
  //   إطلاقاً عند الانضمام الفعلي. المالك/المشرفون يتجاوزون الشرطين دائماً.
  if (!isAdmin(user, room)) {
    if (room.l  > 0 && (user.rep  || 0) < room.l)  {
      return { ok: false, reason: 'wrong', msg: `تحتاج ${room.l} إعجاب على الأقل لدخول هذه الغرفة` };
    }
    if (room.vl > 0 && (user.rank || 0) < room.vl) {
      return { ok: false, reason: 'wrong', msg: 'هذه الغرفة مخصصة لأعضاء VIP فقط' };
    }
  }
  return { ok: true };
}

// اختيار أول غرفة يمكن للعضو دخولها فعلياً (تُستخدم عند تسجيل الدخول 'g'/'login')
// ▲ إصلاح: الكود القديم كان يختار الغرفة المطلوبة (r) أو أول غرفة بالقائمة
//   دون أي تحقق من كلمة المرور أو الحظر، فيرسل السيرفر 'ok'+'login:msg=ok'
//   (أي "تم الدخول بنجاح") ثم تفشل joinRoom بصمت داخلياً — فيدخل العضو
//   فعلياً لواجهة التطبيق الرئيسية دون أن يكون في أي غرفة إطلاقاً.
function pickJoinableRoom(user, requestedId) {
  const seen = new Set();
  const candidates = [];
  if (requestedId && rooms.has(requestedId)) candidates.push(rooms.get(requestedId));
  candidates.push(...rooms.values());
  for (const r of candidates) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (r.needpass && r.pass) continue; // لا نملك كلمة مرور لتجربتها تلقائياً
    if (isBanned(r, user)) continue;
    // ▲ إضافة: تخطّي أي غرفة لا يستوفي العضو شرط l/vl فيها (نفس منطق
    //   checkJoinable)، إلا إذا كان مشرفاً/مالكاً يتجاوز الشرط دائماً.
    if (!isAdmin(user, r)) {
      if (r.l  > 0 && (user.rep  || 0) < r.l)  continue;
      if (r.vl > 0 && (user.rank || 0) < r.vl) continue;
    }
    return r;
  }
  return null;
}

function joinRoom(socket, user, room, pwd = '', force = false) {

  const check = checkJoinable(room, user, pwd, force);
  if (!check.ok) {
    send(socket, 'login', { msg: check.reason });
    send(socket, 'not', { user: 'srv', msg: check.msg });
    return false;
  }

  user.roomid = room.id;
  user.last   = Date.now();
  room.members.set(socket.id, user);

  // ─── ① rc — يُقفل systemCommandQueue في appraad.js ──────────────────────
  send(socket, 'rc', null);

  // ─── ② rcd — يحمل كل البيانات مباشرةً في الـ payload ────────────────────
  //
  // ملاحظة: rlist لا تُضمَّن هنا — العميل يحصل عليها من online/rc2
  // تضمين rlist داخل rcd يُكرّر الغرف في appraad2.js (append بدون clear)
  //
  // الترتيب الصحيح:
  //   ulist  → يملأ allUsersList (مطلوب قبل ur و rops)
  //   ur     → يضبط myroom في appraad.js (مطلوب قبل rops)
  //   mic    → يضبط مصفوفة المايك (بعد ur لأن ur تُفرّغها)
  //   rops   → يحتاج allUsersList[myid].roomid و rcach
  //   power  → الصلاحيات النهائية
  // أدرج DEFAULT_ADMIN_POWER في مصفوفة الصلاحيات لمن صلاحيته الاسمية تطابقها
  // حتى يجدها _0x3e8a07 ويبقى _0x41c3fc.cp=true ولا تُغلق نوافذ CP عبر _0x515435() — بدون أي تحقق بالرنك
  const _joinPowers = user.power === DEFAULT_ADMIN_POWER.name
    ? (globalPowers.some(p => p.name === DEFAULT_ADMIN_POWER.name)
        ? globalPowers : [...globalPowers, DEFAULT_ADMIN_POWER])
    : globalPowers;
  const _powerForUser = buildPower(user, room);
  // ترتيب rcd مهم جداً — ulist يجب أن يأتي قبل powers
  // لأن case "powers" في appraad.js يقرأ _0x123150[myid] الذي تملؤه ulist
  const rcdPayload = [
    ['emos',     room.emos.length ? room.emos : []],
    ['dro3',     room.colors],
    ['sico',     room.sicos],
    ['ulist',    [...users.values()].map(u => u.pub())],  // أولاً: يملأ _0x123150 في appraad.js
    ['powers',   _joinPowers],                            // ثانياً: يقرأ _0x123150[myid].power
    ['settings', room.settings],
    // مسح الحائط القديم قبل تحميل الجديد (ev يُنفَّذ داخل rcd queue)
    ['ev',       { data: '$("#d2bc").empty();try{bcc=0;$("#bwall").text("").parent().css("color","");}catch(e){}' }],
    ['bclist',   globalWall],
    ['ur',       [user.id, room.id]],   // يضبط myroom في appraad.js
    ['mic',      room.mic],             // بعد ur لأن ur تُفرّغ mic=[]
    ['rops',     buildRops(room)],
    ['power',    buildPower(user, room)],
  ];
  send(socket, 'rcd', rcdPayload);

  // ─── ③ إبلاغ جميع المتصلين بالدخول (u+ للقائمة العامة وليس فقط الغرفة) ──
  // ▲ إصلاح جوهري (عدّاد الحضور بالغرفة يتجمد/يتضاعف): appraad2.js يحسب
  //   عدّاد "uco" لكل غرفة تصاعدياً/تنازلياً بنفسه عند كل 'ur' واردة، معتمداً
  //   على roomid *المخزَّن سابقاً* لهذا العضو في ذاكرته المحلية لتحديد الغرفة
  //   القديمة التي يجب خصمها منها. لكن 'u+' يستبدل كامل الكائن المخزَّن لهذا
  //   العضو (بما فيها roomid الجديد أصلاً) — فإذا وصلت u+ *قبل* ur، يقرأ
  //   العميل "الغرفة القديمة" من نفس الكائن الذي استُبدل للتو، فتُصبح مطابقة
  //   للغرفة الجديدة خطأً، فيُصفّر أثر الزيادة على الغرفة الجديدة (+1 ثم -1)
  //   ولا تُخصم الغرفة القديمة الحقيقية إطلاقاً — وهذا يُفسِّر بقاء العدّاد
  //   ثابتاً عند الانتقال، وتضاعفه لاحقاً عند العودة. الحل: إرسال ur أولاً
  //   دائماً (بينما لا يزال roomid القديم الصحيح محفوظاً في ذاكرة العميل)
  //   ثم u+ بعدها لتحديث بقية البيانات (الصورة، التوقيع، الإعجابات...).
  const joinPub = user.pub();
  users.forEach(u => {
    if (u.socketId === socket.id) return;
    const s = io.sockets.sockets.get(u.socketId);
    if (s) { send(s, 'ur', [user.id, room.id]); send(s, 'u+', joinPub); }
  });
  broadcastRoomUpdate(room);

  // ─── ④ رسالة نظام: دخول عضو ───────────────────────────────────────────────
  // تُبثّ لأعضاء الغرفة الموجودين باستثناء العضو الداخل نفسه
  const joinHtml = `هذا المستخدم قد دخل <div class="fl fa fa-sign-in btn btn-primary dots roomh border corner minix" style="margin-left:-4px;padding:4px;max-width:180px;min-width:60px;" onclick="rjoin('${room.id}')">${room.name}</div>`;
  toRoom(room.id, 'msg', buildSysMsg(user, joinHtml, { mi: makeBid(), 'class': 'hmsg' }), socket.id);

  // رسالة ترحيب اختيارية
  if (room.welcome) {
    send(socket, 'msg', buildMsg(
      { id: 'srv', lid: 'srv', pic: 'room.png', ico: '', ucol: '', mcol: '', topic: 'رساله ترحيب' },
      room.welcome,
      { bid: makeBid(), mi: makeBid() }
    ));
  }

  console.log(`[Room] "${user.topic}" → "${room.name}"`);
  return true;
}

// ─── مغادرة الغرفة ────────────────────────────────────────────────────────────
// reason: 'leave' | 'kick' | 'ban' | 'roomkick' | 'logout' | 'disconnect'
function leaveRoom(socket, user, reason = 'leave') {
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
  }

  room.members.delete(socket.id);
  const prevRoomId = user.roomid;
  user.roomid = null;

  // ─── رسالة نظام: سبب المغادرة ──────────────────────────────────────────────
  const sysTexts = {
    leave:      '( هذا المستخدم غادر الغرفه )',
    kick:       'هذا المستخدم تم طرده',
    ban:        'هذا المستخدم تم حظره',
    roomkick:   'هذا المستخدم تم طرده من الغرفه',
    move:       'هذا المستخدم انتقل إلى غرفة أخرى',
    logout:     'هذا المستخدم سجل خروج',
    disconnect: 'هذا المستخدم قطع الاتصال'
  };
  const sysText = sysTexts[reason] || sysTexts.leave;
  const sysMsg  = buildSysMsg(user, sysText, { mi: makeBid(), 'class': 'hmsg' });
  // تُرسل لأعضاء الغرفة (المستخدم أُزيل من members أعلاه فلن يستقبلها عبر toRoom)
  toRoom(prevRoomId, 'msg', sysMsg);
  // إرسال رسالة المغادرة للمستخدم المغادر نفسه أيضاً
  send(socket, 'msg', sysMsg);

  // ─── الإبلاغ بالمغادرة للآخرين ─────────────────────────────────────────────
  // appraad.js case 'u-' يحذف المستخدم نهائياً من القائمة العامة (_0x123150/_0x41a1d0)
  // appraad.js case 'ur' ينقص uco للغرفة القديمة ويصفّر roomid — لكنه يتوقف فوراً
  // لو المستخدم محذوف مسبقاً من _0x123150 (أي إذا أُرسلت u- قبلها بالغلط)
  // لذلك: ur يجب أن تُرسل أولاً دائماً، وu- لا تُرسل إلا عند خروج كامل من الموقع
  // (وليس عند مجرد مغادرة/نقل غرفة — حيث يبقى المستخدم متصلاً بالموقع)
  const fullyOffline = ['logout', 'disconnect', 'kick', 'ban'].includes(reason);
  const leftId = user.id;
  users.forEach(u => {
    if (u.socketId === socket.id) return;
    const s = io.sockets.sockets.get(u.socketId);
    if (!s) return;
    send(s, 'ur', [leftId, null]);     // أولاً: تحديث uco وroomid (يحتاج المستخدم موجود في _0x123150)
    if (fullyOffline) send(s, 'u-', leftId);  // ثانياً: فقط عند خروج فعلي من الموقع
  });
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
  // userAuthHash = commandPayload.ttoken من آخر login ناجح
  socket.on('rc2', ({ token, n } = {}) => {
    let found = null;
    let fromSession = false;

    // ① البحث في المستخدمين المتصلين حالياً
    for (const u of users.values()) {
      if (u.token === token && u.socketId !== socket.id) {
        found = u;
        break;
      }
    }

    // ② إذا لم يُوجَد في المتصلين — ابحث في الجلسات المحفوظة (ما بعد قطع الاتصال)
    if (!found && token && sessions.has(token)) {
      found = sessions.get(token);
      sessions.delete(token); // استُخدمت مرة واحدة فقط
      fromSession = true;
    }

    let savedRoomId = null;

    if (found) {
      savedRoomId = found.roomid;
      const originalSocket = fromSession ? null : io.sockets.sockets.get(found.socketId);

      // ─── إصلاح تكرار المستخدم في users/ulist ──────────────────────────────
      // إذا كان السوكت الأصلي لا يزال متصلاً فعلياً (تبويب/جلسة سابقة لم تُغلق
      // بعد) يجب طرده وحذفه فوراً، وإلا يبقى للمستخدم نفسه مدخلان بنفس id/lid
      // داخل users → يصل ulist للعميل بعنصر مكرر → appraad2.js يتجاهله بصمت
      // عبر _0x133f6d (يحسبه "مُعالَج مسبقاً") فيُدرَج undefined في القائمة
      // ثم ينكسر عند .filter(... _0x4b5d22.dl ...) بخطأ "is undefined"
      if (originalSocket && originalSocket.id !== socket.id) {
        send(originalSocket, 'login', { msg: 'kicked_login' });
        leaveRoom(originalSocket, found, 'kick');
        users.delete(found.socketId);
      }

      Object.assign(user, {
        id:     found.id,
        lid:    found.lid,
        topic:  found.topic,
        msg:    found.msg   || '',
        pic:    found.pic   || 'pic.png',
        ico:    found.ico   || '',
        co:     found.co    || '--',
        bg:     found.bg    || '',
        ucol:   found.ucol  || '',
        mcol:   found.mcol  || '',
        rep:    found.rep   || 0,
        power:  found.power || '',
        rank:   found.rank  || 0,
        token:  token,
        _fp:    found._fp   || '',
        s:      found.s     || false,
        refr:   found.refr  || '',
        b:      found.b     || ''
      });
      user.socketId = socket.id;

      // نقل الغرفة دائماً الآن (سواء كان السوكت الأصلي متصلاً وتم طرده أعلاه،
      // أو منقطعاً، أو جلسة محفوظة من sessions)
      if (savedRoomId) {
        const room = rooms.get(savedRoomId);
        if (room) {
          room.members.delete(found.socketId);
          room.members.set(socket.id, user);
          user.roomid = savedRoomId;
          // ▲ إصلاح جوهري: لم يكن يُرسل أي 'ur'/'u+' لبقية المتصلين هنا
          //   إطلاقاً. عند الانقطاع، كانت 'leaveRoom' قد أرسلت بالفعل
          //   'ur:[id,null]' فأنقصت عدّاد هذه الغرفة لدى الجميع (uco--)؛
          //   لكن بما أن appraad2.js لا يقرأ 'online'/'uco' من 'r^' إطلاقاً
          //   (يتجاهله ويُبقي القيمة المخزَّنة محلياً — راجع case 'r^')، فإن
          //   العدّاد لا يعود للزيادة أبداً إلا بحدث 'ur' صريح جديد. وبما
          //   أن إعادة الاتصال (تحديث الصفحة، انقطاع واي‑فاي عابر، تبديل
          //   التطبيق على الجوال) أمر متكرر جداً، كان هذا يُفقد الغرفة عضواً
          //   واحداً من العدّاد المعروض بشكل دائم مع كل إعادة اتصال، رغم أن
          //   العضو لا يزال فعلياً داخلها (room.members الحقيقية صحيحة).
          //   الحل: بث ur ثم u+ لبقية المتصلين تماماً كما في joinRoom.
          const reconPub = user.pub();
          users.forEach(u => {
            if (u.socketId === socket.id) return;
            const s = io.sockets.sockets.get(u.socketId);
            if (s) { send(s, 'ur', [user.id, savedRoomId]); send(s, 'u+', reconPub); }
          });
          broadcastRoomUpdate(room);
        }
      }
    }

    // ─── ① ok و login ────────────────────────────────────────────────────────
    send(socket, 'ok', null);
    send(socket, 'login', {
      msg:    'ok',
      id:     user.id,
      k:      user.token,
      ttoken: user.token,
      r:      user.roomid
    });
    // window.myid مطلوب لكي تعمل نافذة لوحة التحكم (window.opener.myid)
    send(socket, 'ev', { data: 'try{window.myid=myid;}catch(e){}' });

    // ─── ② بيانات الجلسة العامة ──────────────────────────────────────────────
    send(socket, 'server',   { online: io.engine.clientsCount });
    send(socket, 'rlist',    [...rooms.values()].map(roomListItem));
    send(socket, 'emos',     []);
    send(socket, 'dro3',     []);
    send(socket, 'sico',     []);
    const _powersRoom = rooms.get(user.roomid) || [...rooms.values()][0];
    {
      const _bp = globalPowers;
      const _powersForUser = user.power === DEFAULT_ADMIN_POWER.name
        ? (_bp.some(p => p.name === DEFAULT_ADMIN_POWER.name) ? _bp : [..._bp, DEFAULT_ADMIN_POWER])
        : _bp;
      send(socket, 'powers', _powersForUser);
    }
    send(socket, 'settings', _powersRoom?.settings || {
      mlikes: true, bclikes: true, mreply: false, bcreply: false, calls: false
    });

    // ─── ③ بيانات الغرفة عبر rc / rcd ────────────────────────────────────────
    if (user.roomid) {
      const room = rooms.get(user.roomid);
      if (room) {
        send(socket, 'rc', null);

        const _rcdPowers = user.power === DEFAULT_ADMIN_POWER.name
          ? (globalPowers.some(p => p.name === DEFAULT_ADMIN_POWER.name)
              ? globalPowers
              : [...globalPowers, DEFAULT_ADMIN_POWER])
          : globalPowers;
        const rcdPayload = [
          ['emos',     room.emos.length ? room.emos : []],
          ['dro3',     room.colors],
          ['sico',     room.sicos],
          ['powers',   _rcdPowers],
          ['settings', room.settings],
          ['ev',       { data: '$("#d2bc").empty();try{bcc=0;$("#bwall").text("").parent().css("color","");}catch(e){}' }],
          // ▲ إصلاح: room.wall غير مُستخدَمة أبداً (فارغة دوماً) — منشورات
          //   الحائط الفعلية تُخزَّن في globalWall (حائط عالمي وليس لكل غرفة
          //   على حدة، كما هو موثّق في case 'bc'). كانت هذه السطر تُرسل حائطاً
          //   فارغاً للعضو عند كل إعادة اتصال (rc2) رغم امتلاء الحائط فعلياً.
          ['bclist',   globalWall],
          ['ulist',    [...users.values()].map(u => u.pub())],  // كل المتصلين
          ['ur',       [user.id, room.id]],
          ['mic',      room.mic],
          ['rops',     buildRops(room)],
          ['power',    buildPower(user, room)],
        ];
        send(socket, 'rcd', rcdPayload);

        const rc2Pub = user.pub();
        users.forEach(u => {
          if (u.socketId === socket.id) return;
          const s = io.sockets.sockets.get(u.socketId);
          if (s) { send(s, 'u+', rc2Pub); send(s, 'ur', [user.id, room.id]); }
        });
        addRecentLogin(user);
        broadcastRoomUpdate(room);
      }
    }
  });

  socket.on('disconnect', () => {
    // حفظ الجلسة إذا كان المستخدم مسجلاً (lid != id يعني عضو مسجل)
    if (user.lid && user.token) {
      const sess = {
        id: user.id, lid: user.lid, topic: user.topic, msg: user.msg,
        pic: user.pic, ico: user.ico, co: user.co, bg: user.bg,
        ucol: user.ucol, mcol: user.mcol, rep: user.rep,
        power: user.power, rank: user.rank, s: user.s,
        _fp: user._fp, refr: user.refr, b: user.b || '',
        roomid: user.roomid  // نحتفظ بـ roomid لإعادة الانضمام عند rc2
      };
      sessions.set(user.token, sess);
      setTimeout(() => sessions.delete(user.token), SESSION_TTL);
    }
    leaveRoom(socket, user, 'disconnect');
    removeRecentLogin(user.id);
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
      // القائمة قبل تسجيل الدخول (#lonline) — آخر MAX_RECENT مستخدم سجّلوا دخولاً
      send(socket, 'online', recentLogins.slice());
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // دخول كزائر  { username, fp, refr, r }
    // appraad.js: send('g', { username, fp, refr, r })
    // الترتيب الصحيح: ok → login{msg:ok} → joinRoom
    // appraad.js يبدأ معالجة الغرفة فقط بعد استقبال case 'login' msg:'ok'
    // ════════════════════════════════════════════════════════════════════════
    case 'g': {
      // ▲ إضافة: شرط allowg (السماح بدخول الزوار) — كان محفوظاً بإعدادات
      //   الموقع بلا أي تطبيق فعلي.
      if (!siteSetting('allowg', true)) {
        send(socket, 'login', { msg: 'wrong' });
        send(socket, 'not', { user: 'srv', msg: 'دخول الزوار معطّل حالياً' });
        return;
      }
      const { username, fp, refr, r } = data || {};
      const name = (username || '').trim();
      if (!name || name.length < 2) {
        send(socket, 'login', { msg: 'badname' }); return;
      }

      // تعيين بيانات الزائر
      user.topic = sanitize(name, 60);
      user.lid   = user.id;   // الزائر: lid = id (لا حساب مسجل)
      user._fp   = fp ? (typeof fp === 'object' ? JSON.stringify(fp).slice(0, 300) : String(fp)) : '';
      user.refr  = refr || '';
      user.last  = Date.now();

      // ▲ إضافة: شرط maxIP (الحد الأقصى لعدد الحسابات المتصلة من نفس
      //   الآي بي في آنٍ واحد) — كان محفوظاً بإعدادات الموقع بلا أي تطبيق.
      const maxIP = parseInt(siteSetting('maxIP', 0)) || 0;
      if (maxIP > 0 && user._ip) {
        let countSameIP = 0;
        users.forEach(u => { if (u._ip === user._ip) countSameIP++; });
        if (countSameIP >= maxIP) {
          send(socket, 'login', { msg: 'wrong' });
          send(socket, 'not', { user: 'srv', msg: 'تم الوصول للحد الأقصى من الحسابات المسموح بها لهذا الآي بي' });
          return;
        }
      }

      // تحديد الغرفة المستهدفة
      // ▲ إصلاح: كانت تُختار الغرفة المطلوبة/الأولى دون أي تحقق من كلمة
      //   المرور أو الحظر، فيُرسل 'ok'+'login:ok' ثم تفشل joinRoom بصمت.
      const targetRoom = pickJoinableRoom(user, r);
      if (!targetRoom) {
        send(socket, 'login', { msg: 'banned' });
        send(socket, 'not', { user: 'srv', msg: 'أنت محظور من كل الغرف المتاحة حالياً' });
        return;
      }

      // ① أرسل ok أولاً — appraad.js: isLoginApproved = true
      send(socket, 'ok', null);

      // ② أرسل login{msg:'ok'} — يُطلق myid و userAuthHash في appraad.js
      send(socket, 'login', {
        msg:    'ok',
        id:     user.id,
        k:      user.token,
        ttoken: user.token,
        r:      targetRoom ? targetRoom.id : null
      });
      // window.myid مطلوب لكي تعمل نافذة لوحة التحكم (window.opener.myid)
      send(socket, 'ev', { data: 'try{window.myid=myid;}catch(e){}' });

      // ③ بعد الإعلام بالنجاح نضيف المستخدم للغرفة
      if (targetRoom) joinRoom(socket, user, targetRoom, '');
      addRecentLogin(user);
      console.log(`[+] زائر: "${user.topic}" | ${user._ip}`);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تسجيل دخول عضو  { username, password, stealth, fp, refr, r }
    // appraad.js: send("login", { username, stealth, password, fp, refr, r })
    // الترتيب: ok → login{msg:ok} → joinRoom
    // ════════════════════════════════════════════════════════════════════════
    case 'login': {
      const { username, password, stealth, fp, refr, r } = data || {};
      const name = (username || '').trim();
      if (!name) { send(socket, 'login', { msg: 'badname' }); return; }

      const nameKey = name.toLowerCase();
      const acc     = accounts.get(nameKey);
      if (!acc)                                          { send(socket, 'login', { msg: 'noname' }); return; }
      if (!bcrypt.compareSync(password || '', acc.pass)) { send(socket, 'login', { msg: 'wrong'  }); return; }

      // منع تسجيل دخول مزدوج: إذا كان العضو متصلاً بسوكت آخر نقطع القديم
      const existingUser = byLID(acc.lid);
      if (existingUser && existingUser.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existingUser.socketId);
        if (oldSocket) {
          send(oldSocket, 'login', { msg: 'kicked_login' });
          leaveRoom(oldSocket, existingUser, 'kick');
        }
        users.delete(existingUser.socketId);
      }

      // استعادة بيانات الحساب
      user.lid   = acc.lid;
      user.topic = sanitize(acc.name || name, 60);
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
      user.accCreated = acc.created || Date.now();
      // ▲ إصلاح: أي عضو كان يستطيع إرسال stealth:true من العميل مباشرة
      //   ليصبح متخفياً، دون أي تحقق من صلاحية "stealth" المُعرَّفة أصلاً في
      //   نظام الصلاحيات (buildPower().stealth) — ثغرة تجاوز صلاحيات.
      user.s     = stealth === true && hasPower(user, null, 'stealth');
      user._fp   = fp ? (typeof fp === 'object' ? JSON.stringify(fp).slice(0, 300) : String(fp)) : '';
      user.refr  = refr || '';
      user.last  = Date.now();
      acc.last   = Date.now();

      // ▲ إصلاح: نفس مشكلة حالة 'g' أعلاه — استخدام pickJoinableRoom بدل
      //   اختيار الغرفة دون تحقق من كلمة المرور/الحظر.
      const targetRoom = pickJoinableRoom(user, r);
      if (!targetRoom) {
        send(socket, 'login', { msg: 'banned' });
        send(socket, 'not', { user: 'srv', msg: 'أنت محظور من كل الغرف المتاحة حالياً' });
        return;
      }

      // ① ok ② login ③ joinRoom
      send(socket, 'ok', null);
      send(socket, 'login', {
        msg:    'ok',
        id:     user.id,
        k:      user.token,
        ttoken: user.token,
        r:      targetRoom ? targetRoom.id : null
      });
      // window.myid مطلوب لكي تعمل نافذة لوحة التحكم (window.opener.myid)
      send(socket, 'ev', { data: 'try{window.myid=myid;}catch(e){}' });

      if (targetRoom) joinRoom(socket, user, targetRoom, '');
      addRecentLogin(user);
      console.log(`[+] عضو: "${user.topic}" rank=${user.rank}`);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تسجيل عضوية جديدة  { username, password, fp, refr, r }
    // appraad.js: send("reg", { username, password, fp, refr, r })
    // appraad.js case 'reg' في login → showNotificationToast("success","تم تسجيل العضويه")
    // ════════════════════════════════════════════════════════════════════════
    case 'reg': {
      // ▲ إضافة: شرط allowreg (السماح بتسجيل عضويات جديدة) — كان محفوظاً
      //   بإعدادات الموقع بلا أي تطبيق فعلي.
      if (!siteSetting('allowreg', true)) {
        send(socket, 'login', { msg: 'wrong' });
        send(socket, 'not', { user: 'srv', msg: 'التسجيل معطّل حالياً' });
        return;
      }
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
      leaveRoom(socket, user, 'logout');
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
      if (targetRoom.id === user.roomid) return; // مسبقاً بنفس الغرفة
      // ▲ إصلاح: نتحقق أولاً (checkJoinable) *قبل* مغادرة الغرفة الحالية،
      //   حتى لا يخسر العضو غرفته الحالية إذا فشل الانضمام للغرفة الجديدة
      //   (كلمة مرور خاطئة/محظور)، وحتى الآن كانت النتيجة صمتاً تاماً بلا
      //   أي رسالة بسبب عدم دعم appraad2.js لـ login.msg=needpass/banned.
      const check = checkJoinable(targetRoom, user, pwd, false);
      if (!check.ok) {
        send(socket, 'login', { msg: check.reason });
        send(socket, 'not', { user: 'srv', msg: check.msg });
        return;
      }
      leaveRoom(socket, user, 'leave');
      joinRoom(socket, user, targetRoom, pwd, true); // force=true لتفادي إعادة التحقق (تم أعلاه)
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // مغادرة الغرفة
    // ════════════════════════════════════════════════════════════════════════
    case 'rleave': {
      leaveRoom(socket, user);
      // leaveRoom يرسل ur[id,null] للجميع تلقائياً — لا حاجة لإرسال rlist
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رسالة عامة  { msg, mi, link }
    // appraad.js: Tsend() → send('msg', { msg, mi })
    //   mi = ID الرسالة المردود عليها (replyId)
    // appraad.js case 'msg' → injectBroadcastItemToUi('#d2', commandPayload)
    //   الكلاينت يضع كلاس mi{id} على كل رسالة لأغراض الحذف والإعجاب
    // ════════════════════════════════════════════════════════════════════════
    case 'msg': {
      if (!room) return;
      let { msg: text, mi: replyMi, link } = data || {};
      if (!text && !link) return;
      // ▲ إضافة: توسيع الاختصارات (راجع expandShortcut أعلاه) قبل أي فحص آخر.
      if (text) text = expandShortcut(text);
      // ▲ إضافة: شرط msgst (الحد الأدنى من الإعجابات للكتابة العامة
      //   بالغرفة) — كان محفوظاً في إعدادات الموقع بلا أي تطبيق فعلي.
      if (!adminOk) {
        const minLikes = parseInt(siteSetting('msgst', 0)) || 0;
        if (minLikes > 0 && (user.rep || 0) < minLikes) {
          send(socket, 'not', { user: 'srv', msg: `يجب أن تملك ${minLikes} إعجاب على الأقل للكتابة هنا` });
          return;
        }
      }
      // ▲ إصلاح: الفلتر يعمل على الجميع بلا أي استثناء (حتى المشرفين) كما
      //   طُلب صراحة — سابقاً كان المشرف مُستثنى بالكامل من الفحص. كذلك
      //   "ممنوع" فقط يمنع الإرسال، بينما "مراقبة" تسمح بالإرسال وتُسجِّل فقط.
      const filterHit = checkFilters(text);
      if (filterHit) {
        logFilteredMessage(user, filterHit.v, text, filterHit.action);
        if (filterHit.action === 'ban') {
          send(socket, 'not', { user: 'srv', msg: 'رسالتك تحتوي على كلمة محظورة ولم يتم إرسالها' });
          return;
        }
        // action === 'watch' → يكمل الإرسال بشكل طبيعي بعد التسجيل أعلاه
      }
      const newMi = makeBid();   // ID الرسالة الجديدة دائماً فريد
      const payload = buildMsg(user, text || '', {
        bid:  makeBid(),
        mi:   newMi,             // appraad.js: يضع كلاس .mi{newMi} على العنصر
        rmi:  replyMi || null    // المردود عليه (عرضه في الواجهة لاحقاً)
      });
      if (link)   payload.link  = sanitize(link, 500);
      if (replyMi) payload.rmi  = replyMi;
      toRoom(user.roomid, 'msg', payload);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رسالة الحائط  { msg, link, bid }
    // appraad.js: sendbc() → send('bc', { msg, link, bid })
    //   bid = ID المنشور المردود عليه عند الرد (replyId.indexOf('.bid'))
    // appraad.js case 'bc' → injectBroadcastItemToUi("#d2bc", commandPayload)
    // ════════════════════════════════════════════════════════════════════════
    case 'bc': {
      let { msg: text, link, bid: replyBid } = data || {};
      if (!text && !link) return;
      // ▲ إضافة: توسيع الاختصارات قبل أي فحص آخر.
      if (text) text = expandShortcut(text);
      // ▲ إصلاح: حُذف شرط "يجب أن يكون داخل غرفة" — الحائط عالمي (يُخزَّن في
      //   globalWall ويُبث toAll، لا علاقة له بأي غرفة تحديداً كما هو موضّح
      //   أسفل)، وكان هذا الشرط يمنع النشر بالكامل بمجرد خروج العضو من أي
      //   غرفة (مثلاً بعد 'rleave') رغم عدم وجود أي سبب منطقي لذلك.
      //
      // ▲ إضافة: شرطا wall_likes (الحد الأدنى من الإعجابات) وwall_minutes
      //   (الحد الأدنى لعمر الحساب بالدقائق) — كانا محفوظين في إعدادات
      //   الموقع (owner/sitesave) ومعروضين في لوحة التحكم، لكن غير
      //   مُطبَّقين إطلاقاً على النشر الفعلي بالحائط. المشرفون يتجاوزون
      //   هذين الشرطين دائماً.
      if (!adminOk) {
        const minLikes   = parseInt(siteSetting('wall_likes', 0))   || 0;
        const minMinutes = parseInt(siteSetting('wall_minutes', 0)) || 0;
        if (minLikes > 0 && (user.rep || 0) < minLikes) {
          send(socket, 'not', { user: 'srv', msg: `يجب أن تملك ${minLikes} إعجاب على الأقل للنشر بالحائط` });
          return;
        }
        if (minMinutes > 0) {
          const ageMinutes = (Date.now() - (user.accCreated || Date.now())) / 60000;
          if (ageMinutes < minMinutes) {
            send(socket, 'not', { user: 'srv', msg: `يجب أن يمر ${minMinutes} دقيقة على الأقل على حسابك للنشر بالحائط` });
            return;
          }
        }
      }
      const filterHit = checkFilters(text);
      if (filterHit) {
        logFilteredMessage(user, filterHit.v, text, filterHit.action);
        if (filterHit.action === 'ban') {
          send(socket, 'not', { user: 'srv', msg: 'منشورك يحتوي على كلمة محظورة ولم يتم نشره' });
          return;
        }
      }
      const newBid = makeBid();
      const payload = buildMsg(user, text || '', {
        bid:  newBid,
        bmi:  replyBid || null   // appraad2.js يقرأ bmi كـ "بي سي رد عليه"
      });
      if (link)     payload.link = sanitize(link, 500);
      if (replyBid) payload.bmi  = replyBid;
      // الحائط عالمي: يُحفظ في globalWall ويُبثّ لجميع المتصلين
      globalWall.push(payload);
      if (globalWall.length > MAX_WALL) globalWall.shift();
      toAll('bc', payload);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // رسالة خاصة  { msg, id }
    // appraad.js: pmsg() → send('pm', { msg, id })
    // appraad.js case 'pm' → openw + injectBroadcastItemToUi
    // ════════════════════════════════════════════════════════════════════════
    case 'pm': {
      let { msg: text, id: toId } = data || {};
      if (!text || !toId) return;
      const target = byUID(toId);
      if (!target) return;
      if (target.nopm) { send(socket, 'nopm', { id: toId }); return; }
      // ▲ إضافة: توسيع الاختصارات قبل أي فحص آخر.
      text = expandShortcut(text);
      // ▲ إضافة: شرط pmlikes (الحد الأدنى من الإعجابات لإرسال رسالة خاصة) —
      //   كان محفوظاً في إعدادات الموقع بلا أي تطبيق فعلي. المشرفون يتجاوزونه.
      if (!adminOk) {
        const minLikes = parseInt(siteSetting('pmlikes', 0)) || 0;
        if (minLikes > 0 && (user.rep || 0) < minLikes) {
          send(socket, 'not', { user: 'srv', msg: `يجب أن تملك ${minLikes} إعجاب على الأقل لإرسال رسالة خاصة` });
          return;
        }
      }
      const filterHit = checkFilters(text);
      if (filterHit) {
        logFilteredMessage(user, filterHit.v, text, filterHit.action);
        if (filterHit.action === 'ban') {
          send(socket, 'not', { user: 'srv', msg: 'رسالتك تحتوي على كلمة محظورة ولم يتم إرسالها' });
          return;
        }
      }
      const bid = makeBid();
      // للمستلم: pm = هوية المرسل → openw(senderId) يفتح/يُحدِّث نافذة
      // المحادثة الصحيحة باسم المرسل (appraad2.js: openw(payload.pm))
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'pm', buildMsg(user, text, { pm: user.id, bid, uid: user.id }));
      // ▲ إصلاح: appraad2.js لا يعرض الرسالة المُرسلة في نافذته محلياً
      //   إطلاقاً — دالة الإرسال (sndpm) تكتفي بإفراغ صندوق الكتابة وترسل
      //   للسيرفر فقط، بلا أي عرض محلي، معتمدة كلياً على استقبال 'pm' من
      //   السيرفر لفتح/تحديث نافذة المحادثة. كان السيرفر لا يرسل أي شيء
      //   للمُرسل نفسه، فتبقى رسالته غير ظاهرة له إطلاقاً حتى يردّ الطرف
      //   الآخر — وهذا سبب ظهور "محادثة جديدة" في كل مرة بدل استمرار نفس
      //   المحادثة. الحل: إرسال نسخة "صدى" للمُرسل أيضاً، مع pm = هوية
      //   *المستلم* (وليس هويته هو) حتى تفتح/تُحدِّث openw نفس نافذة
      //   المحادثة الصحيحة على جهازه (المفتاح #c<id> يُبنى من pm)، مع إبقاء
      //   uid = هوية الكاتب الفعلي (المُرسل) لعرض اسمه الصحيح على الفقاعة.
      send(socket, 'pm', buildMsg(user, text, { pm: target.id, bid, uid: user.id }));
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
      // ▲ إصلاح: room.wall فارغة دوماً (لا شيء يملؤها) — منشورات الحائط
      //   الحقيقية تُخزَّن في globalWall (حائط عالمي وليس محلياً لكل غرفة،
      //   كما هو موثّق في case 'bc' أدناه). كان هذا يمنع تسجيل الإعجاب
      //   فعلياً ويُرسل دائماً likes:1 مهما كان العدد الحقيقي، والبث كان
      //   محصوراً بالغرفة الحالية رغم أن الحائط يظهر لكل المستخدمين.
      const wallMsg = globalWall.find(m => m.bid === bid);
      if (wallMsg) {
        wallMsg.likes = (wallMsg.likes || 0) + 1;
        const sender = byUID(wallMsg.uid);
        if (sender && sender.id !== user.id) {
          sender.rep++;
          saveAccount(sender, { rep: sender.rep });
          toAll('u^', { id: sender.id, rep: sender.rep });
        }
      }
      toAll('bc^', { bid, likes: wallMsg ? wallMsg.likes : 1 });
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
      if (!room) return;
      const { bid } = data || {};
      if (!bid) return;
      // ▲ إصلاح: نفس مشكلة likebc أعلاه — room.wall فارغة دوماً، لذا كانت
      //   wallMsg تُعطى undefined دائماً، فيفشل شرط isAuthor حتى لصاحب
      //   المنشور الحقيقي، والحذف (حتى لو مُرَّ عبر صلاحية المشرف) لا يحذف
      //   شيئاً فعلياً من globalWall (المصدر الحقيقي المُرسَل عند bclist)،
      //   فيعود المنشور "المحذوف" للظهور عند أي انضمام/إعادة اتصال لاحقة.
      const wallMsg = globalWall.find(m => m.bid === bid);
      const isAuthor = wallMsg && wallMsg.lid === user.lid;
      if (!adminOk && !hasPower(user, room, 'delbc') && !isAuthor) return;
      const idx = globalWall.findIndex(m => m.bid === bid);
      if (idx !== -1) globalWall.splice(idx, 1);
      toAll('delbc', { bid });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // حذف رسالة عامة  { mi, topic } أو { bid } أو string
    // appraad.js: send('dmsg', { mi, topic })  ← onclick مباشر في الواجهة
    // appraad.js case 'dmsg' → $(".mi"+commandPayload).remove()
    // ════════════════════════════════════════════════════════════════════════
    case 'delmsg':
    case 'dmsg': {
      // ▲ إصلاح: يوجد صلاحية "dmsg" مُعرَّفة أصلاً في نظام الصلاحيات ولم
      //   تكن تُفحَص إطلاقاً (adminOk فقط).
      if (!room || (!adminOk && !hasPower(user, room, 'dmsg'))) return;
      // appraad.js يرسل { mi, topic } أو string
      const msgId = (typeof data === 'object') ? (data?.mi || data?.bid) : data;
      if (!msgId) return;
      toRoom(user.roomid, 'dmsg', msgId);
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
      // ▲ إصلاح: صلاحية "mic" في نظام الصلاحيات تعني تحديداً "التحكم بمايك
      //   الغير" (appraad2.js يُظهر أزرار uml/umm/uma بناءً عليها لا adminOk).
      if (!room || (!adminOk && !hasPower(user, room, 'mic'))) return;
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
    // قفل مايك مستخدم بالقوة  userId (string)  [مشرف]
    // appraad.js: send("umm", targetUserId)
    // يقفل خانة المايك (false) دون إخراج المستخدم منها
    // ════════════════════════════════════════════════════════════════════════
    case 'umm': {
      if (!room || (!adminOk && !hasPower(user, room, 'mic'))) return;
      const targetId = typeof data === 'string' ? data : (data?.id || '');
      const mi = room.mic.indexOf(targetId);
      if (mi !== -1) {
        room.mic[mi] = false; // false = خانة مقفولة
        broadcastRoomUpdate(room);
        // إبلاغ المستخدم بإيقاف p2p
        const t = byUID(targetId);
        if (t) {
          const ts = io.sockets.sockets.get(t.socketId);
          if (ts) send(ts, 'p2', { t: 'x', id: user.id, dir: 0 });
        }
      }
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تفعيل مايك لمستخدم قسرياً  userId (string)  [مشرف]
    // appraad.js: send("uma", targetUserId)
    // يضع المستخدم في أول خانة فارغة أو مقفولة
    // ════════════════════════════════════════════════════════════════════════
    case 'uma': {
      if (!room || (!adminOk && !hasPower(user, room, 'mic'))) return;
      const targetId = typeof data === 'string' ? data : (data?.id || '');
      // لا تضع إذا كان موجوداً مسبقاً
      if (room.mic.indexOf(targetId) !== -1) return;
      const idx = room.mic.findIndex(v => v === 0 || v === false);
      if (idx === -1) return;
      room.mic[idx] = targetId;
      broadcastRoomUpdate(room);
      // إبلاغ المايكات الأخرى ببدء WebRTC مع هذا المستخدم
      room.mic.forEach((uid, i) => {
        if (i === idx || typeof uid !== 'string') return;
        const peer = byUID(uid);
        if (!peer) return;
        const ps = io.sockets.sockets.get(peer.socketId);
        if (ps) send(ps, 'p2', { t: 'start', id: targetId, dir: 0 });
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // أوامر الإجراءات على الأعضاء  { cmd, id, ... }
    // appraad.js: send("action", { cmd, id, ... })
    //   cmd: like | report | kick | delpic | roomkick | ban | not | gift
    // يُعيد التوجيه لنفس dispatchCP مع بناء data صحيح
    // ════════════════════════════════════════════════════════════════════════
    case 'action': {
      const { cmd: actionCmd, ...actionRest } = data || {};
      if (!actionCmd) return;
      dispatchCP(socket, user, room, { cmd: actionCmd, ...actionRest }, adminOk, modOk);
      break;
    }
    // ════════════════════════════════════════════════════════════════════════
    case 'micstat': {
      if (!room || (!adminOk && !hasPower(user, room, 'mic'))) return;
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
      // ▲ إضافة: شرطا calls (تفعيل ميزة المكالمات) وcallsLike (الحد الأدنى
      //   من الإعجابات) — كانا محفوظين بإعدادات الموقع بلا أي تطبيق فعلي.
      //   يُطبَّقان فقط عند بدء مكالمة جديدة (t='call')، وليس على بقية
      //   إشارات نفس المكالمة القائمة أصلاً (answer/reject/signal/x) حتى لا
      //   تنكسر مكالمة بدأت بشكل صحيح بسبب تغيّر لاحق بالإعدادات.
      if (callT === 'call' && !adminOk) {
        if (!siteSetting('calls', true)) {
          send(socket, 'not', { user: 'srv', msg: 'ميزة المكالمات معطّلة حالياً' });
          return;
        }
        const minLikes = parseInt(siteSetting('callsLike', 0)) || 0;
        if (minLikes > 0 && (user.rep || 0) < minLikes) {
          send(socket, 'not', { user: 'srv', msg: `يجب أن تملك ${minLikes} إعجاب على الأقل لاستخدام المكالمات` });
          return;
        }
      }
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
      // ▲ إصلاح: حُذف شرط "يجب أن يكون داخل غرفة" — تعديل البروفايل الشخصي
      //   (الاسم/التوقيع/الألوان) لا علاقة له بوجود العضو في غرفة من عدمه
      //   (نفس علة bc السابقة).
      // ▲ إضافة: شرط proflikes (الحد الأدنى من الإعجابات لتعديل البروفايل)
      //   — كان محفوظاً بإعدادات الموقع بلا أي تطبيق فعلي. المشرفون يتجاوزونه.
      if (!adminOk) {
        const minLikes = parseInt(siteSetting('proflikes', 0)) || 0;
        if (minLikes > 0 && (user.rep || 0) < minLikes) {
          send(socket, 'not', { user: 'srv', msg: `يجب أن تملك ${minLikes} إعجاب على الأقل لتعديل البروفايل` });
          return;
        }
      }
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
      if (user.roomid) toRoom(user.roomid, 'u^', user.pub());
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تغيير الصورة الشخصية  { pic }
    // appraad.js: sendpic() → send('setpic', { pic })
    // ════════════════════════════════════════════════════════════════════════
    case 'setpic': {
      // ▲ إصلاح: حُذف شرط "يجب أن يكون داخل غرفة" (نفس علة bc/setprofile).
      // ▲ إضافة: شرط piclikes (الحد الأدنى من الإعجابات لتغيير الصورة).
      if (!adminOk) {
        const minLikes = parseInt(siteSetting('piclikes', 0)) || 0;
        if (minLikes > 0 && (user.rep || 0) < minLikes) {
          send(socket, 'not', { user: 'srv', msg: `يجب أن تملك ${minLikes} إعجاب على الأقل لتغيير الصورة` });
          return;
        }
      }
      const { pic } = data || {};
      if (!pic) return;
      user.pic = sanitize(pic, 200);
      saveAccount(user, { pic: user.pic });
      if (user.roomid) toRoom(user.roomid, 'u^', user.pub());
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
    // إعلان عام لجميع المتصلين  { msg }  [مشرف فقط]
    // appraad.js: pmsg() → send('pmsg', { msg })
    // appraad.js case 'pmsg' → إظهار لافتة إعلانية
    // ملاحظة: يُرسَل لكل المتصلين (داخل وخارج الغرف) لا للغرفة فقط
    // ════════════════════════════════════════════════════════════════════════
    case 'pmsg': {
      if (!adminOk && !hasPower(user, room, 'publicmsg')) return;
      const { msg: text } = data || {};
      if (!text) return;
      const pmsgPayload = {
        uid:   user.id,
        topic: user.topic,
        pic:   user.pic,
        msg:   sanitize(text, 500),
        t:     Date.now(),
        bid:   makeBid()
      };
      toAll('pmsg', pmsgPayload);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // خاص جماعي لجميع المتصلين  { msg }  [مشرف فقط]
    // appraad.js case 'ppmsg' → يعرضها كرسالة في #d2
    // ════════════════════════════════════════════════════════════════════════
    case 'ppmsg': {
      if (!adminOk && !hasPower(user, room, 'ppmsg')) return;
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
    // بحث تاريخ مستخدم  userId (string)  [مشرف فقط]
    // appraad.js: send('uh', targetUserId)  ← يرسل user.id وليس lid
    // appraad.js case 'uh' → جدول: العضو / الزخرفة / IP / الوقت / FP
    // ════════════════════════════════════════════════════════════════════════
    case 'uh': {
      if (!adminOk && !hasPower(user, room, 'history')) return;
      // data هو userId (string) من appraad.js — send('uh', targetUserId)
      const targetId  = typeof data === 'string' ? data : (data?.id || '');
      const foundUser = byUID(targetId);
      const searchLid = foundUser ? foundUser.lid : targetId;
      const history   = [];
      const now       = Date.now();
      // ▲ إصلاح: كان يعرض u.lid (معرّف تقني/بصمة، أرقام وحروف غير مقروءة —
      //   كما في الصورة المرفقة) في عمود "العضو" بدل اسم المستخدم الفعلي
      //   الذي سجّل به الدخول. اسم المستخدم الحقيقي مخزَّن في سجل الحساب
      //   (accounts) بالحقل name، وليس في lid (وهو معرّف ربط داخلي فقط).
      const findAccName = (lid) => {
        for (const [, acc] of accounts) { if (acc.lid === lid) return acc.name || ''; }
        return '';
      };
      users.forEach(u => {
        if (u.lid === searchLid || u.id === targetId) {
          history.push({
            u:   findAccName(u.lid) || u.topic || u.lid,  // appraad: العضو (اسم تسجيل الدخول الفعلي)
            t:   u.topic,                        // appraad: الزخرفه (decoration)
            _ip: u._ip  || '',
            _fp: u._fp  || '',
            c:   now - (u.created || now)        // appraad: الوقت (session age in ms → .time())
          });
        }
      });
      // البحث في الحسابات المسجّلة أيضاً (مستخدم أوفلاين)
      if (history.length === 0 && searchLid) {
        for (const [, acc] of accounts) {
          if (acc.lid === searchLid) {
            history.push({
              u:   acc.name || searchLid,
              t:   acc.name || searchLid,
              _ip: '',
              _fp: '',
              c:   now - (acc.last || now)
            });
            break;
          }
        }
      }
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
    // إنشاء غرفة جديدة  { topic/name, pass, max, l, vl, about, welcome, pic, c }
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
      newRoom.l       = parseInt(data?.l)      || 0;
      newRoom.vl      = parseInt(data?.vl)     || 0;
      newRoom.c       = data?.c       || '#000000';
      rooms.set(newRoom.id, newRoom);
      toAll('r+', roomListItem(newRoom));
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تعديل غرفة  { id, topic, pass, max, l, vl, about, welcome, pic, c }
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
      if (data?.l        !== undefined) targetRoom.l  = parseInt(data.l)  || 0;
      if (data?.vl       !== undefined) targetRoom.vl = parseInt(data.vl) || 0;
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
      // ▲ إصلاح: كان يرسل 'kick' الذي لا يملك appraad2.js أي معالج له
      //   إطلاقاً، ولا يُعيد نقل أعضاء الغرفة المحذوفة لأي مكان — فيبقون
      //   بواجهة تُشير لغرفة لم تعد موجودة على السيرفر (حالة غير متسقة).
      //   الحل: نقلهم فوراً لأول غرفة متاحة (نفس أسلوب rinvite) مع إشعار.
      const affected = [...delRoom.members.values()];
      rooms.delete(delId);
      toAll('r-', { id: delId });
      const fallback = [...rooms.values()][0] || null;
      affected.forEach(m => {
        const s = io.sockets.sockets.get(m.socketId);
        if (!s) return;
        m.roomid = null; // الغرفة القديمة محذوفة أصلاً، لا حاجة لمعالجة مغادرة كاملة
        if (fallback) {
          joinRoom(s, m, fallback, '', true);
          send(s, 'not', { user: 'srv', msg: 'تم حذف الغرفة، تم نقلك لغرفة أخرى' });
        } else {
          send(s, 'not', { user: 'srv', msg: 'تم حذف الغرفة' });
        }
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تحكم مايك الغرفة  { id, v }  [مشرف]
    // appraad.js: send("v", { id, v })  لتفعيل/تعطيل المايك في غرفة
    // ════════════════════════════════════════════════════════════════════════
    case 'v': {
      // ▲ إصلاح: صلاحية "cmic" مُعرَّفة تحديداً لهذا الإجراء (تفعيل/تعطيل
      //   مايك الغرفة بالكامل) ولم تكن تُفحَص إطلاقاً.
      if (!adminOk && !hasPower(user, room, 'cmic')) return;
      const targetRoom = data?.id ? rooms.get(data.id) : room;
      if (!targetRoom) return;
      targetRoom.settings.mic = !!data?.v;
      toRoom(targetRoom.id, 'settings', targetRoom.settings);
      broadcastRoomUpdate(targetRoom);
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // بيانات لوحة التحكم  [windowCpi, [cmd, data]]
    // appraad.js: send("cpi", [senderWindow.cpi, [originalCmd, originalData]])
    // الفكرة: نافذة cp ترسل أوامرها عبر window.opener.postMessage → opener يعيد
    // إرسالها للسيرفر كـ cpi → السيرفر يعالجها ويرد بـ { cpi: id, data: ... }
    // → opener يوجّه الرد للنافذة المناسبة عبر _0x5d8244[cpiId].postMessage
    // ════════════════════════════════════════════════════════════════════════
    case 'cpi': {
      if (!adminOk) return;
      if (!Array.isArray(data) || data.length < 2) return;
      const [cpiId, innerMsg] = data;
      if (!Array.isArray(innerMsg) || !cpiId) return;
      const [innerCmd, innerData] = innerMsg;
      if (!innerCmd) return;
      // الـ cp popup يرسل [cmdName, cmdData] مباشرةً (مثل 'bans','kick','ban'...)
      // نبني كائن data صحيح لـ dispatchCP: { cmd: innerCmd, ...innerData }
      const cpiData = typeof innerData === 'object' && innerData !== null
        ? { cmd: innerCmd, ...innerData }
        : { cmd: innerCmd };
      // تعيين السياق: كل send(socket,...) داخل dispatchCP سيُغلَّف بـ {cpi, data}
      _cpiContext = { socketId: socket.id, cpiId };
      try { dispatchCP(socket, user, room, cpiData, adminOk, modOk); }
      finally { _cpiContext = null; }
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
      // ▲ إضافة: شرط fileslikes (الحد الأدنى من الإعجابات لإرسال ملف/صورة).
      if (!adminOk) {
        const minLikes = parseInt(siteSetting('fileslikes', 0)) || 0;
        if (minLikes > 0 && (user.rep || 0) < minLikes) {
          send(socket, 'not', { user: 'srv', msg: `يجب أن تملك ${minLikes} إعجاب على الأقل لإرسال ملف` });
          return;
        }
      }
      // ▲ إصلاح جوهري: appraad2.js لا يملك أي "case 'file'" في مُستقبِل
      //   الأوامر إطلاقاً — كان الملف/الصورة يختفي بصمت تماماً عند المستلم
      //   دائماً. appraad2.js يستخدم نفس معرّف المحادثة (pm) لكل من النصوص
      //   والملفات (نفس حاوية #d2<id>)، فالتسليم الصحيح هو عبر حدث 'pm'
      //   نفسه (بحقل link) بدل حدث 'file' منفصل غير مفهوم — تماماً كإصلاح
      //   PM السابق: صدى للمرسل بـ pm=هوية المستلم، ونسخة للمستلم بـ
      //   pm=هوية المرسل.
      const bid = makeBid();
      const ts  = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'pm', buildMsg(user, '', { pm: user.id, link: sanitize(link, 500), bid, uid: user.id }));
      send(socket, 'pm', buildMsg(user, '', { pm: target.id, link: sanitize(link, 500), bid, uid: user.id }));
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تغيير النك نيم  { id, nick }  [مشرف أو صاحبه]
    // appraad.js: send("unick", { id, nick })
    // appraad.js case 'u^' → يحدث الواجهة
    // ════════════════════════════════════════════════════════════════════════
    case 'unick': {
      const { id: unickId, nick } = data || {};
      const target = byUID(unickId);
      if (!target) return;
      // ▲ إصلاح: كان يسمح فقط لصاحب الاسم نفسه أو للمشرف الكامل (adminOk)،
      //   متجاهلاً صلاحيتي "mynick" (تعديل اسمي) و"unick" (تعديل اسم الغير)
      //   المُعرَّفتين أصلاً في نظام الصلاحيات.
      const isSelf = target.id === user.id;
      if (isSelf) {
        if (!adminOk && !hasPower(user, room, 'mynick')) return;
      } else {
        if (!adminOk && !hasPower(user, room, 'unick')) return;
      }
      target.topic = sanitize(nick || '', 60);
      saveAccount(target, { topic: target.topic });
      if (target.roomid) toRoom(target.roomid, 'u^', target.pub());
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // دعوة انتقال لغرفة  { id, rid, pwd }  [مشرف]
    // appraad.js: send("rinvite", { id, rid, pwd })
    // appraad.js case 'rinvite' في الكلاينت المدعو → rjoin تلقائي
    // ════════════════════════════════════════════════════════════════════════
    case 'rinvite': {
      // ▲ إصلاح: يوجد صلاحية "rinvite" مُعرَّفة أصلاً في نظام الصلاحيات
      //   ولم تكن تُفحَص إطلاقاً (adminOk فقط).
      if (!adminOk && !hasPower(user, room, 'rinvite')) return;
      const { id: invId, rid, pwd } = data || {};
      const target = byUID(invId) || byLID(invId);
      if (!target) return;
      const targetRoom = rooms.get(rid);
      if (!targetRoom) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (!ts) return;
      // نقل قسري: رسالة الغرفة القديمة تأتي من leaveRoom، رسالة الدخول للغرفة الجديدة من joinRoom
      leaveRoom(ts, target, 'move');
      joinRoom(ts, target, targetRoom, pwd || '', true);
      // تنبيه الشخص المنقول بفورمات not الصحيح (appraad2.js: not.user → allUsersList)
      send(ts, 'not', { user: user.id, msg: 'تم نقلك' });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // بنر ترحيبي  { u2, bnr }
    // appraad.js: send('bnr', { u2, bnr })
    // ════════════════════════════════════════════════════════════════════════
    case 'bnr': {
      if (!adminOk) return;
      const { u2, bnr: bnrFile } = data || {};
      const target = byUID(u2);
      if (!target || !bnrFile) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'bnr', { bnr: sanitize(bnrFile, 200) });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // إزالة بنر  { u2 }
    // appraad.js: send('bnr-', { u2 })
    // ════════════════════════════════════════════════════════════════════════
    case 'bnr-': {
      if (!adminOk) return;
      const { u2: u2id } = data || {};
      const target = byUID(u2id);
      if (!target) return;
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'bnr-', {});
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تعديل لايكات مستخدم  { id, likes }
    // appraad.js: send("setLikes", { id, likes })
    // ════════════════════════════════════════════════════════════════════════
    case 'setLikes': {
      if (!adminOk) return;
      const target = byUID(data?.id);
      if (!target) return;
      target.rep = parseInt(data.likes) || 0;
      saveAccount(target, { rep: target.rep });
      if (target.roomid) toRoom(target.roomid, 'u^', { id: target.id, rep: target.rep });
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // حذف صورة مستخدم  { id }  [مشرف]
    // appraad.js: send('udelpic', { id })
    // ════════════════════════════════════════════════════════════════════════
    case 'udelpic': {
      if (!adminOk) return;
      const target = byUID(data?.id);
      if (!target) return;
      target.pic = 'pic.png';
      saveAccount(target, { pic: 'pic.png' });
      if (target.roomid) toRoom(target.roomid, 'u^', target.pub());
      break;
    }

    // ════════════════════════════════════════════════════════════════════════
    // تنفيذ كود JS عن بُعد  { data }  [owner فقط]
    // appraad.js case 'ev' → eval(commandPayload.data)
    // ════════════════════════════════════════════════════════════════════════
    case 'ev': {
      if (!buildPower(user, room).owner) return;
      const { id: evTarget, data: evCode } = data || {};
      if (!evCode) return;
      if (evTarget) {
        const target = byUID(evTarget);
        if (!target) return;
        const ts = io.sockets.sockets.get(target.socketId);
        if (ts) send(ts, 'ev', { data: evCode });
      } else {
        users.forEach(u => {
          const ts = io.sockets.sockets.get(u.socketId);
          if (ts) send(ts, 'ev', { data: evCode });
        });
      }
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
      // ▲ إصلاح: modOk فضفاضة جداً — تصدق على أي صاحب صلاحية مسماة (حتى لو
      //   كانت صلاحيته "إعجاب فقط" مثلاً)! الصلاحية الصحيحة المخصصة لهذا
      //   الإجراء هي "kick" تحديداً (appraad2.js يُظهر زر الطرد بناءً عليها).
      if ((!adminOk && !hasPower(user, room, 'kick')) || !room) return;
      const target = byUID(data.id);
      if (!target) return;
      // ▲ إضافة: منع طرد عضو برتبة أعلى أو مساوية (تسلسل الرتب)
      if (!canActOnRank(user, target, room)) return;
      logAction(user, 'kick', target);
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) {
        leaveRoom(ts, target, 'kick');
        removeRecentLogin(target.id);
        send(ts, 'not', { user: user.id, msg: 'تم طردك' });
        send(ts, 'close', {});
        setTimeout(() => { try { ts.disconnect(true); } catch (_) {} }, 1200);
      }
      break;
    }

    // ── حظر مستخدم  { id?, type?, expires, reason }
    // appraad2.js يستخدم هذا الأمر بطريقتين مختلفتين:
    //   1) من قائمة "action.cmd=ban"→dispatchCP({cmd:'ban', id}) — حظر عضو بعينه.
    //   2) من جداول "كشف النكات/بصمات الزوار" (uh/cp_fps) عبر
    //      cp_fps_do → send('cp', { cmd:'ban', type: '<بادئة>=<fp>' })
    //      حيث type = قيمة البصمة fp نفسها، مع بادئة اختيارية من نجوم متبوعة
    //      بـ '=' تمثّل "عمق" الحظر (حظر عميق 1‑4)، مثال: "**=abcdef123".
    // ▲ إصلاح: سابقاً كان type يُخزَّن كما هو في حقل غير مُستخدَم في isBanned
    //   إطلاقاً (لا fp ولا ip)، فكانت هذه الحظورات لا تمنع أحداً أبداً.
    //   الآن: نفكّ بادئة العمق، ونخزّن قيمة البصمة الحقيقية في fp، ونطرد فوراً
    //   أي مستخدمين متصلين حالياً تُطابق بصمتهم (حسب مستوى العمق).
    case 'ban': {
      // ▲ إصلاح: نفس ملاحظة kick أعلاه — الصلاحية الصحيحة هي "ban" تحديداً.
      if ((!adminOk && !hasPower(user, room, 'ban')) || !room) return;
      const target = data.id ? byUID(data.id) : null;
      // ▲ إضافة: منع حظر عضو برتبة أعلى أو مساوية (تسلسل الرتب) — لا ينطبق
      //   على حظر البصمة المباشر (لا يوجد target محدَّد في تلك الحالة).
      if (target && !canActOnRank(user, target, room)) return;

      // فكّ بادئة الحظر العميق: '*='..'****=' → depth 1..4
      let fpValue = '', depth = 0;
      if (typeof data.type === 'string' && data.type) {
        const m = data.type.match(/^(\*{1,4})=(.+)$/);
        if (m) { depth = m[1].length; fpValue = m[2]; }
        else   { fpValue = data.type; }
      }

      const entry = {
        id: data.id || '', lid: '', name: '',
        type: data.type || '',
        fp: target?._fp || fpValue || '',
        ip: target?._ip || '',
        depth,
        expires: data.expires || null, reason: data.reason || '',
        count: 0, last: Date.now(), active: true
      };

      if (target) {
        entry.lid  = target.lid;
        entry.name = target.topic;
        const ts = io.sockets.sockets.get(target.socketId);
        if (ts) {
          leaveRoom(ts, target, 'ban');
          removeRecentLogin(target.id);
          send(ts, 'not', { user: user.id, msg: 'تم حظرك' });
          send(ts, 'close', {});
          setTimeout(() => { try { ts.disconnect(true); } catch (_) {} }, 1200);
        }
      } else if (entry.fp) {
        // حظر بالبصمة (لا يوجد id): اطرد فوراً أي متصلين حالياً تطابق بصمتهم
        const len = [Infinity, 24, 16, 10, 6][Math.min(depth, 4)];
        const bfp = len === Infinity ? entry.fp : entry.fp.slice(0, len);
        users.forEach(u => {
          const ufp = len === Infinity ? u._fp : (u._fp || '').slice(0, len);
          if (!ufp || bfp !== ufp) return;
          const ts = io.sockets.sockets.get(u.socketId);
          if (!ts) return;
          leaveRoom(ts, u, 'ban');
          removeRecentLogin(u.id);
          send(ts, 'not', { user: user.id, msg: 'تم حظرك' });
          send(ts, 'close', {});
          setTimeout(() => { try { ts.disconnect(true); } catch (_) {} }, 1200);
        });
      }

      room.bans.push(entry);
      logAction(user, 'ban', target || `بصمة: ${entry.fp}`);
      send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ── رفع حظر  { id? , type? }
    // ▲ إصلاح: عند رفع حظر بصمة (المسار الثاني أعلاه)، يرسل appraad2.js
    //   الحقل type (قيمة البصمة كما أُرسلت وقت الحظر) وليس id، فكانت المقارنة
    //   القديمة (b.id === data.id) تفشل دائماً في هذه الحالة تحديداً.
    case 'aban': {
      if ((!adminOk && !hasPower(user, room, 'ban')) || !room) return;
      const key = data.id || data.type || '';
      if (!key) return;
      logAction(user, 'aban', key);
      room.bans = room.bans.map(b =>
        (b.id && b.id === key) || (b.type && b.type === key)
          ? { ...b, active: false } : b
      );
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
      // ▲ إضافة: منع تعديل كلمة مرور عضو برتبة أعلى أو مساوية
      if (!canActOnRank(user, target, room)) return;
      logAction(user, 'pwd', target);
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
      // ▲ إصلاح: يوجد صلاحية "setLikes" مُعرَّفة أصلاً في نظام الصلاحيات
      //   لهذا الإجراء تحديداً ولم تكن تُفحَص إطلاقاً (adminOk فقط).
      if (!adminOk && !hasPower(user, room, 'setLikes')) return;
      const target = byUID(data.id);
      if (!target) return;
      target.rep = parseInt(data.likes) || 0;
      saveAccount(target, { rep: target.rep });
      if (target.roomid) toRoom(target.roomid, 'u^', { id: target.id, rep: target.rep });
      break;
    }

    // ── منح صلاحية  { id, power, days }
    // appraad2.js يُرسل id = user.lid (من لوحة المستخدمين والاشتراكات)
    // أو id = user.id الديناميكي (من قائمة الأعضاء المتصلين في cp_logins)
    // → نحاول byUID أولاً (id الديناميكي) ثم byLID (lid الحساب)
    case 'setpower': {
      if (!adminOk) return;
      let target = byUID(data.id) || byLID(data.id);

      // ▲ إضافة: فرض تسلسل الرتب على تعديل الصلاحيات — لم يكن هناك أي تحقق
      //   من قبل، فكان أي صاحب صلاحية "setpower" يستطيع: (أ) تعديل صلاحية
      //   عضو رتبته أعلى منه أو حتى إزالتها، (ب) ترقية أي عضو لرتبة أعلى من
      //   رتبته هو نفسه (بما فيها رتبة المالك). المالك الحقيقي فقط يتجاوز
      //   هذا القيد بالكامل.
      const actorIsOwner = buildPower(user, room).owner;
      const newRank = rankOfPowerName(data.power || '');
      let currentTargetRank = 0;
      if (target) {
        currentTargetRank = target.rank || 0;
      } else {
        for (const [, acc] of accounts) { if (acc.lid === data.id) { currentTargetRank = acc.rank || 0; break; } }
      }
      if (!actorIsOwner) {
        if (currentTargetRank >= (user.rank || 0)) return;   // الهدف رتبته أعلى/مساوية بالفعل
        if (newRank >= (user.rank || 0)) return;              // الترقية المطلوبة تساوي/تتجاوز رتبة الفاعل
      }

      logAction(user, 'setpower', data.id, data.power || '(بلا صلاحية)');
      if (!target) {
        // مستخدم غير متصل حالياً → تحديث الحساب مباشرة بالـ lid
        for (const [, acc] of accounts) {
          if (acc.lid === data.id) {
            acc.power = data.power || '';
            acc.rank  = newRank;
            break;
          }
        }
        return;
      }

      target.power = data.power || '';
      target.rank  = newRank;

      saveAccount(target, { power: target.power, rank: target.rank });
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) {
        const targetRoom = target.roomid ? rooms.get(target.roomid) : null;
        send(ts, 'power', buildPower(target, targetRoom));
      }
      if (target.roomid) toRoom(target.roomid, 'u^', target.pub());
      break;
    }

    // ── حذف عضوية  { id }
    // ▲ إصلاح: appraad2.js لا يملك أي "case 'kick'" في مُستقبِل الأوامر
    //   (_0x25b5a7)، فإرسال حدث 'kick' لا معنى له للعميل ولا يظهر أي رسالة؛
    //   والقطع الفوري (بدون أي تأخير) لا يترك وقتاً لوصول الحزمة أصلاً، فيرى
    //   العضو المحذوف فقط "انقطع الاتصال" ثم تُحاول الواجهة إعادة الاتصال
    //   تلقائياً (loop لا نهائي) بدل إعلامه بأن حسابه حُذف نهائياً.
    //   الحل: نفس نمط kick/ban الصحيح أعلاه → send('not') ثم send('close')
    //   قبل قطع الاتصال الفعلي بعد مهلة قصيرة.
    case 'delu': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      // ▲ إضافة: منع حذف عضوية عضو برتبة أعلى أو مساوية
      if (!canActOnRank(user, target, room)) return;
      logAction(user, 'delu', target);
      // حذف من الحسابات
      for (const [key, acc] of accounts) {
        if (acc.lid === target.lid) { accounts.delete(key); break; }
      }
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) {
        if (room) leaveRoom(ts, target, 'deleted');
        removeRecentLogin(target.id);
        send(ts, 'not', { user: user.id, msg: 'تم حذف عضويتك' });
        send(ts, 'close', {});
        setTimeout(() => { try { ts.disconnect(true); } catch (_) {} }, 1200);
      }
      break;
    }

    // ── قائمة بصمات FPS  { q, i }
    // appraad2.js يقرأ: isreg, username, topic, ip, co, fp, refr, r, created
    // المعادلة: new Date(_0x45820f.d - _0x2163d9.created).time()
    // حيث _0x45820f.d هو d في العنصر الأخير → created يجب أن يكون timestamp مطلق
    case 'fps': {
      if (!adminOk) return;
      const query  = data?.q || '';
      const offset = parseInt(data?.i) || 0;
      const now    = Date.now();
      const list   = [];
      users.forEach(u => {
        if (query && !u._fp.includes(query) && !u.topic.includes(query) &&
            !u.lid.includes(query) && !u._ip.includes(query)) return;
        list.push({
          username: u.lid,
          topic:    u.topic,
          ip:       u._ip   || '',
          co:       u.co    || '--',
          fp:       u._fp   || '',
          refr:     u.refr  || '',
          r:        u.roomid || '',
          created:  u.created,         // timestamp مطلق (وليس مدة)
          isreg:    !!([...accounts.values()].find(a => a.lid === u.lid))
        });
      });
      const chunk = list.slice(offset, offset + 200);
      chunk.push({ d: now, i: offset });
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

    // ── سجل العمليات { q, i }
    // ▲ إصلاح: كان stub يُرجع قائمة فارغة دائماً — الآن يُرجع actionsLog
    //   الفعلي مع دعم البحث (بالاسم/الإجراء) والترقيم، بنفس نمط 'fps'.
    case 'actions': {
      if (!adminOk) return;
      const query  = data?.q || '';
      const offset = parseInt(data?.i) || 0;
      const list = actionsLog
        .filter(a => !query || a.u1.includes(query) || a.u2.includes(query) || a.type.includes(query) || a.room.includes(query))
        .slice()
        .reverse(); // الأحدث أولاً
      const chunk = list.slice(offset, offset + 200);
      chunk.push({ d: Date.now(), i: offset });
      send(socket, 'cp_actions', chunk);
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
      const idx = globalPowers.findIndex(p => p.name === pw.name);
      if (idx !== -1) globalPowers[idx] = pw;
      else globalPowers.push(pw);
      // 1) أرسل powers لكل أعضاء الغرفة (يُحدِّث _0x5a3802 في appraad2.js)
      broadcastPowers();
      // 2) أرسل cp_rooms محدَّثة لنافذة CP حتى تتحدث قائمة الصلاحيات فورًا
      send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
        id: r.id, name: r.name, topic: r.name,
        user: r.owner || '', pic: r.pic || 'room.png',
        online: r.members.size, uco: r.members.size,
        needpass: r.needpass, about: r.about || '',
        welcome: r.welcome || '', bg: r.bg || '',
        c: r.c || '#000000', max: r.max || 20,
        l: r.l || 0, vl: r.vl || 0,
        owner: r.owner || '', powers: globalPowers || []
      })));
      break;
    }

    // ── حذف صلاحية  { name }
    case 'powers_del': {
      if (!adminOk || !room) return;
      const _filtered = globalPowers.filter(p => p.name !== data.name);
      globalPowers.length = 0;
      globalPowers.push(..._filtered);
      broadcastPowers();
      send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
        id: r.id, name: r.name, topic: r.name,
        user: r.owner || '', pic: r.pic || 'room.png',
        online: r.members.size, uco: r.members.size,
        needpass: r.needpass, about: r.about || '',
        welcome: r.welcome || '', bg: r.bg || '',
        c: r.c || '#000000', max: r.max || 20,
        l: r.l || 0, vl: r.vl || 0,
        owner: r.owner || '', powers: globalPowers || []
      })));
      break;
    }

    // ── إضافة أيقونة  { pid, tar }
    case 'addico': {
      if (!adminOk || !room) return;
      const tar = data.tar || 'sico';
      if (tar === 'sico' && !room.sicos.includes(data.pid)) room.sicos.push(data.pid);
      else if (tar === 'emo' && !room.emos.includes(data.pid)) room.emos.push(data.pid);
      else if (tar === 'dro3' && !room.colors.includes(data.pid)) room.colors.push(data.pid);
      // ▲ إصلاح: كان يُرسل التأكيد للمشرف فقط (send)، فلا يرى بقية أعضاء
      //   الغرفة الأيقونة/الزخرفة/الإيموجي الجديد إلا بعد إعادة الاتصال —
      //   بخلاف delico المقابلة التي تبث بشكل صحيح لكل الغرفة (toRoom).
      toRoom(room.id, 'ico+', data.pid);
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
      if ((!adminOk && !hasPower(user, room, 'kick')) || !room) return;
      const target = byUID(data.id);
      if (!target) return;
      // ▲ إضافة: منع طرد عضو برتبة أعلى أو مساوية من الغرفة
      if (!canActOnRank(user, target, room)) return;
      logAction(user, 'roomkick', target);
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) {
        leaveRoom(ts, target, 'roomkick');
        send(ts, 'not', { user: user.id, msg: 'تم طردك من الغرفة' });
        // طرد من الغرفة فقط — لا قطع اتصال كلي
      }
      break;
    }

    // ── إرسال هدية لعضو  { id, gift }
    // appraad.js: gift(id, giftName) → send("action", { cmd:'gift', id, gift })
    // ▲ إصلاح: الصلاحية الصحيحة هي "upgrades" (الهدايا) المُعرّفة في نظام
    //   الصلاحيات (buildPower().upgrades) — وليست adminOk. زر الهدية بالواجهة
    //   يظهر لأي عضو لديه upgrades>=1 وليس للمشرفين فقط (راجع appraad2.js:4173).
    // ▲ إصلاح: appraad2.js لا يملك أي "case 'gift'" في مُستقبِل الأوامر
    //   (_0x25b5a7)، فإرسال حدث 'gift' للعميل المُستهدف لا يُنتج أي أثر مرئي
    //   إطلاقاً (الهدية تختفي بصمت). الحل: تمرير الهدية عبر حدث 'not'
    //   (الإشعار العائم) الذي يملك العميل معالجاً فعلياً له، مع تضمين صورة
    //   الهدية داخل نص الرسالة (msg يُدرَج كـ HTML مباشرة في الواجهة).
    case 'gift': {
      if (!hasPower(user, room, 'upgrades')) return;
      const target = byUID(data.id);
      if (!target) return;
      const giftName = sanitize(data.gift || '', 100);
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) {
        send(ts, 'not', {
          user: user.id,
          uid:  user.id,
          topic: user.topic,
          pic:   user.pic,
          msg:  giftName
            ? `أهداك <b>${user.topic}</b> هديه: <img src="dro3/${giftName}" style="max-height:32px;vertical-align:middle;">`
            : `قام <b>${user.topic}</b> بإزالة الهديه عنك`
        });
      }
      break;
    }

    // ── إشعار من لوحة التحكم  { id, msg }
    case 'not': {
      // ▲ إصلاح: زر "تنبيه" (.unot) في appraad2.js متاح لكل المستخدمين بلا
      //   أي تحقق صلاحية بالواجهة إطلاقاً (بخلاف .uban/.ukick المُقيَّدة
      //   بوضوح بشرط power.ban/power.kick) — فهو ميزة اجتماعية عامة مثل
      //   "poke" وليس إجراءً إدارياً. الشرط الصحيح المقصود هنا هو notlikes
      //   (الحد الأدنى من الإعجابات)، لا modOk. المشرفون يتجاوزون الشرط.
      const target = byUID(data.id);
      if (!target) return;
      if (!adminOk) {
        const minLikes = parseInt(siteSetting('notlikes', 0)) || 0;
        if (minLikes > 0 && (user.rep || 0) < minLikes) {
          send(socket, 'not', { user: 'srv', msg: `يجب أن تملك ${minLikes} إعجاب على الأقل لإرسال تنبيه` });
          return;
        }
      }
      const ts = io.sockets.sockets.get(target.socketId);
      if (ts) send(ts, 'not', {
        msg: sanitize(data.msg || '', 300), user: user.id, uid: user.id,
        topic: user.topic, pic: user.pic
      });
      break;
    }

    // ── حفظ إعدادات الموقع العامة  { data }
    // appraad.js: sitesave() → send('cp', { cmd:'sitesave', data })
    case 'sitesave': {
      if (!adminOk) return;
      if (!global.siteSettings) global.siteSettings = {};
      Object.assign(global.siteSettings, data?.data || {});
      send(socket, 'ok', null);
      break;
    }

    // ── رسائل الترحيب التلقائية
    case 'msgs': {
      if (!adminOk) return;
      if (!global.siteMessages) global.siteMessages = [];
      send(socket, 'cp_msgs', global.siteMessages);
      break;
    }

    // ── حفظ رسالة جاهزة جديدة (ترحيب/رسائل عامة)  { type, t, m }
    // ▲ إضافة: لم يكن يوجد أي معالج لإضافة رسالة جديدة إطلاقاً — فقط
    //   'msgsdel' (حذف) كانت موجودة، فكانت كل رسالة جديدة تُكتَب من لوحة
    //   التحكم لا تظهر أبداً (لا يوجد مسار لحفظها من الأساس). appraad2.js
    //   (case 'cp_msgs') يقرأ من كل عنصر تحديداً: type ('w'=ترحيب أو أي
    //   قيمة أخرى=رسائل عامة), t (العنوان), m (نص الرسالة), id (للحذف).
    //   ⚠️ ملاحظة: لا أملك index.html فلا أعرف اسم الأمر الحرفي الذي يرسله
    //   نموذج الإضافة الفعلي في الواجهة. اخترت 'msgsave' كأقرب اسم متسق مع
    //   بقية تسميات الأوامر في هذا الملف (setpower/powers_save/bot_save)،
    //   بنفس أسماء الحقول التي تقرأها واجهة العرض بالضبط. إن كان نموذج
    //   الإضافة الحالي بالواجهة يرسل اسم أمر مختلف، يلزم إما تعديله ليطابق
    //   'msgsave' أو إخباري بالاسم الصحيح لتصحيح المعالج هنا.
    case 'msgsave': {
      if (!adminOk) return;
      if (!global.siteMessages) global.siteMessages = [];
      const type = data?.type === 'w' ? 'w' : 'm';
      const t    = sanitize(String(data?.t ?? ''), 100);
      const m    = sanitize(String(data?.m ?? ''), 1000);
      if (!m) return;
      global.siteMessages.push({ id: makeBid(), type, t, m });
      send(socket, 'cp_msgs', global.siteMessages);
      break;
    }

    // ── حذف رسالة ترحيب  { id }
    // appraad2.js: send('cp',{cmd:'msgsdel',id:'...'})
    case 'msgsdel': {
      if (!adminOk) return;
      if (!global.siteMessages) global.siteMessages = [];
      global.siteMessages = global.siteMessages.filter(m => m.id !== data?.id);
      send(socket, 'cp_msgs', global.siteMessages);
      break;
    }

    // ── قائمة المشتركين / الصلاحيات الممنوحة
    // appraad2.js case 'cp_subs' → يقرأ: id, user, power, topic, days, end, ls
    case 'subs': {
      if (!adminOk) return;
      const now    = Date.now();
      const subList = [];
      accounts.forEach((acc, key) => {
        if (!acc.power && !acc.rank) return;
        subList.push({
          id:    acc.lid,
          user:  acc.name || key,
          power: acc.power || '',
          topic: acc.name  || key,
          days:  0,
          end:   acc.powerEnd || 0,
          ls:    acc.last   || now,
          rank:  acc.rank   || 0
        });
      });
      send(socket, 'cp_subs', subList);
      break;
    }

    // ── قائمة الاختصارات
    // appraad2.js case 'cp_shrt' → يقرأ: name, value
    case 'shrt': {
      if (!adminOk) return;
      if (!global.shortcuts) global.shortcuts = {};
      const shrtList = Object.entries(global.shortcuts).map(([name, value]) => ({ name, value }));
      send(socket, 'cp_shrt', shrtList);
      break;
    }

    // ── حفظ اختصار  { name, value }
    case 'shrtadd': {
      if (!adminOk) return;
      if (!global.shortcuts) global.shortcuts = {};
      const shName = (data?.name || '').trim().slice(0, 50);
      const shVal  = (data?.value || '').slice(0, 500);
      if (!shName) return;
      global.shortcuts[shName] = shVal;
      send(socket, 'cp_shrt', Object.entries(global.shortcuts).map(([n, v]) => ({ name: n, value: v })));
      break;
    }

    // ── قائمة الفلاتر
    // appraad2.js case 'cp_fltr' → يقرأ: a (مصفوفة) و b (مصفوفة الحظر المؤقت)
    case 'fltr': {
      if (!adminOk) return;
      const arr = getFiltersArr();
      if (!global.filtersTemp) global.filtersTemp = [];
      // path يبقى للتوافق مع أي زر حذف قديم بالواجهة يعتمد عليه (path=type/id)
      const fList = arr.map(f => ({ id: f.id, path: `${f.type}/${f.id}`, v: f.v, type: f.type }));
      send(socket, 'cp_fltr', { a: fList, b: global.filtersTemp });
      break;
    }

    // ── قائمة الغرف (اسم الأمر القديم cp_rooms)
    case 'cp_rooms': {
      if (!adminOk) return;
      send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
        id:       r.id,
        name:     r.name,
        topic:    r.name,
        user:     r.owner    || '',
        pic:      r.pic      || 'room.png',
        online:   r.members.size,
        uco:      r.members.size,
        needpass: r.needpass,
        about:    r.about    || '',
        welcome:  r.welcome  || '',
        bg:       r.bg       || '',
        c:        r.c        || '#000000',
        max:      r.max      || 20,
        l:        r.l        || 0,
        vl:       r.vl       || 0,
        owner:    r.owner    || '',
        powers:   globalPowers   || []    // ← مصفوفة الصلاحيات كاملة
      })));
      break;
    }

    // ── إعدادات البوتات
    // استثناء: يبقى التحقق بالرنك هنا فقط (مطابقةً لـ appraad2.js: rank > 0x2326 && owner)
    case 'bot_save': {
      if (!room || !(user.rank > 0x2326 && buildPower(user, room).owner)) return;
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
      if (!room || !(user.rank > 0x2326 && buildPower(user, room).owner)) return;
      // ▲ إصلاح: كان stub يُرجع مصفوفة فارغة دائماً رغم أن room.bots تحتوي
      //   فعلياً بيانات حقيقية (تُملأ عبر case 'bot' أسفل)، فكانت تبويبة
      //   "البوتات" في لوحة التحكم تظهر فارغة دوماً حتى مع وجود بوتات فعّالة.
      send(socket, 'cp_bots', [...(room.bots || new Map()).values()]);
      break;
    }

    // ── تعديل بوت فردي  { id, or, ucol, bg, topic, msg, online, co, pic, del }
    // appraad.js: editBot() → send('cp', { cmd:'bot', id, ...fields })
    case 'bot': {
      if (!room || !(user.rank > 0x2326 && buildPower(user, room).owner)) return;
      if (!room.bots) room.bots = new Map();
      const { id: botId, del, ...botFields } = data || {};
      if (!botId) return;
      if (del) {
        room.bots.delete(botId);
        toRoom(room.id, 'u-', botId);
      } else {
        // ▲ إصلاح جوهري: appraad2.js (case 'u^') يتجاهل التحديث بالكامل إذا
        //   لم يكن الـ id موجوداً مسبقاً في عناصر الواجهة (_0x3ab28f) — أي
        //   id لم يصله له 'u+' من قبل يبقى بلا أي أثر مرئي إطلاقاً. كان
        //   إنشاء بوت جديد يُرسل 'u^' مباشرة (كأنه "تحديث" لعنصر غير موجود
        //   أصلاً) فلا يظهر البوت أبداً في الواجهة رغم حفظه في room.bots.
        //   الحل: 'u+' (إضافة حقيقية تُنشئ العنصر) عند أول إنشاء للبوت،
        //   و'u^' فقط عند تعديل بوت موجود مسبقاً. كما أُضيفت حقول افتراضية
        //   كاملة مطابقة لشكل pub() الذي يتوقعه العميل حتى لا تفشل دوال
        //   العرض (topic/pic/ico/co/bg/ucol/mcol/rep/power/rank/roomid/s).
        const existing = room.bots.get(botId);
        const isNew = !existing;
        const updated = Object.assign(
          {
            id: botId, lid: botId, username: botId, topic: 'بوت', msg: '',
            pic: 'pic.png', ico: '', co: '--', bg: '', ucol: '', mcol: '',
            rep: 0, power: '', rank: 0, roomid: room.id, b: null, s: null
          },
          existing || {}, botFields, { id: botId, roomid: room.id }
        );
        room.bots.set(botId, updated);
        toRoom(room.id, isNew ? 'u+' : 'u^', updated);
      }
      send(socket, 'cp_bots', [...room.bots.values()]);
      break;
    }

    // ── تغيير نك نيم عضو  { id, nick }
    case 'unick': {
      if (!adminOk) return;
      const target = byUID(data.id);
      if (!target) return;
      target.topic = sanitize(data.nick || '', 60);
      saveAccount(target, { topic: target.topic });
      if (target.roomid) toRoom(target.roomid, 'u^', target.pub());
      break;
    }

    // ── سجل تسجيل الدخول  { q, i }
    // appraad2.js case 'cp_logins' → يقرأ: u, t, ip, fp, power, rep, lastseen, regdate
    case 'logins': {
      if (!adminOk) return;
      const query  = data?.q || '';
      const offset = parseInt(data?.i) || 0;
      const now    = Date.now();
      const list   = [];
      users.forEach(u => {
        if (query && !u.lid.includes(query) && !u.topic.includes(query) &&
            !u._ip.includes(query) && !u._fp.includes(query)) return;
        // ابحث عن حساب مسجل للحصول على regdate
        let acc = null;
        for (const [, a] of accounts) {
          if (a.lid === u.lid) { acc = a; break; }
        }
        list.push({
          id:       u.id,
          u:        u.lid,                          // username / lid
          t:        u.topic,                        // decoration
          ip:       u._ip    || '',
          fp:       u._fp    || '',
          power:    u.power  || '',
          rep:      u.rep    || 0,
          lastseen: u.last   || now,                // absolute timestamp
          regdate:  acc?.created ? new Date(acc.created).toISOString() : null
        });
      });
      // إضافة الأعضاء المسجلين غير المتصلين حالياً
      for (const [, acc] of accounts) {
        if (list.some(x => x.u === acc.lid)) continue; // متصل بالفعل
        if (query && !acc.lid.includes(query) && !(acc.name||'').includes(query)) continue;
        list.push({
          id:       acc.lid,
          u:        acc.lid,
          t:        acc.name || acc.lid,
          ip:       '',  fp: '',
          power:    acc.power || '',
          rep:      acc.rep   || 0,
          lastseen: acc.last  || 0,
          regdate:  acc.created ? new Date(acc.created).toISOString() : null
        });
      }
      const chunk = list.slice(offset, offset + 100);
      chunk.push({ d: now, i: offset });
      send(socket, 'cp_logins', chunk);
      break;
    }

    // ── بيانات مالك الموقع
    // appraad.js case 'cp_owner' → تعبئة حقول إعدادات الموقع
    case 'owner': {
      if (!buildPower(user, room).owner) return;
      const siteSettings = global.siteSettings || {};
      send(socket, 'cp_owner', {
        site: Object.assign({
          name:        'Chat',
          title:       'دردشة',
          description: '',
          keywords:    '',
          script:      '',
          wall_likes:  0,
          wall_minutes: 0,
          pmlikes:     0,
          msgst:       0,
          notlikes:    0,
          fileslikes:  0,
          proflikes:   0,
          piclikes:    0,
          maxIP:       2,
          maxshrt:     1,
          stay:        1,
          allowg:      true,
          allowreg:    true,
          rc:          false,
          bclikes:     true,
          mlikes:      true,
          bcreply:     false,
          mreply:      false,
          calls:       true,
          callsLike:   0,
          bg:          '39536E',          // jscolor.fromString — بدون #
          background:  'fafafa',
          buttons:     '2B3E52',
          sico:        global.sicoList || []   // قائمة ملفات الأيقونات المحملة
        }, siteSettings)
      });
      break;
    }

    // ── فلاتر الكلمات  { path, v }
    // appraad.js: fltrit(path, value) → send('cp', { cmd:'fltrit', path, v })
    case 'fltrit': {
      if (!adminOk) return;
      const arr = getFiltersArr();
      const word = sanitize(String(data?.v ?? ''), 100).trim();
      if (!word) return;
      // ▲ إصلاح: التصنيف يُستنتج من data.type مباشرة إن أُرسل، وإلا من بادئة
      //   data.path (قبل أول '/')، وإلا فالافتراضي "ban" (الأكثر أماناً).
      //   المعرّف الفريد (id) يُولَّد هنا دائماً في السيرفر، بصرف النظر عمّا
      //   يرسله العميل في path — هذا وحده يمنع استبدال الإضافات السابقة.
      const rawType = String(data?.type || String(data?.path || '').split('/')[0] || '').toLowerCase();
      const type = ['allow', 'watch', 'ban'].includes(rawType) ? rawType : 'ban';
      arr.push({ id: makeBid(), type, v: word });
      const fList = arr.map(f => ({ id: f.id, path: `${f.type}/${f.id}`, v: f.v, type: f.type }));
      send(socket, 'cp_fltr', { a: fList, b: global.filtersTemp || [] });
      send(socket, 'ok', null);
      break;
    }

    // ── حفظ إعدادات مالك الموقع  { data }
    case 'owner_save': {
      if (!buildPower(user, room).owner) return;
      if (!global.siteSettings) global.siteSettings = {};
      Object.assign(global.siteSettings, data?.data || data || {});
      send(socket, 'ok', null);
      break;
    }

    // ── إعجاب بمستخدم  { id }
    // appraad.js: send("action", { cmd:'like', id }) ← يصل هنا عبر case 'action'
    case 'like': {
      const target = byUID(data?.id);
      if (!target || target.id === user.id) return;
      target.rep = (target.rep || 0) + 1;
      saveAccount(target, { rep: target.rep });
      if (target.roomid) toRoom(target.roomid, 'u^', { id: target.id, rep: target.rep });
      break;
    }

    // ── إبلاغ عن مستخدم  { id }
    // appraad.js: send("action", { cmd:'report', id })
    case 'report': {
      const target = byUID(data?.id);
      if (target) console.log(`[Report] "${user.topic}" أبلغ عن "${target.topic}"`);
      break;
    }

    // ── حذف صورة مستخدم  { id }
    // appraad.js: send("action", { cmd:'delpic', id })
    case 'delpic': {
      if (!adminOk) return;
      const target = byUID(data?.id);
      if (!target) return;
      // ▲ إضافة: منع حذف صورة عضو برتبة أعلى أو مساوية
      if (!canActOnRank(user, target, room)) return;
      logAction(user, 'delpic', target);
      target.pic = 'pic.png';
      saveAccount(target, { pic: 'pic.png' });
      if (target.roomid) toRoom(target.roomid, 'u^', target.pub());
      break;
    }

    // ── رفع حظر — alias لـ aban
    // appraad.js: send('cp', { cmd:'unban', id })
    case 'unban': {
      // ▲ إصلاح مزدوج: (١) الصلاحية الصحيحة هي "ban" بدل modOk الفضفاضة.
      //   (٢) كان يقارن فقط بـ b.id، فيفشل مع حظورات البصمة (fp) القادمة
      //   بحقل type كما في حالة aban أعلاه — نفس منطق المطابقة الآن.
      if ((!adminOk && !hasPower(user, room, 'ban')) || !room) return;
      const key = data?.id || data?.type || '';
      if (!key) return;
      logAction(user, 'unban', key);
      room.bans = room.bans.map(b =>
        (b.id && b.id === key) || (b.type && b.type === key)
          ? { ...b, active: false } : b
      );
      send(socket, 'cp_bans', room.bans.filter(b => b.active));
      break;
    }

    // ── حذف جميع منشورات الحائط لمستخدم معين (بـ uid)
    // مختلف عن msgsdel — هذا يمسح كل منشورات bc لمستخدم واحد من الغرفة
    case 'cleanbc': {
      if (!adminOk || !room) return;
      const targetUid = data?.id || data?.uid;
      if (!targetUid) return;
      // ▲ إصلاح: نفس مشكلة likebc/delbc — الحائط الحقيقي هو globalWall
      //   (room.wall فارغة دوماً)، فكانت هذه الميزة لا تحذف شيئاً إطلاقاً.
      const removed = globalWall.filter(m => m.id === targetUid || m.uid === targetUid).map(m => m.bid);
      for (let i = globalWall.length - 1; i >= 0; i--) {
        const m = globalWall[i];
        if (m.id === targetUid || m.uid === targetUid) globalWall.splice(i, 1);
      }
      removed.forEach(bid => toAll('delbc', { bid }));
      break;
    }

    // ── حذف اختصار  { name }
    // appraad.js: send('cp', { cmd:'shrtdel', name })
    case 'shrtdel': {
      if (!adminOk) return;
      if (!global.shortcuts) global.shortcuts = {};
      delete global.shortcuts[data?.name || ''];
      break;
    }

    // ── حذف فلتر  { path, id }
    // appraad.js: send('cp', { cmd:'fltrdel', path, id })
    case 'fltrdel': {
      if (!adminOk) return;
      const arr = getFiltersArr();
      // path بالصيغة الجديدة "type/id" — نأخذ الجزء بعد آخر '/' كمعرّف، مع
      // دعم data.id مباشرة أيضاً لأي زر حذف يرسله بشكل منفصل
      const delId = String(data?.id || String(data?.path || '').split('/').pop() || '');
      if (!delId) return;
      global.filters = arr.filter(f => String(f.id) !== delId);
      const fList = global.filters.map(f => ({ id: f.id, path: `${f.type}/${f.id}`, v: f.v, type: f.type }));
      send(socket, 'cp_fltr', { a: fList, b: global.filtersTemp || [] });
      break;
    }

    // ── حذف فلتر مؤقت  { id }
    // appraad.js: send('cp', { cmd:'fltrdelx', id })
    case 'fltrdelx': {
      if (!adminOk) return;
      // ▲ إصلاح: كان stub فارغاً تماماً (لا يحذف شيئاً)، والقائمة نفسها لم
      //   تكن تُملأ أصلاً من قبل (راجع checkFilters/logFilteredMessage أعلاه).
      if (!global.filtersTemp) global.filtersTemp = [];
      const delId = String(data?.id ?? '');
      global.filtersTemp = global.filtersTemp.filter(e => String(e.id) !== delId);
      const arr = getFiltersArr();
      send(socket, 'cp_fltr', {
        a: arr.map(f => ({ id: f.id, path: `${f.type}/${f.id}`, v: f.v, type: f.type })),
        b: global.filtersTemp
      });
      break;
    }

    // ── قائمة الدومينات
    // appraad.js: cp_owner → يُرسَل عند فتح تبويب الدومينات
    case 'domains': {
      if (!buildPower(user, room).owner) return;
      send(socket, 'cp_domains', global.domains || {});
      break;
    }

    // ── حفظ دومين  { data: { domain, name, ... } }
    // appraad.js: domains_save() → send('cp', { cmd:'domainsave', data })
    case 'domainsave': {
      if (!buildPower(user, room).owner) return;
      if (!global.domains) global.domains = {};
      const d = data?.data || {};
      if (d.domain) {
        // تأكد أن جميع حقول jscolor موجودة حتى لا يطلع خطأ fromString(undefined)
        global.domains[d.domain] = Object.assign({
          domain:      d.domain,
          name:        '',
          title:       '',
          description: '',
          keywords:    '',
          script:      '',
          bg:          '39536E',
          background:  'fafafa',
          buttons:     '2B3E52',
          status:      2
        }, d);
        send(socket, 'cp_domains', global.domains);
      }
      break;
    }

    // ── قائمة الغرف للكنترول
    // appraad.js: يُرسَل عند فتح تبويب الغرف في لوحة التحكم
    case 'rooms': {
      if (!adminOk) return;
      send(socket, 'cp_rooms', [...rooms.values()].map(r => ({
        id:       r.id,
        name:     r.name,
        topic:    r.name,
        user:     r.owner   || '',
        pic:      r.pic     || 'room.png',
        online:   r.members.size,
        uco:      r.members.size,
        needpass: r.needpass,
        about:    r.about   || '',
        welcome:  r.welcome || '',
        bg:       r.bg      || '',
        c:        r.c       || '#000000',
        max:      r.max     || 20,
        l:        r.l       || 0,
        vl:       r.vl      || 0,
        owner:    r.owner   || '',
        powers:   globalPowers  || []    // ← مصفوفة الصلاحيات كاملة
      })));
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
  toAll('r-', { id: req.params.id });
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

// ▲ ملاحظة: فكرة بث rlist دورياً كشبكة أمان لتصحيح أي انحراف تراكمي في
//   عدّاد الحضور تم التراجع عنها عمداً بعد التحقق من appraad2.js: case
//   "rlist" يستخدم $("#rooms").append(...) دون تفريغ الحاوية أولاً، فإعادة
//   إرسالها بشكل متكرر تُراكم عناصر غرف مكررة في واجهة قائمة الغرف — عطل
//   جديد أوضح وأسوأ من مشكلة العدّاد الأصلية. الاعتماد فقط على الإصلاحات
//   الدقيقة والمحدَّدة (ترتيب ur/u+ الصحيح في joinRoom وrc2 أعلاه) بدل أي
//   "إصلاح شامل" عام قد يكسر جزءاً آخر من الواجهة لم يُتحقق منه بدقة.

// ─── تشغيل السيرفر ────────────────────────────────────────────────────────────
seedRooms();
seedAdmin();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`    http://localhost:${PORT}\n`);
  console.log('  ═══ جدول الأحداث المتوافق مع appraad2.js ═══');
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
