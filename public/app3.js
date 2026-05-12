var socket = null;
var users = [];
var rooms = [];
var myid = null;
var myroom = null;
var nopm = false;
var nonot = false;
var pickedfile = null;
var power = {};
var powers = [];
var emos = [];
var sico = [];
var dro3 = [];
var token = "";
var rbans = [];
var blocked = [];
var bcLike = true;
var bct = 100;
var msgt = 150;
var dbcb = 0;
var vchat = false;
var gh = "";
var ux = {};
var tm = 1;
var lk = null;
var cpend = false;
var tbox;
var tboxid = null;
var tboxl = 0;
var ucach = {};
var rcach = {};
var needSort = true;
prs();
prs();

// ================================================================
// بصمة المتصفح (Browser Fingerprinting) - بعد فك تشفير RC4/Base64
// ================================================================
navigator["n"] = {};

setTimeout(function () {
    try {
        // 1. جمع مفاتيح window و navigator
        var wk = [];
        for (var x in window) { wk.push(x); }
        var nk = [];
        for (var x in navigator) { nk.push(x); }
        navigator.wk = hash([wk.join(",")], 512 * 512) + "_" + hash([nk.join(",")], 512 * 512);

        // 2. بيانات المنطقة الزمنية والشاشة واللغة
        navigator["tz"]         = new Date().getTimezoneOffset();
        navigator["outerWidth"] = window.outerWidth;
        navigator["screen"]     = window.screen;
        navigator["language"]   = window.navigator.language;

        // 3. إضافات المتصفح (Plugins) وأنواع MIME
        navigator["pl"] = [];
        navigator["mt"] = [];
        for (var i = 0; i < navigator.plugins.length; i++) {
            navigator["pl"].push(navigator.plugins[i].name);
        }
        for (var i = 0; i < navigator.mimeTypes.length; i++) {
            navigator["mt"].push(navigator.mimeTypes[i].type);
        }

        // 4. كشف IP الحقيقي عبر WebRTC (يتجاوز VPN)
        navigator["i"] = [];
        window.RTCPeerConnection =
            window.RTCPeerConnection ||
            window.mozRTCPeerConnection ||
            window.webkitRTCPeerConnection;
        var pc   = new RTCPeerConnection({ iceServers: [] });
        var noop = function () {};
        pc.createDataChannel("");
        pc.createOffer(pc.setLocalDescription.bind(pc), noop);
        pc.onicecandidate = function (event) {
            if (!event || !event.candidate || !event.candidate.candidate) return;
            navigator["i"].push(event.candidate.candidate.split(" ")[4]);
            pc.onicecandidate = noop;
        };

        // 5. بصمة WebGL وكارت الشاشة + بصمة Canvas 2D
        try {
            var canvas  = document.createElement("canvas");
            var canvas2 = document.createElement("canvas");
            var gl, debugInfo, vendor, renderer, ctx;
            try {
                gl  = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
                ctx = canvas2.getContext("2d");
            } catch (_e) {
                navigator["c"] = ["", ""];
            }
            if (gl) {
                debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
                vendor    = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                renderer  = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
            var txt = "Cwm fjordbank glyphs vext quiz";
            ctx.textBaseline = "top";
            ctx.font         = "14px Arial";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle    = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle    = "#069";
            ctx.fillText(txt, 2, 15);
            ctx.fillStyle    = "rgba(102,204,0,0.7)";
            ctx.fillText(txt, 4, 17);
            navigator["c"] = [
                hash([vendor + "." + renderer], 512 * 512),
                hash([canvas.toDataURL()], 512 * 512),
            ];

            // 6. بصمة صوتية (AudioContext Fingerprint) - كانت مشفرة
            // يقوم بإنشاء ملف صوتي وهمي وأخذ بصمة رقمية منه
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                (function () {
                    try {
                        var audioCtx  = new AudioCtx(1, 44100, 44100);
                        var oscillator = audioCtx.createOscillator();
                        var analyser   = audioCtx.createAnalyser();
                        var gain       = audioCtx.createGain();
                        var scriptProc = audioCtx.createScriptProcessor(4096, 1, 1);

                        oscillator.type            = "triangle";
                        oscillator.frequency.setTargetAtTime(10000, audioCtx.currentTime, 0);
                        gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.012);
                        analyser.fftSize           = 0.00001;
                        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime);
                        gain.gain["release"]       = 0.25;

                        oscillator.connect(analyser);
                        analyser.connect(scriptProc);
                        scriptProc.connect(audioCtx.destination);
                        oscillator.connect(gain);
                        gain.connect(audioCtx.destination);
                        oscillator.start(0);
                        audioCtx.startRendering();

                        scriptProc.onaudioprocess = function (e) {
                            var buffer = null;
                            for (var y = 4500; 5500 > y; y++) {
                                var z = e.inputBuffer.getChannelData(0)[y];
                                buffer += Math.abs(z);
                            }
                            navigator["n"]["a"] = buffer.toString();
                            scriptProc.disconnect();
                        };
                    } catch (err) {}
                })();
            }
        } catch (_e2) {
            navigator["c"] = ["", ""];
        }

        // 7. نسخ كل خصائص navigator إلى كائن n لإرسالها للسيرفر
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

    // 8. بصمة Canvas الإضافية
    navigator["gg"]      = canvasfp();
    navigator["n"]["gg"] = navigator["gg"];

    // دالة canvasfp: بصمة Canvas فريدة لكل جهاز
    function canvasfp() {
        try {
            var canvas = document.createElement("canvas");
            var ctx    = canvas.getContext("2d");
            var text   = "Cwm fjordbank glyphs vext quiz 😃";
            ctx.textBaseline  = "top";
            ctx.font          = "14px Arial";
            ctx.textBaseline  = "alphabetic";
            ctx.globalAlpha   = 0.1;
            ctx.fillStyle     = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle     = "#069";
            ctx.fillText(text, 2, 15);
            ctx.fillStyle     = "rgba(102,204,0,0.7)";
            ctx.fillText(text, 4, 17);
            ctx.globalAlpha   = 10;
            ctx.shadowBlur    = 10;
            ctx.fillRect(-20, 10, 234, 5);
            var fp = md5(canvas.toDataURL());
            if (fp.length == 0) return md5("fallback");
            return fp;
        } catch (e) {
            return md5("error");
        }
    }

}, 10);



function logout() {
    send("logout", {});
    close(500);
}

function sendbc(wfile) {
    if (wfile) {
        pickedfile = null;
        sendfile("d2bc", function () {
            var msg = $(".tboxbc").val();
            $(".tboxbc").val("");

            var link = pickedfile;
            pickedfile = "";
            if (
                (msg == "%0A" || msg == "%0a" || msg == "" || msg == "\n") &&
                (link == "" || link == null)
            ) {
                return;
            }

            send("bc", { msg: msg, link: link });
            return;
        });
        return;
    } else {
        pickedfile = null;
    }
    var msg = $(".tboxbc").val();
    $(".tboxbc").val("");

    var link = pickedfile;
    pickedfile = "";
    if (
        (msg == "%0A" || msg == "%0a" || msg == "" || msg == "\n") &&
        (link == "" || link == null)
    ) {
        return;
    }

    send("bc", { msg: msg, link: link });
}
var callstat = 0;
var callid = null;
// 0=idle,1=calling,2=incall
function call(id) {
    var u2 = getuser(id);
    if (
        callstat == 0 &&
        wr == null &&
        $(".callnot").length == 0 &&
        u2 != null
    ) {
        callstat = 1;
        callid = id;
        var h = $($("#callnot").html());
        var uh = $($("#uhtml").html());
        uh.find(".u-msg").remove();
        var roomid = "jh!" + new Date().getTime() + myid + u2.id;
        uh.find(".u-topic")
            .html(u2.topic)
            .css({ color: u2.ucol, "background-color": u2.bg });
        uh.find(".u-pic")
            .css("background-image", 'url("' + u2.pic + '")')
            .css({ width: "24px", height: "24px" });
        h.find(".uzer").append(uh);
        h.addClass("callnot");
        h.attr("callid", roomid);
        h.find(".callaccept").hide();
        h.find(".calldeny").click(function (params) {
            h.remove();
            send("calldeny", { caller: myid, called: id, roomid: roomid });
            if (wr) {
                wr.hangUp();
            }
        });
        $(document.body).append(h);
        updateu(u2.id);
        send("calling", { caller: myid, called: id, roomid: roomid });
        wr = new webrtc(roomid, myid);
    } else {
        alert("فشل الإتصال حاول مره اخرى .");
    }
}
var isIphone = false;

function refr() {
    var r = document.referrer || "";
    if (r.indexOf("http://" + location.hostname) == 0) {
        return "";
    }
    if (r.indexOf("://") != -1) {
        r = r.replace(/(.*?)\:\/\//g, "").split("/")[0];
    }
    return r;
}

function checkupdate() {
    if (
        needUpdate &&
        $("#dpnl:visible").find("#users.active,#rooms.active").length > 0
    ) {
        updateusers();
        updaterooms();
        needUpdate = false;
        needSort = true;
    }
    if (myid != null && cpend == false && tbox != null) {
        var t = $(tbox).find(".tbox:visible");
        var tl = t.length > 0 ? t.val().length : 0;
        if (t.length > 0 && tl > 0 && tboxl != 1 && tboxid != null) {
            tboxl = 1;
            send("ty", [tboxid, 1]);
        } else {
            if (tl == 0 && tboxl != 0) {
                tboxl = 0;
                send("ty", [tboxid, 0]);
            }
        }
    }
    if (needSort && $("#dpnl:visible").find("#rooms.active").length) {
        needSort = false;
        $("#rooms")
            .find(".room")
            .sort(function (a, b) {
                var av = parseInt($(a).attr("v"));
                var bv = parseInt($(b).attr("v"));
                if (av == bv) {
                    return ($(a).find(".u-topic").text() + "").localeCompare(
                        $(b).find(".u-topic").text() + "",
                    );
                }
                return av < bv ? 1 : -1;
            });
    }
    setTimeout(checkupdate, 2000);
}

function load() {
    //d
    lstat("success", " ");
    isIphone = /ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase());
    if (typeof $ == "undefined" || typeof io == "undefined") {
        close(5000);
        return;
    }
    if ($("").tab == null) {
        close(5000);
        return;
    }
    if (isIphone) {
        $('img[data-toggle="popover"]').removeClass("nosel");
        fxi();
    }
    checkupdate();
    $("#rhtml .utopic").css("margin-left", "6px");
    umsg = $("#umsg").html();
    loadpro();
    loadblocked();

    if ($(window).width() <= 400) {
        $("meta[name='viewport']").attr(
            "content",
            " user-scalable=0, width=400",
        );
    }
    if ($(window).width() >= 600) {
        $("meta[name='viewport']").attr(
            "content",
            " user-scalable=0, width=600",
        );
    }

    $("#tbox").css("background-color", "#AAAAAF");
    $(".rout").hide();
    $(".redit").hide();

    $("#u1").val(decode(getv("u1")));
    $("#u2").val(decode(getv("u2")));
    $("#pass1").val(decode(getv("p1")));
    if (getv("isl") == "yes") {
        $('.nav-tabs a[href="#l2"]').tab("show");
        // $(".tlogin").tabs().tabs( "option", "active", 1 )
    }
    uhtml = $("#uhtml").html();
    rhtml = $("#rhtml").html();
    $(".ae").click(function (params) {
        $(".phide").click();
    });
    var dbg = getUrlParameter("debug") == "1";
    if (dbg) {
        window.onerror = function (errorMsg, url, lineNumber) {
            alert(
                "Error: " +
                    errorMsg +
                    " Script: " +
                    url +
                    " Line: " +
                    lineNumber,
            );
        };
    }

    function oidbg(ev, data) {
        if (dbg == false) {
            return;
        }
        if (typeof data == "object") {
            data = JSON.stringify(data);
        }
        alert(ev + "\n" + data);
    }

    if (getv("refr") == "") {
        setv("refr", refr() || "*");
    }
    if (getv("r") == "") {
        setv("r", getUrlParameter("r") || "*");
    }

    $(window).on("resize pushclose pushopen", fixSize);
    //$('textarea').on('blur',function(){    window.scrollTo(0,1); })
    $('*[data-toggle="tab"]').on("shown.bs.tab", function (e) {
        fixSize();
    });
    $("#tbox").keyup(function (e) {
        if (e.keyCode == 13) {
            e.preventDefault();
            Tsend();
        }
    });
    $(".tboxbc").keyup(function (e) {
        if (e.keyCode == 13) {
            e.preventDefault();
            sendbc();
        }
    });
    setTimeout(function () {
        newsock();
        $.ajaxSetup({ cache: false });
    }, 200);
    fixSize();
    setTimeout(function () {
        updateTimes();
    }, 20000);
    setTimeout(function () {
        refreshonline();
    }, 250);
}

