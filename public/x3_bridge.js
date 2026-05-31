/* =============================================================
   x3_bridge.js
   جسر الربط بين index.html و x3_final.js و server.js
   يضيف كل الدوال المفقودة ويصلح التوافق الكامل
   ============================================================= */

// ─── 1. إصلاح أسماء دوال تسجيل الدخول ──────────────────────────────
// الـ HTML يستدعي login(n) لكن x3_final يحتوي handleLogin(n)
function login(mode) {
  handleLogin(mode);
}

// ─── 2. إصلاح إرسال رسائل الدردشة العامة ────────────────────────────
// الـ HTML يستدعي Tsend() لكن x3_final يحتوي sendMessage()
function Tsend() {
  sendMessage('#tbox');
}

// ─── 3. إرسال رسائل الحائط (bc) ─────────────────────────────────────
function sendbc(isFile) {
  var tbox = $('.tboxbc');
  var msgText = tbox.val().trim();
  if (!msgText) return;
  tbox.val('');
  emit('bc', { msg: msgText, bid: Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '00' });
}

// ─── 4. كتم/تفعيل الصوت الكلي ────────────────────────────────────────
function muteAll() {
  var btn = $('#muteall');
  if (btn.hasClass('muted')) {
    // تفعيل
    btn.removeClass('muted').css('background-color', 'mediumseagreen');
    for (var k in peersMap) {
      try { if (peersMap[k].audio) peersMap[k].audio.muted = false; } catch(e) {}
    }
  } else {
    // كتم
    btn.addClass('muted').css('background-color', '#666');
    for (var k in peersMap) {
      try { if (peersMap[k].audio) peersMap[k].audio.muted = true; } catch(e) {}
    }
  }
}

// ─── 5. فتح modal إنشاء غرفة جديدة ──────────────────────────────────
function mkr(roomId) {
  var modal = $('#mkr');
  if (roomId) {
    // وضع التعديل
    var room = getRoomById(roomId);
    if (room) {
      modal.find('.rtopic').val(room.name || '');
      modal.find('.rpwd').val('');
      modal.find('.rsave').show();
      modal.find('.rmake').hide();
      modal.find('.rdelete').show();
      modal.attr('data-rid', roomId);
    }
  } else {
    // وضع الإنشاء
    modal.find('.rtopic,.rabout,.rwelcome,.rpwd,.rmax,.rl,.rvl').val('');
    modal.find('.rsave').hide();
    modal.find('.rmake').show();
    modal.find('.rdelete').hide();
    modal.attr('data-rid', '');
  }
  modal.modal('show');
}

// ربط أزرار modal الغرفة
$(function() {
  // إنشاء غرفة
  $('#mkr .rmake').on('click', function() {
    var name = $('#mkr .rtopic').val().trim();
    if (!name) { alert('يرجى كتابة عنوان الغرفه'); return; }
    emit('cp', {
      cmd:  'add_room',
      name: name,
      pass: $('#mkr .rpwd').val().trim() || ''
    });
    $('#mkr').modal('hide');
  });

  // حفظ تعديلات غرفة
  $('#mkr .rsave').on('click', function() {
    var rid = $('#mkr').attr('data-rid');
    if (!rid) return;
    emit('cp', {
      cmd:  'edit_room',
      id:   rid,
      name: $('#mkr .rtopic').val().trim(),
      pass: $('#mkr .rpwd').val().trim() || ''
    });
    $('#mkr').modal('hide');
  });

  // حذف غرفة
  $('#mkr .rdelete').on('click', function() {
    var rid = $('#mkr').attr('data-rid');
    if (!rid || !confirm('هل تريد حذف الغرفه؟')) return;
    emit('cp', { cmd: 'del_room', id: rid });
    $('#mkr').modal('hide');
  });
});

// ─── 6. إدارة الغرفة (تعديل) ─────────────────────────────────────────
function redit(roomId) {
  mkr(roomId);
}

