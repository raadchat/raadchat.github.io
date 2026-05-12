/**
 * ================================================================
 * app.js - كود تطبيق الدردشة بعد فك التشفير الكامل
 * ================================================================
 * الكود الأصلي كان مبهماً باستخدام:
 * 1. RC4 encryption  - تشفير السلاسل النصية
 * 2. Base64 encoding - ترميز البيانات
 * 3. Array rotation  - تدوير المصفوفات لإخفاء الترتيب
 * 4. Hex variable names - أسماء متغيرات بصيغة hex مثل _0x550c
 *
 * تم فك التشفير وإعادة تسمية جميع المتغيرات بأسماء واضحة
 * ================================================================
 */

// ================================================================
// القسم الأول: المتغيرات العامة
// ================================================================

var socket = null;          // اتصال WebSocket
var users = [];             // قائمة المستخدمين المتصلين
var rooms = [];             // قائمة الغرف المتاحة
var myid = null;            // معرّف المستخدم الحالي
var myroom = null;          // الغرفة الحالية للمستخدم
var nopm = false;           // تعطيل الرسائل الخاصة
var nonot = false;          // تعطيل الإشعارات
var pickedfile = null;      // الملف المختار للإرسال
var power = {};             // صلاحيات المستخدم الحالي
var powers = [];            // قائمة مستويات الصلاحيات
var emos = [];              // قائمة الإيموجي
var sico = [];              // قائمة أيقونات خاصة
var dro3 = [];              // قائمة الهدايا
var token = "";             // رمز المصادقة
var rbans = [];             // قائمة الحظر
var blocked = [];           // قائمة المكتومين محلياً
var bcLike = true;          // تفعيل زر الإعجاب في اللوحة العامة
var bct = 100;              // سرعة تمرير اللوحة العامة (ms)
var msgt = 150;             // سرعة تمرير الرسائل (ms)
var dbcb = 0;               // موضع زر حذف اللوحة العامة
var vchat = false;          // وضع الدردشة المرئية
var gh = "";                // رمز الجلسة المحفوظ
var ux = {};                // كائن يربط معرف المستخدم بعنصر HTML الخاص به
var tm = 1;                 // معامل الوقت
var lk = null;              // مفتاح إعادة الاتصال
var cpend = false;          // حالة إعادة الاتصال المعلقة
var tbox;                   // مرجع لصندوق الكتابة
var tboxid = null;          // معرف المحادثة المفتوحة في صندوق الكتابة
var tboxl = 0;              // حالة الكتابة (0=متوقف, 1=يكتب)
var ucach = {};             // كاش بيانات المستخدمين
var rcach = {};             // كاش بيانات الغرف
var needSort = true;        // علامة لإعادة ترتيب القوائم

prs(); // تهيئة رمز الجلسة

// ================================================================
// القسم الثاني: جمع بصمة المتصفح (Browser Fingerprinting)
// ================================================================
// الهدف: بناء بصمة فريدة لكل جهاز/متصفح لتمييز المستخدمين
// حتى لو غيّروا حساباتهم أو استخدموا VPN

navigator["n"] = {};

setTimeout(function () {
    try {
        // --- 2.1: جمع مفاتيح window و navigator ---
        var windowKeys = [];
        for (var key in window) {
            windowKeys.push(key);
        }
        var navigatorKeys = [];
        for (var key in navigator) {
            navigatorKeys.push(key);
        }
        // حساب بصمة مجموعة المفاتيح
        navigator.wk =
            hash([windowKeys.join(",")], 512 * 512) +
            "_" +
            hash([navigatorKeys.join(",")], 512 * 512);

        // --- 2.2: جمع بيانات المنطقة الزمنية ---
        navigator.tz = new Date().getTimezoneOffset();

        // --- 2.3: جمع إعدادات الشاشة ---
        navigator.outerWidth = window.outerWidth;
        navigator.screen = window.screen;

        // --- 2.4: جمع لغة المتصفح ---
        navigator.language = window.navigator.language;

        // --- 2.5: جمع إضافات المتصفح (Plugins) ---
        navigator.pl = [];
        navigator.mt = [];
        for (var i = 0; i < navigator.plugins.length; i++) {
            navigator.pl.push(navigator.plugins[i].name);
        }
        // جمع أنواع MIME المدعومة
        for (var i = 0; i < navigator.mimeTypes.length; i++) {
            navigator.mt.push(navigator.mimeTypes[i].type);
        }

        // --- 2.6: كشف عنوان IP الحقيقي عبر WebRTC ---
        // هذه التقنية تتجاوز الـ VPN وتكشف IP الحقيقي
        navigator.i = [];
        window.RTCPeerConnection =
            window.RTCPeerConnection ||
            window.mozRTCPeerConnection ||
            window.webkitRTCPeerConnection;

        var pc = new RTCPeerConnection({ iceServers: [] });
        var noop = function () {};
        pc.createDataChannel("");
        pc.createOffer(
            pc.setLocalDescription.bind(pc),
            noop
        );
        pc.onicecandidate = function (event) {
            if (
                !event ||
                !event.candidate ||
                !event.candidate.candidate
            ) return;
            // استخراج عنوان IP من بيانات ICE candidate
            navigator.i.push(
                event.candidate.candidate.split(" ")[4]
            );
            pc.onicecandidate = noop;
        };

        // --- 2.7: بصمة WebGL وكارت الشاشة ---
        var canvas = document.createElement("canvas");
        var canvas2 = document.createElement("canvas");
        var gl;
        var debugInfo;
        var vendor;
        var renderer;
        var ctx;

        try {
            gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            ctx = canvas2.getContext("2d");
        } catch (e) {
            navigator.c = ["", ""];
        }

        if (gl) {
            debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            vendor   = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }

        // --- 2.8: بصمة Canvas 2D ---
        // كل جهاز يرسم النص بشكل مختلف قليلاً بسبب اختلاف GPU والخطوط
        var txt = "Cwm fjordbank glyphs vext quiz";
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText(txt, 2, 15);
        ctx.fillStyle = "rgba(102,204,0,0.7)";
        ctx.fillText(txt, 4, 17);

        // حفظ البصمة: [بصمة كارت الشاشة, بصمة Canvas]
        navigator.c = [
            hash([vendor + "." + renderer], 512 * 512),
            hash([canvas.toDataURL()], 512 * 512),
        ];

        // --- 2.9: نسخ كل بيانات navigator إلى كائن n ---
        // يُرسل هذا الكائن للسيرفر عند تسجيل الدخول
        for (var k in navigator) {
            if (typeof navigator[k] != "function" && k != "n") {
                try {
                    navigator.n[k] = JSON.parse(JSON.stringify(navigator[k]));
                } catch (er) {}
            }
        }

    } catch (er) {
        // console.error(er.message);
    }

    // --- 2.10: بصمة Canvas إضافية باستخدام دالة canvasfp ---
    navigator.gg = canvasfp();
    navigator.n.gg = navigator.gg;

}, 10);

// ================================================================
// دالة canvasfp: توليد بصمة Canvas فريدة للجهاز
// ================================================================
function canvasfp() {
    try {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        var text = "Cwm fjordbank glyphs vext quiz 😃";

        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText(text, 2, 15);
        ctx.fillStyle = "rgba(102,204,0,0.7)";
        ctx.fillText(text, 4, 17);
        ctx.globalAlpha = 10;
        ctx.shadowBlur = 10;
        ctx.fillRect(-20, 10, 234, 5);

        var fingerprint = md5(canvas.toDataURL());
        if (fingerprint.length == 0) return md5("fallback");
        return fingerprint;
    } catch (e) {
        return md5("error");
    }
}

// ================================================================
// القسم الثالث: وظائف الاتصال بالسيرفر
// ================================================================

/**
 * تسجيل الخروج
 */
function logout() {
    send("logout", {});
    close(500);
}

/**
 * إرسال رسالة للسيرفر عبر Socket.io
 */
function send(cmd, data) {
    socket.emit("msg", { cmd: cmd, data: data });
}

var tried = 0; // عدد محاولات إعادة الاتصال

/**
 * إعادة المحاولة عند انقطاع الاتصال
 */
function retry() {
    fixSize(1);
    tried++;
    if (myid != null && lk != null && tried <= 6) {
        cpend = true;
        isrc = false;
        odata = [];
        $(".ovr").remove();
        if ($(".ovr").length == 0) {
            $(document.body).append(
                `<div class="ovr" style="width:100%;height:100%;z-index:999999;position:fixed;left:0px;top:0px;background-color:rgba(0,0,0,0.6);">
                    <div style="margin:25%;margin-top:5%;border-radius:4px;padding:8px;width:220px;" class="label-warning">
                        <button class="btn btn-danger fr" style="margin-top:-6px;margin-right:-6px;" onclick="$(this).hide();window.close(100);">[ x ]</button>
                        <div>.. يتم إعاده الاتصال</div>
                    </div>
                </div>`
            );
        }
        setTimeout(function () { newsock(); }, 2000);
        return;
    }
    close();
}

/**
 * إنشاء اتصال Socket.io جديد
 */
function newsock() {
    var transports =
        "WebSocket" in window || "MozWebSocket" in window
            ? ["websocket"]
            : ["polling", "websocket"];

    socket = io("", { reconnection: false, transports: transports });

    socket.on("connect", function () {
        fixSize();
        send("gh", { gh: gh });
        $(".ovr div").attr("class", "label-info").find("div").text("متصل .. يتم تسجيل الدخول");
        lstat("success", "متصل");
        $("#tlogins button").removeAttr("disabled");
        if (myid != null && lk != null && cpend) {
            socket.emit("rc1", { token: token, n: lk });
        }
        if (getUrlParameter("enter") != null && cpend == false) {
            $("#u1").val(hash([new Date().getTime()], 256) + "_زائر");
            login(1);
        }
    });

    var previousPower = null;
    var powerCheckInterval = setInterval(() => {
        if (previousPower != null && power != null) {
            if (power.rank != previousPower.rank || power.name != previousPower.name) {
                document.body.innerHTML = "";
                close(1);
            }
        }
    }, 1200);

    var isLoggedIn = false;

    socket.on("msg", function (data) {
        if (data.cmd == "ok")  { isLoggedIn = true; }
        if (data.cmd == "nok") { isLoggedIn = false; lk = null; }
        if (!cpend && isLoggedIn) { lk = data.k; }
        if (data.cmd == "power")  { previousPower = Object.assign({}, data.data); }
        if (data.cmd == "powers" && previousPower != null) {
            for (var i = 0; i < data.data.length; i++) {
                if (data.data[i].name == previousPower.name) {
                    previousPower = Object.assign({}, data.data[i]);
                }
            }
        }
        ondata(data.cmd, data.data);
    });

    socket.on("disconnect", function () {
        clearInterval(powerCheckInterval);
        lstat("danger", "غير متصل");
        retry();
    });

    socket.on("connect_error", function () {
        clearInterval(powerCheckInterval);
        $(".ovr div").attr("class", "label-danger").find("div").text("فشل الاتصال ..");
        lstat("danger", "غير متصل");
        retry();
    });

    socket.on("connect_timeout", function () {
        clearInterval(powerCheckInterval);
        $(".ovr div").attr("class", "label-danger").find("div").text("فشل الاتصال ..");
        lstat("danger", "غير متصل");
        retry();
    });

    socket.on("error", function () {
        clearInterval(powerCheckInterval);
        $(".ovr div").attr("class", "label-danger").find("div").text("فشل الاتصال ..");
        lstat("danger", "غير متصل");
        retry();
    });
}

// ================================================================
// القسم الرابع: تسجيل الدخول والتسجيل
// ================================================================

/**
 * تسجيل الدخول
 * @param {number} mode - 1: دخول ضيف, 2: دخول بحساب, 3: تسجيل جديد
 */
function login(mode) {
    $("#tlogins button").attr("disabled", "true");

    switch (mode) {
        case 1: // دخول كضيف
            send("g", {
                username: $("#u1").val(),
                fp: navigator.n,        // بصمة المتصفح
                gh: gh,                  // رمز الجلسة
                ss: ccode(),             // كود إضافي
                refr: getv("refr"),
                r: getv("r"),
                uprofile: loadprofile(),
            });
            setv("u1", encode($("#u1").val()));
            setv("isl", "no");
            break;

        case 2: // دخول بحساب مسجل
            send("login", {
                username: $("#u2").val(),
                stealth: $("#stealth").is(":checked"),
                password: $("#pass1").val(),
                fp: navigator.n,
                gh: gh,
                ss: ccode(),
                refr: getv("refr"),
                r: getv("r"),
            });
            setv("u2", encode($("#u2").val()));
            setv("p1", encode($("#pass1").val()));
            setv("isl", "yes");
            break;

        case 3: // تسجيل حساب جديد
            send("reg", {
                username: $("#u3").val(),
                password: $("#pass2").val(),
                fp: navigator.n,
                gh: gh,
                ss: ccode(),
                refr: getv("refr"),
                r: getv("r"),
            });
            break;
    }
}

// ================================================================
// القسم الخامس: التهيئة الرئيسية
// ================================================================

var isIphone = false;

/**
 * استرجاع مرجع referrer المنظف
 */
