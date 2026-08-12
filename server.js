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
const fs         = require('fs');

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

// ▲ إصلاح: index:false يمنع express.static من تقديم index.html تلقائياً
//   عند GET / — لإفساح المجال لمسار GET / المخصص أدناه الذي يحقن اسم/عنوان/
//   وصف/كلمات دلالية/سكربت/لون الموقع ديناميكياً من الإعدادات المحفوظة.
//   بقية الملفات الساكنة (js/css/صور) تبقى تُقدَّم بشكل طبيعي كالمعتاد.
app.use(express.static('public', { index: false }));
app.use(express.json());

// ▲ إضافة جوهرية: مساري رفع الملفات /upload و/pic لم يكونا موجودين إطلاقاً
//   في السيرفر بأي شكل من الأشكال — اكتشاف جوهري أثناء هذا الفحص. appraad2.js
//   يرفع الملفات عبر XMLHttpRequest POST خام (الجسم = بيانات الملف الثنائية
//   نفسها، وليس multipart/form-data) لهذين المسارين تحديداً:
//     POST /pic?secid=u&fn=<امتداد>&t=<وقت>     → الصورة الشخصية (setpic)
//     POST /upload?secid=u&fn=<امتداد>&t=<وقت>  → كل شيء آخر (صور/ملفات
//       الحائط، مشاركة ملف بالخاص، رفع أيقونات/إيموجيات/زخارف لوحة التحكم،
//       شعار الموقع favicon.ico/prv1.png)
//   ويتوقع كلاهما استجابة نصية عادية (وليست JSON) تحمل رابط الملف المرفوع
//   مباشرة. بما أن هذين المسارين لم يكونا موجودين، كان أي رفع ملف بالموقع
//   بأكمله يفشل بخطأ 404 دائماً — نظام الرفع كله كان معطّلاً من الأساس.
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// ▲ إصلاح جوهري لخطأ "Cannot GET /sico/xxx.jpg" (وبنفس الشكل /dro3, /emo):
//   كل رفع (أيقونة صلاحية/هدية/إيموجي) يُحفظ فعلياً بمجلد واحد فقط هو
//   public/uploads (المسار أعلاه)، بينما appraad2.js يبني رابط العرض دائماً
//   بافتراض مجلد منفصل حسب النوع: "sico/"+file أو "dro3/"+file أو "emo/"+file
//   — وهذه المجلدات غير موجودة أصلاً على القرص، فيفشل التحميل دوماً. بما أن
//   اسم كل ملف مُولَّد عشوائياً وفريد (Date.now + Math.random)، لا خطر تصادم
//   إطلاقاً من تقديم نفس مجلد uploads الفعلي تحت الأسماء الثلاث معاً — أياً
//   كان "المجلد المنطقي" الذي يطلبه المتصفح، يُعثر على الملف الصحيح دوماً.
// ▲ إصلاح إضافي (Cannot GET /sico/uploads/xxx.gif): بعض العناصر المخزَّنة
//   فعلياً بقاعدة البيانات تحمل القيمة كاملة "uploads/xxx.gif" (بدل اسم
//   الملف المجرد) لأن addico كان يحفظ ما يصله دون تنظيف — فيصبح رابط العرض
//   "sico/uploads/xxx.gif" (مجلد uploads متداخل داخل مجلد وهمي آخر). معالج
//   مخصص هنا (بدل express.static البسيطة) يزيل أي بادئة "uploads/" من
//   المسار المطلوب قبل البحث عن الملف — فيعمل مع القيم القديمة المخزَّنة
//   بالخطأ (توافقية رجعية بلا حاجة لأي ترحيل بيانات) والجديدة النظيفة معاً.
function serveFromUploadDir(req, res) {
  // ▲ تصحيح: req.path يتضمن /sico أو /dro3 أو /emo نفسها كجزء من النص —
  //   req.params[0] (التقاط الحرف البدل *) يعطي فقط ما بعدها مباشرة، وهو
  //   المطلوب فعلياً لإزالة بادئة uploads/ بشكل صحيح.
  let requested = decodeURIComponent(req.params[0] || '');
  requested = requested.replace(/^\/+/, '').replace(/^(uploads\/)+/, ''); // يزيل أي تكرار uploads/
  const filePath = path.join(UPLOAD_DIR, requested);
  if (!filePath.startsWith(UPLOAD_DIR)) return res.status(400).end(); // حماية من path traversal
  res.sendFile(filePath, (err) => { if (err) res.status(404).end(); });
}
app.get('/sico/*', serveFromUploadDir);
app.get('/dro3/*', serveFromUploadDir);
app.get('/emo/*',  serveFromUploadDir);

function handleFileUpload(req, res) {
  try {
    if (!req.body || !req.body.length) return res.status(400).send('');
    const extRaw = String(req.query.fn || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ext = extRaw.slice(0, 10) || 'bin';
    const filename = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.body);
    res.status(200).send('uploads/' + filename);
  } catch (e) {
    console.error('[upload] فشل الرفع:', e.message);
    res.status(500).send('');
  }
}
// raw() تلتقط جسم الطلب الثنائي الخام كما يرسله appraad2.js تماماً
const rawUploadParser = express.raw({ limit: '25mb', type: () => true });
app.post('/upload', rawUploadParser, handleFileUpload);
app.post('/pic',    rawUploadParser, handleFileUpload);