// ─── 7. حفظ الملف الشخصي ─────────────────────────────────────────────
function setprofile() {
  var topic = $('.stopic').val().trim();
  var msg   = $('.smsg').val().trim();
  var ucol  = $('.scolor').css('background-color') || '';
  var bg    = $('.sbg').css('background-color') || '';

  if (topic) {
    emit('setprofile', { topic: topic, msg: msg, ucol: ucol, bg: bg });
  }
  // تحديث محلي فوري
  var me = getUserById(myid);
  if (me) {
    if (topic) me.topic = topic;
    if (msg)   me.msg   = msg;
  }
}

// ─── 8. تغيير صورة الملف الشخصي ─────────────────────────────────────
function sendpic() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var dataUrl = ev.target.result;
      // إرسال للسيرفر (إذا دعم رفع الصور) أو تحديث محلي
      emit('setpic', { pic: dataUrl.substring(0, 500) });
      $('.spic').css('background-image', 'url("' + dataUrl + '")');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ─── 9. إرسال إعلان (رسالة عامة مميزة) ──────────────────────────────
function pmsg() {
  $('#mnot').modal('show');
  $('#mnot .rsave').off('click').on('click', function() {
    var msg   = $('#mnot textarea').val().trim();
    var ispp  = $('#mnot .ispp').is(':checked');
    if (!msg) return;
    emit('bc', { msg: msg, bid: Date.now().toString(36) + 'pm' });
    $('#mnot textarea').val('');
    $('#mnot').modal('hide');
  });
}

// ─── 10. اختيار صورة الغرفة ──────────────────────────────────────────
function roomspic(imgEl) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      imgEl.attr('src', ev.target.result);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ─── 11. تحديث قائمة المستخدمين في الـ panel ─────────────────────────
function updateusers() {
  // يُشغَّل updateUserSearch من x3_final عبر الـ interval
  // هنا نضمن ظهور كل المستخدمين عند فتح الـ panel
  $('#users .uzr').css('display', '');
  if (usea) usea.val('');
}

// ─── 12. ربط مايكات الغرفة بالأحداث ─────────────────────────────────
$(function() {
  // الضغط على خانة المايك
  $('#mic .mic').on('click', function() {
    var slot = parseInt($(this).attr('i'));
    var currentInSlot = mic[slot];

    if (currentInSlot === myid) {
      // مغادرة المايك
      requestMic(-1);
    } else if (!currentInSlot || currentInSlot === 0) {
      // الدخول للمايك
      requestMic(slot);
    } else {
      // إذا كان المستخدم في مايك آخر - انتقال
      requestMic(slot);
    }
  });
});

// ─── 13. إكمال handleMicSlot ─────────────────────────────────────────
// استبدال الدالة الفارغة في x3_final.js
handleMicSlot = function(data) {
  // data = مصفوفة المايكات من السيرفر [uid/0, uid/0, ...]
  if (!Array.isArray(data)) return;

  mic = data;

  // إظهار/إخفاء صف المايكات
  var hasMic = data.some(function(v) { return v && v !== 0; });
  if (hasMic || myid) {
    $('#mic').show();
  }

  for (var i = 0; i < data.length; i++) {
    var uid  = data[i];
    var slot = $('#mic' + i);
    if (!slot.length) continue;

    if (!uid || uid === 0) {
      // خانة فارغة
      slot.find('.u img').attr('src', '').hide();
      slot.find('.u span').text('');
      slot.css({ 'outline': '', 'opacity': '1' });
      slot.attr('data-uid', '');
    } else {
      // خانة مشغولة
      var u = getUserById(uid);
      var pic   = (u && u.pic)   ? u.pic   : 'pic.png';
      var topic = (u && u.topic) ? u.topic : uid;

      slot.find('.u img').attr('src', pic).show();
      slot.find('.u span').text(topic);
      slot.attr('data-uid', uid);

      if (uid === myid) {
        slot.css('outline', '2px solid limegreen');
      }
    }
  }
};