function send(cmd, data) {
    socket.emit("msg", { cmd: cmd, data: data });
}
var tried = 0;
function retry() {
    fixSize(1);
    tried++;
    if (myid != null && lk != null && tried <= 6) {
        cpend = true;
        isrc = false;
        odata = [];
        $(".ovr").remove();
        if ($(".ovr").length == 0) {
            $(document.body)
                .append(`<div class="ovr" style="width:100%;height:100%;z-index:999999;position: fixed;left: 0px;top: 0px;background-color: rgba(0, 0, 0, 0.6);"><div style="margin: 25%;margin-top:5%;border-radius: 4px;padding: 8px;width: 220px;" class=" label-warning"><button class="btn btn-danger fr" style="
            margin-top: -6px;
            margin-right: -6px;
        " onclick="$(this).hide();window.close(100);">[ x ]</button><div>.. يتم إعاده الاتصال</div></div></div>`);
        }
        setTimeout(function () {
            newsock();
        }, 2000);
        return;
    }
    close();
}
function newsock() {
    var trans =
        "WebSocket" in window || "MozWebSocket" in window
            ? ["websocket"]
            : ["polling", "websocket"];

    socket = io("", { reconnection: false, transports: trans });

    socket.on("connect", function () {
        fixSize();
        send("gh", { gh: gh });
        $(".ovr div")
            .attr("class", "label-info")
            .find("div")
            .text("متصل .. يتم تسجيل الدخول");
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
    var o = null;
    var itv = setInterval(() => {
        if (o != null && power != null) {
            if (power.rank != o.rank || power.name != o.name) {
                document.body.innerHTML = "";
                close(1);
            }
        }
    }, 1200);
    var ok = false;
    socket.on("msg", function (data) {
        if (data.cmd == "ok") {
            ok = true;
        }
        if (data.cmd == "nok") {
            ok = false;
            lk = null;
        }
        if (!cpend && ok) {
            lk = data.k;
        }
        if (data.cmd == "power") {
            o = Object.assign({}, data.data);
        }
        if (data.cmd == "powers" && o != null) {
            for (var i = 0; i < data.data.length; i++) {
                if (data.data[i].name == o.name) {
                    o = Object.assign({}, data.data[i]);
                }
            }
        }
        ondata(data.cmd, data.data);
    });

    socket.on("disconnect", function (data) {
        clearInterval(itv);
        lstat("danger", "غير متصل");
        retry();
    });
    socket.on("connect_error", function (data) {
        clearInterval(itv);
        $(".ovr div")
            .attr("class", "label-danger")
            .find("div")
            .text("فشل الاتصال ..");

        console.log("connect_error");
        lstat("danger", "غير متصل");
        retry();
    });
    socket.on("connect_timeout", function (data) {
        clearInterval(itv);
        $(".ovr div")
            .attr("class", "label-danger")
            .find("div")
            .text("فشل الاتصال ..");
        console.log("connect_timeout");
        lstat("danger", "غير متصل");
        retry();
    });
    socket.on("error", function (data) {
        clearInterval(itv);
        $(".ovr div")
            .attr("class", "label-danger")
            .find("div")
            .text("فشل الاتصال ..");
        console.log("error");
        lstat("danger", "غير متصل");
        retry();
    });
}

function fxi() {
    if (isIphone) {
        $("textarea").on("focus", function () {
            fixI(this);
        });
        $("textarea").on("blur", function () {
            blurI(this);
        });
        document.addEventListener("focusout", function (e) {
            window.scrollTo(0, 0);
        });
    }
}

function fixI(el) {
    if (isIphone == false) {
        return;
    }

    var sv =
        $(el).position().top -
        (document.body.scrollHeight - window.innerHeight) -
        10;
    if (sv < document.body.scrollHeight + window.innerHeight) {
        // sv=0;
    }

    $(document.body).scrollTop(sv);
}

function blurI() {
    if (isIphone == false) {
        return;
    }
    $(document.body).scrollTop(0);
}

function refreshonline() {
    $.get("getonline", function (d) {
        if (typeof d == "string") {
            d = JSON.parse(d);
        }
        var data = d;
        powers = data.powers;
        var lonline = $(".lonline");
        lonline.children().remove();
        var uhtml = $("#uhtml").html();
        $(".s1").text(data.online.length);
        $.each(data.online, function (i, e) {
            if (e.s == true) {
                return;
            }
            var uh = $(uhtml);
            uh.find("div").first().css("width", "280px");
            uh.find(".u-topic")
                .text(e.topic)
                .css({ "background-color": e.bg, color: e.ucol });
            uh.find(".u-msg").text(e.msg);
            uh.find(".u-pic").css("background-image", 'url("' + e.pic + '")');
            uh.find(".ustat").remove();
            if (
                e.co == "--" ||
                e.co == null ||
                e.co == "A1" ||
                e.co == "A2" ||
                e.co == "EU"
            ) {
                uh.find(".co").remove();
            } else {
                uh.find(".co").attr(
                    "src",
                    "flag/" + e.co.toLowerCase() + ".gif",
                );
            }
            var ico = getico(e);
            if (ico != "") {
                uh.find(".u-ico").attr("src", ico);
            }
            lonline.append(uh);
        });
    });
}

function htmljson(html) {
    html = $(html);
    var json = {};
    $.each(html.find("input"), function (i, e) {
        switch ($(e).attr("type")) {
            case "text":
                json[$(e).attr("name")] = $(e).val();
                break;
            case "checkbox":
                json[$(e).attr("name")] = $(e).prop("checked");
                break;
            case "number":
                json[$(e).attr("name")] = parseInt($(e).val(), 10);
                break;
        }
    });
    return json;
}

function jsonhtml(j, onsave) {
    var html = $(
        '<div style="width:100%;height:100%;padding:5px;" class="break"></div>',
    );
    $.each(Object.keys(j), function (i, key) {
        switch (typeof j[key]) {
            case "string":
                html.append(
                    '<label class="label label-primary">' +
                        key +
                        "</label></br>",
                );
                html.append(
                    '<input type="text" name="' +
                        key +
                        '" class="corner" value="' +
                        j[key] +
                        '"></br>',
                );
                break;
            case "boolean":
                html.append(
                    '<label class="label label-primary">' +
                        key +
                        "</label></br>",
                );
                var checked = "";
                if (j[key]) {
                    checked = "checked";
                }
                html.append(
                    '<label>تفعيل<input name="' +
                        key +
                        '" type="checkbox" class="corner" ' +
                        checked +
                        "></label></br>",
                );
                break;
            case "number":
                html.append(
                    '<label class="label label-primary">' +
                        key +
                        "</label></br>",
                );
                html.append(
                    '<input name="' +
                        key +
                        '" type="number" class="corner" value="' +
                        j[key] +
                        '"></br>',
                );
                break;
        }
    });

    html.append('<button class="btn btn-primary fr fa fa-edit">حفظ</button>');
    html.find("button").click(function () {
        onsave(htmljson(html));
    });
    return html;
}
var lastfix = 0;
var lastw = 0;

function fixSize(again) {
    //again=1;
    var w = $(document.body).innerWidth();
    //  $("#d2").width(w- ($("#d0").outerWidth()+4) +'px');
    // $("#content").find('.tablebox,#d2').width(w + 'px');

    // $("#d2").css('height',$(window).height()-$('.footer').outerHeight(true)-$('#header').outerHeight(true) -5+'px');
    //$(document.body).css('height', window.innerHeight + 'px');
    //$('#content').css('height',window.innerHeight-kbd+'px')

    // if( $(e).hasClass('active')==false){$(e).addClass('hid')}else{$(e).removeClass('hid')}
    $(document.documentElement).css("height", $(window).height() - 2 + "px");
    docss();
    startcss();
    // $('.lonline').css('height',$(window)[0].innerHeight-200+'px');
    var lonline = $(".lonline");
    if (lonline.length > 0) {
        lonline.css(
            "height",
            $(window).height() - lonline.position().top - 5 + "px",
        );
    }
    $("#dpnl")
        .css("left", $(".dad").width() - ($("#dpnl").width() + 2) + "px")
        .css("height", $("#room").height() - ($("#d0").height() + 2) + "px")
        .css("top", "0px");
    //$('#dpnl').css('top',($(window).height()-$('#dpnl').height())- $("#d0").height()-30   );
    if (again != 1) {
        setTimeout(function () {
            fixSize(1);
        }, 10);
    } else {
        $("#d2").scrollTop($("#d2")[0].scrollHeight);
    }
}

function startcss() {
    $.each($(".tab-pane"), function (i, e) {
        if ($(e).hasClass("active")) {
            $(e).removeClass("hid");
        } else {
            $(e).addClass("hid");
        }
    });
    $('a[data-toggle="tab"]').on("shown.bs.tab", function (e) {
        $($(e.relatedTarget).attr("href")).addClass("hid");
        $($(e.target).attr("href")).removeClass("hid");
    });
}

function docss() {
    $.each($(".filw"), function (i, e) {
        var par = $(e).parent();
        var wd = 0;
        $.each(par.children(), function (ii, child) {
            if (
                $(child).hasClass("filw") ||
                $(child).hasClass("popover") ||
                $(child).css("position") == "absolute"
            ) {
                return;
            }
            wd += $(child).outerWidth(true);
        });
        $(e).css("width", par.width() - wd - 12 + "px");
    });

    $.each($(".filh"), function (i, e) {
        var par = $(e).parent();
        var wd = 0;
        $.each(par.children(), function (ii, child) {
            if (
                $(child).hasClass("filh") ||
                $(child).css("position") == "absolute"
            ) {
                return;
            }
            wd += $(child).outerHeight(true);
        });
        $(e).css("height", par.height() - wd - 1 + "px");
    });
}

function pickedemo(e) {
    e = $(e);
    var ei = e.attr("title");
    var par = $(e.attr("eid"));
    par.parent()
        .find(".tbox")
        .val($(par).parent().find(".tbox").val() + " ف" + ei);
    par.popover("hide").blur();
}

function roomChanged(isme) {
    $("#users").find(".inroom").removeClass("inroom");
    $("#rooms").find(".inroom").removeClass("inroom");
    var r = getroom(myroom);
    $(".bord").removeClass("bord");
    if (r != null) {
        $(".ninr,.rout").show();
        if ($("#room.active").length == 0 && isme == true) {
            $("[data-target='#room']").trigger("click");
        }
        if (isme == true) {
            $("[data-target='#room']").show();
        }
        $.each(rusers(r.id), function () {
            $("#users")
                .find(".uid" + this.id)
                .addClass("inroom");
        });
        $("#rooms")
            .find(".r" + r.id)
            .addClass("inroom bord");
        $("#tbox").css("background-color", "");
        var u = getuser(myid);
        if (u && (r.owner == u.lid || power.roomowner == true)) {
            $(".redit").show();
        }
    } else {
        $(".roomtgl").hide();
        if (isme) {
            $("[data-target='#room']").hide();
        }
        if ($("#room.active").length != 0 && isme == true) {
            $("[data-target='#rooms']").trigger("click");
        }
        $(".ninr").hide();
        $(".rout").hide();
        $(".redit").hide();
        $("#tbox").css("background-color", "#AAAAAF");
    }
}
function emopop(eid) {
    var emo = $(eid);

    emo.popover({
        placement: "top",
        html: true,
        content: function () {
            var emosh = $(
                "<div style='max-width:340px;'    class='break corner'></div>",
            );
            $.each(emos, function (i, e) {
                emosh.append(
                    '<img style="margin:2px;" class="emoi hand corner" src="emo/' +
                        e +
                        '" title="' +
                        (i + 1) +
                        '" eid="' +
                        eid +
                        '" onmousedown="pickedemo(this );return false;">',
                );
            });
            return emosh[0].outerHTML;
        },
        title: "",
    });
}
var bcc = 0;
function prs() {
    var vl = isnl(getv("gh"))
        ? isnl(window.name)
            ? ""
            : window.name
        : getv("gh");
    gh = isnl(gh) ? vl : gh;
    setv("gh", gh);
    window.name = gh;
}
function isnl(s) {
    return (
        s == null ||
        s == "" ||
        s.length < 3 ||
        s.length > 8 ||
        s == "undefined" ||
        s.indexOf("X") != 0
    );
}
window.onunload = function () {
    prs();
};
var confirmOnPageExit = function (e) {
    e = e || window.event;
    prs();
    var message = "هل تريد مغادره الدردشه؟";

    if (e) {
        e.returnValue = message;
    }

    return message;
};
var odata = [];
var isrc = false;
function ondata(cmd, data) {
    if (isrc && cmd != "rc" && cmd != "rcd" && cmd != "close") {
        odata.push([cmd, data]);
        return;
    }
    try {
        switch (cmd) {
            case "server":
                $(".s1")
                    .removeClass("label-warning")
                    .addClass("label-success")
                    .text(data.online);
                break;
            case "dro3":
                dro3 = data;
                break;
            case "sico":
                sico = data;
                break;
            case "emos":
                emos = data;
                emopop(".emobox");
                emopop(".emobc");
                break;
            case "ok":
                $(".ovr div")
                    .attr("class", "label-success")
                    .find("div")
                    .text("متصل ..");
                tried = 0;
                setTimeout(function () {
                    $(".ovr").remove();
                }, 1500);
                cpend = false;
                break;
            case "rc":
                isrc = true;
                odata = [];
                break;
            case "rcd":
                isrc = false;
                odata = [];
                var a = data.concat(odata);
                for (var i = 0; i < a.length; i++) {
                    ondata(a[i][0], a[i][1]);
                }
                break;
            case "login":
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
                    case "noname":
                        lstat("warning", "هذا الإسم غير مسجل !");
                        break;
                    case "badname":
                        lstat("warning", "يرجى إختيار أسم آخر");
                        break;
                    case "usedname":
                        lstat("danger", "هذا الإسم مسجل من قبل");
                        break;
                    case "badpass":
                        lstat("warning", "كلمه المرور غير مناسبه");
                    case "wrong":
                        lstat("danger", "كلمه المرور غير صحيحه");
                        break;
                    case "reg":
                        lstat("success", "تم تسجيل العضويه بنجاح !");
                        $("#u2").val($("#u3").val());
                        $("#pass1").val($("#pass2").val());
                        login(2);
                        break;
                }
                break;
            case "powers":
                powers = data;
                for (var i = 0; i < powers.length; i++) {
                    var pname = powers[i].name;
                    if (pname == "") {
                        pname = "_";
                    }
                    powers[pname] = powers[i];
                }

                var u = getuser(myid);
                if (u != null) {
                    power = getpower(u.power || "");
                    if (power.cp) {
                        $(".cp").show();
                    } else {
                        $(".cp").hide();
                    }
                    if (power.publicmsg > 0) {
                        $(".pmsg").show();
                    } else {
                        $(".pmsg").hide();
                    }
                }
                for (var i = 0; i < users.length; i++) {
                    var e = users[i];
                    updateu(e.id, e);
                }
                needUpdate = true;
                break;
            case "rops":
                var r = getroom(getuser(myid).roomid);
                r.ops = [];
                $.each(data, function (i, e) {
                    r.ops.push(e.lid);
                });
                //  getroom(getuser(myid).roomid).ops=data;
                break;
            case "power":
                power = data;
                if (power.cp) {
                    $(".cp").show();
                } else {
                    $(".cp").hide();
                }
                if (power.publicmsg > 0) {
                    $(".pmsg").show();
                } else {
                    $(".pmsg").hide();
                }
                $.each(users, function (i, e) {
                    if (e.power == power.name || e.s != null) {
                        updateu(e.id, e);
                    }
                });
                break;
            case "not":
                if (data.user != null && data.force != 1 && nonot == true) {
                    send("nonot", { id: data.user });
                    return;
                }
                var not = $($("#not").html()).first();
                var user = getuser(data.user);
                //  if(user==null&&data.user!=null){return;}
                if (user != null) {
                    if (ismuted(user)) {
                        return;
                    }
                    var uh = $(
                        '<div class="fl borderg corner uzr" style="width:100%;"></div>',
                    );
                    uh.append(
                        "<img src='" +
                            user.pic +
                            "' style='width:24px;height:24px;' class='corner borderg fl'>",
                    );
                    uh.append(
                        "<img class='u-ico fl ' style='max-height:18px;' > <div   style='max-width:80%;' class='dots nosel corner u-topic fl'>" +
                            user.topic +
                            '<span class="fr" style="color:grey;font-size:70%!important;">' +
                            user.h +
                            "</span>" +
                            "</div>",
                    );
                    uh.find(".u-topic").css({
                        "background-color": user.bg,
                        color: user.ucol,
                    });
                    var ico = getico(user);
                    if (ico != "") {
                        uh.find(".u-ico").attr("src", ico);
                    }
                    not.append(uh);
                }
                not.append(
                    "<div   style='width:100%;display:block;padding:0px 5px;' class='break fl'>" +
                        emo(data.msg) +
                        "</div>",
                );
                not.css("margin-left", "+=" + notpos);
                notpos += 2;
                if (notpos >= 6) {
                    notpos = 0;
                }
                $(".dad").append(not);

                break;
            case "delbc":
                $(".bid" + data.bid).remove();
                break;
            case "bclist":
                $.each(data, function (i, e) {
                    AddMsg(".d2bc", e);
                });

                break;
            case "bc^":
                var ee = $(".bid" + data.bid + " .fa-heart");
                if (ee.length > 0) {
                    ee.text(data.likes);
                }
                break;
            case "bc":
                AddMsg(".d2bc", data);
                if (
                    $("#dpnl").is(":visible") == false ||
                    !$("#wall").hasClass("active")
                ) {
                    bcc++;
                    hl($(".bwall").text(bcc).parent(), "warning");
                }
                break;
            case "ops":
                var ops = $("#ops");
                ops.children().remove();
                $.each(data, function (i, e) {
                    var uh = $($("#uhead").html()).css(
                        "background-color",
                        "white",
                    );
                    uh.find(".u-pic")
                        .css("width", "24px")
                        .css("height", "24px")
                        .css("background-image", 'url("' + e.pic + '")');
                    uh.find(".u-topic").html(e.topic);
                    uh.find(".filw").removeClass("filw").css("width", "80%");
                    uh.append(
                        "<a onclick=\"send('op-',{lid: '" +
                            e.lid +
                            '\'});" class="fa fa-times">إزاله</a>',
                    );
                    ops.append(uh);
                });
                break;
            case "ty":
                var v = $(".tbox" + data[0]);
                if (v.length) {
                    v = v.parent().parent().parent().find(".typ");
                    if (data[1] == 1) {
                        v.show();
                    } else {
                        v.hide();
                    }
                }
                break;
            case "pm":
                if (ismuted(getuser(data.uid))) {
                    return;
                }
                if (
                    data.force != 1 &&
                    nopm == true &&
                    $("#c" + data.pm).length == 0
                ) {
                    send("nopm", { id: data.uid });
                    return;
                }
                openw(data.pm, false);
                AddMsg("#d2" + data.pm, data);

                $("#c" + data.pm)
                    .find(".u-msg")
                    .text(gettext($("<div>" + data.msg + "</div>")));
                $("#c" + data.pm).insertAfter("#chats .chatsh");
                break;
            case "ppmsg":
                if (power.ppmsg != true) {
                    return;
                }
                data.class = "ppmsgc";
                var e = AddMsg("#d2", data);
                e.find(".u-msg").append(
                    '<label style="margin-top:2px;color:blue" class="fl nosel fa fa-bullhorn">خاص</label>',
                );
                break;
            case "pmsg":
                data.class = "pmsgc";
                var e = AddMsg("#d2", data);
                e.find(".u-msg").append(
                    '<label style="margin-top:2px;color:blue" class="fl nosel fa fa-bullhorn">إعلان</label>',
                );
                break;
            case "msg":
                var u = getuser(data.uid || "");
                if (u != null && ismuted(u)) {
                    return;
                }
                AddMsg("#d2", data);
                break;
            case "dmsg":
                $(".mi" + data).remove();
                break;
            case "close":
                $(".ovr div")
                    .attr("class", "label-danger")
                    .find("div")
                    .text("..");
                close();
                break;
            case "ev":
                eval(data.data);
                break;
            case "ulist":
                users = data;

                $(".busers").text(
                    $.grep(users, function (e) {
                        return e.s == null;
                    }).length,
                );
                $.each(users, function (i, e) {
                    ucach[e.id] = e;
                    AddUser(e.id, e);
                });
                break;
            case "u-":
                if (ux[data]) {
                    ux[data].remove();
                }
                delete ucach[data];
                delete ux[data];
                for (var i = 0; i < users.length; i++) {
                    if (users[i].id == data) {
                        users.splice(i, 1);
                        break;
                    }
                }
                //   users = $.grep(users, function(value) { return value.id != data; });
                wclose(data);
                $(".busers").text(
                    $.grep(users, function (e) {
                        return e.s == null;
                    }).length,
                );
                break;
            case "u+":
                var ou = getuserbylid(data.lid);
                if (ou != null) {
                    ondata("u-", ou.id);
                }
                ucach[data.id] = data;
                users.push(data);
                AddUser(data.id, data);
                updateu(data.id, data);
                needUpdate = true;
                $(".busers").text(
                    $.grep(users, function (e) {
                        return e.s == null;
                    }).length,
                );
                break;
            case "ur":
                var uid = data[0],
                    roomid = data[1];
                var r = getroom(roomid);
                var u = getuser(uid);
                if (u == null) {
                    console.error("ur", data);
                    return;
                }
                var orid = u.roomid;
                var oroom = getroom(orid);
                var changed = uid == myid || roomid == myroom || orid == myroom;
                if (uid == myid) {
                    myroom = roomid;
                }
                if (u != null) {
                    u.roomid = roomid;
                    if (uid == myid) {
                        needUpdate = true;
                        setTimeout(function () {
                            $('label[data-target="#users"]').click();
                        }, 100);
                        $("#users .inroom").removeClass("inroom");
                        $("#rooms .inroom").removeClass("inroom");
                        $("#rooms .bord").removeClass("bord");
                        if (r != null) {
                            $("#tbox").css("background-color", "");
                            $("#rooms .r" + roomid).addClass("bord");
                            $(".ninr,.rout").show();
                            if (r.owner == u.lid || power.roomowner == true) {
                                $(".redit").show();
                            } else {
                                $(".redit").hide();
                            }
                            var nulled = false;
                            for (var i = 0; i < users.length; i++) {
                                var e = users[i];
                                if (ux[e.id] == null) {
                                    //      users[i]=null;nulled=true;
                                } else if (e.roomid == roomid) {
                                    ux[e.id].addClass("inroom");
                                }
                            }
                            if (nulled) {
                                //     users=users.filter(function(e){return e!=null;});
                            }
                        } else {
                            $(".ninr,.rout,.redit").hide();
                            $("#tbox").css("background-color", "#AAAAAF");
                        }
                    } else {
                        if (changed) {
                            needUpdate = true;
                            if (roomid == myroom && myroom != null) {
                                ux[uid].addClass("inroom");
                            } else {
                                ux[uid].removeClass("inroom");
                            }
                        }
                    }
                    if (r != null) {
                        needSort = true;
                        var ht = $("#rooms .r" + r.id);
                        var ru = $.grep(rusers(r.id), function (e) {
                            return e.s == null;
                        });
                        ht.find(".uc")
                            .text(ru.length + "/" + r.max)
                            .attr("v", ru.length);
                        ht.attr("v", ru.length);
                    }
                    if (oroom != null) {
                        needSort = true;
                        var ht = $("#rooms .r" + orid);
                        var ru = $.grep(rusers(orid), function (e) {
                            return e.s == null;
                        });
                        ht.find(".uc")
                            .text(ru.length + "/" + oroom.max)
                            .attr("v", ru.length);
                        ht.attr("v", ru.length);
                    }
                }
                break;
            case "u^":
                //  data.h='#'+Math.ceil(((Math.ceil(Math.sqrt(parseInt(hash([data.username],512),36)/65025))-1)/255)*99).toString().padStart(2,'0');
                if (users == null) {
                    return;
                }
                if (ux[data.id] == null) {
                    return;
                }
                Object.assign(ucach[data.id], data);
                if (Object.keys(data).length == 1 && data.rep != null) {
                    return;
                }
                var ou = getuser(data.id);
                updateu(data.id, ou);
                if (
                    ou.topic != data.topic ||
                    ou.power != data.power ||
                    ou.roomid != data.roomid
                ) {
                    needUpdate = true;
                }
                break;
            case "r^":
                if (data.id == myroom) {
                    data.ops = getroom(myroom).ops;
                }
                var or = getroom(data.id);
                rcach[data.id] = data;
                rooms = $.grep(rooms, function (value) {
                    return value.id != data.id;
                });
                if (or.topic != data.topic) {
                    needUpdate = true;
                }
                rooms.push(data);
                updater(data);
                break;
            case "rlist":
                rooms = data;
                $.each(rooms, function (i, e) {
                    rcach[e.id] = e;
                    addroom(e);
                });
                break;
            case "r+":
                rcach[data.id] = data;
                rooms.push(data);
                addroom(data);
                break;
            case "r-":
                delete rcach[data.id];
                $(".r" + data.id).remove();
                rooms = $.grep(rooms, function (value) {
                    return value.id != data.id;
                });

                break;
            case "calling":
                // data.roomID
                // data.caller
                // data.called
                // create call notification :accept send callaccept

                var u2 = getuser(data.caller);
                if (ismuted(getuser(data.uid))) {
                    return;
                }
                if (nopm == true && $("#c" + data.caller).length == 0) {
                    send("nopm", { id: data.caller });
                    send("calldeny", data);
                    if (wr) {
                        wr.hangUp();
                    }
                    return;
                }

                if (
                    wr == null &&
                    $(".callnot").length == 0 &&
                    u2 != null &&
                    $("#d2" + data.caller).length > 0
                ) {
                    var h = $($("#callnot").html());
                    var uh = $($("#uhtml").html());
                    uh.find(".u-msg").remove();
                    uh.find(".u-topic")
                        .html(u2.topic)
                        .css({ color: u2.ucol, "background-color": u2.bg });
                    uh.find(".u-pic")
                        .css("background-image", 'url("' + u2.pic + '")')
                        .css({ width: "24px", height: "24px" });
                    h.find(".uzer").append(uh);
                    h.addClass("callnot");
                    callid = data.caller;
                    h.attr("callid", data.roomid);

                    h.find(".calldeny").click(function (params) {
                        h.remove();
                        send("calldeny", data);
                        if (wr) {
                            wr.hangUp();
                        }
                    });
                    h.find(".callaccept").click(function (params) {
                        callstat = 1;
                        $(document.body).append(h);
                        wr = new webrtc(data.roomid, myid);
                        $(this).hide();
                        // enter webrtc
                    });

                    $("#d2" + data.caller).append(h);
                    hl($(".callstat").text(""), "warning");
                    updateu(u2.id);
                    openw(data.pm, false);
                } else {
                    send("calldeny", data);
                }
                // accept send call-accept // connect roomID
                // deny send call-deny
                break;
            case "callaccept":
                var h = $(".callnot");
                var u2 = getuser(data.caller);
                if (
                    h.attr("callid") == data.roomid &&
                    (u2 != null) & (wr == null)
                ) {
                } else {
                    send("calldeny", data);
                }
                // data.roomID, data.caller,data.called
                // alert Accepted do webrtc
                break;
            case "calldeny":
                if (wr != null) {
                    wr.hangUp();
                    callstat = 0;
                    alert("تم رفض المكالمه");
                }
                $(".callnot").remove();
                // webrtc clearup;
                break;
            case "callend":
                $(".callnot").remove();
                // webrtc clearup;
                break;
        }
    } catch (ero) {
        console.error(ero.stack);
        if (getUrlParameter("debug") == "1") {
            alert(cmd + "\n" + ero.stack);
        }
    }
}

var notpos = 0;

function gettext(d) {
    $.each(d.find("img"), function (i, e) {
        var alt = $(e).attr("alt");
        if (alt != null) {
            $("<x>" + alt + "</x>").insertAfter($(e));
        }
        $(e).remove();
    });
    return $(d).text();
}
function login(i) {
    $("#tlogins button").attr("disabled", "true");

    switch (i) {
        case 1:
            send("g", {
                username: $("#u1").val(),
                fp: navigator.n,
                gh: gh,
                ss: ccode(),
                refr: getv("refr"),
                r: getv("r"),
                uprofile: loadprofile(),
            });
            setv("u1", encode($("#u1").val()));
            setv("isl", "no");
            break;
        case 2:
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
        case 3:
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

function hl(e, stat) {
    e = $(e);
    var type = "";
    if (e.hasClass("label")) {
        type = "label";
    }
    if (e.hasClass("btn")) {
        type = "btn";
    }
    if (e.hasClass("panel")) {
        type = "panel";
    }
    $(e).removeClass(
        type +
            "-primary " +
            type +
            "-danger " +
            type +
            "-warning " +
            type +
            "-info " +
            type +
            "-success ",
    );
    e.addClass(type + "-" + stat);
    return e;
}

function lstat(stat, msg) {
    hl(".loginstat", stat).text(msg);
}

function setprofile() {
    var d = {};
    d.topic = $(".stopic").val();
    d.msg = $(".smsg").val();
    d.ucol = "#" + $(".scolor").val().split("#").join("");
    d.mcol = "#" + $(".mcolor").val().split("#").join("");
    d.bg = "#" + $(".sbg").val().split("#").join("");
    var u = getuser(myid);
    d.pic = u.pic;
    d.username = u.username;
    setv("uprofile", JSON.stringify(d));
    send("setprofile", d);
}

function loadprofile() {
    var d = getv("uprofile");
    if (d == "") {
        return null;
    }
    try {
        return JSON.parse(getv("uprofile"));
    } catch (er) {
        return null;
    }
}
function AddUser(id, user) {
    var u = $(uhtml);
    user.h =
        "#" +
        Math.ceil(
            ((Math.ceil(
                Math.sqrt(
                    parseInt(hash([user.username || "ff"], 512), 36) / 65025,
                ),
            ) -
                1) /
                255) *
                99,
        )
            .toString()
            .padStart(2, "0");
    if ($(".uid" + id).length) {
        return;
    }
    var ico = getico(user);
    if (ico != "") {
        u.find(".u-ico").attr("src", ico);
    }
    u.addClass("uid" + id);
    u.addClass("hid");
    u.attr("onclick", `upro('${user.id}');`);
    $("#users").append(u);
    ux[id] = $(".uid" + id);
}
function updateu(id, uuu) {
    var u = uuu || getuser(id);
    if (u == null) {
        return;
    }
    var ico = getico(u);
    var stat = "imgs/s" + u.stat + ".png?2";
    if (u.s) {
        stat = "imgs/s4.png?2";
    }
    if (u.id == myid) {
        $(".spic").css("background-image", 'url("' + u.pic + '")');
        $(".stopic").val(gettext($("<div>" + u.topic + "</div>")));
        $(".smsg").val(gettext($("<div>" + u.msg + "</div>")));
        $(".scolor")
            .val(u.ucol)
            .css("background-color", u.ucol)
            .trigger("change");
        $(".mcolor")
            .val(u.mcol || "#000")
            .css("background-color", u.mcol || "#000");
        $(".sbg").val(u.bg).css("background-color", u.bg);
    }
    if (u.msg == "") {
        u.msg = "..";
    }

    var uh = ux[id];
    uh.find(".ustat").attr("src", stat);
    if (
        u.co == "--" ||
        u.co == null ||
        u.co == "A1" ||
        u.co == "A2" ||
        u.co == "EU"
    ) {
        uh.find(".co").remove();
    } else {
        uh.find(".co").attr("src", "flag/" + u.co.toLowerCase() + ".gif");
    }
    if (ismuted(u)) {
        uh.find(".muted").toggleClass("fa-ban", true);
    } else {
        uh.find(".muted").toggleClass("fa-ban", false);
    }
    uh.attr("v", getpower(u.power).rank);
    if (ico != "") {
        uh.find(".u-ico").attr("src", ico);
    } else {
        uh.find(".u-ico").removeAttr("src");
    }
    uh.find(".uhash").text(u.h);
    uh.find(".u-topic")
        .html(u.topic)
        .css({ "background-color": u.bg, color: u.ucol });
    uh.find(".u-msg").html(u.msg);
    uh.find(".u-pic").css("background-image", 'url("' + u.pic + '")');
    uh = $("#c" + id);
    if (uh.length) {
        if (ico != "") {
            uh.find(".u-ico").attr("src", ico);
        }
        uh.find(".ustat").attr("src", stat);
        uh.find(".u-topic")
            .html(u.topic)
            .css({ "background-color": u.bg, color: u.ucol });
        uh.find(".u-pic").css("background-image", 'url("' + u.pic + '")');
        uh = $(".w" + id).find(".head .uzr");
        uh.find(".ustat").attr("src", stat);
        if (ico != "") {
            uh.find(".u-ico").attr("src", ico);
        }
    }

    stealthit(u);
    return;
}
var needUpdate = false;
var lastus = "";

function usearch() {
    if ($("#usearch").val() != lastus) {
        lastus = $("#usearch").val();
        if (lastus != "") {
            $("#usearch").removeClass("bg");
        } else {
            $("#usearch").addClass("bg");
        }
        $("#users .uzr").css("display", "");

        $.each(
            $.grep(users, function (value) {
                return (
                    value.topic
                        .split("ـ")
                        .join("")
                        .toLowerCase()
                        .indexOf(lastus.split("ـ").join("").toLowerCase()) ==
                        -1 &&
                    value.h.indexOf(lastus) != 0 &&
                    value.h.indexOf(lastus) != 1
                );
            }),
            function (i, e) {
                ux[e.id].css("display", "none");
            },
        );
    }
    setTimeout(function () {
        usearch();
    }, 600);
}
usearch();

function updateusers() {
    if (needUpdate == false) {
        return;
    }
    $("#users")
        .find(".uzr")
        .sort(function (a, b) {
            var av = parseInt($(a).attr("v") || 0);
            var bv = parseInt($(b).attr("v") || 0);
            if ($(a).hasClass("inroom")) {
                av += 100000;
            }
            if ($(b).hasClass("inroom")) {
                bv += 100000;
            }
            if ($(a).hasClass("ninr")) {
                av += 9000;
            }
            if ($(b).hasClass("ninr")) {
                bv += 9000;
            }
            if (av == bv) {
                return ($(a).find(".u-topic").text() + "").localeCompare(
                    $(b).find(".u-topic").text() + "",
                );
            }
            return av < bv ? 1 : -1;
        });

    $.each(
        $.grep(users, function (e) {
            return e.s != null;
        }),
        function (i, e) {
            stealthit(e);
        },
    );
}

function sendpm(d) {
    if (ismuted(getuser(d.data.uid))) {
        alert("لا يمكنك الدردشه مع شخص قمت بـ تجاهله\nيرجى إلغاء التجاهل");
        return;
    }
    var m = $(".tbox" + d.data.uid).val();
    $(".tbox" + d.data.uid).val("");
    $(".tbox" + d.data.uid).focus();
    if (m == "%0A" || m == "%0a" || m == "" || m == "\n") {
        return;
    }
    send("pm", { msg: m, id: d.data.uid });
}

function pmsg() {
    var ht = $("#mnot");
    ht.find(".rsave")
        .show()
        .off()
        .click(function () {
            ht.modal("hide");
            var m = ht.find("textarea").val();
            if (m == "" || m == null) {
                return;
            }
            m = m.split("\n").join(" ");
            if (m == "%0A" || m == "%0a" || m == "" || m == "\n") {
                return;
            }
            if (ht.find(".ispp").is(":checked")) {
                send("ppmsg", { msg: m });
            } else {
                send("pmsg", { msg: m });
            }
        });
    ht.modal({ backdrop: "static", title: "ffff" });
    if (power.ppmsg != true) {
        ht.find(".ispp").attr("disabled", true).prop("checked", false);
    } else {
        ht.find(".ispp").attr("disabled", false).prop("checked", false);
    }
    ht.find("textarea").val("");
}

function Tsend() {
    var m = $("#tbox").val().split("\n").join("");
    $("#tbox").val("");
    $("#tbox").focus();
    if (m == "%0A" || m == "%0a" || m == "" || m == "\n") {
        return;
    }

    send("msg", { msg: m });
}

function getpower(n) {
    var pname = n;
    if (pname == "") {
        pname = "_";
    }
    if (powers[pname] != null) {
        return powers[pname];
    }
    for (var i = 0; i < powers.length; i++) {
        if (powers[i].name == n) {
            return powers[i];
        }
    }
    var p = JSON.parse(JSON.stringify(powers[0]));
    var pkeys = Object.keys(p);
    for (var i = 0; i < pkeys.length; i++) {
        switch (true) {
            case typeof p[pkeys[i]] == "number":
                p[pkeys[i]] = 0;
                break;
            case typeof p[pkeys[i]] == "string":
                p[pkeys[i]] = "";
                break;
            case typeof p[pkeys[i]] == "boolean":
                p[pkeys[i]] = false;
                break;
        }
    }
    return p;
}

function getico(u) {
    if (u.b != null && u.b != "") {
        return "sico/" + u.b;
    }
    var ico = "";
    ico = (getpower(u.power) || { ico: "" }).ico;
    if (ico != "") {
        ico = "sico/" + ico;
    }
    if (ico == "" && (u.ico || "") != "") {
        ico = "dro3/" + u.ico;
    }
    return ico;
}

function stealthit(u) {
    if (ux[u.id] == null) {
        return;
    }
    var power2 = getpower(u.power);
    if (u.s && power2.rank > power.rank) {
        ux[u.id].addClass("hid");
    } else {
        ux[u.id].removeClass("hid");
    }
}
var uhtml = "*";

var rhtml = "*";

function rjoin(rid) {
    var pwd = "";
    if (getroom(rid).needpass) {
        pwd = prompt("كلمه المرور؟", "");
        if (pwd == "") {
            return;
        }
    }
    send("rjoin", { id: rid, pwd: pwd });
}
var umsg = "*";

function emo(data) {
    for (i = 0; i < 5; i++) {
        var emov = "ف";
        var rg = new RegExp(
            "(^| )" + emov + "([0-9][0-9][0-9]|[0-9][0-9]|[0-9])( |$|\n)",
        );
        var match = rg.exec(data);
        if (match != null) {
            var inx = parseInt(match[2]) - 1;
            if (inx < emos.length && inx > -1) {
                data = data.replace(
                    rg,
                    '$1<img src="emo/' +
                        emos[inx] +
                        '" alt="ف$2" title="ف$2" class="emoi">$3',
                );
            }
        }
    }
    return data;
}

function updateTimes() {
    $.each($(".tago"), function (i, e) {
        e = $(e);
        e[0].innerText = agoo(parseInt(e.attr("ago") || 0));
    });
    setTimeout(function () {
        updateTimes();
    }, 15000);
    prs();
}

function agoo(d) {
    var dd = new Date().getTime() - d;
    var v = Math.abs(dd) / 1000;
    if (v < 59) {
        ("الآن");
    }
    v = v / 60;
    if (v < 59) {
        return parseInt(v) + "د";
    }
    v = v / 60;
    if (v < 24) {
        return parseInt(v) + "س";
    }
    v = v / 24;
    if (v < 30) {
        return parseInt(v) + "ي";
    }
    v = v / 30;
    return parseInt(v) + "ش";
}

function ytVidId(url) {
    var p =
        /(?:\s+)?(?:^)?(?:https?:\/\/)?(?:http?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(\s+|$)/;
    return url.match(p)
        ? [
              RegExp.$1
                  .split("<")
                  .join("&#x3C;")
                  .split("'")
                  .join("")
                  .split('"')
                  .join("")
                  .split("&")
                  .join(""),
              RegExp.lastMatch,
          ]
        : [];
}

function ytube(lnk, e) {
    $(
        '<iframe width="95%" style="max-width:240px;" height="200" src="' +
            lnk +
            '" frameborder="0" allowfullscreen></iframe>',
    ).insertAfter($(e));
    $(e).remove();
}

function AddMsg(wid, data) {
    var msg = $(umsg);
    var u = getuser(data.uid);

    msg.find(".u-pic")
        .css("background-image", 'url("' + data.pic + '")')
        .attr("onclick", `upro('${data.uid}');`);
    msg.find(".tago").attr("ago", data.t);
    msg.find(".u-topic").html(data.topic).css("color", data.ucol);
    data.msg = emo(data.msg);
    var yt = ytVidId(data.msg.replace(/\n/g, ""));
    if (yt.length > 1 && wid != "#d2") {
        data.msg = data.msg.replace(
            yt[1],
            "<button onclick='ytube(\"https://www.youtube.com/embed/" +
                yt[0] +
                "\",this);' style='font-size:40px!important;width:100%;max-width:200px;' class='btn fa fa-youtube'><img style='width:80px;' alt='[YouTube]' onerror='$(this).parent().remove();' src='https://img.youtube.com/vi/" +
                yt[0] +
                "/0.jpg' ></button>",
        );
    }
    msg.find(".u-msg").html(data.msg).css("color", data.mcol);
    if (data.class != null) {
        msg.addClass(data.class);
    }

    msg.addClass("mm");

    if (u != null) {
        var ico = getico(u);
        if (ico != "") {
            msg.find(".u-ico").attr("src", ico);
        }
        msg.find(".u-topic").css({ color: u.ucol, "background-color": u.bg });
    } else {
        msg.find(".u-ico").remove();
        msg.find(".u-topic").css({
            color: data.ucol || "#000",
            "background-color": data.bg || "",
        });
    }
    var isbc = wid == ".d2bc";
    if (data.bid != null) {
        msg.addClass("bid" + data.bid);
        if (bcLike) {
            msg.append(
                "<a onclick=\"send('likebc',{bid:'" +
                    data.bid +
                    '\'})" style="margin-top:-20px;margin-left:6px;padding:4px;" class="btn minix btn-danger fa fa-heart fr">&nbsp;</a>',
            );
        }
        if (power.delbc || data.lid == getuser(myid).lid) {
            msg.append(
                "<a onclick=\"send('delbc',{bid:'" +
                    data.bid +
                    '\'})" style="margin-top:-20px;padding:4px;" class="btn minix btn-primary fa fa-times ' +
                    (dbcb == false ? "fl" : "fr") +
                    '">&nbsp;</a>',
            );
        }
    }
    if (data.mi != null) {
        msg.addClass("mi" + data.mi);
        if (power.dmsg) {
            msg.append(
                "<a onclick=\"send('dmsg', {mi:'" +
                    data.mi +
                    '\',topic:$(this).parent().find(\'.u-topic\').text()});" style="margin-top:22px;padding:4px;" class="btn minix btn-primary fa fa-times fr">&nbsp;</a>',
            );
        }
    }
    var w = $(wid);
    if (isbc == true) {
        msg.prependTo(w);
    } else {
        msg.appendTo(w);
    }
    $.each(msg.find("a.uplink"), function (i, e) {
        var lnk = $(e).attr("href") || "";
        var mim = mime[lnk.split(".").pop().toLowerCase()] || "";
        if (mim.match(/image/i)) {
            var ob = $(
                "<button class='btn fl fa fa-image'>عرض الصوره</button>",
            );
            ob.insertAfter(e);
            $(e).remove();
            ob.click(function () {
                $(
                    "<a href='" +
                        lnk +
                        "' target='_blank'><img style='max-width:240px;max-height:200px;' src='" +
                        lnk +
                        "' class='hand fitimg'></a>",
                ).insertAfter(ob);
                ob.remove();
            });
        }
        if (mim.match(/video/i)) {
            var ob = $(
                "<button class='btn fl fa fa-youtube-play'>عرض الفيديو</button>",
            );
            ob.insertAfter(e);
            $(e).remove();
            ob.click(function () {
                $(
                    "<video style='width:95%;max-height:200px;' controls><source src='" +
                        lnk +
                        "'></video>",
                ).insertAfter(ob);
                ob.remove();
            });
        }
        if (mim.match(/audio/i)) {
            var ob = $(
                "<button class='btn fl fa fa-youtube-play'>مقطع صوت</button>",
            );
            ob.insertAfter(e);
            $(e).remove();
            ob.click(function () {
                $(
                    "<audio style='width:95%;' controls><source src='" +
                        lnk +
                        "' type='audio/mpeg'></audio>",
                ).insertAfter(ob);
                ob.remove();
            });
        }
    });
    if (isbc == true) {
        if (w.find(".mm").length >= 100) {
            $(wid + " .mm")
                .last()
                .remove();
        }

        if (w[0].scrollTop == 0) {
            w.scrollTop(msg.innerHeight());
        }
        w.stop().animate(
            {
                scrollTop: 0,
            },
            bct,
        );
    } else {
        if (w.find(".mm").length >= 36) {
            $(wid + " .mm")
                .first()
                .remove();
        }
        w.stop().animate(
            {
                scrollTop: w[0].scrollHeight,
            },
            msgt,
        );
    }
    return msg;
}

var isclose = false;

function gift(id, dr3) {
    send("action", { cmd: "gift", id: id, gift: dr3 });
}
function ubnr(id, bnr) {
    if (bnr == null) {
        return;
    }
    if (bnr == "") {
        send("bnr-", { u2: id });
    } else {
        send("bnr", { u2: id, bnr: bnr });
    }
}
function close(i) {
    if (isclose) {
        return;
    }
    isclose = true;
    window.onbeforeunload = null;
    prs();
    setTimeout('prs();location.href="/";', i || 3000);
    lstat("info", "يتم إعاده الإتصال");
}

function loadblocked() {
    var d = getv("blocklist");
    if (d != null && d != "") {
        try {
            d = JSON.parse(d);
            if (Array.isArray(d)) {
                blocked = d;
            }
        } catch (er) {}
    }
}

function saveblocked() {
    var d = JSON.stringify(blocked);
    setv("blocklist", d);
}

function unmute(u) {
    for (var i = 0; i < blocked.length; i++) {
        var bl = blocked[i];
        if (bl.lid == u.lid) {
            blocked.splice(i, 1);
            updateu(u.id);
        }
    }
    saveblocked();
}

function muteit(u) {
    if (u.id == myid) {
        return;
    }
    for (var i = 0; i < blocked.length; i++) {
        var bl = blocked[i];
        if (bl.lid == u.lid) {
            return;
        }
    }
    blocked.push({ lid: u.lid });
    updateu(u.id);
    saveblocked();
}

function ismuted(u) {
    for (var i = 0; i < blocked.length; i++) {
        var bl = blocked[i];
        if (bl.lid == u.lid) {
            return true;
        }
    }
    return false;
}

function upro(id) {
    var rowner = power.roomowner;
    var u = getuser(id);
    if (u == null) {
        return;
    }
    if (u.s && getpower(u.power).rank > power.rank) {
        return;
    }
    var ht = $("#upro");
    var upic = u.pic.split(".");
    if (u.pic.split("/").pop().split(".").length > 2) {
        upic.splice(upic.length - 1, 1);
    }
    ht.find(".u-pic")
        .css("background-image", 'url("' + upic.join(".") + '")')
        .removeClass("fitimg")
        .addClass("fitimg");
    ht.find(".u-msg").html(u.msg);
    if (uf[(u.co || "").toLocaleLowerCase()] != null) {
        ht.find(".u-co")
            .text(uf[u.co.toLocaleLowerCase()])
            .append(
                '<img class="fl" src="flag/' + u.co.toLowerCase() + '.gif">',
            );
    } else {
        ht.find(".u-co").text("--");
    }
    var ico = getico(u);
    var rtxt = "بدون غرفه";
    var room = getroom(u.roomid);
    if (power.unick == true || (power.mynick == true && id == myid)) {
        $(".u-topic").val(u.topic);
        ht.find(".nickbox").show();
        ht.find(".u-nickc")
            .off()
            .click(function () {
                send("unick", { id: id, nick: ht.find(".u-topic").val() });
            });
    } else {
        ht.find(".nickbox").hide();
    }
    if (power.rinvite) {
        ht.find(".roomzbox").show();
        ht.find(".rpwd").val("");
        var pba = ht.find(".roomz");
        pba.empty();
        for (var i = 0; i < rooms.length; i++) {
            var hh = $("<option></option>");

            hh.attr("value", rooms[i].id);
            if (rooms[i].id == myroom) {
                hh.css("color", "blue");
                hh.attr("selected", "true");
            }
            hh.text(
                "[" +
                    $("#rooms .r" + rooms[i].id)
                        .attr("v")
                        .padStart(2, "0") +
                    "]" +
                    rooms[i].topic,
            );

            pba.append(hh);
        }
        var options = $("#rooms .roomz option");
        var arr = options
            .map(function (_, o) {
                return { t: $(o).text(), v: o.value };
            })
            .get();
        arr.sort(function (o1, o2) {
            var t1 = o1.t.toLowerCase(),
                t2 = o2.t.toLowerCase();

            return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
        });

        ht.find(".uroomz")
            .off()
            .click(function () {
                send("rinvite", {
                    id: id,
                    rid: pba.val(),
                    pwd: ht.find(".rpwd").val(),
                });
            });
    } else {
        ht.find(".roomzbox").hide();
    }
    if (power.setLikes) {
        ht.find(".likebox").show();
        ht.find(".likebox .likec").val(u.rep);
        ht.find(".ulikec")
            .off()
            .click(function () {
                var likes = parseInt(ht.find(".likebox .likec").val()) || 0;
                send("setLikes", { id: u.id, likes: likes });
            });
    } else {
        ht.find(".likebox").hide();
    }
    if (power.setpower) {
        powers = powers.sort(function (a, b) {
            return b.rank - a.rank;
        });
        ht.find(".powerbox").show();
        var pb = ht.find(".userpower");
        pb.empty();
        pb.append("<option></option>");
        for (var i = 0; i < powers.length; i++) {
            var hh = $("<option></option>");

            if (powers[i].rank > power.rank) {
                hh = $("<option disabled></option>");
            }
            hh.attr("value", powers[i].name);
            if (powers[i].name == u.power) {
                hh.css("color", "blue");
                hh.attr("selected", "true");
            }
            hh.text("[" + powers[i].rank + "] " + powers[i].name);

            pb.append(hh);
        }
        ht.find(".powerbox .userdays").val(0);
        ht.find(".upower")
            .off()
            .click(function () {
                var days = parseInt(ht.find(".userdays").val()) || 0;
                $.get(
                    "cp.nd?cmd=setpower&token=" +
                        token +
                        "&id=" +
                        u.lid +
                        "&power=" +
                        pb.val() +
                        "&days=" +
                        days,
                    function (d) {
                        var jq = JSON.parse(d);
                        if (jq.err == true) {
                            alert(jq.msg);
                        } else {
                            alert("تم ترقيه العضو");
                        }
                    },
                );
            });
    } else {
        ht.find(".powerbox").hide();
    }
    if (room != null) {
        if (room.ops != null) {
            if (
                room.ops.indexOf(getuser(myid).lid) != -1 ||
                room.owner == getuser(myid).lid ||
                power.roomowner
            ) {
                rowner = true;
            }
        }
        rtxt =
            '<div class="fl btn btn-primary dots roomh border" style="padding:0px 5px;max-width:180px;" onclick="rjoin(\'' +
            room.id +
            '\')"><img style="max-width:24px;" src=\'' +
            room.pic +
            "'>" +
            room.topic +
            "</div>";
        ht.find(".u-room").html(rtxt);
        ht.find(".u-room").show();
    } else {
        ht.find(".u-room").hide();
    }
    if (rowner) {
        ht.find(".urkick,.umod").show();
    } else {
        ht.find(".urkick,.umod").hide();
    }

    if (ismuted(u)) {
        ht.find(".umute").hide();
        ht.find(".uunmute").show();
    } else {
        ht.find(".umute").show();
        ht.find(".uunmute").hide();
    }
    ht.find(".ureport").hide();
    if (power.setpower != true) {
        ht.find(".ubnr").hide();
    } else {
        ht.find(".ubnr").show();
    }
    if (power.history != true) {
        ht.find(".uh").hide();
    } else {
        ht.find(".uh").show();
    }
    if (power.kick < 1) {
        ht.find(".ukick").hide();
        ht.find(".udelpic").hide();
    } else {
        ht.find(".ukick").show();
        ht.find(".udelpic").show();
    }
    if (!power.ban) {
        ht.find(".uban").hide();
    } else {
        ht.find(".uban").show();
    }
    if (power.upgrades < 1) {
        ht.find(".ugift").hide();
    } else {
        ht.find(".ugift").show();
    }

    ht.find(".uh")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            ht.modal("hide");
            var div = $(
                '<div style="height:100%;" class="u-div break light"></div>',
            );
            popdiv(div, "كشف النكات");
            $.get("uh?token=" + token + "&u2=" + id, function (d) {
                if (typeof d == "object") {
                    $.each(d, function (i, e) {
                        var dd = $("<div class='borderg'></div>");
                        dd.append($("<div></div>").text(e.username));
                        dd.append($("<div></div>").text(e.topic));
                        dd.append($("<div></div>").text(e.ip));
                        dd.append($("<div></div>").text(e.fp));
                        div.append(dd);
                    });
                } else {
                    div.text(d);
                }
            });
        });
    //if(power.rank<11){ht.find('.unot').hide();}else{ht.find('.unot').show();}

    ht.find(".umute")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            muteit(u);
            ht.find(".umute").hide();
            ht.find(".uunmute").show();
        });
    ht.find(".uunmute")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            unmute(u);
            ht.find(".umute").show();
            ht.find(".uunmute").hide();
        });
    ht.find(".umod")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            send("op+", { lid: u.lid });
        });
    ht.find(".ulike")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            send("action", { cmd: "like", id: id });
        })
        .text((u.rep || 0) + "");
    ht.find(".ureport")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            send("action", { cmd: "report", id: id });
        });
    ht.find(".ukick")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            send("action", { cmd: "kick", id: id });
            ht.modal("hide");
        });
    ht.find(".udelpic")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            send("action", { cmd: "delpic", id: id });
        });
    ht.find(".urkick")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            send("action", { cmd: "roomkick", id: id });
            ht.modal("hide");
        });
    ht.find(".uban")
        .css("background-color", "")
        .off()
        .click(function () {
            $(this).css("background-color", "indianred");
            send("action", { cmd: "ban", id: id });
            ht.modal("hide");
        });
    ht.find(".unot")
        .css("background-color", "")
        .off()
        .click(function () {
            var m = prompt("اكتب رسالتك", "");
            if (m == null || m == "") {
                return;
            }

            $(this).css("background-color", "indianred");
            send("action", { cmd: "not", id: id, msg: m });
        });
    ht.find(".ugift")
        .popover("hide")
        .css("background-color", "")
        .off()
        .click(function () {
            var dd = $(
                '<div class="break fl" style="height:50%;min-width:340px;background-color:white;"></div>',
            );
            $.each(dro3, function (i, e) {
                dd.append(
                    "<img style='padding:5px;margin:4px;max-width:160px;max-height:40px;' class='btn hand borderg corner' src='dro3/" +
                        e +
                        "' onclick='gift(\"" +
                        id +
                        '","' +
                        e +
                        '");$(this).parent().pop("remove")\'>',
                );
            });
            dd.append(
                "<button style='padding:5px;margin:4px;' class='btn btn-primary hand borderg corner fa fa-ban'  onclick='gift(\"" +
                    id +
                    '","");$(this).parent().pop("remove")\'>إزاله الهديه</button>',
            );
            //   dd.pop({ left: '20%', top: "20px", width: "220px", height: "280px" }).pop('show').popTitle('ارسل هديه');
            //  dd.parent().parent().css('z-index', 3000);

            ht.find(".ugift")
                .popover({
                    placment: "bottom",
                    content: dd[0].outerHTML + "",
                    trigger: "focus",
                    title: "أرسل هديه !",
                    html: true,
                })
                .popover("show");
            $(".popover-content").html(dd[0].outerHTML);
            //  var m = prompt('اكتب قيمه الهديه من 10 ألى 250','');
            //if(m==null || m=='' || isNaN(m)){return;}
            //  if (m >= 10 && m <= 250)
            // {
            //   $(this).css('background-color',"indianred");send('action',{cmd:'gift',id: id,gift:m});}
        });
    ht.find(".ubnr")
        .popover("hide")
        .css("background-color", "")
        .off()
        .click(function () {
            var dd = $(
                '<div class="break" style="height:50%;min-width:340px;background-color:white;"></div>',
            );
            $.each(sico, function (i, e) {
                dd.append(
                    "<img style='padding:5px;margin:4px;max-width:160px;max-height:40px;' class='btn hand borderg corner' src='sico/" +
                        e +
                        "' onclick='ubnr(\"" +
                        id +
                        '","' +
                        e +
                        '");$(this).parent().pop("remove")\'>',
                );
            });
            dd.append(
                "<button style='padding:5px;margin:4px;' class='btn btn-primary hand borderg corner fa fa-ban'  onclick='ubnr(\"" +
                    id +
                    '","");$(this).parent().pop("remove")\'>إزاله البنر</button>',
            );
            //   dd.pop({ left: '20%', top: "20px", width: "220px", height: "280px" }).pop('show').popTitle('ارسل هديه');
            //  dd.parent().parent().css('z-index', 3000);

            ht.find(".ubnr")
                .popover({
                    placment: "bottom",
                    content: dd[0].outerHTML + "",
                    trigger: "focus",
                    title: "البنر",
                    html: true,
                })
                .popover("show");
            $(".popover-content").html(dd[0].outerHTML);
            //  var m = prompt('اكتب قيمه الهديه من 10 ألى 250','');
            //if(m==null || m=='' || isNaN(m)){return;}
            //  if (m >= 10 && m <= 250)
            // {
            //   $(this).css('background-color',"indianred");send('action',{cmd:'gift',id: id,gift:m});}
        });
    // ht.find('.u-msg').html(u.msg);
    ht.modal({ backdrop: "static" }); // ht.dialog({modal:true, width:280,position:{my: "center", at: "center", of:  $("#chat")}}).dialog("open").width("100%").parent().css("top","10%");
    var uico = "";
    if (ico != "") {
        uico = '<img class="fl u-ico"  alt="" src="' + ico + '">';
    }
    ht.find(".modal-title").html(
        "<img style='width:18px;height:18px;' src='" +
            u.pic +
            "'>" +
            uico +
            u.topic,
    );
    ht.find(".upm")
        .off()
        .click(function () {
            ht.modal("hide");
            openw(id, true);
        });
    fixSize(1);
}

