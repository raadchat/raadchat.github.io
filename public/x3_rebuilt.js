/**
 * =====================================================================
 *  X3 Chat Client - إعادة بناء كاملة
 *  مبني من تحليل الكود الأصلي المفكوك
 * =====================================================================
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────
// المتغيرات العامة
// ─────────────────────────────────────────────────────────────────────
var myroom      = null;     // الغرفة الحالية
var myid        = null;     // معرف المستخدم
var authToken   = null;     // رمز المصادقة
var roomToken   = '';       // رمز الغرفة
var isLoggedIn  = false;    // هل سجل الدخول
var socket      = null;     // اتصال Socket.IO
var authOk      = false;    // هل تمت المصادقة
var showOverlay = false;    // إظهار شاشة الانتظار
var debugMode   = false;    // وضع التصحيح
var isMobile    = false;    // هل جهاز موبايل
var socketDisabled = false; // الوضع المنفصل (iframe)
var isReconnecting = false; // هل يعيد الاتصال

// متغيرات الغرف والمستخدمين
var rcach       = {};  // cache الغرف { roomId: roomObj }
var v486        = {};  // cache المستخدمين { userId: userObj }
var usersMap    = {};  // خريطة الايموجي { 'ف1': emoObj }
var roomsList   = [];  // قائمة أيقونات الغرف
var colorsList  = [];  // قائمة الألوان المخصصة
var currentPower = []; // قائمة المحظورين محلياً

// متغيرات الرسائل
var replyId    = null;  // معرف الرسالة المُرد عليها
var bcc        = 0;     // عداد رسائل الحائط الجديدة
var bct        = 100;   // حد الرسائل في العام
var msgt       = 100;   // حد رسائل الخاص
var minL       = 0;     // الحد الأدنى من الإعجابات للكتابة في العام
var minR       = 0;     // الحد الأدنى من الإعجابات للتعليق
var ncolors    = [];    // ألوان مستخدمة
var cff        = '06';  // معرف التنسيق

// متغيرات الصلاحيات
var v475       = {};    // صلاحيات المستخدم الحالي
var v479       = [];    // قائمة الصلاحيات الكاملة
var v490       = {      // أوامر لا تحتاج تسجيل دخول
  'ico+': true, 'ico-': true, 'powers': true, 'sico': true,
  'power': true, 'rlist': true, 'r+': true, 'r-': true,
  'r^': true, 'emos': true, 'dro3': true
};

// متغيرات الصوت والاتصال
var peersMap      = {};    // اتصالات WebRTC { '_userId': PeerObj }
var localStream   = null;  // البث الصوتي المحلي
var audioContext  = null;  // سياق الصوت
var mic           = [];    // قائمة مستخدمي المايك
var minL          = 0;
var minR          = 0;
var playing       = null;  // الأغنية المشغلة حالياً
var bitrate       = 24;    // جودة الصوت kbps
var turn_server   = 1;     // نوع سيرفر TURN (1-6)
var user_pic      = null;  // صورة المستخدم الافتراضية
var room_pic      = null;  // صورة الغرفة الافتراضية
var bcdown        = false;
var showpics      = 100;
var deepSearch    = 4;
var uhSearch      = true;
var nopm          = false; // تعطيل الرسائل الخاصة
var nonot         = false; // تعطيل الإشعارات
var noNotif       = false;
var noPopup       = false;

// متغيرات إعادة الاتصال
var reconnectCount = 0;    // عداد محاولات إعادة الاتصال
var isRcMode       = false; // وضع إعادة الاتصال
var rcBuffer       = [];    // مخزن الأوامر خلال إعادة الاتصال
var var499         = {};    // إعدادات الغرفة (calls, ...)

// متغيرات DOM
var usea;          // حقل بحث المستخدمين
var dpnl;          // لوحة التنقل
var var530 = false;
var v487   = true;
var v1069  = false;

// الوقت المرجعي
window.cpi = new Date().getTime().toString(36);

// ─────────────────────────────────────────────────────────────────────
// الدوال المساعدة الأساسية
// ─────────────────────────────────────────────────────────────────────

/**
 * ترميز الرسائل للتخزين
 */
function encodeMsg(str) {
  return encodeURIComponent(str).split("'").join('%27');
}

/**
 * فك ترميز الرابط
 */
function decodeUri(str) {
  return decodeURIComponent(str);
}

/**
 * هل يدعم المتصفح localStorage
 */
function hasStorage() {
  return typeof Storage !== 'undefined';
}

/**
 * تخزين قيمة (localStorage أو Cookie احتياطياً)
 */
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
  var date = new Date();
  date.setTime(date.getTime() + 6 * 24 * 60 * 60 * 1000);
  var expires = 'expires=' + date.toUTCString();
  document.cookie = key + '=' + encodeMsg(value) + '; ' + expires +
    '; domain=' + window.location.hostname + '; path=/';
}

/**
 * قراءة قيمة (localStorage أو Cookie احتياطياً)
 */
function getStorage(key) {
  if (hasStorage()) {
    var val = '';
    try {
      val = localStorage.getItem(key);
    } catch (e) {
      return getCookieFallback(key);
    }
    return (val === 'null' || val === null) ? '' : val;
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

/**
 * تشفير/فك تشفير الأوامر (XOR بسيط)
 */
function decodeCmd(cmd) {
  var chars = (cmd || '').split('');
  var len = chars.length;
  for (var i = 0; i < len; i++) {
    chars[i] = String.fromCharCode(cmd.charCodeAt(i) ^ 2);
    i += i < 20 ? 1 : i < 200 ? 4 : 16;
  }
  return chars.join('');
}

/**
 * إرسال أمر للسيرفر عبر Socket.IO
 * يشفر اسم الأمر قبل الإرسال
 */
function emit(cmd, data) {
  if (socketDisabled) {
    // وضع iframe: إرسال للنافذة الأم
    if (window.opener === null) {
      reconnect();
      return;
    }
    window.opener.postMessage([cmd, data]);
  } else {
    socket.emit('msg', {
      'cmd': decodeCmd(cmd),
      'data': data
    });
  }
}

/**
 * الحصول على بيانات مستخدم من الـ cache
 */
function getUserById(id) {
  return v486[id];
}

/**
 * الحصول على بيانات غرفة من الـ cache
 */
function getRoomById(id) {
  return rcach[id];
}

/**
 * هل المستخدم محظور محلياً
 */
function isBlocked(user) {
  for (var i = 0; i < currentPower.length; i++) {
    if (currentPower[i].lid === user.lid) return true;
  }
  return false;
}

/**
 * تحويل timestamp إلى نص زمني (الآن، دقيقة، ساعة...)
 */
function timeAgo(timestamp) {
  var diff = new Date().getTime() - timestamp;
  var seconds = Math.abs(diff) / 1000;
  if (seconds < 59) return 'الآن';
  seconds = seconds / 60;
  if (seconds < 59) return parseInt(seconds) + ' دقيقة';
  seconds = seconds / 60;
  if (seconds < 24) return parseInt(seconds) + ' ساعة';
  return parseInt(seconds / 24) + ' يوم';
}

/**
 * تحديث عروض الوقت في الصفحة
 */
function updateTimeLabels() {
  $.each($('.tago'), function (i, el) {
    el = $(el);
    el[0].innerText = timeAgo(parseInt(el.attr('ago') || 0));
  });
}

/**
 * تحديل لون بمقدار معين
 */
function adjustColor(color, amount) {
  try {
    return (color.indexOf('#') === 0 ? '#' : '') +
      color.replace(/^#/, '').replace(/../g, function (c) {
        return ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).slice(-2);
      });
  } catch (e) {
    return color;
  }
}

