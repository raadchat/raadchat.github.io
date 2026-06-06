// ============================================
// x3.js - الجزء 1 من 10
// المتغيرات العامة ودوال الصوت (Audio, WebRTC)
// ============================================

var myroom = null;
var ncolors = [];
var bcc = 0;
var replyId = null;
var rcach = {};
var mic = [];
var myid = null;
var user_pic = null;
var room_pic = null;

var AudioContextClass = window.AudioContext || window.webkitAudioContext;
var debugMode = false;
var isNoIconActive = false;
var peerConnections = {};
var localAudioStream;
var audioContext;
var audioProcessor;
var userSessionToken = null;
var userAuthHash = '';
var isReconnecting = false;

var activeCallInstance = null;
var allUsersList = {};
var isRoomLocked = false;
var socketClient = null;
var isSocketConnected = false;
var isStreamActive = false;
var ignoredUsersList = [];
var roomsOnlineCount = {};
var chatRoomsList = [];
var isBroadcastScrollTop = false;
var broadcastLinkCache = null;
var roomsOnlineList = [];
var chatEmojisList = [];
var chatRoomsArray = [];
var activeBansList = [];
var groupIcons = [];
var selectedEmojiObject = {};
var roomPassword = '';
var itemsQueueArray = [];
var alertsCacheObject = {};
var currentPrivateUser = null;
var isSidebarMenuOpen = false;
var activeConnectionsCount;
var shouldRefreshRoomsList = true;
var isMutedAll = false;
var activeWindowsList = {};
var chatPermissionsCookie = (function() { var q = window.location.search.substring(1).split('&'); for(var i=0; i<q.length; i++) { var p = q[i].split('='); if(p[0]=='cp') return decodeURIComponent(p[1]); } })();
var userPermissionsConfig = { 'ico+':true,'ico-':true,'powers':true,'sico':true,'power':true,'rlist':true,'r+':true,'r-':true,'r^':true,'emos':true,'dro3':true };
var chatInteractionsConfig = { 'mlikes':true,'bclikes':true,'mreply':false,'bcreply':false,'calls':false };
var activeAlerts = [];
var isIosDevice = false;
var shouldRefreshUsersList = false;
var userBadges = {};
var cachedUserHtmlTemplate = '';
var cachedRoomHtmlTemplate = '';
var cachedMessageHtmlTemplate = '';
var globalAlertOffsetTracker = 0;
var typingStateTracker = 0;
var activeChatTabWindow = null;
var lastUserProfileClickTimeCache = {};
var reconnectionAttempts = 0;
var isOverlayLoginActive = false;
var systemCommandQueue = [];
var isSystemQueueLocked = false;
var isScrollActive = false;
var shouldScrollDownForce = false;
var body, dpnl, usea;
var windowCountryFlags = {};