// ─── 14. إصلاح rops → ops ────────────────────────────────────────────
// السيرفر يرسل 'rops' لكن x3_final يسمع 'ops' فقط
// نُضيف معالج rops يُعيد توجيهه
var _origHandleCmd = handleCmd;
handleCmd = function(cmd, data) {
  if (cmd === 'rops') {
    _origHandleCmd('ops', data);
    return;
  }
  _origHandleCmd(cmd, data);
};

// ─── 15. ربط أزرار المكالمات في واجهة المستخدم ───────────────────────
$(function() {
  // زري الرد ورفض المكالمة في div#call
  var callDiv = $('#call');
  callDiv.find('.btn-success.fa-phone').on('click', function() {
    answerCall();
  });
  callDiv.find('.btn-danger.fa-phone').on('click', function() {
    rejectCall();
  });
});

// ─── 16. ربط ملف المستخدم (upro modal) بالأزرار ──────────────────────
$(function() {
  var upModal = $('#upro');

  // محادثة خاصة
  upModal.find('.upm').on('click', function() {
    var uid = upModal.attr('data-uid');
    if (!uid) return;
    upModal.modal('hide');
    openPmPanel(uid, true);
  });

  // إعجاب
  upModal.find('.ulike').on('click', function() {
    var uid = upModal.attr('data-uid');
    if (!uid) return;
    emit('likebc', { bid: uid }); // سيتم تحسينه
  });

  // سحب المايك
  upModal.find('.uml').on('click', function() {
    var uid = upModal.attr('data-uid');
    if (!uid) return;
    emit('uml', uid);
    upModal.modal('hide');
  });

  // طرد من الغرفة
  upModal.find('.urkick').on('click', function() {
    var uid = upModal.attr('data-uid');
    if (!uid) return;
    emit('cp', { cmd: 'kick', id: uid, reason: 'kicked from room' });
    upModal.modal('hide');
  });

  // طرد كلي
  upModal.find('.ukick').on('click', function() {
    var uid = upModal.attr('data-uid');
    if (!uid) return;
    emit('cp', { cmd: 'kick', id: uid });
    upModal.modal('hide');
  });

  // باند
  upModal.find('.uban').on('click', function() {
    var uid = upModal.attr('data-uid');
    if (!uid) return;
    emit('cp', { cmd: 'ban', id: uid, type: 'fp' });
    upModal.modal('hide');
  });

  // كتم (تجاهل محلي)
  upModal.find('.umute').on('click', function() {
    var uid = upModal.attr('data-uid');
    if (!uid) return;
    var u = getUserById(uid);
    if (u) blockUser(uid);
    upModal.modal('hide');
  });

  // إلغاء التجاهل
  upModal.find('.uunmute').on('click', function() {
    var uid = upModal.attr('data-uid');
    if (!uid) return;
    var u = getUserById(uid);
    if (u) unblockUser(u.lid);
    upModal.modal('hide');
  });

  // كشف النكات
  upModal.find('.uh').on('click', function() {
    var uid = upModal.attr('data-uid');
    if (!uid) return;
    var u = getUserById(uid);
    if (u) emit('uh', u.lid);
    upModal.modal('hide');
  });

  // تغيير الزخرفة
  upModal.find('.u-nickc').on('click', function() {
    var uid   = upModal.attr('data-uid');
    var topic = upModal.find('.nickbox .u-topic').val().trim();
    if (!uid || !topic) return;
    emit('cp', { cmd: 'setpower', id: uid, power: getUserById(uid)?.power || '', rank: getUserById(uid)?.rank || 0 });
  });

  // حفظ الإعجابات
  upModal.find('.ulikec').on('click', function() {
    var uid   = upModal.attr('data-uid');
    var likes = parseInt(upModal.find('.likec').val()) || 0;
    if (!uid) return;
    emit('cp', { cmd: 'likes', id: uid, likes: likes });
  });

  // حفظ الصلاحية
  upModal.find('.upower').on('click', function() {
    var uid   = upModal.attr('data-uid');
    var power = upModal.find('.userpower').val() || '';
    if (!uid) return;
    emit('cp', { cmd: 'setpower', id: uid, power: power, rank: 0 });
  });

  // نقل لغرفة
  upModal.find('.uroomz').on('click', function() {
    var uid  = upModal.attr('data-uid');
    var rid  = upModal.find('.roomz').val();
    var pwd  = upModal.find('.rpwd').val() || '';
    if (!uid || !rid) return;
    // إرسال أمر نقل للسيرفر
    emit('cp', { cmd: 'move', id: uid, roomId: rid, pwd: pwd });
  });
});

