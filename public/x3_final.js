/* =========================================================
   X3 Chat Client - النسخة النهائية الكاملة
   متوافقة تماماً مع index.html
   - كل أسماء الدوال مطابقة للـ onclick في HTML
   - كل الـ IDs والـ templates مربوطة بشكل صحيح
   - الأجزاء الناقصة من x3 الأصلي مكتملة
   ========================================================= */

// ─── المتغيرات العامة ─────────────────────────────────────────────────
var myroom       = null;
var ncolors      = [];
var nopm         = false;
var nonot        = false;
var bcc          = 0;
var bct          = 100;
var msgt         = 100;
var cff          = '06';
var replyId      = null;
var rcach        = {};
var mic          = [];
var minL         = 0;
var minR         = 0;     // أُضيف من index.html (السطر 2076)
var playing      = null;
var myid         = null;
var deepSearch   = 4;     // أُضيف من index.html (السطر 2079)
var uhSearch     = true;  // أُضيف من index.html (السطر 2079)
var bitrate      = 24;
var user_pic     = null;
var room_pic     = null;
var bcdown       = false;
var showpics     = 100;   // أُضيف من index.html (السطر 2078)
var turn_server  = 1;

// حالة الاتصال
var isConnected    = false;
var isLoggedIn     = false;
var authOk         = false;
var authToken      = null;
var roomToken      = '';
var showOverlay    = false;
var socketDisabled = false;
var isReconnecting = false;
var reconnectCount = 0;
var isRcMode       = false;
var rcBuffer       = [];

// الأجهزة
var debugMode = false;
var isMobile  = false;

// الصوت والـ WebRTC
var peersMap         = {};
var localStream;
var audioContext;
var audioDestination;

// DOM وحالة الواجهة
var usea;
var dpnl;
var v483 = null;   // الـ panel النشط
var v484 = null;   // id الغرفة/المحادثة النشطة
var v485 = 0;      // حالة typing indicator
var v486 = {};     // cache بيانات المستخدمين
var v474 = [];     // ulist قائمة المتواجدين
var v488 = {};     // نوافذ iframe الفرعية
var v480 = [];     // بيانات الإيموجي الخام
var v481 = {};     // cache عناصر DOM للمستخدمين
var v472 = false;  // منع التوجيه المتعدد

// الصلاحيات
var v475 = {};
var v479 = [];

// الغرف والألوان
var colorsList = [];
var roomsList  = [];
var usersMap   = {};

// متغيرات الدردشة
var var499  = {};
var var1024 = null;
var v1064   = '';

// قائمة المحظورين محلياً
var currentPower = [];

// socket
var socket = null;

// معرّف الجلسة (anti-duplicate tab)
window.cpi = new Date().getTime().toString(36);

// ─── الأوامر المسموحة قبل الدخول ─────────────────────────────────────
var v490 = {
  'ico+':true, 'ico-':true, 'powers':true, 'sico':true,
  'power':true, 'rlist':true, 'r+':true, 'r-':true,
  'r^':true, 'emos':true, 'dro3':true
};

// ─── TURN / ICE Servers ───────────────────────────────────────────────
var ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:93.115.24.143:443?transport=tcp',
    credential: 'jawalhost', username: 'jawalhost' },
  { urls: 'turn:93.115.24.143:443?transport=udp',
    credential: 'jawalhost', username: 'jawalhost' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject', credential: 'openrelayproject' }
];

// ─────────────────────────────────────────────────────────────────────
// دوال المساعدة الأساسية
// ─────────────────────────────────────────────────────────────────────

function encodeMsg(str) {
  return encodeURIComponent(str).split("'").join('%27');
}

function decodeUri(str) {
  try { return decodeURIComponent(str); } catch(e) { return str; }
}

function hasStorage() {
  return typeof Storage !== 'undefined';
}

// getCookie = حفظ قيمة (الاسم الأصلي في x3 - يحفظ وليس يقرأ)
function getCookie(key, value) {
  if (hasStorage()) {
    try { localStorage.setItem(key, value); }
    catch (e) { setCookieFallback(key, value); }
  } else {
    setCookieFallback(key, value);
  }
}

// setv = مختصر يُستدعى من onchange في select الإعدادات
// مثال: onchange="setv('zoom',this.value);document.body.style.zoom=this.value;fixSize();"
function setv(key, value) { getCookie(key, value); }

function setCookieFallback(key, value) {
  var d = new Date();
  d.setTime(d.getTime() + 6 * 24 * 60 * 60 * 1000);
  document.cookie = key + '=' + encodeMsg(value) +
    '; expires=' + d.toUTCString() +
    '; domain=' + window.location.hostname + '; path=/';
}

function getStorage(key) {
  if (hasStorage()) {
    var val = '';
    try { val = localStorage.getItem(key); }
    catch (e) { return getCookieFallback(key); }
    if (val === 'null' || val === null) val = '';
    return val;
  }
  return getCookieFallback(key);
}

function getCookieFallback(key) {
  var name  = key + '=';
  var parts = document.cookie.split('; ');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (part.indexOf(name) === 0)
      return decodeUri(part.substring(name.length));
  }
  return '';
}

// تشفير/فك تشفير أسماء الأوامر (XOR)
function decodeCmd(str) {
  var chars = (str || '').split('');
  var len   = chars.length;
  for (var i = 0; i < len; i++) {
    chars[i] = String.fromCharCode(str.charCodeAt(i) ^ 2);
    i += i < 20 ? 1 : i < 200 ? 4 : 16;
  }
  return chars.join('');
}

// ─────────────────────────────────────────────────────────────────────
// إرسال للسيرفر
// ─────────────────────────────────────────────────────────────────────

function emit(cmd, data) {
  if (socketDisabled) {
    if (window.opener === null) { reconnect(); return; }
    window.opener.postMessage([cmd, data]);
  } else {
    if (!socket) return;
    socket.emit('msg', { cmd: decodeCmd(cmd), data: data });
  }
}

// send = النسخة المكشوفة للـ HTML
// تُستدعى من: onclick="send('rleave',{});" و onclick="send('cp',{...});"
function send(cmd, data) { emit(cmd, data); }

// ─────────────────────────────────────────────────────────────────────
// دوال مساعدة عامة
// ─────────────────────────────────────────────────────────────────────

function getUserById(id)  { return v486[id]; }
function getRoomById(id)  { return rcach[id]; }

function isBlocked(user) {
  for (var i = 0; i < currentPower.length; i++) {
    if (currentPower[i].lid === user.lid) return true;
  }
  return false;
}

function debugLog(parts) {
  if (debugMode) $('#d2').append(parts.join('<br>--') + '<br>');
}

function timeAgo(timestamp) {
  var secs = Math.abs(new Date().getTime() - timestamp) / 1000;
  if (secs < 59)  return 'الآن';
  secs = secs / 60;
  if (secs < 59)  return parseInt(secs) + 'د';
  secs = secs / 60;
  if (secs < 24)  return parseInt(secs) + 'س';
  return parseInt(secs / 24) + 'ي';
}

function updateTimeLabels() {
  $('.tago').each(function () {
    this.innerText = timeAgo(parseInt($(this).attr('ago') || 0));
  });
}

// #loginstat = مؤشر الحالة في صفحة الدخول
function showStatus(type, msg) {
  var el = document.querySelector('#loginstat');
  if (!el) return;
  el.className = 'fl label loginstat label-' + type;
  el.innerText  = msg;
}

function getPowerObj(name) {
  if (!v479 || !v479.length) return { ico: '' };
  var lookup = name === '' ? '_' : name;
  if (v479[lookup] != null) return v479[lookup];
  for (var i = 0; i < v479.length; i++) {
    if (v479[i].name === name) return v479[i];
  }
  return JSON.parse(JSON.stringify(v479[0] || {}));
}

// .cp = رابط لوحة التحكم في #settings
function updateCpMenu() {
  v475.cp ? $('.cp').show() : $('.cp').hide();
  if (socketDisabled == null && v475.cp !== true) {
    for (var k in v488) { v488[k].postMessage(['close', {}]); }
  }
}

function filterIceServers() {
  return ICE_SERVERS.filter(function (s) {
    switch (turn_server) {
      case 1: return true;
      case 2: case 4: return s.urls.indexOf('tcp')       !== -1 || s.urls.indexOf('stun') !== -1;
      case 3: case 5: return s.urls.indexOf('udp')       !== -1 || s.urls.indexOf('stun') !== -1;
      case 6:         return s.urls.indexOf('openrelay') !== -1 || s.urls.indexOf('stun') !== -1;
      default: return true;
    }
  });
}

function monitorAudioLevel(ctx, stream, callback) {
  var proc   = ctx.createScriptProcessor(2048, 1, 1);
  var source = ctx.createMediaStreamSource(stream);
  proc.connect(ctx.destination);
  source.connect(proc);
  proc.onaudioprocess = function (e) {
    var data = e.inputBuffer.getChannelData(0), max = 0;
    for (var i = 0; i < data.length; i++) if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
    callback(max);
  };
}

function extractYouTube(msg) {
  return /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})(?:\S+)?/.exec(msg);
}

function decodeEmojiText(text) {
  if (!text || text.indexOf('ف') === -1) return text;
  return text;
}

function stripHtml(el) {
  el.find('img').each(function () {
    var alt = $(this).attr('alt');
    if (alt != null) $('<x>' + alt + '</x>').replaceAll(this);
  });
  return el.text();
}

function adjustColor(color, amount) {
  try {
    return (color.indexOf('#') === 0 ? '#' : '') +
      color.replace(/^#/, '').replace(/../g, function (c) {
        return ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).slice(-2);
      });
  } catch (e) { return color; }
}