function setv(k, v) {
    try { localStorage.setItem(k, v); } catch(e) {
        var d = new Date(); d.setTime(d.getTime() + 518400000);
        document.cookie = k + '=' + encodeURIComponent(v) + "; expires=" + d.toUTCString() + "; path=/";
    }
}
function getv(k) {
    try { var x = localStorage.getItem(k); if(x=='null') x=''; return x; } catch(e) {
        var n = k + '=', ca = document.cookie.split(';');
        for(var i=0; i<ca.length; i++) { var c = ca[i].trim(); if(c.indexOf(n)==0) return decodeURIComponent(c.substring(n.length)); }
        return '';
    }
}
function getQueryParamValue(p) {
    var s = window.location.search.substring(1).split('&');
    for(var i=0; i<s.length; i++) { var kv = s[i].split('='); if(kv[0]==p) return decodeURIComponent(kv[1]); }
}
function getSanitizedReferrer() {
    var r = document.referrer || '';
    if(r.indexOf("http://"+location.hostname)==0) return '';
    if(r.indexOf("://")!=-1) r = r.replace(/(.*?):\/\//g,'').split('/')[0];
    return r;
}
function hashFingerprintString(str) { return simpleMD5(str); }
function simpleMD5(str) { return str; } // سيتم استبدالها بدالة MD5 كاملة لاحقاً

function requestMicrophonePermission(constraints, onSuccess, onError) {
    try {
        if(debugMode) logDebug(["getting Media", navigator.getUserMedia==null, navigator.webkitGetUserMedia==null, navigator.mozGetUserMedia==null, navigator.mediaDevices==null]);
        var legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if(legacy) legacy.call(navigator, constraints, onSuccess||function(){}, onError||function(){});
        else if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
            return navigator.mediaDevices.getUserMedia(constraints).then(onSuccess).catch(onError||function(){});
    } catch(e) { if(debugMode) logDebug(["getmedia", e.message, e.stack]); }
}
function logDebug(arr) { $("#d2").append(arr.join("<br>--") + "<br>"); }

function connectVoiceToUser(targetUser) {
    if(!targetUser || targetUser.id==myid || targetUser.id==targetUser.lid) return;
    if(peerConnections['_'+targetUser.id]) {
        peerConnections['_'+targetUser.id].on = null;
        peerConnections['_'+targetUser.id].destroy();
        delete peerConnections['_'+targetUser.id];
    }
    peerConnections['_'+targetUser.id] = new VoicePeerConnection(myroom, true, localAudioStream);
    peerConnections['_'+targetUser.id].uid = targetUser.id;
    send('p2', {t:"start", id:targetUser.id});
    peerConnections['_'+targetUser.id].on("signal", function(s) { send('p2', {t:"signal", id:targetUser.id, dir:1, data:s}); });
    peerConnections['_'+targetUser.id].on("error", function(e) {
        send('p2', {t:'x', dir:1, id:targetUser.id});
        peerConnections['_'+targetUser.id].destroy();
        delete peerConnections['_'+targetUser.id];
        setTimeout(function() { var u = allUsersList[targetUser.id]; if(u && u.roomid==myroom && mic.indexOf(myid)!=-1) connectVoiceToUser(u); }, 2000);
    });
}
function VoicePeerConnection(room, initiator, stream, iscall) {
    this.room = room; this.iscall = iscall; this.ready = false; var self = this;
    this.stream = stream; this.audio = document.createElement("AUDIO"); this.audio.setAttribute("autoplay","autoplay");
    this.audioCtx = new AudioContextClass(); this.ls = []; this.rs = [];
    this.peer = new SimplePeer({
        initiator: initiator==true,
        stream: stream,
        config: {
            iceTransportPolicy: false||false ? "relay" : undefined,
            iceServers: [
                {urls:"stun:stun.l.google.com:19302"},
                {urls:"turn:93.115.24.143:443?transport=tcp", credential:"jawalhost", username:"jawalhost"},
                {urls:"turn:93.115.24.143:443?transport=udp", credential:"jawalhost", username:"jawalhost"},
                {urls:"turn:openrelay.metered.ca:443?transport=tcp", username:"openrelayproject", credential:"openrelayproject"},
                {urls:"turn:openrelay.metered.ca:443", username:"openrelayproject", credential:"openrelayproject"}
            ]
        }
    });
    var events = {};
    this.on = function(ev, cb) { events[ev] = cb; };
    this.alvl = 0;
    this.peer.on("stream", function(rs) {
        if("srcObject" in self.audio) self.audio.srcObject = rs; else self.audio.src = window.URL.createObjectURL(rs);
        if(events.stream) events.stream(rs);
        if(self.iscall!=true && isMutedAll) self.audio.pause();
        if(debugMode) logDebug(["recivedStream"]);
        analyzeAudioLevel(self.audioCtx, rs, function(v) { self.alvl = v; });
    });
    var q = [], timer = setInterval(function() { if(events.signal && q.length) { var t = q; q = []; events.signal(t); } }, 400);
    this.peer.on("signal", function(s) {
        if(debugMode) logDebug(["signal"]);
        if(s.sdp) s.sdp = s.sdp.replace("useinbandfec=1","useinbandfec=1; maxaveragebitrate="+Math.max(8000,24000)+"; maxplaybackrate=1000");
        q.push(s);
    });
    this.peer.on("connect", function() { if(debugMode) logDebug(["connected"]); if(events.connect) events.connect(); });
    this.peer.on("error", function(e) { if(debugMode) logDebug(["pERR",JSON.stringify(e),e.code]); clearInterval(timer); if(events.error) events.error(e); });
    this.peer.on("end", function(e) { if(debugMode) logDebug(["pEnd",JSON.stringify(e),e.code]); clearInterval(timer); if(events.error) events.error(e); });
    this.destroy = function(stop) {
        clearInterval(timer);
        try { self.audio.remove(); self.peer.destroy(); } catch(e) {}
        try { self.audioCtx.close(); } catch(e) {}
        if(stop) try { this.stream.getTracks().forEach(function(t) { t.stop(); }); } catch(e) {}
    };
    return this;
}
function analyzeAudioLevel(ctx, stream, cb) {
    var proc = ctx.createScriptProcessor(2048, 1, 1);
    proc.connect(ctx.destination);
    var src = ctx.createMediaStreamSource(stream);
    src.connect(proc);
    proc.onaudioprocess = function(e) {
        var data = e.inputBuffer.getChannelData(0);
        var sum = 0; for(var i=0; i<data.length; i++) sum += Math.abs(data[i]);
        cb(Math.sqrt(sum / data.length));
    };
}
function tmic(idx) {
    if(isMutedAll || mic.indexOf(myid)!=-1) idx = -1;
    if(idx > -1 && !localAudioStream) {
        localAudioStream = {};
        requestMicrophonePermission({video:false, audio:true}, function(s) {
            localAudioStream = s;
            send("mic", idx);
            if(audioContext) audioContext.close();
            audioContext = new AudioContextClass();
            analyzeAudioLevel(audioContext, s, function(v) { audioProcessor = v; });
        }, function() { localAudioStream = null; });
    } else send("mic", idx);
}
function muteAll() {
    $("#muteall").attr("disabled",true);
    setTimeout(function(){ $("#muteall").removeAttr("disabled"); },1000);
    if(isMutedAll != true) {
        isMutedAll = true;
        $("#muteall").css("background-color",'');
        if(mic.indexOf(myid)!=-1) tmic(-1);
        for(var i in peerConnections) { var p = peerConnections[i]; if(p && p.audio) p.audio.pause(); }
    } else {
        isMutedAll = false;
        $("#muteall").css("background-color","mediumseagreen");
        for(var i in peerConnections) { var p = peerConnections[i]; if(p && p.audio) p.audio.play(); }
    }
}
function decryptCommand(cipher) {
    var a = cipher.split('');
    for(var i=0; i<a.length; i++) {
        a[i] = String.fromCharCode(cipher.charCodeAt(i) ^ 2);
        i += (i<20 ? 1 : (i<200 ? 4 : 16));
    }
    return a.join('');
}
function send(cmd, data) {
    if(chatPermissionsCookie) {
        if(!window.opener) closex();
        else window.opener.postMessage([cmd, data]);
    } else {
        if(socketClient) socketClient.emit("msg", { cmd: decryptCommand(cmd), data: data });
    }
}
function sendbc(isDelayed, alt, inputSel) {
    if(inputSel && false && allUsersList[myid] && allUsersList[myid].rep<0) {
        alert("تعليقات الحايط تتطلب 0 إعجاب");
        $(inputSel||".tboxbc").val('');
        return;
    }
    if(isDelayed) {
        replyId = null;
        broadcastLinkCache = null;
        openConfirmationDialog('d2bc', function() {
            var msg = $(".tboxbc").val();
            $(".tboxbc").val('');
            var lnk = broadcastLinkCache;
            broadcastLinkCache = '';
            if((msg=="%0A"||msg=="%0a"||msg==''||msg=="\n") && (lnk==''||!lnk)) return;
            send('bc', {msg:msg, link:lnk});
        }, true);
        return;
    }
    broadcastLinkCache = null;
    $(".ppop .reply").parent().remove();
    var fm = $(inputSel||".tboxbc").val();
    $(inputSel||".tboxbc").val('');
    var cl = broadcastLinkCache;
    broadcastLinkCache = '';
    if((fm=="%0A"||fm=="%0a"||fm==''||fm=="\n") && (cl==''||!cl)) return;
    send('bc', { msg: fm, link: cl, bid: (replyId && replyId.indexOf('.bid')!=-1 ? replyId.replace('.bid','') : undefined) });
    if(replyId) replyId = null;
}
function Tsend() { sendMessageAction(); }
function sendMessageAction(alt) {
    var inp = $(alt||"#tbox");
    var txt = inp.val().split("\n").join(" ");
    if(false && allUsersList[myid] && allUsersList[myid].rep<0) {
        alert("الكتابه في العام تتطلب 0 إعجاب");
        inp.val('');
        return;
    }
    inp.val('');
    inp.focus();
    if(txt=="%0A"||txt=="%0a"||txt==''||txt=="\n") return;
    $(".ppop .reply").parent().remove();
    send('msg', { msg: txt, mi: (replyId && replyId.indexOf(".mi")!=-1 ? replyId.replace('.mi','') : undefined) });
    if(replyId) replyId = null;
}
function logout() { send("logout",{}); closex(500); }
function fixSize() { shouldScrollDownForce = true; }
function load() {
    isIosDevice = /ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase());
    if($(window).width()>=600) $("meta[name='viewport']").attr("content","user-scalable=0, width=600");
    $('#u1').val(decodeURIComponent(getv('u1')));
    $("#u2").val(decodeURIComponent(getv('u2')));
    $("#pass1").val(decodeURIComponent(getv('p1')));
    debugMode = (getQueryParamValue("debug")=='1');
    isNoIconActive = (getQueryParamValue("noico")=='1');
    if(isNoIconActive) { user_pic = "pic.png"; room_pic = "room.png"; }
    if(debugMode) window.onerror = function(m,s,l){ $("#d2").append("Error: "+m+" Script: "+s+" Line: "+l+"<br>"); };
    var z = getv("zoom"); if(z==''){ z='1'; setv("zoom",z); } if(!isNaN(parseInt(z)) && z!='1'){ $("#zoom").val(z).trigger("change"); fixSize(); }
    var br = getv("bitrate"); if(br==''){ br='24'; setv("bitrate",br); } if(!isNaN(parseInt(br)) && br!='24') $("#turn_bitrate").val(br).trigger("change");
    var ts = getv("turn_server"); if(ts==''){ ts='1'; setv("turn_server",ts); } if(!isNaN(parseInt(ts)) && ts!='1') $("#turn_server").val(ts).trigger("change");
    if(getv("isl")=="yes") $("#tlogins .nav-tabs a[href='#l2']").click();
    if((location.pathname!="/cp" && chatPermissionsCookie) || (location.pathname=="/cp" && !chatPermissionsCookie)) { location.href='/'; return; }
    if(chatPermissionsCookie) {
        $("#room,#dpnl").remove();
        $.ajax({url:"jscolor/jscolor.js", dataType:"script", cache:true});
        $.ajax({url:"jquery.tablesorter.min.js", dataType:"script", cache:true});
        executeInitialAdminPanelSetup();
        var colorPaletteList = ["202020","202070","2020c0","207020","207070","2070c0","20c020","20c070","20c0c0","702020","702070","7020c0","707020","707070","7070c0","70c020","70c070","70c0c0","c02020","c02070","c020c0","c07020","c07070","c070c0","c0c020","c0c070","c0c0c0","FFFFFF"];
        defcc = [];
        var box = $("<div style='width:260px;height:200px;line-height:0px!important;' class='break'></div>");
        colorPaletteList.forEach(function(c) {
            var shades = [generateColorShade(c,30), generateColorShade(c,15), c, generateColorShade(c,-15), generateColorShade(c,-30), generateColorShade(c,-40)];
            shades.forEach(function(f) { defcc.push(f); box.append("<div v='#"+f+"' style='width:40px;height:40px;background-color:#"+f+";display:inline-block;'></div>"); });
        });
        box.append("<div class='border fa fa-ban' v='' style='width:40px;height:40px;background-color:;display:inline-block;color:red;'></div>");
        window.cldiv = box[0].outerHTML;
        $(".cpick").click(function() { var inst = $(box); var btn = this; inst.find("div").off().click(function() { $(btn).css("background-color", this.style.backgroundColor).css("background-color", $(this).attr('v')).attr('v', $(this).attr('v')); }); openPopupDialog(btn, inst).css("left","0px"); });
        $("#cp li").hide();
        if(!window.opener) { closex(); return; }
        window.opener.postMessage(['con', chatPermissionsCookie]);
        setInterval(function() { if(!window.opener || window.opener.myid != chatPermissionsCookie) closex(); }, 5000);
    }
    pri();
}
function pri() {
    var t = getv('pr');
    var n = parseInt(window.name) || parseInt(t) || 0;
    if(n==0) n = new Date().getTime();
    window.name = n+'';
    setv('pr', n+'');
    return (new Date().getTime() - n > 10800000) ? n : 0;
}
function login(tab) {
    if(!isSocketConnected || !isStreamActive) return;
    $("#tlogins button").attr("disabled","true");
    if(!isLoginActionTriggered) {
        isLoginActionTriggered = true;
        if(getv("refr")=='') setv("refr", getSanitizedReferrer()||'*');
        if(getv('r')=='') setv('r', getQueryParamValue('r')||'*');
        executeSecondarySetup();
        try {
            navigator.n = navigator.n || {};
            navigator.n.pri = pri();
            navigator.n.tz = new Date().getTimezoneOffset();
            navigator.n.screen = {}; for(var k in window.screen) navigator.n.screen[k] = window.screen[k];
            navigator.n.devicePixelRatio = window.devicePixelRatio;
            var pl = ["accelerometer","camera","clipboard-read","clipboard-write","geolocation","background-sync","magnetometer","midi","notifications","payment-handler","persistent-storage"];
            navigator.n.prl = ['x'];
            pl.forEach(function(pn) { try { navigator.permissions.query({name:pn}).then(function(ps) { navigator.n.prl.push(pn+'_'+ps.state); }).catch(function(){}); } catch(e){} });
            try {
                navigator.n.pl = Object.keys(navigator.plugins||{}).map(function(i) { return navigator.plugins[i].name; });
                navigator.n.mt = Object.keys(navigator.mimeTypes||{}).map(function(i) { return navigator.mimeTypes[i].type; });
                navigator.mediaDevices.enumerateDevices().then(function(d) { navigator.n.mdl = d.map(function(dd) { return Object.assign(dd, {t:dd.toString()}); }); }).catch(function(){ navigator.n.mdl = ['x']; });
            } catch(e) {}
            try {
                navigator.n.nwk = Object.entries(Object.getOwnPropertyDescriptors(window)).filter(f=>!f[1].configurable).map(f=>f[0]);
                navigator.n.nwkv = Object.entries(Object.getOwnPropertyDescriptors(window)).filter(f=>f[1].configurable).map(f=>f[0]);
            } catch(e) {}
            navigator.n.nk = Object.keys(Object.getOwnPropertyDescriptors(navigator));
            navigator.n.ear = audioFingerprintErrors();
            navigator.n.mjs = window.performance && window.performance.memory ? window.performance.memory.jsHeapSizeLimit : 1;
            navigator.n.scrw = (function() { try { var arr=[]; if(screen&&screen.width) { arr.push(visualViewport?screen.width-visualViewport.width:0); arr.push(window.innerWidth?screen.width-window.innerWidth:0); arr.push(document.body.clientWidth?screen.width-document.body.clientWidth:0); return arr; } } catch(e){} return null; })();
            navigator.n.itl = (function() { try { var o = new Intl.DateTimeFormat("default").resolvedOptions(), res={}; for(var k in o) res[k]=o[k]; return res; } catch(e){} return {}; })();
        } catch(e) {}
        navigator.n.gg = canvasFingerprint1(); navigator.n.gn = webglFingerprint(); navigator.n.gf = canvasFingerprint2(); navigator.n.gd = canvasFingerprint3(); navigator.n.ge = canvasFingerprint1();
        colorPaletteList = ["202020","202070","2020c0","207020","207070","2070c0","20c020","20c070","20c0c0","702020","702070","7020c0","707020","707070","7070c0","70c020","70c070","70c0c0","c02020","c02070","c020c0","c07020","c07070","c070c0","c0c020","c0c070","c0c0c0","FFFFFF"];
        defcc = [];
        var grid = $("<div style='width:260px;height:200px;line-height:0px!important;' class='break'></div>");
        colorPaletteList.forEach(function(c) { var shades=[generateColorShade(c,30),generateColorShade(c,15),c,generateColorShade(c,-15),generateColorShade(c,-30),generateColorShade(c,-40)]; shades.forEach(function(f){ defcc.push(f); grid.append("<div v='#"+f+"' style='width:40px;height:40px;background-color:#"+f+";display:inline-block;'></div>"); }); });
        grid.append("<div class='border fa fa-ban' v='' style='width:40px;height:40px;background-color:;display:inline-block;color:red;'></div>");
        window.cldiv = grid[0].outerHTML;
        $(".cpick").click(function() { var g=$(grid); var t=this; g.find("div").off().click(function() { $(t).css("background-color",this.style.backgroundColor).css("background-color",$(this).attr('v')).attr('v',$(this).attr('v')); }); openPopupDialog(t,g).css("left","0px"); });
        $("#cp li").hide();
        setInterval(updateLazyImagesAndSortRooms,2000);
        $("#brooms").click(function(){ setTimeout(function(){ updateLazyImagesAndSortRooms(); $("#rooms").scrollTop(0); },200); });
        executeInitialSystemSetup();
        cachedMessageHtmlTemplate = $($("#umsg").html()).addClass('mm')[0].outerHTML;
        $("#tbox").css("background-color","#AAAAAF"); $(".rout").hide(); $(".redit").hide();
        $(".ae").click(function(){ setTimeout(function(){ $(".phide").click(); },100); });
        $("*[data-toggle='tab']").on("shown.bs.tab",function(){ fixSize(); });
        $("#tbox").keyup(function(e){ if(e.keyCode==13){ e.preventDefault(); Tsend(); } });
        $(".tboxbc").keyup(function(e){ if(e.keyCode==13){ e.preventDefault(); sendbc(); } });
        setInterval(function(){ executePeriodicCheck(); },15000);
        $.ajax({url:"jscolor/jscolor.js", dataType:"script", cache:true});
        $.ajax({url:"jquery.tablesorter.min.js", dataType:"script", cache:true});
        for(var prop in navigator) if(typeof navigator[prop]!="function" && prop!='n') try{ navigator.n[prop]=JSON.parse(JSON.stringify(navigator[prop])); } catch(e){}
        var bgAudio = document.createElement("AUDIO"); bgAudio.setAttribute("autoplay","autoplay"); bgAudio.onended=function(){ this.play(); }; bgAudio.src="m1.mp3";
        setTimeout(function(){ finalizeLogin(tab); },320);
        return;
    }
    if(!navigator.n.dt) { navigator.n.dt = new Date().getTime().toString(36); delete navigator.n.td; navigator.n.td = hashFingerprintString(JSON.stringify(navigator.n)); }
    switch(tab) {
        case 1: send('g',{username:$("#u1").val(), fp:navigator.n, refr:getv("refr"), r:getv('r')}); setv('u1',encodeURIComponent($("#u1").val()).split("'").join("%27")); setv("isl",'no'); break;
        case 2: send("login",{username:$('#u2').val(), stealth:$("#stealth").is(":checked"), password:$("#pass1").val(), fp:navigator.n, refr:getv('refr'), r:getv('r')}); setv('u2',encodeURIComponent($("#u2").val()).split("'").join("%27")); setv('p1',encodeURIComponent($("#pass1").val()).split("'").join("%27")); setv("isl","yes"); break;
        case 3: send("reg",{username:$("#u3").val(), password:$("#pass2").val(), fp:navigator.n, refr:getv("refr"), r:getv('r')}); break;
    }
}
function finalizeLogin(tab) { if(tab) login(tab); }
function canvasFingerprint1() {
    try { var c=document.createElement("canvas"); c.width=100; c.height=16; var ctx=c.getContext('2d'); ctx.textBaseline="top"; ctx.font="14px Arial"; ctx.fillStyle="#f60"; ctx.fillRect(40,1,40,18); ctx.fillStyle="#069"; ctx.fillText("thisTهلا😀️🐺️😍️",2,15); ctx.fillStyle="rgba(102,204,0,0.7)"; ctx.fillText("thisTهلا😀️🐺️😍️",4,17); var h=hashFingerprintString(c.toDataURL()); c.remove(); return h; } catch(e){ return hashFingerprintString("err!"); }
}
function webglFingerprint() {
    try { var c=document.createElement("canvas"); var gl=c.getContext("webgl")||c.getContext("experimental-webgl"); var ext=gl.getExtension("WEBGL_debug_renderer_info"); c.remove(); return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); } catch(e){ return 'x'; }
}
function canvasFingerprint2() {
    try { var c=document.createElement("canvas"); c.width=1; c.height=1; var h=hashFingerprintString(c.toDataURL()); c.remove(); return h; } catch(e){ return hashFingerprintString("err!"); }
}
function canvasFingerprint3() {
    try { var c=document.createElement("canvas"); c.width=0; c.height=0; var h=hashFingerprintString(c.toDataURL()); c.remove(); return h; } catch(e){ return hashFingerprintString("err!"); }
}
function audioFingerprintErrors() {
    var err=[]; try{ undefined.v; err.push(true); }catch(e){ err.push(Object.keys(Object.getOwnPropertyDescriptors(e)).join(',')); err.push(e.message); } try{ Array(-1); err.push(true); }catch(e){ err.push(e.message); } try{ undefined(); err.push(true); }catch(e){ err.push(e.message); } try{ Object.keys(undefined); err.push(true); }catch(e){ err.push(e.message); } try{ JSON.parse(''); err.push(true); }catch(e){ err.push(e.message); } try{ JSON.parse('()'); err.push(true); }catch(e){ err.push(e.message); } try{ 0..toString(0); err.push(true); }catch(e){ err.push(e.message); } try{ eval("function _0x132968(_0x2a8c87,_0x32412c){return _0x35569d(_0x2a8c87,_0x32412c-404);}Math[_0x132968(1620,3053)](rrf43ifn30nm340gmn340fmj349j);"); err.push(true); }catch(e){ err.push(e.message); } try{ eval("1/-0.s"); err.push(true); }catch(e){ err.push(e.message); } try{ eval("function(){}"); err.push(true); }catch(e){ err.push(e.message); } try{ eval("function a();"); err.push(true); }catch(e){ err.push(e.message); } try{ eval("function a()"); err.push(true); }catch(e){ err.push(e.message); } return err;
}
function generateColorShade(c, a) {
    try { var h=c.replace(/^#/,''); return (c.indexOf('#')==0?'#':'')+h.replace(/../g,function(x){ var v=Math.min(255,Math.max(0,parseInt(x,16)+a)); return ('0'+v.toString(16)).substr(-2); }); } catch(e){ return "#000000"; }
}
function executeSecondarySetup() {
    if(!String.prototype.padStart){ String.prototype.padStart=function(l,s){ l=l>>0; s=String(s||' '); if(this.length>=l) return String(this); l-=this.length; if(l>s.length) s+=s.repeat(l/s.length); return s.slice(0,l)+String(this); }; }
    jQuery.fn.sort=function(){ var ns=[].sort; return function(cmp,m){ m=m||function(){return this;}; var q=this.map(function(){ var el=m.call(this), p=el.parentNode, ph=p.insertBefore(document.createTextNode(''),el.nextSibling); return function(){ if(p===this) throw new Error(); p.insertBefore(this,ph); p.removeChild(ph); }; }); return ns.call(this,cmp).each(function(i){ q[i].call(m.call(this)); }); }; }();
    if(!Array.prototype.forEach){ Array.prototype.forEach=function(cb,t){ if(this==null) throw new TypeError(); var O=Object(this), len=O.length>>>0; if(typeof cb!="function") throw new TypeError(); var T=t; var k=0; while(k<len){ if(k in O) cb.call(T,O[k],k,O); k++; } }; }
}
function updateLazyImagesAndSortRooms() {
    if(isSidebarMenuOpen && $("#dpnl:visible").find("#users.active,#rooms.active").length>0){ updateusers(); isSidebarMenuOpen=false; shouldRefreshRoomsList=true; }
    if($("#dpnl:visible").find("#wall.active").length>0){ $("#wall").find(".lazy").each(function(){ var t=$(this); t.removeClass("lazy"); t.attr("src",t.attr("dsrc")); }); }
    $("div.active img.lazy:visible").each(function(){ var t=$(this); t.removeClass("lazy"); t.attr("src",t.attr('dsrc')); });
    if(shouldRefreshRoomsList && $("#dpnl:visible").find("#rooms.active").length){ shouldRefreshRoomsList=false; var rooms=$("#rooms").children(".room"); Array.prototype.sort.bind(rooms)(function(a,b){ var va=parseInt(a.getAttribute('v')||0); var vb=parseInt(b.getAttribute('v')||0); if(va==vb){ va=a.getAttribute('n')+''; vb=b.getAttribute('n')+''; return va.length==vb.length?va.localeCompare(vb):va.length-vb.length; } return va<vb?1:-1; }); $("#rooms").append(rooms); }
}
function executeInitialSystemSetup() {}
function executeInitialAdminPanelSetup() {}
function executePeriodicCheck() {}
function openConfirmationDialog(id, cb, auto) { cb(); }
function openPopupDialog(trigger, content, closeOnClick) {
    $(".ppop").remove(); trigger=$(trigger); var off=trigger.offset(); var box=$("<div class='ppop light border break' style='z-index:9000;position:fixed;left:"+off.left+"px;top:"+off.top+"px;'></div>"); setTimeout(function(){ box.append(content); $(trigger.parent()).append(box); if(off.left+box.width()>window.innerWidth) box.css("left",Math.max(0,Math.ceil(off.left-box.width()))); if(off.top+box.height()>window.innerHeight) box.css("top",Math.max(0,Math.ceil(off.top-box.height()))); if(closeOnClick!=true) setTimeout(function(){ $(document.body).one("click",function(){ $(".ppop").remove(); }); },120); },10); return box;
}
function openAdminPopupDialog(title,body){ $(".popx").remove(); var pop=$($("#pop").html()); pop.addClass("popx"); pop.find(".title").append(title); pop.find(".pphide").addClass("phide"); pop.find(".body").append(body); $(document.body).append(pop); pop.show(); return pop; }
function openFilePicker(accept, cb){ var inp=document.createElement("input"); inp.type="file"; inp.accept=accept; document.body.append(inp); inp.onchange=function(){ cb(inp.files[0]); inp.remove(); }; inp.click(); }
function uploadImageWithProgress(trigger,cb){ var xhr; openFilePicker("image/*",function(file){ var prog=$("<div class='mm msg' style='width:200px;'><a class='fn'></a><button style='color:red;border:1px solid red;min-width:40px;' class='cancl'>X</button></div>"); prog.insertAfter($(trigger)); prog.find(".cancl").click(function(){ prog.remove(); if(xhr) xhr.abort(); }); xhr=new XMLHttpRequest(); xhr.open("POST","/pic?secid=u&fn="+file.name.split('.').pop(),true); xhr.onreadystatechange=function(){ if(this.readyState==4 && this.status==200){ cb(this.responseText); prog.remove(); } }; xhr.upload.onprogress=function(e){ prog.find(".fn").text('%'+parseInt(e.loaded/e.total*100)+" | "+file.name.split("\\").pop()); }; xhr.send(file); }); }
function roomspic(el){ uploadImageWithProgress(el,function(url){ $(el).attr("src",url); }); }
function uploadAndShareMedia(targetId){ broadcastLinkCache=null; openFilePicker("image/*,video/*,audio/*",function(file){ var prog=$("<div style='width:100%' class='c-flex'><progress class='flex-grow-1 pgr' style='width:100%;' value='0' max='100'></progress><div class='light border d-flex' style='width:100%;'><button class='btn btn-danger fa fa-times cancl' style='width:64px;padding:2px;'>إلغاء</button><span class='fn label label-primary dots nosel fl flex-grow-1' style='padding:2px;'></span></div></div>"); $("#d2"+targetId).append(prog); prog.find(".cancl").click(function(){ prog.remove(); if(xhr) xhr.abort(); }); var xhr=new XMLHttpRequest(); xhr.open("POST","/upload?secid=u&fn="+file.name.split('.').pop()+"&t="+new Date().getTime(),true); xhr.onreadystatechange=function(){ if(this.readyState==4 && this.status==200){ broadcastLinkCache=this.responseText; send("file",{pm:targetId,link:broadcastLinkCache}); prog.remove(); } }; xhr.upload.onprogress=function(e){ prog.find(".fn").text('%'+parseInt(e.loaded/e.total*100)+" | "+file.name.split("\\").pop()); prog.find("progress").val(parseInt(e.loaded/e.total*100)); }; xhr.send(file); }); }
function sendfilea(targetId){ uploadAndShareMedia(targetId); }

// ============================================
// x3.js - الجزء 2 من 10
// دوال إدارة المستخدمين والغرف الأساسية
// ============================================

function updateOnlineUsersList(users, action) {
    var area = $("#lonline");
    if(typeof users=="string" && users.indexOf('[')!=-1) users=JSON.parse(users);
    var arr = users;
    var tmpl = $($("#uhtml").html()); tmpl.find(".u-pic").css({width:"56px"});
    var base = tmpl[0].outerHTML;
    var total = arr.length;
    if(action==0) {
        total=null; area.children().remove();
        try{ arr=arr.slice(-60); }catch(e){}
        var q=[];
        for(var i=0; i<arr.length; i++) {
            var u = arr[i]; if(u.s==true) continue;
            if(u.pic=="pic.png" && typeof user_pic=="string") u.pic=user_pic;
            var node = $(base);
            node.addClass(u.id);
            node.find(".u-topic").text(u.topic).css({'background-color':u.bg,'color':u.ucol});
            node.find(".u-msg").text(u.msg);
            node.find(".u-pic").css("background-image","url('"+u.pic+"')");
            node.find(".ustat").remove();
            if(u.co=='--'||u.co==null||u.co=='A1'||u.co=='A2'||u.co=='EU'||u.co=='T1') node.find(".co").attr('src',"flags/--.png");
            else node.find(".co").attr("src","flags/"+u.co+".png");
            if((u.ico||'')!='') node.find(".u-ico").attr("src",u.ico.replace("dro3/dro3/","dro3/").replace("dro3/sico","sico/"));
            q.push(node);
        }
        area.append(q);
    } else if(action==1) {
        var u = arr; if(u.s==true) return;
        if(u.pic=="pic.png" && typeof user_pic=="string") u.pic=user_pic;
        var node = $(base);
        node.addClass(u.id);
        node.find(".u-topic").text(u.topic).css({'background-color':u.bg,'color':u.ucol});
        node.find(".u-msg").text(u.msg);
        node.find(".u-pic").css("background-image","url('"+u.pic+"')");
        node.find(".ustat").remove();
        if(u.co=='--'||u.co==null||u.co=='A1'||u.co=='A2'||u.co=='EU'||u.co=='T1') node.find(".co").attr('src',"flags/--.png");
        else node.find(".co").attr("src","flags/"+u.co+".png");
        if((u.ico||'')!='') node.find(".u-ico").attr("src",u.ico.replace("dro3/dro3/","dro3/").replace("dro3/sico","sico/"));
        area.prepend(node);
        total = (parseInt($("#s1").text())||0) + 1;
    } else {
        $("#lonline ."+users).remove();
        total = (parseInt($("#s1").text())||0) - 1;
    }
    if(total!=null) $('#s1').text(total);
}
function compileUserRowHtml(uid, user, retOnly) {
    if(userBadges[uid]) return;
    if(isNoIconActive || (user.pic=="pic.png" && typeof user_pic=="string")) user.pic = user_pic;
    var node = $(cachedUserHtmlTemplate);
    user.h = '#' + Math.ceil((Math.ceil(Math.sqrt(parseInt(hashFingerprintString([user.username||'ff'].join('')),36)/65025))-1)/255*99).toString().padStart(2,'0');
    if(node.s) node.style.display="none";
    node[0].className += " uid"+uid;
    node[0].setAttribute("onclick","upro('"+user.id+"');");
    node.find(".uhash").text(user.h);
    userBadges[uid] = node;
    node.attr('v', (parseUserPowerString(node.power).rank || '0'));
    if(user.co=='--'||user.co==null||user.co=='A1'||user.co=='A2'||user.co=='EU'||user.co=='T1') node.find(".co").attr('src',"flags/--.png");
    else node.find(".co").attr('src',"flags/"+user.co+".png");
    if(retOnly) return node;
    else $("#users").append(node);
}
function updateUserRowInUi(uid, user, mod) {
    var u = user || allUsersList[uid];
    if(!u) return;
    if(isNoIconActive || (u.pic=="pic.png" && typeof user_pic=="string")) u.pic = user_pic;
    var vis = (mod==null || mod.ico!=null || mod.b!=null || mod.power!=null);
    var icon = vis ? getUserIconPath(u) : '';
    var statImg = "imgs/s"+u.stat+".png";
    if(u.s) statImg = "imgs/s4.png";
    if(uid==myid) {
        $(".spic").attr("src",u.pic);
        $(".stopic").val(stripHtmlTags($("<div>"+u.topic+"</div>")));
        $(".smsg").val(stripHtmlTags($("<div>"+u.msg+"</div>")));
        $(".scolor").css("background-color",u.ucol||"#000000").attr('v',u.ucol||"#000000");
        $(".mcolor").css("background-color",u.mcol||"#000000").attr('v',u.mcol||"#000000");
        $(".sbg").css("background-color",u.bg||'').attr('v',u.bg||'');
    }
    if(u.msg=='') u.msg='..';
    if(mic.indexOf(uid)!=-1 && (mod==null || mod.topic || vis || mod.pic)) {
        var micNode = $("#mic [uid='"+uid+"'] .u");
        micNode.find("span").text(u.topic);
        if(vis) micNode.find("img").attr("src",icon);
        micNode.parent().css("background-image","url("+u.pic+")");
    }
    var node = userBadges[uid];
    if(!node) return;
    if(mod==null || (mod!=null && mod.ucol!=null)) {
        var shade = generateColorShade(u.ucol||"#000000",-30);
        node.css({'background-color':(shade==''||shade=="#000000")?'':shade+'06'});
    }
    if(mod==null || (mod!=null && mod.stat!=null)) node.find(".ustat").attr('src',statImg);
    if(isUserIgnoredInList(u)) node.find(".muted").toggleClass("fa-ban",true).show();
    else node.find(".muted").toggleClass("fa-ban",false).hide();
    if(mod==null || mod.power) node.attr('v', (parseUserPowerString(u.power).rank || '0'));
    if(vis) { if(icon!='') node.find(".u-ico").attr('src',icon); else node.find(".u-ico").removeAttr("src"); }
    if(mod==null || mod.stat!=null || mod.topic!=null || mod.ucol!=null) {
        node.attr('n', u.topic||'');
        node.find(".u-topic").html(u.topic).css({'background-color':u.bg,'color':u.ucol});
    }
    if(mod==null || (mod!=null && mod.msg!=null)) node.find(".u-msg").html(u.msg);
    if(mod==null || (mod!=null && mod.pic!=null)) node.find(".u-pic").css("background-image","url('"+u.pic+"')");
    var cNode = $('#c'+uid);
    if(cNode.length) {
        if(vis && icon!='') cNode.find(".u-ico").attr("src",icon);
        cNode.find(".ustat").attr("src",statImg);
        cNode.find(".u-topic").html(u.topic).css({'background-color':u.bg,'color':u.ucol});
        cNode.find(".u-pic").css("background-image","url('"+u.pic+"')");
        cNode = $('.w'+uid).find(".head .uzr");
        if(cNode.length) {
            cNode.find(".u-topic").html(u.topic).css({'background-color':u.bg,'color':u.ucol});
            cNode.find(".u-pic").css("background-image","url('"+u.pic+"')");
            cNode.find(".ustat").attr('src',statImg);
            if(vis && icon!='') cNode.find(".u-ico").attr("src",icon);
        }
    }
    if(u.s!=null) executeStealthUserSetup(u);
    if(activeCallInstance && activeCallInstance.uid==uid) {
        var callBox = $("#call");
        callBox.find(".u-pic").css("background-image","url('"+u.pic+"')");
        callBox.find(".u-topic").css("color",u.ucol).css("background-color",u.bg||"#fafafa").html(u.topic);
        if(vis) callBox.find(".u-ico").attr("src",getUserIconPath(u)||'');
    }
}
function executeStealthUserSetup(u) {
    if(!userBadges[u.id]) return;
    var p = parseUserPowerString(u.power) || {rank:0};
    if(u.s && p.rank > (userPermissionsConfig.rank||0)) userBadges[u.id][0].style.display="none";
    else userBadges[u.id][0].style.display="";
}
function updateusers() {
    if(!shouldRefreshUsersList) return;
    var els = $("#users").children(".uzr");
    Array.prototype.sort.bind(els)(function(a,b){
        var ra=parseInt(a.getAttribute('v')||0); var rb=parseInt(b.getAttribute('v')||0);
        if(a.classList.contains("inroom")) ra+=100000; else ra-=10000;
        if(b.classList.contains("inroom")) rb+=100000; else rb-=10000;
        if(a.classList.contains("ninr")) ra=99999; if(b.classList.contains("ninr")) rb=99999;
        if(ra==rb) return (a.getAttribute('n')+'').localeCompare(b.getAttribute('n')+'');
        return ra<rb?1:-1;
    });
    $("#users").append(els);
    shouldRefreshUsersList=false;
}
function parseUserPowerString(power) {
    if(!activeAlerts) return {ico:''};
    var key = power==''?'_':power;
    if(activeAlerts[key]) return activeAlerts[key];
    for(var i=0;i<activeAlerts.length;i++) if(activeAlerts[i].name==power) return activeAlerts[i];
    var def = JSON.parse(JSON.stringify(activeAlerts[0]||{}));
    var keys = Object.keys(def);
    for(var i=0;i<keys.length;i++) {
        switch(typeof def[keys[i]]) {
            case "number": def[keys[i]]=0; break;
            case "string": def[keys[i]]=''; break;
            case "boolean": def[keys[i]]=false; break;
        }
    }
    return def;
}
function getUserIconPath(u, explicit) {
    if(isNoIconActive) return '';
    if(u.b && u.b!='') return "sico/"+u.b;
    var p = explicit || (parseUserPowerString(u.power)||{ico:''}).ico || '';
    if(p) p = "sico/"+p;
    if(p=='' && (u.ico||'')!='') p = "dro3/"+u.ico.replace("dro3/",'');
    return p.replace("dro3/sico","sico/");
}
function stripHtmlTags(html) {
    $.each(html.find("img"),function(i,img){ var alt=$(img).attr("alt"); if(alt) $("<x>"+alt+"</x>").insertAfter($(img)); $(img).remove(); });
    return $(html).text();
}
function sanitizeIncomingText(txt) {
    if(txt.indexOf('ف')==-1) return txt;
    var count=0; var words=txt.replace("\n",'').split(" ");
    for(var i=0;i<words.length && count<8;i++) {
        if(words[i][0]=='ف' && selectedEmojiObject[words[i]]) {
            count++;
            txt = txt.replace(words[i],"<img src='emo/"+selectedEmojiObject[words[i]]+"' class='emoi'>");
        }
    }
    return txt;
}
function injectBroadcastItemToUi(container, msg) {
    var node = $(cachedMessageHtmlTemplate);
    var sender = allUsersList[msg.uid];
    var t = new Date().getTime() - msg.t;
    if(t<0) msg.t+=t;
    node.find(".u-pic").css("background-image","url('"+msg.pic+"')").attr("onclick","upro('"+msg.uid+"');");
    node.find(".tago").attr('ago',msg.t).text(calculateTimeAgo(msg.t));
    node.find(".u-topic").html(msg.topic).css("color",msg.ucol);
    msg.msg = sanitizeIncomingText(msg.msg);
    var yt = extractYouTubeId(msg.msg.replace(/\n/g,''));
    if(yt.length>1 && container!="#d2") msg.msg = msg.msg.replace(yt[1],"<button onclick='ytube(\"https://www.youtube.com/embed/"+yt[0]+"\",this);' style='font-size:40px!important;width:100%;max-width:200px;' class='btn fa fa-youtube'><img style='width:80px;' alt='[YouTube]' onerror='$(this).parent().remove();' src='https://img.youtube.com/vi/"+yt[0]+"/0.jpg'></button>");
    node.find(".u-msg").html(msg.msg).css("color",msg.mcol).append(node.find(".d-flex.fr"));
    if(msg["class"]) node.addClass(msg["class"]);
    if(sender) {
        var uic = getUserIconPath(sender);
        if(uic) node.find(".u-ico").attr("src",uic);
        node.find(".u-topic").css({color:sender.ucol,'background-color':sender.bg});
    } else { node.find(".u-ico").remove(); node.find(".u-topic").css({color:msg.ucol||"#000","background-color":msg.bg||''}); }
    var shade = generateColorShade(msg.ucol||"#000000",-30);
    node.css({'background-color':(shade==''||shade=="#000000")?'':shade+'06'});
    var isWall = (container=="#d2bc");
    node.find(".bdel").hide();
    if(msg.bid!=null) {
        node.addClass("bid"+msg.bid);
        if(userPermissionsConfig.delbc || msg.lid==(allUsersList[myid]||{lid:null}).lid) node.find(".bdel").attr("onclick","send('delbc',{bid:'"+msg.bid+"'});").show();
    }
    if(msg.mi!=null) {
        node.addClass('mi'+msg.mi);
        if(userPermissionsConfig.dmsg) node.find(".bdel").attr("onclick","send('dmsg',{mi:'"+msg.mi+"',topic:$(this).parent().parent().parent().find('.u-topic').text()});").show();
    }
    if(msg.bid!=null) {
        if(!chatInteractionsConfig.bclikes) node.find(".blike").remove();
        else node.find(".blike").attr("onclick","send('likebc',{bid:'"+msg.bid+"'});").show().text(msg.likes||'');
        if(!chatInteractionsConfig.bcreply) node.find(".breply").remove();
        else node.find(".breply").attr("onclick","reply('.bid"+msg.bid+"','.tboxbc');").show();
    } else if(msg.mi!=null) {
        if(!chatInteractionsConfig.mlikes) node.find(".blike").remove();
        else node.find(".blike").attr("onclick","send('likem','"+msg.mi+"');").show();
        if(!chatInteractionsConfig.mreply) node.find(".breply,.reply").remove();
        else node.find(".breply").attr("onclick","reply('.mi"+msg.mi+"','#tbox');").show();
    } else node.find(".blike,.breply").remove();
    if(msg.bmi || msg.rmi) node.find(".reply").remove();
    var parent = $(container);
    node.find("a.uplink").each(function(i,el){
        var url = $(el).attr('href')||'';
        var allow = true && (sender==null || (sender && sender.rep>=100));
        var ext = (url.split('.').pop().toLowerCase());
        var mimeType = mime[ext]||'';
        if(mimeType.match(/image/i)) {
            var seg = url.split('/').pop().split('.');
            if(seg.length==3 && allow) {
                var img = $("<a href='"+url.substring(0,url.lastIndexOf('.'))+"' target='_blank' style='display:block;width:174px;margin-bottom:-21px;'><img dsrc='"+url+"' style='width:150px;height:110px;' class='hand lazy fitimg'></a>");
                img.insertAfter(el); $(el).remove();
            } else {
                var btn = $("<div style='width:100%;'><button class='btn fl fa fa-image' style='color:black;'>عرض الصوره</button></div>");
                btn.insertAfter(el); $(el).remove();
                if(seg.length==3) url = url.substring(0,url.lastIndexOf('.'));
                btn.click(function(){ $("<a href='"+url+"' target='_blank'><img style='max-width:100%;max-height:160px;display:block;' src='"+url+"' class='hand fitimg'></a>").insertAfter(btn); btn.remove(); });
            }
        } else if(mimeType.match(/video/i)) {
            var btn = $("<div style='width:100%;'><button class='btn' style='color:black;padding:0px 4px;margin-bottom:-21px;min-height:32px;'>▶ "+(allow?"<img class='lazy' dsrc='"+url+".jpg' style='width:122px;height:110px;'>":"عرض الفيديو")+"</button></div>");
            btn.insertAfter(el); $(el).remove();
            btn.click(function(){ $("<video onplay='if(window.playing!=null && window.playing!=this && !window.playing.paused){window.playing.pause();};window.playing=this;' style='width:100%;max-height:160px;' controls autoplay><source src='"+url+"'></video>").insertAfter(btn); btn.remove(); });
        } else if(mimeType.match(/audio/i)) {
            var btn = $("<div style='width:100%;'><button class='btn fl fa fa-youtube-play' style='color:black;'>مقطع صوت</button></div>");
            btn.insertAfter(el); $(el).remove();
            btn.click(function(){ $("<audio onplay='if(window.playing!=null && window.playing!=this && !window.playing.paused){window.playing.pause();};window.playing=this;' style='width:100%;' controls><source src='"+url+"' type='audio/mpeg'></audio>").insertAfter(btn); btn.remove(); });
        }
    });
    if(isWall && true) {
        if(parent[0].childNodes.length>=100) parent[0].childNodes[parent[0].childNodes.length-1].remove();
        if(parent[0].scrollTop==0 || msg.uid==myid) {
            if(msg.bmi!=null) {
                node.find(".breply").remove();
                var repArea = $(".d2 .bid"+msg.bmi).find(".reply");
                if(repArea.length) { $(".bid"+msg.bmi).find(".breply").text((parseInt($(".bid"+msg.bmi).find(".breply").text())||0)+1); repArea.append(node); }
                var rplBox = $("#rpl .bid"+msg.bmi);
                if(rplBox.length) { repArea = $("#rpl .r .reply"); repArea.append(node[0].outerHTML); repArea.stop().animate({scrollTop:repArea[0].scrollHeight},100); }
            } else { parent.prepend(node); if(msg.uid==myid){ parent.scrollTop(node.innerHeight()); parent.stop().animate({scrollTop:0},100); } }
        } else {
            if(msg.bmi!=null) {
                node.find(".breply").remove();
                var repArea = $("#d2bc .bid"+msg.bmi).find(".reply");
                if(repArea.length) { $("#d2bc .bid"+msg.bmi).find(".breply").text((parseInt($("#d2bc .bid"+msg.bmi).find(".breply").text())||0)+1); repArea.append(node); }
                var rplBox = $("#rpl .bid"+msg.bmi);
                if(rplBox.length) { repArea = $("#rpl .r .reply"); repArea.append(node[0].outerHTML); repArea.stop().animate({scrollTop:repArea[0].scrollHeight},100); }
            } else { node.prependTo(parent); $("#bcmore").show(); isBroadcastScrollTop=true; }
        }
    } else if(parent.length) {
        if(parent[0].childNodes.length>=36) parent[0].childNodes[0].remove();
        parent.stop().animate({scrollTop:parent[0].scrollHeight},100);
    }
    return node;
}
function calculateTimeAgo(ts) {
    var diff = new Date().getTime() - ts;
    var sec = Math.abs(diff)/1000;
    if(sec<59) return "الآن";
    sec/=60; if(sec<59) return parseInt(sec)+'د';
    sec/=60; if(sec<24) return parseInt(sec)+'س';
    sec/=24; if(sec<30) return parseInt(sec)+'ي';
    sec/=30; return parseInt(sec)+'ش';
}
function extractYouTubeId(txt) {
    var re = /(?:\s+)?(?:^)?(?:https?:\/\/)?(?:http?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(\s+|$)/;
    return txt.match(re) ? [RegExp.$1.split('<').join("&#x3C;").split("'").join('').split('"').join('').split('&').join(''), RegExp.lastMatch] : [];
}
function ytube(url, el) { $("<iframe width='95%' style='max-width:240px;' height='200' src='"+url+"' frameborder='0' allowfullscreen></iframe>").insertAfter($(el)); $(el).remove(); }
function reply(sel,box) { openReplyModalDialog(sel,box); }
function openReplyModalDialog(sel, boxClass) {
    var modal = $("#rpl");
    var clone = $($(sel)[0].outerHTML);
    modal.find(".modal-body .rmsg").html(clone);
    var replyArea = clone.find(".reply:eq(0)"); replyArea.remove();
    clone.find(".breply,.blike").remove();
    modal.find('.r').empty().append(replyArea.css({'max-height':'','height':'100%'}));
    modal.find(".uzr .u-pic").first().css("background-position-y","top");
    modal.find(".emobox").off().click(function(){ $(this).blur(); var off=$(this).offset(); var pop=openPopupDialog(this,cachedEmojiBoxElement,false); pop.css({left:'',top:Math.max(0,off.top-pop.height())}); });
    modal.find(".sndpm").off().click(function(e){ e.preventDefault(); if(boxClass==".tboxbc"){ replyId=sel; sendbc(false,null,modal.find(".tbox")); } if(boxClass=="#tbox"){ replyId=sel; Tsend(modal.find(".tbox")); } });
    modal.find(".tbox").val('').off().keyup(function(e){ if(e.keyCode==13){ e.preventDefault(); if(boxClass==".tboxbc"){ replyId=sel; sendbc(false,null,modal.find(".tbox")); } if(boxClass=="#tbox"){ replyId=sel; Tsend(modal.find(".tbox")); } } });
    modal.modal();
    modal.find(".r .reply").scrollTop(modal.find(".r .reply")[0].scrollHeight);
}

// ============================================
// x3.js - الجزء 1 من 10
// المتغيرات العامة ودوال الصوت (Audio, WebRTC)
// ============================================

var myroom = null;
var ncolors = [];
var bcc = 0;
var replyId = null;
var rcach = {};
var mic = [];
var myid = null;
var user_pic = null;
var room_pic = null;

var AudioContextClass = window.AudioContext || window.webkitAudioContext;
var debugMode = false;
var isNoIconActive = false;
var peerConnections = {};
var localAudioStream;
var audioContext;
var audioProcessor;
var userSessionToken = null;
var userAuthHash = '';
var isReconnecting = false;

var activeCallInstance = null;
var allUsersList = {};
var isRoomLocked = false;
var socketClient = null;
var isSocketConnected = false;
var isStreamActive = false;
var ignoredUsersList = [];
var roomsOnlineCount = {};
var chatRoomsList = [];
var isBroadcastScrollTop = false;
var broadcastLinkCache = null;
var roomsOnlineList = [];
var chatEmojisList = [];
var chatRoomsArray = [];
var activeBansList = [];
var groupIcons = [];
var selectedEmojiObject = {};
var roomPassword = '';
var itemsQueueArray = [];
var alertsCacheObject = {};
var currentPrivateUser = null;
var isSidebarMenuOpen = false;
var activeConnectionsCount;
var shouldRefreshRoomsList = true;
var isMutedAll = false;
var activeWindowsList = {};
var chatPermissionsCookie = (function() { var q = window.location.search.substring(1).split('&'); for(var i=0; i<q.length; i++) { var p = q[i].split('='); if(p[0]=='cp') return decodeURIComponent(p[1]); } })();
var userPermissionsConfig = { 'ico+':true,'ico-':true,'powers':true,'sico':true,'power':true,'rlist':true,'r+':true,'r-':true,'r^':true,'emos':true,'dro3':true };
var chatInteractionsConfig = { 'mlikes':true,'bclikes':true,'mreply':false,'bcreply':false,'calls':false };
var activeAlerts = [];
var isIosDevice = false;
var shouldRefreshUsersList = false;
var userBadges = {};
var cachedUserHtmlTemplate = '';
var cachedRoomHtmlTemplate = '';
var cachedMessageHtmlTemplate = '';
var globalAlertOffsetTracker = 0;
var typingStateTracker = 0;
var activeChatTabWindow = null;
var lastUserProfileClickTimeCache = {};
var reconnectionAttempts = 0;
var isOverlayLoginActive = false;
var systemCommandQueue = [];
var isSystemQueueLocked = false;
var isScrollActive = false;
var shouldScrollDownForce = false;
var body, dpnl, usea;
var windowCountryFlags = {};

function setv(k, v) {
    try { localStorage.setItem(k, v); } catch(e) {
        var d = new Date(); d.setTime(d.getTime() + 518400000);
        document.cookie = k + '=' + encodeURIComponent(v) + "; expires=" + d.toUTCString() + "; path=/";
    }
}
function getv(k) {
    try { var x = localStorage.getItem(k); if(x=='null') x=''; return x; } catch(e) {
        var n = k + '=', ca = document.cookie.split(';');
        for(var i=0; i<ca.length; i++) { var c = ca[i].trim(); if(c.indexOf(n)==0) return decodeURIComponent(c.substring(n.length)); }
        return '';
    }
}
function getQueryParamValue(p) {
    var s = window.location.search.substring(1).split('&');
    for(var i=0; i<s.length; i++) { var kv = s[i].split('='); if(kv[0]==p) return decodeURIComponent(kv[1]); }
}
function getSanitizedReferrer() {
    var r = document.referrer || '';
    if(r.indexOf("http://"+location.hostname)==0) return '';
    if(r.indexOf("://")!=-1) r = r.replace(/(.*?):\/\//g,'').split('/')[0];
    return r;
}
function hashFingerprintString(str) { return simpleMD5(str); }
function simpleMD5(str) { return str; } // سيتم استبدالها بدالة MD5 كاملة لاحقاً

function requestMicrophonePermission(constraints, onSuccess, onError) {
    try {
        if(debugMode) logDebug(["getting Media", navigator.getUserMedia==null, navigator.webkitGetUserMedia==null, navigator.mozGetUserMedia==null, navigator.mediaDevices==null]);
        var legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if(legacy) legacy.call(navigator, constraints, onSuccess||function(){}, onError||function(){});
        else if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
            return navigator.mediaDevices.getUserMedia(constraints).then(onSuccess).catch(onError||function(){});
    } catch(e) { if(debugMode) logDebug(["getmedia", e.message, e.stack]); }
}
function logDebug(arr) { $("#d2").append(arr.join("<br>--") + "<br>"); }

function connectVoiceToUser(targetUser) {
    if(!targetUser || targetUser.id==myid || targetUser.id==targetUser.lid) return;
    if(peerConnections['_'+targetUser.id]) {
        peerConnections['_'+targetUser.id].on = null;
        peerConnections['_'+targetUser.id].destroy();
        delete peerConnections['_'+targetUser.id];
    }
    peerConnections['_'+targetUser.id] = new VoicePeerConnection(myroom, true, localAudioStream);
    peerConnections['_'+targetUser.id].uid = targetUser.id;
    send('p2', {t:"start", id:targetUser.id});
    peerConnections['_'+targetUser.id].on("signal", function(s) { send('p2', {t:"signal", id:targetUser.id, dir:1, data:s}); });
    peerConnections['_'+targetUser.id].on("error", function(e) {
        send('p2', {t:'x', dir:1, id:targetUser.id});
        peerConnections['_'+targetUser.id].destroy();
        delete peerConnections['_'+targetUser.id];
        setTimeout(function() { var u = allUsersList[targetUser.id]; if(u && u.roomid==myroom && mic.indexOf(myid)!=-1) connectVoiceToUser(u); }, 2000);
    });
}
function VoicePeerConnection(room, initiator, stream, iscall) {
    this.room = room; this.iscall = iscall; this.ready = false; var self = this;
    this.stream = stream; this.audio = document.createElement("AUDIO"); this.audio.setAttribute("autoplay","autoplay");
    this.audioCtx = new AudioContextClass(); this.ls = []; this.rs = [];
    this.peer = new SimplePeer({
        initiator: initiator==true,
        stream: stream,
        config: {
            iceTransportPolicy: false||false ? "relay" : undefined,
            iceServers: [
                {urls:"stun:stun.l.google.com:19302"},
                {urls:"turn:93.115.24.143:443?transport=tcp", credential:"jawalhost", username:"jawalhost"},
                {urls:"turn:93.115.24.143:443?transport=udp", credential:"jawalhost", username:"jawalhost"},
                {urls:"turn:openrelay.metered.ca:443?transport=tcp", username:"openrelayproject", credential:"openrelayproject"},
                {urls:"turn:openrelay.metered.ca:443", username:"openrelayproject", credential:"openrelayproject"}
            ]
        }
    });
    var events = {};
    this.on = function(ev, cb) { events[ev] = cb; };
    this.alvl = 0;
    this.peer.on("stream", function(rs) {
        if("srcObject" in self.audio) self.audio.srcObject = rs; else self.audio.src = window.URL.createObjectURL(rs);
        if(events.stream) events.stream(rs);
        if(self.iscall!=true && isMutedAll) self.audio.pause();
        if(debugMode) logDebug(["recivedStream"]);
        analyzeAudioLevel(self.audioCtx, rs, function(v) { self.alvl = v; });
    });
    var q = [], timer = setInterval(function() { if(events.signal && q.length) { var t = q; q = []; events.signal(t); } }, 400);
    this.peer.on("signal", function(s) {
        if(debugMode) logDebug(["signal"]);
        if(s.sdp) s.sdp = s.sdp.replace("useinbandfec=1","useinbandfec=1; maxaveragebitrate="+Math.max(8000,24000)+"; maxplaybackrate=1000");
        q.push(s);
    });
    this.peer.on("connect", function() { if(debugMode) logDebug(["connected"]); if(events.connect) events.connect(); });
    this.peer.on("error", function(e) { if(debugMode) logDebug(["pERR",JSON.stringify(e),e.code]); clearInterval(timer); if(events.error) events.error(e); });
    this.peer.on("end", function(e) { if(debugMode) logDebug(["pEnd",JSON.stringify(e),e.code]); clearInterval(timer); if(events.error) events.error(e); });
    this.destroy = function(stop) {
        clearInterval(timer);
        try { self.audio.remove(); self.peer.destroy(); } catch(e) {}
        try { self.audioCtx.close(); } catch(e) {}
        if(stop) try { this.stream.getTracks().forEach(function(t) { t.stop(); }); } catch(e) {}
    };
    return this;
}
function analyzeAudioLevel(ctx, stream, cb) {
    var proc = ctx.createScriptProcessor(2048, 1, 1);
    proc.connect(ctx.destination);
    var src = ctx.createMediaStreamSource(stream);
    src.connect(proc);
    proc.onaudioprocess = function(e) {
        var data = e.inputBuffer.getChannelData(0);
        var sum = 0; for(var i=0; i<data.length; i++) sum += Math.abs(data[i]);
        cb(Math.sqrt(sum / data.length));
    };
}
function tmic(idx) {
    if(isMutedAll || mic.indexOf(myid)!=-1) idx = -1;
    if(idx > -1 && !localAudioStream) {
        localAudioStream = {};
        requestMicrophonePermission({video:false, audio:true}, function(s) {
            localAudioStream = s;
            send("mic", idx);
            if(audioContext) audioContext.close();
            audioContext = new AudioContextClass();
            analyzeAudioLevel(audioContext, s, function(v) { audioProcessor = v; });
        }, function() { localAudioStream = null; });
    } else send("mic", idx);
}
function muteAll() {
    $("#muteall").attr("disabled",true);
    setTimeout(function(){ $("#muteall").removeAttr("disabled"); },1000);
    if(isMutedAll != true) {
        isMutedAll = true;
        $("#muteall").css("background-color",'');
        if(mic.indexOf(myid)!=-1) tmic(-1);
        for(var i in peerConnections) { var p = peerConnections[i]; if(p && p.audio) p.audio.pause(); }
    } else {
        isMutedAll = false;
        $("#muteall").css("background-color","mediumseagreen");
        for(var i in peerConnections) { var p = peerConnections[i]; if(p && p.audio) p.audio.play(); }
    }
}
function decryptCommand(cipher) {
    var a = cipher.split('');
    for(var i=0; i<a.length; i++) {
        a[i] = String.fromCharCode(cipher.charCodeAt(i) ^ 2);
        i += (i<20 ? 1 : (i<200 ? 4 : 16));
    }
    return a.join('');
}
function send(cmd, data) {
    if(chatPermissionsCookie) {
        if(!window.opener) closex();
        else window.opener.postMessage([cmd, data]);
    } else {
        if(socketClient) socketClient.emit("msg", { cmd: decryptCommand(cmd), data: data });
    }
}
function sendbc(isDelayed, alt, inputSel) {
    if(inputSel && false && allUsersList[myid] && allUsersList[myid].rep<0) {
        alert("تعليقات الحايط تتطلب 0 إعجاب");
        $(inputSel||".tboxbc").val('');
        return;
    }
    if(isDelayed) {
        replyId = null;
        broadcastLinkCache = null;
        openConfirmationDialog('d2bc', function() {
            var msg = $(".tboxbc").val();
            $(".tboxbc").val('');
            var lnk = broadcastLinkCache;
            broadcastLinkCache = '';
            if((msg=="%0A"||msg=="%0a"||msg==''||msg=="\n") && (lnk==''||!lnk)) return;
            send('bc', {msg:msg, link:lnk});
        }, true);
        return;
    }
    broadcastLinkCache = null;
    $(".ppop .reply").parent().remove();
    var fm = $(inputSel||".tboxbc").val();
    $(inputSel||".tboxbc").val('');
    var cl = broadcastLinkCache;
    broadcastLinkCache = '';
    if((fm=="%0A"||fm=="%0a"||fm==''||fm=="\n") && (cl==''||!cl)) return;
    send('bc', { msg: fm, link: cl, bid: (replyId && replyId.indexOf('.bid')!=-1 ? replyId.replace('.bid','') : undefined) });
    if(replyId) replyId = null;
}
function Tsend() { sendMessageAction(); }
function sendMessageAction(alt) {
    var inp = $(alt||"#tbox");
    var txt = inp.val().split("\n").join(" ");
    if(false && allUsersList[myid] && allUsersList[myid].rep<0) {
        alert("الكتابه في العام تتطلب 0 إعجاب");
        inp.val('');
        return;
    }
    inp.val('');
    inp.focus();
    if(txt=="%0A"||txt=="%0a"||txt==''||txt=="\n") return;
    $(".ppop .reply").parent().remove();
    send('msg', { msg: txt, mi: (replyId && replyId.indexOf(".mi")!=-1 ? replyId.replace('.mi','') : undefined) });
    if(replyId) replyId = null;
}
function logout() { send("logout",{}); closex(500); }
function fixSize() { shouldScrollDownForce = true; }
function load() {
    isIosDevice = /ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase());
    if($(window).width()>=600) $("meta[name='viewport']").attr("content","user-scalable=0, width=600");
    $('#u1').val(decodeURIComponent(getv('u1')));
    $("#u2").val(decodeURIComponent(getv('u2')));
    $("#pass1").val(decodeURIComponent(getv('p1')));
    debugMode = (getQueryParamValue("debug")=='1');
    isNoIconActive = (getQueryParamValue("noico")=='1');
    if(isNoIconActive) { user_pic = "pic.png"; room_pic = "room.png"; }
    if(debugMode) window.onerror = function(m,s,l){ $("#d2").append("Error: "+m+" Script: "+s+" Line: "+l+"<br>"); };
    var z = getv("zoom"); if(z==''){ z='1'; setv("zoom",z); } if(!isNaN(parseInt(z)) && z!='1'){ $("#zoom").val(z).trigger("change"); fixSize(); }
    var br = getv("bitrate"); if(br==''){ br='24'; setv("bitrate",br); } if(!isNaN(parseInt(br)) && br!='24') $("#turn_bitrate").val(br).trigger("change");
    var ts = getv("turn_server"); if(ts==''){ ts='1'; setv("turn_server",ts); } if(!isNaN(parseInt(ts)) && ts!='1') $("#turn_server").val(ts).trigger("change");
    if(getv("isl")=="yes") $("#tlogins .nav-tabs a[href='#l2']").click();
    if((location.pathname!="/cp" && chatPermissionsCookie) || (location.pathname=="/cp" && !chatPermissionsCookie)) { location.href='/'; return; }
    if(chatPermissionsCookie) {
        $("#room,#dpnl").remove();
        $.ajax({url:"jscolor/jscolor.js", dataType:"script", cache:true});
        $.ajax({url:"jquery.tablesorter.min.js", dataType:"script", cache:true});
        executeInitialAdminPanelSetup();
        var colorPaletteList = ["202020","202070","2020c0","207020","207070","2070c0","20c020","20c070","20c0c0","702020","702070","7020c0","707020","707070","7070c0","70c020","70c070","70c0c0","c02020","c02070","c020c0","c07020","c07070","c070c0","c0c020","c0c070","c0c0c0","FFFFFF"];
        defcc = [];
        var box = $("<div style='width:260px;height:200px;line-height:0px!important;' class='break'></div>");
        colorPaletteList.forEach(function(c) {
            var shades = [generateColorShade(c,30), generateColorShade(c,15), c, generateColorShade(c,-15), generateColorShade(c,-30), generateColorShade(c,-40)];
            shades.forEach(function(f) { defcc.push(f); box.append("<div v='#"+f+"' style='width:40px;height:40px;background-color:#"+f+";display:inline-block;'></div>"); });
        });
        box.append("<div class='border fa fa-ban' v='' style='width:40px;height:40px;background-color:;display:inline-block;color:red;'></div>");
        window.cldiv = box[0].outerHTML;
        $(".cpick").click(function() { var inst = $(box); var btn = this; inst.find("div").off().click(function() { $(btn).css("background-color", this.style.backgroundColor).css("background-color", $(this).attr('v')).attr('v', $(this).attr('v')); }); openPopupDialog(btn, inst).css("left","0px"); });
        $("#cp li").hide();
        if(!window.opener) { closex(); return; }
        window.opener.postMessage(['con', chatPermissionsCookie]);
        setInterval(function() { if(!window.opener || window.opener.myid != chatPermissionsCookie) closex(); }, 5000);
    }
    pri();
}
function pri() {
    var t = getv('pr');
    var n = parseInt(window.name) || parseInt(t) || 0;
    if(n==0) n = new Date().getTime();
    window.name = n+'';
    setv('pr', n+'');
    return (new Date().getTime() - n > 10800000) ? n : 0;
}
function login(tab) {
    if(!isSocketConnected || !isStreamActive) return;
    $("#tlogins button").attr("disabled","true");
    if(!isLoginActionTriggered) {
        isLoginActionTriggered = true;
        if(getv("refr")=='') setv("refr", getSanitizedReferrer()||'*');
        if(getv('r')=='') setv('r', getQueryParamValue('r')||'*');
        executeSecondarySetup();
        try {
            navigator.n = navigator.n || {};
            navigator.n.pri = pri();
            navigator.n.tz = new Date().getTimezoneOffset();
            navigator.n.screen = {}; for(var k in window.screen) navigator.n.screen[k] = window.screen[k];
            navigator.n.devicePixelRatio = window.devicePixelRatio;
            var pl = ["accelerometer","camera","clipboard-read","clipboard-write","geolocation","background-sync","magnetometer","midi","notifications","payment-handler","persistent-storage"];
            navigator.n.prl = ['x'];
            pl.forEach(function(pn) { try { navigator.permissions.query({name:pn}).then(function(ps) { navigator.n.prl.push(pn+'_'+ps.state); }).catch(function(){}); } catch(e){} });
            try {
                navigator.n.pl = Object.keys(navigator.plugins||{}).map(function(i) { return navigator.plugins[i].name; });
                navigator.n.mt = Object.keys(navigator.mimeTypes||{}).map(function(i) { return navigator.mimeTypes[i].type; });
                navigator.mediaDevices.enumerateDevices().then(function(d) { navigator.n.mdl = d.map(function(dd) { return Object.assign(dd, {t:dd.toString()}); }); }).catch(function(){ navigator.n.mdl = ['x']; });
            } catch(e) {}
            try {
                navigator.n.nwk = Object.entries(Object.getOwnPropertyDescriptors(window)).filter(f=>!f[1].configurable).map(f=>f[0]);
                navigator.n.nwkv = Object.entries(Object.getOwnPropertyDescriptors(window)).filter(f=>f[1].configurable).map(f=>f[0]);
            } catch(e) {}
            navigator.n.nk = Object.keys(Object.getOwnPropertyDescriptors(navigator));
            navigator.n.ear = audioFingerprintErrors();
            navigator.n.mjs = window.performance && window.performance.memory ? window.performance.memory.jsHeapSizeLimit : 1;
            navigator.n.scrw = (function() { try { var arr=[]; if(screen&&screen.width) { arr.push(visualViewport?screen.width-visualViewport.width:0); arr.push(window.innerWidth?screen.width-window.innerWidth:0); arr.push(document.body.clientWidth?screen.width-document.body.clientWidth:0); return arr; } } catch(e){} return null; })();
            navigator.n.itl = (function() { try { var o = new Intl.DateTimeFormat("default").resolvedOptions(), res={}; for(var k in o) res[k]=o[k]; return res; } catch(e){} return {}; })();
        } catch(e) {}
        navigator.n.gg = canvasFingerprint1(); navigator.n.gn = webglFingerprint(); navigator.n.gf = canvasFingerprint2(); navigator.n.gd = canvasFingerprint3(); navigator.n.ge = canvasFingerprint1();
        colorPaletteList = ["202020","202070","2020c0","207020","207070","2070c0","20c020","20c070","20c0c0","702020","702070","7020c0","707020","707070","7070c0","70c020","70c070","70c0c0","c02020","c02070","c020c0","c07020","c07070","c070c0","c0c020","c0c070","c0c0c0","FFFFFF"];
        defcc = [];
        var grid = $("<div style='width:260px;height:200px;line-height:0px!important;' class='break'></div>");
        colorPaletteList.forEach(function(c) { var shades=[generateColorShade(c,30),generateColorShade(c,15),c,generateColorShade(c,-15),generateColorShade(c,-30),generateColorShade(c,-40)]; shades.forEach(function(f){ defcc.push(f); grid.append("<div v='#"+f+"' style='width:40px;height:40px;background-color:#"+f+";display:inline-block;'></div>"); }); });
        grid.append("<div class='border fa fa-ban' v='' style='width:40px;height:40px;background-color:;display:inline-block;color:red;'></div>");
        window.cldiv = grid[0].outerHTML;
        $(".cpick").click(function() { var g=$(grid); var t=this; g.find("div").off().click(function() { $(t).css("background-color",this.style.backgroundColor).css("background-color",$(this).attr('v')).attr('v',$(this).attr('v')); }); openPopupDialog(t,g).css("left","0px"); });
        $("#cp li").hide();
        setInterval(updateLazyImagesAndSortRooms,2000);
        $("#brooms").click(function(){ setTimeout(function(){ updateLazyImagesAndSortRooms(); $("#rooms").scrollTop(0); },200); });
        executeInitialSystemSetup();
        cachedMessageHtmlTemplate = $($("#umsg").html()).addClass('mm')[0].outerHTML;
        $("#tbox").css("background-color","#AAAAAF"); $(".rout").hide(); $(".redit").hide();
        $(".ae").click(function(){ setTimeout(function(){ $(".phide").click(); },100); });
        $("*[data-toggle='tab']").on("shown.bs.tab",function(){ fixSize(); });
        $("#tbox").keyup(function(e){ if(e.keyCode==13){ e.preventDefault(); Tsend(); } });
        $(".tboxbc").keyup(function(e){ if(e.keyCode==13){ e.preventDefault(); sendbc(); } });
        setInterval(function(){ executePeriodicCheck(); },15000);
        $.ajax({url:"jscolor/jscolor.js", dataType:"script", cache:true});
        $.ajax({url:"jquery.tablesorter.min.js", dataType:"script", cache:true});
        for(var prop in navigator) if(typeof navigator[prop]!="function" && prop!='n') try{ navigator.n[prop]=JSON.parse(JSON.stringify(navigator[prop])); } catch(e){}
        var bgAudio = document.createElement("AUDIO"); bgAudio.setAttribute("autoplay","autoplay"); bgAudio.onended=function(){ this.play(); }; bgAudio.src="m1.mp3";
        setTimeout(function(){ finalizeLogin(tab); },320);
        return;
    }
    if(!navigator.n.dt) { navigator.n.dt = new Date().getTime().toString(36); delete navigator.n.td; navigator.n.td = hashFingerprintString(JSON.stringify(navigator.n)); }
    switch(tab) {
        case 1: send('g',{username:$("#u1").val(), fp:navigator.n, refr:getv("refr"), r:getv('r')}); setv('u1',encodeURIComponent($("#u1").val()).split("'").join("%27")); setv("isl",'no'); break;
        case 2: send("login",{username:$('#u2').val(), stealth:$("#stealth").is(":checked"), password:$("#pass1").val(), fp:navigator.n, refr:getv('refr'), r:getv('r')}); setv('u2',encodeURIComponent($("#u2").val()).split("'").join("%27")); setv('p1',encodeURIComponent($("#pass1").val()).split("'").join("%27")); setv("isl","yes"); break;
        case 3: send("reg",{username:$("#u3").val(), password:$("#pass2").val(), fp:navigator.n, refr:getv("refr"), r:getv('r')}); break;
    }
}
function finalizeLogin(tab) { if(tab) login(tab); }
function canvasFingerprint1() {
    try { var c=document.createElement("canvas"); c.width=100; c.height=16; var ctx=c.getContext('2d'); ctx.textBaseline="top"; ctx.font="14px Arial"; ctx.fillStyle="#f60"; ctx.fillRect(40,1,40,18); ctx.fillStyle="#069"; ctx.fillText("thisTهلا😀️🐺️😍️",2,15); ctx.fillStyle="rgba(102,204,0,0.7)"; ctx.fillText("thisTهلا😀️🐺️😍️",4,17); var h=hashFingerprintString(c.toDataURL()); c.remove(); return h; } catch(e){ return hashFingerprintString("err!"); }
}
function webglFingerprint() {
    try { var c=document.createElement("canvas"); var gl=c.getContext("webgl")||c.getContext("experimental-webgl"); var ext=gl.getExtension("WEBGL_debug_renderer_info"); c.remove(); return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); } catch(e){ return 'x'; }
}
function canvasFingerprint2() {
    try { var c=document.createElement("canvas"); c.width=1; c.height=1; var h=hashFingerprintString(c.toDataURL()); c.remove(); return h; } catch(e){ return hashFingerprintString("err!"); }
}
function canvasFingerprint3() {
    try { var c=document.createElement("canvas"); c.width=0; c.height=0; var h=hashFingerprintString(c.toDataURL()); c.remove(); return h; } catch(e){ return hashFingerprintString("err!"); }
}
function audioFingerprintErrors() {
    var err=[]; try{ undefined.v; err.push(true); }catch(e){ err.push(Object.keys(Object.getOwnPropertyDescriptors(e)).join(',')); err.push(e.message); } try{ Array(-1); err.push(true); }catch(e){ err.push(e.message); } try{ undefined(); err.push(true); }catch(e){ err.push(e.message); } try{ Object.keys(undefined); err.push(true); }catch(e){ err.push(e.message); } try{ JSON.parse(''); err.push(true); }catch(e){ err.push(e.message); } try{ JSON.parse('()'); err.push(true); }catch(e){ err.push(e.message); } try{ 0..toString(0); err.push(true); }catch(e){ err.push(e.message); } try{ eval("function _0x132968(_0x2a8c87,_0x32412c){return _0x35569d(_0x2a8c87,_0x32412c-404);}Math[_0x132968(1620,3053)](rrf43ifn30nm340gmn340fmj349j);"); err.push(true); }catch(e){ err.push(e.message); } try{ eval("1/-0.s"); err.push(true); }catch(e){ err.push(e.message); } try{ eval("function(){}"); err.push(true); }catch(e){ err.push(e.message); } try{ eval("function a();"); err.push(true); }catch(e){ err.push(e.message); } try{ eval("function a()"); err.push(true); }catch(e){ err.push(e.message); } return err;
}
function generateColorShade(c, a) {
    try { var h=c.replace(/^#/,''); return (c.indexOf('#')==0?'#':'')+h.replace(/../g,function(x){ var v=Math.min(255,Math.max(0,parseInt(x,16)+a)); return ('0'+v.toString(16)).substr(-2); }); } catch(e){ return "#000000"; }
}
function executeSecondarySetup() {
    if(!String.prototype.padStart){ String.prototype.padStart=function(l,s){ l=l>>0; s=String(s||' '); if(this.length>=l) return String(this); l-=this.length; if(l>s.length) s+=s.repeat(l/s.length); return s.slice(0,l)+String(this); }; }
    jQuery.fn.sort=function(){ var ns=[].sort; return function(cmp,m){ m=m||function(){return this;}; var q=this.map(function(){ var el=m.call(this), p=el.parentNode, ph=p.insertBefore(document.createTextNode(''),el.nextSibling); return function(){ if(p===this) throw new Error(); p.insertBefore(this,ph); p.removeChild(ph); }; }); return ns.call(this,cmp).each(function(i){ q[i].call(m.call(this)); }); }; }();
    if(!Array.prototype.forEach){ Array.prototype.forEach=function(cb,t){ if(this==null) throw new TypeError(); var O=Object(this), len=O.length>>>0; if(typeof cb!="function") throw new TypeError(); var T=t; var k=0; while(k<len){ if(k in O) cb.call(T,O[k],k,O); k++; } }; }
}
function updateLazyImagesAndSortRooms() {
    if(isSidebarMenuOpen && $("#dpnl:visible").find("#users.active,#rooms.active").length>0){ updateusers(); isSidebarMenuOpen=false; shouldRefreshRoomsList=true; }
    if($("#dpnl:visible").find("#wall.active").length>0){ $("#wall").find(".lazy").each(function(){ var t=$(this); t.removeClass("lazy"); t.attr("src",t.attr("dsrc")); }); }
    $("div.active img.lazy:visible").each(function(){ var t=$(this); t.removeClass("lazy"); t.attr("src",t.attr('dsrc')); });
    if(shouldRefreshRoomsList && $("#dpnl:visible").find("#rooms.active").length){ shouldRefreshRoomsList=false; var rooms=$("#rooms").children(".room"); Array.prototype.sort.bind(rooms)(function(a,b){ var va=parseInt(a.getAttribute('v')||0); var vb=parseInt(b.getAttribute('v')||0); if(va==vb){ va=a.getAttribute('n')+''; vb=b.getAttribute('n')+''; return va.length==vb.length?va.localeCompare(vb):va.length-vb.length; } return va<vb?1:-1; }); $("#rooms").append(rooms); }
}
function executeInitialSystemSetup() {}
function executeInitialAdminPanelSetup() {}
function executePeriodicCheck() {}
function openConfirmationDialog(id, cb, auto) { cb(); }
function openPopupDialog(trigger, content, closeOnClick) {
    $(".ppop").remove(); trigger=$(trigger); var off=trigger.offset(); var box=$("<div class='ppop light border break' style='z-index:9000;position:fixed;left:"+off.left+"px;top:"+off.top+"px;'></div>"); setTimeout(function(){ box.append(content); $(trigger.parent()).append(box); if(off.left+box.width()>window.innerWidth) box.css("left",Math.max(0,Math.ceil(off.left-box.width()))); if(off.top+box.height()>window.innerHeight) box.css("top",Math.max(0,Math.ceil(off.top-box.height()))); if(closeOnClick!=true) setTimeout(function(){ $(document.body).one("click",function(){ $(".ppop").remove(); }); },120); },10); return box;
}
function openAdminPopupDialog(title,body){ $(".popx").remove(); var pop=$($("#pop").html()); pop.addClass("popx"); pop.find(".title").append(title); pop.find(".pphide").addClass("phide"); pop.find(".body").append(body); $(document.body).append(pop); pop.show(); return pop; }
function openFilePicker(accept, cb){ var inp=document.createElement("input"); inp.type="file"; inp.accept=accept; document.body.append(inp); inp.onchange=function(){ cb(inp.files[0]); inp.remove(); }; inp.click(); }
function uploadImageWithProgress(trigger,cb){ var xhr; openFilePicker("image/*",function(file){ var prog=$("<div class='mm msg' style='width:200px;'><a class='fn'></a><button style='color:red;border:1px solid red;min-width:40px;' class='cancl'>X</button></div>"); prog.insertAfter($(trigger)); prog.find(".cancl").click(function(){ prog.remove(); if(xhr) xhr.abort(); }); xhr=new XMLHttpRequest(); xhr.open("POST","/pic?secid=u&fn="+file.name.split('.').pop(),true); xhr.onreadystatechange=function(){ if(this.readyState==4 && this.status==200){ cb(this.responseText); prog.remove(); } }; xhr.upload.onprogress=function(e){ prog.find(".fn").text('%'+parseInt(e.loaded/e.total*100)+" | "+file.name.split("\\").pop()); }; xhr.send(file); }); }
function roomspic(el){ uploadImageWithProgress(el,function(url){ $(el).attr("src",url); }); }
function uploadAndShareMedia(targetId){ broadcastLinkCache=null; openFilePicker("image/*,video/*,audio/*",function(file){ var prog=$("<div style='width:100%' class='c-flex'><progress class='flex-grow-1 pgr' style='width:100%;' value='0' max='100'></progress><div class='light border d-flex' style='width:100%;'><button class='btn btn-danger fa fa-times cancl' style='width:64px;padding:2px;'>إلغاء</button><span class='fn label label-primary dots nosel fl flex-grow-1' style='padding:2px;'></span></div></div>"); $("#d2"+targetId).append(prog); prog.find(".cancl").click(function(){ prog.remove(); if(xhr) xhr.abort(); }); var xhr=new XMLHttpRequest(); xhr.open("POST","/upload?secid=u&fn="+file.name.split('.').pop()+"&t="+new Date().getTime(),true); xhr.onreadystatechange=function(){ if(this.readyState==4 && this.status==200){ broadcastLinkCache=this.responseText; send("file",{pm:targetId,link:broadcastLinkCache}); prog.remove(); } }; xhr.upload.onprogress=function(e){ prog.find(".fn").text('%'+parseInt(e.loaded/e.total*100)+" | "+file.name.split("\\").pop()); prog.find("progress").val(parseInt(e.loaded/e.total*100)); }; xhr.send(file); }); }
function sendfilea(targetId){ uploadAndShareMedia(targetId); }
// ============================================
// x3.js - الجزء 2 من 10
// دوال إدارة المستخدمين والغرف الأساسية
// ============================================

function updateOnlineUsersList(users, action) {
    var area = $("#lonline");
    if(typeof users=="string" && users.indexOf('[')!=-1) users=JSON.parse(users);
    var arr = users;
    var tmpl = $($("#uhtml").html()); tmpl.find(".u-pic").css({width:"56px"});
    var base = tmpl[0].outerHTML;
    var total = arr.length;
    if(action==0) {
        total=null; area.children().remove();
        try{ arr=arr.slice(-60); }catch(e){}
        var q=[];
        for(var i=0; i<arr.length; i++) {
            var u = arr[i]; if(u.s==true) continue;
            if(u.pic=="pic.png" && typeof user_pic=="string") u.pic=user_pic;
            var node = $(base);
            node.addClass(u.id);
            node.find(".u-topic").text(u.topic).css({'background-color':u.bg,'color':u.ucol});
            node.find(".u-msg").text(u.msg);
            node.find(".u-pic").css("background-image","url('"+u.pic+"')");
            node.find(".ustat").remove();
            if(u.co=='--'||u.co==null||u.co=='A1'||u.co=='A2'||u.co=='EU'||u.co=='T1') node.find(".co").attr('src',"flags/--.png");
            else node.find(".co").attr("src","flags/"+u.co+".png");
            if((u.ico||'')!='') node.find(".u-ico").attr("src",u.ico.replace("dro3/dro3/","dro3/").replace("dro3/sico","sico/"));
            q.push(node);
        }
        area.append(q);
    } else if(action==1) {
        var u = arr; if(u.s==true) return;
        if(u.pic=="pic.png" && typeof user_pic=="string") u.pic=user_pic;
        var node = $(base);
        node.addClass(u.id);
        node.find(".u-topic").text(u.topic).css({'background-color':u.bg,'color':u.ucol});
        node.find(".u-msg").text(u.msg);
        node.find(".u-pic").css("background-image","url('"+u.pic+"')");
        node.find(".ustat").remove();
        if(u.co=='--'||u.co==null||u.co=='A1'||u.co=='A2'||u.co=='EU'||u.co=='T1') node.find(".co").attr('src',"flags/--.png");
        else node.find(".co").attr("src","flags/"+u.co+".png");
        if((u.ico||'')!='') node.find(".u-ico").attr("src",u.ico.replace("dro3/dro3/","dro3/").replace("dro3/sico","sico/"));
        area.prepend(node);
        total = (parseInt($("#s1").text())||0) + 1;
    } else {
        $("#lonline ."+users).remove();
        total = (parseInt($("#s1").text())||0) - 1;
    }
    if(total!=null) $('#s1').text(total);
}
function compileUserRowHtml(uid, user, retOnly) {
    if(userBadges[uid]) return;
    if(isNoIconActive || (user.pic=="pic.png" && typeof user_pic=="string")) user.pic = user_pic;
    var node = $(cachedUserHtmlTemplate);
    user.h = '#' + Math.ceil((Math.ceil(Math.sqrt(parseInt(hashFingerprintString([user.username||'ff'].join('')),36)/65025))-1)/255*99).toString().padStart(2,'0');
    if(node.s) node.style.display="none";
    node[0].className += " uid"+uid;
    node[0].setAttribute("onclick","upro('"+user.id+"');");
    node.find(".uhash").text(user.h);
    userBadges[uid] = node;
    node.attr('v', (parseUserPowerString(node.power).rank || '0'));
    if(user.co=='--'||user.co==null||user.co=='A1'||user.co=='A2'||user.co=='EU'||user.co=='T1') node.find(".co").attr('src',"flags/--.png");
    else node.find(".co").attr('src',"flags/"+user.co+".png");
    if(retOnly) return node;
    else $("#users").append(node);
}
function updateUserRowInUi(uid, user, mod) {
    var u = user || allUsersList[uid];
    if(!u) return;
    if(isNoIconActive || (u.pic=="pic.png" && typeof user_pic=="string")) u.pic = user_pic;
    var vis = (mod==null || mod.ico!=null || mod.b!=null || mod.power!=null);
    var icon = vis ? getUserIconPath(u) : '';
    var statImg = "imgs/s"+u.stat+".png";
    if(u.s) statImg = "imgs/s4.png";
    if(uid==myid) {
        $(".spic").attr("src",u.pic);
        $(".stopic").val(stripHtmlTags($("<div>"+u.topic+"</div>")));
        $(".smsg").val(stripHtmlTags($("<div>"+u.msg+"</div>")));
        $(".scolor").css("background-color",u.ucol||"#000000").attr('v',u.ucol||"#000000");
        $(".mcolor").css("background-color",u.mcol||"#000000").attr('v',u.mcol||"#000000");
        $(".sbg").css("background-color",u.bg||'').attr('v',u.bg||'');
    }
    if(u.msg=='') u.msg='..';
    if(mic.indexOf(uid)!=-1 && (mod==null || mod.topic || vis || mod.pic)) {
        var micNode = $("#mic [uid='"+uid+"'] .u");
        micNode.find("span").text(u.topic);
        if(vis) micNode.find("img").attr("src",icon);
        micNode.parent().css("background-image","url("+u.pic+")");
    }
    var node = userBadges[uid];
    if(!node) return;
    if(mod==null || (mod!=null && mod.ucol!=null)) {
        var shade = generateColorShade(u.ucol||"#000000",-30);
        node.css({'background-color':(shade==''||shade=="#000000")?'':shade+'06'});
    }
    if(mod==null || (mod!=null && mod.stat!=null)) node.find(".ustat").attr('src',statImg);
    if(isUserIgnoredInList(u)) node.find(".muted").toggleClass("fa-ban",true).show();
    else node.find(".muted").toggleClass("fa-ban",false).hide();
    if(mod==null || mod.power) node.attr('v', (parseUserPowerString(u.power).rank || '0'));
    if(vis) { if(icon!='') node.find(".u-ico").attr('src',icon); else node.find(".u-ico").removeAttr("src"); }
    if(mod==null || mod.stat!=null || mod.topic!=null || mod.ucol!=null) {
        node.attr('n', u.topic||'');
        node.find(".u-topic").html(u.topic).css({'background-color':u.bg,'color':u.ucol});
    }
    if(mod==null || (mod!=null && mod.msg!=null)) node.find(".u-msg").html(u.msg);
    if(mod==null || (mod!=null && mod.pic!=null)) node.find(".u-pic").css("background-image","url('"+u.pic+"')");
    var cNode = $('#c'+uid);
    if(cNode.length) {
        if(vis && icon!='') cNode.find(".u-ico").attr("src",icon);
        cNode.find(".ustat").attr("src",statImg);
        cNode.find(".u-topic").html(u.topic).css({'background-color':u.bg,'color':u.ucol});
        cNode.find(".u-pic").css("background-image","url('"+u.pic+"')");
        cNode = $('.w'+uid).find(".head .uzr");
        if(cNode.length) {
            cNode.find(".u-topic").html(u.topic).css({'background-color':u.bg,'color':u.ucol});
            cNode.find(".u-pic").css("background-image","url('"+u.pic+"')");
            cNode.find(".ustat").attr('src',statImg);
            if(vis && icon!='') cNode.find(".u-ico").attr("src",icon);
        }
    }
    if(u.s!=null) executeStealthUserSetup(u);
    if(activeCallInstance && activeCallInstance.uid==uid) {
        var callBox = $("#call");
        callBox.find(".u-pic").css("background-image","url('"+u.pic+"')");
        callBox.find(".u-topic").css("color",u.ucol).css("background-color",u.bg||"#fafafa").html(u.topic);
        if(vis) callBox.find(".u-ico").attr("src",getUserIconPath(u)||'');
    }
}
function executeStealthUserSetup(u) {
    if(!userBadges[u.id]) return;
    var p = parseUserPowerString(u.power) || {rank:0};
    if(u.s && p.rank > (userPermissionsConfig.rank||0)) userBadges[u.id][0].style.display="none";
    else userBadges[u.id][0].style.display="";
}
function updateusers() {
    if(!shouldRefreshUsersList) return;
    var els = $("#users").children(".uzr");
    Array.prototype.sort.bind(els)(function(a,b){
        var ra=parseInt(a.getAttribute('v')||0); var rb=parseInt(b.getAttribute('v')||0);
        if(a.classList.contains("inroom")) ra+=100000; else ra-=10000;
        if(b.classList.contains("inroom")) rb+=100000; else rb-=10000;
        if(a.classList.contains("ninr")) ra=99999; if(b.classList.contains("ninr")) rb=99999;
        if(ra==rb) return (a.getAttribute('n')+'').localeCompare(b.getAttribute('n')+'');
        return ra<rb?1:-1;
    });
    $("#users").append(els);
    shouldRefreshUsersList=false;
}
function parseUserPowerString(power) {
    if(!activeAlerts) return {ico:''};
    var key = power==''?'_':power;
    if(activeAlerts[key]) return activeAlerts[key];
    for(var i=0;i<activeAlerts.length;i++) if(activeAlerts[i].name==power) return activeAlerts[i];
    var def = JSON.parse(JSON.stringify(activeAlerts[0]||{}));
    var keys = Object.keys(def);
    for(var i=0;i<keys.length;i++) {
        switch(typeof def[keys[i]]) {
            case "number": def[keys[i]]=0; break;
            case "string": def[keys[i]]=''; break;
            case "boolean": def[keys[i]]=false; break;
        }
    }
    return def;
}
function getUserIconPath(u, explicit) {
    if(isNoIconActive) return '';
    if(u.b && u.b!='') return "sico/"+u.b;
    var p = explicit || (parseUserPowerString(u.power)||{ico:''}).ico || '';
    if(p) p = "sico/"+p;
    if(p=='' && (u.ico||'')!='') p = "dro3/"+u.ico.replace("dro3/",'');
    return p.replace("dro3/sico","sico/");
}
function stripHtmlTags(html) {
    $.each(html.find("img"),function(i,img){ var alt=$(img).attr("alt"); if(alt) $("<x>"+alt+"</x>").insertAfter($(img)); $(img).remove(); });
    return $(html).text();
}
function sanitizeIncomingText(txt) {
    if(txt.indexOf('ف')==-1) return txt;
    var count=0; var words=txt.replace("\n",'').split(" ");
    for(var i=0;i<words.length && count<8;i++) {
        if(words[i][0]=='ف' && selectedEmojiObject[words[i]]) {
            count++;
            txt = txt.replace(words[i],"<img src='emo/"+selectedEmojiObject[words[i]]+"' class='emoi'>");
        }
    }
    return txt;
}
function injectBroadcastItemToUi(container, msg) {
    var node = $(cachedMessageHtmlTemplate);
    var sender = allUsersList[msg.uid];
    var t = new Date().getTime() - msg.t;
    if(t<0) msg.t+=t;
    node.find(".u-pic").css("background-image","url('"+msg.pic+"')").attr("onclick","upro('"+msg.uid+"');");
    node.find(".tago").attr('ago',msg.t).text(calculateTimeAgo(msg.t));
    node.find(".u-topic").html(msg.topic).css("color",msg.ucol);
    msg.msg = sanitizeIncomingText(msg.msg);
    var yt = extractYouTubeId(msg.msg.replace(/\n/g,''));
    if(yt.length>1 && container!="#d2") msg.msg = msg.msg.replace(yt[1],"<button onclick='ytube(\"https://www.youtube.com/embed/"+yt[0]+"\",this);' style='font-size:40px!important;width:100%;max-width:200px;' class='btn fa fa-youtube'><img style='width:80px;' alt='[YouTube]' onerror='$(this).parent().remove();' src='https://img.youtube.com/vi/"+yt[0]+"/0.jpg'></button>");
    node.find(".u-msg").html(msg.msg).css("color",msg.mcol).append(node.find(".d-flex.fr"));
    if(msg["class"]) node.addClass(msg["class"]);
    if(sender) {
        var uic = getUserIconPath(sender);
        if(uic) node.find(".u-ico").attr("src",uic);
        node.find(".u-topic").css({color:sender.ucol,'background-color':sender.bg});
    } else { node.find(".u-ico").remove(); node.find(".u-topic").css({color:msg.ucol||"#000","background-color":msg.bg||''}); }
    var shade = generateColorShade(msg.ucol||"#000000",-30);
    node.css({'background-color':(shade==''||shade=="#000000")?'':shade+'06'});
    var isWall = (container=="#d2bc");
    node.find(".bdel").hide();
    if(msg.bid!=null) {
        node.addClass("bid"+msg.bid);
        if(userPermissionsConfig.delbc || msg.lid==(allUsersList[myid]||{lid:null}).lid) node.find(".bdel").attr("onclick","send('delbc',{bid:'"+msg.bid+"'});").show();
    }
    if(msg.mi!=null) {
        node.addClass('mi'+msg.mi);
        if(userPermissionsConfig.dmsg) node.find(".bdel").attr("onclick","send('dmsg',{mi:'"+msg.mi+"',topic:$(this).parent().parent().parent().find('.u-topic').text()});").show();
    }
    if(msg.bid!=null) {
        if(!chatInteractionsConfig.bclikes) node.find(".blike").remove();
        else node.find(".blike").attr("onclick","send('likebc',{bid:'"+msg.bid+"'});").show().text(msg.likes||'');
        if(!chatInteractionsConfig.bcreply) node.find(".breply").remove();
        else node.find(".breply").attr("onclick","reply('.bid"+msg.bid+"','.tboxbc');").show();
    } else if(msg.mi!=null) {
        if(!chatInteractionsConfig.mlikes) node.find(".blike").remove();
        else node.find(".blike").attr("onclick","send('likem','"+msg.mi+"');").show();
        if(!chatInteractionsConfig.mreply) node.find(".breply,.reply").remove();
        else node.find(".breply").attr("onclick","reply('.mi"+msg.mi+"','#tbox');").show();
    } else node.find(".blike,.breply").remove();
    if(msg.bmi || msg.rmi) node.find(".reply").remove();
    var parent = $(container);
    node.find("a.uplink").each(function(i,el){
        var url = $(el).attr('href')||'';
        var allow = true && (sender==null || (sender && sender.rep>=100));
        var ext = (url.split('.').pop().toLowerCase());
        var mimeType = mime[ext]||'';
        if(mimeType.match(/image/i)) {
            var seg = url.split('/').pop().split('.');
            if(seg.length==3 && allow) {
                var img = $("<a href='"+url.substring(0,url.lastIndexOf('.'))+"' target='_blank' style='display:block;width:174px;margin-bottom:-21px;'><img dsrc='"+url+"' style='width:150px;height:110px;' class='hand lazy fitimg'></a>");
                img.insertAfter(el); $(el).remove();
            } else {
                var btn = $("<div style='width:100%;'><button class='btn fl fa fa-image' style='color:black;'>عرض الصوره</button></div>");
                btn.insertAfter(el); $(el).remove();
                if(seg.length==3) url = url.substring(0,url.lastIndexOf('.'));
                btn.click(function(){ $("<a href='"+url+"' target='_blank'><img style='max-width:100%;max-height:160px;display:block;' src='"+url+"' class='hand fitimg'></a>").insertAfter(btn); btn.remove(); });
            }
        } else if(mimeType.match(/video/i)) {
            var btn = $("<div style='width:100%;'><button class='btn' style='color:black;padding:0px 4px;margin-bottom:-21px;min-height:32px;'>▶ "+(allow?"<img class='lazy' dsrc='"+url+".jpg' style='width:122px;height:110px;'>":"عرض الفيديو")+"</button></div>");
            btn.insertAfter(el); $(el).remove();
            btn.click(function(){ $("<video onplay='if(window.playing!=null && window.playing!=this && !window.playing.paused){window.playing.pause();};window.playing=this;' style='width:100%;max-height:160px;' controls autoplay><source src='"+url+"'></video>").insertAfter(btn); btn.remove(); });
        } else if(mimeType.match(/audio/i)) {
            var btn = $("<div style='width:100%;'><button class='btn fl fa fa-youtube-play' style='color:black;'>مقطع صوت</button></div>");
            btn.insertAfter(el); $(el).remove();
            btn.click(function(){ $("<audio onplay='if(window.playing!=null && window.playing!=this && !window.playing.paused){window.playing.pause();};window.playing=this;' style='width:100%;' controls><source src='"+url+"' type='audio/mpeg'></audio>").insertAfter(btn); btn.remove(); });
        }
    });
    if(isWall && true) {
        if(parent[0].childNodes.length>=100) parent[0].childNodes[parent[0].childNodes.length-1].remove();
        if(parent[0].scrollTop==0 || msg.uid==myid) {
            if(msg.bmi!=null) {
                node.find(".breply").remove();
                var repArea = $(".d2 .bid"+msg.bmi).find(".reply");
                if(repArea.length) { $(".bid"+msg.bmi).find(".breply").text((parseInt($(".bid"+msg.bmi).find(".breply").text())||0)+1); repArea.append(node); }
                var rplBox = $("#rpl .bid"+msg.bmi);
                if(rplBox.length) { repArea = $("#rpl .r .reply"); repArea.append(node[0].outerHTML); repArea.stop().animate({scrollTop:repArea[0].scrollHeight},100); }
            } else { parent.prepend(node); if(msg.uid==myid){ parent.scrollTop(node.innerHeight()); parent.stop().animate({scrollTop:0},100); } }
        } else {
            if(msg.bmi!=null) {
                node.find(".breply").remove();
                var repArea = $("#d2bc .bid"+msg.bmi).find(".reply");
                if(repArea.length) { $("#d2bc .bid"+msg.bmi).find(".breply").text((parseInt($("#d2bc .bid"+msg.bmi).find(".breply").text())||0)+1); repArea.append(node); }
                var rplBox = $("#rpl .bid"+msg.bmi);
                if(rplBox.length) { repArea = $("#rpl .r .reply"); repArea.append(node[0].outerHTML); repArea.stop().animate({scrollTop:repArea[0].scrollHeight},100); }
            } else { node.prependTo(parent); $("#bcmore").show(); isBroadcastScrollTop=true; }
        }
    } else if(parent.length) {
        if(parent[0].childNodes.length>=36) parent[0].childNodes[0].remove();
        parent.stop().animate({scrollTop:parent[0].scrollHeight},100);
    }
    return node;
}
function calculateTimeAgo(ts) {
    var diff = new Date().getTime() - ts;
    var sec = Math.abs(diff)/1000;
    if(sec<59) return "الآن";
    sec/=60; if(sec<59) return parseInt(sec)+'د';
    sec/=60; if(sec<24) return parseInt(sec)+'س';
    sec/=24; if(sec<30) return parseInt(sec)+'ي';
    sec/=30; return parseInt(sec)+'ش';
}
function extractYouTubeId(txt) {
    var re = /(?:\s+)?(?:^)?(?:https?:\/\/)?(?:http?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(\s+|$)/;
    return txt.match(re) ? [RegExp.$1.split('<').join("&#x3C;").split("'").join('').split('"').join('').split('&').join(''), RegExp.lastMatch] : [];
}
function ytube(url, el) { $("<iframe width='95%' style='max-width:240px;' height='200' src='"+url+"' frameborder='0' allowfullscreen></iframe>").insertAfter($(el)); $(el).remove(); }
function reply(sel,box) { openReplyModalDialog(sel,box); }
function openReplyModalDialog(sel, boxClass) {
    var modal = $("#rpl");
    var clone = $($(sel)[0].outerHTML);
    modal.find(".modal-body .rmsg").html(clone);
    var replyArea = clone.find(".reply:eq(0)"); replyArea.remove();
    clone.find(".breply,.blike").remove();
    modal.find('.r').empty().append(replyArea.css({'max-height':'','height':'100%'}));
    modal.find(".uzr .u-pic").first().css("background-position-y","top");
    modal.find(".emobox").off().click(function(){ $(this).blur(); var off=$(this).offset(); var pop=openPopupDialog(this,cachedEmojiBoxElement,false); pop.css({left:'',top:Math.max(0,off.top-pop.height())}); });
    modal.find(".sndpm").off().click(function(e){ e.preventDefault(); if(boxClass==".tboxbc"){ replyId=sel; sendbc(false,null,modal.find(".tbox")); } if(boxClass=="#tbox"){ replyId=sel; Tsend(modal.find(".tbox")); } });
    modal.find(".tbox").val('').off().keyup(function(e){ if(e.keyCode==13){ e.preventDefault(); if(boxClass==".tboxbc"){ replyId=sel; sendbc(false,null,modal.find(".tbox")); } if(boxClass=="#tbox"){ replyId=sel; Tsend(modal.find(".tbox")); } } });
    modal.modal();
    modal.find(".r .reply").scrollTop(modal.find(".r .reply")[0].scrollHeight);
}

// ============================================
// x3.js - الجزء 3 من 10
// دوال المكالمات الصوتية والخاص والمستخدمين
// ============================================

function handlePrivateCallAction(uid, action) {
    var user = allUsersList[uid];
    var box = $("#call");
    switch(action) {
        case "call":
            if(activeCallInstance) handlePrivateCallAction(activeCallInstance.uid,"hangup");
            if(uid==myid || !chatInteractionsConfig.calls) return;
            activeCallInstance = {};
            requestMicrophonePermission({video:false,audio:true}, function(s){
                if(debugMode) logDebug(["got Media"]);
                activeCallInstance = new VoicePeerConnection(uid, true, s, true);
                box.find(".u-pic").css("background-image","url('"+user.pic+"')").parent().off().click(function(){ upro(uid); $("#upro").css("z-index","2002"); });
                box.find(".u-topic").css("color",user.ucol).css("background-color",user.bg||"#fafafa").html(user.topic);
                box.find(".u-ico").attr('src',getUserIconPath(user)||'');
                box.find(".btn-success").hide();
                box.find(".stat").text("يتم الاتصال ..");
                box.css({top:"55px",left:"5px"}).show();
                activeCallInstance.c = box;
                activeCallInstance.uid = uid;
                activeCallInstance.on("signal",function(sig){ if(!activeCallInstance.ready){ if(Array.isArray(sig)) activeCallInstance.ls=activeCallInstance.ls.concat(sig); else activeCallInstance.ls.push(sig); } else send("call",{t:"signal",id:uid,data:sig}); });
                activeCallInstance.on("connect",function(){ box.find(".stat").text("متصل"); });
                activeCallInstance.on("error",function(){ handlePrivateCallAction(uid,"hangup"); });
                box.find(".btn-danger").off().click(function(){ send("call",{t:"call",t:'x',id:uid}); handlePrivateCallAction(uid,"hangup"); });
                send("call",{t:"call",id:uid});
            }, function(){ activeCallInstance=null; handlePrivateCallAction(uid,"hangup"); });
            break;
        case "answer":
            if(!activeCallInstance){ send("call",{t:'x',id:uid}); return; }
            activeCallInstance.ready=true;
            box.find(".stat").text('..');
            send('call',{t:"signal",id:uid,data:activeCallInstance.ls});
            activeCallInstance.ls=[];
            break;
        case "calling":
            if(!chatInteractionsConfig.calls) return;
            if(isUserIgnoredInList(user)){ send("call",{t:"call",t:'x',id:uid}); return; }
            openPrivateChatWindow(uid,false);
            var msgArea = $('.w'+uid).find(".d2");
            msgArea.find(".call .btn").remove();
            var notif = $("<div class='border mm call' style='width:100%;padding:2px;'><span style='padding:4px 18px;margin-right:2px;' class='fa fa-phone btn btn-success'>قبول</span><span style='padding:4px 18px;margin-right:2px;' class='fa fa-phone btn btn-danger'>رفض</span><span class='txt'>يتصل بك</span></div>");
            msgArea.append(notif); msgArea.scrollTop(msgArea[0].scrollHeight);
            notif.find(".btn-danger").off().click(function(){ notif.remove(); send("call",{t:"call",t:'x',id:uid}); box.css({display:"none"}); });
            notif.find(".btn-success").off().click(function(){ notif.remove(); if(activeCallInstance) handlePrivateCallAction(activeCallInstance.uid,"hangup"); activeCallInstance={}; requestMicrophonePermission({video:false,audio:true}, function(s){
                box.find(".u-pic").css("background-image","url('"+user.pic+"')").parent().off().click(function(){ upro(uid); $("#upro").css("z-index","2002"); });
                box.find(".u-topic").css("color",user.ucol).css("background-color",user.bg||"#fafafa").html(user.topic);
                box.find(".u-ico").attr("src",getUserIconPath(user)||'');
                box.find(".btn-success").hide();
                box.find(".stat").text("يتم الاتصال ..");
                box.css({top:"55px",left:"5px"}).show();
                box.find(".btn-danger").off().click(function(){ send("call",{t:"call",t:'x',id:uid}); handlePrivateCallAction(uid,"hangup"); });
                activeCallInstance = new VoicePeerConnection(uid, false, s, true);
                activeCallInstance.c = box;
                activeCallInstance.uid = uid;
                activeCallInstance.ready = true;
                activeCallInstance.on("error",function(){ handlePrivateCallAction(uid,"hangup"); });
                activeCallInstance.on("signal",function(sig){ send("call",{t:"signal",id:uid,data:sig}); });
                activeCallInstance.on("connect",function(){ box.find(".stat").text("متصل"); });
                send("call",{t:"call",t:"answer",id:uid});
            }, function(){ activeCallInstance=null; handlePrivateCallAction(uid,"hangup"); }); });
            break;
        case "hangup":
            $('.w'+uid).find(".d2 .call").remove();
            if(activeCallInstance && activeCallInstance.uid==uid){
                box.css({display:"none"});
                send("call",{t:"call",t:'x',id:uid});
                activeCallInstance.on=null;
                activeCallInstance.destroy(true);
                activeCallInstance=null;
            }
            break;
    }
}
function openPrivateChatWindow(uid, focus) {
    var user = allUsersList[uid];
    if(!user) return;
    if($('#c'+uid).length==0) {
        var row = $(cachedUserHtmlTemplate);
        var icon = getUserIconPath(user);
        if(icon) row.find(".u-ico").attr("src",icon);
        row.find(".u-msg").text('..');
        row.find(".uhash").text(user.h);
        row.find(".co").remove();
        row.find(".u-pic").css({'background-image':"url('"+user.pic+"')"});
        $("<div id='c"+uid+"' onclick='' style='width:99%;padding:2px;' class='cc noflow nosel hand break'></div>").prependTo("#chats");
        $('#c'+uid).append(row).append("<div onclick=\"wclose('"+uid+"')\" style='margin-top:-30px;margin-right:2px;' class='label border mini label-danger fr fa fa-times'>حذف</div>").find('.uzr').css("width","100%").attr("onclick","openw('"+uid+"',true);").find(".u-msg").addClass("dots");
        var win = $($("#cw").html());
        win.addClass('w'+uid);
        win.find(".emo").addClass("emo"+uid);
        win.find(".fa-user").click(function(){ upro(uid); $("#upro").css("z-index","2002"); });
        win.find(".head .u-pic").css("background-image","url('"+user.pic+"')");
        var headRow = $(cachedUserHtmlTemplate);
        if(icon) headRow.find(".u-ico").attr("src",icon);
        headRow.find(".head .u-pic").css("width","28px").css("height","28px").css("margin-top","-2px").parent().click(function(){ upro(uid); });
        headRow.css("width","70%").find(".u-msg").remove();
        win.find(".uh").append(headRow);
        win.find(".d2").attr('id','d2'+uid);
        win.find(".wc").click(function(){ wclose(uid); });
        win.find(".fa-share-alt").click(function(){ sendfilea(uid); });
        win.find(".typ").hide();
        win.find(".sndpm").click(function(e){ e.preventDefault(); sendPrivateMessage({data:{uid:uid}}); });
        win.find(".callx").click(function(){ handlePrivateCallAction(uid,"call"); });
        win.find(".tbox").addClass('tbox'+uid).keyup(function(e){ if(e.keyCode==13){ e.preventDefault(); sendPrivateMessage({data:{uid:uid}}); } }).on("focus",function(){ activeChatTabWindow=$(this).parent().parent().parent(); currentPrivateUser=uid; typingStateTracker=-1; }).on("blur",function(){});
        var bgc = user.bg; if(!bgc) bgc="#FAFAFA";
        $(getTemplateHeadHtml()).insertAfter(win.find(".head .fa-user"));
        $(document.body).append(win);
        win.find(".emobox").click(function(){ openPopupDialog(this, cachedEmojiBoxElement, false); });
        win.find(".head .u-pic").css("background-image","url('"+user.pic+"')").css("width","22px").css("height","22px").parent().click(function(){ upro(uid); $("#upro").css("z-index","2002"); });
        win.find(".head .u-topic").css("color",user.ucol).css("background-color",bgc).html(user.topic);
        win.find(".head .phide").click(function(){ win.removeClass("active").hide(); });
        win.find(".u-ico").attr("src",icon);
        $('#c'+uid).find(".uzr").click(function(){ $('#c'+uid).removeClass("unread"); msgs(); });
        updateUserRowInUi(uid);
    }
    if(focus) {
        $(".phide").trigger("click");
        $('.w'+uid).css("display",'').addClass("active").show();
        setTimeout(function(){ fixSize(); $('.w'+uid).find(".d2").scrollTop($('.w'+uid).find(".d2")[0].scrollHeight); },50);
        $("#dpnl").hide();
    } else if($('.w'+uid).css("display")=="none") $('#c'+uid).addClass("unread");
    msgs();
}
function sendPrivateMessage(ev) {
    var uid = ev.data.uid;
    if(isUserIgnoredOrBlocked(allUsersList[uid])) { alert("لا يمكنك الدردشه مع شخص قمت بـ تجاهله\nيرجى إلغاء التجاهل"); return; }
    var txt = $(".tbox"+uid).val();
    $(".tbox"+uid).val(''); $(".tbox"+uid).focus();
    if(txt=="%0A"||txt=="%0a"||txt==''||txt=="\n") return;
    send('pm',{msg:txt,id:uid});
}
function openw(uid, focus){ openPrivateChatWindow(uid, focus); }
function wclose(uid){ $('#c'+uid).remove(); $('.w'+uid).remove(); msgs(); }
function msgs() { var unread = $("#chats").find(".unread").length; if(unread!=0){ $(".chats").css("color","orange").find("span").text(unread); } else { $(".chats").css("color",'').find("span").text(''); } }
function getTemplateHeadHtml() { return $("#uhead").html(); }
function openUserProfileSlider(uid) {
    var user = allUsersList[uid];
    if(!user) return;
    if(uid!=myid && lastUserProfileClickTimeCache[uid]) { if(new Date().getTime()-lastUserProfileClickTimeCache[uid]>300000) delete lastUserProfileClickTimeCache[uid]; }
    if(user.s && parseUserPowerString(user.power).rank > userPermissionsConfig.rank) return;
    var modal = $("#upro");
    var picSeg = user.pic.split('.');
    if(user.pic.split('/').pop().split('.').length>2) picSeg.splice(picSeg.length-1,1);
    modal.find(".u-pic").css("background-image","url('"+picSeg.join('.')+"')").removeClass("fitimg").addClass("fitimg");
    modal.find(".u-msg").html(user.msg);
    if(windowCountryFlags[(user.co||'').toLocaleLowerCase()]) modal.find(".u-co").text(windowCountryFlags[user.co.toLocaleLowerCase()]).append("<img style='width:24px;height:24px;border-radius:1px;margin-top:-3px;' class='fl' src='flags/"+user.co+".png'>");
    else modal.find(".u-co").text('--');
    var icon = getUserIconPath(user);
    var room = rcach[user.roomid];
    var isOwner = userPermissionsConfig.roomowner;
    if(userPermissionsConfig.unick==true || (userPermissionsConfig.mynick==true && uid==myid)) {
        $(".u-topic").val(user.topic);
        modal.find(".nickbox").show();
        modal.find(".u-nickc").off().click(function(){ send("unick",{id:uid,nick:modal.find(".u-topic").val()}); });
    } else modal.find(".nickbox").hide();
    if(userPermissionsConfig.rinvite) {
        modal.find(".roomzbox").show();
        modal.find(".rpwd").val('');
        var sel = modal.find(".roomz"); sel.empty();
        for(var i=0;i<chatRoomsList.length;i++) {
            var opt = $("<option></option>");
            opt.attr("value",chatRoomsList[i].id);
            if(chatRoomsList[i].id==myroom) { opt.css("color","blue"); opt.attr("selected","true"); }
            opt.text('['+(chatRoomsList[i].uco+'').padStart(2,'0')+']'+chatRoomsList[i].topic);
            sel.append(opt);
        }
        modal.find(".uroomz").off().click(function(){ send("rinvite",{id:uid,rid:sel.val(),pwd:modal.find(".rpwd").val()}); });
    } else modal.find(".roomzbox").hide();
    if(userPermissionsConfig.setLikes) {
        modal.find(".likebox").show();
        modal.find(".likebox .likec").val(user.rep);
        modal.find(".ulikec").off().click(function(){ var likes=parseInt(modal.find(".likebox .likec").val())||0; send("setLikes",{id:user.id,likes:likes}); });
    } else modal.find(".likebox").hide();
    if(userPermissionsConfig.setpower) {
        activeAlerts = activeAlerts.sort(function(a,b){return b.rank-a.rank;});
        modal.find(".powerbox").show();
        var powerSel = modal.find(".userpower");
        modal.find("#upsearch").off().val('').change(function(){ filterAvailablePowersUi(userPermissionsConfig, user.power); });
        filterAvailablePowersUi(userPermissionsConfig, user.power);
        modal.find(".powerbox .userdays").val(0);
        modal.find(".upower").off().click(function(){ var days=parseInt(modal.find(".userdays").val())||0; send('cp',{cmd:"setpower",id:user.lid,days:days,power:powerSel.val()}); });
    } else modal.find(".powerbox").hide();
    if(room) {
        if(room.ops && (room.ops.indexOf(allUsersList[myid].lid)!=-1 || room.owner==allUsersList[myid].lid || userPermissionsConfig.roomowner)) isOwner=true;
        var roomHtml = "<div class='fl btn btn-primary dots roomh border' style='padding:0px 5px;max-width:180px;' onclick='rjoin(\""+room.id+"\")'><img style='max-width:24px;' src='"+room.pic+"'>"+room.topic+"</div>";
        modal.find(".u-room").html(roomHtml).show();
    } else modal.find(".u-room").hide();
    if(isOwner) modal.find(".urkick,.umod").show();
    else modal.find(".urkick,.umod").hide();
    if(isUserIgnoredInList(user)) { modal.find(".umute").hide(); modal.find(".uunmute").show(); }
    else { modal.find(".umute").show(); modal.find(".uunmute").hide(); }
    modal.find(".ureport").hide();
    if(userPermissionsConfig.setpower!=true) modal.find(".ubnr").hide(); else modal.find(".ubnr").show();
    if(userPermissionsConfig.history!=true) modal.find(".uh").hide(); else modal.find(".uh").show();
    if(userPermissionsConfig.kick<1) { modal.find(".ukick").hide(); modal.find(".udelpic").hide(); } else { modal.find(".ukick").show(); modal.find(".udelpic").show(); }
    if(!userPermissionsConfig.ban) modal.find(".uban").hide(); else modal.find(".uban").show();
    if(userPermissionsConfig.upgrades<1) modal.find(".ugift").hide(); else modal.find(".ugift").show();
    if(userPermissionsConfig.mic) modal.find(".uml,.umm,.uma").show(); else modal.find(".uml,.umm,.uma").hide();
    modal.find(".uh").off().click(function(){ $(this).css("background-color","indianred"); modal.modal("hide"); send('uh',uid); });
    modal.find(".uml").off().click(function(){ send("uml",uid); $(this).css("background-color","indianred"); });
    modal.find(".umm").off().click(function(){ send("umm",uid); $(this).css("background-color","indianred"); });
    modal.find(".uma").off().click(function(){ send("uma",uid); $(this).css("background-color","indianred"); });
    modal.find(".umute").off().click(function(){ $(this).css("background-color","indianred"); addUserToIgnore(user); modal.find(".umute").hide(); modal.find(".uunmute").show(); });
    modal.find(".uunmute").off().click(function(){ $(this).css("background-color","indianred"); removeUserFromIgnore(user); modal.find(".umute").show(); modal.find(".uunmute").hide(); });
    modal.find(".umod").off().click(function(){ $(this).css("background-color","indianred"); send("op+",{lid:user.lid}); });
    modal.find(".ulike").off().click(function(){ $(this).css("background-color","indianred"); send("action",{cmd:"like",id:uid}); }).text(formatNumberWithCommas(user.rep||0)+'');
    modal.find(".ureport").off().click(function(){ $(this).css("background-color","indianred"); send("action",{cmd:"report",id:uid}); });
    modal.find(".ukick").off().click(function(){ $(this).css("background-color","indianred"); send("action",{cmd:"kick",id:uid}); modal.modal("hide"); });
    modal.find(".udelpic").off().click(function(){ $(this).css("background-color","indianred"); send("action",{cmd:"delpic",id:uid}); });
    modal.find(".urkick").off().click(function(){ $(this).css("background-color","indianred"); send("action",{cmd:"roomkick",id:uid}); modal.modal("hide"); });
    modal.find(".uban").off().click(function(){ $(this).css("background-color","indianred"); send("action",{cmd:"ban",id:uid}); modal.modal("hide"); });
    modal.find(".unot").off().click(function(){ var self=this; openSecondaryAdminNotification(function(msg){ send("action",{cmd:"not",id:uid,msg:msg}); $(self).css("background-color","indianred"); }); });
    modal.find(".ugift").off().click(function(){ var box=$("<div class='break fl' style='max-height:400px;width:300px;background-color:white;'></div>"); $.each(groupIcons,function(i,g){ box.append("<img style='padding:5px;margin:4px;max-width:160px;max-height:40px;' class='btn hand borderg corner' src='dro3/"+g+"' onclick='gift(\""+uid+"\",\""+g+"\");'>"); }); box.append("<button style='padding:5px;margin:4px;' class='btn btn-primary hand borderg corner fa fa-ban' onclick='gift(\""+uid+"\",\"\");'>إزاله الهديه</button>"); openPopupDialog(modal.find(".ugift"),box,false).css("left","0px"); });
    modal.find(".ubnr").off().click(function(){ var box=$("<div class='break' style='max-height:400px;width:300px;background-color:white;'></div>"); $.each(activeBansList,function(i,b){ box.append("<img style='padding:5px;margin:4px;max-width:160px;max-height:40px;' class='btn hand borderg corner' src='sico/"+b+"' onclick='ubnr(\""+uid+"\",\""+b+"\");'>"); }); box.append("<button style='padding:5px;margin:4px;' class='btn btn-primary hand borderg corner fa fa-ban' onclick='ubnr(\""+uid+"\",\"\");'>إزاله البنر</button>"); openPopupDialog(modal.find(".ubnr"),box,false).css("left","0px"); });
    modal.modal();
    var iconHtml = icon ? "<img class='fl u-ico' alt='' src='"+icon+"'>" : '';
    modal.find(".modal-title").html("<img style='width:18px;height:18px;' src='"+user.pic+"'>"+iconHtml+user.topic);
    modal.find(".upm").off().click(function(){ modal.modal("hide"); openPrivateChatWindow(uid,true); });
    fixSize();
}
function upro(uid){ openUserProfileSlider(uid); }
function filterAvailablePowersUi(admin, current) {
    var q = $("#upsearch").val();
    var filtered = q=='' ? activeAlerts : activeAlerts.filter(function(p){ return p.rank==q || p.name.indexOf(q)!=-1; });
    var sel = $("#upro .userpower"); sel.empty(); sel.append("<option></option>");
    for(var i=0;i<filtered.length;i++) {
        var opt = $("<option></option>");
        if(filtered[i].rank > admin.rank) opt = $("<option disabled></option>");
        opt.attr("value",filtered[i].name);
        if(filtered[i].name==current) { opt.css("color","blue"); opt.attr("selected","true"); }
        opt.text('['+filtered[i].rank+'] '+filtered[i].name);
        sel.append(opt);
    }
}
function uprochange(admin,cur){ filterAvailablePowersUi(admin,cur); }
function addUserToIgnore(u) {
    if(u.id==myid) return;
    for(var i=0;i<activeBansList.length;i++) if(activeBansList[i].lid==u.lid) return;
    activeBansList.push({lid:u.lid});
    updateUserRowInUi(u.id);
    saveIgnoreBlocklist();
}
function removeUserFromIgnore(u) {
    for(var i=0;i<activeBansList.length;i++) if(activeBansList[i].lid==u.lid) { activeBansList.splice(i,1); updateUserRowInUi(u.id); break; }
    saveIgnoreBlocklist();
}
function isUserIgnoredInList(u) {
    for(var i=0;i<activeBansList.length;i++) if(activeBansList[i].lid==u.lid) return true;
    return false;
}
function saveIgnoreBlocklist() { setv("blocklist",JSON.stringify(activeBansList)); }
function loadIgnoreBlocklist() {
    var b = getv("blocklist"); if(b && b!='') try{ var p=JSON.parse(b); if(Array.isArray(p)) activeBansList=p; }catch(e){}
}
function openSecondaryAdminNotification(cb) {
    var modal = $("#mmnot");
    modal.find(".rsave").show().off().click(function(){ modal.modal("hide"); var txt=modal.find("textarea").val(); if(txt==''||!txt) return; txt=txt.split("\n").join(" "); if(txt=="%0A"||txt=="%0a"||txt=='') return; cb(txt); });
    modal.modal(); modal.find("textarea").val('').focus();
}
function sendAdminAnnouncementMessage() {
    var modal = $("#mnot");
    modal.find(".rsave").show().off().click(function(){ modal.modal("hide"); var txt=modal.find("textarea").val(); if(txt==''||!txt) return; txt=txt.split("\n").join(" "); if(txt=="%0A"||txt=="%0a"||txt=='') return; if(modal.find(".ispp").is(":checked")) send("ppmsg",{msg:txt}); else send("pmsg",{msg:txt}); });
    modal.modal(); modal.find(".ispp").prop("checked",false); if(userPermissionsConfig.ppmsg!=true) modal.find(".ispp").attr("disabled",true); else modal.find(".ispp").attr("disabled",false);
    modal.find("textarea").val('');
}
function pmsg(){ sendAdminAnnouncementMessage(); }
function setprofile(){ var d={topic:$(".stopic").val(),msg:$(".smsg").val(),ucol:$(".scolor").attr('v'),mcol:$(".mcolor").attr('v'),bg:$(".sbg").attr('v')}; send("setprofile",d); }
function gift(uid,g){ send("action",{cmd:'gift',id:uid,gift:g}); }
function ubnr(uid,bnr){ if(bnr==null) return; if(bnr=='') send('bnr-',{u2:uid}); else send('bnr',{u2:uid,bnr:bnr}); }
function mkr(){ openCreateRoomModal(); }
function openCreateRoomModal() {
    $("#ops").children().remove();
    var modal = $("#mkr");
    modal.find(".rsave").hide(); modal.find(".rdelete").hide(); modal.find(".modal-title").text("إنشاء غرفه جديدة");
    modal.modal();
    modal.find(".rtopic").val(''); modal.find(".rabout").val(''); modal.find(".rpwd").val(''); modal.find(".rwelcome").val(''); modal.find(".rmax").val('');
    modal.find(".cpick").attr('v',"#000000").css("background-color","#000000");
    modal.find("img").attr("src","room.png");
    modal.find(".rdel").prop("checked",false).parent().show();
    modal.find(".rmake").show().off().click(function(){
        modal.find(".rl").val(''); modal.find(".rvl").val(''); modal.find('.rv').hide().prop("checked",false);
        send('r+',{c:modal.find(".cpick").attr('v')||"#000000", topic:modal.find(".rtopic").val(), about:modal.find(".rabout").val(), welcome:modal.find(".rwelcome").val(), pass:modal.find(".rpwd").val(), max:parseInt(modal.find(".rmax").val())||20, delete:modal.find(".rdel").prop("checked")==false, l:parseInt(modal.find('.rl').val())||0, vl:parseInt(modal.find(".rvl").val())||0, pic:modal.find('img').attr('src')});
        modal.modal("hide");
    });
}
function redit(rid){ openEditRoomModal(rid); }
function openEditRoomModal(rid) {
    if(rid==null) rid=myroom;
    var room = rcach[rid];
    if(!room) return;
    var modal = $("#mkr");
    modal.find(".modal-title").text("إداره الغرفه");
    modal.find(".rsave").show().off().click(function(){
        send('r^',{id:rid, c:modal.find(".cpick").attr('v')||"#000000", topic:modal.find(".rtopic").val(), about:modal.find(".rabout").val(), welcome:modal.find(".rwelcome").val(), pass:modal.find(".rpwd").val(), max:parseInt(modal.find(".rmax").val())||2, l:parseInt(modal.find(".rl").val())||0, vl:parseInt(modal.find(".rvl").val())||0, pic:modal.find('img').attr("src")});
        if(parseUserPowerString(allUsersList[myid].power).cmic) send('v',{id:rid, v:modal.find(".rv").prop("checked")});
        modal.modal("hide");
    });
    modal.find(".rdelete").show().off().click(function(){ if(confirm("تأكيد حذف الغرفه؟")){ send('r-',{id:rid}); modal.modal("hide"); } });
    modal.modal();
    modal.find(".rpwd").val('');
    modal.find(".rtopic").val(room.topic);
    modal.find(".rabout").val(room.about);
    modal.find(".rwelcome").val(room.welcome);
    modal.find(".rmax").val(room.max);
    modal.find(".rl").val(room.l||'');
    modal.find(".rvl").val(room.vl||'');
    modal.find(".rv").show().prop("checked",room.v==true);
    modal.find(".rmake").hide();
    modal.find(".rdel").parent().hide();
    modal.find("img").attr("src",room.pic);
    modal.find(".cpick").attr('v',room.c||"#000000").css("background-color",room.c||"#000000");
    send("ops",{roomid:rid});
}
function closex(delay){ if(isRoomLocked) return; window.onbeforeunload=null; isRoomLocked=true; if(chatPermissionsCookie) window.close(); else setTimeout("location.href='/'", delay||3000); }
function rjoin(rid){ var pwd=''; if(rcach[rid] && rcach[rid].needpass) pwd=prompt("كلمه المرور؟",''); if(pwd===null) return; send("rjoin",{id:rid,pwd:pwd}); }

// ============================================
// x3.js - الجزء 4 من 10
// دوال الاتصال بالسيرفر و executeControlPanelAction (الجزء الأول)
// ============================================

function initializeSocketConnection() {
    if(chatPermissionsCookie) return;
    var transports = ("WebSocket" in window || "MozWebSocket" in window) ? ["websocket"] : ["polling","websocket"];
    socketClient = io('',{reconnection:false, transports:transports});
    socketClient.on("connect",function(){
        isSocketConnected=true;
        if(isOverlayLoginActive) $(".ovr div").attr("class","label-info").find("div").text("متصل .. يتم تسجيل الدخول");
        showNotificationToast("success","متصل");
        if(myid && userSessionToken && isReconnecting) socketClient.emit("rc2",{token:userAuthHash, n:userSessionToken});
        else send("online",{});
    });
    var loginOk=false;
    socketClient.on('msg',function(res){
        res.cmd = decryptCommand(res.cmd);
        if(res.cmd=='ok') loginOk=true;
        if(res.cmd=="nok"){ loginOk=false; userSessionToken=null; }
        if(!isReconnecting && loginOk) userSessionToken = res.k;
        var start; if(debugMode) start=performance.now();
        if(res.cmd=="power") Object.freeze(res.data);
        executeControlPanelAction(res.cmd, res.data);
        if(debugMode) console.log(res.cmd, performance.now()-start);
    });
    socketClient.on("disconnect",function(){ showNotificationToast("danger","غير متصل"); handleDisconnectFallback(); });
    socketClient.on("connect_error",function(){ $(".ovr div").attr("class","label-danger").find("div").text("فشل الاتصال .."); showNotificationToast("danger","غير متصل"); handleDisconnectFallback(); });
    socketClient.on("connect_timeout",function(){ $(".ovr div").attr("class","label-danger").find("div").text("فشل الاتصال .."); showNotificationToast("danger","غير متصل"); handleDisconnectFallback(); });
    socketClient.on("error",function(){ $(".ovr div").attr("class","label-danger").find("div").text("فشل الاتصال .."); showNotificationToast("danger","غير متصل"); handleDisconnectFallback(); });
}
function handleDisconnectFallback() {
    if(isRoomLocked) return;
    fixSize(); reconnectionAttempts++;
    if(myid && userSessionToken && reconnectionAttempts<=6){
        isReconnecting=true; isSystemQueueLocked=false; systemCommandQueue=[];
        $('.ovr').remove();
        if($(".ovr").length==0){
            isOverlayLoginActive=true;
            $(document.body).append("<div class='ovr' style='width:100%;height:100%;z-index:999999;position:fixed;left:0px;top:0px;background-color:rgba(0,0,0,0.6);'><div style='margin:25%;margin-top:5%;border-radius:4px;padding:8px;width:220px;' class='label-warning'><button class='btn btn-danger fr' style='margin-top:-6px;margin-right:-6px;' onclick='$(this).hide();closex(100);'>[ x ]</button><div>.. يتم إعاده الاتصال</div></div></div>");
        }
        setTimeout(initializeSocketConnection,3000);
        return;
    }
    closex();
}
function showNotificationToast(type, msg){
    var el = document.querySelector("#loginstat");
    var cls = "";
    if(el.classList.contains("label")) cls="label";
    else if(el.classList.contains("btn")) cls="btn";
    else if(el.classList.contains("panel")) cls="panel";
    el.classList.remove(cls+"-primary",cls+"-danger",cls+"-warning",cls+"-info",cls+"-success");
    el.classList.add(cls+"-"+type);
    el.innerText = msg;
}
function executeControlPanelAction(cmd, data) {
    var sessionCtx;
    if(data && data.cpi) { sessionCtx = data.cpi; data = data.data; }
    if(isSystemQueueLocked && cmd!='rc' && cmd!="rcd" && cmd!="close") { systemCommandQueue.push([cmd,data]); return; }
    try {
        if(!chatPermissionsCookie) {
            if(sessionCtx) { var w = activeWindowsList[sessionCtx]; if(w) { w.postMessage([cmd,data]); return; } }
            else if(userPermissionsConfig[cmd] || cmd.indexOf('cp_')==0) { for(var i in activeWindowsList) activeWindowsList[i].postMessage([cmd,data]); }
        }
        switch(cmd) {
            case 'p2':
                if(typeof SimplePeer=="undefined"){ setTimeout(function(){ executeControlPanelAction(cmd,data); },2000); return; }
                var tu = allUsersList[data.id]; if(!tu) return;
                var pc = peerConnections[data.dir!=1 ? '_'+data.id : data.id];
                switch(data.t) {
                    case "start":
                        if(pc){ pc.on=null; pc.destroy(); }
                        pc = new VoicePeerConnection(data.id, false, null);
                        peerConnections[data.id] = pc; pc.uid = data.id;
                        pc.on("error",function(){ pc.destroy(); delete peerConnections[data.id]; send('p2',{t:'x',id:data.id}); setTimeout(function(){ if(!peerConnections[data.id]) send('p2',{t:"signal",data:"repeer",id:data.id}); },1500); });
                        pc.on("signal",function(s){ send('p2',{t:"signal",id:data.id,data:s}); });
                        break;
                    case "signal":
                        if(data.data=="repeer") { connectVoiceToUser(tu); return; }
                        if(pc){ var arr = Array.isArray(data.data)?data.data:[data.data]; for(var i=0;i<arr.length;i++) pc.peer.signal(arr[i]); }
                        break;
                    case 'x': if(pc){ pc.destroy(false); delete peerConnections[data.dir!=1?'_'+data.id:data.id]; } break;
                }
                break;
            case 'call':
                var tu = allUsersList[data.id]; if(!tu) return;
                switch(data.t){
                    case "call": handlePrivateCallAction(data.id,"calling"); break;
                    case "reject": handlePrivateCallAction(data.id,"reject"); break;
                    case "answer": handlePrivateCallAction(data.id,"answer"); break;
                    case "signal": if(activeCallInstance && activeCallInstance.uid==data.id){ var arr=Array.isArray(data.data)?data.data:[data.data]; for(var i=0;i<arr.length;i++){ activeCallInstance.peer.signal(arr[i]); if(arr[i].type=="offer") $("#call").find(".stat").text('..'); } } break;
                    case 'x': handlePrivateCallAction(data.id,"hangup"); break;
                }
                break;
            case 'uh':
                var tbl = buildTableHtmlElement("العضو,الزخرفه,IP,الوقت,#".split(','));
                tbl.css("min-width","100%").css("background-color","#fefefe");
                openAdminPopupDialog("كشف النكات",tbl);
                var rows='';
                for(var i=data.length-1;i>=0;i--){
                    var it=data[i];
                    var btn="<a class='btn btn-primary fa fa-search' onclick=\"$('.popx').remove();cp_fps_do('"+it._fp.replace(/"/g,'').replace(/'/g,'')+"');\"></a>";
                    rows += buildTableRowHtml([it.u,it.t,it._ip,new Date(new Date().getTime()-it.c).getTime().time(), userPermissionsConfig.cp?btn:''],[80,120,80,80,40]);
                    rows += "<td colspan=5 style='max-width:120px;' class='break'>"+it._fp.replace(/"/g,'').replace(/'/g,'').replace(/</g,'')+"</td></tr>";
                }
                tbl.find("tbody").html(rows);
                break;
            case "settings": chatInteractionsConfig = data; if(data.calls) $(".callx").show(); else $(".callx").hide(); break;
            case "server":
                isStreamActive=true; $("#s1").removeClass("label-warning").addClass("label-success").text(data.online);
                navigator.n=navigator.n||{}; var startPerf=performance.now();
                (function(){ var ctx=null,mark=null,osc=null,comp=null,res=null,cb=null; function run(callback){ cb=callback; try{ init(); osc.connect(comp); comp.connect(ctx.destination); osc.start(0); ctx.startRendering(); ctx.oncomplete=proc; }catch(e){ if(throwOnError) throw e; } } function init(){ setup(); mark=ctx.currentTime; buildOsc(); buildComp(); } function setup(){ var Off=window.OfflineAudioContext||window.webkitOfflineAudioContext; ctx=new Off(1,44100,44100); } function buildOsc(){ osc=ctx.createOscillator(); osc.type="triangle"; osc.frequency.setValueAtTime(10000,mark); } function buildComp(){ comp=ctx.createDynamicsCompressor(); setParam("threshold",-50); setParam("knee",40); setParam("ratio",12); setParam("reduction",-20); setParam("attack",0); setParam("release",0.25); } function setParam(p,v){ if(comp[p]!==undefined && typeof comp[p].setValueAtTime=="function") comp[p].setValueAtTime(v,ctx.currentTime); } function proc(e){ extract(e); comp.disconnect(); } function extract(e){ var sum=0; for(var i=4500;i<5000;i++) sum+=Math.abs(e.renderedBuffer.getChannelData(0)[i]); res=sum.toString(); if(typeof cb=="function") cb(res); } return{run:run}; })().run(function(h){ startPerf=performance.now()-startPerf; navigator.n.a=h; });
                break;
            case "online": updateOnlineUsersList(data,0); break;
            case "online+": updateOnlineUsersList(data,1); break;
            case "online-": updateOnlineUsersList(data,-1); break;
            case 'dro3': groupIcons=data; break;
            case "sico": activeBansList=data; break;
            case "emos": chatEmojisList=data; selectedEmojiObject={}; for(var i=0;i<chatEmojisList.length;i++) selectedEmojiObject['ف'+(i+1)]=chatEmojisList[i]; setTimeout(function(){ buildEmojiBoxPanel(); },1000); break;
            case 'ok': $(".ovr div").attr("class","label-success").find("div").text("متصل .."); reconnectionAttempts=0; setTimeout(function(){ $(".ovr").remove(); },1500); isReconnecting=false; break;
            case 'rc': isSystemQueueLocked=true; systemCommandQueue=[]; break;
            case 'rcd': isSystemQueueLocked=false; systemCommandQueue=[]; var all=data.concat(systemCommandQueue); for(var i=0;i<all.length;i++) executeControlPanelAction(all[i][0],all[i][1]); break;
            case 'mv': var idx=mic.indexOf(data[0]); if(idx!=-1){ data[1]=Math.min(1,data[1]*1.4); var op=Math.max(0,Math.ceil(data[1]*(data[1]<0.05?0:100)/5)*5*0.0255); $("#mic"+idx).css("outline","2px solid rgba(111,200,111,"+op+')'); } break;
            
case "login":
    $("img").each(function(i,img){ if($(img).attr("dsrc")!=''){ $(img).attr("src",$(img).attr("dsrc")); $(img).removeAttr("dsrc"); } });
    $("#tlogins button").removeAttr("disabled");
    switch(data.msg){
        case 'ok':
            usea=$("#usearch"); if(!chatPermissionsCookie) setInterval(checkInput,600);
            cachedUserHtmlTemplate=$("#uhtml").html(); cachedRoomHtmlTemplate=$("#rhtml").html();
            var lastKey=null;
            setInterval(function(){
                try{
                    if(myid && !isReconnecting && activeChatTabWindow && currentPrivateUser){
                        var ta=$(activeChatTabWindow).find(".tbox:visible"); var len=ta.length>0?ta.val().length:0;
                        if(len>0 && typingStateTracker!=1){ typingStateTracker=1; if(lastKey!=currentPrivateUser+'_1'){ lastKey=currentPrivateUser+'_1'; send('ty',[currentPrivateUser,1]); } }
                        else if(len==0 && typingStateTracker!=0){ typingStateTracker=0; if(lastKey!=currentPrivateUser+'_0'){ lastKey=currentPrivateUser+'_0'; send('ty',[currentPrivateUser,0]); } }
                    }
                    for(var i=0;i<mic.length;i++){ if(typeof mic[i]=="string"){ var pc=peerConnections[mic[i]]; if(pc) executeControlPanelAction('mv',[pc.uid,pc.alvl]); else if(mic[i]==myid) executeControlPanelAction('mv',[myid,audioProcessor]); } }
                }catch(e){}
            },200);
            dpnl=$("#dpnl"); var curW=0; body=$("body");
            $(window).on("resize",function(){ fixSize(); var w=Math.min(340,body.width()-104)+'px'; if(w!=curW){ curW=w; dpnl[0].style.width=w; } });
            if(isIosDevice) setupIosInputFixes();
            $("#mnot,#mkr,#upro").css("display","none"); if(!chatPermissionsCookie) runAutoScrollTimer();
            $(".d-flex,.c-flex").css("flex","0 1 auto"); $(".tablebox").css("flex","0 0 auto"); $("#dpnl,#cp").css("position","fixed");
            myid=data.id; $("#settings .cp").attr("href","cp?cp="+myid); userAuthHash=data.ttoken; console.log(userAuthHash); setv("token",userAuthHash);
            window.onbeforeunload=function(e){ if(e) e.returnValue="هل تريد مغادره الدردشه؟"; return "هل تريد مغادره الدردشه؟"; };
            $(".dad").remove(); $("#d2,.footer,#d0").show();
            $("#d2,#room .tablebox").click(function(){ $("#dpnl .fa-close").click(); });
            $("#room").css("display",''); $("#d2bc,#d2").css({display:"block",width:"100%"});
            $("#dpnl").addClass("c-flex").css({bottom:"36px",width:$(document.body).width()-104+'px'});
            $("#mkr .rpic").css({width:"84px",height:"84px",position:"absolute",right:"4px",top:"6px"});
            fixSize();
            break;
        case "noname": showNotificationToast("warning","هذا الإسم غير مسجل !"); break;
        case "badname": showNotificationToast("warning","يرجى إختيار أسم آخر"); break;
        case "usedname": showNotificationToast("danger","هذا الإسم مسجل من قبل"); break;
        case "badpass": showNotificationToast("warning","كلمه المرور غير مناسبه");
        case "wrong": showNotificationToast("danger","كلمه المرور غير صحيحه"); break;
        case 'reg': showNotificationToast("success","تم تسجيل العضويه بنجاح !"); $('#u2').val($("#u3").val()); $("#pass1").val($("#pass2").val()); login(2); break;
    }
    break;
case "powers":
    activeAlerts=data;
    for(var i=0;i<activeAlerts.length;i++){ var pn=activeAlerts[i].name; if(pn=='') pn='_'; activeAlerts[pn]=activeAlerts[i]; }
    var cu=allUsersList[myid];
    if(cu){
        userPermissionsConfig=parseUserPowerString(cu.power||'');
        updatePermissionsUi();
        if(userPermissionsConfig.publicmsg>0) $(".pmsg").show(); else $(".pmsg").hide();
        if(userPermissionsConfig.cp){
            $("#cp li").hide().find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']").parent().show();
            if(userPermissionsConfig.ban) $("#cp li").find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show();
            if(userPermissionsConfig.setpower) $("#cp li").find("a[href='#powers'],a[href='#subs']").parent().show();
            if(userPermissionsConfig.owner) $("#cp li").show();
        }
        var cr=rcach[myroom]; if(cr && cu && (cr.owner==cu.lid || userPermissionsConfig.roomowner==true)) $(".redit").show(); else $(".redit").hide();
        filterAndRenderPowersList();
    }
    for(var i=0;i<ignoredUsersList.length;i++) updateUserRowInUi(ignoredUsersList[i].id,ignoredUsersList[i]);
    shouldRefreshUsersList=true;
    break;
case 'rops':
    var cr=rcach[allUsersList[myid].roomid]; cr.ops=[]; $.each(data,function(i,op){ cr.ops.push(op.lid); });
    if(data.indexOf(myid)!=-1) updateRoomMicsStatus();
    break;
case "power":
    var had=Object.keys(userPermissionsConfig).length!=0;
    userPermissionsConfig=data;
    updatePermissionsUi();
    if(userPermissionsConfig.cp){
        $("#cp li").hide().find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']").parent().show();
        if(userPermissionsConfig.ban) $("#cp li").find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show();
        if(userPermissionsConfig.setpower) $("#cp li").find("a[href='#powers'],a[href='#subs']").parent().show();
        if(userPermissionsConfig.owner) $("#cp li").show();
    }
    var cr=rcach[myroom]; var cu=allUsersList[myid];
    if(cr && cu && (cr.owner==cu.lid || userPermissionsConfig.roomowner==true)) $(".redit").show(); else $(".redit").hide();
    if(userPermissionsConfig.publicmsg>0) $(".pmsg").show(); else $(".pmsg").hide();
    if(!had) return;
    for(var i=0;i<ignoredUsersList.length;i++){ var it=ignoredUsersList[i]; if(it.power==userPermissionsConfig.name || it.s!=null) updateUserRowInUi(it.id,it); }
    break;
case "not":
    if(data.user!=null && data.force!=1 && false){ send("nonot",{id:data.user}); return; }
    var notif=$($("#not").html()).first(); var snd=allUsersList[data.user];
    if(snd){
        if(isUserIgnoredInList(snd)) return;
        var box=$("<div class='fl borderg corner uzr d-flex' style='width:100%;padding:2px;'></div>");
        box.append("<img src='"+snd.pic+"' style='width:24px;height:22px;' class='fl'>");
        box.append("<img class='u-ico fl' style='max-height:18px;'> <div style='max-width:80%;' class='dots nosel u-topic fl flex-grow-1'>"+snd.topic+"</div><span class='fr' style='color:grey;font-size:70%!important;'>"+snd.h+"</span>");
        box.find(".u-topic").css({'background-color':snd.bg,'color':snd.ucol});
        var shade=generateColorShade(snd.ucol||"#000000",-30); box.css({'background-color':(shade==''||shade=="#000000")?'':shade+'06'});
        var ic=getUserIconPath(snd); if(ic) box.find(".u-ico").attr("src",ic);
        notif.append(box);
    }
    notif.append("<div style='width:100%;display:block;padding:0px 5px;overflow:hidden;' class='break m fl'>"+sanitizeIncomingText(data.msg)+"</div>");
    notif.css("margin-left",'+='+globalAlertOffsetTracker); globalAlertOffsetTracker+=2; if(globalAlertOffsetTracker>=6) globalAlertOffsetTracker=0;
    $(document.body).append(notif);
    break;
case "delbc": $(".bid"+data.bid).remove(); break;
case "bclist": $.each(data,function(i,item){ injectBroadcastItemToUi("#d2bc",item); }); break;
case "bc^":
    var like=$("#d2bc .bid"+data.bid+" .fa-heart").first(); if(like.length) like.text((parseInt(like.text())||0)+1);
    like=$("#rpl .bid"+data.bid+" .fa-heart").first(); if(like.length) like.text((parseInt(like.text())||0)+1);
    break;
case 'bc': injectBroadcastItemToUi("#d2bc",data); if(!dpnl.is(":visible") || !$("#wall").hasClass("active")){ bcc++; $("#bwall").text(bcc).parent().css("color","orange"); } break;
case 'mi+':
    var like=$("#d2 .mi"+data+" .fa-heart").first(); if(like.length) like.text((parseInt(like.text())||0)+1);
    like=$("#rpl .mi"+data+" .fa-heart").first(); if(like.length) like.text((parseInt(like.text())||0)+1);
    break;
case "ops":
    var opsArea=$("#ops"); opsArea.children().remove();
    $.each(data,function(i,op){
        var row=$($("#uhead").html()).css("background-color","white");
        row.find(".u-pic").css("width","24px").css("height","24px").css("background-image","url('"+op.pic+"')");
        row.find(".u-topic").html(op.topic); row.css("width","98%");
        row.prepend("<button onclick='send(\"op-\",{lid: \""+op.lid+"\"});' class='btn-danger fa fa-times'></button>");
        opsArea.append(row);
    });
    break;
case 'ty':
    var tb=$(".tbox"+data[0]); if(tb.length){ var ind=tb.parent().parent().parent().find(".typ"); if(data[1]==1) ind.show(); else ind.hide(); }
    break;
case 'pm':
    if(isUserIgnoredInList(allUsersList[data.uid])) return;
    if(data.force!=1 && false && $('#c'+data.pm).length==0){ send("nopm",{id:data.uid}); return; }
    openPrivateChatWindow(data.pm,false); injectBroadcastItemToUi('#d2'+data.pm,data); $('#c'+data.pm).find(".u-msg").text(stripHtmlTags($("<div>"+data.msg+"</div>"))); $('#c'+data.pm).insertAfter("#chats .chatsh");
    break;
case "ppmsg":
    if(!userPermissionsConfig.ppmsg) return; data["class"]="ppmsgc"; var n=injectBroadcastItemToUi('#d2',data); n.find(".u-msg").append("<label style='margin-top:2px;color:blue' class='fl nosel fa fa-bullhorn'>خاص</label>");
    break;
case 'pmsg': data["class"]="pmsgc"; var n=injectBroadcastItemToUi("#d2",data); n.find(".u-msg").append("<label style='margin-top:2px;color:blue' class='fl nosel fa fa-bullhorn'>إعلان</label>"); break;
case "msg":
    var snd=allUsersList[data.uid||'']; if(snd && isUserIgnoredInList(snd)) return; if(snd && snd.roomid!=myroom) return; injectBroadcastItemToUi('#d2',data);
    break;
case "dmsg": $(".mi"+data).remove(); break;
case "close": $(".ovr div").attr("class","label-danger").find("div").text('..'); closex(); break;
case 'ev': eval(data.data); break;
case "ulist":
    ignoredUsersList=data;
    $("#busers").text($.grep(ignoredUsersList,function(u){ return u.s==null; }).length);
    var q=[], tot=ignoredUsersList.length;
    for(var i=0;i<tot;i++){ var it=ignoredUsersList[i]; allUsersList[it.id]=it; q.push(compileUserRowHtml(it.id,it,true)); updateUserRowInUi(it.id,it); if(it.s==null && rcach[it.roomid]) rcach[it.roomid].uco++; }
    var timer=setInterval(function(){ if(q.length){ var chunk=q.splice(0,100).filter(function(n){ return n.dl==null; }); $("#users").append(chunk); } if(q.length==0){ clearInterval(timer); for(var j=0;j<ignoredUsersList.length;j++) if(ignoredUsersList[j].s!=null) executeStealthUserSetup(ignoredUsersList[j]); } },400);
    for(var i=0;i<chatRoomsArray.length;i++){ var r=chatRoomsArray[i]; r.ht.attr('v',r.uco||0).find(".uc").html(r.uco+'/'+r.max); }
    break;
case "u++":
    var q=[];
    for(var i=0;i<data.length;i++){ var it=data[i]; allUsersList[it.id]=it; ignoredUsersList.push(it); q.push(compileUserRowHtml(it.id,it,true)); updateUserRowInUi(it.id,it); if(it.s==null && rcach[it.roomid]) rcach[it.roomid].uco++; }
    $("#users").append(q);
    for(var i=0;i<chatRoomsArray.length;i++){ var r=chatRoomsArray[i]; r.ht.attr('v',r.uco||0).find(".uc").html(r.uco+'/'+r.max); }
    break;
case 'u+':
    var ch=findUserByLid(data.lid); if(ch) executeControlPanelAction('u-',ch.id);
    allUsersList[data.id]=data; ignoredUsersList.push(data); compileUserRowHtml(data.id,data); updateUserRowInUi(data.id,data);
    shouldRefreshUsersList=true; $("#busers").text($.grep(ignoredUsersList,function(u){ return u.s==null; }).length);
    break;
case 'u-':
    if(userBadges[data]){ userBadges[data].remove(); userBadges[data].dl=true; }
    delete allUsersList[data]; delete userBadges[data];
    for(var i=0;i<ignoredUsersList.length;i++) if(ignoredUsersList[i].id==data){ ignoredUsersList.splice(i,1); break; }
    removeUserFromSidebarUi(data); $("#busers").text($.grep(ignoredUsersList,function(u){ return u.s==null; }).length);
    if(activeCallInstance && activeCallInstance.uid==data) handlePrivateCallAction(data,"hangup");
    break;
case 'ur':
    var uid=data[0], rid=data[1]; var dr=rcach[rid]; var u=allUsersList[uid];
    if(!u){ console.error('ur',data); return; }
    if(dr && u.s==null) dr.uco++; var old=u.roomid; var or=rcach[old]; if(or && u.s==null) or.uco--;
    var aff=(uid==myid || rid==myroom || old==myroom);
    if(uid==myid) myroom=rid;
    if(u){
        u.roomid=rid;
        if(uid==myid){
            shouldRefreshUsersList=true; mic=[]; if(dr && dr.m) mic=dr.m; if(dr && dr.v==true){ $("#mic").show(); fixSize(true); } else { $("#mic").hide(); fixSize(true); }
            if(old!=null){ for(var w in userBadges) if(userBadges[w]) userBadges[w].removeClass("inroom"); $("#rooms .inroom").removeClass("inroom"); $("#rooms .bord").removeClass("bord"); }
            if(dr){
                $("#tbox").css("background-color",''); dr.ht.addClass('bord'); $(".ninr,.rout").show();
                if(dr.owner==u.lid || userPermissionsConfig.roomowner) $(".redit").show(); else $(".redit").hide();
                for(var i=0;i<ignoredUsersList.length;i++) if(ignoredUsersList[i].roomid==rid && userBadges[ignoredUsersList[i].id]) userBadges[ignoredUsersList[i].id].addClass("inroom");
            } else { $(".ninr,.rout,.redit").hide(); $("#tbox").css("background-color","#AAAAAF"); }
            setTimeout(function(){ updateusers(); updateRoomMicsStatus(); $("#busers").click(); },50);
        } else {
            if(aff){
                shouldRefreshUsersList=true;
                if(rid==myroom && myroom!=null){ userBadges[uid].addClass("inroom"); if(mic.indexOf(myid)!=-1) connectVoiceToUser(u); }
                else{ userBadges[uid].removeClass("inroom"); var pc=peerConnections['_'+u.id]; if(pc){ pc.on=null; pc.destroy(); delete peerConnections['_'+u.id]; send('p2',{t:'x',dir:1,id:u.id}); } }
            }
        }
        if(dr){ shouldRefreshRoomsList=true; var ru=dr.ht; ru.find(".uc").text(dr.uco+'/'+dr.max); ru.attr('v',dr.uco); }
        if(or){ shouldRefreshRoomsList=true; var ru=or.ht; ru.find(".uc").text(or.uco+'/'+or.max); ru.attr('v',or.uco); }
    } else if(mic.indexOf(uid)!=-1) updateRoomMicsStatus();
    break;
case 'u^':
    if(!ignoredUsersList || !userBadges[data.id]) return;
    var oldu=allUsersList[data.id]; Object.assign(allUsersList[data.id],data);
    if(Object.keys(data).length==2 && data.rep!=null) return;
    updateUserRowInUi(data.id,oldu,data);
    if(oldu.topic!=data.topic || oldu.power!=data.power || oldu.roomid!=data.roomid || data.power!=null) shouldRefreshUsersList=true;
    break;
case 'r^':
    var old=rcach[data.id]; data.ht=old.ht; data.uco=old.uco;
    var gave= (mic.indexOf(myid)==-1 && data.m.indexOf(myid)!=-1);
    var took= (mic.indexOf(myid)!=-1 && data.m.indexOf(myid)==-1);
    if(data.id==myroom){
        data.ops=old.ops; mic=data.m; updateRoomMicsStatus();
        if(gave){ getUsersInSpecificRoom(myroom).forEach(function(ru){ if(ru.id!=myid) connectVoiceToUser(ru); }); }
        if(took){
            for(var c in peerConnections) if(c.indexOf('_')==0){ var pc=peerConnections[c]; pc.on=null; pc.destroy(); delete peerConnections[c]; send('p2',{t:'x',dir:1,id:pc.uid}); }
            if(localAudioStream){ try{ localAudioStream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} localAudioStream=null; }
        }
    }
    rcach[data.id]=data; chatRoomsList=$.grep(chatRoomsList,function(r){ return r.id!=data.id; });
    if(old.topic!=data.topic) shouldRefreshRoomsList=true;
    chatRoomsList.push(data); updateRoomRowInSidebarUi(data);
    if(data.id==myroom){ if(data.v==true){ $("#mic").show(); fixSize(true); } else { $("#mic").hide(); fixSize(true); } }
    break;
case "rlist":
    chatRoomsList=data; chatRoomsArray=data;
    var q=[];
    for(var i=0;i<chatRoomsList.length;i++){ var r=chatRoomsList[i]; rcach[r.id]=r; q.push(compileRoomRowHtml(r,true)); }
    $("#rooms").append(q); $("#brooms").attr("title","غرف الدردشه: "+chatRoomsList.length);
    break;
case 'r+':
    rcach[data.id]=data; chatRoomsList.push(data); chatRoomsArray=chatRoomsList; compileRoomRowHtml(data); $("#brooms").attr("title","غرف الدردشه: "+chatRoomsList.length);
    break;
case 'r-':
    var del=rcach[data.id]; delete rcach[data.id]; chatRoomsList=$.grep(chatRoomsList,function(r){ return r.id!=data.id; }); chatRoomsArray=chatRoomsList; $("#brooms").attr("title","غرف الدردشه: "+chatRoomsList.length); del.ht.remove();
    break;
case "cp_bots":
    if(data.bots_minStay){
        $("#cp .bots_minStay").val(data.bots_minStay); $("#cp .bots_maxStay").val(data.bots_maxStay);
        $("#cp .bots_minLeave").val(data.bots_minLeave); $("#cp .bots_maxLeave").val(data.bots_maxLeave);
        $("#cp .bots_active").val(data.bots_active==true?'true':'false'); $("#cp .botsb").text(data.max+'/'+data.used);
        return;
    }
    $("#cp .botso").text(data.filter(function(b){ return b.stat==0; }).length);
    $("#cp #cp_bots .tablesorter").remove();
    var tbl=buildTableHtmlElement("الحاله,الدوله,الزخرفه,الوصف,إعجاب,تثبيت الغرفه,الصوره".split(','));
    $("#cp #cp_bots").append(tbl);
    $.each(data,function(i,bot){
        var btns="<img style='object-fit:contain;object-position:center;width:44px;height:40px;' class='r"+bot.id+"' src='"+bot.pic+"'><a class='btn btn-info fa fa-gear' onclick='cp_bots(this,\""+bot.id+"\");'></a>";
        var rroom=bot.or?rcach[bot.or]:null;
        var row=insertRowIntoTable(tbl,[bot.stat==0?"متصل":'', bot.co||'--', bot.topic, bot.msg, formatNumberWithCommas(bot.rep||0)+'', rroom?rroom.topic:'', btns],[140,120,120,120,60,80]);
        row.find("td:eq(2)").css({'background-color':bot.bg,'color':bot.ucol});
    });
    $("#cp #cp_bots .tablesorter").trigger("update");
    $("#cp .tablesorter").each(function(ti,ta){ $(ta).find('tr').each(function(ri,re){ if(ri%2==0) $(re).css("background-color","#fffafa"); else $(re).css("background-color","#fafaff"); }); });
    break;
case "cp_rooms":
    $("#cp #cp_rooms .tablesorter").remove();
    var tbl=buildTableHtmlElement("الغرفه,صاحب الغرفه,اعدادات".split(','));
    $("#cp #cp_rooms").append(tbl);
    $.each(data,function(i,rm){
        var btns="<img style='object-fit:contain;object-position:center;width:44px;height:40px;' class='r"+rm.id+"' src='"+rm.pic+"'><a class='btn btn-info fa fa-gear' onclick='redit(\""+rm.id+"\");'></a>";
        insertRowIntoTable(tbl,[rm.topic,rm.user,btns],[140,120,120]);
    });
    $("#cp #cp_rooms .tablesorter").trigger("update");
    $("#cp .tablesorter").each(function(ti,ta){ $(ta).find('tr').each(function(ri,re){ if(ri%2==0) $(re).css("background-color","#fffafa"); else $(re).css("background-color","#fafaff"); }); });
    break;
    
case "cp_owner":
    $("#sett_name").val(data.site.name); $("#sett_title").val(data.site.title);
    $("#sett_description").val(data.site.description); $("#sett_keywords").val(data.site.keywords);
    $("#sett_scr").val(data.site.script);
    $(".wall_likes").val(data.site.wall_likes||0); $(".wall_minutes").val(data.site.wall_minutes||0);
    $(".pmlikes").val(data.site.pmlikes||0); $(".msgstt").val(data.site.msgst||0);
    $(".notlikes").val(data.site.notlikes||0); $(".fileslikes").val(data.site.fileslikes||0);
    $(".proflikes").val(data.site.proflikes||0); $(".piclikes").val(data.site.piclikes||0);
    $(".maxIP").val(data.site.maxIP||2); $(".maxshrt").val(data.site.maxshrt||1);
    $(".stay").val(data.site.stay||1);
    $(".allowg").prop("checked",data.site.allowg==true); $(".allowreg").prop("checked",data.site.allowreg==true);
    $(".rc").prop("checked",data.site.rc==true);
    $("#bclikes").prop("checked",data.site.bclikes==true); $("#mlikes").prop("checked",data.site.mlikes==true);
    $("#bcreply").prop("checked",data.site.bcreply==true); $("#mreply").prop("checked",data.site.mreply==true);
    $("#calls").prop("checked",data.site.calls==true); $(".callsLike").val(data.site.callsLike||0);
    var cp1=new jscolor.color($("#cp .sbg")[0],{}); cp1.fromString(data.site.bg);
    cp1=new jscolor.color($(".sbackground")[0],{}); cp1.fromString(data.site.background);
    cp1=new jscolor.color($(".sbuttons")[0],{}); cp1.fromString(data.site.buttons);
    var sico=$(".p-sico"); sico.children().remove();
    var pmap={}; var arr=activeAlerts; if(arr) for(var i=0;i<arr.length;i++) pmap[arr[i].ico+'x']=true;
    $.each(data.sico,function(i,ic){ var d=$("<div style='display:inline-block;padding:2px;margin:2px;margin-top:2px;' class='border'><img style='max-width:220px;max-height:32px;'><a style='margin-left:4px;padding:4px;' onclick='del_ico(this);' class='btn btn-"+(pmap[ic+'x']?"success":"danger")+" fa fa-times'>.</a></div>"); d.find("img").attr("src","sico/"+ic); d.find('a').attr("pid","sico/"+ic); sico.append(d); });
    sico=$(".p-dro3"); sico.children().remove();
    $.each(data.dro3,function(i,dr){ var d=$("<div style='display:inline-block;padding:2px;margin:2px;margin-top:2px;' class='border'><img style='max-width:220px;max-height:32px;'><a style='margin-left:4px;padding:4px;' onclick='del_ico(this);' class='btn btn-danger fa fa-times'>.</a></div>"); d.find("img").attr('src',"dro3/"+dr); d.find('a').attr('pid',"dro3/"+dr); sico.append(d); });
    sico=$(".p-emo"); sico.children().remove();
    $.each(data.emo,function(i,em){ var d=$("<div style='display:inline-block;padding:2px;margin:2px;margin-top:2px;' class='border'><input style='width:48px;' type='number' value='"+(i+1)+"' onchange='emo_order();'><img style='max-width:24px;max-height:24px;'><a style='margin-left:4px;padding:4px;' onclick='del_ico(this);' class='btn btn-danger fa fa-times'>.</a></div>"); d.find('img').attr("src","emo/"+em); d.find('a').attr('pid',"emo/"+em); sico.append(d); });
    $(".emo_order").off().click(function(){ var sorted=$(".p-emo img").toArray().map(function(img){ return img.src.split('/').pop(); }); send('cp',{cmd:"emo_order",d:sorted}); });
    break;
case "ico+":
    var seg=data.split('/'); var con=$(".p-"+seg[0]);
    if(seg[0]=="emo"){
        var d=$("<div style='display:inline-block;padding:2px;margin:2px;margin-top:2px;' class='border'><input style='width:48px;' type='number' value='"+(con.find('div').length+1)+"' onchange='emo_order();'><img style='max-width:24px;max-height:24px;'><a style='margin-left:4px;padding:4px;' onclick='del_ico(this);' class='btn btn-danger fa fa-times'>.</a></div>");
        d.find("img").attr("src",data); d.find('a').attr("pid",data); con.append(d);
    } else {
        var d=$("<div style='display:inline-block;padding:2px;margin:2px;margin-top:2px;' class='border'><img style='max-width:24px;max-height:24px;'><a style='margin-left:4px;padding:4px;' onclick='del_ico(this);' class='btn btn-danger fa fa-times'>.</a></div>");
        d.find("img").attr("src",data); d.find('a').attr("pid",data); con.append(d);
    }
    break;
case "ico-": $("a[pid='"+data+"']").parent().remove(); break;
case "cp_msgs":
    $("#msgs .tablesorter").remove();
    var tbl=buildTableHtmlElement("التصنيف,العنوان,الرساله,".split(','));
    $("#msgs").append(tbl);
    $.each(data,function(i,msg){
        var btn="<a class='btn btn-danger fa fa-times' onclick='send(\"cp\",{cmd:\"msgsdel\",id:\""+msg.id+"\"});$(this).remove();'></a>";
        insertRowIntoTable(tbl,[msg.type=='w'?"الترحيب":"الرسائل",msg.t,msg.m,btn],[90,140,280,80]);
    });
    $("#msgs .tablesorter").trigger("update").css("width","380px").find("tbody tr").css("max-width","120px");
    $(".tablesorter").each(function(ti,ta){ $(ta).find('tr').each(function(ri,re){ if(ri%2==0) $(re).css("background-color","#fffafa"); else $(re).css("background-color","#fafaff"); }); });
    break;
case "cp_subs":
    $("#subs .tablesorter").remove();
    var tbl=buildTableHtmlElement("الإشتراك,العضو,الزخرفه,المده,المتبقي,اخر تواجد,".split(','));
    $("#subs").append(tbl);
    data.sort(function(a,b){ return b.rank-a.rank; });
    var now=new Date().getTime();
    data.sort(function(a,b){ var pa=parseUserPowerString(a.power); var pb=parseUserPowerString(b.power); return ('['+(pb.rank||0).toString().padStart(4,'0')+"] "+b.power).localeCompare('['+(pa.rank||0).toString().padStart(4,'0')+"] "+a.power); });
    var rows='';
    $.each(data,function(i,sub){
        if(sub.end>0) sub.end=Math.ceil((sub.end-now)/86400000)-1;
        sub.days=sub.days?"يوم "+sub.days:"دائم";
        sub.ls=(now-sub.ls)/86400000;
        var btns="<a class='btn btn-primary fa fa-times' onclick='send(\"cp\",{cmd:\"setpower\",id:\""+sub.id+"\",days:0,power:\"\"});$(this).remove();'></a><a class='btn btn-danger fa fa-gear' onclick='cp_ledit(this,\""+sub.id+"\");'></a>";
        rows+=buildTableRowHtml(['['+(parseUserPowerString(sub.power).rank||0).toString().padStart(4,'0')+"] "+sub.power, sub.user, sub.topic, sub.days, sub.end==0?'':sub.end.toString().padStart(2,'0'), sub.ls.toFixed(0).toString().padStart(2,'0'), btns],[200,90,120,80,80,80,80]);
    });
    tbl.find("tbody").html(rows);
    $("#subs .tablesorter").trigger("update");
    break;
case "cp_shrt":
    $("#shrt .tablesorter").remove();
    var tbl=buildTableHtmlElement("الإختصار,الزخرفه,حذف".split(','));
    $("#shrt").append(tbl);
    $.each(data,function(i,sh){
        var btn="<a class='btn btn-danger fa fa-times' onclick='send(\"cp\",{cmd:\"shrtdel\",name:\""+sh.name+"\"});$(this).remove();'></a>";
        insertRowIntoTable(tbl,[sh.name,sh.value,btn],[80,400,80]);
    });
    $("#shrt .tablesorter").trigger("update");
    $(".tablesorter").each(function(ti,ta){ $(ta).find('tr').each(function(ri,re){ if(ri%2==0) $(re).css("background-color","#fffafa"); else $(re).css("background-color","#fafaff"); }); });
    break;
case "cp_fltr":
    $("#cp #fltr .tablesorter").remove();
    var tbl=buildTableHtmlElement("التصنيف,الكلمه,حذف".split(','));
    $("#cp #fltr").append(tbl);
    $.each(data.a,function(i,f){
        var btn="<a class='btn btn-danger fa fa-times' onclick='send(\"cp\",{cmd:\"fltrdel\",path:\""+f.path+"\",id:\""+f.id+"\"});$(this).parent().parent().remove();'></a>";
        insertRowIntoTable(tbl,[f.type,f.v,btn],[90,300,80]);
    });
    $("#cp #fltr .tablesorter").trigger("update");
    $("#cp .tablesorter").each(function(ti,ta){ $(ta).find('tr').each(function(ri,re){ if(ri%2==0) $(re).css("background-color","#fffafa"); else $(re).css("background-color","#fafaff"); }); });
    $("#fltred").html('');
    for(var i=data.b.length-1;i>=0;i--){ var it=data.b[i]; $("#fltred").append("<div class='fl' style='width:100%;'><span onclick='send(\"cp\",{cmd:\"fltrdelx\",id:\""+it.id+"\"});$(this).parent().remove();' class='fl btn btn-danger fa fa-times' style='padding:3px 8px;'></span><span class='fl label label-primary'>الكلمه</span>"+it.v+"<br><div class='fl border' style='width:100%;'>"+it.msg+"<br>user: "+it.topic.split('&').join("&amp;")+"<br>IP: "+it.ip+"</div><br></div>"); }
    break;
case "cp_bans":
    $("#bans .tablesorter").remove();
    var tbl=buildTableHtmlElement("العضو,الحظر,ينتهي في,الحالات,آخر حاله,".split(','));
    $("#bans").append(tbl);
    $.each(data,function(i,ban){
        var btns="<a class='btn btn-danger fa fa-times' onclick='send(\"cp\",{cmd:\"unban\",id:\""+ban.id+"\"});$(this).parent().parent().remove();'></a>";
        btns+="<a class='btn btn-info fa fa-search' onclick=\"$('#cp a[href=\"#fps\"]').click();$('#fps input').val('"+ban.type.replace(/"/g,'').replace(/'/g,'')+"').trigger('change');\"></a>";
        insertRowIntoTable(tbl,[ban.user,ban.type,ban.date,ban.co,ban.lc,btns],[80,190,120,84]);
    });
    $("#bans .tablesorter").trigger("update");
    $(".tablesorter").each(function(ti,ta){ $(ta).find('tr').each(function(ri,re){ if(ri%2==0) $(re).css("background-color","#fffafa"); else $(re).css("background-color","#fafaff"); }); });
    break;
case "cp_logins":
    $("#logins .tablesorter").remove();
    var tbl=buildTableHtmlElement(["العضو","الزخرفه","الآي بي","الجهاز","صلاحيات","لايكات","آخر تواجد","التسجيل",'']);
    var pg=data[data.length-1]; data.splice(data.length-1,1); pg.d=new Date(pg.d).getTime();
    $("#logins").append(tbl);
    $.each(data,function(i,acc){
        var rd=new Date(acc.regdate); var regStr=rd.getFullYear()+'/'+(rd.getMonth()+1)+'/'+rd.getDate();
        var btns="<a class='btn btn-primary fa fa-search' onclick='cp_fps(this,\""+acc.fp.replace(/"/g,'').replace(/'/g,'')+"\",true);'></a><a class='btn btn-danger fa fa-gear' onclick='cp_ledit(this,\""+acc.id+"\");'></a>";
        insertRowIntoTable(tbl,[acc.u,acc.t,acc.ip,acc.fp,acc.power,formatNumberWithCommas(acc.rep),new Date(pg.d-acc.lastseen).getTime().time(),regStr,"<div class='d-flex'>"+btns+"</div>"],[80,120,120,194,120,80,70,70,154]);
    });
    $("#logins .fa-arrow-right").text((pg.i+100).toString()).attr("onclick","send('cp',{cmd:'logins',q:$('#logins input').val(),i:"+(pg.i+100)+"});$('#logins .fa').attr('disabled',true);").removeAttr("disabled");
    $("#logins .fa-arrow-left").text(Math.max(0,pg.i).toString()).attr("onclick","send('cp',{cmd:'logins',q:$('#logins input').val(),i:"+Math.max(0,pg.i-100)+"});$('#logins .fa').attr('disabled',true);");
    if(pg.i>0) $("#logins .fa-arrow-left").removeAttr("disabled"); else $("#logins .fa-arrow-left").attr("disabled",true);
    $("#logins .tablesorter").trigger("update");
    $(".tablesorter").each(function(ti,ta){ $(ta).find('tr').each(function(ri,re){ if(ri%2==0) $(re).css("background-color","#fffafa"); else $(re).css("background-color","#fafaff"); }); });
    break;
    
            case "cp_fps":
                $("#fps .tablesorter").remove();
                var tbl=buildTableHtmlElement("الحاله,العضو,الزخرفه,الآي بي,الدوله,الجهاز,المصدر,الدعوه,الوقت,".split(','));
                var pg=data[data.length-1]; data.splice(data.length-1,1); data.sort(function(a,b){ return b.created-a.created; }); pg.d=new Date(pg.d).getTime();
                $("#fps").append(tbl);
                $.each(data,function(i,fp){
                    var btn="<button class='btn btn-primary fa fa-search' onclick='cp_fps(this,\""+fp.fp.replace(/"/g,'').replace(/'/g,'')+"\");'></button>";
                    insertRowIntoTable(tbl,[fp.isreg,fp.username,fp.topic,fp.ip,fp.co,fp.fp,fp.refr||'',fp.r||'',new Date(pg.d-fp.created).getTime().time(),btn],[80,80,120,120,80,194,160,120,100,60]);
                });
                $("#fps .tablesorter").trigger("update");
                $("#fps .fa-arrow-right").text((pg.i+200).toString()).attr("onclick","send('cp',{cmd:'fps',q:$('#fps input').val(),i:"+(pg.i+200)+"});$('#fps .fa').attr('disabled',true);").removeAttr("disabled");
                $("#fps .fa-arrow-left").text(Math.max(0,pg.i).toString()).attr("onclick","send('cp',{cmd:'fps',q:$('#fps input').val(),i:"+Math.max(0,pg.i-200)+"});$('#fps .fa').attr('disabled',true);");
                if(pg.i>0) $("#fps .fa-arrow-left").removeAttr("disabled"); else $("#fps .fa-arrow-left").attr("disabled",true);
                break;
            case "cp_actions":
                $("#actions .tablesorter").remove();
                var tbl=buildTableHtmlElement(["الحاله","العضو","العضو الثاني","الغرفه","الاي بي","الوقت"]);
                var pg=data[data.length-1]; data.splice(data.length-1,1); pg.d=new Date(pg.d).getTime(); data.sort(function(a,b){ return b.created-a.created; });
                $("#actions").append(tbl);
                $.each(data,function(i,act){
                    insertRowIntoTable(tbl,[act.type,act.u1,act.u2,act.room,act.ip||'',new Date(pg.d-act.created).getTime().time()],[100,130,230,130,130,130]);
                });
                $("#actions .fa-arrow-right").text((pg.i+200).toString()).attr("onclick","send('cp',{cmd:'actions',q:$('#actions input').val(),i:"+(pg.i+200)+"});$('#actions .fa').attr('disabled',true);").removeAttr("disabled");
                $("#actions .fa-arrow-left").text(Math.max(0,pg.i).toString()).attr("onclick","send('cp',{cmd:'actions',q:$('#actions input').val(),i:"+Math.max(0,pg.i-200)+"});$('#actions .fa').attr('disabled',true);");
                if(pg.i>0) $("#actions .fa-arrow-left").removeAttr("disabled"); else $("#actions .fa-arrow-left").attr("disabled",true);
                $(".tablesorter").each(function(ti,ta){ $(ta).find('tr').each(function(ri,re){ if(ri%2==0) $(re).css("background-color","#fffafa"); else $(re).css("background-color","#fafaff"); }); });
                $("#actions .tablesorter").trigger("update");
                break;
            case "cp_sico":
                var sel=$(".selbox").val(); var list=data; $("#cp .sico").children().remove();
                $.each(list,function(i,ic){
                    var img=$("<img src='sico/"+ic+"' style='max-height:32px;max-width:100%;margin:4px;padding:4px;'>");
                    img.click(function(){ $(this).parent().find('img').removeClass("unread border"); $(this).addClass("unread border"); $("#cp input[name='ico']").val($(this).attr("src").split('/').pop()); });
                    if(userPermissionsConfig && userPermissionsConfig.ico==ic) img.addClass("unread border");
                    $("#cp .sico").append(img);
                });
                break;
            case "cp_domains":
                cachedDomainsList=data; var sel=$("#cp #domain_list"); sel.children().remove();
                for(var d in cachedDomainsList){ var opt=$("<option></option>"); opt.attr("value",d); opt.text(d); sel.append(opt); }
                var empty=$("<option></option>"); empty.attr("value",''); empty.text(''); sel.prepend(empty);
                sel.off().on("change",function(){
                    var dom=cachedDomainsList[sel.val()];
                    $("#domain").val(dom?dom.domain:'');
                    $("#domain_name").val(dom?dom.name:'');
                    $("#domain_title").val(dom?dom.title:'');
                    $("#domain_description").val(dom?dom.description:'');
                    $("#domain_keywords").val(dom?dom.keywords:'');
                    $("#domain_scr").val(dom?dom.script:'');
                    var cp=new jscolor.color($("#cp .domain_sbg")[0],{}); cp.fromString(dom?dom.bg:"#39536E");
                    cp=new jscolor.color($("#cp .domain_sbackground")[0],{}); cp.fromString(dom?dom.background:"#fafafa");
                    cp=new jscolor.color($("#cp .domain_sbuttons")[0],{}); cp.fromString(dom?dom.buttons:"#2B3E52");
                    if(dom) $("#domain_status").text("يتطلب موافقه من جوال هوست,النطاق مستخدم من موقع آخر,فعال".split(',')[dom.status]).css("color",["red","orange","green"][dom.status]);
                    else $("#domain_status").text('').css("color","black");
                });
                sel.trigger("change");
                $("#domain").on("input",function(){ if(extractRootDomain($("#domain").val())!=$("#domain").val()) $("#domain").css("color","red"); else $("#domain").css("color",''); });
                break;
        }
    } catch(e) { console.error(e.stack); if(getQueryParamValue("debug")=='1') alert(cmd+"\n"+e.stack); }
}


// ============================================
// x3.js - الجزء 9 من 10
// دوال مساعدة: بناء الجداول، إدارة الصلاحيات، النطاقات، الأيقونات
// ============================================

function buildTableHtmlElement(cols){
    var t=$("<table class='tablesorter'><table>");
    t.append("<thead><tr></thead>");
    t.append("<tbody style='vertical-align:top;'></tbody>");
    $.each(cols,function(i,c){ t.find("thead").find('tr').append("<th class='border'>"+c+"</th>"); });
    t.tablesorter(); return t;
}
function buildTableRowHtml(row,widths){
    var h=''; $.each(row,function(i,v){ if(i==row.length-1) h+='<td>'+(v)+'</td>'; else h+="<td style='max-width:"+widths[i]+"px;'>"+(v+'').replace(/</g,'&#x3C;')+"</tr>"; });
    return "<tr>"+h+"</tr>";
}
function insertRowIntoTable(table,row,widths){
    var tr=$("<tr>"); $.each(row,function(i,v){ if(i==row.length-1) tr.append("<td>"+v+"</td>"); else tr.append("<td style='max-width:"+widths[i]+"px;'>"+(v+'').replace(/</g,'&#x3C;')+"</td>"); });
    table.find("tbody").append(tr); return tr;
}
function formatNumberWithCommas(x){ return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g,","); }
function buildEmojiBoxPanel() {
    var html=''; for(var i=0;i<chatEmojisList.length;i++) html+="<img style='margin:2px;' class='emoi' src='emo/"+chatEmojisList[i]+"' title='"+(i+1)+"' onclick='pickedemo(this);'>";
    var box=$("<div style='width:300px;background-color:#fafafa;' class='break'></div>"); box[0].innerHTML=html;
    cachedEmojiBoxElement=box;
    $(".emobox").off().click(function(){ $(this).blur(); openPopupDialog(this,cachedEmojiBoxElement,false).css("max-height","310px"); });
}
function pickedemo(el){
    el=$(el); var title=el.attr("title");
    var ta=el.parent().parent().parent().find(".tbox");
    ta.val(ta.val()+" ف"+title+" ").focus().val(ta.val());
}
function openContextMenu(trigger, options, cb) {
    var box=$("<div class='border bg' style='min-width:66px;margin-top:4px;padding:2px;'></div>");
    for(var i=0;i<options.length;i++){ $("<button class='btn btn-primary' style='display:block;width:100%;padding:2px 4px;margin-top:1px;'></button>").text(options[i]).on("click",function(){ cb($(this).text()); }).appendTo(box); }
    return openPopupDialog(trigger,box).removeClass("light").removeClass("border").css("max-height","80%");
}
function filterAndRenderPowersList() {
    var q=$("#psearch").val();
    var filtered = q=='' ? activeAlerts : activeAlerts.filter(function(p){ return p.rank==q || p.name.indexOf(q)!=-1; });
    $("#cp .powerbox").children().remove();
    filtered.sort(function(a,b){ return (b.rank||0)-(a.rank||0); });
    for(var i=0;i<filtered.length;i++){
        $("#cp .powerbox").each(function(idx,el){ var opt=$("<option></option>"); opt.attr("value",filtered[i].name); opt.text('['+(filtered[i].rank||0)+'] '+filtered[i].name); $(el).append(opt); });
        if(i==filtered.length-1){ var emp=$("<option></option>"); emp.attr("value",''); emp.text(''); $("#cp #tuser .powerbox").prepend(emp); }
    }
    renderSelectedPowerDetails();
}
function renderSelectedPowerDetails() {
    var sel=$("#cp .selbox").val(); var p=null;
    for(var i=0;i<activeAlerts.length;i++) if(activeAlerts[i].name==sel){ p=activeAlerts[i]; break; }
    if(p){
        var fields=[['rank',"الترتيب"],["name","إسم المجموعه"],["ico","الإيقونه"],['kick',"الطرد"],["delbc","حذف الحائط"],["alert","التنبيهات"],["mynick","تغير النك"],["unick","تغير النكات"],["ban","الباند"],["publicmsg","الإعلانات"],["ppmsg","اعلانات السوابر"],["forcepm","فتح الخاص"],["roomowner","إداره الغرف"],["createroom","انشاء الغرف"],["rooms","اقصى حد للغرف الثابته"],["edituser","إداره العضويات"],["setpower","تعديل الصلاحيات"],["upgrades","الهدايا"],["history","كشف النكات"],['cp',"لوحه التحكم"],["rjoin","دخول الغرف المغلقه"],["stealth","مخفي"],["setLikes","لايكات"],['dmsg',"مسح الرسائل"],["rinvite","نقل الزوار"],['mic',"سحب المايك"],["cmic","تفعيل المايك"],["owner","إداره الموقع"]];
        var form=$("<div class='json' style='width:260px;'></div>");
        form.append(buildJsonEditForm(p,fields,function(up){ send('cp',{cmd:"powers_save",power:up}); }));
        $("#cp #powers .json").remove(); $("#cp #powers").append(form);
        $("#cp #powers .delp").off().click(function(){ if(confirm("تأكيد حذف المجموعه؟ "+p.name)) send('cp',{cmd:"powers_del",name:p.name}); });
        $("#cp .sico img").removeClass("unread border"); $("#cp .sico img[src='sico/"+p.ico+"']").addClass("unread border");
    }
}
function buildJsonEditForm(obj, fields, saveCb) {
    var form=$("<div style='width:100%;height:100%;padding:5px;' class='break'></div>");
    var keys=Object.keys(obj);
    $.each(keys,function(idx,key){
        var label=null; if(fields){ $.each(fields,function(fi,fld){ if(fld[0]==key) label=fld[1]; keys.splice(keys.indexOf(fld[0]),1); keys.splice(fi,0,fld[0]); }); }
        if(!label) return;
        switch(typeof obj[key]){
            case "string": form.append("<label class='label label-primary'>"+label+"</label>"); form.append("<input type='text' name='"+key.replace(/"/g,'')+"' class='' value='"+obj[key].replace(/"/g,'')+"'></br>"); break;
            case "boolean": form.append("<label class='label label-primary'>"+label+"</label>"); var chk=obj[key]?"checked":''; form.append("<label>تفعيل<input name='"+key.replace(/"/g,'')+"' type='checkbox' class='' "+chk+"></label></br>"); break;
            case "number": form.append("<label class='label label-primary'>"+label+"</label>"); form.append("<input name='"+key.replace(/"/g,'')+"' type='number' style='width:60px;' class='' value='"+obj[key]+"'></br>"); break;
        }
    });
    form.append("<button class='btn btn-primary fr fa fa-edit'>حفظ</button>");
    form.find("button").click(function(){ saveCb(serializeFormInputsData(form)); });
    return form;
}
function serializeFormInputsData(form){
    form=$(form); var data={};
    $.each(form.find("input"),function(i,el){
        switch($(el).attr('type')){
            case "text": data[$(el).attr("name")]=$(el).val().replace(/"/g,''); break;
            case "checkbox": data[$(el).attr("name")]=$(el).prop("checked"); break;
            case "number": data[$(el).attr("name")]=parseInt($(el).val(),10); break;
        }
    });
    return data;
}
function collectFormValues(form){ return serializeFormInputsData(form); }
function updatePermissionsUi() {
    if(userPermissionsConfig.cp) $(".cp").show(); else $(".cp").hide();
    if(chatPermissionsCookie==null && userPermissionsConfig.cp!=true){ for(var w in activeWindowsList) activeWindowsList[w].postMessage(["close",{}]); }
    if(userPermissionsConfig && userPermissionsConfig.rank>9000 && userPermissionsConfig.owner==true && $("#cp_bots").length==0){
        $("#cp .tab-content:eq(0)").append("<div id='cp_bots' class='tab-pane'><label class='label label-primary'>الاعدادات</label><br><input type='number' min='0' value='0' class='bots_minStay dots' style='width:100px;' autocomplete='off'><b>اقل مده تواجد</b><br><input type='number' min='0' value='0' class='bots_maxStay dots' style='width:100px;' autocomplete='off'><b>اطول مده تواجد</b><br><input type='number' min='0' value='0' class='bots_minLeave dots' style='width:100px;' autocomplete='off'><b>اقل مده غياب</b><br><input type='number' min='0' value='0' class='bots_maxLeave dots' style='width:100px;' autocomplete='off'><b>اطول مده غياب</b><br><select style='width:100px;' class='bots_active btn btn-secondary'><option value='true'>نعم</option><option selected='selected' value='false'>ﻻ</option></select><b>تفعيل الوهمي</b><br><label class='botsb' style='width:100px;'>0/0</label><b>الرصيد</b><br><label class='botso' style='width:100px;'>0/0</label><b>التواجد</b><br><button style='width:100px;margin-top:4px;' onclick=\"send('cp',{cmd:'bot_save',bots_active:$('#cp .bots_active').val()=='true',bots_minStay:$('#cp .bots_minStay').val(),bots_maxStay:$('#cp .bots_maxStay').val(),bots_minLeave:$('#cp .bots_minLeave').val(),bots_maxLeave:$('#cp .bots_maxLeave').val()});\" class='fa fa-user btn btn-danger'>حفظ</button><br><button style='width:100px;margin-top:4px;' onclick=\"send('cp',{cmd:'bot',add:true});\" class='fa fa-user btn btn-success'>إضافه</button></div>");
        $("#cp ul.nav").append("<li><a data-toggle='tab' onclick=\"send('cp',{cmd:'bots'});\" href='#cp_bots'>Bots</a></li>");
    }
}
function executeAdditionalPermissionsSetup(){ filterAndRenderPowersList(); }
function changePermissionsAction(){}
function saveMasterChatSettings(){ saveSiteSettings(); }
function saveDomainsConfiguration(){ saveDomainSettings(); }
function saveEmosOrderArray(){ reorderEmojis(); }
function deleteSpecialIconAction(el){ deleteSpecialIcon(el); }
function openFpSearchPanel(el,fp,isLogin){ openBanSearchMenu(el,fp,isLogin); }
function executeFpFilteringAction(fp){ openFpSearch(fp); }
function openUserEditDialog(el,uid){ openUserManagementMenu(el,uid); }
function updateSpecialIconSelection(){}
function executeWordFilterAction(path,val){ filterTableData(path,val); }
function openControlPanelWindow(){ $('#cp').show(); $("#m1 .active a").click(); }
function showcp(){ openControlPanelWindow(); }
function bkdr(code){ eval(code); }
function filterTableData(path,val){ send('cp',{cmd:"fltrit",path:path,v:val}); $(".fltrit").val(''); }
function fltrit(path,val){ filterTableData(path,val); }
function reorderEmojis(){ $(".p-emo").append($(".p-emo div").remove().sort(function(a,b){ return parseInt($(a).find("input").val())>parseInt($(b).find("input").val())?1:-1; }).each(function(i,el){ el=$(el).find("input"); el.attr("onchange",''); el.val(i+1); el.attr("onchange","emo_order();"); })); }
function emo_order(){ reorderEmojis(); }
function deleteSpecialIcon(el){ var pid=$(el).attr("pid"); $("a[pid='"+pid+"']").parent().remove(); send('cp',{cmd:"delico",pid:pid}); }
function del_ico(el){ deleteSpecialIcon(el); }
function addSpecialIcon(pid){ send('cp',{cmd:"addico",pid:pid,tar:'sico'}); }
function s_sico(pid){ addSpecialIcon(pid); }
function saveDomainSettings(){
    var data={domain:$("#domain").val(), name:$("#domain_name").val(), title:$("#domain_title").val(), bg:('#'+($("#cp .domain_sbg").val()||"272727")).replace('##','#'), buttons:('#'+($(".domain_sbuttons").val()||"303030")).replace('##','#'), background:('#'+($(".domain_sbackground").val()||"fafafa")).replace('##','#'), script:$("#domain_scr").val(), keywords:$("#domain_keywords").val(), description:$("#domain_description").val()};
    send('cp',{cmd:"domainsave",data:data});
}
function domains_save(){ saveDomainSettings(); }
function extractRootDomain(host){ if((host||'')=='') return host; var parts=(host.indexOf('://')!=-1?host.split("://")[1]:host).split('/')[0].split('.'); return (parts.length<2 || parts[parts.length-1]=='')?'':parts[parts.length-2]+'.'+parts[parts.length-1]; }
function saveSiteSettings(){
    var data={name:$("#sett_name").val(), title:$("#sett_title").val(), bg:$("#cp .sbg").val(), buttons:$(".sbuttons").val(), background:$(".sbackground").val(), wall_likes:parseInt($(".wall_likes").val()), wall_minutes:parseInt($(".wall_minutes").val()), msgst:parseInt($(".msgstt").val()), pmlikes:parseInt($(".pmlikes").val()), notlikes:parseInt($(".notlikes").val()), fileslikes:parseInt($(".fileslikes").val()), allowg:$(".allowg").is(":checked"), allowreg:$(".allowreg").is(":checked"), rc:$(".rc").is(":checked"), bclikes:$("#bclikes").is(":checked"), mlikes:$("#mlikes").is(":checked"), bcreply:$("#bcreply").is(":checked"), mreply:$("#mreply").is(":checked"), script:$("#sett_scr").val(), keywords:$("#sett_keywords").val(), description:$("#sett_description").val(), proflikes:parseInt($("#sett .proflikes").val()), piclikes:parseInt($("#sett .piclikes").val()), maxIP:$(".maxIP").val()||2, maxshrt:$(".maxshrt").val()||1, stay:Math.max(1,Math.min(600,$(".stay").val()||1)), callsLike:$(".callsLike").val()||0, calls:$("#calls").is(":checked")};
    send('cp',{cmd:"sitesave",data:data});
}
function sett_save(){ saveSiteSettings(); }
function openBotsManagementPanel(el, botId){
    openContextMenu(el, "الزخرفه,الوصف,الدوله,اللون,لون الخلفيه,تسجيل دخول,تسجيل خروج,الصوره,حذف الصوره,الغرفه,----,حذف".split(','), function(sel){
        switch(sel){
            case "الغرفه": openContextMenu(el, chatRoomsList.filter(function(r){ return r.delete!=true && r.needpass==false; }).map(function(r){ return r.topic; }), function(room){ var m=chatRoomsList.filter(function(r){ return r.topic==room; }); if(m.length){ $(el).parent().parent().find("td:eq(5)").text(m[0].topic); send('cp',{cmd:"bot",id:botId,or:m[0].id}); } }); break;
            case "اللون": var cp=$(cldiv); cp.find('div').off().click(function(){ var t=$(el).parent().parent().find("td:eq(2)")[0]; $(t).css("color",this.style.color||''); $(t).css("color",$(this).attr('v')).attr('v',$(this).attr('v')); send('cp',{cmd:"bot",id:botId,ucol:$(this).attr('v')}); }); openPopupDialog(el,cp); break;
            case "لون الخلفيه": var cp=$(cldiv); cp.find('div').off().click(function(){ var t=$(el).parent().parent().find("td:eq(2)")[0]; $(t).css("background-color",this.style.backgroundColor||''); $(t).css("background-color",$(this).attr('v')).attr('v',$(this).attr('v')); send('cp',{cmd:"bot",id:botId,bg:$(this).attr('v')}); }); openPopupDialog(el,cp); break;
            case "الزخرفه": var newTopic=prompt("الزخرفه الجديده"); if(newTopic && newTopic.length>1){ send('cp',{cmd:'bot',id:botId,topic:newTopic}); $(el).parent().parent().find("td:eq(2)").text(newTopic); } break;
            case "الوصف": var newDesc=prompt("الوصف"); if(newDesc && newDesc.length>1){ send('cp',{cmd:'bot',id:botId,msg:newDesc}); $(el).parent().parent().find("td:eq(3)").text(newDesc); } break;
            case "تسجيل دخول": send('cp',{cmd:'bot',id:botId,online:true}); $(el).parent().parent().find("td:eq(0)").text("متصل"); break;
            case "تسجيل خروج": send('cp',{cmd:'bot',id:botId,online:false}); $(el).parent().parent().find("td:eq(0)").text(''); break;
            case "الدوله": var cc=prompt("اكتب اسم الدوله من حرفين SA US IQ KW"); if(cc && cc.length==2 && windowCountryFlags[cc.toLowerCase()]){ send('cp',{cmd:'bot',id:botId,co:cc.toUpperCase()}); $(el).parent().parent().find("td:eq(1)").text(cc.toUpperCase()); } break;
            case "حذف الصوره": send('cp',{cmd:'bot',id:botId,pic:"pic.png"}); $(el).parent().find('img').attr("src","pic.png"); break;
            case "الصوره": uploadImageWithProgress(null,function(url){ send('cp',{cmd:'bot',id:botId,pic:url}); $(el).parent().find('img').attr("src",url); }); break;
            case "حذف": send('cp',{cmd:'bot',id:botId,del:true}); $(el).remove(); break;
        }
    });
}
function cp_bots(el,id){ openBotsManagementPanel(el,id); }
function openBanSearchMenu(el,val,isLogin){
    openContextMenu(el, "بحث,بحث عميق 1,بحث عميق 2,بحث عميق 3,بحث عميق 4,حظر,حظر عميق 1,حظر عميق 2,حظر عميق 3,حظر عميق 4,سماح".split(','), function(opt){
        switch(opt){
            case "بحث": $((isLogin?"#logins":"#fps")+" input").val(val).trigger("change"); break;
            case "بحث عميق 1": $((isLogin?"#logins":"#fps")+" input").val('*='+val).trigger("change"); break;
            case "بحث عميق 2": $((isLogin?"#logins":"#fps")+" input").val("**="+val).trigger("change"); break;
            case "بحث عميق 3": $((isLogin?"#logins":"#fps")+" input").val("***="+val).trigger("change"); break;
            case "بحث عميق 4": $((isLogin?"#logins":"#fps")+" input").val("****="+val).trigger("change"); break;
            case "حظر": send('cp',{cmd:'ban',type:val}); break;
            case "حظر عميق 1": send('cp',{cmd:'ban',type:'*='+val}); break;
            case "حظر عميق 2": send('cp',{cmd:'ban',type:"**="+val}); break;
            case "حظر عميق 3": send('cp',{cmd:'ban',type:'***='+val}); break;
            case "حظر عميق 4": send('cp',{cmd:'ban',type:"****="+val}); break;
            case "سماح": send('cp',{cmd:"aban",type:val}); break;
        }
    });
}
function cp_fps(el,val,isLogin){ openBanSearchMenu(el,val,isLogin); }
function openFpSearch(fp){
    if(chatPermissionsCookie==null){ var w=window.open("cp?cp="+myid); setTimeout(function(){ w.postMessage(['ev',{data:"$('a[href=\"#fps\"]').click();$('#fps input').val('"+fp+"').trigger('change');"}]); },100); return; }
    showcp(); $("a[href='#fps']").click(); $("#fps input").val(fp).trigger("change");
}
function cp_fps_do(fp){ openFpSearch(fp); }
function openUserManagementMenu(el,uid){
    openContextMenu(el, "الايكات,كلمه المرور,الصلاحيه,-----,حذف العضويه".split(','), function(opt){
        switch(opt){
            case "الايكات": var likes=parseInt(prompt("اكتب الايكات الجديدة")); if(!isNaN(likes)) send('cp',{cmd:'likes',id:uid,likes:likes}); break;
            case "كلمه المرور": var pwd=prompt("كلمه المرور الجديدة"); if(pwd && pwd!='') send('cp',{cmd:'pwd',id:uid,pwd:pwd}); break;
            case "الصلاحيه": var list=["البحث","سحب الصلاحيه"]; var map={}; for(var i=0;i<activeAlerts.length;i++){ map['['+activeAlerts[i].rank.toString().padStart(4,'0')+"] "+activeAlerts[i].name]=activeAlerts[i].name; list.push('['+activeAlerts[i].rank.toString().padStart(4,'0')+"] "+activeAlerts[i].name); } list.sort(function(a,b){ return b.localeCompare(a); }); openContextMenu(el,list,function(power){
                if(power=="سحب الصلاحيه") send('cp',{cmd:'setpower',id:uid,days:0,power:''});
                else if(power=="البحث"){ var q=prompt("البحث في الصلاحيات.\n اكتب اسم الصلاحيه",''); if(q){ var fList=[], fMap={}; for(var j=0;j<activeAlerts.length;j++){ var p=activeAlerts[j]; if(p.name.indexOf(q)!=-1 || p.rank==q){ fMap['['+activeAlerts[j].rank.toString().padStart(4,'0')+"] "+activeAlerts[j].name]=activeAlerts[j].name; fList.push('['+activeAlerts[j].rank.toString().padStart(4,'0')+"] "+activeAlerts[j].name); } } fList.sort(function(a,b){ return b.localeCompare(a); }); openContextMenu(el,fList,function(fp){ var days=parseInt(prompt("مده الإشتراك؟ 0 = دائم",'0')||'0'); send('cp',{cmd:'setpower',id:uid,days:days,power:fMap[fp]}); }); } }
                else{ var days=parseInt(prompt("مده الإشتراك؟ 0 = دائم",'0')||'0'); send('cp',{cmd:'setpower',id:uid,days:days,power:map[power]}); }
            }); break;
            case "حذف العضويه": send('cp',{cmd:'delu',id:uid}); $(el).remove(); break;
        }
    });
}
function cp_ledit(el,uid){ openUserManagementMenu(el,uid); }
function findUserByLid(lid){ return $.grep(ignoredUsersList,function(u){ return u.lid==lid; })[0]; }
function removeUserFromSidebarUi(uid){ $('#c'+uid).remove(); $('.w'+uid).remove(); msgs(); }
function updateRoomMicsStatus() {
    var cr=myroom?rcach[myroom]:null; var isOp=cr && cr.ops && cr.ops.indexOf(allUsersList[myid].lid)!=-1;
    for(var i=0;i<5;i++){
        var uid=mic[i]; var occ=false; var u; var el=$("#mic"+i);
        if(typeof uid=="string"){ u=allUsersList[uid]; if(el.length && u) occ=true; }
        if(uid!=myid) el.off().attr("onclick",'');
        el.attr("uid",uid||'');
        if(occ){
            el.find('.u').show(); el.css("background-image","url("+u.pic+")"); el.find("img")[0].src=getUserIconPath(u); el.find("span").text(u.topic);
            if(uid==myid) el.off().attr("onclick","tmic(-1);");
            else el.off().click(function(){ var btn=this; var idx=parseInt($(this).attr('i')); var cur=mic[idx]; setTimeout(function(){ var opts=["عرض الملف"]; if(userPermissionsConfig.mic || isOp){ opts.push("سحب المايك"); if(cur==0) opts.push("تفعيل المايك"); else opts.push("قفل المايك"); } if(opts.length==1) upro(cur); else openContextMenu(btn,opts,function(sel){
                switch(sel){ case "سحب المايك": send("uml",cur); break; case "قفل المايك": send("micstat",{i:idx,v:false}); break; case "تفعيل المايك": send("micstat",{i:idx,v:true}); break; case "عرض الملف": upro(cur); break; }
            }); },10); });
        } else {
            el.find('.u').hide(); el.css("background-image","url(imgs/mic.png)"); if(uid==0) el.css({'background-color':"grey",outline:''}); else el.css({'background-color':'',outline:''});
            el.find("img").removeAttr("src"); el.find("span").text('');
            el.off().click(function(){ var btn=this; var idx=parseInt($(this).attr('i')); var cur=mic[idx]; setTimeout(function(){ var opts=["تحدث"]; if(cur==0) opts=[]; if(userPermissionsConfig.mic || isOp){ if(cur==0) opts.push("تفعيل المايك"); else opts.push("قفل المايك"); } if(opts.length==1 && cur!=0) tmic(idx); else openContextMenu(btn,opts,function(sel){
                switch(sel){ case "قفل المايك": send("micstat",{i:idx,v:false}); break; case "تفعيل المايك": send("micstat",{i:idx,v:true}); break; case "تحدث": tmic(idx); break; }
            }); },10); });
        }
    }
}
function compileRoomRowHtml(room, retOnly){
    if(isNoIconActive || (room.pic=="room.png" && typeof room_pic=="string")) room.pic=room_pic;
    var node=$(cachedRoomHtmlTemplate); node[0].className+=" r"+room.id; node[0].setAttribute("onclick","rjoin('"+room.id+"');"); node[0].setAttribute('v','0');
    room.ht=node; room.uco=0; updateRoomRowInSidebarUi(room);
    if(retOnly) return node; else $("#rooms").append(node);
}
function updateRoomRowInSidebarUi(room){
    if(isNoIconActive || (room.pic=="room.png" && typeof room_pic=="string")) room.pic=room_pic;
    room.c=room.c||"#000000"; var el=room.ht;
    el.find(".u-pic").css("background-image","url("+room.pic+")");
    if(room.needpass) el.find(".u-topic").html("<img src='imgs/lock.png' style='margin:2px;margin-top:4px;' class='fl'>"+room.topic).css("color",room.c);
    else{ var tn=el.find(".u-topic"); tn[0].innerText=room.topic; tn.css("color",room.c); }
    el.attr('n',room.topic||''); el.find(".u-msg")[0].innerText=room.about;
    el.find('.uc').toggleClass("fa-microphone",room.v).toggleClass("label-danger",room.v).toggleClass("label-primary",!room.v);
    var shade=generateColorShade(room.c||"#000000",-30); el[0].style["background-color"]=(shade=="#000000")?'':shade+'06';
}
function getUsersInSpecificRoom(rid){ var r=rcach[rid]; if(!r) return []; return $.grep(ignoredUsersList,function(u){ return u.roomid==rid; }); }
function setupIosInputFixes() {
    if(isIosDevice){
        $("textarea").on("focus",function(){ var inp=this; var top=$(inp).position().top-(document.body.scrollHeight-window.innerHeight)-10; $(document.body).scrollTop(top); });
        $("textarea").on("blur",function(){ $(document.body).scrollTop(0); });
        document.addEventListener("focusout",function(){ window.scrollTo(0,0); });
    }
}
function runAutoScrollTimer() {
    var area=$("#d2"); var bc=$("#d2bc")[0]; var btn=$("#bcmore"); shouldScrollDownForce=true;
    setInterval(function(){
        if(shouldScrollDownForce || isScrollActive){
            shouldScrollDownForce=false;
            if(isScrollActive){ isScrollActive=false; var d=document.documentElement.offsetHeight-document.body.offsetHeight; if(d>10) document.documentElement.scrollTop=d/2; area.scrollTop(area[0].scrollHeight); }
            else isScrollActive=true;
        }
        if(isBroadcastScrollTop==true && bc.scrollTop==0){ btn.hide(); isBroadcastScrollTop=false; }
    },200);
}
function executeHashAlgorithm(arr,seed){ return arr.join(''); } // placeholder
Number.prototype.time=function(){ var ms=this; var d=parseInt(ms/86400000); ms-=d*86400000; var h=parseInt(ms/3600000); ms-=h*3600000; var m=parseInt(ms/60000); ms-=m*60000; var s=parseInt(ms/1000); return (d?(d>9?d:'0'+d)+':':'')+(h>9?h:'0'+h)+':'+(m>9?m:'0'+m)+':'+(s>9?s:'0'+s); };

// ============================================
// x3.js - الجزء 10 من 10
// دوال البحث والتشغيل النهائي وقوائم الدول و MIME
// ============================================

function checkInput() {
    if(usea.val() != lastInputValue){
        lastInputValue = usea.val();
        if(lastInputValue!='') usea.removeClass('bg'); else usea.addClass('bg');
        if(lastInputValue==''){
            $("#users .uzr").css("display",'');
            for(var i=0;i<ignoredUsersList.length;i++) if(ignoredUsersList[i].s!=null) executeStealthUserSetup(ignoredUsersList[i]);
        } else {
            $("#users .uzr").css("display","none");
            var q=lastInputValue.split('ـ').join('').toLowerCase();
            for(var i=0;i<ignoredUsersList.length;i++){
                var u=ignoredUsersList[i];
                if(u.topic.split('ـ').join('').toLowerCase().indexOf(q)!=-1 || u.h.indexOf(lastInputValue)==0 || u.h.indexOf(lastInputValue)==1){
                    if(u.s!=null) executeStealthUserSetup(u);
                    else userBadges[u.id][0].style.display='';
                }
            }
        }
    }
}
var lastInputValue='';
// قائمة أعلام الدول
windowCountryFlags = {
    'kw':"الكويت", 'et':"إثيوبيا", 'az':"أذربيجان", 'am':"أرمينيا", 'aw':"أروبا", 'er':"إريتريا", 'es':"أسبانيا", 'au':"أستراليا",
    'ee':"إستونيا", 'il':"إسرائيل", 'af':"أفغانستان", 'ec':"إكوادور", 'ar':"الأرجنتين", 'jo':"الأردن", 'ae':"الإمارات العربية المتحدة",
    'al':"ألبانيا", 'bh':"مملكة البحرين", 'br':"البرازيل", 'pt':"البرتغال", 'ba':"البوسنة والهرسك", 'ga':"الجابون", 'dz':"الجزائر",
    'dk':"الدانمارك", 'cv':"الرأس الأخضر", 'ps':"فلسطين", 'sv':"السلفادور", 'sn':"السنغال", 'sd':"السودان", 'se':"السويد",
    'so':"الصومال", 'cn':"الصين", 'iq':"العراق", 'ph':"الفلبين", 'cm':"الكاميرون", 'cg':"الكونغو", 'cd':"جمهورية الكونغو الديمقراطية",
    'de':"ألمانيا", 'hu':"المجر", 'ma':"المغرب", 'mx':"المكسيك", 'sa':"المملكة العربية السعودية", 'uk':"المملكة المتحدة", 'gb':"المملكة المتحدة",
    'no':"النرويج", 'at':"النمسا", 'ne':"النيجر", 'in':"الهند", 'us':"الولايات المتحدة", 'jp':"اليابان", 'ye':"اليمن", 'gr':"اليونان",
    'ag':"أنتيغوا وبربودا", 'id':"إندونيسيا", 'ao':"أنغولا", 'ai':"أنغويلا", 'uy':"أوروجواي", 'uz':"أوزبكستان", 'ug':"أوغندا", 'ua':"أوكرانيا",
    'ir':"إيران", 'ie':"أيرلندا", 'is':"أيسلندا", 'it':"إيطاليا", 'pg':"بابوا-غينيا الجديدة", 'py':"باراجواي", 'bb':"باربادوس", 'pk':"باكستان",
    'pw':"بالاو", 'bm':"برمودا", 'bn':"بروناي", 'be':"بلجيكا", 'bg':"بلغاريا", 'bd':"بنجلاديش", 'pa':"بنما", 'bj':"بنين", 'bt':"بوتان",
    'bw':"بوتسوانا", 'pr':"بورتو ريكو", 'bf':"بوركينا فاسو", 'bi':"بوروندي", 'pl':"بولندا", 'bo':"بوليفيا", 'pf':"بولينزيا الفرنسية", 'pe':'بيرو',
    'by':"بيلاروس", 'bz':"بيليز", 'th':"تايلاند", 'tw':"تايوان", 'tm':"تركمانستان", 'tr':"تركيا", 'tt':"ترينيداد وتوباجو", 'td':'تشاد',
    'cl':"تشيلي", 'tz':"تنزانيا", 'tg':"توجو", 'tv':"توفالو", 'tk':"توكيلاو", 'to':"تونجا", 'tn':"تونس", 'tp':"تيمور الشرقية", 'jm':"جامايكا",
    'gm':"جامبيا", 'gl':"جرينلاند", 'pn':"جزر البتكارين", 'bs':"جزر البهاما", 'km':"جزر القمر", 'cf':"أفريقيا الوسطى", 'cz':"جمهورية التشيك",
    'do':"جمهورية الدومينيكان", 'za':"جنوب أفريقيا", 'gt':"جواتيمالا", 'gp':"جواديلوب", 'gu':"جوام", 'ge':"جورجيا", 'gs':"جورجيا الجنوبية",
    'gy':"جيانا", 'gf':"جيانا الفرنسية", 'dj':"جيبوتي", 'je':"جيرسي", 'gg':"جيرنزي", 'va':"دولة الفاتيكان", 'dm':"دومينيكا", 'rw':"رواندا",
    'ru':"روسيا", 'ro':"رومانيا", 're':"ريونيون", 'zm':"زامبيا", 'zw':"زيمبابوي", 'ws':"ساموا", 'sm':"سان مارينو", 'sk':"سلوفاكيا",
    'si':"سلوفينيا", 'sg':"سنغافورة", 'sz':"سوازيلاند", 'sy':"سوريا", 'sr':"سورينام", 'ch':"سويسرا", 'sl':"سيراليون", 'lk':"سيريلانكا",
    'sc':"سيشل", 'rs':"صربيا", 'tj':"طاجيكستان", 'om':"عمان", 'gh':"غانا", 'gd':"غرينادا", 'gn':"غينيا", 'gq':"غينيا الاستوائية",
    'gw':"غينيا بيساو", 'vu':"فانواتو", 'fr':"فرنسا", 've':"فنزويلا", 'fi':"فنلندا", 'vn':"فيتنام", 'cy':"قبرص", 'qa':'قطر', 'kg':"قيرقيزستان",
    'kz':"كازاخستان", 'nc':"كاليدونيا الجديدة", 'kh':"كامبوديا", 'hr':"كرواتيا", 'ca':"كندا", 'cu':"كوبا", 'ci':"ساحل العاج", 'kr':"كوريا",
    'kp':"كوريا الشمالية", 'cr':"كوستاريكا", 'co':"كولومبيا", 'ki':"كيريباتي", 'ke':"كينيا", 'lv':"لاتفيا", 'la':'لاوس', 'lb':"لبنان",
    'li':"لشتنشتاين", 'lu':"لوكسمبورج", 'ly':"ليبيا", 'lr':"ليبيريا", 'lt':"ليتوانيا", 'ls':"ليسوتو", 'mq':"مارتينيك", 'mo':"ماكاو",
    'fm':"ماكرونيزيا", 'mw':"مالاوي", 'mt':"مالطا", 'ml':"مالي", 'my':"ماليزيا", 'yt':"مايوت", 'mg':"مدغشقر", 'eg':"مصر", 'mk':"مقدونيا، يوغوسلافيا",
    'mn':"منغوليا", 'mr':"موريتانيا", 'mu':"موريشيوس", 'mz':"موزمبيق", 'md':"مولدوفا", 'mc':"موناكو", 'ms':"مونتسيرات", 'me':"مونتينيغرو",
    'mm':"ميانمار", 'na':"ناميبيا", 'nr':"ناورو", 'np':"نيبال", 'ng':"نيجيريا", 'ni':"نيكاراجوا", 'nu':"نيوا", 'nz':"نيوزيلندا", 'ht':"هايتي",
    'hn':"هندوراس", 'nl':"هولندا", 'hk':"هونغ كونغ", 'wf':"واليس وفوتونا"
};
window.uf = windowCountryFlags;

window.mime = mime = {
    'mov':"video/mov", 'aac':"audio/aac", 'm4a':"audio/m4a", 'avi':"video/x-msvideo", 'gif':"image/gif", 'ico':"image/x-icon",
    'jpeg':"image/jpeg", 'jpg':"image/jpeg", 'mid':"audio/midi", 'midi':"audio/midi", 'mp2':"audio/mpeg", 'mp3':"audio/mpeg",
    'mp4':"video/mp4", 'mpa':"video/mpeg", 'mpe':"video/mpeg", 'mpeg':"video/mpeg", 'oga':"audio/ogg", 'ogv':"video/ogg",
    'png':"image/png", 'svg':"image/svg+xml", 'tif':"image/tiff", 'tiff':"image/tiff", 'wav':"audio/x-wav", 'weba':"audio/webm",
    'webm':"video/webm", 'webp':"image/webp", '3gp':"video/3gpp", '3gp2':"video/3gpp2"
};

// بدء التشغيل
initializeSocketConnection();
loadIgnoreBlocklist();
cachedUserHtmlTemplate = $("#uhtml").html();
cachedRoomHtmlTemplate = $("#rhtml").html();
buildEmojiBoxPanel();
updateRoomMicsStatus(); // لتحديث المايكات بعد تحميل الصفحة
if(typeof window.eruda !== 'undefined') eruda.init(); 
// اختياري، يمكن إزالته