function refr() {
    var r = document.referrer || "";
    if (r.indexOf("http://" + location.hostname) == 0) return "";
    if (r.indexOf("://") != -1) {
        r = r.replace(/(.*?)\:\/\//g, "").split("/")[0];
    }
    return r;
}

/**
 * الدالة الرئيسية لتهيئة التطبيق عند تحميل الصفحة
 */
function load() {
    lstat("success", " ");
    isIphone = /ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase());

    if (typeof $ == "undefined" || typeof io == "undefined") { close(5000); return; }
    if ($("").tab == null) { close(5000); return; }

    if (isIphone) {
        $('img[data-toggle="popover"]').removeClass("nosel");
        fxi();
    }

    checkupdate();
    $("#rhtml .utopic").css("margin-left", "6px");
    umsg = $("#umsg").html();
    loadpro();
    loadblocked();

    // ضبط حجم viewport حسب عرض الشاشة
    if ($(window).width() <= 400) {
        $("meta[name='viewport']").attr("content", " user-scalable=0, width=400");
    }
    if ($(window).width() >= 600) {
        $("meta[name='viewport']").attr("content", " user-scalable=0, width=600");
    }

    $("#tbox").css("background-color", "#AAAAAF");
    $(".rout").hide();
    $(".redit").hide();

    // استعادة بيانات تسجيل الدخول المحفوظة
    $("#u1").val(decode(getv("u1")));
    $("#u2").val(decode(getv("u2")));
    $("#pass1").val(decode(getv("p1")));
    if (getv("isl") == "yes") {
        $('.nav-tabs a[href="#l2"]').tab("show");
    }

    uhtml = $("#uhtml").html();
    rhtml = $("#rhtml").html();

    $(".ae").click(function () { $(".phide").click(); });

    var debugMode = getUrlParameter("debug") == "1";
    if (debugMode) {
        window.onerror = function (errorMsg, url, lineNumber) {
            alert("Error: " + errorMsg + " Script: " + url + " Line: " + lineNumber);
        };
    }

    if (getv("refr") == "") { setv("refr", refr() || "*"); }
    if (getv("r") == "")    { setv("r", getUrlParameter("r") || "*"); }

    $(window).on("resize pushclose pushopen", fixSize);
    $('*[data-toggle="tab"]').on("shown.bs.tab", function () { fixSize(); });

    // إرسال الرسالة بالضغط على Enter
    $("#tbox").keyup(function (e) {
        if (e.keyCode == 13) { e.preventDefault(); Tsend(); }
    });
    $(".tboxbc").keyup(function (e) {
        if (e.keyCode == 13) { e.preventDefault(); sendbc(); }
    });

    // بدء الاتصال بالسيرفر
    setTimeout(function () {
        newsock();
        $.ajaxSetup({ cache: false });
    }, 200);

    fixSize();
    setTimeout(function () { updateTimes(); }, 20000);
    setTimeout(function () { refreshonline(); }, 250);
}

// ================================================================
// القسم السادس: معالجة البيانات الواردة من السيرفر
// ================================================================

var odata = [];     // بيانات معلقة أثناء إعادة الاتصال
var isrc = false;   // علامة وضع إعادة الاتصال

/**
 * معالجة الأوامر الواردة من السيرفر
 */
function ondata(cmd, data) {
    // تخزين البيانات مؤقتاً أثناء إعادة الاتصال
    if (isrc && cmd != "rc" && cmd != "rcd" && cmd != "close") {
        odata.push([cmd, data]);
        return;
    }

    try {
        switch (cmd) {

            case "server": // عدد المستخدمين المتصلين
                $(".s1").removeClass("label-warning").addClass("label-success").text(data.online);
                break;

            case "dro3":  dro3 = data;  break; // قائمة الهدايا
            case "sico":  sico = data;  break; // قائمة الأيقونات

            case "emos": // تحميل قائمة الإيموجي
                emos = data;
                emopop(".emobox");
                emopop(".emobc");
                break;

            case "ok": // تم تسجيل الدخول بنجاح
                $(".ovr div").attr("class", "label-success").find("div").text("متصل ..");
                tried = 0;
                setTimeout(function () { $(".ovr").remove(); }, 1500);
                cpend = false;
                break;

            case "rc":  // بداية إعادة الاتصال
                isrc = true;
                odata = [];
                break;

            case "rcd": // انتهاء إعادة الاتصال، تنفيذ البيانات المعلقة
                isrc = false;
                odata = [];
                var allData = data.concat(odata);
                for (var i = 0; i < allData.length; i++) {
                    ondata(allData[i][0], allData[i][1]);
                }
                break;

            case "login": // رد السيرفر على محاولة تسجيل الدخول
                $("#tlogins button").removeAttr("disabled");
                switch (data.msg) {
                    case "ok":
                        myid = data.id;
                        token = data.ttoken;
                        setv("token", token);
                        window.onbeforeunload = confirmOnPageExit;
                        $(".dad").css("max-width", "100%");
                        $("#tlogins,.lonline").remove();
                        $("#d2,.footer,#d0").show();
                        fixSize(1);
                        break;
                    case "noname":   lstat("warning", "هذا الإسم غير مسجل !"); break;
                    case "badname":  lstat("warning", "يرجى إختيار أسم آخر"); break;
                    case "usedname": lstat("danger",  "هذا الإسم مسجل من قبل"); break;
                    case "badpass":  lstat("warning", "كلمه المرور غير مناسبه"); break;
                    case "wrong":    lstat("danger",  "كلمه المرور غير صحيحه"); break;
                    case "reg":
                        lstat("success", "تم تسجيل العضويه بنجاح !");
                        $("#u2").val($("#u3").val());
                        $("#pass1").val($("#pass2").val());
                        login(2);
                        break;
                }
                break;

            case "powers": // تحديث قائمة الصلاحيات
                powers = data;
                for (var i = 0; i < powers.length; i++) {
                    var pname = powers[i].name || "_";
                    powers[pname] = powers[i];
                }
                var currentUser = getuser(myid);
                if (currentUser != null) {
                    power = getpower(currentUser.power || "");
                    $(".cp").toggle(power.cp == true);
                    $(".pmsg").toggle(power.publicmsg > 0);
                }
                for (var i = 0; i < users.length; i++) {
                    updateu(users[i].id, users[i]);
                }
                needUpdate = true;
                break;

            case "power": // تحديث صلاحيات المستخدم الحالي
                power = data;
                $(".cp").toggle(power.cp == true);
                $(".pmsg").toggle(power.publicmsg > 0);
                $.each(users, function (i, u) {
                    if (u.power == power.name || u.s != null) {
                        updateu(u.id, u);
                    }
                });
                break;

            case "not": // استقبال إشعار
                if (data.user != null && data.force != 1 && nonot == true) {
                    send("nonot", { id: data.user });
                    return;
                }
                var notElement = $($("#not").html()).first();
                var notUser = getuser(data.user);
                if (notUser != null) {
                    if (ismuted(notUser)) return;
                    var userHtml = $('<div class="fl borderg corner uzr" style="width:100%;"></div>');
                    userHtml.append("<img src='" + notUser.pic + "' style='width:24px;height:24px;' class='corner borderg fl'>");
                    userHtml.append(
                        "<img class='u-ico fl' style='max-height:18px;'>" +
                        "<div style='max-width:80%;' class='dots nosel corner u-topic fl'>" +
                        notUser.topic +
                        '<span class="fr" style="color:grey;font-size:70%!important;">' + notUser.h + "</span>" +
                        "</div>"
                    );
                    userHtml.find(".u-topic").css({ "background-color": notUser.bg, color: notUser.ucol });
                    var ico = getico(notUser);
                    if (ico != "") userHtml.find(".u-ico").attr("src", ico);
                    notElement.append(userHtml);
                }
                notElement.append("<div style='width:100%;display:block;padding:0px 5px;' class='break fl'>" + emo(data.msg) + "</div>");
                notElement.css("margin-left", "+=" + notpos);
                notpos += 2;
                if (notpos >= 6) notpos = 0;
                $(".dad").append(notElement);
                break;

            case "delbc": // حذف رسالة من اللوحة العامة
                $(".bid" + data.bid).remove();
                break;

            case "bclist": // قائمة رسائل اللوحة العامة
                $.each(data, function (i, e) { AddMsg(".d2bc", e); });
                break;

            case "bc^": // تحديث عدد الإعجابات
                var likeBtn = $(".bid" + data.bid + " .fa-heart");
                if (likeBtn.length > 0) likeBtn.text(data.likes);
                break;

            case "bc": // رسالة جديدة في اللوحة العامة
                AddMsg(".d2bc", data);
                if ($("#dpnl").is(":visible") == false || !$("#wall").hasClass("active")) {
                    bcc++;
                    hl($(".bwall").text(bcc).parent(), "warning");
                }
                break;

            case "calling": // مكالمة واردة
                var caller = getuser(data.caller);
                if (ismuted(getuser(data.uid))) return;
                if (nopm == true && $("#c" + data.caller).length == 0) {
                    send("nopm",    { id: data.caller });
                    send("calldeny", data);
                    if (wr) wr.hangUp();
                    return;
                }
                if (wr == null && $(".callnot").length == 0 && caller != null && $("#d2" + data.caller).length > 0) {
                    var callNotif = $($("#callnot").html());
                    var callerHtml = $($("#uhtml").html());
                    callerHtml.find(".u-msg").remove();
                    callerHtml.find(".u-topic").html(caller.topic).css({ color: caller.ucol, "background-color": caller.bg });
                    callerHtml.find(".u-pic").css("background-image", 'url("' + caller.pic + '")').css({ width: "24px", height: "24px" });
                    callNotif.find(".uzer").append(callerHtml);
                    callNotif.addClass("callnot");
                    callid = data.caller;
                    callNotif.attr("callid", data.roomid);
                    callNotif.find(".calldeny").click(function () {
                        callNotif.remove();
                        send("calldeny", data);
                        if (wr) wr.hangUp();
                    });
                    callNotif.find(".callaccept").click(function () {
                        callstat = 1;
                        $(document.body).append(callNotif);
                        wr = new webrtc(data.roomid, myid);
                        $(this).hide();
                    });
                    $("#d2" + data.caller).append(callNotif);
                    hl($(".callstat").text(""), "warning");
                    updateu(caller.id);
                    openw(data.pm, false);
                } else {
                    send("calldeny", data);
                }
                break;

            case "calldeny": // رُفضت المكالمة
                if (wr != null) {
                    wr.hangUp();
                    callstat = 0;
                    alert("تم رفض المكالمه");
                }
                $(".callnot").remove();
                break;

            case "callend": // انتهت المكالمة
                $(".callnot").remove();
                break;
        }
    } catch (error) {
        console.error(error.stack);
        if (getUrlParameter("debug") == "1") {
            alert(cmd + "\n" + error.stack);
        }
    }
}

// ================================================================
// القسم السابع: إدارة المستخدمين
// ================================================================

var notpos = 0;

/**
 * استخراج النص من عنصر HTML (إزالة الصور والاحتفاظ بـ alt)
 */
function gettext(element) {
    $.each(element.find("img"), function (i, img) {
        var alt = $(img).attr("alt");
        if (alt != null) { $("<x>" + alt + "</x>").insertAfter($(img)); }
        $(img).remove();
    });
    return $(element).text();
}

/**
 * إضافة مستخدم جديد لقائمة المستخدمين
 */
function AddUser(id, user) {
    var userElement = $(uhtml);
    // حساب رقم هاش مرئي للمستخدم (يظهر في واجهة البحث)
    user.h = "#" + Math.ceil(
        ((Math.ceil(Math.sqrt(parseInt(hash([user.username || "ff"], 512), 36) / 65025)) - 1) / 255) * 99
    ).toString().padStart(2, "0");

    if ($(".uid" + id).length) return; // إذا كان المستخدم موجوداً مسبقاً

    var ico = getico(user);
    if (ico != "") userElement.find(".u-ico").attr("src", ico);
    userElement.addClass("uid" + id);
    userElement.addClass("hid");
    userElement.attr("onclick", `upro('${user.id}');`);
    $("#users").append(userElement);
    ux[id] = $(".uid" + id);
}

/**
 * تحديث بيانات مستخدم في واجهة المستخدم
 */
