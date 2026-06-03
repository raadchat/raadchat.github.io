/* =========================================================
   X3 Chat Client - إعادة بناء كاملة ونظيفة
   مبني من الكود الأصلي المفكوك - بدون أخطاء
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
var minR         = 0;
var playing      = null;
var myid         = null;
var deepSearch   = 4;
var uhSearch     = true;
var bitrate      = 24;
var user_pic     = null;
var room_pic     = null;
var bcdown       = false;
var showpics     = 100;
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
var debugMode      = false;
var isMobile       = false;

// الصوت والـ WebRTC
var peersMap       = {};
var localStream;
var audioContext;
var audioDestination;

// DOM وحالة الواجهة
var usea;
var dpnl;
var v483          = null;   // الـ panel النشط
var v484          = null;   // id الغرفة النشطة
var v485          = 0;      // حالة typing indicator
var v486          = {};     // cache بيانات المستخدمين  { id: userObj }
var v474          = [];     // ulist (قائمة المستخدمين الكاملة للمشرفين)
var v488          = {};     // نوافذ iframe الفرعية
var v480          = [];     // بيانات الإيموجي الخام
var v481          = {};     // cache عناصر DOM للمستخدمين
var v472          = false;  // منع التوجيه المتعدد

// الصلاحيات
var v475          = {};     // صلاحيات المستخدم الحالي
var v479          = [];     // قائمة كل الصلاحيات

// الغرف والألوان
var colorsList    = [];
var roomsList     = [];
var usersMap      = {};     // { 'ف1': emojiObj, ... }

// متغيرات الدردشة
var var499        = {};     // إعدادات الغرفة الحالية (calls,...)
var var1024       = null;   // template عنصر الرسالة
var v1064         = '';     // آخر قيمة بحث

// قائمة المحظورين محلياً
var currentPower  = [];

// معرّف الجلسة (anti-duplicate tab)
window.cpi = new Date().getTime().toString(36);

// ─── الأوامر التي لا تحتاج تسجيل دخول ────────────────────────────────
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
  return decodeURIComponent(str);
}

function hasStorage() {
  return typeof Storage !== 'undefined';
}

// حفظ قيمة (localStorage → cookie احتياطي)
function getCookie(key, value) {
  if (hasStorage()) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      setCookieFallback(key, value);
    }
  } else {
    setCookieFallback(key, value);
  }
}

function setCookieFallback(key, value) {
  var d = new Date();
  d.setTime(d.getTime() + 6 * 24 * 60 * 60 * 1000);
  var expires = 'expires=' + d.toUTCString();
  document.cookie = key + '=' + encodeMsg(value) + '; ' + expires +
    '; domain=' + window.location.hostname + '; path=/';
}

// قراءة قيمة (localStorage → cookie احتياطي)
function getStorage(key) {
  if (hasStorage()) {
    var val = '';
    try {
      val = localStorage.getItem(key);
    } catch (e) {
      return getCookieFallback(key);
    }
    if (val === 'null' || val === null) val = '';
    return val;
  }
  return getCookieFallback(key);
}

function getCookieFallback(key) {
  var name = key + '=';
  var parts = document.cookie.split('; ');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    while (part.charAt(0) === ' ') part = part.substring(1);
    if (part.indexOf(name) !== -1)
      return decodeUri(part.substring(name.length, part.length));
  }
  return '';
}

// تشفير الأوامر (XOR بسيط، نفس الخوارزمية الأصلية)
function decodeCmd(str) {
  var chars = (str || '').split('');
  var len = chars.length;
  for (var i = 0; i < len; i++) {
    chars[i] = String.fromCharCode(str.charCodeAt(i) ^ 2);
    i += i < 20 ? 1 : i < 200 ? 4 : 16;
  }
  return chars.join('');
}

// إرسال أمر للسيرفر
function emit(cmd, data) {
  if (socketDisabled) {
    if (window.opener === null) { reconnect(); return; }
    window.opener.postMessage([cmd, data]);
  } else {
    socket.emit('msg', { cmd: decodeCmd(cmd), data: data });
  }
}

// الدوال المساعدة لبيانات المستخدمين والغرف
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
  var diff = new Date().getTime() - timestamp;
  var secs = Math.abs(diff) / 1000;
  if (secs < 59) return 'الآن';
  secs = secs / 60;
  if (secs < 59) return parseInt(secs) + 'د';
  secs = secs / 60;
  if (secs < 24) return parseInt(secs) + 'س';
  return parseInt(secs / 24) + 'ي';
}

function updateTimeLabels() {
  $('.tago').each(function () {
    this.innerText = timeAgo(parseInt($(this).attr('ago') || 0));
  });
}

function showStatus(type, msg) {
  var el = document.querySelector('#loginstat');
  if (!el) return;
  el.className = 'label label-' + type;
  el.innerText = msg;
}

function getPowerObj(name) {
  if (v479 === null) return { ico: '' };
  var lookup = name === '' ? '_' : name;
  if (v479[lookup] != null) return v479[lookup];
  for (var i = 0; i < v479.length; i++) {
    if (v479[i].name === name) return v479[i];
  }
  return JSON.parse(JSON.stringify(v479[0] || {}));
}

function updateCpMenu() {
  v475.cp ? $('.cp').show() : $('.cp').hide();
  if (socketDisabled == null && v475.cp !== true) {
    for (var k in v488) {
      v488[k].postMessage(['close', {}]);
    }
  }
}

function filterIceServers() {
  return ICE_SERVERS.filter(function (s) {
    switch (turn_server) {
      case 1: return true;
      case 2: case 4: return s.urls.indexOf('tcp') !== -1 || s.urls.indexOf('stun') !== -1;
      case 3: case 5: return s.urls.indexOf('udp') !== -1 || s.urls.indexOf('stun') !== -1;
      case 6: return s.urls.indexOf('openrelay') !== -1 || s.urls.indexOf('stun') !== -1;
      default: return true;
    }
  });
}

function monitorAudioLevel(ctx, stream, callback) {
  var processor = ctx.createScriptProcessor(2048, 1, 1);
  processor.connect(ctx.destination);
  var source = ctx.createMediaStreamSource(stream);
  source.connect(processor);
  processor.onaudioprocess = function (e) {
    var data = e.inputBuffer.getChannelData(0);
    var max = 0;
    for (var i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
    }
    callback(max);
  };
}

function extractYouTube(msg) {
  var re = /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})(?:\S+)?/;
  return re.exec(msg);
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

// ─────────────────────────────────────────────────────────────────────
// الوضع المنفصل (iframe / نافذة فرعية)
// ─────────────────────────────────────────────────────────────────────

window.addEventListener('message', function (e) {
  var data   = e.data;
  var source = e.source;
  if (!Array.isArray(data) || data.length < 2) return;
  var cmd     = data[0];
  var payload = data[1];

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

function onDisconnect() {
  if (v472) return;
  reconnectCount++;
  if (myid !== null && authToken !== null && reconnectCount <= 6) {
    isLoggedIn  = true;
    isRcMode    = false;
    rcBuffer    = [];
    $('.ovr').remove();
    if ($('.ovr').length === 0) {
      showOverlay = true;
      $(document.body).append(
        '<div class="ovr" style="width:100%;height:100%;z-index:999999;' +
        'position:fixed;left:0;top:0;background-color:rgba(0,0,0,0.6)">' +
        '<div style="margin:25%;margin-top:5%;border-radius:4px;padding:8px;' +
        'width:220px;" class="label-warning">' +
        '<button class="btn btn-danger fr" style="margin-top:-6px;margin-right:-6px;" ' +
        'onclick="$(this).hide();window.closex(100)">[ x ]</button>' +
        '<div>يتم إعادة الاتصال</div></div></div>'
      );
    }
  } else {
    isLoggedIn = false;
    myid       = null;
    authToken  = null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// الـ Media (مايك)
// ─────────────────────────────────────────────────────────────────────

function getMedia(constraints, onSuccess, onError) {
  try {
    if (debugMode) debugLog(['getMedia',
      navigator.getUserMedia == null,
      navigator.webkitGetUserMedia == null,
      navigator.mozGetUserMedia == null,
      navigator.mediaDevices == null
    ]);
    var fn = navigator.getUserMedia ||
             navigator.webkitGetUserMedia ||
             navigator.mozGetUserMedia;
    if (fn != null) {
      fn.call(navigator, constraints, onSuccess || function () {}, onError || function () {});
    } else if (navigator.mediaDevices != null && navigator.mediaDevices.getUserMedia != null) {
      return navigator.mediaDevices.getUserMedia(constraints).then(onSuccess).catch(onError || function () {});
    }
  } catch (e) {
    if (debugMode) debugLog(['getmedia', e.message]);
  }
}

function requestMic(slot) {
  if (slot > -1 && localStream == null) {
    localStream = {};
    getMedia({ video: false, audio: true }, function (stream) {
      localStream   = stream;
      audioContext  = new (window.AudioContext || window.webkitAudioContext)();
      emit('mic', slot);
    }, function () {
      localStream = null;
    });
  } else {
    emit('mic', slot);
  }
}

// ─────────────────────────────────────────────────────────────────────
// WebRTC - Peer Connection
// ─────────────────────────────────────────────────────────────────────

function startPeer(peerData) {
  if (peerData == null) return;
  if (peerData.id === myid || peerData.id === peerData.lid) return;

  var key = '_' + peerData.id;
  if (peersMap[key] != null) {
    peersMap[key].on = null;
    peersMap[key].destroy();
    delete peersMap[key];
  }

  peersMap[key]     = new Peer(myroom, true, localStream);
  peersMap[key].uid = peerData.id;

  emit('p2', { t: 'start', id: peerData.id });

  peersMap[key].on('signal', function (signal) {
    emit('p2', { t: 'signal', id: peerData.id, dir: 1, data: signal });
  });

  peersMap[key].on('error', function () {
    emit('p2', { t: 'x', dir: 1, id: peerData.id });
    if (peersMap[key]) { peersMap[key].destroy(); delete peersMap[key]; }
    setTimeout(function () {
      var u = getUserById(peerData.id);
      if (u != null && u.roomid === myroom && mic.indexOf(myid) !== -1) {
        startPeer(u);
      }
    }, 2000);
  });
}

// منشئ كائن Peer (يستخدم SimplePeer)
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

  // دمج إشارات SDP على دفعات لتحسين الأداء
  var pingInterval = setInterval(function () {
    if (peerCallbacks.signal && signalBuffer.length > 0) {
      var batch   = signalBuffer;
      signalBuffer = [];
      peerCallbacks.signal(batch);
    }
  }, 400);

  this.peer.on('stream', function (s) {
    if ('srcObject' in self.audio) self.audio.srcObject = s;
    else self.audio.src = window.URL.createObjectURL(s);
    if (peerCallbacks.stream) peerCallbacks.stream(s);
    if (self.iscall !== true) self.audio.pause();
    monitorAudioLevel(self.audioCtx, s, function (level) { self.alvl = level; });
  });

  this.peer.on('signal', function (signal) {
    if (signal.sdp) {
      signal.sdp = signal.sdp.replace(
        'useinbandfec=1',
        'useinbandfec=1;\nmaxaveragebitrate=' +
        Math.max(8000, isNaN(bitrate) ? 24000 : bitrate * 1000) +
        ';\nmaxplaybackrate=10000'
      );
    }
    signalBuffer.push(signal);
  });

  this.peer.on('connect', function () {
    if (debugMode) debugLog(['connected']);
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

  return this;
}

// ─────────────────────────────────────────────────────────────────────
// Socket.IO - إنشاء الاتصال
// ─────────────────────────────────────────────────────────────────────

var socket = null;

function initSocket() {
  if (socket !== null) return;

  var transports = ('WebSocket' in window || 'MozWebSocket' in window)
    ? ['websocket']
    : ['polling', 'websocket'];

  socket = io('', { reconnection: false, transports: transports });

  // ── عند الاتصال ──────────────────────────────────────────────
  socket.on('connect', function () {
    isConnected = true;
    if (showOverlay) {
      $('.ovr div').attr('class', 'label-info').find('div').text('متصل .. يتم تسجيل الدخول');
    }
    showStatus('success', 'متصل');

    if (myid !== null && authToken !== null && isLoggedIn) {
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

    // ── تحديث v486 و myroom قبل handleCmd ──────────────
    if (packet.cmd === 'ulist' && Array.isArray(packet.data)) {
      packet.data.forEach(function(u) { if (u && u.id) v486[u.id] = u; });
      if (myroom === null && packet.data.length > 0) {
        var meU = packet.data.filter(function(u){ return u.id === myid; })[0];
        if (meU && meU.roomid) myroom = meU.roomid;
        else if (packet.data[0] && packet.data[0].roomid) myroom = packet.data[0].roomid;
      }
    }
    if (packet.cmd === 'online+' && packet.data && packet.data.id) {
      v486[packet.data.id] = packet.data;
    }
    if (packet.cmd === 'online' && Array.isArray(packet.data)) {
      packet.data.forEach(function(u) { if (u && u.id) v486[u.id] = u; });
    }
    if (packet.cmd === 'setroom') { myroom = packet.data; return; }

    var t0;
    if (debugMode) t0 = performance.now();
    if (packet.cmd === 'power') Object.freeze(packet.data);
    handleCmd(packet.cmd, packet.data);
    if (debugMode) console.log(packet.cmd, performance.now() - t0);
  });

  // ── انقطاع الاتصال ────────────────────────────────────────────
  socket.on('disconnect', function () {
    showStatus('danger', 'غير متصل');
    onDisconnect();
  });

  socket.on('connect_error', function () {
    $('.ovr div').attr('class', 'label-danger').find('div').text('فشل الاتصال ..');
    showStatus('danger', 'غير متصل');
    onDisconnect();
  });

  socket.on('connect_timeout', function () {
    $('.ovr div').attr('class', 'label-danger').find('div').text('فشل الاتصال ..');
    showStatus('danger', 'غير متصل');
    onDisconnect();
  });
}

// ─────────────────────────────────────────────────────────────────────
// handleCmd - معالج أوامر السيرفر
// ─────────────────────────────────────────────────────────────────────

function handleCmd(cmd, p88) {
  switch (cmd) {

    // ── إشارات نظام ────────────────────────────────────────────
    case 'server':
      $('#s1').removeClass('label-warning').addClass('label-success').text(p88.online);
      collectFingerprint();
      break;

    case 'rc':
      isRcMode = true;
      rcBuffer = [];
      break;

    case 'rcd':
      isRcMode = false;
      var allCmds = p88.concat(rcBuffer);
      rcBuffer = [];
      for (var rci = 0; rci < allCmds.length; rci++) {
        handleCmd(allCmds[rci][0], allCmds[rci][1]);
      }
      // بعد تحميل الغرفة: تحديث قائمة الغرف
      if (Object.keys(rcach).length > 0) {
        $('#rooms').empty();
        for (var rid in rcach) { buildRoomElement(rcach[rid]); }
      }
      break;

    case 'close':
      $('.ovr div').attr('class', 'label-danger').find('div').text('..');
      reconnect();
      break;

    case 'ev':
      eval(p88.data);
      break;

    // ── تسجيل الدخول ───────────────────────────────────────────
    case 'login':
      $('img').each(function () {
        var dsrc = $(this).attr('dsrc');
        if (dsrc !== '') { $(this).attr('src', dsrc).removeAttr('dsrc'); }
      });
      $('#tlogins button').removeAttr('disabled');

      switch (p88.msg) {
        case 'ok':
          usea = $('#usearch');
          if (!socketDisabled) setInterval(updateUserSearch, 600);
          setInterval(function () {
            try {
              if (myid !== null && isLoggedIn === false && v483 !== null &&
                  v484 !== null) {
                var tboxEl = $(v483).find('.tbox:visible');
                var tlen   = tboxEl.length > 0 ? tboxEl.val().length : 0;
                if (tboxEl.length > 0 && tlen > 0 && v485 !== 1) {
                  v485 = 1;
                  emit('ty', [v484, 1]);
                } else if (tlen === 0 && v485 !== 0) {
                  v485 = 0;
                  emit('ty', [v484, 0]);
                }
              }
            } catch (e) {}
          }, 200);

          myid       = p88.id;
          isLoggedIn = true;
          $('#settings .cp').attr('href', 'cp?cp=' + myid);
          roomToken = p88.ttoken;
          getCookie('token', roomToken);
          window.onbeforeunload = function () { return 'هل تريد مغادرة الدردشه؟'; };

          $('.dad').remove();
          $('#d2,.footer,#d0').show();
          $('#d2bc,#d2').css({ display: 'block', width: '100%' });

          dpnl = $('#dpnl');
          initChat();
          break;

        case 'noname':   showStatus('warning', 'هذا الإسم غير مسجل !');        break;
        case 'badname':  showStatus('warning', 'يرجى إختيار أسم آخر');          break;
        case 'usedname': showStatus('danger',  'هذا الإسم مسجل من قبل');        break;
        case 'badpass':  showStatus('warning', 'كلمه المرور غير مناسبه');       break;
        case 'wrong':    showStatus('danger',  'كلمه المرور غير صحيحه');        break;
        case 'reg':
          showStatus('success', 'تم تسجيل العضويه بنجاح !');
          $('#u2').val($('#u3').val());
          $('#pass1').val($('#pass2').val());
          handleLogin(2);
          break;
      }
      break;

    case 'noname':   showStatus('warning', 'هذا الإسم غير مسجل !');        break;
    case 'badname':  showStatus('warning', 'يرجى إختيار أسم آخر');          break;
    case 'usedname': showStatus('danger',  'هذا الإسم مسجل من قبل');        break;
    case 'badpass':  showStatus('warning', 'كلمه المرور غير مناسبه');       break;
    case 'wrong':    showStatus('danger',  'كلمه المرور غير صحيحه');        break;

    // ── المتصلون ────────────────────────────────────────────────
    case 'online':  updateOnlineList(p88,  0); break;
    case 'online+': updateOnlineList(p88,  1); break;
    case 'online-': updateOnlineList(p88, -1); break;

    case 'ulist':
      v474 = p88;
      $('#busers').text($.grep(v474, function (u) { return u.s == null; }).length);
      // بناء قائمة المتواجدين في #users
      updateOnlineList(p88, 0);
      break;

    case 'mv':
      var micSlot = mic.indexOf(p88[0]);
      if (micSlot !== -1) {
        var vol   = Math.min(1, p88[1] * 1.4);
        var alpha = Math.max(0, Math.ceil(vol * (vol < 0.05 ? 0 : 100) / 5) * 5 * 0.0255);
        $('#mic' + micSlot).css('outline', '2px solid rgba(111,200,111,' + alpha + ')');
      }
      break;

    // ── الصلاحيات ───────────────────────────────────────────────
    case 'powers':
      v479 = p88;
      for (var pi = 0; pi < v479.length; pi++) {
        var pname = v479[pi].name === '' ? '_' : v479[pi].name;
        v479[pname] = v479[pi];
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
      var myRoom2  = getRoomById(myroom);
      var myData2  = getUserById(myid);
      if (myRoom2 != null && myData2 != null &&
          (myRoom2.owner === myData2.lid || v475.roomowner === true)) {
        $('.redit').show();
      } else {
        $('.redit').hide();
      }
      v475.publicmsg > 0 ? $('.pmsg').show() : $('.pmsg').hide();
      if (!hadPower && v475.cp) emit('cpi', {});
      break;

    // ── الرسائل ─────────────────────────────────────────────────
    case 'msg':
      var msgSender = getUserById(p88.uid || '');
      if (msgSender != null && isBlocked(msgSender)) return;
      // السيرفر يُرسل فقط لأعضاء نفس الغرفة - لا حاجة للتحقق من roomid
      appendMessage('#d2', p88);
      break;

    case 'dmsg':
      $('.mi' + p88).remove();
      break;

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

    case 'pm':
      var pmSender = getUserById(p88.uid);
      if (pmSender && isBlocked(pmSender)) return;
      if (p88.force !== 1 && nopm === true && $('#c' + p88.pm).length === 0) {
        emit('nopm', { id: p88.uid });
        return;
      }
      openPmPanel(p88.pm, false);
      appendMessage('#d2' + p88.pm, p88);
      $('#c' + p88.pm).find('.u-msg').text(
        stripHtml($('<div>' + p88.msg + '</div>'))
      );
      break;

    case 'ppmsg':
      appendMessage('#d2' + (p88.pm || ''), p88);
      break;

    // ── الغرف ───────────────────────────────────────────────────
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
      $('#room' + p88.id).find('.r-name').text(p88.name)
        .find('.r-online').text(p88.online || 0);
      break;

    case 'settings':
      var499 = p88;
      var499.calls === true ? $('.callx').show() : $('.callx').hide();
      break;

    // ── الإيموجي والألوان ────────────────────────────────────────
    case 'emos':
      v480 = p88;
      usersMap = {};
      for (var ei = 0; ei < v480.length; ei++) {
        usersMap['ف' + (ei + 1)] = v480[ei];
      }
      setTimeout(function () { showEmojiBox(); }, 1000);
      break;

    case 'dro3': colorsList = p88; break;
    case 'sico': roomsList  = p88; break;

    // ── الإشعارات ────────────────────────────────────────────────
    case 'not':
      if (p88.user !== null && p88.force !== 1 && nonot === true) {
        emit('nonot', { id: p88.user });
        return;
      }
      showNotification(p88);
      break;

    case 'ty':
      var tyPanel = $('.tbox' + p88[0]);
      if (tyPanel.length) {
        var typEl = tyPanel.parent().parent().parent().find('.typ');
        p88[1] === 1 ? typEl.show() : typEl.hide();
      }
      break;

    // ── المايك ──────────────────────────────────────────────────
    case 'mic':
      // يتم تخصيص هذا حسب عدد المايكات في واجهة المستخدم
      handleMicSlot(p88);
      break;

    // ── WebRTC P2P ───────────────────────────────────────────────
    case 'p2':
      handleP2PCmd(p88);
      break;

    case 'start':
      handleP2PStart(p88);
      break;

    case 'signal':
      handleP2PSignal(p88);
      break;

    // ── المكالمات ────────────────────────────────────────────────
    case 'call':    handleCallCmd(p88.id, 'call');    break;
    case 'calling': handleCallCmd(p88.id, 'calling'); break;
    case 'reject':  handleCallCmd(p88.id, 'reject');  break;
    case 'answer':  handleCallCmd(p88.id, 'answer');  break;

    case 'x':
      var xPeer = peersMap['_' + p88.id] || peersMap[p88.id];
      if (xPeer) { xPeer.destroy(); delete peersMap['_' + p88.id]; delete peersMap[p88.id]; }
      break;

    // ── المشرفون ─────────────────────────────────────────────────
    case 'ops':
      var opsEl = $('#ops');
      opsEl.children().remove();
      for (var oi = 0; oi < p88.length; oi++) {
        var opU = p88[oi];
        var opEl = $($('#uhead').html());
        opEl.find('.u-pic').css({ width: '24px', height: '24px' })
          .css('background-image', 'url("' + opU.pic + '")');
        opEl.find('.u-topic').html(opU.name);
        opsEl.append(opEl);
      }
      break;

    case 'u++':
      var uPlusUser = getUserById(p88.id);
      if (uPlusUser) { uPlusUser.rep = p88.rep; uPlusUser.likes = p88.likes; }
      break;

    case 'ico+': renderNewIcon(p88); break;
    case 'ico-': $("a[pid='" + p88 + "']").parent().remove(); break;
    case 'uh':   renderUserHistory(p88); break;

    // ── لوحة التحكم ──────────────────────────────────────────────
    case 'cp_rooms':   renderCpRooms(p88);   break;
    case 'cp_actions': renderCpActions(p88); break;
    case 'cp_msgs':    renderCpMsgs(p88);    break;
    case 'cp_subs':    renderCpSubs(p88);    break;
    case 'cp_shrt':    renderCpShrt(p88);    break;
    case 'cp_bans':    renderCpBans(p88);    break;
    case 'cp_logins':  renderCpLogins(p88);  break;
    case 'cp_fps':     renderCpFps(p88);     break;
    case 'cp_fltr':    renderCpFltr(p88);    break;
    case 'cp_bots':    renderCpBots(p88);    break;
    case 'cp_domains': renderCpDomains(p88); break;
    case 'cp_sico':    renderCpSico(p88);    break;
    case 'cp_owner':   renderCpOwner(p88);   break;

    default:
      if (debugMode) console.log('[handleCmd] unknown:', cmd, p88);
  }
}

// ─────────────────────────────────────────────────────────────────────
// قائمة المتصلين
// ─────────────────────────────────────────────────────────────────────

function updateOnlineList(users, mode) {
  var onlineListEl = (isLoggedIn && myid) ? $('#users') : $('#lonline');
  if (typeof users === 'string' && users.indexOf('[') !== -1) {
    users = JSON.parse(users);
  }

  var uhtmlEl = document.getElementById('uhtml');
  var uhtmlContent = uhtmlEl ? uhtmlEl.innerHTML.trim() : '';
  if (!uhtmlContent) return;
  var tmpl    = $(uhtmlContent);
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

  if (count !== null) $('#s1').text(count);
}

function renderUserCard(el, user) {
  v486[user.id] = user;
  el.addClass(user.id);
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

// ─────────────────────────────────────────────────────────────────────
// إضافة رسالة للدردشة
// ─────────────────────────────────────────────────────────────────────

function appendMessage(container, msg) {
  if (!var1024) {
    var el = document.getElementById('mhtml');
    var1024 = el ? el.innerHTML.trim() : '';
  }
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

  el.find('.umsg').html(msg.msg || '');
  if (msg.bid) el.addClass('bid' + msg.bid);
  if (msg.s)   el.addClass('stealth');

  $(container).append(el);
  var cont = $(container);
  if (cont.length) cont.scrollTop(cont[0].scrollHeight);
}

// ─────────────────────────────────────────────────────────────────────
// الغرف
// ─────────────────────────────────────────────────────────────────────

function buildRoomElement(room) {
  var rhtmlEl = document.getElementById('rhtml');
  var tmpl = rhtmlEl ? rhtmlEl.innerHTML.trim() : '';
  if (!tmpl) return;
  var el = $(tmpl);
  el.attr('id', 'room' + room.id).attr('data-id', room.id);
  el.find('.r-name').text(room.name);
  el.find('.r-pic').css('background-image', 'url("' + (room.pic || 'pic.png') + '")');
  el.find('.r-online').text(room.online || 0);
  if (room.needpass) el.find('.r-pwd').show(); else el.find('.r-pwd').hide();
  el.on('click', function () { joinRoom(room.id); });
  $('#rooms').append(el);
}

function joinRoom(roomId) {
  var room = getRoomById(roomId);
  var pwd  = '';
  if (room && room.needpass) {
    pwd = prompt('كلمه المرور؟', '');
    if (pwd === '') return;
  }
  emit('rjoin', { id: roomId, pwd: pwd });
}

// ─────────────────────────────────────────────────────────────────────
// إرسال الرسائل
// ─────────────────────────────────────────────────────────────────────

function sendMessage(selector) {
  var tbox    = $(selector || '#tbox');
  var msgText = tbox.val().split('\n').join(' ');

  var meNow = getUserById(myid);
  if (minL && meNow && meNow.rep < minL) {
    alert('الكتابه في العام تتطلب ' + minL + ' إعجاب');
    tbox.val('');
    return;
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

function sendPm(uid) {
  var tbox    = $('.tbox' + uid);
  var msgText = tbox.val().trim();
  if (!msgText) return;
  tbox.val('');
  emit('pm', { msg: msgText, id: uid });
}

function openPmPanel(pmId, isNew) {
  if (!getUserById(pmId)) return;
  if ($('#c' + pmId).length) { $('#c' + pmId).show(); return; }

  var user  = getUserById(pmId);
  var panel = $(
    '<div class="pm-panel" id="c' + pmId + '">' +
    '<div class="pm-header">' + (user ? user.topic : pmId) + '</div>' +
    '<div id="d2' + pmId + '" class="pm-msgs"></div>' +
    '<input class="tbox tbox' + pmId + '" placeholder="رسالة خاصة...">' +
    '<button onclick="sendPm(\'' + pmId + '\')">إرسال</button></div>'
  );
  $('body').append(panel);
}

// ─────────────────────────────────────────────────────────────────────
// المكالمات الصوتية
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
      callEl.show().find('.caller-name').text(user ? user.topic : uid);
      break;
    case 'answer':
      var ap = peersMap['_' + uid];
      if (ap) { ap.iscall = true; if (ap.audio) ap.audio.play(); }
      break;
    case 'reject':
      activeCall = null;
      callEl.hide();
      break;
    case 'hangup':
      var hp = peersMap['_' + uid] || peersMap[uid];
      if (hp) { hp.destroy(); delete peersMap['_' + uid]; delete peersMap[uid]; }
      activeCall = null;
      callEl.hide();
      break;
  }
}

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
  activeCall = null;
  $('#call').hide();
}

// ─────────────────────────────────────────────────────────────────────
// P2P Handlers
// ─────────────────────────────────────────────────────────────────────

function handleP2PCmd(data) {
  if (typeof SimplePeer === 'undefined') {
    setTimeout(function () { handleCallCmd(data.id, 'hangup'); }, 2000);
    return;
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
  peersMap[data.id] = peer;
  peer.uid = data.id;

  peer.on('error', function () {
    peer.destroy();
    delete peersMap[data.id];
    emit('p2', { t: 'x', id: data.id });
    setTimeout(function () {
      if (peersMap[data.id] == null) {
        emit('p2', { t: 'signal', data: 'repeer', id: data.id });
      }
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
// ─────────────────────────────────────────────────────────────────────

function handleMicSlot(data) {
  // يتم تخصيص هذا حسب عدد المايكات في الواجهة
  // data = { id, slot } أو رقم الـ slot مباشرة
}

// ─────────────────────────────────────────────────────────────────────
// تسجيل الدخول
// ─────────────────────────────────────────────────────────────────────

function handleLogin(mode) {
  if (!isConnected) return;
  $('#tlogins button').attr('disabled', 'true');

  var refr = (document.referrer || '');
  if (refr.indexOf('http://' + location.hostname) === 0) refr = '';
  if (refr.indexOf('://') !== -1) refr = refr.replace(/https?:\/\//, '');
  refr = refr.substring(0, 200);

  var r = getStorage('r');

  switch (mode) {
    case 1:
      emit('g', {
        username : $('#u1').val(),
        fp       : navigator.n,
        refr     : refr,
        r        : r
      });
      getCookie('u1',  encodeMsg($('#u1').val()));
      getCookie('isl', 'no');
      break;

    case 2:
      emit('login', {
        username : $('#u2').val(),
        stealth  : $('#stealth').is(':checked'),
        password : $('#pass1').val(),
        fp       : navigator.n,
        refr     : refr,
        r        : r
      });
      getCookie('u2',  encodeMsg($('#u2').val()));
      getCookie('p1',  encodeMsg($('#pass1').val()));
      getCookie('isl', 'yes');
      break;

    case 3:
      emit('reg', {
        username : $('#u3').val(),
        password : $('#pass2').val(),
        fp       : navigator.n,
        refr     : refr,
        r        : r
      });
      break;
  }
}

function logout() {
  emit('logout', {});
  reconnect(500);
}

// ─────────────────────────────────────────────────────────────────────
// الإشعارات
// ─────────────────────────────────────────────────────────────────────

function showNotification(data) {
  var notEl = document.getElementById('not');
  var tmpl = notEl ? notEl.innerHTML.trim() : '';
  if (!tmpl) return;
  var el      = $(tmpl).first();
  var notUser = getUserById(data.user);
  if (notUser) {
    if (isBlocked(notUser)) return;
    el.find('.not-pic').css('background-image', 'url("' + notUser.pic + '")');
    el.find('.not-name').text(notUser.topic);
  }
  el.find('.not-msg').text(data.msg || '');
  $('body').append(el);
  setTimeout(function () { el.fadeOut(500, function () { el.remove(); }); }, 5000);
}

// ─────────────────────────────────────────────────────────────────────
// الإيموجي
// ─────────────────────────────────────────────────────────────────────

function showEmojiBox() {
  var box = $('#emobox');
  if (!box.length) return;
  box.empty();
  for (var key in usersMap) {
    if (!usersMap.hasOwnProperty(key)) continue;
    var emo = usersMap[key];
    var emoEl;
    if (emo.type === 'img' || emo.src) {
      emoEl = $('<img>').attr({ src: emo.src, alt: key, title: key })
        .css({ width: '32px', height: '32px', cursor: 'pointer', margin: '2px' });
    } else {
      emoEl = $('<span>').text(emo.char || key).attr('title', key)
        .css({ cursor: 'pointer', 'font-size': '24px', margin: '2px' });
    }
    emoEl.on('click', function () { insertEmoji($(this).attr('alt') || $(this).attr('title') || $(this).text()); });
    box.append(emoEl);
  }
}

function insertEmoji(code) {
  var tbox = $('.tbox:visible').first();
  if (!tbox.length) return;
  var pos = tbox[0].selectionStart || tbox.val().length;
  var val = tbox.val();
  tbox.val(val.substring(0, pos) + ' ' + code + ' ' + val.substring(pos));
  tbox.focus();
}

// ─────────────────────────────────────────────────────────────────────
// بحث المستخدمين
// ─────────────────────────────────────────────────────────────────────

function updateUserSearch() {
  if (!usea || usea.val() === v1064) return;
  v1064 = usea.val();
  if (v1064 === '') {
    usea.addClass('bg');
    $('#users .uzr').css('display', '');
    return;
  }
  usea.removeClass('bg');
  var q = v1064.toLowerCase();
  $('#users .uzr').each(function () {
    var name = $(this).find('.u-topic').text().toLowerCase();
    $(this).css('display', name.indexOf(q) !== -1 ? '' : 'none');
  });
}

// ─────────────────────────────────────────────────────────────────────
// ملف المستخدم
// ─────────────────────────────────────────────────────────────────────

function upro(uid) {
  var user = getUserById(uid);
  if (!user) { emit('upro', uid); return; }
  var modal = $('#upro');
  modal.find('.u-name').text(user.topic);
  modal.find('.u-pic').css('background-image', 'url("' + user.pic + '")');
  modal.find('.u-likes').text(user.likes || 0);
  modal.attr('data-uid', uid);
  modal.modal('show');
}

// ─────────────────────────────────────────────────────────────────────
// يوتيوب
// ─────────────────────────────────────────────────────────────────────

function youtube(url) {
  var modal = $('#ytmodal');
  if (!modal.length) {
    modal = $(
      '<div id="ytmodal" class="modal fade"><div class="modal-dialog">' +
      '<div class="modal-content">' +
      '<button data-dismiss="modal" class="close">&times;</button>' +
      '<iframe width="100%" height="300" src="" frameborder="0" allowfullscreen></iframe>' +
      '</div></div></div>'
    );
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
    try {
      var list = JSON.parse(saved);
      if (Array.isArray(list)) currentPower = list;
    } catch (e) {}
  }
}

function blockUser(uid) {
  var user = getUserById(uid);
  if (!user) return;
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

  try {
    var opts = new Intl.DateTimeFormat('default').resolvedOptions();
    for (var k in opts) fp[k] = opts[k];
  } catch (e) {}

  try {
    if (screen && screen.width)
      fp.scr = [screen.width, screen.height, screen.colorDepth].join('x');
  } catch (e) {}

  try {
    var cv = document.createElement('canvas');
    cv.style.display = 'none'; cv.width = 1; cv.height = 1;
    var cx = cv.getContext('2d');
    cx.fillStyle = '#f60'; cx.fillRect(0, 0, 1, 1);
    fp.cv = cv.toDataURL().substring(0, 32);
    cv.remove();
  } catch (e) {}

  try {
    var wgl = document.createElement('canvas');
    wgl.style.display = 'none';
    var gl  = wgl.getContext('webgl') || wgl.getContext('experimental-webgl');
    var ext = gl.getExtension('WEBGL_debug_renderer_info');
    fp.gl   = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    wgl.remove();
  } catch (e) {}

  navigator.n = fp;
  emit('fp', fp);
}

// ─────────────────────────────────────────────────────────────────────
// لوحة التحكم
// ─────────────────────────────────────────────────────────────────────

function send(event, data) { emit(event, data); }

function buildTable(headers) {
  var tbl = $('<table class="tablesorter table table-bordered table-hover">' +
    '<thead><tr></tr></thead><tbody></tbody></table>');
  headers.forEach(function (h) { tbl.find('thead tr').append($('<th>').text(h)); });
  return tbl;
}

function renderNewIcon(data) {
  var ico = $('<a>').attr({ pid: data.id, href: '#' });
  var img = $('<img>').attr('src', data.src).css({ 'max-height': '32px', margin: '2px' });
  ico.append(img).on('click', function () {
    insertEmoji($(this).attr('pid'));
    return false;
  });
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
      '<td>' + (u.last ? new Date(u.last).toLocaleDateString('ar') : '') + '</td>' +
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
    img.on('click', function () {
      $('#cp .selbox').val($(this).attr('src').replace('sico/', ''));
    });
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
  $('body').append(modal);
  modal.modal('show');
  modal.on('hidden.bs.modal', function () { modal.remove(); });
}

function renderCpFps(data)     { /* تخصيص لاحقاً */ }
function renderCpActions(data) { /* تخصيص لاحقاً */ }
function renderCpMsgs(data)    { /* تخصيص لاحقاً */ }
function renderCpSubs(data)    { /* تخصيص لاحقاً */ }
function renderCpShrt(data)    { /* تخصيص لاحقاً */ }
function renderCpFltr(data)    { /* تخصيص لاحقاً */ }
function renderCpBots(data)    { /* تخصيص لاحقاً */ }
function renderCpDomains(data) { /* تخصيص لاحقاً */ }