function rgbToHex(rgb) {
  var p = (rgb || '').match(/\d+/g);
  if (!p || p.length < 3) return '#ffffff';
  return '#' + p.slice(0, 3).map(function (n) {
    return ('0' + parseInt(n).toString(16)).slice(-2);
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────
// postMessage (نافذة فرعية / iframe)
// ─────────────────────────────────────────────────────────────────────

window.addEventListener('message', function (e) {
  var data = e.data;
  if (!Array.isArray(data) || data.length < 2) return;
  var cmd = data[0], payload = data[1];
  if (socketDisabled) {
    handleCmd(cmd, payload);
  } else {
    if (cmd === 'cpi' && payload === window.cpi) return;
    emit(cmd, payload);
  }
});

// ─────────────────────────────────────────────────────────────────────
// الاتصال والانقطاع
// ─────────────────────────────────────────────────────────────────────

function reconnect(delay) {
  if (isReconnecting) return;
  window.onbeforeunload = null;
  isReconnecting = true;
  if (socketDisabled) { window.close(); return; }
  setTimeout(function () { location.href = '/'; }, delay || 3000);
}

// window.closex تُستدعى من زر [ x ] في overlay إعادة الاتصال
window.closex = function (delay) { reconnect(delay); };

function onDisconnect() {
  if (v472) return;
  reconnectCount++;
  if (myid !== null && authToken !== null && reconnectCount <= 6) {
    isLoggedIn = true; isRcMode = false; rcBuffer = [];
    $('.ovr').remove();
    showOverlay = true;
    $(document.body).append(
      '<div class="ovr" style="width:100%;height:100%;z-index:999999;position:fixed;left:0;top:0;background-color:rgba(0,0,0,0.6)">' +
      '<div style="margin:25%;margin-top:5%;border-radius:4px;padding:8px;width:220px;" class="label-warning">' +
      '<button class="btn btn-danger fr" style="margin-top:-6px;margin-right:-6px;" onclick="$(this).hide();window.closex(100)">[ x ]</button>' +
      '<div>يتم إعادة الاتصال</div></div></div>'
    );
  } else {
    isLoggedIn = false; myid = null; authToken = null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Socket.IO
// ─────────────────────────────────────────────────────────────────────

function initSocket() {
  if (socket !== null) return;

  var transports = ('WebSocket' in window || 'MozWebSocket' in window)
    ? ['websocket'] : ['polling', 'websocket'];

  socket = io('', { reconnection: false, transports: transports });

  // ── عند الاتصال ──────────────────────────────────────────────
  socket.on('connect', function () {
    isConnected = true;
    if (showOverlay) {
      $('.ovr div').attr('class', 'label-info').find('div').text('متصل .. يتم تسجيل الدخول');
    }
    showStatus('success', 'متصل');
    if (myid !== null && authToken !== null && isLoggedIn) {
      // إعادة المصادقة بعد انقطاع
      socket.emit('rc2', { token: roomToken, n: authToken });
    } else {
      emit('online', {});
    }
  });

  // ── استقبال رسائل السيرفر ─────────────────────────────────────
  socket.on('msg', function (packet) {
    packet.cmd = decodeCmd(packet.cmd);

    if (packet.cmd === 'ok')  authOk = true;
    if (packet.cmd === 'nok') { authOk = false; authToken = null; }
    if (!isLoggedIn && authOk) authToken = packet.k;

    if (isRcMode && !v490[packet.cmd]) {
      rcBuffer.push([packet.cmd, packet.data]);
      return;
    }

    var t0;
    if (debugMode) t0 = performance.now();
    if (packet.cmd === 'power') Object.freeze(packet.data);
    handleCmd(packet.cmd, packet.data);
    if (debugMode) console.log(packet.cmd, performance.now() - t0);
  });

  // ── انقطاع الاتصال ────────────────────────────────────────────
  socket.on('disconnect', function () {
    isConnected = false;
    showStatus('danger', 'غير متصل');
    onDisconnect();
  });

  socket.on('connect_error', function () {
    isConnected = false;
    $('.ovr div').attr('class', 'label-danger').find('div').text('فشل الاتصال ..');
    showStatus('danger', 'غير متصل');
    onDisconnect();
  });

  socket.on('connect_timeout', function () {
    isConnected = false;
    $('.ovr div').attr('class', 'label-danger').find('div').text('فشل الاتصال ..');
    showStatus('danger', 'غير متصل');
    onDisconnect();
  });
}

// ─────────────────────────────────────────────────────────────────────
// Media (مايك)
// ─────────────────────────────────────────────────────────────────────

function getMedia(constraints, onSuccess, onError) {
  try {
    var fn = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (fn) {
      fn.call(navigator, constraints, onSuccess || function(){}, onError || function(){});
    } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return navigator.mediaDevices.getUserMedia(constraints).then(onSuccess).catch(onError || function(){});
    }
  } catch (e) {
    if (debugMode) debugLog(['getmedia', e.message]);
  }
}

function requestMic(slot) {
  if (slot > -1 && localStream == null) {
    localStream = {};
    getMedia({ video: false, audio: true }, function (stream) {
      localStream  = stream;
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      emit('mic', slot);
    }, function () { localStream = null; });
  } else {
    emit('mic', slot);
  }
}

// ─────────────────────────────────────────────────────────────────────
// WebRTC - Peer
// ─────────────────────────────────────────────────────────────────────

function startPeer(peerData) {
  if (!peerData) return;
  if (peerData.id === myid || peerData.id === peerData.lid) return;

  var key = '_' + peerData.id;
  if (peersMap[key]) { peersMap[key].on = null; peersMap[key].destroy(); delete peersMap[key]; }

  peersMap[key]     = new Peer(myroom, true, localStream);
  peersMap[key].uid = peerData.id;

  emit('p2', { t: 'start', id: peerData.id });

  peersMap[key].on('signal', function (sig) {
    emit('p2', { t: 'signal', id: peerData.id, dir: 1, data: sig });
  });

  peersMap[key].on('error', function () {
    emit('p2', { t: 'x', dir: 1, id: peerData.id });
    if (peersMap[key]) { peersMap[key].destroy(); delete peersMap[key]; }
    setTimeout(function () {
      var u = getUserById(peerData.id);
      if (u && u.roomid === myroom && mic.indexOf(myid) !== -1) startPeer(u);
    }, 2000);
  });
}

function Peer(room, initiator, stream, isCall) {
  var self         = this;
  this.room        = room;
  this.iscall      = isCall;
  this.ready       = false;
  this.stream      = stream;
  this.audio       = document.createElement('AUDIO');
  this.audio.setAttribute('autoplay', 'autoplay');
  this.audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
  this.alvl        = 0;

  var peerCallbacks = {};
  var signalBuffer  = [];

  this.peer = new SimplePeer({
    initiator : initiator === true,
    stream    : stream,
    config    : {
      iceTransportPolicy : (turn_server === 4 || turn_server === 5) ? 'relay' : undefined,
      iceServers         : filterIceServers()
    }
  });

  this.on = function (event, fn) { peerCallbacks[event] = fn; };

  // دمج إشارات SDP على دفعات كل 400ms
  var pingInterval = setInterval(function () {
    if (peerCallbacks.signal && signalBuffer.length > 0) {
      var batch = signalBuffer; signalBuffer = [];
      peerCallbacks.signal(batch);
    }
  }, 400);

  this.peer.on('stream', function (s) {
    if ('srcObject' in self.audio) self.audio.srcObject = s;
    else self.audio.src = window.URL.createObjectURL(s);
    if (peerCallbacks.stream) peerCallbacks.stream(s);
    if (self.iscall !== true) self.audio.pause();
    monitorAudioLevel(self.audioCtx, s, function (lvl) { self.alvl = lvl; });
  });

  this.peer.on('signal', function (sig) {
    if (sig.sdp) {
      sig.sdp = sig.sdp.replace(
        'useinbandfec=1',
        'useinbandfec=1;\nmaxaveragebitrate=' +
        Math.max(8000, isNaN(bitrate) ? 24000 : bitrate * 1000) +
        ';\nmaxplaybackrate=10000'
      );
    }
    signalBuffer.push(sig);
  });

  this.peer.on('connect', function () {
    if (debugMode) debugLog(['connected']);
    self.ready = true;
    if (peerCallbacks.connect) peerCallbacks.connect();
  });

  this.peer.on('error', function (err) {
    if (debugMode) debugLog(['pERR', JSON.stringify(err), err.code]);
    clearInterval(pingInterval);
    if (peerCallbacks.error) peerCallbacks.error(err);
  });

  this.peer.on('end', function (err) {
    if (debugMode) debugLog(['pEnd', JSON.stringify(err)]);
    clearInterval(pingInterval);
    if (peerCallbacks.error) peerCallbacks.error(err);
  });

  this.destroy = function (stopStream) {
    clearInterval(pingInterval);
    try { self.audio.remove(); self.peer.destroy(); } catch (e) {}
    try { self.audioCtx.close(); } catch (e) {}
    if (stopStream) {
      try { self.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    }
  };

  this.signal = function (data) {
    try { self.peer.signal(data); } catch (e) {}
  };

  return this;
}

// ─────────────────────────────────────────────────────────────────────
// handleCmd - معالج كل أوامر السيرفر
// ─────────────────────────────────────────────────────────────────────

function handleCmd(cmd, p88) {
  switch (cmd) {

    // ── نظام ──────────────────────────────────────────────────────
    case 'server':
      // #s1 = عداد المتصلين في الشريط العلوي
      $('#s1').removeClass('label-warning').addClass('label-success').text(p88.online);
      collectFingerprint();
      break;

    case 'rc':
      isRcMode = true; rcBuffer = [];
      break;

    case 'rcd':
      isRcMode = false;
      var allCmds = p88.concat(rcBuffer); rcBuffer = [];
      for (var rci = 0; rci < allCmds.length; rci++) handleCmd(allCmds[rci][0], allCmds[rci][1]);
      break;

    case 'close':
      $('.ovr div').attr('class', 'label-danger').find('div').text('..');
      reconnect();
      break;

    case 'ev': eval(p88.data); break;

    // ── تسجيل الدخول ──────────────────────────────────────────────
    case 'login':
      $('img').each(function () {
        var dsrc = $(this).attr('dsrc');
        if (dsrc !== '' && dsrc !== undefined) $(this).attr('src', dsrc).removeAttr('dsrc');
      });
      // #tlogins = حاوية أزرار الدخول
      $('#tlogins button').removeAttr('disabled');

      switch (p88.msg) {
        case 'ok':
          // #usearch = حقل البحث في قائمة #users
          usea = $('#usearch');
          if (!socketDisabled) setInterval(updateUserSearch, 600);

          // مراقبة حقول الكتابة لـ typing indicator
          setInterval(function () {
            try {
              if (myid !== null && isLoggedIn === false && v483 !== null && v484 !== null) {
                var tboxEl = $(v483).find('.tbox:visible');
                var tlen   = tboxEl.length > 0 ? tboxEl.val().length : 0;
                if (tboxEl.length > 0 && tlen > 0 && v485 !== 1) {
                  v485 = 1; emit('ty', [v484, 1]);
                } else if (tlen === 0 && v485 !== 0) {
                  v485 = 0; emit('ty', [v484, 0]);
                }
              }
            } catch (e) {}
          }, 200);

          myid       = p88.id;
          isLoggedIn = true;
          authToken  = p88.token || authToken;

          // #settings .cp = رابط لوحة التحكم
          $('#settings .cp').attr('href', 'cp?cp=' + myid);
          roomToken = p88.ttoken;
          getCookie('token', roomToken);
          window.onbeforeunload = function () { return 'هل تريد مغادرة الدردشه؟'; };

          // إخفاء شاشة الدخول (.dad) وإظهار منطقة الشات
          // #d2 = رسائل الغرفة | #d0 = الشريط السفلي | .footer = الفوتر
          $('.dad').remove();
          $('#d2,.footer,#d0').show();
          $('#d2bc,#d2').css({ display: 'block', width: '100%' });

          // #dpnl = اللوحة الجانبية
          dpnl = $('#dpnl');
          initChat();
          break;

        case 'noname':   showStatus('warning', 'هذا الإسم غير مسجل !');    break;
        case 'badname':  showStatus('warning', 'يرجى إختيار أسم آخر');      break;
        case 'usedname': showStatus('danger',  'هذا الإسم مسجل من قبل');    break;
        case 'badpass':  showStatus('warning', 'كلمه المرور غير مناسبه');   break;
        case 'wrong':    showStatus('danger',  'كلمه المرور غير صحيحه');    break;
        case 'reg':
          showStatus('success', 'تم تسجيل العضويه بنجاح !');
          // نقل من نموذج التسجيل (#u3,#pass2) لنموذج الدخول (#u2,#pass1) ثم دخول تلقائي
          $('#u2').val($('#u3').val());
          $('#pass1').val($('#pass2').val());
          login(2);
          break;
      }
      break;

    case 'noname':   showStatus('warning', 'هذا الإسم غير مسجل !');    break;
    case 'badname':  showStatus('warning', 'يرجى إختيار أسم آخر');      break;
    case 'usedname': showStatus('danger',  'هذا الإسم مسجل من قبل');    break;
    case 'badpass':  showStatus('warning', 'كلمه المرور غير مناسبه');   break;
    case 'wrong':    showStatus('danger',  'كلمه المرور غير صحيحه');    break;

    // ── المتصلون ──────────────────────────────────────────────────
    // #lonline = قبل الدخول | #users = بعد الدخول | template: #uhtml
    case 'online':  updateOnlineList(p88,  0); break;
    case 'online+': updateOnlineList(p88,  1); break;
    case 'online-': updateOnlineList(p88, -1); break;

    case 'ulist':
      v474 = p88;
      // #busers = عداد المتواجدين على زر المتواجدين في الشريط السفلي
      $('#busers').text($.grep(v474, function (u) { return u.s == null; }).length);
      updateOnlineList(p88, 0);
      break;

    // #mic0..#mic4 = مؤشر مستوى الصوت لكل خانة مايك
    case 'mv':
      var micSlot = mic.indexOf(p88[0]);
      if (micSlot !== -1) {
        var vol   = Math.min(1, p88[1] * 1.4);
        var alpha = Math.max(0, Math.ceil(vol * (vol < 0.05 ? 0 : 100) / 5) * 5 * 0.0255);
        $('#mic' + micSlot).css('outline', '2px solid rgba(111,200,111,' + alpha + ')');
      }
      break;

    // ── الصلاحيات ─────────────────────────────────────────────────
    case 'powers':
      v479 = p88;
      for (var pi = 0; pi < v479.length; pi++) {
        v479[v479[pi].name === '' ? '_' : v479[pi].name] = v479[pi];
      }
      var meUser = getUserById(myid);
      if (meUser != null) {
        v475 = getPowerObj(meUser.power || '');
        updateCpMenu();
        v475.publicmsg > 0 ? $('.pmsg').show() : $('.pmsg').hide();
        if (v475.cp) {
          $('#cp li').hide()
            .find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']")
            .parent().show();
          if (v475.ban)      $('#cp li').find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show();
          if (v475.setpower) $('#cp li').find("a[href='#powers'],a[href='#subs']").parent().show();
          if (v475.owner)    $('#cp li').show();
        }
      }
      break;

    case 'power':
      var hadPower = Object.keys(v475).length !== 0;
      v475 = p88;
      updateCpMenu();
      if (v475.cp) {
        $('#cp li').hide()
          .find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']")
          .parent().show();
        if (v475.ban)      $('#cp li').find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show();
        if (v475.setpower) $('#cp li').find("a[href='#powers'],a[href='#subs']").parent().show();
        if (v475.owner)    $('#cp li').show();
      }
      var myRoom2 = getRoomById(myroom), myData2 = getUserById(myid);
      if (myRoom2 != null && myData2 != null &&
          (myRoom2.owner === myData2.lid || v475.roomowner === true)) {
        // .redit = زر إدارة الغرفة في #settings
        $('.redit').show();
      } else { $('.redit').hide(); }
      v475.publicmsg > 0 ? $('.pmsg').show() : $('.pmsg').hide();
      if (!hadPower && v475.cp) emit('cpi', {});
      break;

    // ── الرسائل ───────────────────────────────────────────────────
    // #d2 = حاوية رسائل الغرفة | template: #mhtml
    case 'msg':
      var msgSender = getUserById(p88.uid || '');
      if (msgSender != null && isBlocked(msgSender)) return;
      appendMessage('#d2', p88);
      break;

    case 'dmsg':
      $('.mi' + p88).remove();
      break;

    // #d2bc = رسائل الحائط | #bwall = عداد جديد على زر الحائط
    case 'bc':
      appendMessage('#d2bc', p88);
      var wallActive = dpnl && $(dpnl).is(':visible') && $('#wall').hasClass('active');
      if (!wallActive) {
        bcc++;
        $('#bwall').text(bcc).parent().css('color', 'orange');
      }
      break;

    case 'bclist':
      for (var bci = 0; bci < p88.length; bci++) appendMessage('#d2bc', p88[bci]);
      break;

    case 'delbc':
      $('.bid' + p88.bid).remove();
      break;

    case 'bc^':
      $('#d2bc .bid' + p88.bid + ' .fa-heart').first().text(
        (parseInt($('#d2bc .bid' + p88.bid + ' .fa-heart').first().text()) || 0) + 1
      );
      break;

    case 'mi+':
      $('#d2 .mi' + p88 + ' .fa-heart').first().text(
        (parseInt($('#d2 .mi' + p88 + ' .fa-heart').first().text()) || 0) + 1
      );
      break;

    // رسائل خاصة - نافذة #cw | تاب #chats في #dpnl
    case 'pm':
      var pmSender = getUserById(p88.uid);
      if (pmSender && isBlocked(pmSender)) return;
      if (p88.force !== 1 && nopm === true && $('#c' + p88.pm).length === 0) {
        emit('nopm', { id: p88.uid }); return;
      }
      openPmPanel(p88.pm, false);
      appendMessage('#d2' + p88.pm, p88);
      $('#c' + p88.pm).find('.u-msg').text(stripHtml($('<div>' + p88.msg + '</div>')));
      // تمييز زر المحادثات الخاصة #pmb باللون البرتقالي
      hl('#pmb', 'warning');
      break;

    case 'ppmsg':
      appendMessage('#d2' + (p88.pm || ''), p88);
      break;

    // ── الغرف ─────────────────────────────────────────────────────
    // #rooms = حاوية الغرف في #dpnl | template: #rhtml | #brooms = زر الغرف
    case 'rlist':
      for (var ri = 0; ri < p88.length; ri++) {
        rcach[p88[ri].id] = p88[ri];
        buildRoomElement(p88[ri]);
      }
      $('#brooms').attr('title', 'غرف الدردشه: ' + p88.length);
      break;

    case 'r+':
      rcach[p88.id] = p88;
      buildRoomElement(p88);
      $('#brooms').attr('title', 'غرف الدردشه: ' + Object.keys(rcach).length);
      break;

    case 'r-':
      delete rcach[p88];
      $('#room' + p88).remove();
      $('#brooms').attr('title', 'غرف الدردشه: ' + Object.keys(rcach).length);
      break;

    case 'r^':
      rcach[p88.id] = p88;
      $('#room' + p88.id).find('.r-name').text(p88.name);
      $('#room' + p88.id).find('.r-online').text(p88.online || 0);
      break;

    // .callx = أزرار المكالمة في نافذة #cw
    case 'settings':
      var499 = p88;
      var499.calls === true ? $('.callx').show() : $('.callx').hide();
      break;

    // ── الإيموجي ──────────────────────────────────────────────────
    case 'emos':
      v480 = p88; usersMap = {};
      for (var ei = 0; ei < v480.length; ei++) usersMap['ف' + (ei + 1)] = v480[ei];
      setTimeout(function () { showEmojiBox(); }, 1000);
      break;

    case 'dro3': colorsList = p88; break;
    case 'sico': roomsList  = p88; break;

    // ── الإشعارات ─────────────────────────────────────────────────
    // template: #not
    case 'not':
      if (p88.user !== null && p88.force !== 1 && nonot === true) {
        emit('nonot', { id: p88.user }); return;
      }
      showNotification(p88);
      break;

    // .typ = أنيميشن الكتابة في نافذة المحادثة الخاصة
    case 'ty':
      var tyPanel = $('.tbox' + p88[0]);
      if (tyPanel.length) {
        var typEl = tyPanel.parent().parent().parent().find('.typ');
        p88[1] === 1 ? typEl.show() : typEl.hide();
      }
      break;

    // ── المايك ────────────────────────────────────────────────────
    // #mic = الحاوية | #mic0..#mic4 = الخانات | #muteall = كتم الكل
    case 'mic':
      handleMicSlot(p88);
      break;

    // ── WebRTC P2P ────────────────────────────────────────────────
    case 'p2':     handleP2PCmd(p88);    break;
    case 'start':  handleP2PStart(p88);  break;
    case 'signal': handleP2PSignal(p88); break;

    // ── المكالمات ─────────────────────────────────────────────────
    // #call = لافتة المكالمة الواردة في index.html
    case 'call':    handleCallCmd(p88.id, 'call');    break;
    case 'calling': handleCallCmd(p88.id, 'calling'); break;
    case 'reject':  handleCallCmd(p88.id, 'reject');  break;
    case 'answer':  handleCallCmd(p88.id, 'answer');  break;

    case 'x':
      var xPeer = peersMap['_' + p88.id] || peersMap[p88.id];
      if (xPeer) { xPeer.destroy(); delete peersMap['_' + p88.id]; delete peersMap[p88.id]; }
      break;

    // ── المشرفون #ops في نموذج إنشاء/تعديل الغرفة #mkr ──────────
    case 'ops':
      var opsEl = $('#ops'); opsEl.children().remove();
      for (var oi = 0; oi < p88.length; oi++) {
        var opU  = p88[oi];
        var opEl = $($('#uhead').html());
        opEl.find('.u-pic').css({ width: '24px', height: '24px',
          'background-image': 'url("' + opU.pic + '")' });
        opEl.find('.u-topic').html(opU.name);
        opsEl.append(opEl);
      }
      break;

    case 'u++':
      var uPlusUser = getUserById(p88.id);
      if (uPlusUser) { uPlusUser.rep = p88.rep; uPlusUser.likes = p88.likes; }
      break;

    case 'ico+': renderNewIcon(p88);                           break;
    case 'ico-': $("a[pid='" + p88 + "']").parent().remove(); break;
    case 'uh':   renderUserHistory(p88);                      break;

    // ── انضمام / مغادرة الغرفة ────────────────────────────────────
    case 'rjoin':
      myroom = p88.id;
      var rd = getRoomById(myroom);
      // إخفاء #tlogins وإظهار #room
      $('#tlogins').hide(); $('#room').show();
      if (rd && rd.voice) $('#mic').show();
      $('#dpnl').hide();
      break;

    case 'rleave':
      myroom = null; mic = [];
      for (var pk in peersMap) { try { peersMap[pk].destroy(); } catch(e){} }
      peersMap = {};
      $('#room').hide(); $('#mic').hide();
      $('#tlogins').show();
      $('#d2').empty();
      break;

    // ── لوحة التحكم ──────────────────────────────────────────────
    case 'cp_rooms':    renderCpRooms(p88);    break;
    case 'cp_actions':  renderCpActions(p88);  break;
    case 'cp_msgs':     renderCpMsgs(p88);     break;
    case 'cp_subs':     renderCpSubs(p88);     break;
    case 'cp_shrt':     renderCpShrt(p88);     break;
    case 'cp_bans':     renderCpBans(p88);     break;
    case 'cp_logins':   renderCpLogins(p88);   break;
    case 'cp_fps':      renderCpFps(p88);      break;
    case 'cp_fltr':     renderCpFltr(p88);     break;
    case 'cp_bots':     renderCpBots(p88);     break;
    case 'cp_domains':  renderCpDomains(p88);  break;
    case 'cp_sico':     renderCpSico(p88);     break;
    case 'cp_owner':    renderCpOwner(p88);    break;
    case 'cp_rooms_edit': fillRoomEditForm(p88); break;

    // ── ملف المستخدم (رد السيرفر عند طلب بيانات مستخدم غير موجود محلياً) ──
    case 'upro':
      openUserProfile(p88);
      break;

    default:
      if (debugMode) console.log('[handleCmd] unknown:', cmd, p88);
  }
}

// ─────────────────────────────────────────────────────────────────────
// قائمة المتصلين
// #lonline (قبل الدخول) | #users (بعد الدخول) | template: #uhtml
// ─────────────────────────────────────────────────────────────────────

function updateOnlineList(users, mode) {
  var onlineListEl = (isLoggedIn && myid) ? $('#users') : $('#lonline');
  if (typeof users === 'string' && users.indexOf('[') !== -1) {
    try { users = JSON.parse(users); } catch(e) {}
  }

  var tmpl    = $($('#uhtml').html());
  tmpl.find('.u-pic').css({ width: '56px' });
  var tmplStr = tmpl[0].outerHTML;
  var count   = users.length;

  if (mode === 0) {
    count = null;
    onlineListEl.children().remove();
    try { users = users.slice(-60); } catch (e) {}
    var els = [];
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (u.s === true) continue;
      if (u.pic === 'pic.png' && typeof user_pic === 'string') u.pic = user_pic;
      var el = $($('<div>').append($(tmplStr)).html());
      renderUserCard(el, u);
      els.push(el);
    }
    onlineListEl.append(els);

  } else if (mode === 1) {
    var u = users;
    if (u.s === true) return;
    if (u.pic === 'pic.png' && typeof user_pic === 'string') u.pic = user_pic;
    var el = $($('<div>').append($(tmplStr)).html());
    renderUserCard(el, u);
    onlineListEl.prepend(el);
    count = (parseInt($('#s1').text()) || 0) + 1;

  } else if (mode === -1) {
    $('#lonline .' + users + ', #users .' + users).remove();
    count = (parseInt($('#s1').text()) || 0) - 1;
  }

  // #s1 = عداد المتصلين في الشريط العلوي
  if (count !== null) $('#s1').text(count);
}

function renderUserCard(el, user) {
  v486[user.id] = user;
  el.addClass(user.id);
  // .u-topic=الاسم | .u-msg=الحالة | .u-pic=الصورة | .co=العلم | .u-ico=الأيقونة
  el.find('.u-topic').text(user.topic).css({ 'background-color': user.bg, color: user.ucol });
  el.find('.u-msg').text(user.msg);
  el.find('.u-pic').css('background-image', 'url("' + user.pic + '")');
  var flag = (!user.co || user.co === '--' || user.co === 'A1' ||
              user.co === 'A2' || user.co === 'EU' || user.co === 'T1')
    ? 'flags/--.png' : 'flags/' + user.co + '.png';
  el.find('.co').attr('src', flag);
  if (user.ico && user.ico !== '') {
    el.find('.u-ico').attr('src',
      user.ico.replace('dro3/dro3/', 'dro3/').replace('dro3/sico', 'sico/'));
  }
  el.attr('data-uid', user.id).attr('data-rank', user.rank || 0);
  el.on('click', function () { upro(user.id); });
}

// updateusers = onclick زر المتواجدين في الشريط السفلي
function updateusers() { updateUserSearch(); }

// ─────────────────────────────────────────────────────────────────────
// إضافة رسالة
// template: #mhtml (x3 الأصلي) أو #umsg (index.html)
// الحاويات: #d2 (غرفة) | #d2bc (حائط) | #d2{uid} (خاص)
// ─────────────────────────────────────────────────────────────────────

function appendMessage(container, msg) {
  // x3 الأصلي يستخدم #mhtml - index.html يستخدم #umsg - نقرأ الاثنين
  if (!var1024) var1024 = $('#mhtml').html() || $('#umsg').html();
  if (!var1024) return;
  var el   = $(var1024);
  var diff = new Date().getTime() - msg.t;
  if (diff < 0) msg.t += diff;

  el.find('.u-pic')
    .css('background-image', 'url("' + msg.pic + '")')
    .attr('onclick', "upro('" + msg.uid + "');");
  el.find('.tago').attr('ago', msg.t).text(timeAgo(msg.t));
  el.find('.u-topic').html(msg.topic).css('color', msg.ucol);

  msg.msg = decodeEmojiText(msg.msg);

  var ytMatch = extractYouTube((msg.msg || '').replace(/\n/g, ''));
  if (ytMatch && ytMatch.length > 1 && container !== '#d2') {
    var ytBtn = "<button onclick='youtube(\"https://www.youtube.com/embed/" +
      ytMatch[1] + "\",this);' style='font-size:40px!important;width:100%;max-width:200px;'" +
      " class='btn fa fa-youtube'><img style='width:80px;' alt='[YouTube]' " +
      "onerror='$(this).parent().remove();'></button>";
    msg.msg = msg.msg.replace(ytMatch[1], ytBtn);
  }

  // .umsg و .u-msg كلاهما موجود في الـ templates المختلفة
  el.find('.umsg,.u-msg').html(msg.msg || '');
  if (msg.bid) el.addClass('bid' + msg.bid);
  if (msg.mid) el.addClass('mi'  + msg.mid);
  if (msg.s)   el.addClass('stealth');

  // .blike = إعجاب | .breply = رد | .bdel = حذف (موجودة في template)
  el.find('.blike').on('click', function () {
    if (msg.mid)      emit('mi+', msg.mid);
    else if (msg.bid) emit('bc^', { bid: msg.bid });
  });
  el.find('.breply').on('click', function () {
    replyId = '.mi' + msg.mid;
    $('.ppop .reply').parent().remove();
    $('#tbox').val('@' + (msg.topic || '') + ': ').focus();
  });
  el.find('.bdel').on('click', function () {
    if (!v475.ban && !v475.owner) return;
    if (msg.mid)      { emit('dmsg', msg.mid);           el.remove(); }
    else if (msg.bid) { emit('delbc', { bid: msg.bid }); el.remove(); }
  });

  $(container).append(el);
  var cont = $(container);
  if (cont.length) cont.scrollTop(cont[0].scrollHeight);
}

// ─────────────────────────────────────────────────────────────────────
// الغرف | template: #rhtml | حاوية: #rooms
// ─────────────────────────────────────────────────────────────────────

function buildRoomElement(room) {
  var tmpl = $('#rhtml').html(); if (!tmpl) return;
  var el = $(tmpl);
  el.attr('id', 'room' + room.id).attr('data-id', room.id);
  el.find('.r-name').text(room.name);
  el.find('.r-pic').css('background-image', 'url("' + (room.pic || 'room.png') + '")');
  el.find('.r-online').text(room.online || 0);
  if (room.needpass) el.find('.r-pwd').show(); else el.find('.r-pwd').hide();
  el.on('click', function () { joinRoom(room.id); });
  $('#rooms').append(el);
}

function joinRoom(roomId) {
  var room = getRoomById(roomId), pwd = '';
  if (room && room.needpass) {
    pwd = prompt('كلمه المرور؟', '');
    if (pwd === '' || pwd === null) return;
  }
  emit('rjoin', { id: roomId, pwd: pwd });
}

// ─────────────────────────────────────────────────────────────────────
// إرسال الرسائل
// Tsend()      → onclick زر إرسال الغرفة
// sendbc()     → onclick زر إرسال الحائط
// sendbc(true) → onclick زر رفع ملف في الحائط
// ─────────────────────────────────────────────────────────────────────

// Tsend = الاسم الذي يستخدمه onclick="Tsend();" في index.html
function Tsend() { sendMessage('#tbox'); }

function sendMessage(selector) {
  var tbox    = $(selector || '#tbox');
  var msgText = tbox.val().split('\n').join(' ');
  var meNow   = getUserById(myid);
  if (minL && meNow && meNow.rep < minL) {
    alert('الكتابه في العام تتطلب ' + minL + ' إعجاب');
    tbox.val(''); return;
  }
  tbox.val('').focus();
  if (msgText === '%0A' || msgText === '%0a' || msgText === '' || msgText === '\n') return;

  $('.ppop .reply').parent().remove();
  emit('msg', {
    msg : msgText,
    mi  : (replyId !== null && replyId.indexOf('.mi') !== -1)
          ? replyId.replace('.mi', '') : undefined
  });
  replyId = null;
}

// sendbc = onclick="sendbc();" (إرسال الحائط) | sendbc(true) = رفع ملف
function sendbc(isFile) {
  if (isFile) {
    var inp = $('<input type="file" accept="image/*">');
    inp.on('change', function () {
      var file = this.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) { emit('bc', { msg: '[img]' + e.target.result + '[/img]' }); };
      reader.readAsDataURL(file);
    });
    inp.click(); return;
  }
  var tbox = $('.tboxbc'), txt = tbox.val().trim();
  if (!txt) return;
  tbox.val('');
  emit('bc', { msg: txt });
}

function sendPm(uid) {
  var tbox = $('.tbox' + uid), txt = tbox.val().trim();
  if (!txt) return;
  tbox.val('');
  emit('pm', { msg: txt, id: uid });
}

// ─────────────────────────────────────────────────────────────────────
// نافذة المحادثة الخاصة | template: #cw من index.html
// ─────────────────────────────────────────────────────────────────────

function openPmPanel(pmId, isNew) {
  if (!getUserById(pmId)) return;
  if ($('#c' + pmId).length) { $('#c' + pmId).show(); return; }

  var user   = getUserById(pmId);
  var cwTmpl = $('#cw').html();
  var panel;

  if (cwTmpl) {
    panel = $(cwTmpl);
    panel.attr('id', 'c' + pmId);
    // .d2 = حاوية رسائل المحادثة الخاصة
    panel.find('.d2').attr('id', 'd2' + pmId);
    // .tbox = حقل الكتابة - يحتاج class إضافية لتمييزه
    panel.find('.tbox').addClass('tbox' + pmId);
    // .phide = زر إغلاق نافذة المحادثة
    panel.find('.phide').on('click', function () { panel.hide(); });
    // .sndpm = زر إرسال الرسالة الخاصة
    panel.find('.sndpm').on('click', function () { sendPm(pmId); });
    // .sndfile = زر رفع ملف في المحادثة الخاصة
    panel.find('.sndfile').on('click', function () { sendFilePm(pmId); });
    // .callx = زر الاتصال الصوتي
    panel.find('.callx').on('click', function () {
      if (!var499.calls) return;
      emit('call', { t: 'call', id: pmId });
    });
    // .head .fa-user = النقر لفتح ملف المستخدم
    panel.find('.head .fa-user').on('click', function () { upro(pmId); });
    // Enter للإرسال
    panel.find('.tbox').on('keypress', function (e) {
      if (e.which === 13 && !e.shiftKey) { e.preventDefault(); sendPm(pmId); }
    });
    // تعبئة بيانات المستخدم في الهيدر
    if (user) {
      panel.find('.u-topic').text(user.topic);
      panel.find('.u-pic').css('background-image', 'url("' + user.pic + '")');
      if (user.ico) panel.find('.u-ico').attr('src', user.ico);
    }
  } else {
    // fallback إذا لم يوجد template #cw
    panel = $('<div id="c' + pmId + '" class="c-flex border" style="position:fixed;bottom:50px;left:10px;width:300px;height:300px;z-index:1000;">' +
      '<div class="head bg d-flex" style="height:30px;padding:4px;">' +
      '<span class="u-topic flex-grow-1">' + (user ? user.topic : pmId) + '</span>' +
      '<label class="phide btn minix btn-danger fa fa-minus" style="padding:8px;"></label>' +
      '</div>' +
      '<div id="d2' + pmId + '" class="d2 flex-grow-1 light break" style="overflow-y:auto;"></div>' +
      '<div class="footer d-flex light" style="height:42px;padding:4px;">' +
      '<textarea class="tbox tbox' + pmId + ' flex-fill"></textarea>' +
      '<button class="sndpm btn btn-primary fa fa-send" onclick="sendPm(\'' + pmId + '\')"></button>' +
      '</div></div>');
    panel.find('.phide').on('click', function () { panel.hide(); });
    panel.find('.tbox').on('keypress', function (e) {
      if (e.which === 13 && !e.shiftKey) { e.preventDefault(); sendPm(pmId); }
    });
  }

  $('body').append(panel); panel.show();
  addChatTab(pmId, user);
  v483 = panel[0]; v484 = pmId;
}

// إضافة تاب في #chats داخل #dpnl
function addChatTab(pmId, user) {
  if ($('#chats .ctab' + pmId).length) return;
  var tab = $('<div class="uzr d-flex ctab' + pmId + '" style="border-bottom:1px solid lavender;padding:4px;cursor:pointer;">' +
    '<div class="u-pic fitimg" style="width:32px;height:32px;background-color:#f3f3f3;"></div>' +
    '<div class="flex-grow-1" style="padding:0 4px;overflow:hidden;">' +
    '<div class="u-topic dots" style="font-weight:bold;"></div>' +
    '<div class="u-msg mini dots" style="color:#888;"></div>' +
    '</div></div>');
  if (user) {
    tab.find('.u-pic').css('background-image', 'url("' + user.pic + '")');
    tab.find('.u-topic').text(user.topic);
  }
  tab.on('click', function () {
    $('#c' + pmId).show(); v483 = $('#c' + pmId)[0]; v484 = pmId;
  });
  $('#chats').append(tab);
}

function sendFilePm(uid) {
  var inp = $('<input type="file" accept="image/*">');
  inp.on('change', function () {
    var file = this.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) { emit('pm', { msg: '[img]' + e.target.result + '[/img]', id: uid }); };
    reader.readAsDataURL(file);
  });
  inp.click();
}

// ─────────────────────────────────────────────────────────────────────
// المكالمات الصوتية
// #call = لافتة المكالمة | زر الرد btn-success | زر الرفض btn-danger
// ─────────────────────────────────────────────────────────────────────

var activeCall = null;

function handleCallCmd(uid, type) {
  var user   = getUserById(uid);
  var callEl = $('#call');
  switch (type) {
    case 'call':
    case 'calling':
      if (activeCall !== null) handleCallCmd(activeCall.uid, 'hangup');
      if (uid === myid || !var499.calls) return;
      activeCall = { uid: uid };
      callEl.show();
      if (user) {
        callEl.find('.u-topic,.caller-name').text(user.topic);
        callEl.find('.u-pic').css('background-image', 'url("' + user.pic + '")');
        if (user.ico) callEl.find('.u-ico').attr('src', user.ico);
      }
      break;
    case 'answer':
      var ap = peersMap['_' + uid];
      if (ap) { ap.iscall = true; if (ap.audio) ap.audio.play(); }
      break;
    case 'reject':
      activeCall = null; callEl.hide();
      break;
    case 'hangup':
      var hp = peersMap['_' + uid] || peersMap[uid];
      if (hp) { hp.destroy(); delete peersMap['_' + uid]; delete peersMap[uid]; }
      activeCall = null; callEl.hide();
      break;
  }
}

// answerCall / rejectCall مربوطتان على أزرار #call في initChat
function answerCall() {
  if (!activeCall) return;
  emit('call', { t: 'answer', id: activeCall.uid });
  getMedia({ video: false, audio: true }, function (stream) {
    localStream = stream;
    startPeer(getUserById(activeCall.uid));
  });
}

function rejectCall() {
  if (!activeCall) return;
  emit('call', { t: 'reject', id: activeCall.uid });
  activeCall = null; $('#call').hide();
}

// ─────────────────────────────────────────────────────────────────────
// P2P Handlers
// ─────────────────────────────────────────────────────────────────────

function handleP2PCmd(data) {
  if (typeof SimplePeer === 'undefined') {
    setTimeout(function () { handleCallCmd(data.id, 'hangup'); }, 2000); return;
  }
  var user = getUserById(data.id);
  if (user == null) return;
  switch (data.t) {
    case 'start':  handleP2PStart(data);  break;
    case 'signal': handleP2PSignal(data); break;
    case 'x':
      var xp = peersMap[data.id] || peersMap['_' + data.id];
      if (xp) { xp.destroy(); delete peersMap[data.id]; delete peersMap['_' + data.id]; }
      break;
  }
}

function handleP2PStart(data) {
  var existing = peersMap[data.id];
  if (existing) { existing.on = null; existing.destroy(); }
  var peer = new Peer(data.id, false, null);
  peersMap[data.id] = peer; peer.uid = data.id;
  peer.on('error', function () {
    peer.destroy(); delete peersMap[data.id];
    emit('p2', { t: 'x', id: data.id });
    setTimeout(function () {
      if (peersMap[data.id] == null)
        emit('p2', { t: 'signal', data: 'repeer', id: data.id });
    }, 600);
  });
  peer.on('signal', function (signal) {
    emit('p2', { t: 'signal', id: data.id, dir: 0, data: signal });
  });
}

function handleP2PSignal(data) {
  var peer = peersMap[data.dir !== 1 ? data.id : '_' + data.id];
  if (!peer) return;
  var signals = Array.isArray(data.data) ? data.data : [data.data];
  for (var si = 0; si < signals.length; si++) {
    try { peer.peer.signal(signals[si]); } catch (e) {}
  }
}

// ─────────────────────────────────────────────────────────────────────
// المايك
// #mic = الحاوية | #mic0..#mic4 = الخانات
// #muteall = onclick="muteAll();" كتم الكل
// ─────────────────────────────────────────────────────────────────────

function handleMicSlot(data) {
  // data من السيرفر: مصفوفة slots أو كائن { slots, users }
  if (!data) return;
  var slots = Array.isArray(data) ? data : (data.slots || data);
  if (!Array.isArray(slots)) slots = [];

  // تحديث مصفوفة mic بـ IDs الحاليين
  mic = slots.map(function (s) { return s ? (s.id || s) : null; });

  for (var i = 0; i <= 4; i++) {
    var micEl = $('#mic' + i);
    if (!micEl.length) continue;
    var su = slots[i] ? getUserById(slots[i].id || slots[i]) : null;
    // تحديث صورة المستخدم في الخانة
    micEl.find('img.object-fit,img.fitimg').attr('src', su && su.ico ? su.ico : '');
    micEl.find('span').text(su ? (su.topic || '') : '');
    // ربط النقر على الخانة
    micEl.off('click').on('click', (function (idx) {
      return function () {
        if (mic[idx] === myid) requestMic(-1);   // تحرير المايك
        else if (!mic[idx])   requestMic(idx);   // طلب المايك
      };
    })(i));
  }

  // إظهار/إخفاء #mic
  var hasSlots = slots.some(function (s) { return !!s; });
  hasSlots ? $('#mic').show() : $('#mic').hide();
}

// onclick="#muteall"
function muteAll() { emit('muteall', {}); }

// ─────────────────────────────────────────────────────────────────────
// تسجيل الدخول
// login(1) = onclick="login(1);" ضيف (#u1)
// login(2) = onclick="login(2);" عضو (#u2,#pass1,#stealth)
// login(3) = onclick="login(3);" تسجيل جديد (#u3,#pass2)
// ─────────────────────────────────────────────────────────────────────

// الاسم login وليس handleLogin - مطابق لما في onclick بالـ HTML
function login(mode) {
  if (!isConnected) { showStatus('warning', 'جاري الاتصال...'); return; }
  $('#tlogins button').attr('disabled', 'true');

  var refr = (document.referrer || '');
  if (refr.indexOf('http://' + location.hostname) === 0) refr = '';
  if (refr.indexOf('://') !== -1) refr = refr.replace(/https?:\/\//, '');
  refr = refr.substring(0, 200);
  var r = getStorage('r');

  switch (mode) {
    case 1:
      // #u1 = حقل اسم الضيف
      emit('g', { username: $('#u1').val(), fp: navigator.n, refr: refr, r: r });
      getCookie('u1', encodeMsg($('#u1').val())); getCookie('isl', 'no');
      break;
    case 2:
      // #u2 = حقل اسم العضو | #pass1 = كلمة المرور | #stealth = وضع التخفي
      emit('login', {
        username : $('#u2').val(),
        stealth  : $('#stealth').is(':checked'),
        password : $('#pass1').val(),
        fp       : navigator.n, refr: refr, r: r
      });
      getCookie('u2', encodeMsg($('#u2').val()));
      getCookie('p1', encodeMsg($('#pass1').val()));
      getCookie('isl', 'yes');
      break;
    case 3:
      // #u3 = حقل اسم التسجيل | #pass2 = كلمة المرور الجديدة
      emit('reg', { username: $('#u3').val(), password: $('#pass2').val(),
        fp: navigator.n, refr: refr, r: r });
      break;
  }
}

// handleLogin = الاسم القديم في x3 الأصلي (نبقيه للتوافق)
function handleLogin(mode) { login(mode); }

// onclick="logout();" في #settings
function logout() { emit('logout', {}); reconnect(500); }

// ─────────────────────────────────────────────────────────────────────
// الإشعارات | template: #not
// ─────────────────────────────────────────────────────────────────────

function showNotification(data) {
  var tmpl = $('#not').html(); if (!tmpl) return;
  var el      = $(tmpl).first();
  var notUser = getUserById(data.user);
  if (notUser) {
    if (isBlocked(notUser)) return;
    el.find('.not-pic,.u-pic').css('background-image', 'url("' + notUser.pic + '")');
    el.find('.not-name,.u-topic').text(notUser.topic);
  }
  el.find('.not-msg,.u-msg').text(data.msg || '');
  $('body').append(el);
  setTimeout(function () { el.fadeOut(500, function () { el.remove(); }); }, 5000);
}

// ─────────────────────────────────────────────────────────────────────
// الإيموجي
// .emobox = زر فتح القائمة | #emobox = الحاوية (ثابتة أو ديناميكية)
// ─────────────────────────────────────────────────────────────────────

function showEmojiBox() {
  var box = $('#emobox'); if (!box.length) return;
  box.empty();
  for (var key in usersMap) {
    if (!usersMap.hasOwnProperty(key)) continue;
    var emo = usersMap[key], emoEl;
    if (emo.type === 'img' || emo.src) {
      emoEl = $('<img>').attr({ src: emo.src, alt: key, title: key })
        .css({ width:'32px', height:'32px', cursor:'pointer', margin:'2px' });
    } else {
      emoEl = $('<span>').text(emo.char || key).attr('title', key)
        .css({ cursor:'pointer', 'font-size':'24px', margin:'2px' });
    }
    emoEl.on('click', function () {
      insertEmoji($(this).attr('alt') || $(this).attr('title') || $(this).text());
    });
    box.append(emoEl);
  }
}

function insertEmoji(code) {
  var tbox = $('.tbox:visible').first(); if (!tbox.length) return;
  var pos  = tbox[0].selectionStart || tbox.val().length;
  var val  = tbox.val();
  tbox.val(val.substring(0, pos) + ' ' + code + ' ' + val.substring(pos)).focus();
}

// ─────────────────────────────────────────────────────────────────────
// بحث المستخدمين
// #usearch = حقل البحث داخل #users
// ─────────────────────────────────────────────────────────────────────

function updateUserSearch() {
  if (!usea || usea.val() === v1064) return;
  v1064 = usea.val();
  if (v1064 === '') {
    usea.addClass('bg'); $('#users .uzr').css('display', ''); return;
  }
  usea.removeClass('bg');
  var q = v1064.toLowerCase();
  $('#users .uzr').each(function () {
    $(this).css('display', $(this).find('.u-topic').text().toLowerCase().indexOf(q) !== -1 ? '' : 'none');
  });
}

// ─────────────────────────────────────────────────────────────────────
// ملف المستخدم | #upro modal
// upro(uid) = النقر على بطاقة مستخدم في أي مكان
// ─────────────────────────────────────────────────────────────────────

function upro(uid) {
  var user = getUserById(uid);
  if (!user) { emit('upro', uid); return; }
  openUserProfile(user);
}

function openUserProfile(user) {
  if (!user) return;
  if (typeof user === 'string') { user = getUserById(user); if (!user) return; }
  var uid   = user.id;
  var modal = $('#upro');

  // تعبئة البيانات الأساسية
  modal.find('.u-topic,.u-name').text(user.topic || user.name || uid);
  modal.find('.u-pic').css('background-image', 'url("' + user.pic + '")');
  modal.find('.ulike,.u-likes').text(user.likes || 0);
  modal.find('.u-msg').text(user.msg || '');
  modal.find('.u-room').text(user.room || '');
  if (user.ico) modal.find('.u-ico').attr('src', user.ico);
  modal.attr('data-uid', uid);

  // ─ ربط أزرار ملف المستخدم ─────────────────────────────────────
  // .upm = محادثة خاصة
  modal.find('.upm').off('click').on('click', function () {
    modal.modal('hide'); openPmPanel(uid, true);
  });
  // .unot = إرسال تنبيه
  modal.find('.unot').off('click').on('click', function () {
    var msg = prompt('نص التنبيه:', ''); if (msg) emit('not', { id: uid, msg: msg });
  });
  // .ulike = إعجاب بالمستخدم
  modal.find('.ulike').off('click').on('click', function () {
    emit('like', { id: uid }); $(this).text((parseInt($(this).text()) || 0) + 1);
  });
  // .uml = سحب المايك من المستخدم
  modal.find('.uml').off('click').on('click', function () {
    emit('uml', { id: uid }); modal.modal('hide');
  });
  // .umm = كتم مايك المستخدم
  modal.find('.umm').off('click').on('click', function () { emit('umm', { id: uid }); });
  // .uma = سماح للمستخدم بالمايك
  modal.find('.uma').off('click').on('click', function () { emit('uma', { id: uid }); });
  // .ugift = إرسال هدية
  modal.find('.ugift').off('click').on('click', function () {
    var g = prompt('رقم الهدية:', '1'); if (g) emit('gift', { id: uid, g: g });
  });
  // .uh = كشف النكات / سجل المستخدم
  modal.find('.uh').off('click').on('click', function () { emit('uh', uid); });
  // .udelpic = حذف صورة المستخدم
  modal.find('.udelpic').off('click').on('click', function () {
    emit('setpic', { id: uid, pic: 'pic.png' });
  });
  // .urkick = طرد من الغرفة
  modal.find('.urkick').off('click').on('click', function () {
    emit('rkick', { id: uid }); modal.modal('hide');
  });
  // .umod = ترقية لمراقب
  modal.find('.umod').off('click').on('click', function () { emit('umod', { id: uid }); });
  // .ukick = طرد من الشات
  modal.find('.ukick').off('click').on('click', function () {
    if (!confirm('طرد ' + (user.topic || uid) + '؟')) return;
    emit('kick', { id: uid }); modal.modal('hide');
  });
  // .uban = حظر
  modal.find('.uban').off('click').on('click', function () {
    var days = prompt('مدة الحظر بالأيام (0=دائم):', '1'); if (days === null) return;
    emit('ban', { id: uid, days: parseInt(days) || 0 }); modal.modal('hide');
  });
  // .ureport = تبليغ
  modal.find('.ureport').off('click').on('click', function () {
    emit('report', { id: uid }); alert('تم التبليغ');
  });
  // .umute = تجاهل محلي (حظر محلي)
  modal.find('.umute').off('click').on('click', function () {
    blockUser(uid); modal.modal('hide');
  });
  // .uunmute = إلغاء التجاهل المحلي
  modal.find('.uunmute').off('click').on('click', function () {
    if (user.lid) unblockUser(user.lid); modal.modal('hide');
  });
  // .u-nickc = حفظ تغيير الزخرفة
  modal.find('.u-nickc').off('click').on('click', function () {
    var nick = modal.find('.nickbox .u-topic').val().trim(); if (!nick) return;
    emit('setnick', { id: uid, nick: nick });
  });
  // .ulikec = تعديل عدد الإعجابات
  modal.find('.ulikec').off('click').on('click', function () {
    emit('setlikes', { id: uid, likes: parseInt(modal.find('.likec').val()) || 0 });
  });
  // .upower = تغيير صلاحية المستخدم
  modal.find('.upower').off('click').on('click', function () {
    emit('setpower', { id: uid,
      power : modal.find('.userpower').val(),
      days  : parseInt(modal.find('.userdays').val()) || 0 });
  });
  // .uroomz = نقل المستخدم لغرفة
  modal.find('.uroomz').off('click').on('click', function () {
    emit('rjoin', { id: modal.find('.roomz').val(), uid: uid, pwd: modal.find('.rpwd').val() });
  });

  // ملء قائمة الصلاحيات .userpower
  modal.find('.userpower').empty();
  (v479 || []).forEach(function (p) {
    modal.find('.userpower').append($('<option>').val(p.name).text(p.name || '(افتراضي)'));
  });
  if (user.power) modal.find('.userpower').val(user.power);

  // ملء قائمة الغرف .roomz
  modal.find('.roomz').empty();
  for (var rid in rcach) {
    modal.find('.roomz').append($('<option>').val(rid).text(rcach[rid].name));
  }

  // إظهار/إخفاء أقسام الإدارة حسب الصلاحيات
  var canAdmin = !!(v475.ban || v475.owner);
  modal.find('.powerbox,.roomzbox,.nickbox,.likebox').toggle(canAdmin);

  // #upsearch = بحث داخل قائمة الصلاحيات في الـ modal
  modal.find('#upsearch,input.upsearch').off('input').on('input', function () {
    var q = $(this).val().toLowerCase();
    modal.find('.userpower option').each(function () {
      $(this).toggle($(this).text().toLowerCase().indexOf(q) !== -1);
    });
  });

  modal.modal('show');
}

// ─────────────────────────────────────────────────────────────────────
// يوتيوب
// ─────────────────────────────────────────────────────────────────────

function youtube(url) {
  var modal = $('#ytmodal');
  if (!modal.length) {
    modal = $('<div id="ytmodal" class="modal fade"><div class="modal-dialog">' +
      '<div class="modal-content">' +
      '<button data-dismiss="modal" class="close">&times;</button>' +
      '<iframe width="100%" height="300" src="" frameborder="0" allowfullscreen></iframe>' +
      '</div></div></div>');
    $('body').append(modal);
  }
  modal.find('iframe').attr('src', url);
  modal.modal('show');
}

// ─────────────────────────────────────────────────────────────────────
// الحظر المحلي
// ─────────────────────────────────────────────────────────────────────

function loadBlockList() {
  var saved = getStorage('blocklist');
  if (saved && saved !== '') {
    try { var l = JSON.parse(saved); if (Array.isArray(l)) currentPower = l; } catch(e) {}
  }
}

function blockUser(uid) {
  var user = getUserById(uid); if (!user) return;
  currentPower.push({ lid: user.lid });
  getCookie('blocklist', JSON.stringify(currentPower));
}

function unblockUser(lid) {
  currentPower = currentPower.filter(function (u) { return u.lid !== lid; });
  getCookie('blocklist', JSON.stringify(currentPower));
}

// ─────────────────────────────────────────────────────────────────────
// Fingerprint
// ─────────────────────────────────────────────────────────────────────

function collectFingerprint() {
  navigator.n = navigator.n || {};
  var fp = {};
  try { var o = new Intl.DateTimeFormat('default').resolvedOptions(); for (var k in o) fp[k] = o[k]; } catch(e) {}
  try { if (screen && screen.width) fp.scr = [screen.width, screen.height, screen.colorDepth].join('x'); } catch(e) {}
  try {
    var cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
    var cx = cv.getContext('2d'); cx.fillStyle = '#f60'; cx.fillRect(0,0,1,1);
    fp.cv = cv.toDataURL().substring(0, 32); cv.remove();
  } catch(e) {}
  try {
    var wgl = document.createElement('canvas');
    var gl  = wgl.getContext('webgl') || wgl.getContext('experimental-webgl');
    var ext = gl.getExtension('WEBGL_debug_renderer_info');
    fp.gl   = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); wgl.remove();
  } catch(e) {}
  navigator.n = fp;
  emit('fp', fp);
}

// ─────────────────────────────────────────────────────────────────────
// لوحة التحكم
// ─────────────────────────────────────────────────────────────────────

function buildTable(headers) {
  var tbl = $('<table class="tablesorter table table-bordered table-hover"><thead><tr></tr></thead><tbody></tbody></table>');
  headers.forEach(function (h) { tbl.find('thead tr').append($('<th>').text(h)); });
  return tbl;
}

// #icos = حاوية الأيقونات في لوحة التحكم
function renderNewIcon(data) {
  var ico = $('<a>').attr({ pid: data.id, href: '#' });
  ico.append($('<img>').attr('src', data.src).css({ 'max-height': '32px', margin: '2px' }));
  ico.on('click', function () { insertEmoji($(this).attr('pid')); return false; });
  $('#icos').append(ico);
}

function renderCpRooms(data) {
  $('#cp_rooms_list').empty();
  var tbl = buildTable(['الغرفه', 'المالك', 'المتصلون', '']);
  data.forEach(function (room) {
    tbl.find('tbody').append(
      '<tr><td>' + room.name + '</td><td>' + room.owner + '</td>' +
      '<td>' + (room.online || 0) + '</td>' +
      '<td><button onclick="send(\'cp\',{cmd:\'cp_rooms_edit\',id:\'' + room.id + '\'})" class="btn btn-xs btn-primary">تعديل</button></td></tr>'
    );
  });
  $('#cp_rooms_list').append(tbl);
}

function renderCpBans(data) {
  $('#bans .tablesorter').remove();
  var tbl = buildTable(['العضو', 'الحظر', 'ينتهي في', 'الحالات', 'آخر حاله', '']);
  data.forEach(function (ban) {
    var del = "<a class='btn btn-danger fa fa-times' onclick='send(\"cp\",{cmd:\"aban\",id:\"" +
      ban.id + "\"});$(this).closest(\"tr\").remove()'></a>";
    tbl.find('tbody').append(
      '<tr><td>' + ban.name + '</td><td>' + ban.type + '</td>' +
      '<td>' + (ban.expires || '') + '</td><td>' + (ban.count || 0) + '</td>' +
      '<td>' + (ban.last || '') + '</td><td>' + del + '</td></tr>'
    );
  });
  $('#bans').append(tbl);
}

function renderCpLogins(data) {
  $('#logins .tablesorter').remove();
  var tbl = buildTable(['العضو','الزخرفه','الآي بي','الجهاز','صلاحيات','لايكات','آخر تواجد','التسجيل','']);
  data.forEach(function (u) {
    tbl.find('tbody').append(
      '<tr><td>' + u.name + '</td><td>' + (u.nick || '') + '</td>' +
      '<td>' + (u.ip || '') + '</td><td>' + (u.ua || '') + '</td>' +
      '<td>' + (u.power || '') + '</td><td>' + (u.likes || 0) + '</td>' +
      '<td>' + (u.last    ? new Date(u.last).toLocaleDateString('ar')    : '') + '</td>' +
      '<td>' + (u.created ? new Date(u.created).toLocaleDateString('ar') : '') + '</td>' +
      '<td><button onclick="upro(\'' + u.id + '\')" class="btn btn-xs btn-primary fa fa-user"></button></td></tr>'
    );
  });
  $('#logins').append(tbl);
}

function renderCpSico(data) {
  $('#cp .sico').children().remove();
  data.forEach(function (room) {
    var img = $('<img>').attr('src', 'sico/' + room.name)
      .css({ 'max-height': '32px', 'max-width': '100%', margin: '4px', padding: '4px' });
    img.on('click', function () { $('#cp .selbox').val($(this).attr('src').replace('sico/', '')); });
    $('#cp .sico').append(img);
  });
}

function renderCpOwner(data) {
  $('#cp_owner_list').empty();
  var tbl = buildTable(['العضو', 'الصلاحية', 'الإعجابات', '']);
  (data.users || []).forEach(function (u) {
    tbl.find('tbody').append(
      '<tr><td>' + u.name + '</td><td>' + (u.power || '') + '</td>' +
      '<td>' + (u.likes || 0) + '</td>' +
      '<td><button onclick="upro(\'' + u.id + '\')" class="btn btn-xs btn-info fa fa-user"></button></td></tr>'
    );
  });
  $('#cp_owner_list').append(tbl);
}

function renderUserHistory(data) {
  var tbl = buildTable(['العضو', 'الزخرفه', 'IP', 'الوقت', '#']);
  for (var i = data.length - 1; i >= 0; i--) {
    var u = data[i];
    var searchBtn = uhSearch
      ? '<a class="btn btn-primary fa fa-search" onclick="emit(\'uh\',\'' + u.lid + '\')" href="#"></a>'
      : '';
    tbl.find('tbody').append(
      '<tr><td>' + u.name + '</td><td>' + (u.nick || '') + '</td>' +
      '<td>' + (u.ip || '') + '</td>' +
      '<td>' + (u._c ? timeAgo(u._c) : '') + '</td>' +
      '<td>' + searchBtn + '</td></tr>'
    );
  }
  var modal = $(
    '<div class="modal fade"><div class="modal-dialog"><div class="modal-content">' +
    '<div class="modal-header"><h4>كشف النكات</h4>' +
    '<button class="close" data-dismiss="modal">&times;</button></div>' +
    '<div class="modal-body"></div></div></div></div>'
  );
  modal.find('.modal-body').append(tbl);
  $('body').append(modal); modal.modal('show');
  modal.on('hidden.bs.modal', function () { modal.remove(); });
}

// باقي جداول لوحة التحكم (مكتملة)
function renderCpFps(data) {
  var c = $('#fps'); c.find('.tablesorter').remove(); if (!data||!data.length) return;
  var tbl = buildTable(['IP','الجهاز','آخر تواجد','#']);
  data.forEach(function(f){
    tbl.find('tbody').append('<tr><td>'+(f.ip||'')+'</td><td>'+(f.ua||'')+'</td><td>'+(f.last||'')+'</td>' +
      '<td><button onclick="upro(\''+f.id+'\')" class="btn btn-xs btn-primary fa fa-user"></button></td></tr>');
  });
  c.append(tbl);
}

function renderCpActions(data) {
  var c = $('#actions'); c.find('.tablesorter').remove(); if (!data||!data.length) return;
  var tbl = buildTable(['العضو','الحدث','الوقت']);
  data.forEach(function(a){
    tbl.find('tbody').append('<tr><td>'+(a.name||'')+'</td><td>'+(a.type||'')+'</td><td>'+(a.time||'')+'</td></tr>');
  });
  c.append(tbl);
}

function renderCpMsgs(data) {
  var c = $('#cp_msgs'); if (!c.length) return; c.find('.tablesorter').remove();
  var tbl = buildTable(['المرسل','الرسالة','الوقت']);
  (data||[]).forEach(function(m){
    tbl.find('tbody').append('<tr><td>'+(m.name||'')+'</td><td>'+(m.msg||'')+'</td><td>'+(m.t||'')+'</td></tr>');
  });
  c.append(tbl);
}

function renderCpSubs(data) {
  var c = $('#subs'); if (!c.length) return; c.find('.tablesorter').remove();
  var tbl = buildTable(['العضو','الصلاحية','ينتهي في','']);
  (data||[]).forEach(function(s){
    tbl.find('tbody').append('<tr><td>'+(s.name||'')+'</td><td>'+(s.power||'')+'</td><td>'+(s.exp||'')+'</td>' +
      '<td><button onclick="upro(\''+s.id+'\')" class="btn btn-xs btn-info fa fa-user"></button></td></tr>');
  });
  c.append(tbl);
}

function renderCpShrt(data) {
  var c = $('#cp_shrt'); if (!c.length) return; c.find('.tablesorter').remove();
  var tbl = buildTable(['المختصر','الرابط','']);
  (data||[]).forEach(function(s){
    tbl.find('tbody').append('<tr><td>'+(s.key||'')+'</td><td>'+(s.val||'')+'</td>' +
      '<td><button onclick="send(\'cp\',{cmd:\'del_shrt\',id:\''+s.id+'\'});$(this).closest(\'tr\').remove();" class="btn btn-xs btn-danger fa fa-times"></button></td></tr>');
  });
  c.append(tbl);
}

function renderCpFltr(data) {
  var c = $('#fltr'); if (!c.length) return; c.find('.tablesorter').remove();
  var tbl = buildTable(['الكلمة','']);
  (data||[]).forEach(function(f){
    var w=f.word||f, id=f.id||f;
    tbl.find('tbody').append('<tr><td>'+w+'</td>' +
      '<td><button onclick="send(\'cp\',{cmd:\'del_fltr\',id:\''+id+'\'});$(this).closest(\'tr\').remove();" class="btn btn-xs btn-danger fa fa-times"></button></td></tr>');
  });
  c.append(tbl);
}

function renderCpBots(data) {
  var c = $('#bots'); if (!c.length) return; c.find('.tablesorter').remove();
  var tbl = buildTable(['البوت','الحالة','']);
  (data||[]).forEach(function(b){
    tbl.find('tbody').append('<tr><td>'+(b.name||'')+'</td><td>'+(b.status||'')+'</td>' +
      '<td><button onclick="send(\'cp\',{cmd:\'bot_toggle\',id:\''+b.id+'\'})" class="btn btn-xs btn-primary">تبديل</button></td></tr>');
  });
  c.append(tbl);
}

function renderCpDomains(data) {
  var c = $('#domains'); if (!c.length) return; c.find('.tablesorter').remove();
  var tbl = buildTable(['النطاق','']);
  (data||[]).forEach(function(d){
    var v=d.domain||d, id=d.id||d;
    tbl.find('tbody').append('<tr><td>'+v+'</td>' +
      '<td><button onclick="send(\'cp\',{cmd:\'del_domain\',id:\''+id+'\'});$(this).closest(\'tr\').remove();" class="btn btn-xs btn-danger fa fa-times"></button></td></tr>');
  });
  c.append(tbl);
}

// ─────────────────────────────────────────────────────────────────────
// الإعدادات الشخصية - الدوال المكشوفة للـ HTML
// ─────────────────────────────────────────────────────────────────────

// onclick="setprofile();" - زر حفظ الإعدادات في #settings
function setprofile() {
  emit('profile', {
    topic : $('.stopic').val().trim(),
    msg   : $('.smsg').val().trim(),
    ucol  : rgbToHex($('.scolor').css('background-color')),
    mcol  : rgbToHex($('.mcolor').css('background-color')),
    bg    : rgbToHex($('.sbg').css('background-color'))
  });
}

// onclick="sendpic();" - زر تغيير الصورة في #settings
function sendpic() {
  var inp = $('<input type="file" accept="image/*">');
  inp.on('change', function () {
    var file = this.files[0]; if (!file) return;
    if (file.size > 500 * 1024) { alert('الصورة كبيرة جداً (الحد 500KB)'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      emit('setpic', { pic: e.target.result });
      $('.spic').attr('src', e.target.result); // .spic = الصورة في #settings
    };
    reader.readAsDataURL(file);
  });
  inp.click();
}

// onclick="roomspic($(this).find('img'));" - النقر على صورة الغرفة في #mkr
function roomspic(imgEl) {
  var inp = $('<input type="file" accept="image/*">');
  inp.on('change', function () {
    var file = this.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) { imgEl.attr('src', e.target.result); };
    reader.readAsDataURL(file);
  });
  inp.click();
}

// onclick="mkr();" - زر "غرفة جديدة" داخل #rooms في #dpnl
function mkr() {
  var modal = $('#mkr');
  modal.find('.rtopic,.rabout,.rwelcome,.rpwd').val('');
  modal.find('.rmax,.rl,.rvl').val('');
  modal.find('.rdel,.rv').prop('checked', false);
  modal.find('.rpic img').attr('src', 'room.png');
  modal.find('.rsave,.rdelete').hide();
  modal.find('.rmake').show();
  modal.removeAttr('data-rid');
  modal.modal('show');
}

// onclick="if(myroom!=null){redit(myroom);}" - زر إدارة الغرفة في #settings
function redit(roomId) {
  var room = getRoomById(roomId);
  if (!room) { emit('cp', { cmd: 'cp_rooms_edit', id: roomId }); return; }
  fillRoomEditForm(room);
}

function fillRoomEditForm(room) {
  var modal = $('#mkr');
  modal.find('.rtopic').val(room.name    || '');
  modal.find('.rabout').val(room.about   || '');
  modal.find('.rwelcome').val(room.welcome || '');
  modal.find('.rpwd').val(room.pwd       || '');
  modal.find('.rmax').val(room.max       || '');
  modal.find('.rl').val(room.l           || '');
  modal.find('.rvl').val(room.vl         || '');
  modal.find('.rdel').prop('checked', !!room.pinned);
  modal.find('.rv').prop('checked',   !!room.voice);
  if (room.pic) modal.find('.rpic img').attr('src', room.pic);
  modal.find('.rmake').hide();
  modal.find('.rsave,.rdelete').show();
  modal.attr('data-rid', room.id);
  modal.modal('show');
}

// onclick="pmsg();" - زر إرسال إعلان في #settings
function pmsg() {
  $('#mnot').modal('show');
  $('#mnot .rsave').off('click').on('click', function () {
    var txt = $('#mnot textarea').val().trim(); if (!txt) return;
    emit('pmsg', { msg: txt, pp: $('#mnot .ispp').is(':checked') });
    $('#mnot').modal('hide');
  });
}

// hl('#pmb','primary') - تحديث لون زر المحادثات الخاصة
function hl(sel, cls) {
  $(sel).css('color', '').removeClass('label-warning label-danger label-info label-success')
    .addClass('label-' + cls);
}

// fixSize() - تُستدعى من onchange الزوم وعند تغيير حجم النافذة
function fixSize() {
  var h = $(window).height();
  $('#room').css('height', h + 'px');
  $('#d2').css('max-height', (h - 100) + 'px');
}

// ─────────────────────────────────────────────────────────────────────
// ربط أزرار #mkr modal
// ─────────────────────────────────────────────────────────────────────

function bindMkrButtons() {
  // .rmake = إنشاء غرفة جديدة
  $('#mkr .rmake').off('click').on('click', function () {
    emit('rmake', {
      name    : $('#mkr .rtopic').val().trim(),
      about   : $('#mkr .rabout').val().trim(),
      welcome : $('#mkr .rwelcome').val().trim(),
      pwd     : $('#mkr .rpwd').val().trim(),
      max     : parseInt($('#mkr .rmax').val()) || 20,
      l       : parseInt($('#mkr .rl').val())   || 0,
      vl      : parseInt($('#mkr .rvl').val())  || 0,
      pinned  : $('#mkr .rdel').is(':checked'),
      voice   : $('#mkr .rv').is(':checked'),
      pic     : $('#mkr .rpic img').attr('src') || 'room.png'
    });
    $('#mkr').modal('hide');
  });
  // .rsave = حفظ تعديلات الغرفة
  $('#mkr .rsave').off('click').on('click', function () {
    var rid = $('#mkr').attr('data-rid');
    emit('redit', {
      id      : rid,
      name    : $('#mkr .rtopic').val().trim(),
      about   : $('#mkr .rabout').val().trim(),
      welcome : $('#mkr .rwelcome').val().trim(),
      pwd     : $('#mkr .rpwd').val().trim(),
      max     : parseInt($('#mkr .rmax').val()) || 20,
      l       : parseInt($('#mkr .rl').val())   || 0,
      vl      : parseInt($('#mkr .rvl').val())  || 0,
      pinned  : $('#mkr .rdel').is(':checked'),
      voice   : $('#mkr .rv').is(':checked'),
      pic     : $('#mkr .rpic img').attr('src') || 'room.png'
    });
    $('#mkr').modal('hide');
  });
  // .rdelete = حذف الغرفة
  $('#mkr .rdelete').off('click').on('click', function () {
    if (!confirm('حذف الغرفة نهائياً؟')) return;
    emit('rdel', { id: $('#mkr').attr('data-rid') });
    $('#mkr').modal('hide');
  });
}

// ─────────────────────────────────────────────────────────────────────
// Color Picker للإعدادات الشخصية
// .cpick.scolor = لون الاسم | .cpick.mcolor = لون الخط | .cpick.sbg = لون الخلفية
// ─────────────────────────────────────────────────────────────────────

function initColorPickers() {
  $('.cpick').each(function () {
    var el = $(this);
    el.off('click.cpick').on('click.cpick', function () {
      var inp = $('<input type="color">').val(rgbToHex(el.css('background-color')));
      inp.on('input change', function () { el.css('background-color', $(this).val()); });
      inp.click();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────
// تهيئة التطبيق بعد تسجيل الدخول
// ─────────────────────────────────────────────────────────────────────

function initChat() {
  // template الرسالة: x3 الأصلي يستخدم #mhtml | index.html يستخدم #umsg
  var1024 = $('#mhtml').html() || $('#umsg').html();
  loadBlockList();
  setInterval(updateTimeLabels, 30000);
  bindMkrButtons();
  initColorPickers();

  // ربط أزرار المكالمة في #call
  // زر الرد (btn-success) وزر الرفض (btn-danger)
  $('#call .btn-success').off('click').on('click', answerCall);
  $('#call .btn-danger').off('click').on('click',  rejectCall);

  // ربط .emobox لفتح/إغلاق قائمة الإيموجي
  $(document).off('click.emobox').on('click.emobox', '.emobox', function () {
    var box = $('#emobox');
    if (!box.length) {
      box = $('<div id="emobox" style="position:fixed;bottom:60px;right:10px;z-index:2000;' +
        'background:#fff;border:1px solid #ccc;padding:4px;max-width:260px;' +
        'max-height:200px;overflow-y:auto;border-radius:4px;"></div>');
      $('body').append(box);
      showEmojiBox();
    }
    box.toggle();
  });

  // استعادة إعدادات الواجهة من localStorage
  var savedZoom = getStorage('zoom');
  if (savedZoom) { document.body.style.zoom = savedZoom; $('#zoom').val(savedZoom); }

  var savedTs = getStorage('turn_server');
  if (savedTs) { turn_server = parseInt(savedTs) || 1; $('#turn_server').val(savedTs); }

  var savedBr = getStorage('bitrate');
  if (savedBr) { bitrate = parseInt(savedBr) || 24; $('#turn_bitrate').val(savedBr); }

  // استعادة إعداد showpics (من index.html السطر 2078)
  var savedSp = getStorage('showpics');
  if (savedSp !== '') { showpics = parseInt(savedSp); $('#showpics').val(savedSp); }
}

// ─────────────────────────────────────────────────────────────────────
// jQuery ready
// ─────────────────────────────────────────────────────────────────────

$(function () {
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // استعادة بيانات الدخول المحفوظة
  var savedUser = getStorage('u2') || getStorage('u1') || '';
  var savedPass = getStorage('p1') || '';
  var savedIsl  = getStorage('isl') || 'no';

  // #u1 = ضيف | #u2 = عضو | #pass1 = كلمة المرور
  if (savedUser) $('#u1,#u2').val(decodeUri(savedUser));
  if (savedPass) $('#pass1').val(decodeUri(savedPass));

  // ربط أزرار الدخول من x3 الأصلي (btn-guest, btn-login, btn-reg, btn-logout)
  // هذه الأزرار موجودة في x3 الأصلي لكن في index.html يستخدمون onclick مباشرة
  $('#btn-guest').on('click',  function () { login(1); });
  $('#btn-login').on('click',  function () { login(2); });
  $('#btn-reg').on('click',    function () { login(3); });
  $('#btn-logout').on('click', function () { logout(); });
  $('#btn-send').on('click',   function () { sendMessage(); });
  $('#btn-answer').on('click', function () { answerCall(); });
  $('#btn-reject').on('click', function () { rejectCall(); });

  // Enter في حقول الدخول
  $('#u1').on('keypress',        function (e) { if (e.which === 13) login(1); });
  $('#u2,#pass1').on('keypress', function (e) { if (e.which === 13) login(2); });
  $('#u3,#pass2').on('keypress', function (e) { if (e.which === 13) login(3); });

  // Enter في #tbox لإرسال رسالة الغرفة
  $('#tbox').on('keypress', function (e) {
    if (e.which === 13 && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // ضبط الأحجام
  fixSize();
  $(window).on('resize', fixSize);

  // تهيئة #loginstat بحالة الانتظار
  showStatus('warning', 'جاري الاتصال...');

  // دخول تلقائي إذا كانت البيانات محفوظة (كان الأخير عضوًا)
  if (savedIsl === 'yes' && savedUser && savedPass) {
    setTimeout(function () { login(2); }, 500);
  }

  // بدء الاتصال بالسيرفر
  initSocket();
});

// ─────────────────────────────────────────────────────────────────────
// ملخص الأشياء المضافة مقارنةً بـ x3 الأصلي
// (موجودة في index.html لكن لم تكن في x3 القديم)
// ─────────────────────────────────────────────────────────────────────
/*
  1.  login(mode)        - الاسم الصحيح للدالة (x3 الأصلي يسميها handleLogin)
                           في HTML: onclick="login(1);" / login(2); / login(3);
  2.  Tsend()            - onclick="Tsend();" زر إرسال الغرفة
  3.  sendbc(isFile)     - onclick="sendbc();" | sendbc(true);
  4.  muteAll()          - onclick="muteAll();" زر #muteall
  5.  updateusers()      - onclick في زر المتواجدين
  6.  mkr()              - onclick="mkr();" زر غرفة جديدة
  7.  redit(roomId)      - onclick="if(myroom!=null){redit(myroom);}"
  8.  setprofile()       - onclick="setprofile();" حفظ الإعدادات
  9.  sendpic()          - onclick="sendpic();" تغيير الصورة
  10. roomspic(imgEl)    - onclick="roomspic($(this).find('img'));"
  11. pmsg()             - onclick="pmsg();" إرسال إعلان
  12. logout()           - موجودة لكن يستدعيها HTML مباشرة
  13. hl(sel, cls)       - onclick="hl('#pmb','primary');"
  14. setv(key, val)     - onchange="setv('zoom',this.value);..."
  15. fixSize()          - onchange الزوم وresize النافذة
  16. handleLogin(mode)  - الاسم القديم (محفوظ للتوافق)
  17. openUserProfile(u) - دالة جديدة تعالج كل أزرار #upro modal
  18. fillRoomEditForm() - من رد السيرفر cp_rooms_edit
  19. bindMkrButtons()   - ربط .rmake .rsave .rdelete
  20. addChatTab(pmId)   - تاب في #chats
  21. sendFilePm(uid)    - رفع ملف في المحادثة الخاصة
  22. initColorPickers() - .cpick بدون مكتبة خارجية
  23. handleMicSlot(data)- مكتملة (كانت فارغة في x3 الأصلي!)
  24. case 'rjoin'       - معالج الانضمام للغرفة (لم يكن في x3 الأصلي)
  25. case 'rleave'      - معالج المغادرة (لم يكن في x3 الأصلي)
  26. case 'upro'        - معالج رد بيانات المستخدم من السيرفر
  27. case 'cp_rooms_edit' - فتح نموذج تعديل الغرفة
  28. minR, showpics,    - متغيرات من index.html (السطور 2076-2079)
      uhSearch, deepSearch
*/