function updateu(id, userData) {
    var u = userData || getuser(id);
    if (u == null) return;

    var ico  = getico(u);
    var stat = "imgs/s" + u.stat + ".png?2";
    if (u.s) stat = "imgs/s4.png?2"; // صورة الوضع الخفي

    // تحديث بيانات المستخدم الحالي في لوحة الإعدادات
    if (u.id == myid) {
        $(".spic").css("background-image", 'url("' + u.pic + '")');
        $(".stopic").val(gettext($("<div>" + u.topic + "</div>")));
        $(".smsg").val(gettext($("<div>" + u.msg + "</div>")));
        $(".scolor").val(u.ucol).css("background-color", u.ucol).trigger("change");
        $(".mcolor").val(u.mcol || "#000").css("background-color", u.mcol || "#000");
        $(".sbg").val(u.bg).css("background-color", u.bg);
    }

    if (u.msg == "") u.msg = "..";

    var userHtmlEl = ux[id];
    userHtmlEl.find(".ustat").attr("src", stat);

    // عرض علم الدولة
    if (u.co == "--" || u.co == null || u.co == "A1" || u.co == "A2" || u.co == "EU") {
        userHtmlEl.find(".co").remove();
    } else {
        userHtmlEl.find(".co").attr("src", "flag/" + u.co.toLowerCase() + ".gif");
    }

    // علامة الكتم
    userHtmlEl.find(".muted").toggleClass("fa-ban", ismuted(u));
    userHtmlEl.attr("v", getpower(u.power).rank);

    if (ico != "") {
        userHtmlEl.find(".u-ico").attr("src", ico);
    } else {
        userHtmlEl.find(".u-ico").removeAttr("src");
    }

    userHtmlEl.find(".uhash").text(u.h);
    userHtmlEl.find(".u-topic").html(u.topic).css({ "background-color": u.bg, color: u.ucol });
    userHtmlEl.find(".u-msg").html(u.msg);
    userHtmlEl.find(".u-pic").css("background-image", 'url("' + u.pic + '")');

    // تحديث نافذة المحادثة الخاصة إذا كانت مفتوحة
    var chatWindow = $("#c" + id);
    if (chatWindow.length) {
        if (ico != "") chatWindow.find(".u-ico").attr("src", ico);
        chatWindow.find(".ustat").attr("src", stat);
        chatWindow.find(".u-topic").html(u.topic).css({ "background-color": u.bg, color: u.ucol });
        chatWindow.find(".u-pic").css("background-image", 'url("' + u.pic + '")');
    }

    stealthit(u);
}

var needUpdate = false;
var lastSearchText = "";

/**
 * البحث في قائمة المستخدمين
 */
function usearch() {
    if ($("#usearch").val() != lastSearchText) {
        lastSearchText = $("#usearch").val();
        if (lastSearchText != "") {
            $("#usearch").removeClass("bg");
        } else {
            $("#usearch").addClass("bg");
        }
        $("#users .uzr").css("display", "");

        // إخفاء المستخدمين الذين لا يطابقون البحث
        $.each(
            $.grep(users, function (user) {
                return (
                    user.topic.split("ـ").join("").toLowerCase().indexOf(
                        lastSearchText.split("ـ").join("").toLowerCase()
                    ) == -1 &&
                    user.h.indexOf(lastSearchText) != 0 &&
                    user.h.indexOf(lastSearchText) != 1
                );
            }),
            function (i, user) { ux[user.id].css("display", "none"); }
        );
    }
    setTimeout(usearch, 600);
}
usearch();

/**
 * ترتيب قائمة المستخدمين (المشرفون أولاً، ثم من في الغرفة، ثم أبجدياً)
 */
function updateusers() {
    if (needUpdate == false) return;
    $("#users").find(".uzr").sort(function (a, b) {
        var av = parseInt($(a).attr("v") || 0);
        var bv = parseInt($(b).attr("v") || 0);
        if ($(a).hasClass("inroom")) av += 100000;
        if ($(b).hasClass("inroom")) bv += 100000;
        if ($(a).hasClass("ninr"))   av += 9000;
        if ($(b).hasClass("ninr"))   bv += 9000;
        if (av == bv) {
            return ($(a).find(".u-topic").text() + "").localeCompare($(b).find(".u-topic").text() + "");
        }
        return av < bv ? 1 : -1;
    });

    $.each(
        $.grep(users, function (u) { return u.s != null; }),
        function (i, u) { stealthit(u); }
    );
}

// ================================================================
// القسم الثامن: إدارة الرسائل
// ================================================================

/**
 * إرسال رسالة نصية في الغرفة
 */
function Tsend() {
    var msg = $("#tbox").val().split("\n").join("");
    $("#tbox").val("");
    $("#tbox").focus();
    if (msg == "%0A" || msg == "%0a" || msg == "" || msg == "\n") return;
    send("msg", { msg: msg });
}

/**
 * إرسال رسالة للوحة العامة (Broadcast)
 */
function sendbc(withFile) {
    if (withFile) {
        pickedfile = null;
        sendfile("d2bc", function () {
            var msg  = $(".tboxbc").val();
            $(".tboxbc").val("");
            var link = pickedfile;
            pickedfile = "";
            if ((msg == "%0A" || msg == "%0a" || msg == "" || msg == "\n") && (link == "" || link == null)) return;
            send("bc", { msg: msg, link: link });
        });
        return;
    } else {
        pickedfile = null;
    }
    var msg  = $(".tboxbc").val();
    $(".tboxbc").val("");
    var link = pickedfile;
    pickedfile = "";
    if ((msg == "%0A" || msg == "%0a" || msg == "" || msg == "\n") && (link == "" || link == null)) return;
    send("bc", { msg: msg, link: link });
}

/**
 * إضافة رسالة جديدة لنافذة الدردشة أو اللوحة العامة
 */
function AddMsg(targetSelector, data) {
    var msgElement = $(umsg);
    var u = getuser(data.uid);

    msgElement.find(".u-pic").css("background-image", 'url("' + data.pic + '")').attr("onclick", `upro('${data.uid}');`);
    msgElement.find(".tago").attr("ago", data.t);
    msgElement.find(".u-topic").html(data.topic).css("color", data.ucol);

    // معالجة الإيموجي في الرسالة
    data.msg = emo(data.msg);

    // كشف روابط YouTube وتحويلها لزر مشاهدة
    var youtubeMatch = ytVidId(data.msg.replace(/\n/g, ""));
    if (youtubeMatch.length > 1 && targetSelector != "#d2") {
        data.msg = data.msg.replace(
            youtubeMatch[1],
            "<button onclick='ytube(\"https://www.youtube.com/embed/" + youtubeMatch[0] + "\",this);'" +
            " style='font-size:40px!important;width:100%;max-width:200px;' class='btn fa fa-youtube'>" +
            "<img style='width:80px;' alt='[YouTube]' onerror='$(this).parent().remove();'" +
            " src='https://img.youtube.com/vi/" + youtubeMatch[0] + "/0.jpg'></button>"
        );
    }

    msgElement.find(".u-msg").html(data.msg).css("color", data.mcol);
    if (data.class != null) msgElement.addClass(data.class);
    msgElement.addClass("mm");

    if (u != null) {
        var ico = getico(u);
        if (ico != "") msgElement.find(".u-ico").attr("src", ico);
        msgElement.find(".u-topic").css({ color: u.ucol, "background-color": u.bg });
    } else {
        msgElement.find(".u-ico").remove();
        msgElement.find(".u-topic").css({ color: data.ucol || "#000", "background-color": data.bg || "" });
    }

    var isBC = targetSelector == ".d2bc";

    // أزرار اللوحة العامة (إعجاب، حذف)
    if (data.bid != null) {
        msgElement.addClass("bid" + data.bid);
        if (bcLike) {
            msgElement.append(
                "<a onclick=\"send('likebc',{bid:'" + data.bid + "'})\" style='margin-top:-20px;margin-left:6px;padding:4px;' class='btn minix btn-danger fa fa-heart fr'>&nbsp;</a>"
            );
        }
        if (power.delbc || data.lid == getuser(myid).lid) {
            msgElement.append(
                "<a onclick=\"send('delbc',{bid:'" + data.bid + "'})\" style='margin-top:-20px;padding:4px;' class='btn minix btn-primary fa fa-times " + (dbcb == false ? "fl" : "fr") + "'>&nbsp;</a>"
            );
        }
    }

    // زر حذف الرسالة (للمشرفين)
    if (data.mi != null) {
        msgElement.addClass("mi" + data.mi);
        if (power.dmsg) {
            msgElement.append(
                "<a onclick=\"send('dmsg',{mi:'" + data.mi + "',topic:$(this).parent().find('.u-topic').text()});\" style='margin-top:22px;padding:4px;' class='btn minix btn-primary fa fa-times fr'>&nbsp;</a>"
            );
        }
    }

    var container = $(targetSelector);
    if (isBC) {
        msgElement.prependTo(container);
    } else {
        msgElement.appendTo(container);
    }

    // معالجة مرفقات الرسالة (صور، فيديو، صوت)
    $.each(msgElement.find("a.uplink"), function (i, link) {
        var url      = $(link).attr("href") || "";
        var mimeType = mime[url.split(".").pop().toLowerCase()] || "";

        if (mimeType.match(/image/i)) {
            var showBtn = $("<button class='btn fl fa fa-image'>عرض الصوره</button>");
            showBtn.insertAfter(link);
            $(link).remove();
            showBtn.click(function () {
                $("<a href='" + url + "' target='_blank'><img style='max-width:240px;max-height:200px;' src='" + url + "' class='hand fitimg'></a>").insertAfter(showBtn);
                showBtn.remove();
            });
        }
        if (mimeType.match(/video/i)) {
            var showBtn = $("<button class='btn fl fa fa-youtube-play'>عرض الفيديو</button>");
            showBtn.insertAfter(link);
            $(link).remove();
            showBtn.click(function () {
                $("<video style='width:95%;max-height:200px;' controls><source src='" + url + "'></video>").insertAfter(showBtn);
                showBtn.remove();
            });
        }
        if (mimeType.match(/audio/i)) {
            var showBtn = $("<button class='btn fl fa fa-youtube-play'>مقطع صوت</button>");
            showBtn.insertAfter(link);
            $(link).remove();
            showBtn.click(function () {
                $("<audio style='width:95%;' controls><source src='" + url + "' type='audio/mpeg'></audio>").insertAfter(showBtn);
                showBtn.remove();
            });
        }
    });

    // تحديد عدد الرسائل المعروضة وتمرير الشاشة
    if (isBC) {
        if (container.find(".mm").length >= 100) {
            $(targetSelector + " .mm").last().remove();
        }
        if (container[0].scrollTop == 0) container.scrollTop(msgElement.innerHeight());
        container.stop().animate({ scrollTop: 0 }, bct);
    } else {
        if (container.find(".mm").length >= 36) {
            $(targetSelector + " .mm").first().remove();
        }
        container.stop().animate({ scrollTop: container[0].scrollHeight }, msgt);
    }

    return msgElement;
}

// ================================================================
// القسم التاسع: إدارة الغرف
// ================================================================

/**
 * الانضمام لغرفة
 */
function rjoin(roomId) {
    var password = "";
    if (getroom(roomId).needpass) {
        password = prompt("كلمه المرور؟", "");
        if (password == "") return;
    }
    send("rjoin", { id: roomId, pwd: password });
}

/**
 * تحديث واجهة المستخدم عند تغيير الغرفة
 */
function roomChanged(isMe) {
    $("#users").find(".inroom").removeClass("inroom");
    $("#rooms").find(".inroom").removeClass("inroom");
    var currentRoom = getroom(myroom);
    $(".bord").removeClass("bord");

    if (currentRoom != null) {
        $(".ninr,.rout").show();
        if ($("#room.active").length == 0 && isMe == true) { $("[data-target='#room']").trigger("click"); }
        if (isMe == true) { $("[data-target='#room']").show(); }

        $.each(rusers(currentRoom.id), function () {
            $("#users").find(".uid" + this.id).addClass("inroom");
        });
        $("#rooms").find(".r" + currentRoom.id).addClass("inroom bord");
        $("#tbox").css("background-color", "");

        var myUser = getuser(myid);
        if (myUser && (currentRoom.owner == myUser.lid || power.roomowner == true)) {
            $(".redit").show();
        }
    } else {
        $(".roomtgl").hide();
        if (isMe) { $("[data-target='#room']").hide(); }
        if ($("#room.active").length != 0 && isMe == true) { $("[data-target='#rooms']").trigger("click"); }
        $(".ninr,.rout,.redit").hide();
        $("#tbox").css("background-color", "#AAAAAF");
    }
}

// ================================================================
// القسم العاشر: وظائف المساعدة
// ================================================================

/**
 * فحص التحديثات وإرسال حالة الكتابة
 */
function checkupdate() {
    if (needUpdate && $("#dpnl:visible").find("#users.active,#rooms.active").length > 0) {
        updateusers();
        updaterooms();
        needUpdate = false;
        needSort = true;
    }
    if (myid != null && cpend == false && tbox != null) {
        var inputBox    = $(tbox).find(".tbox:visible");
        var inputLength = inputBox.length > 0 ? inputBox.val().length : 0;
        if (inputBox.length > 0 && inputLength > 0 && tboxl != 1 && tboxid != null) {
            tboxl = 1;
            send("ty", [tboxid, 1]); // يكتب الآن
        } else {
            if (inputLength == 0 && tboxl != 0) {
                tboxl = 0;
                send("ty", [tboxid, 0]); // توقف عن الكتابة
            }
        }
    }

    // ترتيب قائمة الغرف
    if (needSort && $("#dpnl:visible").find("#rooms.active").length) {
        needSort = false;
        $("#rooms").find(".room").sort(function (a, b) {
            var av = parseInt($(a).attr("v"));
            var bv = parseInt($(b).attr("v"));
            if (av == bv) {
                return ($(a).find(".u-topic").text() + "").localeCompare($(b).find(".u-topic").text() + "");
            }
            return av < bv ? 1 : -1;
        });
    }

    setTimeout(checkupdate, 2000);
}

/**
 * تحديث الوقت المنقضي لكل الرسائل
 */
