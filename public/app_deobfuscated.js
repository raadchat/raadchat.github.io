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