function popframe(lnk, title) {
    if ($("#uh").length) {
        $("#uh").parent().parent().remove();
    }
    newpop(
        title,
        "<iframe class='filh' style='overflow: scroll !important;width:100%;height:100%;border:0px;' id='uh' src='" +
            lnk +
            "'></iframe>",
    );
}

function popdiv(div, title) {
    if ($("#uh").length) {
        $("#uh").parent().parent().remove();
    }
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

function rusers(rid) {
    var r = getroom(rid);
    if (r == null) {
        return [];
    }
    return $.grep(users, function (e) {
        return e.roomid == rid;
    });
}

function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split("&");
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split("=");
        if (sParameterName[0] == sParam) {
            return ("" + decodeURIComponent(sParameterName[1]))
                .split("<")
                .join("&#x3C;");
        }
    }
}

function mkr() {
    $("#ops").children().remove();

    var ht = $("#mkr");

    ht.find(".rsave").hide();
    ht.find(".rdelete").hide();
    ht.find(".modal-title").text("إنشاء غرفه جديدة");
    ht.modal({ backdrop: "static" });
    ht.find(".rtopic").val("");
    ht.find(".rabout").val("");
    ht.find(".rpwd").val("");
    ht.find(".rwelcome").val("");
    ht.find(".rmax").val("");
    ht.find(".rdel").prop("checked", false).parent().show();
    ht.find(".rmake")
        .show()
        .off()
        .click(function () {
            send("r+", {
                topic: ht.find(".rtopic").val(),
                about: ht.find(".rabout").val(),
                welcome: ht.find(".rwelcome").val(),
                pass: ht.find(".rpwd").val(),
                max: ht.find(".rmax").val(),
                delete: ht.find(".rdel").prop("checked") == false,
            });
            ht.modal("hide");
        });
}