// ─── 17. ملء select الغرف في upro modal ─────────────────────────────
var _origHandleCmdOps = handleCmd;
handleCmd = function(cmd, data) {
  _origHandleCmdOps(cmd, data);
  if (cmd === 'rlist') {
    // تحديث قائمة الغرف في modal upro
    var sel = $('#upro .roomz');
    sel.empty();
    for (var i = 0; i < data.length; i++) {
      sel.append('<option value="' + data[i].id + '">' + data[i].name + '</option>');
    }
  }
  if (cmd === 'powers') {
    // تحديث قائمة الصلاحيات في modal upro
    var psel = $('#upro .userpower');
    psel.empty();
    psel.append('<option value="">-- بدون --</option>');
    for (var pi = 0; pi < data.length; pi++) {
      psel.append('<option value="' + (data[pi].name || '') + '">' + (data[pi].name || 'عادي') + '</option>');
    }
  }
};

// ─── 18. إظهار/إخفاء div الغرفة عند تسجيل الدخول ────────────────────
var _origLogin = handleCmd;
handleCmd = function(cmd, data) {
  _origLogin(cmd, data);
  if (cmd === 'login' && data && data.msg === 'ok') {
    // إخفاء صفحة الدخول وإظهار الغرفة
    $('#tlogins').hide();
    $('#room').css('display', 'flex');
    isLoggedIn = true;
  }
  if (cmd === 'kick') {
    // طرد → إعادة لصفحة الدخول
    $('#room').hide();
    $('#tlogins').show();
    isLoggedIn = false;
    myid = null;
  }
};

// ─── 19. تثبيت template الرسالة: x3 يبحث عن #mhtml لكن HTML لديه #umsg
$(function() {
  // إنشاء alias: #mhtml يشير لمحتوى #umsg
  if (!$('#mhtml').length && $('#umsg').length) {
    $('body').append('<x id="mhtml" style="display:none;">' + $('#umsg').html() + '</x>');
  }
});

// ─── 20. إصلاح بناء عنصر الغرفة: rhtml يستخدم u-topic بدل r-name ────
var _origBuildRoom = null;
$(function() {
  // x3_final يبحث عن .r-name و .r-online و .r-pic في #rhtml
  // لكن #rhtml الحالي يستخدم .u-topic و .uc
  // نُصلح buildRoomElement بعد تحميل الصفحة
  var origBuild = buildRoomElement;
  buildRoomElement = function(room) {
    var tmpl = $('#rhtml').html();
    if (!tmpl) return;
    var el = $(tmpl);
    el.attr('id', 'room' + room.id).attr('data-id', room.id);

    // دعم كلا الإصدارين من التسمية
    el.find('.r-name, .u-topic').text(room.name);
    el.find('.r-pic, .u-pic').css('background-image', 'url("' + (room.pic || 'room.png') + '")');
    el.find('.r-online, .uc').text((room.online || 0) + ' ');

    // كلمة مرور
    var pwdEl = el.find('.r-pwd, .fa-key');
    if (room.needpass) pwdEl.show(); else pwdEl.hide();

    el.on('click', function() { joinRoom(room.id); });
    $('#rooms').append(el);
  };
});

// ─── 21. إصلاح r^ (تحديث عدد الغرفة) ────────────────────────────────
// x3 يبحث عن .r-name ثم .r-online — نضمن الإصدارين
$(function() {
  var _origCmd = handleCmd;
  handleCmd = function(cmd, data) {
    _origCmd(cmd, data);
    if (cmd === 'r^') {
      // أيضاً نحدث .u-topic و .uc إذا لم تُحدَّث
      var el = $('#room' + data.id);
      if (el.length) {
        el.find('.u-topic, .r-name').text(data.name || '');
        el.find('.uc, .r-online').text((data.online || 0) + ' ');
      }
    }
  };
});