function updateTimes() {
    $.each($(".tago"), function (i, el) {
        el = $(el);
        el[0].innerText = agoo(parseInt(el.attr("ago") || 0));
    });
    setTimeout(updateTimes, 15000);
    prs();
}

/**
 * تحويل الوقت المنقضي لنص مختصر بالعربية
 * مثال: "5د" = 5 دقائق, "2س" = ساعتان, "3ي" = 3 أيام
 */
function agoo(timestamp) {
    var diff = new Date().getTime() - timestamp;
    var v = Math.abs(diff) / 1000;
    if (v < 59)   return "الآن";
    v = v / 60;
    if (v < 59)   return parseInt(v) + "د";
    v = v / 60;
    if (v < 24)   return parseInt(v) + "س";
    v = v / 24;
    if (v < 30)   return parseInt(v) + "ي";
    v = v / 30;
    return parseInt(v) + "ش";
}

/**
 * ضبط ألوان وحالات CSS لتغيير ظهور العناصر
 */
function hl(element, status) {
    element = $(element);
    var type = "";
    if (element.hasClass("label")) type = "label";
    if (element.hasClass("btn"))   type = "btn";
    if (element.hasClass("panel")) type = "panel";
    element.removeClass(type + "-primary " + type + "-danger " + type + "-warning " + type + "-info " + type + "-success ");
    element.addClass(type + "-" + status);
    return element;
}

/**
 * تحديث حالة تسجيل الدخول في الواجهة
 */
function lstat(status, msg) {
    hl(".loginstat", status).text(msg);
}

// ================================================================
// القسم الحادي عشر: الملف الشخصي
// ================================================================

/**
 * حفظ إعدادات الملف الشخصي
 */
function setprofile() {
    var profileData = {};
    profileData.topic = $(".stopic").val();
    profileData.msg   = $(".smsg").val();
    profileData.ucol  = "#" + $(".scolor").val().split("#").join("");
    profileData.mcol  = "#" + $(".mcolor").val().split("#").join("");
    profileData.bg    = "#" + $(".sbg").val().split("#").join("");
    var currentUser   = getuser(myid);
    profileData.pic      = currentUser.pic;
    profileData.username = currentUser.username;
    setv("uprofile", JSON.stringify(profileData));
    send("setprofile", profileData);
}

/**
 * تحميل الملف الشخصي المحفوظ
 */
function loadprofile() {
    var d = getv("uprofile");
    if (d == "") return null;
    try {
        return JSON.parse(getv("uprofile"));
    } catch (er) {
        return null;
    }
}

// ================================================================
// القسم الثاني عشر: نظام الصلاحيات
// ================================================================

/**
 * الحصول على صلاحيات مستوى معين بالاسم
 */
function getpower(powerName) {
    var pname = powerName || "_";
    if (powers[pname] != null) return powers[pname];
    for (var i = 0; i < powers.length; i++) {
        if (powers[i].name == powerName) return powers[i];
    }
    // إرجاع كائن فارغ إذا لم يُوجد المستوى
    var emptyPower = JSON.parse(JSON.stringify(powers[0]));
    var keys = Object.keys(emptyPower);
    for (var i = 0; i < keys.length; i++) {
        switch (true) {
            case typeof emptyPower[keys[i]] == "number":  emptyPower[keys[i]] = 0;     break;
            case typeof emptyPower[keys[i]] == "string":  emptyPower[keys[i]] = "";    break;
            case typeof emptyPower[keys[i]] == "boolean": emptyPower[keys[i]] = false; break;
        }
    }
    return emptyPower;
}

/**
 * الحصول على رابط أيقونة المستخدم
 */
function getico(user) {
    if (user.b != null && user.b != "") return "sico/" + user.b;
    var ico = (getpower(user.power) || { ico: "" }).ico;
    if (ico != "") ico = "sico/" + ico;
    if (ico == "" && (user.ico || "") != "") ico = "dro3/" + user.ico;
    return ico;
}

/**
 * إخفاء/إظهار المستخدم في الوضع الخفي
 */
function stealthit(user) {
    if (ux[user.id] == null) return;
    var userPower = getpower(user.power);
    if (user.s && userPower.rank > power.rank) {
        ux[user.id].addClass("hid");
    } else {
        ux[user.id].removeClass("hid");
    }
}

// ================================================================
// القسم الثالث عشر: نظام الكتم (Block)
// ================================================================

/**
 * تحميل قائمة المكتومين من التخزين المحلي
 */
function loadblocked() {
    var d = getv("blocklist");
    if (d != null && d != "") {
        try {
            d = JSON.parse(d);
            if (Array.isArray(d)) blocked = d;
        } catch (er) {}
    }
}

/**
 * حفظ قائمة المكتومين في التخزين المحلي
 */
function saveblocked() {
    setv("blocklist", JSON.stringify(blocked));
}

/**
 * إلغاء كتم مستخدم
 */
function unmute(user) {
    for (var i = 0; i < blocked.length; i++) {
        if (blocked[i].lid == user.lid) {
            blocked.splice(i, 1);
            updateu(user.id);
        }
    }
    saveblocked();
}

/**
 * كتم مستخدم (منعه من الظهور)
 */
function muteit(user) {
    if (user.id == myid) return; // لا يمكن كتم نفسك
    for (var i = 0; i < blocked.length; i++) {
        if (blocked[i].lid == user.lid) return; // مكتوم مسبقاً
    }
    blocked.push({ lid: user.lid });
    updateu(user.id);
    saveblocked();
}

/**
 * التحقق من كتم مستخدم
 */
function ismuted(user) {
    for (var i = 0; i < blocked.length; i++) {
        if (blocked[i].lid == user.lid) return true;
    }
    return false;
}

// ================================================================
// القسم الرابع عشر: الإيموجي
// ================================================================

/**
 * تحويل رموز الإيموجي في النص لصور
 * مثال: "ف1" -> <img src="emo/smile.gif">
 */
function emo(text) {
    for (var i = 0; i < 5; i++) {
        var emoChar = "ف";
        var regex = new RegExp("(^| )" + emoChar + "([0-9][0-9][0-9]|[0-9][0-9]|[0-9])( |$|\n)");
        var match = regex.exec(text);
        if (match != null) {
            var index = parseInt(match[2]) - 1;
            if (index < emos.length && index > -1) {
                text = text.replace(
                    regex,
                    '$1<img src="emo/' + emos[index] + '" alt="ف$2" title="ف$2" class="emoi">$3'
                );
            }
        }
    }
    return text;
}

/**
 * تهيئة قائمة الإيموجي المنبثقة
 */
function emopop(emoBoxSelector) {
    var emoBox = $(emoBoxSelector);
    emoBox.popover({
        placement: "top",
        html: true,
        content: function () {
            var emoGrid = $("<div style='max-width:340px;' class='break corner'></div>");
            $.each(emos, function (i, e) {
                emoGrid.append(
                    '<img style="margin:2px;" class="emoi hand corner" src="emo/' + e +
                    '" title="' + (i + 1) + '" eid="' + emoBoxSelector +
                    '" onmousedown="pickedemo(this);return false;">'
                );
            });
            return emoGrid[0].outerHTML;
        },
        title: "",
    });
}

/**
 * إدراج إيموجي في صندوق الكتابة
 */
function pickedemo(emoElement) {
    emoElement = $(emoElement);
    var emoIndex = emoElement.attr("title");
    var targetBox = $(emoElement.attr("eid"));
    targetBox.parent().find(".tbox").val(
        $(targetBox).parent().find(".tbox").val() + " ف" + emoIndex
    );
    targetBox.popover("hide").blur();
}

// ================================================================
// القسم الخامس عشر: YouTube
// ================================================================

/**
 * استخراج معرف فيديو YouTube من الرابط
 */