// ─── الصفحة الرئيسية: حقن إعدادات الموقع ديناميكياً ────────────────────────────
// appraad2.js/index.html لا يملكان أي آلية لتطبيق اسم/عنوان/وصف/لون الموقع
// المحفوظة عبر لوحة التحكم (sitesave) على الصفحة الفعلية — كانت تُحفظ في
// السيرفر وتُعرض فقط داخل لوحة التحكم نفسها. نحقنها هنا في كل مرة تُطلب
// فيها الصفحة الرئيسية.
// ⚠️ ملاحظة صريحة: تحققتُ من index.html وملف الأنماط بالكامل — حقلا لون
//   المحتوى (sbackground) ولون الأزرار (sbuttons) لا يملكان أي قاعدة CSS
//   أو استخدام آخر في الصفحة كلها تربطهما بأي عنصر مرئي فعلي (لا صنف
//   ".background"/".buttons" مُستخدَم لأي تنسيق حقيقي) — هما حقلان يُحفظان
//   فقط لكن لا "مكان" موجود لربطهما به حالياً. لذا حقنتُ فقط ما له هدف
//   مؤكد وموجود فعلياً في الصفحة: العنوان <title>، الوصف/الكلمات الدلالية،
//   السكربت المخصص، ولون خلفية الصفحة (bg، مرتبط مباشرة بـ body.bg الموجود
//   فعلياً في index.html). لتفعيل لون المحتوى/الأزرار فعلياً، يلزم أولاً
//   إضافة قواعد CSS حقيقية تستخدمها في index.html (وليست موجودة حالياً).
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  let html;
  try { html = require('fs').readFileSync(indexPath, 'utf8'); }
  catch (e) { return res.sendFile(indexPath); }

  const s = global.siteSettings || {};

  // ▲ إصلاح جوهري لمشكلة "الفراغ الرمادي جانباً وأسفل الصفحة": وسم viewport
  //   الأصلي يفرض عرضاً ثابتاً 400px (`width=400`) على كل الأجهزة مهما كان
  //   عرضها الفعلي — تصميم قديم يفترض شاشة واحدة بعرض ثابت. أي جهاز بعرض
  //   منطقي (CSS px) مختلف عن 400 بالضبط يظهر عنده فراغ (الخلفية الرمادية
  //   #40404f لعنصر body تحديداً) بقدر الفرق. أستبدله بـ device-width (عرض
  //   الجهاز الفعلي الحقيقي) وهو المعيار الصحيح لأي تصميم متجاوب.
  html = html.replace(
    /<meta name="viewport" content="[^"]*">/,
    '<meta name="viewport" content="width=device-width, user-scalable=0, interactive-widget=resizes-content">'
  );

  if (s.title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${sanitize(s.title, 200)}</title>`);
  }
  if (s.description) {
    const descEsc = sanitize(s.description, 1000).replace(/"/g, '&quot;');
    html = html.replace(/<meta name="description" content="[\s\S]*?">/, `<meta name="description" content="${descEsc}">`);
  }
  if (s.keywords) {
    const kwEsc = sanitize(s.keywords, 1000).replace(/"/g, '&quot;');
    html = html.replace(/<meta content="[\s\S]*?" name="keywords">/, `<meta content="${kwEsc}" name="keywords">`);
  }
  // ▲ إصلاح: اسم الموقع (name) كان يُحقَن فقط كوسم <title> عبر sett_title
  //   (حقل منفصل)، بينما حقل "اسم الموقع" (name/sett_name) نفسه لا يظهر في
  //   أي مكان بالصفحة الفعلية إطلاقاً. تحققتُ من index.html: اسم العلامة
  //   التجارية الثابت "شات السعودية للجوال" مكرر حرفياً 14 مرة في أماكن
  //   مختلفة من الصفحة (شعار الترويسة، عناوين شاشة الدخول...). استبدال كل
  //   نسخة منها باسم الموقع المحفوظ يجعله ينعكس أينما ظهر بالفعل بالصفحة.
  const DEFAULT_SITE_NAME = 'شات السعودية للجوال';
  if (s.name) {
    const nameEsc = sanitize(s.name, 100);
    html = html.split(DEFAULT_SITE_NAME).join(nameEsc);
  }
  // ═══════════════════════════════════════════════════════════════════════
  // إصلاحات تخطيط ثابتة — لا علاقة لها بألوان لوحة التحكم إطلاقاً، تُطبَّق
  // دائماً بغض النظر عن أي إعداد لون (منفصلة عمداً عن نظام الألوان أدناه
  // حتى لا تختلط الاثنتان ببعض مرة أخرى):
  //   1) viewport كان يفرض عرضاً ثابتاً 400px على كل الأجهزة (تصميم قديم) —
  //      أي جهاز بعرض منطقي مختلف يظهر عنده فراغ رمادي (خلفية body) بقدر
  //      الفرق. device-width هو العرض الفعلي الحقيقي لكل جهاز.
  //   2) الحاوية الرئيسية (.center-block.dad) كانت مقيَّدة max-width:394px
  //      ثابتة بنفس سطر index.html — نفس أثر مشكلة الـviewport بالضبط.
  //   3) صفوف الغرف والأعضاء (.room, .uzr) وحاويات القوائم لا تملأ عرضها
  //      بالكامل فعلياً — فراغ كان موجوداً دوماً لكنه غير مرئي (نفس لون
  //      محيطه)، ويصبح ظاهراً بمجرد أي تلوين مختلف؛ الإصلاح هنا دائم وغير
  //      مرتبط بوجود لون مخصص من عدمه، فلا يظهر الفراغ أبداً بأي حالة.
  html = html.replace(
    /<meta name="viewport" content="[^"]*">/,
    '<meta name="viewport" content="width=device-width, user-scalable=0, interactive-widget=resizes-content">'
  );
  const layoutSafetyCss = '<style>'
    + 'html,body{max-width:100vw;overflow-x:hidden;}'
    + '.center-block.dad{max-width:100%!important;}'
    + '.d2,#rooms,#users,#lonline,.uzr,.room{width:100%!important;box-sizing:border-box!important;}'
    + '#sett_keywords,#domain_keywords{max-width:260px!important;overflow-wrap:break-word;word-break:break-all;}'
    + '</style>';
  html = html.includes('</head>')
    ? html.replace('</head>', layoutSafetyCss + '</head>')
    : layoutSafetyCss + html;

  // ═══════════════════════════════════════════════════════════════════════
  // نظام الألوان — إعادة بناء نظيفة من الصفر، ثلاث قواعد فقط بلا أي تداخل
  // فيما بينها أو مع إصلاحات التخطيط أعلاه. كل قاعدة تستهدف فقط ما اتفقنا
  // عليه حرفياً، ولا شيء غيره:
  //
  //   • لون القالب (bg)      → .bg  فيما عدا body وأزرار شريط المايكات.
  //   • لون المحتوى (background) → خلفيات الرسائل/الغرف/الأعضاء وصفوفها.
  //   • لون الأزرار (buttons)     → أزرار .btn-primary/.label-primary فقط —
  //     كلاس bg-* (مثل bg-primary) مستقل تماماً، لا يظهر هنا إطلاقاً.
  // ═══════════════════════════════════════════════════════════════════════
  const hexOf = (v) => {
    const raw = String(v || '').trim().replace(/^#/, '');
    return /^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{3}$/.test(raw) ? '#' + raw : null;
  };
  const templateColor = hexOf(s.bg);
  const contentColor  = hexOf(s.background);
  const buttonsColor  = hexOf(s.buttons);
  const colorRules = [];
  if (templateColor) {
    colorRules.push(`.bg:not(body):not(#mic *){background-color:${templateColor} !important;}`);
  }
  if (contentColor) {
    // ▲ إصلاح (مستند "المرحلة الثالثة" — البند 1، النسخة الحالية): الإصدار
    //   السابق كان يُدرج .pmsgc/.ppmsgc/.hmsg هنا صراحةً استناداً لبند سابق
    //   نصّ على تطبيق لون المحتوى عليها أيضاً. النسخة الحالية من البند تنص
    //   صراحة: "الألوان الخاصة بالإعلانات تبقى كما هي إذا كانت محددة في
    //   القالب" + "رسائل النظام تُعامَل حسب إعدادها الصحيح" + "لا يتم إجبار
    //   جميع العناصر على لون واحد". تحققتُ من index.html: الثلاثة لها فعلاً
    //   خلفية ثابتة مقصودة بـ!important داخل القالب نفسه (لتمييزها بصرياً عن
    //   بعضها وعن المحتوى العادي): .pmsgc=rgba(0,77,255,.08) (أزرق فاتح)،
    //   .ppmsgc=#f1f1ff (بنفسجي فاتح جداً)، .hmsg=linen — وهذا بالضبط
    //   "إعدادها الصحيح" المقصود. لذلك حُذفت الثلاثة من هذه القاعدة فتعود
    //   تلقائياً لألوان القالب الثابتة دون أي CSS إضافي. لا تُعِد إدراجها هنا
    //   إلا إذا نصّ طلب لاحق صراحة على ذلك مجدداً.
    colorRules.push(`.d2,#rooms,#users,#lonline,.uzr,.room{background-color:${contentColor} !important;}`);
  }
  if (buttonsColor) {
    colorRules.push(`.label-primary,.btn-primary,.label-primary:hover,.btn-primary:hover,.btn-primary:focus{background-color:${buttonsColor} !important;background-image:none !important;}`);
  }
  if (colorRules.length) {
    const styleTag = `<style>${colorRules.join('')}</style>`;
    html = html.includes('</head>')
      ? html.replace('</head>', styleTag + '</head>')
      : styleTag + html;
  }

  // ▲ إعادة تنفيذ ميزة "محظوري الغرفة" (البند 53/54 السابقين) دون أي تعديل
  //   على ملف index.html نفسه إطلاقاً — بناءً على طلب صريح. بدل تحرير الملف
  //   على القرص، يُحقن نفس العنصرين (الحاوية + السكربت) بالسلسلة النصية هنا
  //   وقت خدمة كل طلب، فيبقى index.html الفعلي كما هو تماماً بلا أي تغيير،
  //   والنتيجة التي يستلمها المتصفح مطابقة 100% لما كانت عليه بالنسخة
  //   المُعدَّلة يدوياً سابقاً.
  const opsAnchor = '<div class="break border corner" id="ops" style="width:100%;padding:2px;">\n              </div>';
  if (html.includes(opsAnchor)) {
    const rbansBlock = opsAnchor
      + '\n              <label style="width:100%;display:block;font-size:11px;color:#888;margin:4px 0 0 2px;">محظورين من الغرفة مؤقتاً</label>'
      + '\n              <div class="break border corner" id="rbans" style="width:100%;padding:2px;">\n              </div>';
    html = html.replace(opsAnchor, rbansBlock);
  }
  const rbansScript = `<script>
(function () {
  var lastList = null;
  function renderRoomBans(list) {
    lastList = list;
    var c = $('#rbans');
    if (!c.length) return;
    c.children().remove();
    if (!list || !list.length) {
      c.append('<div style="padding:4px;color:#aaa;font-size:12px;">لا يوجد محظورين حالياً</div>');
      return;
    }
    list.forEach(function (item) {
      var row = $($('#uhead').html()).css('background-color', 'white');
      row.find('.u-pic').css('width', '24px').css('height', '24px').css('background-image', 'url("' + item.pic + '")');
      var mins = Math.max(0, Math.round((item.until - Date.now()) / 60000));
      row.find('.u-topic').html(item.topic + ' <small style="color:#c00;">(يتبقى ' + mins + ' د)</small>');
      row.css('width', '98%');
      row.prepend('<button onclick="send(\\'rban-\\',{lid:\\'' + item.lid + '\\'});" class="btn-danger fa fa-times"></button>');
      c.append(row);
    });
  }
  // ▲ تحديث فوري حقيقي (بنفس اللحظة) عبر EventSource بدل استطلاع دوري متأخر
  //   حتى 4 ثوانٍ. EventSource مدعومة أصلاً بكل متصفح وتُعيد الاتصال تلقائياً
  //   عند أي انقطاع دون أي كود إضافي — مستقلة تماماً عن appraad2.js.
  var es = null, esRoom = null;
  function connect() {
    if (typeof myroom === 'undefined' || !myroom || myroom === esRoom) return;
    if (es) { es.close(); }
    esRoom = myroom;
    es = new EventSource('/api/roombans-stream?room=' + encodeURIComponent(myroom));
    es.onmessage = function (e) {
      try { renderRoomBans(JSON.parse(e.data)); } catch (err) {}
    };
  }
  setInterval(connect, 1000); // يتحقق فقط من تغيّر الغرفة (بلا أي طلب شبكة) ليعيد الاتصال بالغرفة الصحيحة عند التنقل بين الغرف
  connect();
  setInterval(function () { if (lastList) renderRoomBans(lastList); }, 30000); // إعادة رسم دورية خفيفة (بلا شبكة) لتحديث نص "يتبقى X د" فقط
})();
</script>`;
  const closeBodyTagRbans = '</body>';
  html = html.includes(closeBodyTagRbans)
    ? html.replace(closeBodyTagRbans, rbansScript + closeBodyTagRbans)
    : html + rbansScript;

  // ▲ إصلاح جوهري (اكتُشف عبر رسالة خطأ فعلية بالمتصفح: "ReferenceError:
  //   nopm is not defined" / "nonot is not defined"): زرا "تعطيل المحادثات
  //   الخاصة" و"تعطيل التنبيهات" بـindex.html يقرآن المتغيّرين nopm/nonot
  //   مباشرة (`if (nopm) {...}`) قبل أي تعريف لهما بأي مكان بالصفحة كلها —
  //   لا appraad2.js ولا أي سكربت آخر يُعرِّفهما. قراءة متغيّر غير مُعرَّف
  //   إطلاقاً (بخلاف متغيّر مُعرَّف بقيمة undefined) تُطلق ReferenceError
  //   فوراً عند نقطة `if`، فلا يُنفَّذ أي من الفرعين (لا then ولا else) —
  //   هذا سبب توقّف العلامة ✓ عن الاستجابة كلياً من أول ضغطة، لا علاقة له
  //   بمنطق nonotScript أدناه (الذي يعمل بشكل صحيح لو وصل لمرحلة التنفيذ
  //   أصلاً). typeof آمن هنا تحديداً (بخلاف القراءة المباشرة) لأنه لا يُطلق
  //   استثناءً على متغيّر غير مُعرَّف.
  const globalsInitScript = '<script>'
    + 'if (typeof nopm  === "undefined") { window.nopm  = false; }'
    + 'if (typeof nonot === "undefined") { window.nonot = false; }'
    + '</script>';
  html = html.includes(closeBodyTagRbans)
    ? html.replace(closeBodyTagRbans, globalsInitScript + closeBodyTagRbans)
    : html + globalsInitScript;

  // ▲ إضافة: appraad2.js زر "تعطيل التنبيهات" يبدّل متغيّر nonot المحلي
  //   ويحدّث علامة ✓ بصرياً فقط، ولا يرسل أي شيء للسيرفر إطلاقاً (بخلاف زر
  //   "تعطيل المحادثات الخاصة" المجاور له الذي يرسل busy فعلياً) — البند
  //   الثاني عشر بالمستند. سكربت مستقل تماماً (لا يلمس الزر الأصلي ولا
  //   onclick الحالي، فقط يضيف مستمعاً إضافياً على نفس العنصر) يرسل الحالة
  //   الفعلية فور الضغط، بعد أن يكون onclick الأصلي (المُسجَّل أولاً كسمة
  //   inline) قد بدّل قيمة nonot بالفعل.
  const nonotScript = `<script>
(function () {
  function bind() {
    var el = $('label:contains("تعطيل التنبيهات")').first();
    if (!el.length || el.data('nonotBound')) return;
    el.data('nonotBound', true);
    el.on('click', function () {
      setTimeout(function () {
        if (typeof nonot !== 'undefined' && typeof send === 'function') send('nonot', { nonot: nonot });
      }, 0);
    });
  }
  setInterval(bind, 1000); // العنصر داخل نافذة تُبنى ديناميكياً، فقد يظهر متأخراً
  bind();
})();
</script>`;
  html = html.includes(closeBodyTagRbans)
    ? html.replace(closeBodyTagRbans, nonotScript + closeBodyTagRbans)
    : html + nonotScript;

  if (s.script) {
    // ▲ إصلاح جوهري: إذا احتوى السكربت المخصص المحفوظ على أي تسلسل حرفي
    //   يشبه "</script" (حتى عرضاً، كتعليق أو نص داخل سلسلة نصية بالسكربت
    //   نفسه)، كان يُغلق وسم <script> المُحقَن مبكراً، فيتحوّل باقي محتوى
    //   السكربت (كل ما بعد ذلك التسلسل) إلى نص HTML خام ظاهر مباشرة في
    //   الصفحة، وقد يُربك مُحلِّل HTML بالمتصفح (خصوصاً لو تضمّن وسوماً غير
    //   مكتملة) فيُعيد بناء الصفحة بشكل غير متوقع — وهذا التفسير الأرجح
    //   لتضخّم/ازدواج محتوى الصفحة الذي ظهر فعلياً في اختبارك، وليس له أي
    //   علاقة بلون الخلفية إطلاقاً (تغيير background-color لا يمكنه
    //   فيزيائياً التأثير على أبعاد/ارتفاع أي عنصر في CSS). الحل: تفكيك أي
    //   تسلسل "</script" داخل محتوى السكربت المحفوظ قبل الحقن.
    const safeScript = String(s.script).replace(/<\/script/gi, '<\\/script');
    // سكربت المبرمج المخصص — يُحقن قبل نهاية body (بعد appraad2.js) كما في نمط /cp
    const closeBodyTag = '</body>';
    const customScript = '<script>' + safeScript + '</script>';
    html = html.includes(closeBodyTag)
      ? html.replace(closeBodyTag, customScript + closeBodyTag)
      : html + customScript;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

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

  // ▲ إصلاح: نفس تعريف nopm/nonot الناقص المُصلَح بمسار / أعلاه — /cp يخدم
  //   نفس index.html (فيه نفس الزرين فعلياً)، فنفس ReferenceError ممكن هنا
  //   أيضاً لو ضُغط عليهما داخل نافذة CP لأي سبب.
  const cpGlobalsInitScript = '<script>'
    + 'if (typeof nopm  === "undefined") { window.nopm  = false; }'
    + 'if (typeof nonot === "undefined") { window.nonot = false; }'
    + '</script>';
  html = html.includes('</body>')
    ? html.replace('</body>', cpGlobalsInitScript + '</body>')
    : html + cpGlobalsInitScript;

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

// ▲ إضافة: appraad.js يرسل likem/reply بمعرّف الرسالة (mi) فقط دون أي بيانات
//   عن صاحبها — ولا يوجد أي تخزين للرسائل العامة إطلاقاً (بخلاف الحائط
//   المخزَّن فعلياً في globalWall أعلاه). دون هذا التخزين يستحيل معرفة من
//   يجب إشعاره عند إعجاب/رد على رسالته، أو حتى معرفة عدد اللايكات الحقيقي.
//   محدودة الحجم عمداً (تُبقي آخر MAX_RECENT_MSGS فقط) لتفادي أي تسرّب ذاكرة.
const recentMessages = new Map(); // mi -> {uid, lid, topic, pic, likes, roomid}
const MAX_RECENT_MSGS = 300;
function trackMessage(mi, payload, roomid) {
  recentMessages.set(mi, { uid: payload.uid, lid: payload.lid, topic: payload.topic, pic: payload.pic, likes: 0, roomid });
  if (recentMessages.size > MAX_RECENT_MSGS) {
    recentMessages.delete(recentMessages.keys().next().value); // إزالة الأقدم (ترتيب الإدراج بالـMap مضمون بمعيار JS)
  }
}
// ▲ إضافة: منع تكرار الإعجاب لنفس العنصر خلال دقيقة واحدة (طلب صريح) — يشمل
//   لايكات الرسائل العامة/الحائط/الإعجاب الشخصي UPRO معاً بنفس الآلية.
const lastLikeAt = new Map(); // `${likerUid}:${targetKey}` -> timestamp
function likeCooldownRemaining(likerUid, targetKey) {
  const last = lastLikeAt.get(`${likerUid}:${targetKey}`);
  if (!last) return 0;
  const elapsed = Date.now() - last;
  return elapsed < 60000 ? Math.ceil((60000 - elapsed) / 1000) : 0;
}
function markLiked(likerUid, targetKey) {
  lastLikeAt.set(`${likerUid}:${targetKey}`, Date.now());
  if (lastLikeAt.size > 5000) {
    lastLikeAt.delete(lastLikeAt.keys().next().value);
  }
}


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
/** تسمية عربية مقروءة لكل نوع إجراء، تُعرض بعمود "الحاله" في تبويب الحالات بدل اسم الأمر البرمجي */
function actionTypeLabel(type) {
  const labels = {
    kick: 'طرد عضو', ban: 'حظر عضو', aban: 'رفع حظر', unban: 'رفع حظر',
    delu: 'حذف عضوية', setpower: 'تغيير صلاحية', pwd: 'تغيير كلمة مرور',
    delpic: 'حذف صورة', roomkick: 'طرد من الغرفة',
    'op+': 'تعيين مشرف', 'op-': 'إزالة مشرف',
    'r+': 'إنشاء غرفة', 'r^': 'تعديل غرفة', 'r-': 'حذف غرفة',
    v: 'تفعيل/تعطيل مايك الغرفة',
    dmsg: 'حذف رسالة', delbc: 'حذف منشور حائط', cleanbc: 'تنظيف منشورات عضو',
    unick: 'تغيير اسم عضو', rinvite: 'نقل عضو لغرفة',
    bnr: 'تعيين بنر', 'bnr-': 'إزالة بنر',
    setLikes: 'تعديل إعجابات', likes: 'تعديل إعجابات',
    uml: 'سحب من المايك', umm: 'قفل مايك عضو', uma: 'تفعيل مايك عضو',
    micstat: 'تعديل حالة مقعد مايك',
    addico: 'إضافة أيقونة', delico: 'حذف أيقونة',
    bot_save: 'حفظ إعدادات البوتات', 'bot-new': 'إنشاء بوت',
    'bot-edit': 'تعديل بوت', 'bot-del': 'حذف بوت',
    msgsit: 'إضافة رسالة جاهزة', msgsdel: 'حذف رسالة جاهزة',
    shrtdel: 'حذف اختصار', fltrit: 'إضافة كلمة فلتر', fltrdel: 'حذف كلمة فلتر',
    gift: 'إرسال هدية', emo_order: 'ترتيب الإيموجيات',
    powers_save: 'حفظ صلاحية', powers_del: 'حذف صلاحية',
    sitesave: 'حفظ إعدادات الموقع', owner_save: 'حفظ إعدادات المالك',
    domainsave: 'حفظ نطاق', domaindel: 'حذف نطاق',
    favicon: 'تغيير أيقونة الموقع', prv1: 'تغيير صورة الموقع',
    pic: 'تغيير الصورة الافتراضية للعضو', room: 'تغيير الصورة الافتراضية للغرفة',
    report: 'بلاغ عن عضو'
  };
  return labels[type] || type;
}

function logAction(actor, type, target = null, extra = '') {
  const targetLabel = typeof target === 'string'
    ? target
    : (target?.topic || target?.lid || '');
  actionsLog.push({
    type,                                     // appraad: "الحاله" — يُترجَم للعربية عند العرض (راجع actionTypeLabel)
    u1:      actor?.topic || actor?.lid || '', // appraad: "العضو" (من قام بالإجراء)
    u2:      targetLabel + (extra ? ` — ${extra}` : ''), // appraad: "العضو الثاني" (الهدف)
    room:    (actor?.roomid && rooms.get(actor.roomid)?.name) || '',
    ip:      actor?._ip || '',
    created: Date.now()                       // appraad: يُستخدم لحساب "الوقت"
  });
  if (actionsLog.length > MAX_ACTIONS_LOG) actionsLog.shift();
}

// ▲ إضافة (البند الثالث بمستند "المرحلة الثالثة"): سجل تسجيل الدخول —
//   منفصل تماماً عن actionsLog أعلاه عمداً (المستند صريح: "ليس سجلاً عاماً
//   لجميع العمليات الإدارية"). يُسجَّل فيه حصراً 4 حالات (وليس 5 كما يبدو
//   ظاهرياً بالمستند: "دخول زائر" ناجح و"تسجيل عضو جديد" ناجح لا حالة فشل
//   موازية لهما مذكورة، فلا تُسجَّل حالات فشل الزائر/التسجيل الأخرى):
//   عضو جديد (نجاح reg) / تسجيل دخول (نجاح login) / زائر (نجاح g) /
//   كلمة سر خاطئة (فشل login بسبب كلمة المرور تحديداً) / مستخدم محظور
//   (فشل g أو login بسبب حظر — pickJoinableRoom لم يجد غرفة متاحة).
const loginLog = [];
const MAX_LOGIN_LOG = 1000;
function logLogin(username, status, ip) {
  loginLog.push({ u: username || '', status, ip: ip || '', created: Date.now() });
  if (loginLog.length > MAX_LOGIN_LOG) loginLog.shift();
}

const SESSION_TTL = 5 * 60 * 1000; // 5 دقائق

// ▲ إضافة: عتبتا أيقونة الحضور (.ustat في appraad2.js — راجع computeStat()
//   وتعليق pub() أدناه لتفاصيل كل قيمة). لا مدة محددة صراحةً بطلب مهلة
//   الانتظار بعد قطع الاتصال — القيمة الحالية قابلة للتعديل بهذا السطر فقط.
const IDLE_MS             = 3 * 60 * 1000; // 3 دقائق بلا أي نشاط ⇒ stat=1
const DISCONNECT_GRACE_MS = 30 * 1000;      // 30 ثانية انتظار بعد قطع الاتصال ⇒ stat=3

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
    this.giftIco  = fields.giftIco || ''; // ▲ إضافة: اسم ملف الهدية الحالية (مجلد dro3) دون أي بادئة
    this.nopm     = fields.nopm  || false; // ▲ إضافة: تعطيل استقبال الرسائل الخاصة
    this.nonot    = fields.nonot || false; // ▲ إضافة: تعطيل استقبال التنبيهات
    this.refr     = fields.refr  || '';
    this.created  = Date.now();
    // ▲ إضافة: تاريخ إنشاء الحساب الفعلي (يُستخدم لشرط wall_minutes) —
    //   افتراضياً يساوي created (وقت بدء الجلسة، أي للزوار)، ويُستبدَل
    //   بتاريخ الحساب الحقيقي acc.created عند تسجيل الدخول كعضو.
    this.accCreated = this.created;
    this.last     = Date.now();
    // ▲ إضافة: حالة أيقونة الحضور (.ustat) — راجع computeStat()/refreshUserStat().
    this._stat      = null;   // آخر قيمة stat بُثَّت فعلياً (لتفادي بث مكرر بلا تغيير)
    this._discGrace = false;  // true أثناء مهلة انتظار إعادة الاتصال (stat=3)
    this._discTimer = null;   // مؤقت الطرد الفعلي بعد انتهاء DISCONNECT_GRACE_MS
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
      s:        this.s || null,   // appraad.js: logItem.s == null → غير متخفٍ
      // ▲ إصلاح: appraad2.js يبني "imgs/s"+stat+".png" لأيقونة الحالة (.ustat)
      //   ويحدّثها فوراً عند استقبال أي u^ يتضمّن حقل stat (دالة تحديث الواجهة
      //   حول السطر 3226/3257/3292/3304 من appraad2.js). هذا الحقل لم يكن
      //   موجوداً إطلاقاً فكانت تظهر "sundefined.png" دائماً. المخطط الكامل
      //   (طلب صريح لاحق): 0=نشط، 1=خامل 3 دقائق، 2=قفل الخاص(nopm)،
      //   3=بانتظار إعادة الاتصال. المصدر الموحَّد لكل هذه القيم: computeStat().
      stat:     computeStat(this)
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
    // ▲ إصلاح: كانت هذه القيم ثابتة دائماً بغض النظر عمّا حفظه المشرف فعلياً
    //   بـ"خيارات الموقع" (sitesave) — أي غرفة جديدة تُنشأ كانت تتجاهل ذلك
    //   الإعداد تماماً وتبدأ بالقيم الافتراضية الثابتة أدناه دوماً. الآن ترث
    //   القيمة الحالية المحفوظة فعلياً إن وُجدت، وإلا تستخدم نفس الافتراضي
    //   السابق كما هو (لا تغيير لأي غرفة/سلوك موجود مسبقاً).
    const _gs = global.siteSettings || {};
    this.settings = {
      mic:      _gs.mic      ?? true,
      setpower: true,
      ban:      true,
      owner:    true,
      calls:    _gs.calls    ?? true,
      mlikes:   _gs.mlikes   ?? true,
      bclikes:  _gs.bclikes  ?? true,
      mreply:   _gs.mreply   ?? true,
      bcreply:  _gs.bcreply  ?? true
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
    // ▲ إصلاح معماري: this.bans (حظر عام) أصبحت globalBans (متغيّر عام
    //   على مستوى الموقع بأكمله، وليس لكل غرفة على حدة — راجع isBanned).
    // ▲ إضافة: this.roomBans — حظر مؤقت خاص بهذه الغرفة فقط (٢٠ دقيقة بعد
    //   الطرد منها تحديداً عبر roomkick)، منفصل تماماً عن الحظر العام أعلاه
    //   ولا يُضاف لقائمة الحظر بلوحة التحكم. lid → { until, byLid, byName, reason }
    this.roomBans = new Map();
  }
}

// ─── مساعدات ──────────────────────────────────────────────────────────────────
function genId() {
  return uuidv4().replace(/-/g, '').slice(0, 16);
}

// ▲ إضافة: تحويل الأرقام العربية (١٢٣...) والفارسية الممتدة (۱۲۳...) إلى
//   إنجليزية قبل أي إرسال/حفظ. أُضيفت داخل sanitize نفسها (نقطة التنظيف
//   الموحَّدة المستخدمة بكل مكان: عام/خاص/حائط/إعلانات عامة وخاصة/تنبيهات/
//   ترحيب/تلقائية) فتغطي كل الحالات المطلوبة بتعديل واحد فقط دون تكرار.
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function convertDigits(str) {
  return str.replace(/[٠-٩۰-۹]/g, (d) => {
    const ai = ARABIC_DIGITS.indexOf(d);
    if (ai !== -1) return String(ai);
    const pi = PERSIAN_DIGITS.indexOf(d);
    return pi !== -1 ? String(pi) : d;
  });
}
function sanitize(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return convertDigits(str).replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, maxLen);
}