/**
 * استخراج رابط يوتيوب من النص
 */
function extractYouTube(msg) {
  var re = /(?:\s+)?(?:^)?(?:https?:\/\/)?(?:http?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?/;
  return re.exec(msg);
}

/**
 * تحويل كود الغرفة (ف1, ف2...) إلى ايموجي
 */
function decodeEmojiText(text) {
  if (text.indexOf('ف') === -1) return text;
  var count = 0;
  var words = text.replace('\n', '').split(' ');
  for (var i = 0; i < words.length; i++) {
    if (words[i].indexOf('ف') === 0 && usersMap[words[i]] != null) {
      count++;
      if (count > 10) break;
    }
  }
  return text;
}

/**
 * عرض حالة الاتصال في شريط الحالة
 */
function showStatus(type, msg) {
  var el = document.querySelector('#loginstat');
  if (!el) return;
  el.className = 'label label-' + type;
  el.innerText = msg;
}

/**
 * تحديث مؤشر حجم الصوت للمايك
 */
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

// ─────────────────────────────────────────────────────────────────────
// الوضع المنفصل (socketDisabled) - نافذة فرعية
// ─────────────────────────────────────────────────────────────────────

window.addEventListener('message', function (e) {
  var data = e.data;
  var source = e.source;
  if (!Array.isArray(data) || data.length < 2) return;

  var cmd = data[0];
  var payload = data[1];

  if (socketDisabled) {
    // نافذة فرعية: استقبال من الأم
    handleCmd(cmd, payload);
  } else {
    // نافذة أم: استقبال من الابن وإعادة إرساله للسيرفر
    if (cmd === 'cpi' && payload === window.cpi) return;
    emit(cmd, payload);
  }
});

function checkSocketDisabled(key) {
  return getStorage(key) === window.cpi;
}

// ─────────────────────────────────────────────────────────────────────
// دوال الاتصال بالسيرفر
// ─────────────────────────────────────────────────────────────────────

/**
 * إعادة الاتصال / إعادة تحميل الصفحة
 */
function reconnect(delay) {
  if (isReconnecting) return;
  window.onbeforeunload = null;
  isReconnecting = true;
  if (socketDisabled) {
    window.close();
    return;
  }
  setTimeout('location.href="/"', delay || 3000);
}

/**
 * معالجة الانقطاع عن الاتصال
 */
function onDisconnect() {
  if (isReconnecting) return;

  // تعطيل التعديلات على DOM
  showStatusPanel(1);
  reconnectCount++;

  if (myid !== null && authToken !== null && reconnectCount <= 6) {
    // محاولة إعادة الاتصال تلقائياً
    isLoggedIn = true;
    isRcMode   = false;
    rcBuffer   = [];
    $('.ovr').remove();

    if ($('.ovr').length === 0) {
      showOverlay = true;
      $(document.body).append(
        '<div class="ovr" style="width:100%;height:100%;z-index:999999;' +
        'position:fixed;left:0;top:0;background-color:rgba(0,0,0,0.7)">' +
        '<div style="color:white;text-align:center;padding-top:45%">' +
        '<div>يتم إعادة الاتصال</div></div></div>'
      );
    }
  } else {
    isLoggedIn = false;
    myid = null;
    authToken = null;
  }
}

/**
 * إظهار/إخفاء التعديلات على DOM
 */
function showStatusPanel(mode) {
  // يمكن تخصيصها
}

/**
 * إنشاء اتصال Socket.IO
 */
function initSocket() {
  if (socket !== null) return;

  var transports = ('WebSocket' in window || 'MozWebSocket' in window)
    ? ['websocket']
    : ['polling', 'websocket'];

  socket = io('', {
    'reconnection': false,
    'transports': transports
  });

  var pingTimer = null;

  // ─── عند الاتصال ─────────────────────────────────────
  socket.on('connect', function () {
    isConnected = true;
    if (showOverlay) {
      $('.ovr div').attr('class', 'label-info').find('div').text('متصل .. يتم تسجيل الدخول');
    }
    showStatus('success', 'متصل');

    if (myid !== null && authToken !== null && isLoggedIn) {
      // إعادة الاتصال بالرمز
      socket.emit('rc2', {
        'token': roomToken,
        'n': authToken
      });
    } else {
      emit('online', {});
    }
  });

  // ─── استقبال الرسائل ──────────────────────────────────
  socket.on('msg', function (packet) {
    packet.cmd = decodeCmd(packet.cmd);

    if (packet.cmd === 'ok')  authOk = true;
    if (packet.cmd === 'nok') { authOk = false; authToken = null; }
    if (!isLoggedIn && authOk) authToken = packet.k;

    // تخزين مؤقت في وضع إعادة الاتصال
    if (isRcMode && !v490[packet.cmd]) {
      rcBuffer.push([packet.cmd, packet.data]);
      return;
    }

    if (debugMode) {
      var t0 = performance.now();
      if (packet.cmd === 'power') Object.freeze(packet.data);
      handleCmd(packet.cmd, packet.data);
      console.log(packet.cmd, performance.now() - t0);
    } else {
      if (packet.cmd === 'power') Object.freeze(packet.data);
      handleCmd(packet.cmd, packet.data);
    }
  });

  // ─── عند الانقطاع ─────────────────────────────────────
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
// معالج الأوامر الرئيسي (من السيرفر إلى العميل)
// ─────────────────────────────────────────────────────────────────────

function handleCmd(cmd, data) {
  switch (cmd) {

    // ── إشارات الاتصال ──────────────────────────────────

    case 'ok':
      usea = $('#usearch');
      if (!socketDisabled) setInterval(updateUserSearch, 600);
      var htmlUser = $('#uhtml').html();
      var htmlRoom = $('#rhtml').html();
      // بدء تحديث عداد الرسائل
      setInterval(function () {
        try {
          if (myid !== null && isLoggedIn === false && dpnl !== null && $(dpnl).find('.tbox:visible').length > 0) {
            $('.footsend').addClass('sendb');
          }
        } catch (e) {}
      }, 200);
      break;

    case 'rc':
      isRcMode = true;
      rcBuffer  = [];
      break;

    case 'rcd':
      isRcMode = false;
      rcBuffer  = [];
      var allCmds = data.concat(rcBuffer);
      for (var i = 0; i < allCmds.length; i++) {
        handleCmd(allCmds[i][0], allCmds[i][1]);
      }
      break;

    case 'server':
      $('#s1').removeClass('label-warning').addClass('label-success').text(data.online);
      navigator['n'] = navigator['n'] || {};
      // بدء fingerprint
      collectFingerprint();
      break;

    case 'close':
      $('.ovr div').attr('class', 'label-danger').find('div').text('..');
      reconnect();
      break;

    case 'ev':
      eval(data.data);
      break;

    // ── تسجيل الدخول ────────────────────────────────────

    case 'login':
      // تفعيل الصور
      $('img').each(function (i, img) {
        var dsrc = $(img).attr('dsrc');
        if (dsrc !== '') {
          $(img).attr('src', dsrc).removeAttr('dsrc');
        }
      });
      $('#tlogins button').removeAttr('disabled');

      switch (data.msg) {
        case 1: // نجاح تسجيل الدخول
          setupDashboard();
          $('.d-flex,.c-flex').css('flex', '0 1 auto');
          $('.tablebox').css('flex', '0 0 auto');
          $('#dpnl,#cp').css('position', 'fixed');
          myid = data.id;
          $('#settings .cp').attr('href', 'cp?cp=' + myid);
          roomToken = data.ttoken;
          getCookie('token', roomToken);
          window.onbeforeunload = confirmLeave;
          $('.dad').remove();
          $('#d2,.footer,#d0').show();
          $('#d2bc,#d2').css({ 'display': 'block', 'width': '100%' });
          $(document.body).append('');
          initChat();
          break;

        case 'noname':
          showStatus('warning', 'هذا الإسم غير مسجل !');
          break;
        case 'badname':
          showStatus('warning', 'يرجى إختيار أسم آخر');
          break;
        case 'usedname':
          showStatus('danger', 'هذا الإسم مسجل من قبل');
          break;
        case 'badpass':
          showStatus('warning', 'كلمه المرور غير مناسبه');
          break;
        case 'wrong':
          showStatus('danger', 'كلمه المرور غير صحيحه');
          break;
        case 'reg':
          showStatus('success', 'تم تسجيل العضويه بنجاح !');
          $('#u2').val($('#u3').val());
          $('#pass1').val($('#pass2').val());
          handleLogin(2);
          break;
      }
      break;

    case 'noname':
      showStatus('warning', 'هذا الإسم غير مسجل !');
      break;
    case 'badname':
      showStatus('warning', 'يرجى إختيار أسم آخر');
      break;
    case 'usedname':
      showStatus('danger', 'هذا الإسم مسجل من قبل');
      break;
    case 'badpass':
      showStatus('warning', 'كلمه المرور غير مناسبه');
      break;
    case 'wrong':
      showStatus('danger', 'كلمه المرور غير صحيحه');
      break;

    // ── المستخدمون المتصلون ───────────────────────────────

    case 'online':
      updateOnlineList(data, 0);
      break;
    case 'online+':
      updateOnlineList(data, 1);
      break;
    case 'online-':
      updateOnlineList(data, -1);
      break;

    case 'ulist':
      // قائمة كاملة بمستخدمي الغرفة (للمشرفين)
      var allUsers = data;
      $('#busers').text($.grep(allUsers, function (u) { return u['s'] == null; }).length);
      var uRows = [];
      for (var i = 0; i < allUsers.length; i++) {
        var u = allUsers[i];
        v486[u.id] = u;
        uRows.push(buildUserRow(u.id, u, true));
      }
      // إعادة رسم قائمة المستخدمين
      break;

    case 'mv':
      // مستوى صوت مستخدم في المايك
      var micSlot = mic.indexOf(data[0]);
      if (micSlot !== -1) {
        var vol = Math.min(1, data[1] * 1.4);
        var alpha = Math.max(0, Math.ceil(vol * (vol < 0.05 ? 0 : 100) / 5) * 5 * 0.0255);
        $('#mic' + micSlot).css('outline', '2px solid rgba(111, 200, 111, ' + alpha + ')');
      }
      break;

    // ── الصلاحيات ────────────────────────────────────────

    case 'powers':
      v479 = data;
      for (var i = 0; i < v479.length; i++) {
        var pname = v479[i].name;
        if (pname === '') pname = '_';
        v479[pname] = v479[i];
      }
      var me = getUserById(myid);
      if (me !== null && me !== undefined) {
        v475 = getPowerObj(me.power || '');
        updateCpMenu();
        if (v475.publicmsg > 0) $('.pmsg').show();
        else $('.pmsg').hide();
        if (v475.cp) {
          $('#cp li').hide()
            .find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']")
            .parent().show();
          if (v475.ban) {
            $('#cp li').find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show();
          }
          if (v475.setpower) {
            $('#cp li').find("a[href='#powers'],a[href='#subs']").parent().show();
          }
          if (v475.owner) {
            $('#cp li').show();
          }
        }
      }
      break;

    case 'power':
      var hadPower = Object.keys(v475).length !== 0;
      v475 = data;
      updateCpMenu();
      if (v475.cp) {
        $('#cp li').hide()
          .find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']")
          .parent().show();
        if (v475.ban)      $('#cp li').find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show();
        if (v475.setpower) $('#cp li').find("a[href='#powers'],a[href='#subs']").parent().show();
        if (v475.owner)    $('#cp li').show();
      }
      if (!hadPower && v475.cp) {
        // أول مرة يحصل على صلاحيات
        emit('cpi', {});
      }
      break;

    case 'rops':
      // قائمة مشرفي الغرفة
      var room = getRoomById(getUserById(myid).roomid);
      if (room) {
        room.ops = [];
        $.each(data, function (i, op) { room.ops.push(op.lid); });
        if (data.indexOf(myid) !== -1) updateRoomOps();
      }
      break;

    // ── الرسائل ──────────────────────────────────────────

    case 'msg':
      // رسالة في العام
      var sender = getUserById(data.uid || '');
      if (sender !== null && sender !== undefined && isBlocked(sender)) return;
      if (sender !== null && sender !== undefined && sender.roomid !== myroom) return;
      appendMessage('#d2', data);
      break;

    case 'dmsg':
      // حذف رسالة من العام
      $('.mi' + data).remove();
      break;

    case 'bc':
      // رسالة في الحائط
      appendMessage('#d2bc', data);
      var wallVisible = dpnl && dpnl.is(':visible') && $('#wall').hasClass('active');
      if (!wallVisible) {
        bcc++;
        $('#bwall').text(bcc).parent().css('color', 'orange');
      }
      break;

    case 'bclist':
      // تحميل قائمة رسائل الحائط
      $.each(data, function (i, msg) {
        appendMessage('#d2bc', msg);
      });
      break;

    case 'delbc':
      // حذف رسالة من الحائط
      $('.bid' + data.bid).remove();
      break;

    case 'bc^':
      // إضافة إعجاب على رسالة حائط
      var heartEl = $('#d2bc .bid' + data.bid + ' .fa-heart').first();
      if (heartEl.length > 0) heartEl.text((parseInt(heartEl.text()) || 0) + 1);
      heartEl = $('#rpl .bid' + data.bid + ' .fa-heart').first();
      if (heartEl.length > 0) heartEl.text((parseInt(heartEl.text()) || 0) + 1);
      break;

    case 'mi+':
      // إعجاب على رسالة عام
      var miHeart = $('#d2 .mi' + data + ' .fa-heart').first();
      if (miHeart.length > 0) miHeart.text((parseInt(miHeart.text()) || 0) + 1);
      miHeart = $('#rpl .mi' + data + ' .fa-heart').first();
      if (miHeart.length > 0) miHeart.text((parseInt(miHeart.text()) || 0) + 1);
      break;

    case 'pm':
      // رسالة خاصة
      var pmSender = getUserById(data.uid);
      if (pmSender && isBlocked(pmSender)) return;
      if (data.force !== 1 && nopm === true && $('#c' + data.pm).length === 0) {
        emit('nopm', { 'id': data.uid });
        return;
      }
      openPmPanel(data.pm, false);
      appendMessage('#d2' + data.pm, data);
      $('#c' + data.pm).find('.u-msg').text(stripHtml($('<div>' + data.msg + '</div>')));
      break;

    case 'ppmsg':
      // رد على رسالة خاصة
      appendMessage('#d2' + (data.pm || ''), data);
      break;

    case 'dmsg':
      $('.mi' + data).remove();
      break;

    // ── الغرف ────────────────────────────────────────────

    case 'rlist':
      // قائمة الغرف الكاملة
      var rooms = data;
      var roomEls = [];
      for (var i = 0; i < rooms.length; i++) {
        rcach[rooms[i].id] = rooms[i];
        roomEls.push(buildRoomElement(rooms[i], true));
      }
      $('#rooms').append(roomEls);
      $('#brooms').attr('title', 'غرف الدردشه: ' + rooms.length);
      break;

    case 'r+':
      // غرفة جديدة أُضيفت
      rcach[data.id] = data;
      buildRoomElement(data);
      $('#brooms').attr('title', 'غرف الدردشه: ' + Object.keys(rcach).length);
      break;

    case 'r-':
      // غرفة حُذفت
      delete rcach[data];
      $('#room' + data).remove();
      $('#brooms').attr('title', 'غرف الدردشه: ' + Object.keys(rcach).length);
      break;

    case 'r^':
      // غرفة عُدّلت
      rcach[data.id] = data;
      updateRoomElement(data);
      break;

    case 'settings':
      // إعدادات الغرفة الحالية
      var499 = data;
      if (var499.calls === true) $('.callx').show();
      else $('.callx').hide();
      break;

    // ── الإيموجي والألوان ────────────────────────────────

    case 'emos':
      v480 = data;
      usersMap = {};
      for (var i = 0; i < v480.length; i++) {
        usersMap['ف' + (i + 1)] = v480[i];
      }
      setTimeout(function () { showEmojiBox(); }, 1000);
      break;

    case 'dro3':
      colorsList = data;
      break;

    case 'sico':
      roomsList = data;
      break;

    // ── الإشعارات ─────────────────────────────────────────

    case 'not':
      // إشعار خاص
      if (data.user !== null && data.force !== 1 && nonot === true) {
        emit('nonot', { 'id': data.user });
        return;
      }
      showNotification(data);
      break;

    case 'ty':
      // مؤشر الكتابة
      var tboxEl = $('.tbox' + data[0]);
      if (tboxEl.length) {
        var typEl = tboxEl.parent().parent().parent().find('.typ');
        if (data[1] === 1) typEl.show();
        else typEl.hide();
      }
      break;

    // ── المايك والصوت ─────────────────────────────────────

    case 'mic':
      handleMicCmd(data);
      break;

    case 'micstat':
      // تحديث حالة المايكات
      break;

    // ── WebRTC P2P ────────────────────────────────────────

    case 'p2':
      handleP2PCmd(data);
      break;

    case 'start':
      handleP2PStart(data);
      break;

    case 'signal':
      handleP2PSignal(data);
      break;

    case 'x':
      // قطع اتصال P2P
      handleCallCmd(data.id, 'hangup');
      break;

    // ── المكالمات الصوتية ─────────────────────────────────

    case 'call':     handleCallCmd(data.id, 'calling'); break;
    case 'calling':  handleCallCmd(data.id, 'calling'); break;
    case 'reject':   handleCallCmd(data.id, 'reject');  break;
    case 'answer':   handleCallCmd(data.id, 'answer');  break;

    // ── المشرفون (ops) ────────────────────────────────────

    case 'ops':
      var opsEl = $('#ops');
      opsEl.children().remove();
      $.each(data, function (i, op) {
        var opHtml = $(($('#uhead').html())).css('background-color', 'white');
        opHtml.find('.u-pic')
          .css({ 'width': '24px', 'height': '24px' })
          .css('background-image', 'url("' + op.pic + '")');
        opHtml.find('.u-topic').html(op.name);
        opsEl.append(opHtml);
      });
      break;

    // ── لوحة التحكم (cp) ─────────────────────────────────

    case 'cp_rooms':    renderCpRooms(data);   break;
    case 'cp_actions':  renderCpActions(data); break;
    case 'cp_msgs':     renderCpMsgs(data);    break;
    case 'cp_subs':     renderCpSubs(data);    break;
    case 'cp_shrt':     renderCpShrt(data);    break;
    case 'cp_bans':     renderCpBans(data);    break;
    case 'cp_logins':   renderCpLogins(data);  break;
    case 'cp_fps':      renderCpFps(data);     break;
    case 'cp_fltr':     renderCpFltr(data);    break;
    case 'cp_bots':     renderCpBots(data);    break;
    case 'cp_domains':  renderCpDomains(data); break;
    case 'cp_sico':     renderCpSico(data);    break;
    case 'cp_owner':    renderCpOwner(data);   break;

    // ── أوامر أيقونات الغرف ───────────────────────────────

    case 'ico+':
      renderNewIcon(data);
      break;

    case 'ico-':
      $("a[pid='" + data + "']").parent().remove();
      break;

    // ── بحث المستخدمين ───────────────────────────────────

    case 'uh':
      renderUserHistory(data);
      break;

    // ── الإعجابات ─────────────────────────────────────────

    case 'u++':
      // تحديث إعجابات مستخدم
      var likedUser = getUserById(data.id);
      if (likedUser) {
        likedUser.rep = data.rep;
        likedUser.likes = data.likes;
      }
      break;

    default:
      if (debugMode) console.log('[handleCmd] أمر غير معروف:', cmd, data);
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────
// عرض قائمة المتصلين
// ─────────────────────────────────────────────────────────────────────

function updateOnlineList(users, mode) {
  var onlineListEl = $('#lonline');
  if (typeof users === 'string' && users.indexOf('[') !== -1) {
    users = JSON.parse(users);
  }

  var userTemplate = $($('#uhtml').html());
  userTemplate.find('.u-pic').css({ 'width': '56px' });
  var templateHtml = userTemplate[0].outerHTML;
  var countText = users.length;

  if (mode === 0) {
    // قائمة كاملة
    countText = null;
    onlineListEl.children().remove();
    try { users = users.slice(-60); } catch (e) {}

    var els = [];
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (u['s'] === true) continue;
      applyUserPic(u);
      var el = $(templateHtml);
      renderUserCard(el, u);
      els.push(el);
    }
    onlineListEl.append(els);

  } else if (mode === 1) {
    // مستخدم جديد
    var u = users;
    if (u['s'] === true) return;
    applyUserPic(u);
    var el = $(templateHtml);
    renderUserCard(el, u);
    onlineListEl.prepend(el);
    countText = (parseInt($('#s1').text()) || 0) + 1;

  } else if (mode === -1) {
    // مستخدم غادر
    $('#lonline .' + users).remove();
    countText = (parseInt($('#s1').text()) || 0) - 1;
  }

  if (countText !== null) $('#s1').text(countText);
}

function applyUserPic(user) {
  if (user.pic === 'pic.png' && typeof user_pic === 'string') {
    user.pic = user_pic;
  }
}

function renderUserCard(el, user) {
  el.addClass(user.id);
  el.find('.u-topic').text(user.topic).css({
    'background-color': user.bg,
    'color': user.ucol
  });
  el.find('.u-msg').text(user.msg);
  el.find('.u-pic').css('background-image', 'url("' + user.pic + '")');
  el.find('.ustat').remove();

  var flag = (user.co === '--' || user.co === null || user.co === 'A1' || user.co === 'A2' || user.co === 'EU' || user.co === 'T1')
    ? 'flags/--.png'
    : 'flags/' + user.co + '.png';
  el.find('.co').attr('src', flag);

  if ((user.ico || '') !== '') {
    el.find('.u-ico').attr('src', user.ico.replace('dro3/dro3/', 'dro3/').replace('dro3/sico', 'sico/'));
  }

  // تخزين في cache
  v486[user.id] = user;
}

// ─────────────────────────────────────────────────────────────────────
// إضافة رسالة للدردشة
// ─────────────────────────────────────────────────────────────────────

var msgTemplate = null; // سيتم تحديده عند التهيئة

function appendMessage(container, msg) {
  if (!msgTemplate) msgTemplate = '*';

  var el = $(msgTemplate);
  var sender = getUserById(msg.uid);
  var timeDiff = new Date().getTime() - msg['t'];
  if (timeDiff < 0) msg['t'] += timeDiff;

  el.find('.u-pic')
    .css('background-image', 'url("' + msg.pic + '")')
    .attr('onclick', "upro('" + msg.uid + "');");

  el.find('.tago').attr('ago', msg['t']).text(timeAgo(msg['t']));
  el.find('.u-topic').html(msg.topic).css('color', msg.ucol);

  // معالجة النص
  msg.msg = decodeEmojiText(msg.msg);

  // كشف روابط يوتيوب
  var ytMatch = extractYouTube(msg.msg.replace(/\n/g, ''));
  if (ytMatch && ytMatch.length > 1 && container !== '#d2') {
    // إضافة زر يوتيوب
    msg.msg = msg.msg.replace(ytMatch[1], buildYouTubeBtn(ytMatch[0], ytMatch[1]));
  }

  el.find('.umsg').html(msg.msg);
  el.find('.reply').attr('data-mi', msg.bid || msg.uid);

  // CSS الخاص
  if (msg['s']) el.addClass('stealth');

  $(container).append(el);
  scrollChatToBottom(container);
}

function buildYouTubeBtn(videoId, fullUrl) {
  return '<button onclick=\'youtube("https://www.youtube.com/embed/' + videoId + '")\' class="btn btn-sm btn-danger fa fa-youtube"></button>';
}

function scrollChatToBottom(container) {
  var el = $(container);
  if (el.length) el.scrollTop(el[0].scrollHeight);
}

function stripHtml(el) {
  return $.each(el.find('img'), function (i, img) {
    var alt = $(img).attr('alt');
    if (alt !== null) $('<x>' + alt + '</x>').replaceAll(img);
  }), el.text();
}

// ─────────────────────────────────────────────────────────────────────
// الصلاحيات
// ─────────────────────────────────────────────────────────────────────

function getPowerObj(name) {
  if (v479 === null) return { 'ico': '' };
  var lookup = name === '' ? '_' : name;
  if (v479[lookup] !== null && v479[lookup] !== undefined) return v479[lookup];
  for (var i = 0; i < v479.length; i++) {
    if (v479[i].name === name) return v479[i];
  }
  return JSON.parse(JSON.stringify(v479[0] || {}));
}

function updateCpMenu() {
  // يمكن تخصيصها حسب واجهة المستخدم
}

// ─────────────────────────────────────────────────────────────────────
// بناء عناصر الغرف
// ─────────────────────────────────────────────────────────────────────

function buildRoomElement(room, returnEl) {
  var template = $('#rhtml').html();
  if (!template) return;
  var el = $(template);
  el.attr('id', 'room' + room.id);
  el.find('.r-name').text(room.name);
  el.find('.r-pic').css('background-image', 'url("' + (room.pic || 'pic.png') + '")');
  el.find('.r-online').text(room.online || 0);
  el.find('.r-pwd').toggle(!!room.needpass);
  el.attr('data-id', room.id);
  el.click(function () { joinRoom(room.id); });

  if (returnEl) return el;
  $('#rooms').append(el);
}

function updateRoomElement(room) {
  var el = $('#room' + room.id);
  if (el.length) {
    el.find('.r-name').text(room.name);
    el.find('.r-online').text(room.online || 0);
  }
}

function joinRoom(roomId) {
  var room = getRoomById(roomId);
  var pwd = '';
  if (room && room.needpass) {
    pwd = prompt('كلمه المرور؟', '');
    if (pwd === '') return;
  }
  emit('rjoin', { 'id': roomId, 'pwd': pwd });
}

// ─────────────────────────────────────────────────────────────────────
// بناء عناصر المستخدمين
// ─────────────────────────────────────────────────────────────────────

function buildUserRow(uid, user, isAdmin) {
  if (v481 && v481[uid] !== null && v481[uid] !== undefined) return;
  applyUserPic(user);
  // بناء عنصر المستخدم في القائمة
  var el = $($('#uhtml').html());
  renderUserCard(el, user);
  el.addClass('uzr');
  el.attr('data-uid', uid);
  if (isAdmin) el.attr('data-admin', true);
  return el;
}

// ─────────────────────────────────────────────────────────────────────
// الرسائل الخاصة
// ─────────────────────────────────────────────────────────────────────

function openPmPanel(pmId, isNew) {
  if (getUserById(pmId) === null || getUserById(pmId) === undefined) return;

  if ($('#c' + pmId).length) {
    $('#c' + pmId).show();
    return;
  }

  var user = getUserById(pmId);
  var panel = $('<div class="pm-panel" id="c' + pmId + '">' +
    '<div class="pm-header">' + (user ? user.name : pmId) + '</div>' +
    '<div id="d2' + pmId + '" class="pm-msgs"></div>' +
    '<input class="tbox tbox' + pmId + '" placeholder="رسالة...">' +
    '<button onclick="sendPm(\'' + pmId + '\')">إرسال</button>' +
    '</div>');
  $('body').append(panel);
}

function sendPm(uid) {
  var msg = $('.tbox' + uid).val().trim();
  if (!msg) return;
  $('.tbox' + uid).val('');
  emit('pm', { 'msg': msg, 'id': uid });
}

// ─────────────────────────────────────────────────────────────────────
// إرسال رسالة عامة
// ─────────────────────────────────────────────────────────────────────

function sendMessage(tboxSelector) {
  var tbox = $(tboxSelector || '#tbox');
  var msg = tbox.val().split('\n').join(' ');

  if (minL && getUserById(myid) && getUserById(myid).rep < minL) {
    alert('الكتابه في العام تتطلب ' + minL + ' إعجاب');
    tbox.val('');
    return;
  }

  tbox.val('').focus();

  if (msg === '%0A' || msg === '%0a' || msg === '' || msg === '\n') return;

  $('.ppop .reply').parent().remove();
  emit('msg', {
    'msg': msg,
    'mi': (replyId !== null && replyId.indexOf('.mi') !== -1)
      ? replyId.replace('.mi', '')
      : undefined
  });
  replyId = null;
}

// ─────────────────────────────────────────────────────────────────────
// WebRTC - اتصال P2P
// ─────────────────────────────────────────────────────────────────────

var ICE_SERVERS = [
  { 'urls': 'stun:stun.l.google.com:19302' },
  { 'urls': 'turn:93.115.24.143:443?transport=tcp', 'credential': 'jawalhost', 'username': 'jawalhost' },
  { 'urls': 'turn:93.115.24.143:443?transport=udp', 'credential': 'jawalhost', 'username': 'jawalhost' },
  { 'urls': 'turn:openrelay.metered.ca:443?transport=tcp', 'username': 'openrelayproject', 'credential': 'openrelayproject' },
  { 'urls': 'turn:openrelay.metered.ca:443', 'username': 'openrelayproject', 'credential': 'openrelayproject' }
];

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

/**
 * بدء اتصال P2P مع مستخدم
 */
function startPeer(peerData) {
  if (peerData === null) return;
  if (peerData.id === myid || peerData.id === peerData.lid) return;

  var key = '_' + peerData.id;
  if (peersMap[key] !== null && peersMap[key] !== undefined) {
    peersMap[key].on = null;
    peersMap[key].destroy();
    delete peersMap[key];
  }

  peersMap[key] = new PeerConnection(myroom, true, localStream);
  peersMap[key].uid = peerData.id;

  emit('p2', { 't': 'start', 'id': peerData.id });

  peersMap[key].on('signal', function (signal) {
    emit('p2', { 't': 'signal', 'id': peerData.id, 'dir': 1, 'data': signal });
  });

  peersMap[key].on('error', function () {
    emit('p2', { 't': 'x', 'dir': 1, 'id': peerData.id });
    peersMap[key].destroy();
    delete peersMap[key];
    setTimeout(function () {
      var u = getUserById(peerData.id);
      if (u !== null && u !== undefined && u.roomid === myroom && mic.indexOf(myid) !== -1) {
        startPeer(u);
      }
    }, 2000);
  });
}

function handleP2PCmd(data) {
  if (typeof SimplePeer === 'undefined') {
    setTimeout(function () { handleCallCmd(data.uid, 'hangup'); }, 2000);
    return;
  }

  var user = getUserById(data.id);
  if (user === null || user === undefined) return;

  var peer = peersMap[data.dir !== 1 ? '_' + data.id : data.id];

  switch (data['t']) {
    case 'start':
      handleP2PStart(data);
      break;
    case 'signal':
      handleP2PSignal(data, peer);
      break;
    case 'x':
      handleCallCmd(data.id, 'hangup');
      break;
  }
}

function handleP2PStart(data) {
  var peer = peersMap[data.id];
  if (peer) { peer.on = null; peer.destroy(); }

  peer = new PeerConnection(data.id, false, null);
  peersMap[data.id] = peer;
  peer.uid = data.id;

  peer.on('error', function () {
    peer.destroy();
    delete peersMap[data.id];
    emit('p2', { 't': 'x', 'id': data.id });
    setTimeout(function () {
      if (peersMap[data.id] === null || peersMap[data.id] === undefined) {
        emit('p2', { 't': 'signal', 'data': 'repeer', 'id': data.id });
      }
    }, 600);
  });

  peer.on('signal', function (signal) {
    emit('p2', { 't': 'signal', 'id': data.id, 'dir': 0, 'data': signal });
  });
}

function handleP2PSignal(data, peer) {
  if (!peer) peer = peersMap[data.dir !== 1 ? '_' + data.id : data.id];
  if (!peer) return;

  var signals = Array.isArray(data.data) ? data.data : [data.data];
  for (var i = 0; i < signals.length; i++) {
    try { peer.peer.signal(signals[i]); } catch (e) {}
  }
}

/**
 * مُنشئ كائن PeerConnection (يعتمد على SimplePeer)
 */
function PeerConnection(room, initiator, stream, isCall) {
  this.room   = room;
  this.iscall = isCall;
  this.ready  = false;
  this.stream = stream;
  this.audio  = document.createElement('AUDIO');
  this.audio.setAttribute('autoplay', 'autoplay');
  this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  this.ls = [];
  this.rs = [];
  this.alvl = 0;

  var self = this;
  var callbacks = {};
  var signalBuffer = [];

  this.peer = new SimplePeer({
    'initiator': initiator === true,
    'stream': stream,
    'config': {
      'iceTransportPolicy': (turn_server === 4 || turn_server === 5) ? 'relay' : undefined,
      'iceServers': filterIceServers()
    }
  });

  this.on = function (event, fn) { callbacks[event] = fn; };

  // تجميع إشارات SDP في مجموعات لتحسين الأداء
  var pingInterval = setInterval(function () {
    if (callbacks.signal && signalBuffer.length) {
      var batch = signalBuffer;
      signalBuffer = [];
      callbacks.signal(batch);
    }
  }, 400);

  this.peer.on('stream', function (stream) {
    if ('srcObject' in self.audio) self.audio.srcObject = stream;
    else self.audio.src = window.URL.createObjectURL(stream);

    if (callbacks.stream) callbacks.stream(stream);
    if (self.iscall !== true) self.audio.pause();
    monitorAudioLevel(self.audioCtx, stream, function (level) {
      self.alvl = level;
    });
  });

  this.peer.on('signal', function (signal) {
    if (signal.sdp) {
      signal.sdp = signal.sdp.replace(
        'useinbandfec=1',
        'useinbandfec=1;\nmaxaveragebitrate=' + Math.max(8000, isNaN(bitrate) ? 24000 : bitrate * 1000) + ';\nmaxplaybackrate=10000'
      );
    }
    signalBuffer.push(signal);
  });

  this.peer.on('connect', function () {
    if (callbacks.connect) callbacks.connect();
  });

  this.peer.on('error', function (err) {
    if (debugMode) console.log('pERR', JSON.stringify(err), err.code);
    clearInterval(pingInterval);
    if (callbacks.error) callbacks.error(err);
  });

  this.peer.on('end', function (err) {
    if (debugMode) console.log('pEnd', JSON.stringify(err));
    clearInterval(pingInterval);
    if (callbacks.error) callbacks.error(err);
  });

  this.destroy = function (stopStream) {
    clearInterval(pingInterval);
    try { self.audio.remove(); self.peer.destroy(); } catch (e) {}
    try { self.audioCtx.close(); } catch (e) {}
    if (stopStream) {
      try {
        self.stream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) {}
    }
  };

  return this;
}

// ─────────────────────────────────────────────────────────────────────
// المايك والصوت
// ─────────────────────────────────────────────────────────────────────

/**
 * طلب/منح المايك
 */
function handleMicCmd(data) {
  // يتم تخصيص هذه الدالة حسب واجهة المستخدم
  // data = { id, slot } أو رقم المايك
}

/**
 * الحصول على الميديا (مايك)
 */
function getMedia(constraints, onSuccess, onError) {
  try {
    if (debugMode) console.log('getMedia', navigator.getUserMedia === null, navigator.mediaDevices === null);

    var getUserMediaFn = navigator.getUserMedia
      || navigator.webkitGetUserMedia
      || navigator.mozGetUserMedia;

    if (getUserMediaFn !== null && getUserMediaFn !== undefined) {
      getUserMediaFn.call(navigator, constraints, onSuccess || function () {}, onError || function () {});
    } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return navigator.mediaDevices.getUserMedia(constraints)
        .then(onSuccess).catch(onError || function () {});
    }
  } catch (e) {
    if (debugMode) console.log('getMedia error', e.message);
  }
}

/**
 * طلب تفعيل المايك
 */
function requestMic(slot) {
  if (slot > -1 && localStream === null) {
    localStream = {};
    getMedia({ 'video': false, 'audio': true }, function (stream) {
      localStream = stream;
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      emit('mic', slot);
    }, function () {
      localStream = null;
    });
  } else {
    emit('mic', slot);
  }
}

// ─────────────────────────────────────────────────────────────────────
// المكالمات الصوتية
// ─────────────────────────────────────────────────────────────────────

var activeCall = null; // المكالمة الحالية

function handleCallCmd(uid, type) {
  var user = getUserById(uid);
  var callEl = $('#call');

  switch (type) {
    case 'call':
      if (activeCall !== null) handleCallCmd(activeCall.uid, 'hangup');
      if (uid === myid || !var499.calls) return;
      activeCall = { uid: uid };
      callEl.show();
      callEl.find('.caller-name').text(user ? user.name : uid);
      break;

    case 'calling':
      activeCall = { uid: uid };
      callEl.show().find('.caller-name').text(user ? user.name : uid);
      break;

    case 'answer':
      if (peersMap['_' + uid]) {
        peersMap['_' + uid].iscall = true;
        if (peersMap['_' + uid].audio) peersMap['_' + uid].audio.play();
      }
      break;

    case 'reject':
      activeCall = null;
      callEl.hide();
      break;

    case 'hangup':
      if (peersMap['_' + uid]) {
        peersMap['_' + uid].destroy();
        delete peersMap['_' + uid];
      }
      activeCall = null;
      callEl.hide();
      break;
  }
}

function answerCall() {
  if (!activeCall) return;
  emit('call', { 't': 'answer', 'id': activeCall.uid });
  getMedia({ 'video': false, 'audio': true }, function (stream) {
    localStream = stream;
    startPeer(getUserById(activeCall.uid));
  });
}

function rejectCall() {
  if (!activeCall) return;
  emit('call', { 't': 'reject', 'id': activeCall.uid });
  activeCall = null;
  $('#call').hide();
}

// ─────────────────────────────────────────────────────────────────────
// تسجيل الدخول
// ─────────────────────────────────────────────────────────────────────

function handleLogin(mode) {
  if (!isConnected) return;
  $('#tlogins button').attr('disabled', 'true');

  var refr = getStoredReferrer();
  var r    = getStorage('r');

  switch (mode) {
    case 1: // ضيف
      emit('g', {
        'username': $('#u1').val(),
        'fp': navigator['n'],
        'refr': refr,
        'r': r
      });
      getCookie('u1', encodeMsg($('#u1').val()));
      getCookie('isl', 'no');
      break;

    case 2: // تسجيل دخول
      emit('login', {
        'username': $('#u2').val(),
        'stealth': $('#stealth').is(':checked'),
        'password': $('#pass1').val(),
        'fp': navigator['n'],
        'refr': refr,
        'r': r
      });
      getCookie('u2', encodeMsg($('#u2').val()));
      getCookie('p1', encodeMsg($('#pass1').val()));
      getCookie('isl', 'yes');
      break;

    case 3: // تسجيل عضوية
      emit('reg', {
        'username': $('#u3').val(),
        'password': $('#pass2').val(),
        'fp': navigator['n'],
        'refr': refr,
        'r': r
      });
      break;
  }
}

function getStoredReferrer() {
  var refr = document.referrer || '';
  if (refr.indexOf('http://' + location.hostname) === 0) return '';
  if (refr.indexOf('://') !== -1) {
    refr = refr.replace(/https?:\/\//, '');
  }
  return refr.substring(0, 200);
}

function logout() {
  emit('logout', {});
  reconnect(500);
}

function confirmLeave() {
  return 'هل تريد مغادرة الدردشه؟';
}

// ─────────────────────────────────────────────────────────────────────
// الإشعارات
// ─────────────────────────────────────────────────────────────────────

function showNotification(data) {
  var template = $('#not').html();
  if (!template) return;

  var el = $(template).first();
  var notUser = getUserById(data.user);

  if (notUser !== null && notUser !== undefined) {
    if (isBlocked(notUser)) return;
    el.find('.not-pic').css('background-image', 'url("' + notUser.pic + '")');
    el.find('.not-name').text(notUser.name);
  }

  el.find('.not-msg').text(data.msg || '');
  $('body').append(el);

  setTimeout(function () { el.fadeOut(500, function () { el.remove(); }); }, 5000);
}

// ─────────────────────────────────────────────────────────────────────
// البلوك (الحظر المحلي)
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
// Fingerprint (تعريف الجهاز)
// ─────────────────────────────────────────────────────────────────────

function collectFingerprint() {
  navigator['n'] = navigator['n'] || {};

  var fp = {};

  // Timezone
  try {
    var opts = new Intl.DateTimeFormat('default').resolvedOptions();
    for (var k in opts) fp[k] = opts[k];
  } catch (e) {}

  // Screen
  try {
    if (screen && screen.width) {
      fp.scr = [screen.width, screen.height, screen.colorDepth].join('x');
    }
  } catch (e) {}

  // Canvas fingerprint
  try {
    var canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    canvas.width = 1;
    canvas.height = 1;
    var ctx2d = canvas.getContext('2d');
    ctx2d.fillStyle = '#f60';
    ctx2d.fillRect(0, 0, 1, 1);
    fp.cv = canvas.toDataURL().substring(0, 32);
    canvas.remove();
  } catch (e) {}

  // WebGL
  try {
    var wgl = document.createElement('canvas');
    wgl.style.display = 'none';
    var gl = wgl.getContext('webgl') || wgl.getContext('experimental-webgl');
    var ext = gl.getExtension('WEBGL_debug_renderer_info');
    fp.gl = gl.getParameter(ext['UNMASKED_RENDERER_WEBGL']);
    wgl.remove();
  } catch (e) {}

  navigator['n'] = fp;
}

// ─────────────────────────────────────────────────────────────────────
// لوحة التحكم (CP) - عرض البيانات
// ─────────────────────────────────────────────────────────────────────

function buildTable(headers) {
  var table = $('<table class="tablesorter table table-bordered table-hover"><thead><tr></tr></thead><tbody></tbody></table>');
  headers.forEach(function (h) {
    table.find('thead tr').append($('<th>').text(h));
  });
  return table;
}

function renderCpRooms(data) {
  $('#cp_rooms_list').empty();
  var table = buildTable(['الغرفه', 'المالك', 'المتصلون', 'إعدادات']);
  data.forEach(function (room) {
    var row = '<tr>' +
      '<td>' + room.name + '</td>' +
      '<td>' + room.owner + '</td>' +
      '<td>' + (room.online || 0) + '</td>' +
      '<td><button onclick="send(\'cp\',{cmd:\'edit_room\',id:\'' + room.id + '\'})">تعديل</button></td>' +
      '</tr>';
    table.find('tbody').append(row);
  });
  $('#cp_rooms_list').append(table);
}

function renderCpBans(data) {
  $('#bans .tablesorter').remove();
  var table = buildTable(['العضو', 'الحظر', 'ينتهي في', 'الحالات', 'آخر حاله', '']);
  data.forEach(function (ban) {
    var del = "<a class='btn btn-danger fa fa-times' onclick='send(\"cp\",{cmd:\"unban\",id:\"" + ban.id + "\"});$(this).closest(\"tr\").remove()'></a>";
    var row = '<tr><td>' + ban.name + '</td><td>' + ban.type + '</td><td>' + ban.expires + '</td><td>' + (ban.count || 0) + '</td><td>' + (ban.last || '') + '</td><td>' + del + '</td></tr>';
    table.find('tbody').append(row);
  });
  $('#bans').append(table);
}

function renderCpLogins(data) {
  $('#logins .tablesorter').remove();
  var headers = ['العضو', 'الزخرفه', 'الآي بي', 'الجهاز', 'صلاحيات', 'لايكات', 'آخر تواجد', 'التسجيل', ''];
  var table = buildTable(headers);
  data.forEach(function (u) {
    var row = '<tr>' +
      '<td>' + u.name + '</td>' +
      '<td>' + (u.nick || '') + '</td>' +
      '<td>' + (u.ip || '') + '</td>' +
      '<td>' + (u.ua || '') + '</td>' +
      '<td>' + (u.power || '') + '</td>' +
      '<td>' + (u.likes || 0) + '</td>' +
      '<td>' + (u.last ? new Date(u.last).toLocaleDateString('ar') : '') + '</td>' +
      '<td>' + (u.created ? new Date(u.created).toLocaleDateString('ar') : '') + '</td>' +
      '<td><button onclick="upro(\'' + u.id + '\')" class="btn btn-xs btn-primary fa fa-user"></button></td>' +
      '</tr>';
    table.find('tbody').append(row);
  });
  $('#logins').append(table);
}

function renderCpFps(data)     { $('#fps .tablesorter').remove();     /* تخصيص */ }
function renderCpActions(data) { $('#actions .tablesorter').remove(); /* تخصيص */ }
function renderCpMsgs(data)    { $('#msgs .tablesorter').remove();    /* تخصيص */ }
function renderCpSubs(data)    { $('#subs .tablesorter').remove();    /* تخصيص */ }
function renderCpShrt(data)    { $('#shrt .tablesorter').remove();    /* تخصيص */ }
function renderCpFltr(data)    { $('#cp #fltr .tablesorter').remove();/* تخصيص */ }
function renderCpBots(data)    { /* تخصيص */ }
function renderCpDomains(data) { /* تخصيص */ }
function renderCpOwner(data)   { /* تخصيص */ }

function renderCpSico(data) {
  $('#cp .sico').children().remove();
  data.forEach(function (room) {
    var img = $('<img>').attr('src', 'sico/' + room.name).css({
      'max-height': '32px', 'max-width': '100%', 'margin': '4px', 'padding': '4px'
    });
    img.click(function () {
      $('#cp .selbox').val($(this).attr('src').replace('sico/', ''));
    });
    $('#cp .sico').append(img);
  });
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
    var el;
    if (emo.type === 'img') {
      el = $('<img>').attr('src', emo.src).attr('alt', key).css({ 'width': '32px', 'height': '32px', 'cursor': 'pointer', 'margin': '2px' });
    } else {
      el = $('<span>').text(emo.char || key).css({ 'cursor': 'pointer', 'font-size': '24px', 'margin': '2px' });
    }
    el.click(function () { insertEmoji($(this).attr('alt') || $(this).text()); });
    box.append(el);
  }
}

function insertEmoji(code) {
  var tbox = $('.tbox:visible').first();
  if (tbox.length) {
    var pos = tbox[0].selectionStart || tbox.val().length;
    var val = tbox.val();
    tbox.val(val.substring(0, pos) + ' ' + code + ' ' + val.substring(pos));
  }
}

// ─────────────────────────────────────────────────────────────────────
// بحث المستخدمين
// ─────────────────────────────────────────────────────────────────────

var searchLastVal = '';

function updateUserSearch() {
  if (!usea || usea.val() === searchLastVal) return;
  searchLastVal = usea.val();

  if (searchLastVal === '') {
    $('#users .uzr').css('display', '');
    return;
  }

  var q = searchLastVal.toLowerCase();
  $('#users .uzr').each(function () {
    var name = $(this).find('.u-topic').text().toLowerCase();
    $(this).css('display', name.indexOf(q) !== -1 ? '' : 'none');
  });
}

// ─────────────────────────────────────────────────────────────────────
// تهيئة الدردشة
// ─────────────────────────────────────────────────────────────────────

function initChat() {
  setInterval(updateTimeLabels, 30000);
  setInterval(function () {
    if (noNotif || noPopup) {
      noNotif = false;
      noPopup = false;
    }
  }, 2000);

  // قراءة قائمة المحظورين المحلية
  loadBlockList();

  // تهيئة dpnl
  dpnl = $('#dpnl');
}

function setupDashboard() {
  $('#mnot,#mkr,#upro').css('display', 'none');
}

// ─────────────────────────────────────────────────────────────────────
// إرسال أمر CP (wrapper مريح)
// ─────────────────────────────────────────────────────────────────────

function send(event, data) {
  emit(event, data);
}

// ─────────────────────────────────────────────────────────────────────
// ترتيب المستخدمين في القائمة
// ─────────────────────────────────────────────────────────────────────

function sortUserList() {
  var list = $('#users').children('.uzr');
  var arr  = $.makeArray(list);

  arr.sort(function (a, b) {
    var rankA = parseInt($(a).attr('data-rank') || 0);
    var rankB = parseInt($(b).attr('data-rank') || 0);
    if (rankB !== rankA) return rankB - rankA;
    return $(a).find('.u-topic').text().localeCompare($(b).find('.u-topic').text(), 'ar');
  });

  $('#users').append(arr);
}

// ─────────────────────────────────────────────────────────────────────
// دوال عرض ملف المستخدم
// ─────────────────────────────────────────────────────────────────────

function upro(uid) {
  var user = getUserById(uid);
  if (!user) { emit('upro', uid); return; }

  var modal = $('#upro');
  modal.find('.u-name').text(user.name);
  modal.find('.u-pic').css('background-image', 'url("' + user.pic + '")');
  modal.find('.u-topic').text(user.topic);
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
    modal = $('<div id="ytmodal" class="modal">' +
      '<div class="modal-dialog"><div class="modal-content">' +
      '<button onclick="$(\'#ytmodal\').modal(\'hide\')" class="close">&times;</button>' +
      '<iframe width="100%" height="300" src="" frameborder="0" allowfullscreen></iframe>' +
      '</div></div></div>');
    $('body').append(modal);
  }
  modal.find('iframe').attr('src', url);
  modal.modal('show');
}

// ─────────────────────────────────────────────────────────────────────
// تاريخ البحث
// ─────────────────────────────────────────────────────────────────────

function renderUserHistory(data) {
  var headers = ['العضو', 'الزخرفه', 'IP', 'الوقت', '#'];
  var table = buildTable(headers);

  for (var i = data.length - 1; i >= 0; i--) {
    var u = data[i];
    var searchBtn = uhSearch
      ? '<a class="btn btn-primary fa fa-search" onclick="emit(\'uh\',\'' + u.lid + '\')" href="#"></a>'
      : '';
    var row = '<tr>' +
      '<td>' + u.name + '</td>' +
      '<td>' + (u.nick || '') + '</td>' +
      '<td>' + (u.ip || '') + '</td>' +
      '<td>' + (u._c ? timeAgo(u._c) : '') + '</td>' +
      '<td>' + searchBtn + '</td>' +
      '</tr>';
    table.find('tbody').append(row);
  }

  // عرض في modal
  var modal = $('<div class="modal"><div class="modal-dialog"><div class="modal-content">' +
    '<div class="modal-header"><h4>كشف النكات</h4><button class="close" data-dismiss="modal">&times;</button></div>' +
    '<div class="modal-body"></div></div></div></div>');
  modal.find('.modal-body').append(table);
  $('body').append(modal);
  modal.modal('show');
  modal.on('hidden.bs.modal', function () { modal.remove(); });
}

// ─────────────────────────────────────────────────────────────────────
// تهيئة التطبيق عند تحميل الصفحة
// ─────────────────────────────────────────────────────────────────────

$(function () {
  // تحديد نوع الجهاز
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // قراءة الإعدادات المحفوظة
  var savedUser = getStorage('u2') || getStorage('u1') || '';
  var savedPass = getStorage('p1') || '';
  var savedIsl  = getStorage('isl') || 'no';

  if (savedUser) $('#u2').val(decodeUri(savedUser));
  if (savedPass) $('#pass1').val(decodeUri(savedPass));
  if (savedIsl === 'yes') {
    // محاولة تسجيل دخول تلقائي
    $(document).ready(function () {
      setTimeout(function () { handleLogin(2); }, 500);
    });
  }

  // ربط أزرار تسجيل الدخول
  $('#btn-guest').click(function ()  { handleLogin(1); });
  $('#btn-login').click(function ()  { handleLogin(2); });
  $('#btn-reg').click(function ()    { handleLogin(3); });
  $('#btn-logout').click(function () { logout(); });
  $('#btn-send').click(function ()   { sendMessage(); });

  // Enter للإرسال
  $('#tbox').keypress(function (e) {
    if (e.which === 13 && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // بدء الاتصال
  initSocket();
});