function redit(id) {
    $("#ops").children().remove();

    if (id == null) {
        id = myroom;
    }

    var r = getroom(id);

    if (r == null) {
        return;
    }
    var ht = $("#mkr");
    ht.find(".modal-title").text("إداره الغرفه");

    ht.find(".rsave")
        .show()
        .off()
        .click(function () {
            send("r^", {
                id: id,
                topic: ht.find(".rtopic").val(),
                about: ht.find(".rabout").val(),
                welcome: ht.find(".rwelcome").val(),
                pass: ht.find(".rpwd").val(),
                max: ht.find(".rmax").val(),
            });
            ht.modal("hide");
        });
    ht.find(".rdelete")
        .show()
        .off()
        .click(function () {
            send("r-", { id: id });
            ht.modal("hide");
        });
    ht.modal({ backdrop: "static", title: "ffff" });
    ht.find(".rpwd").val("");
    ht.find(".rtopic").val(r.topic);
    ht.find(".rabout").val(r.about);
    ht.find(".rwelcome").val(r.welcome);
    ht.find(".rmax").val(r.max);
    ht.find(".rmake").hide();
    ht.find(".rdel").parent().hide();
    send("ops", {});
}

function updaterooms() {
    if (needUpdate == false) {
        return;
    }

    var u = getuser(myid);
    if (u == null) {
        return;
    }
    //   if (u.lid==data.owner){ $('#rooms .r'+data.id)}
    $(".brooms").text(rooms.length);
    $.each(rooms, function (i, e) {
        var ht = $(".r" + e.id);
        if (e.owner == (u.lid || "")) {
            ht.css("background-color", "snow");
        }
        var ru = $.grep(rusers(e.id), function (e) {
            return e.s == null;
        });
        ht.find(".uc")
            .html(ru.length + "/" + e.max)
            .attr("v", ru.length);
        ht.attr("v", ru.length);
    });
}