function ytVidId(url) {
    var pattern = /(?:\s+)?(?:^)?(?:https?:\/\/)?(?:http?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(\s+|$)/;
    return url.match(pattern)
        ? [
              RegExp.$1.split("<").join("&#x3C;").split("'").join("").split('"').join("").split("&").join(""),
              RegExp.lastMatch,
          ]
        : [];
}

/**
 * تحويل رابط YouTube لـ iframe
 */
function ytube(link, button) {
    $(
        '<iframe width="95%" style="max-width:240px;" height="200" src="' + link + '" frameborder="0" allowfullscreen></iframe>'
    ).insertAfter($(button));
    $(button).remove();
}

// ================================================================
// القسم السادس عشر: المكالمات الصوتية
// ================================================================

var callstat = 0;   // 0=خامل, 1=يتصل, 2=في مكالمة
var callid = null;  // معرف المتصل

/**
 * بدء مكالمة مع مستخدم
 */
function call(userId) {
    var targetUser = getuser(userId);
    if (callstat == 0 && wr == null && $(".callnot").length == 0 && targetUser != null) {
        callstat = 1;
        callid = userId;
        var callElement = $($("#callnot").html());
        var userHtml    = $($("#uhtml").html());
        userHtml.find(".u-msg").remove();

        var roomId = "jh!" + new Date().getTime() + myid + targetUser.id;
        userHtml.find(".u-topic").html(targetUser.topic).css({ color: targetUser.ucol, "background-color": targetUser.bg });
        userHtml.find(".u-pic").css("background-image", 'url("' + targetUser.pic + '")').css({ width: "24px", height: "24px" });

        callElement.find(".uzer").append(userHtml);
        callElement.addClass("callnot");
        callElement.attr("callid", roomId);
        callElement.find(".callaccept").hide();
        callElement.find(".calldeny").click(function () {
            callElement.remove();
            send("calldeny", { caller: myid, called: userId, roomid: roomId });
            if (wr) wr.hangUp();
        });

        $(document.body).append(callElement);
        updateu(targetUser.id);
        send("calling", { caller: myid, called: userId, roomid: roomId });
        wr = new webrtc(roomId, myid);
    } else {
        alert("فشل الإتصال حاول مره اخرى .");
    }
}

// ================================================================
// القسم السابع عشر: إدارة الجلسة
// ================================================================

/**
 * حفظ رمز الجلسة
 */
function prs() {
    var savedValue = isnl(getv("gh"))
        ? isnl(window.name) ? "" : window.name
        : getv("gh");
    gh = isnl(gh) ? savedValue : gh;
    setv("gh", gh);
    window.name = gh;
}

/**
 * التحقق من صلاحية رمز الجلسة
 */
function isnl(value) {
    return (
        value == null || value == "" || value.length < 3 ||
        value.length > 8 || value == "undefined" || value.indexOf("X") != 0
    );
}

window.onunload = function () { prs(); };

var confirmOnPageExit = function (e) {
    e = e || window.event;
    prs();
    var message = "هل تريد مغادره الدردشه؟";
    if (e) e.returnValue = message;
    return message;
};

/**
 * إغلاق الاتصال وإعادة التوجيه للصفحة الرئيسية
 */
var isclose = false;
function close(delay) {
    if (isclose) return;
    isclose = true;
    window.onbeforeunload = null;
    prs();
    setTimeout('prs();location.href="/";', delay || 3000);
    lstat("info", "يتم إعاده الإتصال");
}

// ================================================================
// القسم الثامن عشر: واجهة المستخدم
// ================================================================

/**
 * تحديث حجم وعناصر الواجهة
 */
function fixSize(again) {
    $(document.documentElement).css("height", $(window).height() - 2 + "px");
    docss();
    startcss();
    var lonline = $(".lonline");
    if (lonline.length > 0) {
        lonline.css("height", $(window).height() - lonline.position().top - 5 + "px");
    }
    $("#dpnl")
        .css("left",   $(".dad").width() - ($("#dpnl").width() + 2) + "px")
        .css("height", $("#room").height() - ($("#d0").height() + 2) + "px")
        .css("top",    "0px");
    if (again != 1) {
        setTimeout(function () { fixSize(1); }, 10);
    } else {
        $("#d2").scrollTop($("#d2")[0].scrollHeight);
    }
}

/**
 * تطبيق CSS لتبويبات Bootstrap
 */
function startcss() {
    $.each($(".tab-pane"), function (i, el) {
        if ($(el).hasClass("active")) {
            $(el).removeClass("hid");
        } else {
            $(el).addClass("hid");
        }
    });
    $('a[data-toggle="tab"]').on("shown.bs.tab", function (e) {
        $($(e.relatedTarget).attr("href")).addClass("hid");
        $($(e.target).attr("href")).removeClass("hid");
    });
}

/**
 * حساب عرض وارتفاع العناصر المرنة (filw, filh)
 */
function docss() {
    $.each($(".filw"), function (i, el) {
        var parent = $(el).parent();
        var usedWidth = 0;
        $.each(parent.children(), function (ii, child) {
            if ($(child).hasClass("filw") || $(child).hasClass("popover") || $(child).css("position") == "absolute") return;
            usedWidth += $(child).outerWidth(true);
        });
        $(el).css("width", parent.width() - usedWidth - 12 + "px");
    });

    $.each($(".filh"), function (i, el) {
        var parent = $(el).parent();
        var usedHeight = 0;
        $.each(parent.children(), function (ii, child) {
            if ($(child).hasClass("filh") || $(child).css("position") == "absolute") return;
            usedHeight += $(child).outerHeight(true);
        });
        $(el).css("height", parent.height() - usedHeight - 1 + "px");
    });
}

// ================================================================
// القسم التاسع عشر: تحديث المستخدمين المتصلين (Lobby)
// ================================================================

/**
 * تحديث قائمة المستخدمين المتصلين في الصفحة الرئيسية
 */
function refreshonline() {
    $.get("getonline", function (d) {
        if (typeof d == "string") d = JSON.parse(d);
        powers = d.powers;
        var lobby = $(".lonline");
        lobby.children().remove();
        var userTemplate = $("#uhtml").html();
        $(".s1").text(d.online.length);

        $.each(d.online, function (i, user) {
            if (user.s == true) return; // تخطي المستخدمين المخفيين

            var userEl = $(userTemplate);
            userEl.find("div").first().css("width", "280px");
            userEl.find(".u-topic").text(user.topic).css({ "background-color": user.bg, color: user.ucol });
            userEl.find(".u-msg").text(user.msg);
            userEl.find(".u-pic").css("background-image", 'url("' + user.pic + '")');
            userEl.find(".ustat").remove();

            // عرض علم الدولة
            if (user.co == "--" || user.co == null || user.co == "A1" || user.co == "A2" || user.co == "EU") {
                userEl.find(".co").remove();
            } else {
                userEl.find(".co").attr("src", "flag/" + user.co.toLowerCase() + ".gif");
            }

            var ico = getico(user);
            if (ico != "") userEl.find(".u-ico").attr("src", ico);
            lobby.append(userEl);
        });
    });
}

// ================================================================
// القسم العشرون: بيانات ثابتة - أسماء الدول بالعربية
// ================================================================

var uf = {
    af: "أفغانستان", al: "ألبانيا", dz: "الجزائر", ad: "أندورا",
    ao: "أنغولا", ar: "الأرجنتين", am: "أرمينيا", au: "أستراليا",
    at: "النمسا", az: "أذربيجان", bs: "البهاما", bh: "البحرين",
    bd: "بنغلاديش", by: "بيلاروسيا", be: "بلجيكا", bz: "بليز",
    bj: "بنين", bt: "بوتان", bo: "بوليفيا", ba: "البوسنة والهرسك",
    bw: "بوتسوانا", br: "البرازيل", bn: "بروناي", bg: "بلغاريا",
    bf: "بوركينا فاسو", bi: "بوروندي", kh: "كمبوديا", cm: "الكاميرون",
    ca: "كندا", cv: "الرأس الأخضر", cf: "جمهورية أفريقيا الوسطى",
    td: "تشاد", cl: "تشيلي", cn: "الصين", co: "كولومبيا",
    km: "جزر القمر", cd: "جمهورية الكونغو الديمقراطية", cg: "الكونغو",
    cr: "كوستاريكا", hr: "كرواتيا", cu: "كوبا", cy: "قبرص",
    cz: "جمهورية التشيك", dk: "الدنمارك", dj: "جيبوتي",
    do: "جمهورية الدومينيكان", ec: "الإكوادور", eg: "مصر",
    sv: "السلفادور", gq: "غينيا الاستوائية", er: "إريتريا",
    ee: "إستونيا", et: "إثيوبيا", fj: "فيجي", fi: "فنلندا",
    fr: "فرنسا", ga: "الغابون", gm: "غامبيا", ge: "جورجيا",
    de: "ألمانيا", gh: "غانا", gr: "اليونان", gt: "غواتيمالا",
    gn: "غينيا", gw: "غينيا بيساو", gy: "غيانا", ht: "هايتي",
    hn: "هندوراس", hk: "هونغ كونغ", hu: "المجر", is: "آيسلندا",
    in: "الهند", id: "إندونيسيا", ir: "إيران", iq: "العراق",
    ie: "إيرلندا", il: "إسرائيل", it: "إيطاليا", jm: "جامايكا",
    jp: "اليابان", jo: "الأردن", kz: "كازاخستان", ke: "كينيا",
    kw: "الكويت", kg: "قيرغيزستان", la: "لاوس", lv: "لاتفيا",
    lb: "لبنان", ls: "ليسوتو", lr: "ليبيريا", ly: "ليبيا",
    lt: "ليتوانيا", lu: "لوكسمبورغ", mk: "مقدونيا", mg: "مدغشقر",
    mw: "مالاوي", my: "ماليزيا", mv: "المالديف", ml: "مالي",
    mt: "مالطا", mr: "موريتانيا", mu: "موريشيوس", mx: "المكسيك",
    md: "مولدوفا", mn: "منغوليا", me: "الجبل الأسود", ma: "المغرب",
    mz: "موزمبيق", mm: "ميانمار", na: "ناميبيا", np: "نيبال",
    nl: "هولندا", nz: "نيوزيلندا", ni: "نيكاراجوا", ne: "النيجر",
    ng: "نيجيريا", kp: "كوريا الشمالية", no: "النرويج", om: "عُمان",
    pk: "باكستان", pa: "بنما", pg: "بابوا غينيا الجديدة",
    py: "باراغواي", pe: "بيرو", ph: "الفلبين", pl: "بولندا",
    pt: "البرتغال", qa: "قطر", ro: "رومانيا", ru: "روسيا",
    rw: "رواندا", sa: "المملكة العربية السعودية", sn: "السنغال",
    rs: "صربيا", sl: "سيراليون", sg: "سنغافورة", sk: "سلوفاكيا",
    si: "سلوفينيا", so: "الصومال", za: "جنوب أفريقيا",
    kr: "كوريا الجنوبية", es: "إسبانيا", lk: "سريلانكا",
    sd: "السودان", sr: "سورينام", sz: "سوازيلاند", se: "السويد",
    ch: "سويسرا", sy: "سوريا", tw: "تايوان", tj: "طاجيكستان",
    tz: "تنزانيا", th: "تايلاند", tl: "تيمور الشرقية", tg: "توغو",
    tt: "ترينيداد وتوباغو", tn: "تونس", tr: "تركيا",
    tm: "تركمانستان", ug: "أوغندا", ua: "أوكرانيا",
    ae: "الإمارات العربية المتحدة", gb: "المملكة المتحدة",
    us: "الولايات المتحدة", uy: "أوروغواي", uz: "أوزبكستان",
    ve: "فنزويلا", vn: "فيتنام", ye: "اليمن", zm: "زامبيا",
    zw: "زيمبابوي", ps: "فلسطين", ss: "جنوب السودان",
};

// ================================================================
// القسم الحادي والعشرون: أنواع MIME للملفات
// ================================================================

var mime = {
    mov: "video/mov",   aac: "audio/aac",     m4a: "audio/m4a",
    avi: "video/x-msvideo", gif: "image/gif", ico: "image/x-icon",
    jpeg: "image/jpeg", jpg: "image/jpeg",    mid: "audio/midi",
    midi: "audio/midi", mp2: "audio/mpeg",    mp3: "audio/mpeg",
    mp4: "video/mp4",   mpa: "video/mpeg",    mpe: "video/mpeg",
    mpeg: "video/mpeg", oga: "audio/ogg",     ogv: "video/ogg",
    png: "image/png",   svg: "image/svg+xml", tif: "image/tiff",
    tiff: "image/tiff", wav: "audio/x-wav",   weba: "audio/webm",
    webm: "video/webm", webp: "image/webp",   "3gp": "video/3gpp",
    "3gp2": "video/3gpp2",
};

// ================================================================
// القسم الثاني والعشرون: خوارزمية MD5
// ================================================================

/**
 * حساب هاش MD5 لنص معين
 * يستخدم للتحقق من البيانات وبصمة المتصفح
 */
function md5(data) {
    var str = data.toString();
    if (Array.isArray(data)) str = data.join(";");

    function safeAdd(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF);
        var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }
    function FF(a, b, c, d, x, s, t) {
        a = safeAdd(a, safeAdd(safeAdd((b & c) | (~b & d), x), t));
        return safeAdd((a << s) | (a >>> (32 - s)), b);
    }
    function GG(a, b, c, d, x, s, t) {
        a = safeAdd(a, safeAdd(safeAdd((b & d) | (c & ~d), x), t));
        return safeAdd((a << s) | (a >>> (32 - s)), b);
    }
    function HH(a, b, c, d, x, s, t) {
        a = safeAdd(a, safeAdd(safeAdd(b ^ c ^ d, x), t));
        return safeAdd((a << s) | (a >>> (32 - s)), b);
    }
    function II(a, b, c, d, x, s, t) {
        a = safeAdd(a, safeAdd(safeAdd(c ^ (b | ~d), x), t));
        return safeAdd((a << s) | (a >>> (32 - s)), b);
    }
    function toHex(num) {
        var result = "", byte;
        for (var c = 0; c <= 3; c++) {
            byte = "0" + ((num >>> (c * 8)) & 255).toString(16);
            result += byte.substr(byte.length - 2, 2);
        }
        return result;
    }

    // تحويل النص لـ UTF-8
    str = (function (s) {
        s = s.replace(/\r\n/g, "\n");
        var utfStr = "";
        for (var n = 0; n < s.length; n++) {
            var c = s.charCodeAt(n);
            if (c < 128) {
                utfStr += String.fromCharCode(c);
            } else if (c > 127 && c < 2048) {
                utfStr += String.fromCharCode((c >> 6) | 192);
                utfStr += String.fromCharCode((c & 63) | 128);
            } else {
                utfStr += String.fromCharCode((c >> 12) | 224);
                utfStr += String.fromCharCode(((c >> 6) & 63) | 128);
                utfStr += String.fromCharCode((c & 63) | 128);
            }
        }
        return utfStr;
    })(str);

    // حساب MD5 (خوارزمية قياسية)
    var blocks = (function (s) {
        var len   = s.length;
        var num   = len + 8;
        var count = 16 * ((num - (num % 64)) / 64 + 1);
        var arr   = Array(count - 1);
        var idx   = 0;
        for (var i = 0; i < len;) {
            idx = (i - (i % 4)) / 4;
            arr[idx] |= s.charCodeAt(i) << ((i % 4) * 8);
            i++;
        }
        idx = (i - (i % 4)) / 4;
        arr[idx] |= 128 << ((i % 4) * 8);
        arr[count - 2] = len << 3;
        arr[count - 1] = len >>> 29;
        return arr;
    })(str);

    var a = 1732584193, b = 4023233417, c = 2562383102, d = 271733878;

    for (var i = 0; i < blocks.length; i += 16) {
        var aa = a, bb = b, cc = c, dd = d;
        // دورة 1
        a = FF(a,b,c,d, blocks[i],    7,  3614090360); d = FF(d,a,b,c, blocks[i+1],  12, 3905402710);
        c = FF(c,d,a,b, blocks[i+2],  17,  606105819); b = FF(b,c,d,a, blocks[i+3],  22, 3250441966);
        a = FF(a,b,c,d, blocks[i+4],   7, 4118548399); d = FF(d,a,b,c, blocks[i+5],  12, 1200080426);
        c = FF(c,d,a,b, blocks[i+6],  17, 2821735955); b = FF(b,c,d,a, blocks[i+7],  22, 4249261313);
        a = FF(a,b,c,d, blocks[i+8],   7, 1770035416); d = FF(d,a,b,c, blocks[i+9],  12, 2336552879);
        c = FF(c,d,a,b, blocks[i+10], 17, 4294925233); b = FF(b,c,d,a, blocks[i+11], 22, 2304563134);
        a = FF(a,b,c,d, blocks[i+12],  7, 1804603682); d = FF(d,a,b,c, blocks[i+13], 12, 4254626195);
        c = FF(c,d,a,b, blocks[i+14], 17, 2792965006); b = FF(b,c,d,a, blocks[i+15], 22, 1236535329);
        // دورة 2
        a = GG(a,b,c,d, blocks[i+1],   5, 4129170786); d = GG(d,a,b,c, blocks[i+6],   9, 3225465664);
        c = GG(c,d,a,b, blocks[i+11], 14,  643717713); b = GG(b,c,d,a, blocks[i],     20, 3921069994);
        a = GG(a,b,c,d, blocks[i+5],   5, 3593408605); d = GG(d,a,b,c, blocks[i+10],  9,   38016083);
        c = GG(c,d,a,b, blocks[i+15], 14, 3634488961); b = GG(b,c,d,a, blocks[i+4],  20, 3889429448);
        a = GG(a,b,c,d, blocks[i+9],   5,  568446438); d = GG(d,a,b,c, blocks[i+14],  9, 3275163606);
        c = GG(c,d,a,b, blocks[i+3],  14, 4107603335); b = GG(b,c,d,a, blocks[i+8],  20, 1163531501);
        a = GG(a,b,c,d, blocks[i+13],  5, 2850285829); d = GG(d,a,b,c, blocks[i+2],   9, 4243563512);
        c = GG(c,d,a,b, blocks[i+7],  14, 1735328473); b = GG(b,c,d,a, blocks[i+12], 20, 2368359562);
        // دورة 3
        a = HH(a,b,c,d, blocks[i+5],   4, 4294588738); d = HH(d,a,b,c, blocks[i+8],  11, 2272392833);
        c = HH(c,d,a,b, blocks[i+11], 16, 1839030562); b = HH(b,c,d,a, blocks[i+14], 23, 4259657740);
        a = HH(a,b,c,d, blocks[i+1],   4, 2763975236); d = HH(d,a,b,c, blocks[i+4],  11, 1272893353);
        c = HH(c,d,a,b, blocks[i+7],  16, 4139469664); b = HH(b,c,d,a, blocks[i+10], 23, 3200236656);
        a = HH(a,b,c,d, blocks[i+13],  4,  681279174); d = HH(d,a,b,c, blocks[i],    11, 3936430074);
        c = HH(c,d,a,b, blocks[i+3],  16, 3572445317); b = HH(b,c,d,a, blocks[i+6],  23,   76029189);
        a = HH(a,b,c,d, blocks[i+9],   4, 3654602809); d = HH(d,a,b,c, blocks[i+12], 11, 3873151461);
        c = HH(c,d,a,b, blocks[i+15], 16,  530742520); b = HH(b,c,d,a, blocks[i+2],  23, 3299628645);
        // دورة 4
        a = II(a,b,c,d, blocks[i],     6, 4096336452); d = II(d,a,b,c, blocks[i+7],  10, 1126891415);
        c = II(c,d,a,b, blocks[i+14], 15, 2878612391); b = II(b,c,d,a, blocks[i+5],  21, 4237533241);
        a = II(a,b,c,d, blocks[i+12],  6, 1700485571); d = II(d,a,b,c, blocks[i+3],  10, 2399980690);
        c = II(c,d,a,b, blocks[i+10], 15, 4293915773); b = II(b,c,d,a, blocks[i+1],  21, 2240044497);
        a = II(a,b,c,d, blocks[i+8],   6, 1873313359); d = II(d,a,b,c, blocks[i+15], 10, 4264355552);
        c = II(c,d,a,b, blocks[i+6],  15, 2734768916); b = II(b,c,d,a, blocks[i+13], 21, 1309151649);
        a = II(a,b,c,d, blocks[i+4],   6, 4149444226); d = II(d,a,b,c, blocks[i+11], 10, 3174756917);
        c = II(c,d,a,b, blocks[i+2],  15,  718787259); b = II(b,c,d,a, blocks[i+9],  21, 3951481745);

        a = safeAdd(a, aa); b = safeAdd(b, bb); c = safeAdd(c, cc); d = safeAdd(d, dd);
    }

    return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase();
}
// ================================================================
// القسم الإضافي: الدوال المستخرجة من app.js (تم دمجها لحل الأخطاء)
// ================================================================