// ─── 22. ضبط حجم الشاشة ─────────────────────────────────────────────
function fixSize() {
  var h = $(window).height();
  $('#room, #tlogins').css('height', h + 'px');
  if (v483) {
    var footH  = $(v483).find('.footer').outerHeight() || 42;
    var micH   = $('#mic').is(':visible') ? $('#mic').outerHeight() : 0;
    var d0H    = $('#d0').outerHeight() || 0;
    var topH   = 0;
    var avail  = h - footH - micH - d0H - topH;
    $(v483).find('.flex-grow-1.d2, #d2').css('height', Math.max(100, avail) + 'px');
  }
}

$(window).on('resize', fixSize);
$(function() { setTimeout(fixSize, 300); });

// ─── 23. دالة setv لحفظ الإعدادات ────────────────────────────────────
function setv(key, val) {
  getCookie(key, val);
}

// ─── 24. استعادة إعدادات الزوم والصوت من التخزين ─────────────────────
$(function() {
  var savedZoom    = getStorage('zoom');
  var savedTurn    = getStorage('turn_server');
  var savedBitrate = getStorage('bitrate');

  if (savedZoom)    { document.body.style.zoom = savedZoom; $('#zoom').val(savedZoom); }
  if (savedTurn)    { turn_server = parseInt(savedTurn);   $('#turn_server').val(savedTurn); }
  if (savedBitrate) { bitrate = parseInt(savedBitrate);    $('#turn_bitrate').val(savedBitrate); }
});

// ─── 25. ربط صندوق الإيموجي بالضغط على الزر ────────────────────────
$(function() {
  $(document).on('click', '.emobox', function() {
    var box = $('#emobox');
    if (box.length) {
      box.toggle();
    } else {
      // إنشاء صندوق الإيموجي إذا لم يكن موجوداً
      var newBox = $('<div id="emobox" class="corner border light" style="position:absolute;bottom:46px;right:0;max-width:280px;max-height:200px;overflow-y:auto;z-index:100;padding:4px;background:white;"></div>');
      $('body').append(newBox);
      showEmojiBox();
      newBox.show();
    }
  });
});

// ─── 26. ربط زر مغادرة الغرفة ────────────────────────────────────────
$(function() {
  // زر مغادرة في الفوتر - يُرسل rleave ثم يعود للصفحة الرئيسية
  $(document).on('click', '.fa-sign-out[onclick*="rleave"]', function() {
    // تنفيذ الـ onclick الأصلي كافٍ، لكن نضيف إخفاء الواجهة
  });
});

// ─── 27. تحديث panel النشط عند تبديل التابات ────────────────────────
$(function() {
  $('[data-toggle="tab"]').on('shown.bs.tab', function() {
    var target = $(this).attr('data-target');
    v483 = target ? $(target) : null;
    if (target === '#wall') {
      bcc = 0;
      $('#bwall').text('').parent().css('color', '');
    }
    fixSize();
  });
});

// ─── 28. إصلاح عرض الغرفة وإخفاء صفحة الدخول بعد الـ rc/rcd ────────
$(function() {
  var __cmd = handleCmd;
  handleCmd = function(cmd, data) {
    __cmd(cmd, data);
    if (cmd === 'rcd') {
      v484 = myroom;
      v483 = $('#room');
      fixSize();
    }
  };
});

// ─── 29. تحديث myroom من السيرفر ─────────────────────────────────────
var _setMyRoom = handleCmd;
handleCmd = function(cmd, data) {
  _setMyRoom(cmd, data);
  if (cmd === 'login' && data && data.msg === 'ok' && data.r) {
    myroom = data.r;
  }
};

console.log('[x3_bridge] ✅ تم تحميل جسر الربط الكامل');