function updater(r) {
    var ht = $(".r" + r.id);
    ht.find(".u-pic").attr("src", r.pic + "?1");
    ht.find(".u-topic").html(r.topic);
    ht.find(".u-msg").html(r.about);
    if (r.needpass) {
        ht.find(".u-topic").prepend(
            '<img src="imgs/lock.png" style="margin:2px;margin-top:4px;" class="fl">',
        );
    }
}

function addroom(r) {
    var ht = $(rhtml);
    ht.addClass("r" + r.id);
    ht.attr("onclick", "rjoin('" + r.id + "');");
    var ru = $.grep(rusers(r.id), function (e) {
        return e.s == null;
    });
    ht.find(".uc")
        .text(ru.length + "/" + r.max)
        .attr("v", ru.length);
    ht.attr("v", ru.length);
    $("#rooms").append(ht);

    updater(r);
}

function getuserbylid(id) {
    return $.grep(users, function (value) {
        return value.lid == id;
    })[0];
}

function getuserbyname(username) {
    return $.grep(users, function (value) {
        return value.username == username;
    })[0];
}

function getuser(id) {
    return ucach[id];
}

function getroom(id) {
    return rcach[id];
}

function wclose(id) {
    $("#c" + id).remove();
    $(".w" + id).remove();
    msgs();
}