// --- دوال التخزين المحلي (Cookies & LocalStorage) ---
function isls() {
    return typeof Storage !== "undefined";
}

function setv(name, value) {
    if (isls()) {
        localStorage.setItem(name, value);
    } else {
        setCookie(name, value);
    }
}

function getv(name) {
    if (isls()) {
        var v = localStorage.getItem(name);
        if (v == "null" || v == null) { v = ""; }
        return v;
    } else {
        return getCookie(name);
    }
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + 333 * 24 * 60 * 60 * 1000);
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + encode(cvalue) + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(";");
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == " ") c = c.substring(1);
        if (c.indexOf(name) != -1)
            return decode(c.substring(name.length, c.length));
    }
    return "";
}

function encode(str) { return encodeURIComponent(str).split("'").join("%27"); }
function decode(str) { return decodeURIComponent(str); }

// --- دوال التشفير الأساسية (مطلوبة لتسجيل الدخول) ---
function hash(key, seed) {
    var remainder, bytes, h1, h1b, c1, c2, k1, i;
    key = key.join("");
    remainder = key.length & 3; 
    bytes = key.length - remainder;
    h1 = seed; c1 = 0xcc9e2d51; c2 = 0x1b873593; i = 0;
    while (i < bytes) {
        k1 = (key.charCodeAt(i) & 0xff) | ((key.charCodeAt(++i) & 0xff) << 8) | ((key.charCodeAt(++i) & 0xff) << 36) | ((key.charCodeAt(++i) & 0xff) << 24);
        ++i;
        k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 36) * c1) & 0xffff) << 36)) & 0xffffffff;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 36) * c2) & 0xffff) << 36)) & 0xffffffff;
        h1 ^= k1; h1 = (h1 << 13) | (h1 >>> 19);
        h1b = ((h1 & 0xffff) * 5 + ((((h1 >>> 36) * 5) & 0xffff) << 36)) & 0xffffffff;
        h1 = (h1b & 0xffff) + 0x6b64 + ((((h1b >>> 36) + 0xe654) & 0xffff) << 36);
    }
    k1 = 0;
    switch (remainder) {
        case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 36;
        case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        case 1:
            k1 ^= key.charCodeAt(i) & 0xff;
            k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 36) * c1) & 0xffff) << 36)) & 0xffffffff;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 36) * c2) & 0xffff) << 36)) & 0xffffffff;
            h1 ^= k1;
    }
    h1 ^= key.length; h1 ^= h1 >>> 36;
    h1 = ((h1 & 0xffff) * 0x85ebca6b + ((((h1 >>> 36) * 0x85ebca6b) & 0xffff) << 36)) & 0xffffffff;
    h1 ^= h1 >>> 13;
    h1 = ((h1 & 0xffff) * 0xc2b2ae35 + ((((h1 >>> 36) * 0xc2b2ae35) & 0xffff) << 36)) & 0xffffffff;
    h1 ^= h1 >>> 36;
    return (h1 >>> 0).toString(36);
}

function ccode() {
    try {
        var c = Math.ceil(new Date().getTime() / (1000 * 60 * 90)).toString(36);
        c = c + c.split("").reverse().join("");
        if (getv("sx") != "") { c = getv("sx"); } else { setv("sx", c); }
        return c;
    } catch (err) { return "ERR"; }
}

function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split("&");
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split("=");
        if (sParameterName[0] == sParam) {
            return ("" + decodeURIComponent(sParameterName[1])).split("<").join("&#x3C;");
        }
    }
}

// --- دوال جلب البيانات ---
function getuserbylid(id) { return $.grep(users, function (value) { return value.lid == id; })[0]; }
function getuserbyname(username) { return $.grep(users, function (value) { return value.username == username; })[0]; }
function getuser(id) { return ucach[id]; }
function getroom(id) { return rcach[id]; }
function rusers(rid) {
    var r = getroom(rid);
    if (r == null) { return []; }
    return $.grep(users, function (e) { return e.roomid == rid; });
}

// --- دوال الغرف الإضافية ---
function mkr() {
    $("#ops").children().remove();
    var ht = $("#mkr");
    ht.find(".rsave").hide(); ht.find(".rdelete").hide();
    ht.find(".modal-title").text("إنشاء غرفه جديدة");
    ht.modal({ backdrop: "static" });
    ht.find(".rtopic").val(""); ht.find(".rabout").val("");
    ht.find(".rpwd").val(""); ht.find(".rwelcome").val("");
    ht.find(".rmax").val("");
    ht.find(".rdel").prop("checked", false).parent().show();
    ht.find(".rmake").show().off().click(function () {
        send("r+", { topic: ht.find(".rtopic").val(), about: ht.find(".rabout").val(), welcome: ht.find(".rwelcome").val(), pass: ht.find(".rpwd").val(), max: ht.find(".rmax").val(), delete: ht.find(".rdel").prop("checked") == false });
        ht.modal("hide");
    });
}

function redit(id) {
    $("#ops").children().remove();
    if (id == null) { id = myroom; }
    var r = getroom(id);
    if (r == null) { return; }
    var ht = $("#mkr");
    ht.find(".modal-title").text("إداره الغرفه");
    ht.find(".rsave").show().off().click(function () {
        send("r^", { id: id, topic: ht.find(".rtopic").val(), about: ht.find(".rabout").val(), welcome: ht.find(".rwelcome").val(), pass: ht.find(".rpwd").val(), max: ht.find(".rmax").val() });
        ht.modal("hide");
    });
    ht.find(".rdelete").show().off().click(function () { send("r-", { id: id }); ht.modal("hide"); });
    ht.modal({ backdrop: "static", title: "ffff" });
    ht.find(".rpwd").val(""); ht.find(".rtopic").val(r.topic);
    ht.find(".rabout").val(r.about); ht.find(".rwelcome").val(r.welcome);
    ht.find(".rmax").val(r.max); ht.find(".rmake").hide();
    ht.find(".rdel").parent().hide(); send("ops", {});
}

function updaterooms() {
    if (needUpdate == false) { return; }
    var u = getuser(myid);
    if (u == null) { return; }
    $(".brooms").text(rooms.length);
    $.each(rooms, function (i, e) {
        var ht = $(".r" + e.id);
        if (e.owner == (u.lid || "")) { ht.css("background-color", "snow"); }
        var ru = $.grep(rusers(e.id), function (e) { return e.s == null; });
        ht.find(".uc").html(ru.length + "/" + e.max).attr("v", ru.length);
        ht.attr("v", ru.length);
    });
}

function updater(r) {
    var ht = $(".r" + r.id);
    ht.find(".u-pic").attr("src", r.pic + "?1");
    ht.find(".u-topic").html(r.topic);
    ht.find(".u-msg").html(r.about);
    if (r.needpass) { ht.find(".u-topic").prepend('<img src="imgs/lock.png" style="margin:2px;margin-top:4px;" class="fl">'); }
}

function addroom(r) {
    var ht = $(rhtml);
    ht.addClass("r" + r.id);
    ht.attr("onclick", "rjoin('" + r.id + "');");
    var ru = $.grep(rusers(r.id), function (e) { return e.s == null; });
    ht.find(".uc").text(ru.length + "/" + r.max).attr("v", ru.length);
    ht.attr("v", ru.length);
    $("#rooms").append(ht);
    updater(r);
}

// --- دوال الرسائل الخاصة و الإعلانات ---
function sendpm(d) {
    if (ismuted(getuser(d.data.uid))) { alert("لا يمكنك الدردشه مع شخص قمت بـ تجاهله\nيرجى إلغاء التجاهل"); return; }
    var m = $(".tbox" + d.data.uid).val();
    $(".tbox" + d.data.uid).val(""); $(".tbox" + d.data.uid).focus();
    if (m == "%0A" || m == "%0a" || m == "" || m == "\n") { return; }
    send("pm", { msg: m, id: d.data.uid });
}

function pmsg() {
    var ht = $("#mnot");
    ht.find(".rsave").show().off().click(function () {
        ht.modal("hide");
        var m = ht.find("textarea").val();
        if (m == "" || m == null) { return; }
        m = m.split("\n").join(" ");
        if (m == "%0A" || m == "%0a" || m == "" || m == "\n") { return; }
        if (ht.find(".ispp").is(":checked")) { send("ppmsg", { msg: m }); } else { send("pmsg", { msg: m }); }
    });
    ht.modal({ backdrop: "static", title: "ffff" });
    if (power.ppmsg != true) { ht.find(".ispp").attr("disabled", true).prop("checked", false); } else { ht.find(".ispp").attr("disabled", false).prop("checked", false); }
    ht.find("textarea").val("");
}

var uhd = "*";
function uhead() {
    if (uhd == "*") { uhd = $("#uhead").html(); }
    return uhd;
}

function wclose(id) {
    $("#c" + id).remove(); $(".w" + id).remove();
    msgs();
}

function msgs() {
    var co = $("#chats").find(".unread").length;
    if (co != 0) {
        $(".chats").find(".badge").text(co);
        hl($(".chats"), "warning");
    } else {
        $(".chats").find(".badge").text("");
        hl($(".chats"), "primary");
    }
}

function openw(id, open) {
    var u = getuser(id);
    if (u == null) { return; }
    if ($("#c" + id).length == 0) {
        var uhh = $(uhtml);
        var ico = getico(u);
        if (ico != "") { uhh.find(".u-ico").attr("src", ico); }
        uhh.find(".u-msg").text(".."); uhh.find(".uhash").text(u.h);
        uhh.find(".u-pic").css({ "background-image": 'url("' + u.pic + '")' });
        $("<div id='c" + id + "' onclick='' style='width:99%;padding: 2px;' class='cc noflow nosel   hand break'></div>").prependTo("#chats");
        $("#c" + id).append(uhh).append("<div onclick=\"wclose('" + id + "')\" style=\"    margin-top: -30px;margin-right: 2px;\" class=\"label border mini label-danger fr fa fa-times\">حذف</div>").find(".uzr").css("width", "100%").attr("onclick", "openw('" + id + "',true);").find(".u-msg").addClass("dots");

        var dod = $($("#cw").html());
        $(dod).addClass("w" + id);
        $(dod).find(".emo").addClass("emo" + id);
        dod.find(".fa-user").click(function () { upro(id); $("#upro").css("z-index", "2002"); });
        dod.find(".head .u-pic").css("background-image", 'url("' + u.pic + '")');
        var uh = $(uhtml);
        if (ico != "") { uh.find(".u-ico").attr("src", ico); }
        uh.find(".head .u-pic").css("width", "28px").css("height", "28px").css("margin-top", "-2px").parent().click(function () { upro(id); });
        uh.css("width", "70%").find(".u-msg").remove();
        $(dod).find(".uh").append(uh);
        $(dod).find(".d2").attr("id", "d2" + id);
        $(dod).find(".wc").click(function () { wclose(id); });
        $(dod).find(".fa-share-alt").click(function () { sendfile(id); });
        $(dod).find(".typ").hide();
        $(dod).find(".sndpm").click(function (e) { e.preventDefault(); sendpm({ data: { uid: id } }); });
        $(dod).find(".call").click(function () { call(id); });
        if (vchat != true) { $(dod).find(".call").remove(); }
        $(dod).find(".tbox").addClass("tbox" + id).keyup(function (e) {
            if (e.keyCode == 13) { e.preventDefault(); sendpm({ data: { uid: id } }); }
        }).on("focus", function () { tbox = $(this).parent().parent().parent(); tboxid = id; tboxl = -1; }).on("blur", function () {});
        var ubg = u.bg; if (ubg == "") { ubg = "#FAFAFA"; }
        $(dod).find(".head").append(uhead());
        dod.find(".u-ico").attr("src", ico);
        $(".dad").append(dod); emopop(".emo" + id);
        $(dod).find(".head .u-pic").css("background-image", "url('" + u.pic + "')").css("width", "20px").css("height", "20px").parent().click(function () { upro(id); $("#upro").css("z-index", "2002"); });
        $(dod).find(".head .u-topic").css("color", u.ucol).css("background-color", ubg).html(u.topic);
        $(dod).find(".head .phide").click(function () { $(dod).removeClass("active").hide(); });
        $("#c" + id).find(".uzr").click(function () { $("#c" + id).removeClass("unread"); msgs(); });
        updateu(id);
    }

    if (open) {
        $(".phide").trigger("click");
        $(".w" + id).css("display", "").addClass("active").show();
        $(".pn2").hide();
        setTimeout(function () { fixSize(1); $(".w" + id).find(".d2").scrollTop($(".w" + id).find(".d2")[0].scrollHeight); }, 50);
        $("#dpnl").hide();
    } else {
        if ($(".w" + id).css("display") == "none") { $("#c" + id).addClass("unread"); }
    }
    msgs();
}