// ▲ إصلاح جوهري (سبب ظهور الصور بيضاء/فارغة عند الإرسال بالخاص أو الحائط):
//   appraad2.js لا يقرأ أي حقل "link" منفصل من الرسالة الواردة إطلاقاً —
//   تحققتُ من الملف بالكامل ولا يوجد أي "‎.link"‎ أو ‎["link"]‎ في أي مكان.
//   الآلية الحقيقية: دالة عرض الرسائل تفحص نص الرسالة (msg) نفسه بحثاً عن
//   وسم <a class="uplink" href="..."> ثم تُحوِّله تلقائياً لصورة/فيديو/صوت
//   فعلي حسب امتداد الملف في href (راجع "a.uplink" في appraad2.js). كان
//   كودي يُرسل الرابط في حقل payload.link منفصل تماماً — لا يُقرأ أبداً،
//   فتظهر فقاعة الرسالة فارغة/بيضاء دائماً. الحل: تضمين الرابط داخل نص
//   الرسالة نفسه بهذا الوسم بدل إرساله كحقل مستقل.
function wrapUplink(link) {
  const safeLink = sanitize(String(link || ''), 500);
  if (!safeLink) return '';
  return `<a class="uplink" href="${safeLink}">${safeLink}</a>`;
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
/** تسمية عربية مقروءة لعرضها في عمود "التصنيف" بلوحة التحكم (index.html يعرض type كما هو حرفياً) */
function filterTypeLabel(type) {
  return { allow: 'مسموحة', ban: 'ممنوعة', watch: 'مراقبة' }[type] || type;
}
/** بناء قائمة الفلتر الجاهزة للإرسال عبر cp_fltr.a */
function buildFilterList() {
  return getFiltersArr().map(f => ({
    id: f.id, path: `${f.type}/${f.id}`, v: f.v, type: filterTypeLabel(f.type)
  }));
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

// ▲ إضافة: مصدر موحَّد لحالة أيقونة الحضور (.ustat في appraad2.js — راجع
//   تعليق pub() أعلاه). تُستخدَم من pub() نفسها (اللقطة الكاملة) ومن
//   refreshUserStat() أدناه (تحديثات u^ الجزئية عند تغيّر النشاط/الاتصال).
//   الأولوية: قطع الاتصال > قفل الخاص > الخمول > نشط.
function computeStat(user) {
  if (user._discGrace) return 3;                              // بانتظار إعادة الاتصال
  if (user.nopm)        return 2;                              // قفل الخاص
  if (Date.now() - (user.last || 0) >= IDLE_MS) return 1;      // خامل
  return 0;                                                    // نشط
}

/** يعيد حساب stat الحالي، ويبثّه عبر u^ (نفس حدث appraad2.js الموجود) فقط
 *  إذا تغيّر فعلياً عن آخر قيمة بُثَّت — لتفادي بث متكرر بلا فائدة. */
function refreshUserStat(user) {
  const next = computeStat(user);
  if (next === user._stat) return;
  user._stat = next;
  if (user.roomid) toRoom(user.roomid, 'u^', { id: user.id, stat: next });
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

/** حظر عام على مستوى الموقع بالكامل (وليس غرفة واحدة) */
// ▲ إصلاح معماري جوهري: كان الحظر مُخزَّناً في room.bans (خاصية على كل
//   غرفة على حدة)، فيستطيع العضو المحظور من غرفة أن يدخل بقية الغرف دون
//   أي عائق — يتناقض هذا كلياً مع الوصف الصريح للميزة ("حظر من دخول
//   الشات" أي الموقع كاملاً وليس غرفة بعينها). الحظر الآن قائمة واحدة
//   عامة على مستوى الموقع بأكمله.
const globalBans = [];

/** هل المستخدم محظور؟ ترجع القيد المطابق نفسه (وليس true/false فقط) حتى
 *  يتمكن المستدعي من عرض الوقت المتبقي (expires) في رسالة الرفض. */
// ▲ إصلاح: أُضيف دعم الحظر بالبصمة (fp) بمستويات "عمق" مختلفة، مطابقةً لقوائم
//   appraad2.js (حظر / حظر عميق 1-4) القادمة عبر cp_fps و uh (كشف النكات).
//   كلما زاد العمق (depth) قصرت البادئة المطلوب تطابقها من الـ fp → حظر أوسع
//   يشمل بصمات أكثر تشابهاً جزئياً (نفس الجهاز/الشبكة تقريباً).
// ▲ إضافة: دعم انتهاء الصلاحية التلقائي (expires) — الحظر المؤقت (20 دقيقة،
//   من زر "حظر" في نافذة الملف الشخصي upro) يُصبح غير فعّال تلقائياً بعد
//   انقضاء مدته، مع تنظيف ذاتي كسول (active=false) بمجرد اكتشاف الانتهاء
//   عند أي تحقق لاحق — فيختفي تلقائياً من قائمة الحظر بلوحة التحكم أيضاً.
const BAN_DEPTH_PREFIX_LEN = [Infinity, 24, 16, 10, 6]; // [0]=مطابقة كاملة
function isBanned(user) {
  for (const b of globalBans) {
    if (!b.active) continue;
    if (b.expires && Date.now() > b.expires) { b.active = false; continue; }
    let matched = false;
    if (b.lid && b.lid === user.lid) matched = true;
    else if (b.ip && b.ip === user._ip) matched = true;
    // ▲ إصلاح: أُعيدت تسمية حقل الدولة الداخلي إلى "country" (بدل "co")
    //   لتفادي تعارض مع حقل "co" الذي يقرأه appraad2.js فعلياً لعمود
    //   "الحالات" (عدد مرات تفعيل الحظر) في جدول cp_bans — تسمية مختلفة
    //   تماماً استخدمها المطوّر الأصلي لغرض آخر بالمصادفة.
    else if (b.country && b.country === user.co && user.co !== '--') matched = true;
    else if (b.fp) {
      const depth = Math.min(b.depth || 0, BAN_DEPTH_PREFIX_LEN.length - 1);
      const len   = BAN_DEPTH_PREFIX_LEN[depth];
      const bfp   = len === Infinity ? b.fp     : b.fp.slice(0, len);
      const ufp   = len === Infinity ? user._fp : (user._fp || '').slice(0, len);
      if (bfp && ufp && bfp === ufp) matched = true;
    }
    if (matched) {
      // ▲ إضافة: تتبع فعلي لعدد مرات تفعيل الحظر ووقت آخر مرة (عمودا
      //   "الحالات"/"آخر حالة" في جدول لوحة التحكم — كانا يعرضان قيماً
      //   ثابتة دائماً من قبل).
      b.count = (b.count || 0) + 1;
      b.last  = Date.now();
      return b;
    }
  }
  return null;
}

/** نص عربي لطيف يصف المدة المتبقية لحظر مؤقت */
function remainingTimeText(expires) {
  const ms = expires - Date.now();
  if (ms <= 0) return '';
  const mins = Math.ceil(ms / 60000);
  return mins <= 1 ? 'دقيقة واحدة' : `${mins} دقيقة`;
}

/** تحويل قائمة الحظر الداخلية لتنسيق السلك الذي يقرأه appraad2.js فعلياً
 *  في جدول "الحظر" بلوحة التحكم: user, type, date, co, lc (تحققتُ من هذه
 *  الأسماء حرفياً من appraad2.js — لا علاقة لها بأسماء الحقول الداخلية) */
function buildBanList() {
  return globalBans.filter(b => b.active).map(b => ({
    id:   b.id || b.type || b.ip || b.country || b.fp,
    user: b.name || b.lid || b.ip || b.country || (b.fp ? `بصمة: ${b.fp}` : ''),
    type: b.type || b.ip || b.country || b.fp || '',
    date: b.expires ? remainingTimeText(b.expires) || 'منتهي' : 'دائم',
    co:   b.count || 0,
    lc:   b.last ? new Date(b.last).toLocaleString('ar') : ''
  }));
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

// ────────────────────────────────────────────────────────────────────────────
// ▲ إضافة: حساب/مزامنة الأيقونة المعروضة بجانب اسم المستخدم (user.ico)
//
// appraad2.js (لا يجوز تعديله) يحسب الأيقونة بدالته الداخلية بهذا الترتيب
// بالضبط (تم تتبعه من الكود المُبهم حرفياً):
//   1) user.b غير فارغ            → "sico/" + user.b            (أعلى أولوية)
//   2) رتبة user.power لها ico    → "sico/" + رتبة.ico           (تُحسب حياً)
//   3) غير ذلك: user.ico كما هو   → "dro3/" + user.ico (بعد إزالة أي "dro3/" سابقة)
// المشكلة: هذا الحساب الذكي (٣ خطوات) يحدث فقط في بعض أماكن العرض؛ أماكن
// أخرى (~15 موضع رصدتها في u-ico) تقرأ user.ico مباشرة بلا أي حساب رتبة —
// فتظهر الأيقونة فارغة لأي عضو صاحب رتبة لم يُحفظ له ico مطابق يدوياً.
// الحل هنا لا يلمس appraad2.js إطلاقاً: بدلاً من ذلك، نُخزّن في user.ico
// نفسه المسار الكامل الجاهز (بادئة sico/ أو dro3/ مطابقة تماماً لما تحسبه
// الدالة الذكية) — فتتطابق كل الأماكن تلقائياً سواء استخدمت الحساب الذكي أو
// قرأت user.ico مباشرة، دون أي تعديل على appraad2.js.
//
// الأولوية هنا: صلاحية المستخدم (رتبته) > هدية مُهداة له (giftIco) > فارغ.
// أي عضو يملك أي صلاحية من قائمة الصلاحيات لا يجوز إهداؤه أصلاً (يُطبَّق في
// case 'gift' أدناه)، فلا تعارض بين الحالتين، لكن العضو الذي يملك هدية ثم
// يُرقَّى لاحقاً لرتبة: تظهر أيقونة رتبته (وتُخفى الهدية تلقائياً دون حذفها)،
// وإن أُزيلت رتبته لاحقاً تظهر هديته المحفوظة تلقائياً من جديد.
// ────────────────────────────────────────────────────────────────────────────
function computeUserIco(user) {
  const def = user.power ? globalPowers.find(p => p.name === user.power) : null;
  if (def && def.ico) return 'sico/' + def.ico;
  if (user.giftIco) return 'dro3/' + user.giftIco;
  return '';
}

function syncIco(user) {
  const wanted = computeUserIco(user);
  if ((user.ico || '') === wanted) return false;
  user.ico = wanted;
  saveAccount(user, { ico: user.ico, giftIco: user.giftIco || '' });
  if (user.roomid) toRoom(user.roomid, 'u^', user.pub());
  // ▲ إصلاح: recentLogins (تُغذّي قائمة "المتواجدين في الدردشة" 'online')
  //   تُخزّن نسخة (snapshot) من pub() وقت الدخول فقط، ولا تتحدّث تلقائياً
  //   بعدها أبداً — فتبقى الأيقونة القديمة (أو الفارغة) ظاهرة في هذه
  //   القائمة تحديداً حتى لو تغيّرت رتبة/هدية العضو لاحقاً وتحدّثت بكل مكان
  //   آخر بشكل صحيح. نحدّث نفس النسخة المخزّنة هنا مباشرة لتبقى متطابقة.
  const idx = recentLogins.findIndex(u => u.id === user.id);
  if (idx !== -1) recentLogins[idx] = user.pub();
  return true;
}

/** نفس منطق computeUserIco لكن لحساب/تحديث حساب غير متصل حالياً (acc خام) */
function syncIcoOffline(acc) {
  const def = acc.power ? globalPowers.find(p => p.name === acc.power) : null;
  const wanted = (def && def.ico) ? ('sico/' + def.ico) : (acc.giftIco ? ('dro3/' + acc.giftIco) : '');
  acc.ico = wanted;
}

// ▲ إصلاح جذري وشامل: appraad2.js يقرر إظهار/إخفاء أزرار اللايك/الرد اعتماداً
//   حصرياً على آخر حدث 'settings' وصله (لا علاقة له بأي تحديث لاحق بعده) —
//   وكان هناك أكثر من نقطة بث settings بالسيرفر، بعضها يرسل من room.settings
//   (قد يتأخر تزامنه مع الإعداد الحقيقي لحظياً حسب ترتيب الأحداث) وبعضها
//   كان يرسل قيماً ثابتة يدوياً بالكامل (السبب الجذري المُصلَح قبل قليل).
//   بدل الاعتماد على تزامن room.settings الصحيح في كل نقطة بث على حدة، هذه
//   الدالة تفرض القيم الحقيقية الحالية من global.siteSettings مباشرة —
//   المصدر الوحيد الذي يكتبه sitesave فعلياً — فوق أي إعداد غرفة، في كل بث
//   settings بلا استثناء. يقضي هذا نهائياً على أي احتمال تعارض/تأخر مستقبلي.
const SHARED_TOGGLE_KEYS = ['bclikes', 'mlikes', 'mreply', 'bcreply', 'calls', 'mic'];
function liveSettings(base) {
  const gs = global.siteSettings || {};
  const merged = Object.assign({}, base || {});
  for (const k of SHARED_TOGGLE_KEYS) {
    if (gs[k] !== undefined) merged[k] = !!gs[k];
  }
  return merged;
}

// ▲ إضافة: دالة إشعار موحّدة — تحترم تعطيل التنبيهات (nonot) لدى المستلم،
//   مع استثناء صريح لمن يملك صلاحية "alert" ("التنبيهات" بمحرر الرتب) —
//   طلب صريح بالبند الثاني عشر. تُستخدم من كل نقاط إرسال 'not' بدل تكرار
//   نفس منطق الفحص/البحث عن socket المستلم بكل حالة على حدة.
// ▲ إضافة: تُرجِع Boolean (وصلت أم حُجبت) — لا تُرسل رسالة "هذا المستخدم
//   عطّل التنبيهات" للمُرسِل تلقائياً من هنا (لأن 4 من نقاط الاستدعاء الـ6
//   إشعارات جانبية تلقائية لإعجاب/رد، لا محاولة إرسال تنبيه متعمَّدة — إخبار
//   المُعجِب أن صاحب المنشور "عطّل التنبيهات" كل مرة يضغط فيها لايك إزعاج لا
//   داعي له). القرار متروك للمُستدعي عبر القيمة المُرجَعة؛ نقطتا زر "تنبيه"
//   (.unot) تحديداً تستخدمانها لتطبيق نص الطلب الصريح بالبند 12.
function notifyUser(fromUser, toUser, msg, extra = {}) {
  if (!toUser) return false;
  if (toUser.nonot && !hasPower(fromUser, null, 'alert')) return false;
  const ts = io.sockets.sockets.get(toUser.socketId);
  if (!ts) return false;
  send(ts, 'not', Object.assign({
    user: fromUser.id, uid: fromUser.id, topic: fromUser.topic, pic: fromUser.pic, t: Date.now()
  }, { msg }, extra));
  return true;
}

// ▲ إصلاح (كشف بصمة الجهاز يعرض JSON خام): كان يُخزَّن navigator.n الخام
//   كنص JSON مباشرة فيظهر للمشرف حرفياً {"a":"...","pri":...} بدل بصمة
//   مختصرة مقروءة. الدالة هنا حتمية بالكامل (نفس الجهاز ⇐ نفس الناتج دائماً،
//   ضروري لبقاء صحة المطابقة بالحظر بالبصمة كما هي) بلا أي مكتبة خارجية:
//   نظام التشغيل من الـUser-Agent (مصدر أوثق من محاولة تخمينه من fp نفسها)،
//   ثم عدة أجزاء قصيرة (هاش بسيط) من مجموعات مختلفة من بيانات الجهاز
//   (الشاشة/المنطقة الزمنية/الإضافات..)، بنفس شكل المثال المطلوب.
function simpleHash(v) {
  const str = String(v ?? '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0; }
  return Math.abs(hash).toString(36).padStart(3, '0').slice(0, 4);
}
function shortFingerprint(fp, userAgent) {
  fp = fp || {};
  const ua = userAgent || '';
  const os = /android/i.test(ua) ? 'Android'
    : /iphone|ipad|ipod/i.test(ua) ? 'iOS'
    : /windows/i.test(ua) ? 'Windows'
    : /mac os/i.test(ua) ? 'Mac'
    : /linux/i.test(ua) ? 'Linux'
    : 'Unknown';
  const scr = fp.screen || {};
  const parts = [
    simpleHash(fp.devicePixelRatio),
    simpleHash(scr.width) + simpleHash(scr.height) + '.' + simpleHash(scr.colorDepth) + '.' + simpleHash(scr.pixelDepth),
    simpleHash(fp.tz) + '.' + simpleHash(fp.pri),
    simpleHash((fp.pl || []).join(',')) + '.' + simpleHash((fp.mt || []).join(',')),
    simpleHash(fp.mdl) + '.' + simpleHash((fp.prl || []).join(',')),
  ];
  return `${os} | ${parts.join(' | ')}`;
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
    // ▲ إصلاح: كانت مُجمَّدة على '' دائماً، بعكس ucol بنفس الدالة تماماً
    //   وبعكس buildMsg (تُطبَّق فعلياً على .u-msg نفسها في appraad2.js —
    //   السطر ~3673 — وهي عنصر "محتوى" الرسالة الفعلي). كل رسائل النظام
    //   (دخول الغرفة/مغادرتها/طرد/حظر/نقل/خروج/قطع اتصال) تمر من هنا فقط
    //   (بحث hmsg الشامل بكل الملف يثبت ذلك)، فكانت جميعها تفقد لون محتواها
    //   بينما اسم/خلفية العضو (ucol/الخلفية اللونية) يعملان بشكل صحيح.
    mcol:  sender.mcol  || '',
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
        // ▲ إصلاح: كان يُرسل الحقل باسم "name"، بينما يقرأ appraad2.js
        //   حرفياً ".topic" عند بناء قائمة المشرفين في نافذة إعدادات الغرفة
        //   (راجع: uhead.find(".u-topic").html(entry.topic))، فكان الاسم
        //   يظهر فارغاً دائماً رغم ظهور الصورة بشكل صحيح (pic كانت مطابقة).
        if (u.lid === lid) return { id: u.id, lid: u.lid, topic: u.topic, pic: u.pic };
      }
      return null;
    })
    .filter(Boolean);
}

/** بناء قائمة المحظورين من غرفة معينة (حظر مؤقت ٢٠ دقيقة عبر roomkick) —
 *  بنفس تنسيق buildRops بالضبط (id/lid/topic/pic) زائداً until (وقت
 *  انتهاء الحظر)، تمهيداً لعرضها بنفس طريقة قائمة المشرفين تماماً. تُنظَّف
 *  الحظورات المنتهية تلقائياً هنا (تنظيف كسول). يبحث في الحسابات المسجّلة
 *  أيضاً (وليس المتصلين فقط) لأن الحظر المؤقت غالباً يستمر بعد خروج الشخص. */
function buildRoomBans(room) {
  const now = Date.now();
  for (const [lid, rb] of room.roomBans) {
    if (rb.until <= now) room.roomBans.delete(lid);
  }
  return [...room.roomBans.entries()].map(([lid, rb]) => {
    let topic = lid, pic = 'pic.png';
    const live = [...room.members.values()].find(u => u.lid === lid) || [...users.values()].find(u => u.lid === lid);
    if (live) { topic = live.topic; pic = live.pic; }
    else {
      for (const [, acc] of accounts) {
        if (acc.lid === lid) { topic = acc.topic || acc.name || lid; pic = acc.pic || 'pic.png'; break; }
      }
    }
    return { id: lid, lid, topic, pic, until: rb.until };
  });
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
  // ▲ إصلاح: الحظر أصبح عالمياً (globalBans، راجع isBanned أعلاه) بدل حظر
  //   مقتصر على غرفة واحدة، مع رسالة تتضمن الوقت المتبقي للحظورات المؤقتة.
  const ban = isBanned(user);
  if (ban) {
    const remain = ban.expires ? remainingTimeText(ban.expires) : '';
    return {
      ok: false, reason: 'banned',
      msg: remain ? `أنت محظور، الوقت المتبقي: ${remain}` : 'أنت محظور'
    };
  }
  // ▲ إضافة: حظر مؤقت خاص بغرفة واحدة فقط (٢٠ دقيقة) بعد الطرد منها
  //   تحديداً (roomkick) — منفصل تماماً عن الحظر العام أعلاه، ولا يُضاف
  //   لقائمة الحظر بلوحة التحكم (راجع room.roomBans في case 'roomkick').
  if (!force && room.roomBans && room.roomBans.has(user.lid)) {
    const rb = room.roomBans.get(user.lid);
    if (rb.until > Date.now()) {
      const remain = remainingTimeText(rb.until);
      return { ok: false, reason: 'wrong', msg: `تم طردك من هذه الغرفة، يمكنك العودة بعد: ${remain}` };
    }
    room.roomBans.delete(user.lid); // انتهت المدة — تنظيف ذاتي كسول
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
  // ▲ إصلاح: الحظر أصبح عالمياً (globalBans) وليس مقتصراً على غرفة واحدة —
  //   فحص واحد خارج الحلقة يكفي (نفس النتيجة لكل الغرف).
  if (isBanned(user)) return null;
  const seen = new Set();
  const candidates = [];
  if (requestedId && rooms.has(requestedId)) candidates.push(rooms.get(requestedId));
  candidates.push(...rooms.values());
  for (const r of candidates) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (r.needpass && r.pass) continue; // لا نملك كلمة مرور لتجربتها تلقائياً
    // ▲ إضافة: تخطّي أي غرفة لدى العضو فيها حظر مؤقت لم تنتهِ مدته (roomkick)
    if (r.roomBans && r.roomBans.has(user.lid) && r.roomBans.get(user.lid).until > Date.now()) continue;
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
  // ▲ إصلاح: تخطّي الإعلان بالكامل (وكذلك رسالة الترحيب أدناه) لو كان
  //   المستخدم متخفياً (user.s) — دخوله يجب ألا يظهر لأي أحد (ولا حتى له
  //   نفسه كرسالة ترحيب مميزة) طالما وضع التخفي مفعّل.
  if (!user.s) {
    // تُبثّ لأعضاء الغرفة الموجودين باستثناء العضو الداخل نفسه
    // ▲ إصلاح: حُذف حقل mi — appraad2.js يُظهر أزرار اللايك/الرد فقط إذا
    //   وُجد bid أو mi في الرسالة؛ بغيابهما تختفي هذه الأزرار تلقائياً من
    //   تلقاء نفسه (لا حاجة لأي منطق إضافي)، وهو المطلوب لرسائل النظام.
    const joinHtml = `هذا المستخدم قد دخل <div class="fl fa fa-sign-in btn btn-primary dots roomh border corner minix" style="margin-left:-4px;padding:4px;max-width:180px;min-width:60px;" onclick="rjoin('${room.id}')">${room.name}</div>`;
    toRoom(room.id, 'msg', buildSysMsg(user, joinHtml, { 'class': 'hmsg' }), socket.id);

    // رسالة ترحيب اختيارية
    // ▲ إصلاح: حُذف حقلا bid وmi كلاهما — appraad2.js يتحقق من bid أولاً
    //   (يُفعِّل أزرار اللايك/الرد الخاصة بإعدادات الحائط bclikes/bcreply
    //   رغم أن هذه رسالة دردشة عادية وليست منشور حائط)، ثم من mi. إن غاب
    //   الاثنان معاً فقط تختفي أزرار اللايك/الرد/الحذف بالكامل تلقائياً —
    //   وهو المطلوب لرسائل النظام/الترحيب حسب الطلب الصريح.
    if (room.welcome) {
      send(socket, 'msg', buildMsg(
        { id: 'srv', lid: 'srv', pic: 'room.png', ico: '', ucol: '', mcol: '', topic: 'رساله ترحيب' },
        room.welcome,
        {}
      ));
    }

    // ▲ إضافة (البند السابع): مجمع "رسائل الترحيب" العام بلوحة التحكم
    //   (global.siteMessages بـtype:'w'، يُحفَظ فعلاً عبر case 'msgsit' لكن لم
    //   يكن يُرسَل لأي أحد إطلاقاً — بحث كامل لم يجد أي قراءة لـtype==='w' في
    //   كل الملف). منفصل تماماً عن room.welcome أعلاه (حقل غرفة واحد ثابت)؛
    //   هذا مجمع مواقع عام قد يحوي عدة رسائل، فاخترنا واحدة عشوائياً في كل
    //   دخول (لا منطق اختيار محدَّد بالمستند) لتنويع الترحيب. force=true يعني
    //   هذا استدعاء rjoin (تبديل غرفة) لا تسجيل دخول جديد — لا تُرسَل حينها،
    //   طبقاً للطلب الصريح "مرة واحدة فقط عند تسجيل دخول المستخدم".
    if (!force) {
      const welcomePool = (global.siteMessages || []).filter(m => m.type === 'w');
      if (welcomePool.length) {
        const pick = welcomePool[Math.floor(Math.random() * welcomePool.length)];
        send(socket, 'pmsg', {
          uid: 'srv', topic: pick.t || 'رساله ترحيب', pic: 'room.png',
          msg: pick.m, t: Date.now(), bid: makeBid()
        });
      }
    }
  }

  console.log(`[Room] "${user.topic}" → "${room.name}"`);
  return true;
}

// ─── مغادرة الغرفة ────────────────────────────────────────────────────────────
// reason: 'leave' | 'kick' | 'ban' | 'roomkick' | 'logout' | 'disconnect'
function leaveRoom(socket, user, reason = 'leave', targetRoom = null) {
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
  // ▲ إصلاح: قواعد رسالة النظام (مُحدَّثة بناءً على توضيح صريح):
  //   (١) تُلغى بالكامل لو كان المستخدم متخفياً (user.s) — دخوله/خروجه/
  //       تنقله يجب ألا يظهر لأي أحد إطلاقاً طالما وضع التخفي مفعّل
  //       (يشمل هذا أيضاً رسالة الترحيب في joinRoom أدناه).
  //   (٢) عند المغادرة الكاملة (leave، عبر rleave): تُبث لبقية الغرفة *و*
  //       تُرسل للمغادر نفسه معاً (كلاهما يستقبلانها).
  //   (٣) عند التنقل بين الغرف (move): تُبث لبقية الغرفة القديمة *و* تُرسل
  //       للمنتقل نفسه معاً، وبنفس تنسيق HTML القابل للنقر (رابط الغرفة
  //       الجديدة) المستخدم في رسالة "دخل الغرفة" أدناه في joinRoom — وليس
  //       نصاً عادياً كبقية الحالات.
  const sysTexts = {
    leave:      '( هذا المستخدم غادر الغرفه )',
    kick:       'هذا المستخدم تم طرده',
    ban:        'هذا المستخدم تم حظره',
    roomkick:   'هذا المستخدم تم طرده من الغرفه',
    move:       'هذا المستخدم انتقل إلى غرفة أخرى', // احتياطي إذا تعذّر تمرير targetRoom
    logout:     'هذا المستخدم سجل خروج',
    disconnect: 'هذا المستخدم قطع الاتصال'
  };
  if (!user.s) {
    let sysText;
    if (reason === 'move' && targetRoom) {
      // نفس تنسيق رسالة "دخل الغرفة" في joinRoom (رابط قابل للنقر بنفس الشكل)
      sysText = `هذا المستخدم انتقل إلى <div class="fl fa fa-sign-in btn btn-primary dots roomh border corner minix" style="margin-left:-4px;padding:4px;max-width:180px;min-width:60px;" onclick="rjoin('${targetRoom.id}')">${targetRoom.name}</div>`;
    } else {
      sysText = sysTexts[reason] || sysTexts.leave;
    }
    // ▲ إصلاح: حُذف حقل mi هنا أيضاً لنفس السبب أعلاه (اختفاء تلقائي لأزرار
    //   اللايك/الرد/الحذف من كل رسائل النظام: مغادرة/طرد/حظر/تنقل...).
    const sysMsg = buildSysMsg(user, sysText, { 'class': 'hmsg' });
    // تُبث لبقية أعضاء الغرفة (المستخدم أُزيل من members أعلاه فلن يستقبلها عبر toRoom)
    toRoom(prevRoomId, 'msg', sysMsg);
    // وتُرسل للمغادر/المنتقل نفسه أيضاً (مغادرة كاملة أو تنقل بين الغرف)
    if (reason === 'leave' || reason === 'move') {
      send(socket, 'msg', sysMsg);
    }
  }

  // ─── الإبلاغ بالمغادرة للآخرين (وللمغادر نفسه) ─────────────────────────────
  // appraad.js case 'u-' يحذف المستخدم نهائياً من القائمة العامة (_0x123150/_0x41a1d0)
  // appraad.js case 'ur' ينقص uco للغرفة القديمة ويصفّر roomid — لكنه يتوقف فوراً
  // لو المستخدم محذوف مسبقاً من _0x123150 (أي إذا أُرسلت u- قبلها بالغلط)
  // لذلك: ur يجب أن تُرسل أولاً دائماً، وu- لا تُرسل إلا عند خروج كامل من الموقع
  // (وليس عند مجرد مغادرة/نقل غرفة — حيث يبقى المستخدم متصلاً بالموقع)
  //
  // ▲ إصلاح جوهري: كانت 'ur' الخاصة بالمغادر نفسه (uid==myid) لا تُرسَل له
  //   إطلاقاً (كان يُستثنى صراحة من حلقة البث). لكن appraad2.js (case 'ur')
  //   يشترط بالضبط استقبال هذه الرسالة عن *نفسه* (uid==myid) ليُفرِّغ لون
  //   خلفية #tbox من الرمادي/يُظهره من جديد (راجع الكود حول "_0x48c915 ==
  //   myid" في appraad2.js) — فكان المستخدم المغادر نفسه لا يرى مربع كتابة
  //   الغرفة يتعطل بصرياً (يبقى بلونه الطبيعي رغم عدم قدرته فعلياً على
  //   إرسال رسائل غرفة). الحل: إرسال 'ur' للمغادر نفسه أيضاً كبقية المتصلين.
  const fullyOffline = ['logout', 'disconnect', 'kick', 'ban'].includes(reason);
  const leftId = user.id;
  send(socket, 'ur', [leftId, null]);   // للمغادر نفسه — يُفعِّل تعطيل #tbox بصرياً
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

      // ▲ إضافة: عودة من مهلة انتظار قطع الاتصال (stat=3 — راجع
      //   socket.on('disconnect') أعلاه). سوكته القديم ميت فعلياً بالفعل
      //   (لهذا originalSocket سيكون undefined أصلاً)، فلا تُنفَّذ كتلة
      //   "الطرد" التالية. نُلغي مؤقّت الطرد المعلَّق هنا فقط قبل أن يُطرَد
      //   هو نفسه خطأً بعد قليل.
      const wasInGrace = !fromSession && found._discGrace === true;
      if (wasInGrace && found._discTimer) clearTimeout(found._discTimer);

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
      } else if (wasInGrace) {
        // ▲ إضافة: لا سوكت حياً لطرده هنا، لكن يجب حذف المدخل القديم اليتيم
        //   من users بعد نسخ بياناته أدناه — وإلا بقي عالقاً للأبد بمعرّف
        //   سوكت ميت (لا شيء آخر في الملف كان يُنظِّفه في هذه الحالة تحديداً).
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
        b:      found.b     || '',
        // ▲ إصلاح: nopm/nonot/giftIco لم تكن تُنسَخ هنا إطلاقاً — أي عضو
        //   مفعِّل "قفل الخاص" أو "تعطيل التنبيهات" كان يفقدهما صامتاً عند
        //   أي rc2 (تحديث صفحة/إعادة اتصال)، رغم استعادتهما بشكل صحيح تماماً
        //   عند تسجيل الدخول الكامل (case 'login' أعلاه). يؤثر مباشرة على
        //   دقة stat (قفل الخاص) بعد العودة من مهلة الانتظار الجديدة.
        nopm:    found.nopm    || false,
        nonot:   found.nonot   || false,
        giftIco: found.giftIco || ''
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

          if (wasInGrace) {
            // ▲ إضافة: عودة صامتة من مهلة الانتظار — العضو لم يغادر مرئياً
            //   لأحد أصلاً (لم يُستدعَ leaveRoom إطلاقاً أثناء المهلة، لا
            //   تغيّر بعدّاد الغرفة ولا بقائمة الأعضاء لدى أحد)، فلا داعي
            //   لأي بث ur/u+ كامل هنا كما بالمسار العادي أدناه. المطلوب فقط:
            //   تحديث أيقونة الحضور من stat=3 إلى الحالة الصحيحة الجديدة.
            refreshUserStat(user);
          } else {
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
    send(socket, 'settings', liveSettings(_powersRoom?.settings || {
      mlikes: true, bclikes: true, mreply: false, bcreply: false, calls: false
    }));

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
        // ▲ إصلاح: الترتيب هنا كان معكوساً (u+ قبل ur) بخلاف كل نقاط البث
        // الأخرى بالملف — نفس العطل الموثّق مسبقاً (عدّاد الموجودين بالغرفة
        // القديمة يتجمّد لأن appraad2.js يقرأ "الغرفة القديمة" من الكائن الذي
        // استبدلته u+ للتو). صُحِّح للترتيب الصحيح: ur ثم u+.
        users.forEach(u => {
          if (u.socketId === socket.id) return;
          const s = io.sockets.sockets.get(u.socketId);
          if (s) { send(s, 'ur', [user.id, room.id]); send(s, 'u+', rc2Pub); }
        });
        addRecentLogin(user);
        broadcastRoomUpdate(room);
      }
    }
  });

  socket.on('disconnect', () => {
    // ▲ إضافة: مهلة انتظار قبل الطرد الفعلي (طلب صريح: عرض stat=3 أثناء
    //   الانتظار، وعودة صامتة إلى الحالة الصحيحة دون أي مغادرة/انضمام ظاهرة
    //   لبقية الأعضاء إذا عاد الاتصال خلال DISCONNECT_GRACE_MS — راجع case
    //   'rc2' أدناه). لم يكن يوجد أي نظام انتظار لهذا الغرض في الملف: نظام
    //   sessions/SESSION_TTL الحالي (5 دقائق) مخصَّص فقط لاستعادة البروفايل
    //   بعد إزالة العضو فعلياً بالكامل من الغرفة/القائمة، وليس لإبقائه
    //   ظاهراً بالغرفة أثناء الانتظار. الآن: أولاً مهلة قصيرة (تُبقيه حاضراً
    //   بمقعده/غرفته كاملة مع أيقونة انتظار فقط)، ثم — إن لم يعد — تُنفَّذ
    //   المغادرة الفعلية القديمة دون أي تغيير (يليها sessions كما كانت).
    user._discGrace = true;
    refreshUserStat(user); // يبث stat=3 فوراً فقط — لا تأثير آخر على العضوية/المايك/العدّاد

    user._discTimer = setTimeout(() => {
      // انتهت المهلة ولم يُعاود الاتصال — نفس سلوك الطرد الفوري السابق دون أي تغيير
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
    }, DISCONNECT_GRACE_MS);
  });
});