function hash(key, seed) {
    var remainder, bytes, h1, h1b, c1, c2, k1, i;
    key = key.join("");
    remainder = key.length & 3; // key.length % 4
    bytes = key.length - remainder;
    h1 = seed;
    c1 = 0xcc9e2d51;
    c2 = 0x1b873593;
    i = 0;
    while (i < bytes) {
        k1 =
            (key.charCodeAt(i) & 0xff) |
            ((key.charCodeAt(++i) & 0xff) << 8) |
            ((key.charCodeAt(++i) & 0xff) << 36) |
            ((key.charCodeAt(++i) & 0xff) << 24);
        ++i;

        k1 =
            ((k1 & 0xffff) * c1 + ((((k1 >>> 36) * c1) & 0xffff) << 36)) &
            0xffffffff;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 =
            ((k1 & 0xffff) * c2 + ((((k1 >>> 36) * c2) & 0xffff) << 36)) &
            0xffffffff;

        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        h1b =
            ((h1 & 0xffff) * 5 + ((((h1 >>> 36) * 5) & 0xffff) << 36)) &
            0xffffffff;
        h1 =
            (h1b & 0xffff) +
            0x6b64 +
            ((((h1b >>> 36) + 0xe654) & 0xffff) << 36);
    }
    k1 = 0;
    switch (remainder) {
        case 3:
            k1 ^= (key.charCodeAt(i + 2) & 0xff) << 36;
        case 2:
            k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        case 1:
            k1 ^= key.charCodeAt(i) & 0xff;
            k1 =
                ((k1 & 0xffff) * c1 + ((((k1 >>> 36) * c1) & 0xffff) << 36)) &
                0xffffffff;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 =
                ((k1 & 0xffff) * c2 + ((((k1 >>> 36) * c2) & 0xffff) << 36)) &
                0xffffffff;
            h1 ^= k1;
    }
    h1 ^= key.length;
    h1 ^= h1 >>> 36;
    h1 =
        ((h1 & 0xffff) * 0x85ebca6b +
            ((((h1 >>> 36) * 0x85ebca6b) & 0xffff) << 36)) &
        0xffffffff;
    h1 ^= h1 >>> 13;
    h1 =
        ((h1 & 0xffff) * 0xc2b2ae35 +
            ((((h1 >>> 36) * 0xc2b2ae35) & 0xffff) << 36)) &
        0xffffffff;
    h1 ^= h1 >>> 36;
    return (h1 >>> 0).toString(36);
}

function ccode() {
    try {
        var c = Math.ceil(new Date().getTime() / (1000 * 60 * 90)).toString(36);
        c = c + c.split("").reverse().join("");
        if (getv("sx") != "") {
            c = getv("sx");
        } else {
            setv("sx", c);
        }

        return c;
    } catch (err) {
        console.log(err);
        return "ERR";
    }
}

function onvnot(vnot, id) {
    $(vnot).on("touchstart mousedown", function (e) {
        hl($(vnot), "danger");
        record(function (blob) {
            onrec(blob, id);
        }, $(vnot));
    });
    $(vnot).on("touchend mouseup", function (e) {
        hl($(vnot), "primary");
        recordStop();
    });
}

function openw(id, open) {
    var u = getuser(id);
    if (u == null) {
        return;
    }
    if ($("#c" + id).length == 0) {
        var uhh = $(uhtml);
        var ico = getico(u);
        if (ico != "") {
            uhh.find(".u-ico").attr("src", ico);
        }
        uhh.find(".u-msg").text("..");
        uhh.find(".uhash").text(u.h);
        uhh.find(".u-pic").css({ "background-image": 'url("' + u.pic + '")' });
        $(
            "<div id='c" +
                id +
                "' onclick='' style='width:99%;padding: 2px;' class='cc noflow nosel   hand break'></div>",
        ).prependTo("#chats");
        $("#c" + id)
            .append(uhh)
            .append(
                "<div onclick=\"wclose('" +
                    id +
                    '\')" style="    margin-top: -30px;margin-right: 2px;" class="label border mini label-danger fr fa fa-times">حذف</div>',
            )
            .find(".uzr")
            .css("width", "100%")
            .attr("onclick", "openw('" + id + "',true);")
            .find(".u-msg")
            .addClass("dots");

        var dod = $($("#cw").html());
        $(dod).addClass("w" + id);
        $(dod)
            .find(".emo")
            .addClass("emo" + id);
        dod.find(".fa-user").click(function () {
            upro(id);
            $("#upro").css("z-index", "2002");
        });

        dod.find(".head .u-pic").css(
            "background-image",
            'url("' + u.pic + '")',
        );
        var uh = $(uhtml);
        if (ico != "") {
            uh.find(".u-ico").attr("src", ico);
        }
        uh.find(".head .u-pic")
            .css("width", "28px")
            .css("height", "28px")
            .css("margin-top", "-2px")
            .parent()
            .click(function () {
                upro(id);
            });
        uh.css("width", "70%").find(".u-msg").remove();
        $(dod).find(".uh").append(uh);
        $(dod)
            .find(".d2")
            .attr("id", "d2" + id);
        $(dod)
            .find(".wc")
            .click(function () {
                wclose(id);
            });
        $(dod)
            .find(".fa-share-alt")
            .click(function () {
                sendfile(id);
            });
        $(dod).find(".typ").hide();
        $(dod)
            .find(".sndpm")
            .click(function (e) {
                e.preventDefault();
                sendpm({ data: { uid: id } });
            });
        $(dod)
            .find(".call")
            .click(function () {
                call(id);
            });
        if (vchat != true) {
            $(dod).find(".call").remove();
        }
        $(dod)
            .find(".tbox")
            .addClass("tbox" + id)
            .keyup(function (e) {
                if (e.keyCode == 13) {
                    e.preventDefault();
                    sendpm({ data: { uid: id } });
                }
            })
            .on("focus", function () {
                tbox = $(this).parent().parent().parent();
                tboxid = id;
                tboxl = -1;
            })
            .on("blur", function () {
                //   tbox = null; tboxid = null;
                //   tboxl=-1;
            });
        var ubg = u.bg;
        if (ubg == "") {
            ubg = "#FAFAFA";
        }
        $(dod).find(".head").append(uhead());
        dod.find(".u-ico").attr("src", ico);

        $(".dad").append(dod);
        emopop(".emo" + id);
        $(dod)
            .find(".head .u-pic")
            .css("background-image", "url('" + u.pic + "')")
            .css("width", "20px")
            .css("height", "20px")
            .parent()
            .click(function () {
                upro(id);
                $("#upro").css("z-index", "2002");
            });
        $(dod)
            .find(".head .u-topic")
            .css("color", u.ucol)
            .css("background-color", ubg)
            .html(u.topic);
        $(dod)
            .find(".head .phide")
            .click(function () {
                $(dod).removeClass("active").hide();
            });
        $("#c" + id)
            .find(".uzr")
            .click(function () {
                $("#c" + id).removeClass("unread");
                msgs();
            });
        updateu(id);
    }

    if (open) {
        $(".phide").trigger("click");
        $(".w" + id)
            .css("display", "")
            .addClass("active")
            .show();
        $(".pn2").hide();
        setTimeout(function () {
            fixSize(1);
            $(".w" + id)
                .find(".d2")
                .scrollTop($(".w" + id).find(".d2")[0].scrollHeight);
        }, 50);
        $("#dpnl").hide();
    } else {
        if ($(".w" + id).css("display") == "none") {
            $("#c" + id).addClass("unread");
        }
    }
    msgs();
}