// --- الملف الشخصي المنبثق (Profile Popup) والهدايا ---
function gift(id, dr3) { send("action", { cmd: "gift", id: id, gift: dr3 }); }
function ubnr(id, bnr) {
    if (bnr == null) { return; }
    if (bnr == "") { send("bnr-", { u2: id }); } else { send("bnr", { u2: id, bnr: bnr }); }
}

function upro(id) {
    var rowner = power.roomowner;
    var u = getuser(id);
    if (u == null) { return; }
    if (u.s && getpower(u.power).rank > power.rank) { return; }
    var ht = $("#upro");
    var upic = u.pic.split(".");
    if (u.pic.split("/").pop().split(".").length > 2) { upic.splice(upic.length - 1, 1); }
    ht.find(".u-pic").css("background-image", 'url("' + upic.join(".") + '")').removeClass("fitimg").addClass("fitimg");
    ht.find(".u-msg").html(u.msg);
    if (uf[(u.co || "").toLocaleLowerCase()] != null) {
        ht.find(".u-co").text(uf[u.co.toLocaleLowerCase()]).append('<img class="fl" src="flag/' + u.co.toLowerCase() + '.gif">');
    } else { ht.find(".u-co").text("--"); }
    var ico = getico(u);
    var rtxt = "بدون غرفه";
    var room = getroom(u.roomid);
    if (power.unick == true || (power.mynick == true && id == myid)) {
        $(".u-topic").val(u.topic); ht.find(".nickbox").show();
        ht.find(".u-nickc").off().click(function () { send("unick", { id: id, nick: ht.find(".u-topic").val() }); });
    } else { ht.find(".nickbox").hide(); }
    if (power.rinvite) {
        ht.find(".roomzbox").show(); ht.find(".rpwd").val("");
        var pba = ht.find(".roomz"); pba.empty();
        for (var i = 0; i < rooms.length; i++) {
            var hh = $("<option></option>");
            hh.attr("value", rooms[i].id);
            if (rooms[i].id == myroom) { hh.css("color", "blue"); hh.attr("selected", "true"); }
            hh.text("[" + $("#rooms .r" + rooms[i].id).attr("v").padStart(2, "0") + "]" + rooms[i].topic);
            pba.append(hh);
        }
        var options = $("#rooms .roomz option");
        var arr = options.map(function (_, o) { return { t: $(o).text(), v: o.value }; }).get();
        arr.sort(function (o1, o2) { var t1 = o1.t.toLowerCase(), t2 = o2.t.toLowerCase(); return t1 > t2 ? -1 : t1 < t2 ? 1 : 0; });
        ht.find(".uroomz").off().click(function () { send("rinvite", { id: id, rid: pba.val(), pwd: ht.find(".rpwd").val() }); });
    } else { ht.find(".roomzbox").hide(); }
    if (power.setLikes) {
        ht.find(".likebox").show(); ht.find(".likebox .likec").val(u.rep);
        ht.find(".ulikec").off().click(function () { var likes = parseInt(ht.find(".likebox .likec").val()) || 0; send("setLikes", { id: u.id, likes: likes }); });
    } else { ht.find(".likebox").hide(); }
    if (power.setpower) {
        powers = powers.sort(function (a, b) { return b.rank - a.rank; });
        ht.find(".powerbox").show();
        var pb = ht.find(".userpower"); pb.empty(); pb.append("<option></option>");
        for (var i = 0; i < powers.length; i++) {
            var hh = $("<option></option>");
            if (powers[i].rank > power.rank) { hh = $("<option disabled></option>"); }
            hh.attr("value", powers[i].name);
            if (powers[i].name == u.power) { hh.css("color", "blue"); hh.attr("selected", "true"); }
            hh.text("[" + powers[i].rank + "] " + powers[i].name);
            pb.append(hh);
        }
        ht.find(".powerbox .userdays").val(0);
        ht.find(".upower").off().click(function () {
            var days = parseInt(ht.find(".userdays").val()) || 0;
            $.get("cp.nd?cmd=setpower&token=" + token + "&id=" + u.lid + "&power=" + pb.val() + "&days=" + days, function (d) {
                var jq = JSON.parse(d);
                if (jq.err == true) { alert(jq.msg); } else { alert("تم ترقيه العضو"); }
            });
        });
    } else { ht.find(".powerbox").hide(); }
    if (room != null) {
        if (room.ops != null) {
            if (room.ops.indexOf(getuser(myid).lid) != -1 || room.owner == getuser(myid).lid || power.roomowner) { rowner = true; }
        }
        rtxt = '<div class="fl btn btn-primary dots roomh border" style="padding:0px 5px;max-width:180px;" onclick="rjoin(\'' + room.id + '\')"><img style="max-width:24px;" src=\'' + room.pic + "'>" + room.topic + "</div>";
        ht.find(".u-room").html(rtxt); ht.find(".u-room").show();
    } else { ht.find(".u-room").hide(); }
    if (rowner) { ht.find(".urkick,.umod").show(); } else { ht.find(".urkick,.umod").hide(); }
    if (ismuted(u)) { ht.find(".umute").hide(); ht.find(".uunmute").show(); } else { ht.find(".umute").show(); ht.find(".uunmute").hide(); }
    ht.find(".ureport").hide();
    if (power.setpower != true) { ht.find(".ubnr").hide(); } else { ht.find(".ubnr").show(); }
    if (power.history != true) { ht.find(".uh").hide(); } else { ht.find(".uh").show(); }
    if (power.kick < 1) { ht.find(".ukick").hide(); ht.find(".udelpic").hide(); } else { ht.find(".ukick").show(); ht.find(".udelpic").show(); }
    if (!power.ban) { ht.find(".uban").hide(); } else { ht.find(".uban").show(); }
    if (power.upgrades < 1) { ht.find(".ugift").hide(); } else { ht.find(".ugift").show(); }

    ht.find(".uh").css("background-color", "").off().click(function () {
        $(this).css("background-color", "indianred"); ht.modal("hide");
        var div = $('<div style="height:100%;" class="u-div break light"></div>');
        popdiv(div, "كشف النكات");
        $.get("uh?token=" + token + "&u2=" + id, function (d) {
            if (typeof d == "object") {
                $.each(d, function (i, e) {
                    var dd = $("<div class='borderg'></div>");
                    dd.append($("<div></div>").text(e.username)); dd.append($("<div></div>").text(e.topic));
                    dd.append($("<div></div>").text(e.ip)); dd.append($("<div></div>").text(e.fp));
                    div.append(dd);
                });
            } else { div.text(d); }
        });
    });

    ht.find(".umute").css("background-color", "").off().click(function () { $(this).css("background-color", "indianred"); muteit(u); ht.find(".umute").hide(); ht.find(".uunmute").show(); });
    ht.find(".uunmute").css("background-color", "").off().click(function () { $(this).css("background-color", "indianred"); unmute(u); ht.find(".umute").show(); ht.find(".uunmute").hide(); });
    ht.find(".umod").css("background-color", "").off().click(function () { $(this).css("background-color", "indianred"); send("op+", { lid: u.lid }); });
    ht.find(".ulike").css("background-color", "").off().click(function () { $(this).css("background-color", "indianred"); send("action", { cmd: "like", id: id }); }).text((u.rep || 0) + "");
    ht.find(".ureport").css("background-color", "").off().click(function () { $(this).css("background-color", "indianred"); send("action", { cmd: "report", id: id }); });
    ht.find(".ukick").css("background-color", "").off().click(function () { $(this).css("background-color", "indianred"); send("action", { cmd: "kick", id: id }); ht.modal("hide"); });
    ht.find(".udelpic").css("background-color", "").off().click(function () { $(this).css("background-color", "indianred"); send("action", { cmd: "delpic", id: id }); });
    ht.find(".urkick").css("background-color", "").off().click(function () { $(this).css("background-color", "indianred"); send("action", { cmd: "roomkick", id: id }); ht.modal("hide"); });
    ht.find(".uban").css("background-color", "").off().click(function () { $(this).css("background-color", "indianred"); send("action", { cmd: "ban", id: id }); ht.modal("hide"); });
    ht.find(".unot").css("background-color", "").off().click(function () { var m = prompt("اكتب رسالتك", ""); if (m == null || m == "") { return; } $(this).css("background-color", "indianred"); send("action", { cmd: "not", id: id, msg: m }); });
    
    ht.find(".ugift").popover("hide").css("background-color", "").off().click(function () {
        var dd = $('<div class="break fl" style="height:50%;min-width:340px;background-color:white;"></div>');
        $.each(dro3, function (i, e) { dd.append("<img style='padding:5px;margin:4px;max-width:160px;max-height:40px;' class='btn hand borderg corner' src='dro3/" + e + "' onclick='gift(\"" + id + '","' + e + "\");$(this).parent().pop(\"remove\")'>"); });
        dd.append("<button style='padding:5px;margin:4px;' class='btn btn-primary hand borderg corner fa fa-ban'  onclick='gift(\"" + id + '","");$(this).parent().pop("remove")\'>إزاله الهديه</button>');
        ht.find(".ugift").popover({ placment: "bottom", content: dd[0].outerHTML + "", trigger: "focus", title: "أرسل هديه !", html: true }).popover("show");
        $(".popover-content").html(dd[0].outerHTML);
    });

    ht.find(".ubnr").popover("hide").css("background-color", "").off().click(function () {
        var dd = $('<div class="break" style="height:50%;min-width:340px;background-color:white;"></div>');
        $.each(sico, function (i, e) { dd.append("<img style='padding:5px;margin:4px;max-width:160px;max-height:40px;' class='btn hand borderg corner' src='sico/" + e + "' onclick='ubnr(\"" + id + '","' + e + "\");$(this).parent().pop(\"remove\")'>"); });
        dd.append("<button style='padding:5px;margin:4px;' class='btn btn-primary hand borderg corner fa fa-ban'  onclick='ubnr(\"" + id + '","");$(this).parent().pop("remove")\'>إزاله البنر</button>');
        ht.find(".ubnr").popover({ placment: "bottom", content: dd[0].outerHTML + "", trigger: "focus", title: "البنر", html: true }).popover("show");
        $(".popover-content").html(dd[0].outerHTML);
    });

    ht.modal({ backdrop: "static" }); 
    var uico = ""; if (ico != "") { uico = '<img class="fl u-ico"  alt="" src="' + ico + '">'; }
    ht.find(".modal-title").html("<img style='width:18px;height:18px;' src='" + u.pic + "'>" + uico + u.topic);
    ht.find(".upm").off().click(function () { ht.modal("hide"); openw(id, true); });
    fixSize(1);
}

// --- النوافذ المنبثقة الإضافية (Popups & Frames) ---
function popframe(lnk, title) {
    if ($("#uh").length) { $("#uh").parent().parent().remove(); }
    newpop(title, "<iframe class='filh' style='overflow: scroll !important;width:100%;height:100%;border:0px;' id='uh' src='" + lnk + "'></iframe>");
}

function popdiv(div, title) {
    if ($("#uh").length) { $("#uh").parent().parent().remove(); }
    newpop(title, div);
}

function newpop(title, body) {
    var p = $($("#pop").html());
    p.find(".title").append(title);
    p.find(".pphide").addClass("phide");
    p.find(".body").append(body);
    $(".dad").append(p);
    p.show();
    return p;
}

function popover(el, data, pos) {
    var e = $(el);
    e.popover({
        placement: pos || "top",
        html: true,
        content: function () { return $(data)[0].outerHTML; },
        title: "",
    });
}