// ─── الموزع الرئيسي للأوامر ──────────────────────────────────────────────────
function dispatch(socket, user, cmd, data) {
  // ▲ إضافة: أي أمر وارد من العميل داخل الشات = نشاط. يُحدِّث آخر نشاط
  //   ويُعيد الحالة لنشطة (stat=0) فوراً عبر u^ إن كانت خاملة — نفس مصدر
  //   computeStat() المستخدم في pub() وبالفحص الدوري أدناه، بدون Socket جديد.
  user.last = Date.now();
  refreshUserStat(user);

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
      // ▲ إصلاح جذري: كانت هذه القيم مكتوبة يدوياً وثابتة دائماً (mlikes/
      //   bclikes=true, mreply/bcreply=false) بغض النظر عمّا حُفظ فعلياً في
      //   إعدادات الموقع — تُرسَل عند كل اتصال أول بالصفحة (قبل حتى تسجيل
      //   الدخول)، فتطغى على أي حفظ من لوحة التحكم في كل مرة تُفتح/تُحدَّث
      //   الصفحة. الآن تستخدم liveSettings (المصدر الموحَّد أعلى الملف).
      send(socket, 'settings', liveSettings({ mlikes: true, bclikes: true, mreply: false, bcreply: false, calls: false }));
      // القائمة قبل تسجيل الدخول (#lonline) — آخر MAX_RECENT مستخدم سجّلوا دخولاً
      send(socket, 'online', recentLogins.slice());
      break;
    }

    /