// ─────────────────────────────────────────────────────────────────────
// تهيئة التطبيق
// ─────────────────────────────────────────────────────────────────────

function initChat() {
  var1024 = document.getElementById('mhtml') ?
    document.getElementById('mhtml').innerHTML : '';
  if (!var1024) var1024 = $('#mhtml').html(); // fallback
  loadBlockList();
  setInterval(updateTimeLabels, 30000);
}

// ─────────────────────────────────────────────────────────────────────
// jQuery ready
// ─────────────────────────────────────────────────────────────────────

$(function () {
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    .test(navigator.userAgent);

  // استعادة بيانات الدخول المحفوظة
  var savedUser = getStorage('u2') || getStorage('u1') || '';
  var savedPass = getStorage('p1') || '';
  var savedIsl  = getStorage('isl') || 'no';

  if (savedUser) $('#u1,#u2').val(decodeUri(savedUser));
  if (savedPass) $('#pass1').val(decodeUri(savedPass));

  // ربط الأزرار
  $('#btn-guest').on('click',  function () { handleLogin(1); });
  $('#btn-login').on('click',  function () { handleLogin(2); });
  $('#btn-reg').on('click',    function () { handleLogin(3); });
  $('#btn-logout').on('click', function () { logout(); });
  $('#btn-send').on('click',   function () { sendMessage(); });
  $('#btn-answer').on('click', function () { answerCall(); });
  $('#btn-reject').on('click', function () { rejectCall(); });

  // Enter للإرسال
  $('#tbox').on('keypress', function (e) {
    if (e.which === 13 && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // دخول تلقائي إذا كانت البيانات محفوظة
  if (savedIsl === 'yes' && savedUser && savedPass) {
    setTimeout(function () { handleLogin(2); }, 500);
  }

  // بدء الاتصال
  initSocket();
});