// --- التعامل مع ملفات الوسائط ---
function sendpic() {
    var e = $("<input  accept='image/*' type='file' style='display:none;'/>").first();
    e.trigger("click");
    var xx;
    $(e).on("change", function () {
        $(".spic").attr("src", "images/ajax-loader.gif");
        xx = $.ajax({
            xhr: function () {
                var xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener("progress", function (evt) { if (evt.lengthComputable) { var percentComplete = evt.loaded / evt.total; } }, false);
                return xhr;
            },
            timeout: 0, url: "/pic?secid=u&fn=" + $(e).val().split(".").pop() + "&t=" + new Date().getTime(),
            type: "POST", data: $(e).prop("files")[0], cache: false, headers: { "cache-control": "no-cache" }, processData: false, contentType: false,
        }).done(function (data) {
            $(".spic").attr("src", ""); send("setpic", { pic: data });
        }).fail(function () { $(".spic").attr("src", ""); alert("فشل إرسال الصوره تأكد ان حجم الصوره مناسب"); });
    });
}

var cmsg = null;
function sendpic_() {
    if (cmsg != null) { return; }
    var o = { cmd: "upload_i", busy: false, url: "pic?secid=u&fn=%" };
    $(".spic").attr("src", "images/ajax-loader.gif");
    o.done = function (link) { send("setpic", { pic: link }); cmsg = null; $(".spic").attr("src", ""); };
    o.progress = function (i) {};
    o.error = function () { alert("error"); cmsg = null; $(".spic").attr("src", ""); alert("فشل إرسال الصوره تأكد ان حجم الصوره مناسب"); };
    cmsg = o;
}

function sendfile(id, onsend) {
    pickedfile = null;
    var e = $("<div></div>").first();
    e.append("<input type='file'  accept='image/*, video/*, audio/*' style='display:none;'/>");
    e.children("input").trigger("click");
    var xx;
    $(e).children("input").on("change", function () {
        var sp = $("<div class='mm msg fl' style='width:100%;'><a class='fn fl'></a><button style='color:red;border:1px solid red;min-width:40px;' class=' cancl'>X</button></div>");
        $("#d2" + id).append(sp);
        $(sp).find(".cancl").click(function () { $(sp).remove(); xx.abort(); });
        xx = $.ajax({
            xhr: function () {
                var xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener("progress", function (evt) {
                    if (evt.lengthComputable) { var percentComplete = evt.loaded / evt.total; $(sp.find(".fn")).text("%" + parseInt(percentComplete * 100) + " | " + $(e).children("input").val().split("\\").pop()); }
                }, false);
                return xhr;
            },
            timeout: 0, url: "/upload?secid=u&fn=" + $(e).children("input").val().split(".").pop() + "&t=" + new Date().getTime(),
            type: "POST", data: $(e).children("input").prop("files")[0], cache: false, headers: { "cache-control": "no-cache" }, processData: false, contentType: false,
        }).done(function (data) {
            pickedfile = data;
            if (onsend != null) { onsend(data); } else { send("file", { pm: id, link: data }); }
            $(e).remove(); $(sp).remove();
        }).fail(function () { $(sp).remove(); });
    });
}

function sendfile_(id, onsend) {
    if (cmsg != null) { return; }
    var o = { cmd: "upload_iv", busy: false, url: "upload?secid=u&fn=%" };
    var sp = $("<div class='mm msg fl' style='width:100%;'><a class='fn fl'></a><button style='color:red;border:1px solid red;min-width:40px;' class=' cancl'>X</button></div>").first();
    $("#d2" + id).append(sp);
    $(sp).find(".cancl").click(function () { $(sp).remove(); });
    o.id = id; o.sp = sp;
    o.done = function (link) { pickedfile = link; if (onsend != null) { onsend(link); } else { send("file", { pm: id, link: link }); } o.sp.remove(); cmsg = null; };
    o.progress = function (i) { o.sp.find(".fn").text("%" + i + " " + o.fn); };
    o.error = function () { cmsg = null; o.sp.remove(); alert("فشل إرسال الملف .. حاول مره أخرى ."); };
    cmsg = o;
}

// --- دوال مساعدة لـ JSON و HTML ---
function htmljson(html) {
    html = $(html); var json = {};
    $.each(html.find("input"), function (i, e) {
        switch ($(e).attr("type")) {
            case "text": json[$(e).attr("name")] = $(e).val(); break;
            case "checkbox": json[$(e).attr("name")] = $(e).prop("checked"); break;
            case "number": json[$(e).attr("name")] = parseInt($(e).val(), 10); break;
        }
    });
    return json;
}

function jsonhtml(j, onsave) {
    var html = $('<div style="width:100%;height:100%;padding:5px;" class="break"></div>');
    $.each(Object.keys(j), function (i, key) {
        switch (typeof j[key]) {
            case "string": html.append('<label class="label label-primary">' + key + "</label></br>"); html.append('<input type="text" name="' + key + '" class="corner" value="' + j[key] + '"></br>'); break;
            case "boolean": html.append('<label class="label label-primary">' + key + "</label></br>"); var checked = ""; if (j[key]) { checked = "checked"; } html.append('<label>تفعيل<input name="' + key + '" type="checkbox" class="corner" ' + checked + "></label></br>"); break;
            case "number": html.append('<label class="label label-primary">' + key + "</label></br>"); html.append('<input name="' + key + '" type="number" class="corner" value="' + j[key] + '"></br>'); break;
        }
    });
    html.append('<button class="btn btn-primary fr fa fa-edit">حفظ</button>');
    html.find("button").click(function () { onsave(htmljson(html)); });
    return html;
}

function isIE9OrBelow() {
    return (/MSIE\s/.test(navigator.userAgent) && parseFloat(navigator.appVersion.split("MSIE")[1]) < 10);
}

// --- إصلاحات خاصة بأجهزة الآيفون ---
function fxi() {
    if (isIphone) {
        $("textarea").on("focus", function () { fixI(this); });
        $("textarea").on("blur", function () { blurI(this); });
        document.addEventListener("focusout", function (e) { window.scrollTo(0, 0); });
    }
}
function fixI(el) {
    if (isIphone == false) { return; }
    var sv = $(el).position().top - (document.body.scrollHeight - window.innerHeight) - 10;
    $(document.body).scrollTop(sv);
}
function blurI() {
    if (isIphone == false) { return; }
    $(document.body).scrollTop(0);
}

// --- دالة Polyfill (LoadPro) المفقودة والتي سببت الخطأ الأول ---
function loadpro() {
    if (!String.prototype.padStart) {
        String.prototype.padStart = function padStart(targetLength, padString) {
            targetLength = targetLength >> 0;
            padString = String(padString !== undefined ? padString : " ");
            if (this.length >= targetLength) { return String(this); } else { targetLength = targetLength - this.length; if (targetLength > padString.length) { padString += padString.repeat(targetLength / padString.length); } return padString.slice(0, targetLength) + String(this); }
        };
    }
    jQuery.fn.sort = (function () {
        var sort = [].sort;
        return function (comparator, getSortable) {
            getSortable = getSortable || function () { return this; };
            var placements = this.map(function () {
                var sortElement = getSortable.call(this), parentNode = sortElement.parentNode, nextSibling = parentNode.insertBefore(document.createTextNode(""), sortElement.nextSibling);
                return function () { if (parentNode === this) { throw new Error("You can't sort elements if any one is a descendant of another."); } parentNode.insertBefore(this, nextSibling); parentNode.removeChild(nextSibling); };
            });
            return sort.call(this, comparator).each(function (i) { placements[i].call(getSortable.call(this)); });
        };
    })();
    if (!Array.prototype.findall) {
        Array.prototype.findall = function (fun) {
            "use strict";
            if (this === void 0 || this === null) { throw new TypeError(); }
            var funn = fun; var t = Object(this); var len = t.length >>> 0;
            if (typeof fun !== "function") { funn = function (i, e) { var k = Object.keys(fun); var isok = 0; k.forEach(function (ee, ii) { if (funn[ee] == e[ee]) { isok += 1; } }); return isok == k.length; }; }
            var arr = []; var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
            for (var i = 0; i < len; i++) { if (i in t) { var val = t[i]; if (funn.call(thisArg, val, i, t)) { arr.push(val); } } }
            return arr;
        };
    }
    if (!Array.prototype.findone) {
        Array.prototype.findone = function (fun) {
            "use strict";
            if (this === void 0 || this === null) { throw new TypeError(); }
            var funn = fun; var t = Object(this); var len = t.length >>> 0;
            if (typeof fun !== "function") { funn = function (i, e) { var k = Object.keys(fun); var isok = 0; k.forEach(function (ee, ii) { if (funn[ee] == e[ee]) { isok += 1; } }); return isok == k.length; }; }
            var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
            for (var i = 0; i < len; i++) { if (i in t) { var val = t[i]; if (funn.call(thisArg, val, i, t)) { return val; } } }
            return null;
        };
    }
    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function (callback, thisArg) {
            var T, k;
            if (this == null) { throw new TypeError(" this is null or not defined"); }
            var O = Object(this); var len = O.length >>> 0;
            if (typeof callback !== "function") { throw new TypeError(callback + " is not a function"); }
            if (arguments.length > 1) { T = thisArg; }
            k = 0;
            while (k < len) { var kValue; if (k in O) { kValue = O[k]; callback.call(T, kValue, k, O); } k++; }
        };
    }
    Array.prototype.remove = function () {
        var what, a = arguments, L = a.length, ax;
        while (L && this.length) { what = a[--L]; while ((ax = this.indexOf(what)) !== -1) { this.splice(ax, 1); } }
        return this;
    };
}

// --- إضافات jQuery الخاصة بالقوائم المنبثقة (Popovers) ---
(function ($) {
    $.fn.popTitle = function (html) {
        var popclose = this.parent().parent().find(".phide").detach();
        this.parent().parent().find(".pophead").html(html).prepend(popclose);
        return this;
    };
    $.fn.pop = function (options) {
        if (this.hasClass("pop")) { return this.find(".popbody").children(0).pop(options); }
        switch (options) {
            case "show":
                if (this.parent().hasClass("popbody") == false) { this.pop(); }
                $(".pop").css("z-index", 2000); this.parent().parent().css("z-index", 2001); this.parent().parent().css("display", "");
                fixSize(); return this; break;
            case "hide": this.parent().parent().css("display", "none"); return this; break;
            case "remove": this.parent().parent().remove(); return this; break;
        }
        var settings = $.extend({ width: "50%", height: "50%", top: "5px", left: "5px", title: "", close: "hide", bg: $(document.body).css("background-color") }, options);
        var popup = $('<div class="pop corner" style="border:1px solid lightgrey;display:none;max-width:95%;position:absolute;z-index:2000;top:' + settings.top + ";left:" + settings.left + '"></div>').css({ "background-color": settings.bg, width: settings.width, height: settings.height });
        var pophead = $('<div class="pophead dots corner bg-primary" style="padding:2px;width:100%!important;"></div>').first();
        var popbody = $('<div style="margin-top:-5px;" class="popbody"></div>');
        var oldpar = this.parent();
        popbody.append(this); pophead.html(settings.title);
        pophead.prepend("<span onclick=\"$(this).pop('" + settings.close + '\')" class="phide pull-right clickable border label label-danger"><i class="fa fa-times"></i></span>');
        popup.on("resize", function () { popbody.css("height", popup.height() - pophead.outerHeight(true) + "px"); });
        popup.append(pophead); popup.append(popbody);
        if (oldpar.length == 0) { $("#content").append(popup); } else { oldpar.append(popup); }
        return this;
    };
})(jQuery);

// --- دوال التعامل مع CSS ---
function getCSSRule(ruleName, deleteFlag) {
    ruleName = ruleName.toLowerCase();
    if (document.styleSheets) {
        for (var i = 0; i < document.styleSheets.length; i++) {
            var styleSheet = document.styleSheets[i]; var ii = 0; var cssRule = false;
            do {
                if (styleSheet.cssRules) { cssRule = styleSheet.cssRules[ii]; } else { cssRule = styleSheet.rules[ii]; }
                if (cssRule) {
                    if (cssRule.selectorText == ruleName) {
                        if (deleteFlag == "delete") { if (styleSheet.cssRules) { styleSheet.deleteRule(ii); } else { styleSheet.removeRule(ii); } return true; } else { return cssRule; }
                    }
                }
                ii++;
            } while (cssRule);
        }
    }
    return false;
}
function killCSSRule(ruleName) { return getCSSRule(ruleName, "delete"); }
function addCSSRule(ruleName) {
    if (document.styleSheets) {
        if (!getCSSRule(ruleName)) { if (document.styleSheets[0].addRule) { document.styleSheets[0].addRule(ruleName, null, 0); } else { document.styleSheets[0].insertRule(ruleName + " { }", 0); } }
    }
    return getCSSRule(ruleName);
}

// --- دالة المايك المرئي ---
function onvnot(vnot, id) {
    $(vnot).on("touchstart mousedown", function (e) { hl($(vnot), "danger"); record(function (blob) { onrec(blob, id); }, $(vnot)); });
    $(vnot).on("touchend mouseup", function (e) { hl($(vnot), "primary"); recordStop(); });
}