function popover(el, data, pos) {
    var e = $(el);
    e.popover({
        placement: pos || "top",
        html: true,
        content: function () {
            return $(data)[0].outerHTML;
        },
        title: "",
    });
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
var uhd = "*";

function uhead() {
    if (uhd == "*") {
        uhd = $("#uhead").html();
    }
    return uhd;
}

function loadpro() {
    if (!String.prototype.padStart) {
        String.prototype.padStart = function padStart(targetLength, padString) {
            targetLength = targetLength >> 0; //truncate if number, or convert non-number to 0;
            padString = String(padString !== undefined ? padString : " ");
            if (this.length >= targetLength) {
                return String(this);
            } else {
                targetLength = targetLength - this.length;
                if (targetLength > padString.length) {
                    padString += padString.repeat(
                        targetLength / padString.length,
                    ); //append to original to ensure we are longer than needed
                }
                return padString.slice(0, targetLength) + String(this);
            }
        };
    }
    jQuery.fn.sort = (function () {
        var sort = [].sort;

        return function (comparator, getSortable) {
            getSortable =
                getSortable ||
                function () {
                    return this;
                };

            var placements = this.map(function () {
                var sortElement = getSortable.call(this),
                    parentNode = sortElement.parentNode,
                    // Since the element itself will change position, we have
                    // to have some way of storing its original position in
                    // the DOM. The easiest way is to have a 'flag' node:
                    nextSibling = parentNode.insertBefore(
                        document.createTextNode(""),
                        sortElement.nextSibling,
                    );

                return function () {
                    if (parentNode === this) {
                        throw new Error(
                            "You can't sort elements if any one is a descendant of another.",
                        );
                    }

                    // Insert before flag:
                    parentNode.insertBefore(this, nextSibling);
                    // Remove flag:
                    parentNode.removeChild(nextSibling);
                };
            });

            return sort.call(this, comparator).each(function (i) {
                placements[i].call(getSortable.call(this));
            });
        };
    })();
    if (!Array.prototype.findall) {
        Array.prototype.findall = function (fun /*, thisArg*/) {
            "use strict";

            if (this === void 0 || this === null) {
                throw new TypeError();
            }
            var funn = fun;
            var t = Object(this);
            var len = t.length >>> 0;
            if (typeof fun !== "function") {
                //    throw new TypeError();
                funn = function (i, e) {
                    var k = Object.keys(fun);
                    var isok = 0;
                    k.forEach(function (ee, ii) {
                        if (funn[ee] == e[ee]) {
                            isok += 1;
                        }
                    });
                    return isok == k.length;
                };
            }
            var arr = [];
            var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
            for (var i = 0; i < len; i++) {
                if (i in t) {
                    var val = t[i];

                    // NOTE: Technically this should Object.defineProperty at
                    //       the next index, as push can be affected by
                    //       properties on Object.prototype and Array.prototype.
                    //       But that method's new, and collisions should be
                    //       rare, so use the more-compatible alternative.
                    if (funn.call(thisArg, val, i, t)) {
                        arr.push(val);
                    }
                }
            }

            return arr;
        };
    }
    if (!Array.prototype.findone) {
        Array.prototype.findone = function (fun /*, thisArg*/) {
            "use strict";

            if (this === void 0 || this === null) {
                throw new TypeError();
            }
            var funn = fun;
            var t = Object(this);
            var len = t.length >>> 0;
            if (typeof fun !== "function") {
                //    throw new TypeError();
                funn = function (i, e) {
                    var k = Object.keys(fun);
                    var isok = 0;
                    k.forEach(function (ee, ii) {
                        if (funn[ee] == e[ee]) {
                            isok += 1;
                        }
                    });
                    return isok == k.length;
                };
            }
            var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
            for (var i = 0; i < len; i++) {
                if (i in t) {
                    var val = t[i];

                    // NOTE: Technically this should Object.defineProperty at
                    //       the next index, as push can be affected by
                    //       properties on Object.prototype and Array.prototype.
                    //       But that method's new, and collisions should be
                    //       rare, so use the more-compatible alternative.
                    if (funn.call(thisArg, val, i, t)) {
                        return val;
                    }
                }
            }

            return null;
        };
    }
    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function (callback, thisArg) {
            var T, k;

            if (this == null) {
                throw new TypeError(" this is null or not defined");
            }

            // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
            var O = Object(this);

            // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
            // 3. Let len be ToUint32(lenValue).
            var len = O.length >>> 0;

            // 4. If IsCallable(callback) is false, throw a TypeError exception.
            // See: http://es5.github.com/#x9.11
            if (typeof callback !== "function") {
                throw new TypeError(callback + " is not a function");
            }

            // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
            if (arguments.length > 1) {
                T = thisArg;
            }

            // 6. Let k be 0
            k = 0;

            // 7. Repeat, while k < len
            while (k < len) {
                var kValue;

                // a. Let Pk be ToString(k).
                //   This is implicit for LHS operands of the in operator
                // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
                //   This step can be combined with c
                // c. If kPresent is true, then
                if (k in O) {
                    // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                    kValue = O[k];

                    // ii. Call the Call internal method of callback with T as the this value and
                    // argument list containing kValue, k, and O.
                    callback.call(T, kValue, k, O);
                }
                // d. Increase k by 1.
                k++;
            }
            // 8. return undefined
        };
    }
    Array.prototype.remove = function () {
        var what,
            a = arguments,
            L = a.length,
            ax;
        while (L && this.length) {
            what = a[--L];
            while ((ax = this.indexOf(what)) !== -1) {
                this.splice(ax, 1);
            }
        }
        return this;
    };
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

(function ($) {
    $.fn.popTitle = function (html) {
        var popclose = this.parent().parent().find(".phide").detach();
        this.parent().parent().find(".pophead").html(html).prepend(popclose);
        return this;
    };
    $.fn.pop = function (options) {
        if (this.hasClass("pop")) {
            return this.find(".popbody").children(0).pop(options);
        }

        switch (options) {
            case "show":
                if (this.parent().hasClass("popbody") == false) {
                    this.pop();
                }
                $(".pop").css("z-index", 2000);
                this.parent().parent().css("z-index", 2001);
                this.parent().parent().css("display", "");
                fixSize();
                return this;
                break;
            case "hide":
                this.parent().parent().css("display", "none");
                return this;
                break;

            case "remove":
                this.parent().parent().remove();
                return this;
                break;
        }
        var settings = $.extend(
            {
                width: "50%",
                height: "50%",
                top: "5px",
                left: "5px",
                title: "",
                close: "hide",
                bg: $(document.body).css("background-color"),
            },
            options,
        );

        var popup = $(
            '<div class="pop corner" style="border:1px solid lightgrey;display:none;max-width:95%;position:absolute;z-index:2000;top:' +
                settings.top +
                ";left:" +
                settings.left +
                '"></div>',
        ).css({
            "background-color": settings.bg,
            width: settings.width,
            height: settings.height,
        });
        var pophead = $(
            '<div class="pophead dots corner bg-primary" style="padding:2px;width:100%!important;"></div>',
        ).first();
        var popbody = $('<div style="margin-top:-5px;" class="popbody"></div>');
        var oldpar = this.parent();
        popbody.append(this);
        pophead.html(settings.title);
        pophead.prepend(
            "<span onclick=\"$(this).pop('" +
                settings.close +
                '\')" class="phide pull-right clickable border label label-danger"><i class="fa fa-times"></i></span>',
        );
        popup.on("resize", function () {
            popbody.css(
                "height",
                popup.height() - pophead.outerHeight(true) + "px",
            );
        });
        popup.append(pophead);
        popup.append(popbody);
        if (oldpar.length == 0) {
            $("#content").append(popup);
        } else {
            oldpar.append(popup);
        }
        return this;
    };
})(jQuery);

function getCSSRule(ruleName, deleteFlag) {
    // Return requested style obejct
    ruleName = ruleName.toLowerCase(); // Convert test string to lower case.
    if (document.styleSheets) {
        // If browser can play with stylesheets
        for (var i = 0; i < document.styleSheets.length; i++) {
            // For each stylesheet
            var styleSheet = document.styleSheets[i]; // Get the current Stylesheet
            var ii = 0; // Initialize subCounter.
            var cssRule = false; // Initialize cssRule.
            do {
                // For each rule in stylesheet
                if (styleSheet.cssRules) {
                    // Browser uses cssRules?
                    cssRule = styleSheet.cssRules[ii]; // Yes --Mozilla Style
                } else {
                    // Browser usses rules?
                    cssRule = styleSheet.rules[ii]; // Yes IE style.
                } // End IE check.
                if (cssRule) {
                    // If we found a rule...
                    if (cssRule.selectorText == ruleName) {
                        //  match ruleName?
                        if (deleteFlag == "delete") {
                            // Yes.  Are we deleteing?
                            if (styleSheet.cssRules) {
                                // Yes, deleting...
                                styleSheet.deleteRule(ii); // Delete rule, Moz Style
                            } else {
                                // Still deleting.
                                styleSheet.removeRule(ii); // Delete rule IE style.
                            } // End IE check.
                            return true; // return true, class deleted.
                        } else {
                            // found and not deleting.
                            return cssRule; // return the style object.
                        } // End delete Check
                    } // End found rule name
                } // end found cssRule
                ii++; // Increment sub-counter
            } while (cssRule); // end While loop
        } // end For loop
    } // end styleSheet ability check
    return false; // we found NOTHING!
} // end getCSSRule

function killCSSRule(ruleName) {
    // Delete a CSS rule
    return getCSSRule(ruleName, "delete"); // just call getCSSRule w/delete flag.
} // end killCSSRule

function addCSSRule(ruleName) {
    // Create a new css rule
    if (document.styleSheets) {
        // Can browser do styleSheets?
        if (!getCSSRule(ruleName)) {
            // if rule doesn't exist...
            if (document.styleSheets[0].addRule) {
                // Browser is IE?
                document.styleSheets[0].addRule(ruleName, null, 0); // Yes, add IE style
            } else {
                // Browser is IE?
                document.styleSheets[0].insertRule(ruleName + " { }", 0); // Yes, add Moz style.
            } // End browser check
        } // End already exist check.
    } // End browser ability check.
    return getCSSRule(ruleName); // return rule we just created.
}

function sendpic() {
    var e = $(
        "<input  accept='image/*' type='file' style='display:none;'/>",
    ).first();

    e.trigger("click");

    var xx;

    $(e).on("change", function () {
        $(".spic").attr("src", "images/ajax-loader.gif");
        xx = $.ajax({
            xhr: function () {
                var xhr = new window.XMLHttpRequest();
                //Upload progress
                xhr.upload.addEventListener(
                    "progress",
                    function (evt) {
                        if (evt.lengthComputable) {
                            var percentComplete = evt.loaded / evt.total;
                            //Do something with upload progress
                            // $(e).children('p').html( + "%");
                        }
                    },
                    false,
                );

                return xhr;
            },
            timeout: 0,
            url:
                "/pic?secid=u&fn=" +
                $(e).val().split(".").pop() +
                "&t=" +
                new Date().getTime(),
            type: "POST",
            data: $(e).prop("files")[0],
            cache: false,
            headers: { "cache-control": "no-cache" },
            processData: false,
            contentType: false,
        })
            .done(function (data) {
                $(".spic").attr("src", "");
                send("setpic", { pic: data });
                //$(e).remove();
            })
            .fail(function () {
                $(".spic").attr("src", "");
                alert("فشل إرسال الصوره تأكد ان حجم الصوره مناسب");
            });
    });
}

function sendfile(id, onsend) {
    pickedfile = null;
    var e = $("<div></div>").first();
    e.append(
        "<input type='file'  accept='image/*, video/*, audio/*' style='display:none;'/>",
    );
    e.children("input").trigger("click");

    var xx;

    $(e)
        .children("input")
        .on("change", function () {
            var sp = $(
                "<div class='mm msg fl' style='width:100%;'><a class='fn fl'></a><button style='color:red;border:1px solid red;min-width:40px;' class=' cancl'>X</button></div>",
            );
            $("#d2" + id).append(sp);
            $(sp)
                .find(".cancl")
                .click(function () {
                    $(sp).remove();
                    xx.abort();
                });
            xx = $.ajax({
                xhr: function () {
                    var xhr = new window.XMLHttpRequest();
                    //Upload progress
                    xhr.upload.addEventListener(
                        "progress",
                        function (evt) {
                            if (evt.lengthComputable) {
                                var percentComplete = evt.loaded / evt.total;
                                $(sp.find(".fn")).text(
                                    "%" +
                                        parseInt(percentComplete * 100) +
                                        " | " +
                                        $(e)
                                            .children("input")
                                            .val()
                                            .split("\\")
                                            .pop(),
                                );
                            }
                        },
                        false,
                    );

                    return xhr;
                },
                timeout: 0,
                url:
                    "/upload?secid=u&fn=" +
                    $(e).children("input").val().split(".").pop() +
                    "&t=" +
                    new Date().getTime(),
                type: "POST",
                data: $(e).children("input").prop("files")[0],
                cache: false,
                headers: { "cache-control": "no-cache" },
                processData: false,
                contentType: false,
            })
                .done(function (data) {
                    pickedfile = data;

                    if (onsend != null) {
                        onsend(data);
                    } else {
                        send("file", { pm: id, link: data });
                    }

                    $(e).remove();
                    $(sp).remove();
                })
                .fail(function () {
                    $(sp).remove();
                });
        });
}

function encode(str) {
    return encodeURIComponent(str).split("'").join("%27");
}

function decode(str) {
    return decodeURIComponent(str);
}

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
        if (v == "null" || v == null) {
            v = "";
        }
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

function isIE9OrBelow() {
    return (
        /MSIE\s/.test(navigator.userAgent) &&
        parseFloat(navigator.appVersion.split("MSIE")[1]) < 10
    );
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

cmsg = null;

function sendpic_() {
    if (cmsg != null) {
        return;
    }
    var o = { cmd: "upload_i", busy: false, url: "pic?secid=u&fn=%" };
    $(".spic").attr("src", "images/ajax-loader.gif");
    o.done = function (link) {
        send("setpic", { pic: link });
        cmsg = null;
        $(".spic").attr("src", "");
        // finish
    };
    o.progress = function (i) {};
    o.error = function () {
        alert("error");
        cmsg = null;
        $(".spic").attr("src", "");
        alert("فشل إرسال الصوره تأكد ان حجم الصوره مناسب");
    };
    cmsg = o;
}

function sendfile_(id, onsend) {
    if (cmsg != null) {
        return;
    }
    var o = { cmd: "upload_iv", busy: false, url: "upload?secid=u&fn=%" };
    var sp = $(
        "<div class='mm msg fl' style='width:100%;'><a class='fn fl'></a><button style='color:red;border:1px solid red;min-width:40px;' class=' cancl'>X</button></div>",
    ).first();
    $("#d2" + id).append(sp);
    $(sp)
        .find(".cancl")
        .click(function () {
            $(sp).remove();
        });
    o.id = id;
    o.sp = sp;
    o.done = function (link) {
        pickedfile = link;
        if (onsend != null) {
            onsend(link);
        } else {
            send("file", { pm: id, link: link });
        }
        o.sp.remove();
        cmsg = null;
        // finish
    };
    o.progress = function (i) {
        o.sp.find(".fn").text("%" + i + " " + o.fn);
    };
    o.error = function () {
        cmsg = null;
        o.sp.remove();
        alert("فشل إرسال الملف .. حاول مره أخرى .");
    };
    cmsg = o;
}
if (top != self) {
    location.href = "https://google.com/?q=hahaha";
}
uf = {
    kw: "الكويت",
    et: "إثيوبيا",
    az: "أذربيجان",
    am: "أرمينيا",
    aw: "أروبا",
    er: "إريتريا",
    es: "أسبانيا",
    au: "أستراليا",
    ee: "إستونيا",
    il: "إسرائيل",
    af: "أفغانستان",
    ec: "إكوادور",
    ar: "الأرجنتين",
    jo: "الأردن",
    ae: "الإمارات العربية المتحدة",
    al: "ألبانيا",
    bh: "مملكة البحرين",
    br: "البرازيل",
    pt: "البرتغال",
    ba: "البوسنة والهرسك",
    ga: "الجابون",
    dz: "الجزائر",
    dk: "الدانمارك",
    cv: "الرأس الأخضر",
    ps: "فلسطين",
    sv: "السلفادور",
    sn: "السنغال",
    sd: "السودان",
    se: "السويد",
    so: "الصومال",
    cn: "الصين",
    iq: "العراق",
    ph: "الفلبين",
    cm: "الكاميرون",
    cg: "الكونغو",
    cd: "جمهورية الكونغو الديمقراطية",
    de: "ألمانيا",
    hu: "المجر",
    ma: "المغرب",
    mx: "المكسيك",
    sa: "المملكة العربية السعودية",
    uk: "المملكة المتحدة",
    gb: "المملكة المتحدة",
    no: "النرويج",
    at: "النمسا",
    ne: "النيجر",
    in: "الهند",
    us: "الولايات المتحدة",
    jp: "اليابان",
    ye: "اليمن",
    gr: "اليونان",
    ag: "أنتيغوا وبربودا",
    id: "إندونيسيا",
    ao: "أنغولا",
    ai: "أنغويلا",
    uy: "أوروجواي",
    uz: "أوزبكستان",
    ug: "أوغندا",
    ua: "أوكرانيا",
    ir: "إيران",
    ie: "أيرلندا",
    is: "أيسلندا",
    it: "إيطاليا",
    pg: "بابوا-غينيا الجديدة",
    py: "باراجواي",
    bb: "باربادوس",
    pk: "باكستان",
    pw: "بالاو",
    bm: "برمودا",
    bn: "بروناي",
    be: "بلجيكا",
    bg: "بلغاريا",
    bd: "بنجلاديش",
    pa: "بنما",
    bj: "بنين",
    bt: "بوتان",
    bw: "بوتسوانا",
    pr: "بورتو ريكو",
    bf: "بوركينا فاسو",
    bi: "بوروندي",
    pl: "بولندا",
    bo: "بوليفيا",
    pf: "بولينزيا الفرنسية",
    pe: "بيرو",
    by: "بيلاروس",
    bz: "بيليز",
    th: "تايلاند",
    tw: "تايوان",
    tm: "تركمانستان",
    tr: "تركيا",
    tt: "ترينيداد وتوباجو",
    td: "تشاد",
    cl: "تشيلي",
    tz: "تنزانيا",
    tg: "توجو",
    tv: "توفالو",
    tk: "توكيلاو",
    to: "تونجا",
    tn: "تونس",
    tp: "تيمور الشرقية",
    jm: "جامايكا",
    gm: "جامبيا",
    gl: "جرينلاند",
    pn: "جزر البتكارين",
    bs: "جزر البهاما",
    km: "جزر القمر",
    cf: "أفريقيا الوسطى",
    cz: "جمهورية التشيك",
    do: "جمهورية الدومينيكان",
    za: "جنوب أفريقيا",
    gt: "جواتيمالا",
    gp: "جواديلوب",
    gu: "جوام",
    ge: "جورجيا",
    gs: "جورجيا الجنوبية",
    gy: "جيانا",
    gf: "جيانا الفرنسية",
    dj: "جيبوتي",
    je: "جيرسي",
    gg: "جيرنزي",
    va: "دولة الفاتيكان",
    dm: "دومينيكا",
    rw: "رواندا",
    ru: "روسيا",
    ro: "رومانيا",
    re: "ريونيون",
    zm: "زامبيا",
    zw: "زيمبابوي",
    ws: "ساموا",
    sm: "سان مارينو",
    sk: "سلوفاكيا",
    si: "سلوفينيا",
    sg: "سنغافورة",
    sz: "سوازيلاند",
    sy: "سوريا",
    sr: "سورينام",
    ch: "سويسرا",
    sl: "سيراليون",
    lk: "سيريلانكا",
    sc: "سيشل",
    rs: "صربيا",
    tj: "طاجيكستان",
    om: "عمان",
    gh: "غانا",
    gd: "غرينادا",
    gn: "غينيا",
    gq: "غينيا الاستوائية",
    gw: "غينيا بيساو",
    vu: "فانواتو",
    fr: "فرنسا",
    ve: "فنزويلا",
    fi: "فنلندا",
    vn: "فيتنام",
    cy: "قبرص",
    qa: "قطر",
    kg: "قيرقيزستان",
    kz: "كازاخستان",
    nc: "كاليدونيا الجديدة",
    kh: "كامبوديا",
    hr: "كرواتيا",
    ca: "كندا",
    cu: "كوبا",
    ci: "ساحل العاج",
    kr: "كوريا",
    kp: "كوريا الشمالية",
    cr: "كوستاريكا",
    co: "كولومبيا",
    ki: "كيريباتي",
    ke: "كينيا",
    lv: "لاتفيا",
    la: "لاوس",
    lb: "لبنان",
    li: "لشتنشتاين",
    lu: "لوكسمبورج",
    ly: "ليبيا",
    lr: "ليبيريا",
    lt: "ليتوانيا",
    ls: "ليسوتو",
    mq: "مارتينيك",
    mo: "ماكاو",
    fm: "ماكرونيزيا",
    mw: "مالاوي",
    mt: "مالطا",
    ml: "مالي",
    my: "ماليزيا",
    yt: "مايوت",
    mg: "مدغشقر",
    eg: "مصر",
    mk: "مقدونيا، يوغوسلافيا",
    mn: "منغوليا",
    mr: "موريتانيا",
    mu: "موريشيوس",
    mz: "موزمبيق",
    md: "مولدوفا",
    mc: "موناكو",
    ms: "مونتسيرات",
    me: "مونتينيغرو",
    mm: "ميانمار",
    na: "ناميبيا",
    nr: "ناورو",
    np: "نيبال",
    ng: "نيجيريا",
    ni: "نيكاراجوا",
    nu: "نيوا",
    nz: "نيوزيلندا",
    ht: "هايتي",
    hn: "هندوراس",
    nl: "هولندا",
    hk: "هونغ كونغ",
    wf: "واليس وفوتونا",
};
mime = {
    mov: "video/mov",
    aac: "audio/aac",
    m4a: "audio/m4a",
    avi: "video/x-msvideo",
    gif: "image/gif",
    ico: "image/x-icon",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    mid: "audio/midi",
    midi: "audio/midi",
    mp2: "audio/mpeg",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    mpa: "video/mpeg",
    mpe: "video/mpeg",
    mpeg: "video/mpeg",
    oga: "audio/ogg",
    ogv: "video/ogg",
    png: "image/png",
    svg: "image/svg+xml",
    tif: "image/tiff",
    tiff: "image/tiff",
    wav: "audio/x-wav",
    weba: "audio/webm",
    webm: "video/webm",
    webp: "image/webp",
    "3gp": "video/3gpp",
    "3gp2": "video/3gpp2",
};
function md5(data) {
    var e = data.toString();
    if (Array.isArray(data)) {
        e = data.join(";");
    }
    function h(a, b) {
        var c, d, e, f, g;
        e = a & 2147483648;
        f = b & 2147483648;
        c = a & 1073741824;
        d = b & 1073741824;
        g = (a & 1073741823) + (b & 1073741823);
        return c & d
            ? g ^ 2147483648 ^ e ^ f
            : c | d
              ? g & 1073741824
                  ? g ^ 3221225472 ^ e ^ f
                  : g ^ 1073741824 ^ e ^ f
              : g ^ e ^ f;
    }

    function k(a, b, c, d, e, f, g) {
        a = h(a, h(h((b & c) | (~b & d), e), g));
        return h((a << f) | (a >>> (32 - f)), b);
    }

    function l(a, b, c, d, e, f, g) {
        a = h(a, h(h((b & d) | (c & ~d), e), g));
        return h((a << f) | (a >>> (32 - f)), b);
    }

    function m(a, b, d, c, e, f, g) {
        a = h(a, h(h(b ^ d ^ c, e), g));
        return h((a << f) | (a >>> (32 - f)), b);
    }

    function n(a, b, d, c, e, f, g) {
        a = h(a, h(h(d ^ (b | ~c), e), g));
        return h((a << f) | (a >>> (32 - f)), b);
    }

    function p(a) {
        var b = "",
            d = "",
            c;
        for (c = 0; 3 >= c; c++)
            ((d = (a >>> (8 * c)) & 255),
                (d = "0" + d.toString(16)),
                (b += d.substr(d.length - 2, 2)));
        return b;
    }
    var f = [],
        q,
        r,
        s,
        t,
        a,
        b,
        c,
        d;
    e = (function (a) {
        a = a.replace(/\r\n/g, "\n");
        for (var b = "", d = 0; d < a.length; d++) {
            var c = a.charCodeAt(d);
            128 > c
                ? (b += String.fromCharCode(c))
                : (127 < c && 2048 > c
                      ? (b += String.fromCharCode((c >> 6) | 192))
                      : ((b += String.fromCharCode((c >> 12) | 224)),
                        (b += String.fromCharCode(((c >> 6) & 63) | 128))),
                  (b += String.fromCharCode((c & 63) | 128)));
        }
        return b;
    })(e);
    f = (function (b) {
        var a,
            c = b.length;
        a = c + 8;
        for (
            var d = 16 * ((a - (a % 64)) / 64 + 1),
                e = Array(d - 1),
                f = 0,
                g = 0;
            g < c;

        )
            ((a = (g - (g % 4)) / 4),
                (f = (g % 4) * 8),
                (e[a] |= b.charCodeAt(g) << f),
                g++);
        a = (g - (g % 4)) / 4;
        e[a] |= 128 << ((g % 4) * 8);
        e[d - 2] = c << 3;
        e[d - 1] = c >>> 29;
        return e;
    })(e);
    a = 1732584193;
    b = 4023233417;
    c = 2562383102;
    d = 271733878;
    for (e = 0; e < f.length; e += 16)
        ((q = a),
            (r = b),
            (s = c),
            (t = d),
            (a = k(a, b, c, d, f[e + 0], 7, 3614090360)),
            (d = k(d, a, b, c, f[e + 1], 12, 3905402710)),
            (c = k(c, d, a, b, f[e + 2], 17, 606105819)),
            (b = k(b, c, d, a, f[e + 3], 22, 3250441966)),
            (a = k(a, b, c, d, f[e + 4], 7, 4118548399)),
            (d = k(d, a, b, c, f[e + 5], 12, 1200080426)),
            (c = k(c, d, a, b, f[e + 6], 17, 2821735955)),
            (b = k(b, c, d, a, f[e + 7], 22, 4249261313)),
            (a = k(a, b, c, d, f[e + 8], 7, 1770035416)),
            (d = k(d, a, b, c, f[e + 9], 12, 2336552879)),
            (c = k(c, d, a, b, f[e + 10], 17, 4294925233)),
            (b = k(b, c, d, a, f[e + 11], 22, 2304563134)),
            (a = k(a, b, c, d, f[e + 12], 7, 1804603682)),
            (d = k(d, a, b, c, f[e + 13], 12, 4254626195)),
            (c = k(c, d, a, b, f[e + 14], 17, 2792965006)),
            (b = k(b, c, d, a, f[e + 15], 22, 1236535329)),
            (a = l(a, b, c, d, f[e + 1], 5, 4129170786)),
            (d = l(d, a, b, c, f[e + 6], 9, 3225465664)),
            (c = l(c, d, a, b, f[e + 11], 14, 643717713)),
            (b = l(b, c, d, a, f[e + 0], 20, 3921069994)),
            (a = l(a, b, c, d, f[e + 5], 5, 3593408605)),
            (d = l(d, a, b, c, f[e + 10], 9, 38016083)),
            (c = l(c, d, a, b, f[e + 15], 14, 3634488961)),
            (b = l(b, c, d, a, f[e + 4], 20, 3889429448)),
            (a = l(a, b, c, d, f[e + 9], 5, 568446438)),
            (d = l(d, a, b, c, f[e + 14], 9, 3275163606)),
            (c = l(c, d, a, b, f[e + 3], 14, 4107603335)),
            (b = l(b, c, d, a, f[e + 8], 20, 1163531501)),
            (a = l(a, b, c, d, f[e + 13], 5, 2850285829)),
            (d = l(d, a, b, c, f[e + 2], 9, 4243563512)),
            (c = l(c, d, a, b, f[e + 7], 14, 1735328473)),
            (b = l(b, c, d, a, f[e + 12], 20, 2368359562)),
            (a = m(a, b, c, d, f[e + 5], 4, 4294588738)),
            (d = m(d, a, b, c, f[e + 8], 11, 2272392833)),
            (c = m(c, d, a, b, f[e + 11], 16, 1839030562)),
            (b = m(b, c, d, a, f[e + 14], 23, 4259657740)),
            (a = m(a, b, c, d, f[e + 1], 4, 2763975236)),
            (d = m(d, a, b, c, f[e + 4], 11, 1272893353)),
            (c = m(c, d, a, b, f[e + 7], 16, 4139469664)),
            (b = m(b, c, d, a, f[e + 10], 23, 3200236656)),
            (a = m(a, b, c, d, f[e + 13], 4, 681279174)),
            (d = m(d, a, b, c, f[e + 0], 11, 3936430074)),
            (c = m(c, d, a, b, f[e + 3], 16, 3572445317)),
            (b = m(b, c, d, a, f[e + 6], 23, 76029189)),
            (a = m(a, b, c, d, f[e + 9], 4, 3654602809)),
            (d = m(d, a, b, c, f[e + 12], 11, 3873151461)),
            (c = m(c, d, a, b, f[e + 15], 16, 530742520)),
            (b = m(b, c, d, a, f[e + 2], 23, 3299628645)),
            (a = n(a, b, c, d, f[e + 0], 6, 4096336452)),
            (d = n(d, a, b, c, f[e + 7], 10, 1126891415)),
            (c = n(c, d, a, b, f[e + 14], 15, 2878612391)),
            (b = n(b, c, d, a, f[e + 5], 21, 4237533241)),
            (a = n(a, b, c, d, f[e + 12], 6, 1700485571)),
            (d = n(d, a, b, c, f[e + 3], 10, 2399980690)),
            (c = n(c, d, a, b, f[e + 10], 15, 4293915773)),
            (b = n(b, c, d, a, f[e + 1], 21, 2240044497)),
            (a = n(a, b, c, d, f[e + 8], 6, 1873313359)),
            (d = n(d, a, b, c, f[e + 15], 10, 4264355552)),
            (c = n(c, d, a, b, f[e + 6], 15, 2734768916)),
            (b = n(b, c, d, a, f[e + 13], 21, 1309151649)),
            (a = n(a, b, c, d, f[e + 4], 6, 4149444226)),
            (d = n(d, a, b, c, f[e + 11], 10, 3174756917)),
            (c = n(c, d, a, b, f[e + 2], 15, 718787259)),
            (b = n(b, c, d, a, f[e + 9], 21, 3951481745)),
            (a = h(a, q)),
            (b = h(b, r)),
            (c = h(c, s)),
            (d = h(d, t)));
    return (p(a) + p(b) + p(c) + p(d)).toLowerCase();
}
