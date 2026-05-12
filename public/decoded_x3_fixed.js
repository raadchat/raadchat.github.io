/**
 * ===================================================
 * تم فك تشفير هذا الملف بالكامل
 * Deobfuscated Chat Application - JavaScript Client
 * ===================================================
 *
 * المتغيرات العامة (Global Variables):
 *   myroom      - رقم الغرفة الحالية
 *   myid        - معرف المستخدم الحالي
 *   socket      - اتصال Socket.IO
 *   peersMap    - خريطة اتصالات WebRTC
 *   usersMap    - بيانات المستخدمين
 *   mic[]       - قائمة المايكات النشطة
 *   debugMode   - وضع التصحيح
 *   authKey     - مفتاح المصادقة
 *   roomToken   - رمز الغرفة
 *
 * الأوامر (Commands):
 *   online/online+/online- - قائمة المتصلين
 *   msg         - رسالة دردشة
 *   power       - صلاحيات المستخدم
 *   ban/kick    - حظر/طرد
 *   mic         - طلب مايك
 *   p2          - إشارات WebRTC
 *   call        - مكالمة صوتية
 *   login       - تسجيل الدخول
 *   settings    - إعدادات الغرفة
 *
 * TURN Servers:
 *   93.115.24.143:443  (jawalhost)
 *   openrelay.metered.ca:443
 */

var myroom=null,ncolors=[],nopm=false,nonot=false,bcc=0,bct=100,msgt=100,cff='06',replyId=null,rcach={
},mic=[],minL=0,minR=0,playing=null,myid=null,deepSearch=4,uhSearch=true,bitrate=24,user_pic=null,room_pic=null,bcdown=false,showpics=100,turn_server=1;
((()=>{
  var AudioCtxClass=window.AudioContext||window.webkitAudioContext;
  function getMedia(p1,p2,p3){
    try{
if(debugMode){
  if("LbkBa"!=="yNHic")debugLog(["getting Media",navigator.getUserMedia==null,navigator.webkitGetUserMedia==null,navigator.mozGetUserMedia==null,navigator.mediaDevices==null]);
  else{
    var $opt=$create("<option></option>");
    $opt.attr("value",v427[v428].name),$opt.text('['+(v429[v430].rank||0)+'] '+v431[v432].name),v433(v434).append($opt);
  }
}var getUserMediaFn=navigator.getUserMedia||navigator.webkitGetUserMedia||navigator.mozGetUserMedia;
if(getUserMediaFn!=null)getUserMediaFn.call(navigator,p1,p2||function(){
},p3||function(){
});
else{
  if(navigator.mediaDevices!=null&&navigator.mediaDevices.getUserMedia!=null){
    return navigator.mediaDevices.getUserMedia(p1).then(p2).catch(p3||function(){
});
}
}
}catch(err){
debugMode&&debugLog(["getmedia",err.message,err.stack]);
}
}function debugLog(parts){
$("#d2").append(parts.join("<br>--")+"<br>");
}var debugMode=false,isMobile=false,peersMap={
},localStream,audioContext,audioDestination;
function startPeer(peerData){
  if(peerData==null)return;
  if(peerData.id==myid||peerData.id==peerData.lid)return;
  peersMap['_'+peerData.id]!=null&&(peersMap['_'+peerData.id].on=null,peersMap['_'+peerData.id].destroy(),delete peersMap['_'+peerData.id]);
  peersMap['_'+peerData.id]=new Peer(myroom,true,localStream);
  peersMap['_'+peerData.id].uid=peerData.id;
  emit('p2',{
    't':"start",'id':peerData.id
  }),peersMap['_'+peerData.id].on("signal",function(signal){
  emit('p2',{
    't':"signal",'id':peerData.id,'dir':1,'data':signal
  });
}),peersMap['_'+peerData.id].on("error",function(p4){
emit('p2',{
  't':'x','dir':1,'id':peerData.id
}),peersMap['_'+peerData.id].destroy();
delete peersMap['_'+peerData.id],setTimeout(function(){
  var peerConn=v435(peerData.id);
  peerConn!=null&&peerConn.roomid==myroom&&mic.indexOf(myid)!=-1&&startPeer(peerConn);
},0x7d0);
});
}function Peer(p5,p6,p7,p8){
this.room=p5,this.iscall=p8,this.ready=false;
var var436=this;
this.stream=p7,this.audio=document.createElement("AUDIO"),this.audio.setAttribute("autoplay","autoplay"),this.audioCtx=new AudioCtxClass();
this.ls=[],this.rs=[];
var var437=SimplePeer;
this.peer=new var437({
  'initiator':p6==true,'stream':p7,'config':{
    'iceTransportPolicy':turn_server==4||turn_server==5?"relay":undefined,'iceServers':[{
      'urls':"stun:stun.l.google.com:19302"
    },{
    'urls':"turn:93.115.24.143:443?transport=tcp",'credential':"jawalhost",'username':"jawalhost"
  },{
  'urls':"turn:93.115.24.143:443?transport=udp",'credential':"jawalhost",'username':"jawalhost"
},{
'urls':"turn:openrelay.metered.ca:443?transport=tcp",'username':"openrelayproject",'credential':"openrelayproject"
},{
'urls':"turn:openrelay.metered.ca:443",'username':"openrelayproject",'credential':"openrelayproject"
}].filter(function(p9){
switch(turn_server){
  case 1:return true;
  case 2:case 4:return p9.urls.indexOf("tcp")!=-1||p9.urls.indexOf("stun")!=-1;
  case 3:case 5:return p9.urls.indexOf('udp')!=-1||p9.urls.indexOf("stun")!=-1;
  case 6:return p9.urls.indexOf("openrelay")!=-1||p9.urls.indexOf("stun")!=-1;
}return true;
})
}
});
var peerCallbacks={
};
this.on=function(p10,p11){
  peerCallbacks[p10]=p11;
},this.alvl=0,this.peer.on("stream",function(p12){
if("srcObject"in var436.audio){(v438("#cp li").hide().find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']").parent().show(),v439.ban&&v440("#cp li").find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show(),v441.setpower&&v442("#cp li").find("a[href='#powers'],a[href='#subs']").parent().show(),v443.owner&&v444("#cp li").show());
}else{
  if("YnYDc"!=="ManBR")var436.audio.src=window.URL.createObjectURL(p12);
  else return;
};
peerCallbacks.stream&&peerCallbacks.stream(p12);
var436.iscall!=true&&v445&&var436.audio.pause();
debugMode&&debugLog("recivedStream"),v446(var436.audioCtx,p12,function(p13){
  var436.alvl=p13;
});
});
var arr447=[],pingInterval=setInterval(()=>{
  if(peerCallbacks.signal&&arr447.length){
    var var448=arr447;
    arr447=[],peerCallbacks.signal(var448);
  }
},0x190);
this.peer.on("signal",function(p14){
  debugMode&&(debugLog("signal"));
  if(p14.sdp){
    if("FkjPu"==="FkjPu")p14.sdp=p14.sdp.replace("useinbandfec=1","useinbandfec"+"=1;\n     maxaveragebitrate="+Math.max(0x1f40,isNaN(bitrate)?0x5dc0:bitrate*0x3e8)+(";maxplaybackrate=1000"));
    else return v451.localeCompare(v452);
  }arr447.push(p14);
}),this.peer.on("connect",function(){
debugMode&&(debugLog("connected")),peerCallbacks.connect&&peerCallbacks.connect();
}),this.peer.on("error",function(peerError){
if(debugMode){
  if("GnSeI"==="GnSeI")debugLog(["pERR",JSON.stringify(peerError),peerError.code]);
  else{
    var var454=v455("<button class=' btn btn-primary' style='display:block;
    width:100%;
    padding: 2px 4px;
    margin-top:1px;
    '></button>").text(v456[v457]).on("click",function(){
      v458(v459(this).text());
    });
  v460.append(var454);
}
}clearInterval(pingInterval);
peerCallbacks.error&&peerCallbacks.error(peerError);
});
return this.peer.on("end",function(peerEnd){
  debugMode&&debugLog(["pEnd",JSON.stringify(peerEnd),peerEnd.code]);
  clearInterval(pingInterval);
  peerCallbacks.error&&peerCallbacks.error(peerEnd);
}),this.destroy=function(p15){
clearInterval(pingInterval);
try{
  if("IapGU"==="DvuYI"){
    if(v461)return'x';
    try{
      var var462=v463.createElement("canvas");
      var462.style.display="none";
      var v464,v465;
      return v464=var462.getContext("webgl")||var462.getContext("experimental-webgl"),v465=v464.getExtension("WEBGL_debug_renderer_info"),var462.remove(),v464.getParameter(v465["UNMASKED_RENDERER_WEBGL"]);
    }catch(v466){
    return'x';
  }
}else var436.audio.remove(),var436.peer.destroy();
}catch(v467){
}try{
var436.audioCtx.close();
}catch(v468){
}if(p15)try{
this.stream.getTracks().forEach(function(p16){
  p16.stop();
});
}catch(v469){
}
},var436;
}var var470=null,v471=[],v472=false,socket=null,isConnected=false,v473=false,v474=[],v475={
},v476=[],v477=false,v478=null,v479=[],v480=[];
var usersMap={
},roomsList=[],colorsList=[],roomToken='',currentPower=[],v481={
},v482=1,authToken=null,isLoggedIn=false,v483,v484=null,v485=0,v486={
},v487=true,v445=false,v488={
},socketDisabled=v489('cp'),v490={
'ico+':true,'ico-':true,'powers':true,'sico':true,'power':true,'rlist':true,'r+':true,'r-':true,'r^':true,'emos':true,'dro3':true
};
window.cpi=new Date().getTime().toString(36);
window.addEventListener("message",function(p17){
  var var491=p17.data,v492=p17.source;
  if(v492==null||v492.cpi==null)return;
  if(socketDisabled==null&&var491[0]=="con"){
    if(var491[1]!=myid){
      v492.postMessage(["close",{
      }]);
    return;
  }v488[v492.cpi]=v492,v492.postMessage(["con",[v474,v476.map(function(p18){
  var var493=Object.assign({
  },p18);
return var493.ht=null,var493;
}),v479,v475,v480,colorsList,roomsList,myid]]);
return;
}if(socketDisabled&&location.pathname=="/cp"){
if(var491[0]=='con'){
  handleCmd("login",{
    'msg':'ok','id':var491[1][7]
  }),window.onbeforeunload=null,v480=var491[1][4],colorsList=var491[1][5],roomsList=var491[1][6],handleCmd("emos",v480),handleCmd("dro3",colorsList),handleCmd("sico",roomsList),handleCmd("powers",var491[1][2]),handleCmd("rlist",var491[1][1]),handleCmd("ulist",var491[1][0]),handleCmd("power",var491[1][3]);
return;
}handleCmd(var491[0],var491[1]);
}else{
var var494=v488[v492.cpi];
if(var494==null){
  v492.postMessage(["close",{
  }]);
return;
}emit("cpi",[v492.cpi,var491]);
}
}),connectSocket();
function v495(){
  $("#muteall").attr("disabled",true);
  setTimeout(function(){
    $("#muteall").removeAttr("disabled");
  },0x3e8);
if(v445!=true){
  v445=true,$("#muteall").css("background-color",'');
  mic.indexOf(myid)!=-1&&v496(-1);
  for(var v497 in peersMap){
    var var498=peersMap[v497];
    var498!=null&&var498.audio!=null&&var498.audio.pause();
  }
}else{
v445=false,$("#muteall").css("background-color","mediumseagreen");
for(var v497 in peersMap){
  var var498=peersMap[v497];
  var498!=null&&var498.audio!=null&&var498.audio.play();
}
}
}var var499={
'mlikes':true,'bclikes':true,'mreply':false,'bcreply':false,'calls':false
};
navigator['n']={
},v500(document.getElementById('call'));
function v500(p19){
  var var501=0,v502=0,v503=0,v504=0;
  p19.onmousedown=v505,p19.ontouchstart=v505;
  function v505(p20){
    p20=p20||window.event;
    try{
      var var506=(p20.touches||[])[0],v507=(var506||p20).clientX,v508=(var506||p20).clientY;
      v503=v507,v504=v508,document.onmouseup=v509,document.onmousemove=v510,document.ontouchmove=v510,document.ontouchend=v509;
    }catch(v511){
  }return true;
}function v510(p21){
if("cACzg"==="cACzg"){
  p21=p21||window.event;
  try{
    var var512=(p21.touches||[])[0],v513=Math.max(0,(var512||p21).clientX),v514=Math.max(0,(var512||p21).clientY);
    var501=v503-v513,v502=v504-v514,v503=v513,v504=v514,p19.style.top=Math.min(window.innerHeight-p19.clientHeight,Math.max(0,p19.offsetTop-v502))+'px',p19.style.left=Math.min(window.innerWidth-p19.clientWidth,Math.max(0,p19.offsetLeft-var501))+'px';
  }catch(v515){
}return true;
}else{
var var516=v517(v518("مده الإشتراك؟ 0 = دائم",'0')||'0');
v519('cp',{
  'cmd':"setpower",'id':v520,'days':var516,'power':v521[v522]
});
}
}function v509(){
document.onmouseup=null,document.onmousemove=null;
document.ontouchmove=null;
document.ontouchend=null;
}
}function v523(){
emit("logout",{
}),reconnect(0x1f4);
}function v524(p22,p23,p24){
if(p24&&minR&&v435(myid).rep<minR){
  alert("تعليقات الحايط تتطلب "+minR+(" إعجاب")),$(p24||".tboxbc").val('');
  return;
}if(p22){
replyId=null,v478=null,v525('d2bc',function(){
  var inputVal=$(".tboxbc").val();
  $(".tboxbc").val('');
  var var526=v478;
  v478='';
  if((inputVal=="%0A"||inputVal=="%0a"||inputVal==''||inputVal=='\n')&&(var526==''||var526==null))return;
  emit('bc',{
    'msg':inputVal,'link':var526
  });
return;
},true);
return;
}else v478=null;
$(".ppop .reply").parent().remove();
var msgText=$(p24||".tboxbc").val();
$(p24||".tboxbc").val('');
var var527=v478;
v478='';
if((msgText=="%0A"||msgText=='%0a'||msgText==''||msgText=='\n')&&(var527==''||var527==null))return;
emit('bc',{
  'msg':msgText,'link':var527,'bid':replyId!=null&&replyId.indexOf('.bid')!=-1?replyId.replace('.bid',''):undefined
}),replyId!=null&&(replyId=null);
}var isMobileKeyboard=false;
function v528(){
  var referrer=document.referrer||'';
  if(referrer.indexOf("http://"+location.hostname)==0)return'';
  return referrer.indexOf("://")!=-1&&(referrer=referrer.replace(/(.*?)\:\/\//g,'').split('/')[0]),referrer;
}function v529(){
var530&&$("#dpnl:visible").find("#users.active,#rooms.active").length>0&&(v531(),var530=false,v487=true);
$("#dpnl:visible").find("#wall.active").length>0&&$("#wall").find(".lazy").each(function(p25,p26){
  p26=$(p26);
  p26.removeClass("lazy"),p26.attr("src",p26.attr("dsrc"));
});
$("div.active img.lazy:visible").each(function(p27,p28){
  p28=$(p28),p28.removeClass("lazy");
  p28.attr("src",p28.attr('dsrc'));
});
if(v487&&$("#dpnl:visible").find("#rooms.active").length){
  v487=false;
  var roomChildren=$("#rooms").children(".room"),sortFn=Array.prototype.sort.bind(roomChildren);
  sortFn(function(p29,p30){
    var var532=parseInt(p29.getAttribute('v')||0),v533=parseInt(p30.getAttribute('v')||0);
    if(var532==v533){
      var532=p29.getAttribute('n')+'',v533=p30.getAttribute('n')+'';
      return var532.length==v533.length?var532.localeCompare(v533):var532.length-v533.length;
      ;
    }return var532<v533?1:-1;
}),$("#rooms").append(roomChildren);
}
}function v534(){
var chatDiv=$("#d2"),chatBcDiv=$("#d2bc")[0],bcMoreBtn=$("#bcmore");
noNotif=true,setInterval(function(){
  if(noNotif||noPopup){
    noNotif=false;
    if(noPopup){
      noPopup=false;
      var var535=document.documentElement.offsetHeight-document.body.offsetHeight;
      var535>10&&(document.documentElement.scrollTop=var535/2),chatDiv.scrollTop(chatDiv[0].scrollHeight);
    }else noPopup=true;
}if(v477==true&&chatBcDiv.scrollTop==0){
if("OxFFr"==="OxFFr")bcMoreBtn.hide(),v477=false;
else{
  v536=v537||v538.event;
  try{
    var var539=(v540.touches||[])[0],v541=(var539||v542).clientX,v543=(var539||v544).clientY;
    v545=v541,v546=v543,v547.onmouseup=v548,v549.onmousemove=v550,v551.ontouchmove=v552,v553.ontouchend=v554;
  }catch(v555){
}return true;
}
}
},200);
}var var556='';
function v557(p31){
  isMobileKeyboard=/ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase());
  $(window).width()>=0x258&&$("meta[name='viewport']").attr("content"," user-scalable=0, width=600");
  $('#u1').val(decodeUri(v558('u1'))),$("#u2").val(decodeUri(v558('u2'))),$("#pass1").val(decodeUri(v558('p1'))),debugMode=v489("debug")=='1',isMobile=v489("noico")=='1';
  isMobile&&(user_pic="pic.png",room_pic="room.png");
  debugMode&&(window.onerror=function(p32,p33,p34){
    $("#d2").append("Error: "+p32+(" Script: ")+p33+(" Line: ")+p34+"<br>");
  });
var var559=v558("zoom");
var559==''&&(var559='1',getCookie("zoom",var559));
isNaN(parseInt(var559))==false&&var559!='1'&&($("#zoom").val(var559).trigger("change"),v560());
var559=v558("bitrate");
var559==''&&(var559='24',getCookie("bitrate",var559));
isNaN(parseInt(var559))==false&&var559!='24'&&$("#turn_bitrate").val(var559).trigger("change");
var559=v558("turn_server");
var559==''&&(var559='1',getCookie("turn_server",var559));
if(isNaN(parseInt(var559))==false&&var559!='1'){
  $("#turn_server").val(var559).trigger("change");
}v558("isl")=="yes"&&$("#tlogins .nav-tabs a[hre"+'f=\x22#'+"l2\"]").click();
if(location.pathname!="/cp"&&socketDisabled||location.pathname=="/cp"&&!socketDisabled){
  location.href='/';
  return;
}if(socketDisabled){
$("#room,#dpnl").remove(),jQuery.ajax({
  'type':"GET",'url':"jscolor/jscolor.js",'dataType':"script",'cache':true
}),jQuery.ajax({
'type':"GET",'url':"jquery.tablesorter.min.js",'dataType':"script",'cache':true
}),v561(),v471=["202020","202070","2020c0","207020","207070","2070c0","20c020","20c070","20c0c0","702020","702070","7020c0","707020","707070","7070c0","70c020","70c070","70c0c0","c02020","c02070","c020c0","c07020","c07070","c070c0","c0c020","c0c070","c0c0c0","FFFFFF"],defcc=[];
var popupHtml=$("<div style='width:260px;\nheight:200px;\nline-height: 0px!important;\n' class='break\"></div>\");\nv471.forEach(function(p35){\n  var arr562=[];\n  arr562.push(v563(p35,30)),arr562.push(v563(p35,15)),arr562.push(p35),arr562.push(v563(p35,-15));\n  arr562.push(v563(p35,-30));\n  arr562.push(v563(p35,-40)),arr562.forEach(function(p36){\n    defcc.push(p36);\n    popupHtml.append(\"<div v="#"+p36+("'style='width:40px;
    height:40px;
    background-color:#")+p36+(";
    display:inline-block;
    '></div>"));
  });
}),popupHtml.append("<div class='border fa fa-ban' v='' style='width:40px;
height:40px;
background-color:;
display:inline-block;
color:red;
'></div>"),window.cldiv=popupHtml[0].outerHTML,$(".cpick").click(function(){
  var $el564=$(popupHtml),v565=this;
  $el564.find("div").off().click(function(){
    ($(v565).css("background-color",this.style["background-color"]),$(v565).css("background-color",$(this).attr('v')).attr('v',$(this).attr('v')))).attr("disabled",true);
  });
v567(v565,$el564).css("left","0px");
;
}),$("#cp li").hide();
if(window.opener==null){
  reconnect();
  return;
}window.opener.postMessage(['con',socketDisabled]),setInterval(()=>{
(window.opener==null||window.opener.myid!=socketDisabled)&&reconnect();
},0x1388);
}v568();
}function v568(){
var var569=v558('pr')||'';
var556=parseInt(window.name)||parseInt(var569)||0;
var556==0&&(var556=new Date().getTime());
window.name=var556+'';
return getCookie('pr',var556+''),new Date().getTime()-var556>0x3e8*60*60*3?var556:0;
}function decodeCmd(p37){
var var570=(p37||'').split('');
var var571=var570.length;
for(var var572=0;
var572<var571;
var572++){
  var570[var572]=String.fromCharCode(p37.charCodeAt(var572)^2),var572+=var572<20?1:var572<200?4:16;
}return var570.join('');
}function emit(p38,p39){
if(socketDisabled){
  if(window.opener==null){
    reconnect();
    return;
  }window.opener.postMessage([p38,p39]);
}else socket.emit("msg",{
'cmd':decodeCmd(p38),'data':p39
});
}var var573=0,showOverlay=false;
function onDisconnect(){
  if(v472)return;
  v560(1);
  var573++;
  if(myid!=null&&authToken!=null&&var573<=6){
    isLoggedIn=true,v574=false,v575=[],$('.ovr').remove();
    $(".ovr").length==0&&(showOverlay=true,$(document.body).append("<div cla"+"ss=\""+"ovr\" sty"+'le=\x22'+"width:100%;
    height:100%;
    z-index:999999;
    position: fixed;
    left: 0px;
    top: 0px;
    background-color: rgba(0, 0, 0, 0.6"+");
    \"><div sty"+"le=\"margin: 25%;
    margin-top:5%;
    border-radius:"+" 4px;\n    padding: 8px;\n    width: 220"+"px;
    \" cla"+'ss=\x22'+" label-warni"+'ng\x22>'+"<button clas"+"s=\"btn btn-danger fr"+"\" style="+"\"\n  "+"          margin-top"+": -6px;\n    margin-right: -6p"+'x;
    \x22 '+"onclick="+"\"$(this).hide();
    window.closex(10"+"0);
    \">[ x ]</button><div>.. يتم إعاده الاتصال</div></div></div>"));
    setTimeout(function(){
      connectSocket();
    },0xbb8);
  return;
}reconnect();
}function connectSocket(){
if(socketDisabled)return;
var transports="WebSocket"in window||"MozWebSocket"in window?["websocket"]:["polling","websocket"];
socket=io('',{
  'reconnection':false,'transports':transports
});
var pingTimer=null;
socket.on("connect",function(){
  if("BVnYe"!=="BVnYe")return v576(v577)+'س';
  else isConnected=true,showOverlay&&$(".ovr div").attr("class","label-info").find("div").text("متصل .. يتم تسجيل الدخول"),showStatus("success","متصل"),myid!=null&&authToken!=null&&isLoggedIn?socket.emit("rc2",{
    'token':roomToken,'n':authToken
  }):emit("online",{
});
});
var authOk=false;
socket.on('msg',function(p40){
  p40.cmd=decodeCmd(p40.cmd);
  p40.cmd=='ok'&&(authOk=true);
  p40.cmd=="nok"&&(authOk=false,authToken=null);
  !isLoggedIn&&authOk&&(authToken=p40['k']);
  ;
  var v578;
  debugMode&&(v578=performance.now());
  p40.cmd=="power"&&Object.freeze(p40.data);
  handleCmd(p40.cmd,p40.data);
  if(debugMode){
    console.log(p40.cmd,performance.now()-v578);
  }
}),socket.on("disconnect",function(p41){
showStatus("danger","غير متصل");
onDisconnect();
});
socket.on("connect_error",function(p42){
  ($(".ovr div").attr("class","label-danger").find("div").text("فشل الاتصال .."),showStatus("danger","غير متصل"),onDisconnect());
}),socket.on("connect_timeout",function(p43){
$(".ovr div").attr("class","label-danger").find("div").text("فشل الاتصال .."),showStatus("danger","غير متصل");
onDisconnect();
});
socket.on("error",function(p44){
  $(".ovr div").attr("class","label-danger").find("div").text("فشل الاتصال .."),showStatus("danger","غير متصل");
  onDisconnect();
});
}function setupMobileKeyboard(){
isMobileKeyboard&&($("textarea").on("focus",function(){
  onFocus(this);
}),$("textarea").on("blur",function(){
onBlur(this);
}),document.addEventListener("focusout",function(p45){
window.scrollTo(0,0);
}));
}function onFocus(p46){
if(isMobileKeyboard==false)return;
var scrollPos=$(p46).position().top-(document.body.scrollHeight-window.innerHeight)-10;
if(scrollPos<document.body.scrollHeight+window.innerHeight){
}$(document.body).scrollTop(scrollPos);
}function onBlur(){
if(isMobileKeyboard==false)return;
$(document.body).scrollTop(0);
}function updateOnlineList(p47,p48){
var onlineListDiv=$("#lonline");
typeof p47=="string"&&p47.indexOf('[')!=-1&&(p47=JSON.parse(p47));
var usersList=p47,$usersHtml=$($("#uhtml").html());
$usersHtml.find(".u-pic").css({
  'width':"56px"
});
var $el581=$usersHtml[0].outerHTML,v582=usersList.length;
if(p48==0){
  v582=null,onlineListDiv.children().remove();
  try{
    if("xUFRi"!=="xUFRi"){
      var var583=v584+'=',v585=v586.cookie.split(';
      ');
      for(var var587=0;
      var587<v585.length;
      var587++){
        var var588=v585[var587];
        while(var588.charAt(0)==' ')var588=var588.substring(1);
        if(var588.indexOf(var583)!=-1)return v589(var588.substring(var583.length,var588.length));
      }return'';
  }else usersList=usersList.slice(-60);
}catch(v590){
}var arr591=[];
for(var var592=0;
var592<usersList.length;
var592++){
  var var593=usersList[var592];
  if(var593['s']==true)continue;
  var593.pic=="pic.png"&&typeof user_pic=="string"&&(var593.pic=user_pic);
  var $el=$($el581);
  $el.addClass(var593.id),$el.find(".u-topic").text(var593.topic).css({
    'background-color':var593.bg,'color':var593.ucol
  }),$el.find(".u-msg").text(var593.msg),$el.find(".u-pic").css("background-image","url("+'\x22'+var593.pic+'\x22)'),$el.find(".ustat").remove(),var593.co=='--'||var593.co==null||var593.co=='A1'||var593.co=='A2'||var593.co=='EU'||var593.co=='T1'?$el.find(".co").attr('src',"flags/--.png"):$el.find(".co").attr("src","flags/"+var593.co+".png"),(var593.ico||'')!=''&&$el.find(".u-ico").attr("src",var593.ico.replace("dro3/dro3/","dro3/").replace("dro3/sico","sico/")),arr591.push($el);
}onlineListDiv.append(arr591);
}else{
if(p48==1){
  var var593=usersList;
  if(var593['s']==true)return;
  var593.pic=="pic.png"&&typeof user_pic=="string"&&(var593.pic=user_pic);
  var $el=$($el581);
  $el.addClass(var593.id),$el.find(".u-topic").text(var593.topic).css({
    'background-color':var593.bg,'color':var593.ucol
  }),$el.find(".u-msg").text(var593.msg),$el.find(".u-pic").css("background-image","url("+'\x22'+var593.pic+'\x22)'),$el.find(".ustat").remove(),var593.co=='--'||var593.co==null||var593.co=='A1'||var593.co=='A2'||var593.co=='EU'||var593.co=='T1'?$el.find(".co").attr("src","flags/--.png"):$el.find('.co').attr("src","flags/"+var593.co+".png"),(var593.ico||'')!=''&&$el.find(".u-ico").attr("src",var593.ico.replace("dro3/dro3/","dro3/").replace("dro3/sico","sico/")),onlineListDiv.prepend($el),v582=(parseInt($("#s1").text())||0)+1;
}else $("#lonline ."+usersList).remove(),v582=(parseInt($("#s1").text())||0)-1;
}v582!=null&&$('#s1').text(v582);
}function v594(p49){
p49=$(p49);
var var595={
};
return $.each(p49.find("input"),function(p50,p51){
  switch($(p51).attr('type')){
    case "text":var595[$(p51).attr("name")]=$(p51).val().replace(/\"/g,'');
    break;
    case "checkbox":var595[$(p51).attr("name")]=$(p51).prop("checked");
    break;
    case"number":var595[$(p51).attr("name")]=parseInt($(p51).val(),10);
    break;
  }
}),var595;
}var msgCount=0,noPopup=false,noNotif=false;
function encodeMsg(p52){
  return encodeURIComponent(p52).split(''').join("%27");
}function decodeUri(p53){
return decodeURIComponent(p53);
}function hasStorage(){
return typeof Storage!=="undefined";
}function getCookie(p54,p55){
if(hasStorage()){
  if("wLBhq"==="wLBhq")try{
    localStorage.setItem(p54,p55);
  }catch(v596){
  v597(p54,p55);
}else return v598;
}else v597(p54,p55);
}function v558(p56){
if(hasStorage()){
  var var599='';
  try{
    var599=localStorage.getItem(p56);
  }catch(v600){
  return v601(p56);
};
return(var599=='null'||var599==null)&&(var599=''),var599;
}else return v601(p56);
}function v597(p57,p58,p59){
var var602=new Date();
var602.setTime(var602.getTime()+6*24*60*60*0x3e8);
var var603="expires="+var602.toUTCString();
document.cookie=p57+'='+encodeMsg(p58)+';
 '+var603+(";
domain=")+window.location.hostname+(";
path=/");
;
}function v601(p60){
var cookieParts=p60+'=',v604=document.cookie.split(';
');
for(var var605=0;
var605<v604.length;
var605++){
  var var606=v604[var605];
  while(var606.charAt(0)==' ')var606=var606.substring(1);
  if(var606.indexOf(cookieParts)!=-1)return decodeUri(var606.substring(cookieParts.length,var606.length));
}return'';
}function v560(p61){
noNotif=true;
}function v607(){
var var608=myroom?v609(myroom):null;
var var610=var608&&(var608.ops&&var608.ops.indexOf(v435(myid).lid)!=-1);
for(var var611=0;
var611<5;
var611++){
  if("HqySU"==="mGlYQ")return true;
  else{
    var var612=mic[var611],v613=false,v614,v615=$("#mic"+var611);
    typeof var612=="string"&&(v614=v435(var612),v615.length&&v614!=null&&(v613=true)),var612!=myid&&v615.off().attr("onclick",''),v615.attr("uid",var612||''),v613?(v615.find('.u').show(),v615.css("background-image","url("+v614.pic+')'),v615.find("img")[0].src=v616(v614),v615.find("span").text(v614.topic),var612==myid?v615.off().attr("onclick","tmic(-1);"):v615.off().click(function(){
      var var617=this,v618=parseInt($(this).attr('i')),v619=mic[v618];
      setTimeout(function(){
        {
          var var620=["عرض الملف"];
          (v475.mic||var610)&&((var620.push("سحب المايك"),v619==0?var620.push("تفعيل المايك"):var620.push("قفل المايك"))),var620.length==1?v624(v619):showMenu(var617,var620,function(p62){
            switch(p62){
              case "سحب المايك":emit("uml",v619);
              break;
              case "قفل المايك":emit("micstat",{
                'i':v618,'v':false
              });
            break;
            case "تفعيل المايك":emit("micstat",{
              'i':v618,'v':true
            });
          break;
          case "عرض الملف":v624(v619);
          break;
        }
    });
}
},10);
})):(v615.find('.u').hide(),v615.css("background-image","url(imgs/mic.png)"),var612==0?v615.show().text(v627.likes||''):v615.css({
  'background-color':"grey",'outline':''
}):v615.css({
'background-color':'','outline':''
}),v615.find("img").removeAttr("src"),v615.find("span").text(''),v615.off().click(function(){
var var628=this,v629=parseInt($(this).attr('i'));
var var630=mic[v629];
setTimeout(function(){
  var var631=["تحدث"];
  var630==0&&(var631=[]);
  (v475.mic||var610)&&(var630==0?var631.push("تفعيل المايك"):var631.push("قفل المايك"));
  if(var631.length==1&&var630!=0)v496(v629);
  else{
    if("BYyLW"==="ULdCD"){
      v632=null,v633=null,v634('d2bc',function(){
        var var635=v636(".tboxbc").val();
        v637(".tboxbc").val('');
        var var638=v639;
        v640='';
        if((var635=="%0A"||var635=="%0a"||var635==''||var635=='\n')&&(var638==''||var638==null))return;
        v641('bc',{
          'msg':var635,'link':var638
        });
      return;
    },true);
  return;
}else showMenu(var628,var631,function(p63){
switch(p63){
  case "قفل المايك":emit("micstat",{
    'i':v629,'v':false
  });
break;
case "تفعيل المايك":emit("micstat",{
  'i':v629,'v':true
});
break;
case "تحدث":v496(v629);
break;
}
});
}
},10);
}));
}
}
}function v446(p64,p65,p66){
var var642=p64.createScriptProcessor(0x800,1,1);
var642.connect(p64.destination);
var var643=p64["createMediaStreamSource"](p65);
var643.connect(var642);
var642.onaudioprocess=function(p67){
  var var644=p67.inputBuffer.getChannelData(0),v645=var644.length,v646=i=0,v647;
  while(i<v645)v646+=Math.abs(var644[i++]);
  v647=Math.sqrt(v646/v645),p66(v647);
};
}function v496(p68){
if("Epkam"!=="mEpfu")(v445||mic.indexOf(myid)!=-1)&&(p68=-1),p68>-1&&localStream==null?(localStream={
},getMedia({
'video':false,'audio':true
},function(p69){
localStream=p69;
emit("mic",p68);
if(audioContext!=null){
  audioContext.close();
}audioContext=new AudioCtxClass();
v446(audioContext,p69,function(p70){
  audioDestination=p70;
});
},function(){
localStream=null;
})):emit("mic",p68);
else return;
}function insertMention(p71){
p71=$(p71);
var var648=p71.attr("title"),v649=p71.parent().parent().parent().find(".tbox");
v649.val(v649.val()+' ف'+var648+' ').focus().val(v649.val());
}var emojiModal=null;
function showEmojiBox(){
  var var650='';
  for(var var651=0;
  var651<v480.length;
  var651++){
    var650+="<img sty"+"le=\"margin:2"+"px;
    \" cla"+'ss=\x22'+"emoi"+"\" sr"+'c=\x22e'+"mo/"+v480[var651]+("\" title="+'\x22')+(var651+1)+("\" onclic"+"k=\"pickedemo(thi"+"s);
    \">");
  }var $el652=$("<div style='width:300px;
background-color:#fafafa;
' class='break'></div>");
$el652[0].innerHTML=var650,emojiModal=$el652;
$(".emobox").off().click(function(){
  $(this).blur();
  v567(this,emojiModal,false).css("max-height","310px");
});
}window.onunload=function(){
myid&&socketDisabled==null&&emit("logout",{
});
};
var var653=function(p72){
  p72=p72||window.event;
  var var654="هل تريد مغادره الدردشه؟";
  p72&&(p72.returnValue=var654);
  return var654;
},v575=[],v574=false;
function v655(p73){
  var var656=p73.splice(0,1)[0];
  return p73.map(function(p74){
    return Object.fromEntries(p74.map(function(p75,p76){
      return[var656[p76],p75];
    }));
});
}function v657(p77,p78){
var var658=v435(p77);
var $el659=$("#call");
switch(p78){
  case "call":var470!=null&&v657(var470.uid,"hangup");
  if(p77==myid||var499.calls!=true)return;
  var470={
  },getMedia({
  'video':false,'audio':true
},function(p79){
debugMode&&debugLog(["got Media"]);
var470=new Peer(p77,true,p79,true),$el659.find(".u-pic").css("background-image","url("'+var658.pic+'')').parent().off().click(function(){
  v624(p77);
  $("#upro").css("z-index","2002");
}),$el659.find(".u-topic").css("color",var658.ucol).css("background-color",var658.bg||"#fafafa").html(var658.topic),$el659.find(".u-ico").attr('src',v616(var658)||''),$el659.find(".btn-success").hide();
$el659.find(".stat").text("يتم الاتصال .."),$el659.css({
  'top':"55px",'left':"5px"
}),$el659.show(),var470['c']=$el659;
var470.uid=p77;
var470.on("signal",function(p80){
  var470.ready==false?Array.isArray(p80)?var470.ls=var470.ls.concat(p80):var470.ls.push(p80):emit("call",{
    't':"signal",'id':p77,'data':p80
  });
}),var470.on("connect",function(){
$el659.find(".stat").text("متصل");
}),var470.on("error",function(p81){
v657(p77,"hangup");
});
$el659.find(".btn-danger").off().click(function(){
  emit("call",{
    't':"call",'t':'x','id':p77
  });
v657(p77,"hangup");
}),emit("call",{
't':"call",'id':p77
});
},function(p82){
debugMode&&debugLog(["GM ERR",p82,p82.message,p82.stack]);
var470=null;
v657(p77,"hangup");
});
break;
case"answer":if(var470==null){
  v660(v661).css("background-color",this.style["background-color"]),v662(v663).css("background-color",v664(this).attr('v')).attr('v',v665(this).attr('v'));
}var470.ready=true,$el659.find(".stat").text('..'),emit('call',{
't':"signal",'id':p77,'data':var470.ls
}),var470.ls=[];
break;
case "calling":if(var499.calls!=true)return;
if(v666(v435(p77))){
  emit("call",{
    't':"call",'t':'x','id':p77
  });
return;
}if(nopm==true&&$('#c'+p77).length==0){
emit("nopm",{
  'id':p77
}),emit("call",{
't':"call",'t':'x','id':p77
});
return;
}v667(p77,false);
var $el668=$('.w'+p77).find(".d2");
$el668.find(".call .btn").remove();
var $el669=$("<div class='border mm call\" styl\"+"e="width:100%;\npadding:2px;\n'><span style='padding:4px 18px;\nmargin-right:2px;\n' class='fa fa-ph"+"one btn btn-success\">قبول</span><span style="padding:4px 18px;\nmargin-right:2"+'px;
" class='fa fa-phone btn btn-danger'>رفض</span><span class='txt'>يتصل بك</span></div>");
$el668.append($el669),$el668.scrollTop($el668[0].scrollHeight),$el669.find(".btn-danger").off().click(function(){
  $(this).parent().remove(),emit("call",{
    't':"call",'t':'x','id':p77
  });
$el659.css({
  'display':"none"
});
}),$el669.find(".btn-success").off().click(function(){
$(this).parent().remove();
var470!=null&&v657(var470.uid,"hangup");
var470={
},getMedia({
'video':false,'audio':true
},function(p83){
$el659.find(".u-pic").css("background-image","url("'+var658.pic+'')').parent().off().click(function(){
  v624(p77);
  $("#upro").css("z-index","2002");
}),$el659.find(".u-topic").css("color",var658.ucol).css("background-color",var658.bg||"#fafafa").html(var658.topic),$el659.find(".u-ico").attr("src",v616(var658)||''),$el659.find(".btn-success").hide();
$el659.find(".stat").text("يتم الاتصال .."),$el659.css({
  'top':"55px",'left':'5px'
}),$el659.show(),$el659.find(".btn-danger").off().click(function(){
emit("call",{
  't':"call",'t':'x','id':p77
});
v657(p77,"hangup");
});
var470=new Peer(p77,false,p83,true),var470['c']=$el659,var470.uid=p77,var470.ready=true,var470.on("error",function(p84){
  v657(p77,"hangup");
}),var470.on("signal",function(p85){
emit("call",{
  't':"signal",'id':p77,'data':p85
});
}),var470.on("connect",function(){
$el659.find(".stat").text("متصل");
});
emit("call",{
  't':"call",'t':"answer",'id':p77
});
},function(p86){
(var470=null,v657(p77,"hangup"));
});
;
});
break;
case"hangup":var $el668=$('.w'+p77).find(".d2");
$el668.find(".call").remove();
var470!=null&&var470.uid==p77&&($el659.css({
  'display':"none"
}),emit("call",{
't':"call",'t':'x','id':p77
}),var470.on=null,var470.destroy(true),var470=null);
break;
}
}function handleCmd(p87,p88){
var v671;
p88!=null&&p88.cpi&&((v671=p88.cpi,p88=p88.data));
if(v574&&p87!='rc'&&p87!="rcd"&&p87!="close"){
  v575.push([p87,p88]);
  return;
}try{
if(socketDisabled==null){
  if(v671){
    var var678=v488[v671];
    if(var678){
      var678.postMessage([p87,p88]);
      return;
    }
}else{
if(v490[p87]||p87.indexOf('cp_')==0)for(var $el679 in v488){
  var var678=v488[$el679];
  var678.postMessage([p87,p88]);
}
}
}switch(p87){
case'p2':if(typeof SimplePeer=="undefined"){
  setTimeout(function(){
    v680(v681.uid,"hangup");
  },0x7d0);
return;
}var var682=v435(p88.id);
if(var682==null)return;
var var678=peersMap[p88.dir!=1?'_'+p88.id:p88.id];
switch(p88['t']){
  case "start":var678!=null&&(var678.on=null,var678.destroy());
  var678=new Peer(p88.id,false,null),peersMap[p88.id]=var678,var678.uid=p88.id,var678.on("error",function(p89){
    var678.destroy(),delete peersMap[p88.id],emit('p2',{
      't':'x','id':p88.id
    }),setTimeout(function(){
    peersMap[p88.id]==null&&emit('p2',{
      't':"signal",'data':"repeer",'id':p88.id
    });
},0x5dc);
}),var678.on("signal",function(p90){
emit('p2',{
  't':"signal",'id':p88.id,'data':p90
});
});
break;
case "signal":if(p88.data=="repeer"){
  startPeer(var682);
  return;
}if(var678!=null){
var var683=Array.isArray(p88.data)?p88.data:[p88.data];
for(var var684=0;
var684<var683.length;
var684++){
  var678.peer.signal(var683[var684]);
}
}break;
case'x':var678!=null&&(var678.destroy(false),delete peersMap[p88.dir!=1?'_'+p88.id:p88.id]);
break;
}break;
case'call':var var682=v435(p88.id);
if(var682==null)return;
switch(p88['t']){
  case "call":v657(p88.id,"calling");
  break;
  case "reject":v657(p88.id,"reject");
  break;
  case "answer":v657(p88.id,"answer");
  break;
  case "signal":if(var470!=null&&var470.uid==p88.id){
    if("jTJzf"==="pcfIC")v685=v686["createDynamicsCompressor"](),v687("threshold",-50),v688("knee",40),v689("ratio",12),v690("reduction",-20),v691("attack",0),v692("release",0.25);
    else{
      var var683=Array.isArray(p88.data)?p88.data:[p88.data];
      for(var var684=0;
      var684<var683.length;
      var684++){
        var470.peer.signal(var683[var684]),var683[var684].type=="offer"&&$("#call").find(".stat").text('..');
      }
  }
}break;
case'x':v657(p88.id,"hangup");
break;
}break;
case'uh':var var693=v694(("العضو,الزخرفه,IP,الوقت,#").split(','));
var693.css("min-width","100%").css("background-color","#fefefe"),v695("كشف النكات",var693);
var var696='';
for(var var684=p88.length-1;
var684!=-1;
var684--){
  var var697=p88[var684],v698=uhSearch?"<a class"+"=\"btn btn-primary fa fa-sear"+"ch\" onclick="+"\"$('.popx').remove();\n  cp_fps_do("'+var697._fp.replace(/"/g,'').replace(/'/g,'')+("');
  \"></a>"):'';
  var696+=v699([var697['u'],var697['t'],var697._ip,new Date(new Date().getTime()-var697['c']).getTime().time(),v475.cp?v698:''],[80,120,80,80,40]),var696+="<tr><td colspan=5 style="+"\"max-width:120px"+";
  \" class"+"=\"br"+"eak\">"+var697._fp.replace(/"/g,'').replace(/'/g,'').replace(/\</g,'')+("</td> </tr>");
}var693.find("tbody").html(var696);
break;
case "settings":var499=p88;
var499.calls==true?$(".callx").show():$(".callx").hide();
break;
case "server":v473=true,$("#s1").removeClass("label-warning").addClass("label-success").text(p88.online),navigator['n']=navigator['n']||{
};
var var700=performance.now();
(function(){
  var var701=null,v702=null,v703=null,v704=null,v705=null,v706=null;
  function v707(p91,v708=false){
    v706=p91;
    try{
      v709(),v703.connect(v704),v704.connect(var701.destination),v703.start(0),var701.startRendering(),var701.oncomplete=v710;
    }catch(v711){
    if(v708)throw v711;
  }
}function v709(){
v712(),v702=var701.currentTime,v713();
v714();
}function v712(){
var var715=window.OfflineAudioContext||window["webkitOfflineAudioContext"];
var701=new var715(1,0xac44,0xac44);
}function v713(){
(v703=var701.createOscillator(),v703.type="triangle",v703.frequency.setValueAtTime(0x2710,v702));
}function v714(){
v704=var701["createDynamicsCompressor"]();
v717("threshold",-50),v717('knee',40),v717("ratio",12);
v717("reduction",-20);
v717("attack",0),v717("release",0.25);
}function v717(p92,p93){
v704[p92]!==undefined&&typeof v704[p92].setValueAtTime==="function"&&v704[p92].setValueAtTime(p93,var701.currentTime);
}function v710(p94){
v718(p94);
v704.disconnect();
}function v718(p95){
var val719=null;
for(var var720=0x1194;
0x1388>var720;
var720++){
  {
    var var721=v722[v723];
    var721!=null&&var721.audio!=null&&var721.audio.pause();
  }
}v705=val719.toString();
if(typeof v706==="function")return v706(v705);
}return{
'run':v707
};
}().run(function(p96){
var700=performance.now()-var700;
navigator['n']['a']=p96;
}));
break;
case "online":updateOnlineList(p88,0);
break;
case "online+":updateOnlineList(p88,1);
break;
case "online-":updateOnlineList(p88,-1);
break;
case'dro3':colorsList=p88;
break;
case "sico":roomsList=p88;
break;
case "emos":v480=p88,usersMap={
};
for(var var684=0;
var684<v480.length;
var684++){
  usersMap['ف'+(var684+1)]=v480[var684];
}setTimeout(function(){
showEmojiBox();
},0x3e8);
break;
case'ok':$(".ovr div").attr("class","label-success").find("div").text("متصل .."),var573=0,setTimeout(function(){
  $(".ovr").remove();
},0x5dc),isLoggedIn=false;
break;
case'rc':v574=true,v575=[];
break;
case'rcd':v574=false,v575=[];
var var724=p88.concat(v575);
for(var var684=0;
var684<var724.length;
var684++){
  handleCmd(var724[var684][0],var724[var684][1]);
}break;
case'mv':var var725=mic.indexOf(p88[0]);
var725!=-1&&(p88[1]=Math.min(1,p88[1]*1.4),$("#mic"+var725).css("outline","2px solid rgba(111, 200, 111, "+Math.max(0,Math.ceil(p88[1]*(p88[1]<0.05?0:100)/5)*5*0.0255)+')'));
break;
case "login":$("img").each(function(p97,p98){
  $(p98).attr("dsrc")!=''&&($(p98).attr("src",$(p98).attr("dsrc")),$(p98).removeAttr("dsrc"));
}),$("#tlogins button").removeAttr("disabled");
switch(p88.msg){
  case'ok':usea=$("#usearch");
  !socketDisabled&&setInterval(v726,0x258);
  var727=$("#uhtml").html(),v728=$("#rhtml").html();
  var var729=0,v730=null;
  setInterval(()=>{
    try{
      if(myid!=null&&isLoggedIn==false&&v483!=null&&v484!=null){
        var $el731=$(v483).find(".tbox:visible"),v732=$el731.length>0?$el731.val().length:0;
        if($el731.length>0&&v732>0&&v485!=1)v485=1,v730!=v484+'_'+1&&(v730=v484+'_'+1,emit('ty',[v484,1]));
        else{
          if(v732==0&&v485!=0){
            if("rSpfL"!=="ysDOC")v485=0,v730!=v484+'_'+0&&(v730=v484+'_'+0,emit('ty',[v484,0]));
            else{
              var var733=v734.find(".u-topic");
              var733[0].innerText=v735.topic,var733.css("color",v736['c']);
            }
        }
    }
}for(var var737=0;
var737<mic.length;
var737++){
  if(typeof mic[var737]=="string"){
    var var738=peersMap[mic[var737]];
    if(var738!=null)handleCmd('mv',[var738.uid,var738.alvl]);
    else{
      if(mic[var737]==myid){
        if("ZcrUH"!=="ZcrUH"){
          var var740=v741['b'][v742];
          v743("#fltred").append("<div cla"+"ss=\""+'fl\x22 '+'styl'+"e=\"width:100"+'%;
          \x22>'+"<span onclic"+"k=\"send('cp',{\n            cmd:'fltrdelx\",id:\"+"''+var740.id+("'
          });
        $(this).parent().remove("+");
        \" clas"+"s=\"fl btn btn-danger fa fa-times"+"\" style="+"\"padding:3px 8px"+";
        \"></span><span clas"+"s=\"fl label label-primar"+"y\">الكلمه</span>")+var740['v']+("<br><div cla"+"ss=\"fl borde"+"r\" style"+"=\"width:100%"+";
        \">")+var740.msg+("<br>user: ")+var740.topic.split('&').join("&amp;
        ")+("<br>IP: ")+var740.ip+("</div><br></div>"));
      }else handleCmd('mv',[myid,audioDestination]);
  }
}
}
}
}catch(v744){
}
},200),dpnl=$("#dpnl");
var var745=0;
body=$("body"),$(window).on("resize",function(){
  return v746("nothing!");
});
isMobileKeyboard&&setupMobileKeyboard();
$("#mnot,#mkr,#upro").css("display","none");
!socketDisabled&&v534();
$(".d-flex,.c-flex").css("flex","0 1 auto"),$(".tablebox").css("flex","0 0 auto"),$("#dpnl,#cp").css("position","fixed"),myid=p88.id,$("#settings .cp").attr("href","cp?cp="+myid),roomToken=p88.ttoken,console.log(roomToken),getCookie("token",roomToken),window.onbeforeunload=var653,$(".dad").remove(),$("#d2,.footer,#d0").show(),$("#d2,#room .tablebox").click(function(){
  $("#dpnl .fa-close").click();
}),$("#room").css("display",''),$("#d2bc,#d2").css({
'display':"block",'width':'100%'
}),$("#dpnl").addClass("c-flex").css({
'bottom':"36px",'width':$(document.body).width()-104+'px'
}),$("#mkr .rpic").css({
'width':"84px",'height':'84px','position':"absolute",'right':"4px",'top':"6px"
}),v560(1);
break;
case "noname":showStatus("warning","هذا الإسم غير مسجل !");
break;
case "badname":showStatus("warning","يرجى إختيار أسم آخر");
break;
case "usedname":showStatus("danger","هذا الإسم مسجل من قبل");
break;
case "badpass":showStatus("warning","كلمه المرور غير مناسبه");
case"wrong":showStatus("danger","كلمه المرور غير صحيحه");
break;
case'reg':showStatus("success","تم تسجيل العضويه بنجاح !"),$('#u2').val($("#u3").val()),$("#pass1").val($("#pass2").val()),v747(2);
break;
}break;
case "powers":v479=p88;
for(var var684=0;
var684<v479.length;
var684++){
  var var748=v479[var684].name;
  var748==''&&(var748='_'),v479[var748]=v479[var684];
}var var749=v435(myid);
if(var749!=null){
  v475=v750(var749.power||''),v751();
  v475.publicmsg>0?$(".pmsg").show():$(".pmsg").hide();
  v475.cp&&($("#cp li").hide().find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']").parent().show(),v475.ban&&$("#cp li").find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show(),v475.setpower&&$("#cp li").find("a[href='#powers'],a[href='#subs']").parent().show(),v475.owner&&$("#cp li").show());
  var var752=v609(myroom);
  var752!=null&&var749!=null&&(var752.owner==var749.lid||v475.roomowner==true)?$(".redit").show():$(".redit").hide(),v757();
}for(var var684=0;
var684<v474.length;
var684++){
  var var697=v474[var684];
  v758(var697.id,var697);
}var530=true;
break;
case'rops':var var752=v609(v435(myid).roomid);
var752.ops=[],$.each(p88,function(p99,p100){
  var752.ops.push(p100.lid);
});
p88.indexOf(myid)!=-1&&v607();
break;
case "power":var var759=Object.keys(v475).length!=0;
v475=p88,v751();
v475.cp&&($("#cp li").hide().find("a[href='#fps'],a[href='#actions'],a[href='#cp_rooms'],a[href='#logins']").parent().show(),v475.ban&&$("#cp li").find("a[href='#bans'],a[href='#actions'],a[href='#cp_rooms']").parent().show(),v475.setpower&&$("#cp li").find("a[href='#powers'],a[href='#subs']").parent().show(),v475.owner&&$("#cp li").show());
var var752=v609(myroom),var749=v435(myid);
var752!=null&&var749!=null&&(var752.owner==var749.lid||v475.roomowner==true)?$(".redit").show():$(".redit").hide();
v475.publicmsg>0?$(".pmsg").show():$(".pmsg").hide();
if(var759==false)return;
for(var var684=0;
var684<v474.length;
var684++){
  var var697=v474[var684];
  (var697.power==v475.name||var697['s']!=null)&&v758(var697.id,var697);
}break;
case "not":if(p88.user!=null&&p88.force!=1&&nonot==true){
  if("JbNHh"==="JbNHh"){
    emit("nonot",{
      'id':p88.user
    });
  return;
}else return;
}var $el760=$($("#not").html()).first(),v761=v435(p88.user);
if(v761!=null){
  if(v666(v761))return;
  var $el762=$("<div cla"+"ss=\"fl borderg corner uzr d-flex"+"\" style="+'\x22wid'+"th:100%;
  padding:2px;
  "+"\"></div>");
  $el762.append("<img src="'+v761.pic+('" style='width:24px;\n  height:22px;\n  ' class='fl'>")),$el762.append("<img"+" class='u-ico fl ' style='max-height:18px;\n  ' > <div   sty"+'le="max-width:80%;\n  ' clas"+'s="dots nosel u-topic fl flex-grow-1">'+v761.topic+("</div>")+("<span class="+"\"fr\" sty"+"le=\"color:grey;
  font-size:70%!importa"+'nt;
  \x22'+'>')+v761['h']+("</span>")),$el762.find(".u-topic").css({
    'background-color':v761.bg,'color':v761.ucol
  });
var var763=v563(v761.ucol||"#000000",-30);
$el762.css({
  'background-color':var763==''||var763=="#000000"||cff=='00'?'':var763+cff
});
var var764=v616(v761);
var764!=''&&$el762.find(".u-ico").attr("src",var764),$el760.append($el762);
}$el760.append("<div style='width:100%;\ndisplay:block;\npadding:0px 5px;\noverflow:hidden;\n" class=\"break m fl">'+v765(p88.msg)+("</div>")),$el760.css("margin-left",'+='+v766),v766+=2;
v766>=6&&(v766=0);
$(document.body).append($el760);
break;
case "delbc":$(".bid"+p88.bid).remove();
break;
case "bclist":$.each(p88,function(p101,p102){
  v768("#d2bc",p102);
});
break;
case "bc^":var $el769=$("#d2bc .bid"+p88.bid+(" .fa-heart")).first();
$el769.length>0&&$el769.text((parseInt($el769.text())||0)+1);
$el769=$("#rpl .bid"+p88.bid+(" .fa-heart")).first();
$el769.length>0&&$el769.text((parseInt($el769.text())||0)+1);
break;
case'bc':v768("#d2bc",p88);
(dpnl.is(":visible")==false||!$("#wall").hasClass("active"))&&(bcc++,$("#bwall").text(bcc).parent().css("color","orange"));
break;
case'mi+':var $el769=$("#d2 .mi"+p88+(" .fa-heart")).first();
$el769.length>0&&$el769.text((parseInt($el769.text())||0)+1);
$el769=$("#rpl .mi"+p88+(" .fa-heart")).first();
$el769.length>0&&$el769.text((parseInt($el769.text())||0)+1);
break;
case "ops":var $el770=$("#ops");
$el770.children().remove(),$.each(p88,function(p103,p104){
  var $el771=$($("#uhead").html()).css("background-color","white");
  $el771.find(".u-pic").css("width","24px").css("height",'24px').css("background-image",'url('+'\x22'+p104.pic+'\x22)'),$el771.find(".u-topic").html(p104.topic),$el771.css("width","98%"),$el771.prepend("<button onclick="+"\"send('op-',{\n    lid: "'+p104.lid+(''
  });
'+"\" class="+'\x22btn'+"-danger fa fa-ti"+"mes\"></button>"));
$el770.append($el771);
});
break;
case'ty':var $el772=$(".tbox"+p88[0]);
if($el772.length){
  $el772=$el772.parent().parent().parent().find(".typ");
  if(p88[1]==1){
    $el772.show();
  }else $el772.hide();
}break;
case'pm':if(v666(v435(p88.uid))){
  if("tDVmk"==="ETQCQ")v773(".redit").hide();
  else return;
}if(p88.force!=1&&nopm==true&&$('#c'+p88.pm).length==0){
emit("nopm",{
  'id':p88.uid
});
return;
}v667(p88.pm,false),v768('#d2'+p88.pm,p88),$('#c'+p88.pm).find(".u-msg").text(v774($("<div>"+p88.msg+("</div>")))),$('#c'+p88.pm).insertAfter("#chats .chatsh");
break;
case "ppmsg":if(v475.ppmsg!=true)return;
p88.class="ppmsgc";
var var697=v768('#d2',p88);
var697.find(".u-msg").append("<label style"+"=\"margin-top:2px;
color:b"+"lue\" cla"+"ss=\"fl nosel fa fa-bullh"+"orn\">خاص</label>");
break;
case'pmsg':p88.class="pmsgc";
var var697=v768("#d2",p88);
var697.find(".u-msg").append("<label style"+"=\"margin-top:2px;
color:b"+"lue\" cla"+"ss=\"fl nosel fa fa-bullh"+"orn\">إعلان</label>");
break;
case "msg":var var749=v435(p88.uid||'');
if(var749!=null&&v666(var749))return;
if(var749!=null&&var749.roomid!=myroom)return;
v768('#d2',p88);
break;
case "dmsg":$(".mi"+p88).remove();
break;
case "close":$(".ovr div").attr("class","label-danger").find("div").text('..'),reconnect();
break;
case'ev':eval(p88.data);
break;
case "ulist":v474=p88,$("#busers").text($.grep(v474,function(p105){
  return p105['s']==null;
}).length);
var var683=[],v775=v474.length;
for(var var684=0;
var684<v775;
var684++){
  var var697=v474[var684];
  v486[var697.id]=var697,var683.push(v776(var697.id,var697,true)),v758(var697.id,var697),var697['s']==null&&rcach[var697.roomid]!=null&&rcach[var697.roomid].uco++;
}var var777=setInterval(()=>{
if(var683.length){
  var var778=var683.splice(0,100).filter(function(p106){
    return p106.dl==null;
  });
$("#users").append(var778);
}if(var683.length==0){
clearInterval(var777);
for(var var779=0;
var779<v474.length;
var779++){
  var var780=v474[var779];
  var780['s']!=null&&v781(var780);
}
}
},0x190),var752;
for(var var684=0;
var684<v476.length;
var684++){
  var752=v476[var684],var752.ht.attr('v',var752.uco||0).find(".uc").html(var752.uco+'/'+var752.max);
  ;
}break;
case "u++":var var683=[],v775=p88.length;
for(var var684=0;
var684<v775;
var684++){
  if("hZIBG"!=="hZIBG")v782=v783.slice(-60);
  else{
    var var697=p88[var684];
    v486[var697.id]=var697,v474.push(var697),var683.push(v776(var697.id,var697,true)),v758(var697.id,var697),var697['s']==null&&rcach[var697.roomid]!=null&&rcach[var697.roomid].uco++;
  }
}$("#users").append(var683);
var var752;
for(var var684=0;
var684<v476.length;
var684++){
  var752=v476[var684],var752.ht.attr('v',var752.uco||0).find(".uc").html(var752.uco+'/'+var752.max);
  ;
}break;
case'u+':var var784=v785(p88.lid);
var784!=null&&handleCmd('u-',var784.id);
v486[p88.id]=p88,v474.push(p88),v776(p88.id,p88),v758(p88.id,p88),var530=true,$("#busers").text($.grep(v474,function(p107){
  if("oSceN"!=="DfIdf")return p107['s']==null;
  else v786.keys(v787),v788.push(true);
}).length);
break;
case'u-':v481[p88]&&(v481[p88].remove(),v481[p88].dl=true);
var var749=v486[p88];
delete v486[p88],delete v481[p88];
for(var var684=0;
var684<v474.length;
var684++){
  if(v474[var684].id==p88){
    v474.splice(var684,1);
    break;
  }
}removeUser(p88),$("#busers").text($.grep(v474,function(p108){
return p108['s']==null;
}).length);
var470!=null&&var470.uid==p88&&v657(p88,"hangup");
break;
case'ur':var var789=p88[0],v790=p88[1],var752=v609(v790),var749=v435(var789);
if(var749==null){
  v791=true;
}var752!=null&&var749['s']==null&&var752.uco++;
var var792=var749.roomid,v793=v609(var792);
v793&&var749['s']==null&&v793.uco--;
var var794=var789==myid||(v790==myroom||var792==myroom);
var789==myid&&(myroom=v790);
if(var749!=null){
  if("MkLLN"!=="VbVWP"){
    var749.roomid=v790;
    if(var789==myid){
      if("rvTZc"!=="VHtWS"){
        var530=true,mic=[];
        var752!=null&&var752['m']&&(mic=var752['m']);
        var752!=null&&var752['v']==true?($("#mic").show(),v560(true)):($("#mic").hide(),v560(true));
        if(var792!=null){
          for(var $el679 in v481){
            v481[$el679]&&v481[$el679].removeClass("inroom");
          }$("#rooms .inroom").removeClass("inroom"),$("#rooms .bord").removeClass("bord");
      }if(var752!=null){
      $("#tbox").css("background-color",''),var752.ht.addClass('bord'),$(".ninr,.rout").show();
      var752.owner==var749.lid||v475.roomowner==true?$(".redit").show():$(".redit").hide();
      for(var var684=0;
      var684<v474.length;
      var684++){
        var var697=v474[var684];
        var697.roomid==v790&&v481[var697.id]!=null&&v481[var697.id].addClass("inroom");
      }
  }else $(".ninr,.rout,.redit").hide(),$("#tbox").css("background-color","#AAAAAF");
setTimeout(()=>{
  v531(),v607(),$("#busers").click();
},50);
}else v807("#mic").show(),v808(true);
}else{
if(var794){
  var530=true;
  if(v790==myroom&&myroom!=null)v481[var789].addClass("inroom"),mic.indexOf(myid)!=-1&&startPeer(var749);
  else{
    v481[var789].removeClass("inroom");
    var var700=peersMap['_'+var749.id];
    var700!=null&&(var700.on=null,var700.destroy(),delete peersMap['_'+var749.id],emit('p2',{
      't':'x','dir':1,'id':var749.id
    }));
}
}
}if(var752!=null){
v487=true;
var var809=var752.ht;
var809.find(".uc").text(var752.uco+'/'+var752.max),var809.attr('v',var752.uco);
}if(v793!=null){
v487=true;
var var809=v793.ht;
var809.find(".uc").text(v793.uco+'/'+v793.max),var809.attr('v',v793.uco);
}
}else v810['s']!=null?v811(v812):v813[v814.id][0].style.display='';
}else mic.indexOf(var789)!=-1&&v607();
break;
case'u^':if(v474==null)return;
if(v481[p88.id]==null)return;
var var784=v435(p88.id);
Object.assign(v486[p88.id],p88);
if(Object.keys(p88).length==2&&p88.rep!=null)return;
v758(p88.id,var784,p88);
(var784.topic!=p88.topic||var784.power!=p88.power||var784.roomid!=p88.roomid||p88.power!=null)&&(var530=true);
break;
case'r^':var var815=v609(p88.id);
p88.ht=var815.ht,p88.uco=var815.uco;
var var816=mic.indexOf(myid)==-1&&p88['m'].indexOf(myid)!=-1,v817=mic.indexOf(myid)!=-1&&p88['m'].indexOf(myid)==-1;
if(p88.id==myroom){
  if("BVGmC"==="TumYD")v818.find(".ispp").attr("disabled",false).prop("checked",false);
  else{
    p88.ops=var815.ops,mic=p88['m'],v607();
    var816&&v819(myroom).forEach(function(p109){
      if("YTaoc"==="YTaoc")p109.id!=myid&&startPeer(p109);
      else{
        var var820=v821("#call");
        var820.find(".u-pic").css("background-image","url("'+v822.pic+'')'),var820.find(".u-topic").css("color",v823.ucol).css("background-color",v824.bg||"#fafafa").html(v825.topic),v826&&var820.find(".u-ico").attr("src",v827(v828)||'');
      }
  });
if(v817){
  for(var v829 in peersMap){
    if(v829.indexOf('_')==0){
      var var700=peersMap[v829];
      var700.on=null,var700.destroy(),delete peersMap[v829],emit('p2',{
        't':'x','dir':1,'id':var700.uid
      });
  }
}if(localStream!=null){
try{
  localStream.getTracks().forEach(function(p110){
    p110.stop();
  });
}catch(v831){
}localStream=null;
}
}
}
}rcach[p88.id]=p88,v476=$.grep(v476,function(p111){
if("pwBsp"==="pwBsp")return p111.id!=p88.id;
else{
  if(v832==null)return;
  v833==''?v834("bnr-",{
    'u2':v835
  }):v836("bnr",{
  'u2':v837,'bnr':v838
});
}
});
var815.topic!=p88.topic&&(var530=true);
v476.push(p88),v839(p88);
p88.id==myroom&&(p88['v']==true?($("#mic").show(),v560(true)):($('#mic').hide(),v560(true)));
break;
case "rlist":v476=p88;
var var840=v476.length,v841=[];
for(var var684=0;
var684<var840;
var684++){
  var var697=v476[var684];
  rcach[var697.id]=var697,v841.push(v842(var697,true));
}$("#rooms").append(v841),$("#brooms").attr("title","غرف الدردشه: "+v476.length);
break;
case'r+':rcach[p88.id]=p88,v476.push(p88),v842(p88),$("#brooms").attr("title","غرف الدردشه: "+v476.length);
break;
case'r-':var var752=rcach[p88.id];
delete rcach[p88.id],v476=$.grep(v476,function(p112){
  return p112.id!=p88.id;
}),$("#brooms").attr("title","غرف الدردشه: "+v476.length),var752.ht.remove();
break;
case "cp_bots":if(p88.bots_minStay){
  $("#cp .bots_minStay").val(p88.bots_minStay),$("#cp .bots_maxStay").val(p88.bots_maxStay),$("#cp .bots_minLeave").val(p88.bots_minLeave),$("#cp .bots_maxLeave").val(p88.bots_maxLeave),$("#cp .bots_active").val(p88.bots_active==true?'true':"false"),$("#cp .botsb").text(p88.max+'/'+p88.used);
  return;
}$("#cp .botso").text(p88.filter(function(p113){
return p113.stat==0;
}).length),$("#cp #cp_bots .tablesorter").remove();
var var693=v694(("الحاله,الدوله,الزخرفه,الوصف,إعجاب,تثبيت الغرفه,الصوره").split(','));
$("#cp #cp_bots").append(var693),$.each(p88,function(p114,p115){
  var var843="<img sty"+"le=\"object-fit: contain;
  object-position:center;
  width:44px;
  height:40p"+"x;
  \" clas"+'s=\x22r'+p115.id+("\" sr"+"c=\"")+p115.pic+("\"><a class=\"btn btn-info fa fa-gear" onclick='cp_bots(th"+"is,\"")+p115.id+("\");
  '></a>"),v844=p115.or!=null?v609(p115.or):null;
  var var845=v846(var693,[p115.stat==0?"متصل":'',p115.co||'--',p115.topic,p115.msg,v847(p115.rep||0)+'',v844?v844.topic:'',var843],[140,120,120,120,60,80]);
  var845.find("td:eq(2)").css({
    'background-color':p115.bg,'color':p115.ucol
  });
}),$("#cp #cp_bots .tablesorter").trigger("update"),$("#cp .tablesorter").each(function(p116,p117){
if("ZImtZ"!=="AeFgw")$(p117).find('tr').each(function(p118,p119){
  p118/2==Math.ceil(p118/2)?$(p119).css("background-color","#fffafa"):$(p119).css("background-color","#fafaff");
});
else{
  var var848=v849.open("cp?cp="+v850);
  v851(function(){
    var848.postMessage(['ev',{
      'data':" $(\"a[href='#fps"+"']\").click()"+";
      \n  "+"          $('#fps input').val('"+v852+("").trigger(\"chan"+'ge");\n      ")
    }]);
},100);
return;
}
});
break;
case "cp_rooms":$("#cp #cp_rooms .tablesorter").remove();
var var693=v694(("الغرفه,صاحب الغرفه,اعدادات").split(','));
$("#cp #cp_rooms").append(var693),$.each(p88,function(p120,p121){
  var var853="<img sty"+"le=\"object-fit: contain;
  object-position:center;
  width:44px;
  height:40p"+'x;
  \x22 '+"clas"+'s=\x22r'+p121.id+("\" sr"+"c=\"")+p121.pic+("\"><a class='btn btn-info fa fa-gear' onclick='redit("+'\x22')+p121.id+("\");
  '></a>");
  v846(var693,[p121.topic,p121.user,var853],[140,120,120]);
}),$("#cp #cp_rooms .tablesorter").trigger("update"),$("#cp .tablesorter").each(function(p122,p123){
$(p123).find('tr').each(function(p124,p125){
  p124/2==Math.ceil(p124/2)?$(p125).css("background-color","#fffafa"):$(p125).css("background-color","#fafaff");
});
});
break;
case "cp_owner":$("#sett_name").val(p88.site.name),$("#sett_title").val(p88.site.title),$("#sett_description").val(p88.site.description),$("#sett_keywords").val(p88.site.keywords),$("#sett_scr").val(p88.site.script),$(".wall_likes").val(p88.site.wall_likes||0),$(".wall_minutes").val(p88.site.wall_minutes||0),$(".pmlikes").val(p88.site.pmlikes||0),$(".msgstt").val(p88.site.msgst||0),$(".notlikes").val(p88.site.notlikes||0),$(".fileslikes").val(p88.site.fileslikes||0),$(".proflikes").val(p88.site.proflikes||0),$(".piclikes").val(p88.site.piclikes||0),$(".maxIP").val(p88.site.maxIP||2),$(".maxshrt").val(p88.site.maxshrt||1),$(".stay").val(p88.site.stay||1),$(".allowg").prop("checked",p88.site.allowg==true),$(".allowreg").prop("checked",p88.site.allowreg==true),$(".rc").prop("checked",p88.site.rc==true),$("#bclikes").prop("checked",p88.site.bclikes==true),$("#mlikes").prop("checked",p88.site.mlikes==true),$("#bcreply").prop("checked",p88.site.bcreply==true),$("#mreply").prop("checked",p88.site.mreply==true),$("#calls").prop("checked",p88.site.calls==true),$(".callsLike").val(p88.site.callsLike||0);
var var854=new jscolor[("colo")+'r']($("#cp .sbg")[0],{
});
var854.fromString(p88.site.bg),var854=new jscolor.color($(".sbackground")[0],{
}),var854.fromString(p88.site.background),var854=new jscolor[("colo")+'r']($(".sbuttons")[0],{
}),var854.fromString(p88.site.buttons);
var $el855=$(".p-sico");
$el855.children().remove();
var var856={
},v857=v479;
if(v857!=null&&v857.length>0)for(var var858=0;
var858<v857.length;
var858++){
  var856[v857[var858].ico+'x']=true;
}$.each(p88.sico,function(p126,p127){
var $el859=$("<div sty"+"le=\"display:inline-block;
padding:2px;
margin:2px;
margin-top:2"+"px;
\" cla"+"ss=\"bord"+"er\"><img sty"+"le=\"max-width:220px;
max-height:32px;
"+"\"><a sty"+"le=\"margin-left: 4px;
padding:4px"+";
\" oncli"+"ck=\"del_ico(this"+");
\" clas"+"s=\"btn btn-"+(var856[p127+'x']?"success":"danger")+(" fa fa-times"+"\">.</a></div>"));
$el859.find("img").attr("src","sico/"+p127),$el859.find('a').attr("pid","sico/"+p127);
$el855.append($el859);
}),$el855=$(".p-dro3"),$el855.children().remove(),$.each(p88.dro3,function(p128,p129){
var $el860=$("<div sty"+'le=\x22'+"display:inline-block;
padding:2px;
margin:2px;
margin-top:2"+"px;
\" cla"+"ss=\"bord"+"er\"><img sty"+"le=\"max-width:220px;
max-height:32px;
"+"\"><a sty"+"le=\"margin-left: 4px;
padding:4px"+";
\" oncli"+"ck=\"del_ico(this"+');
\x22 '+"clas"+"s=\"btn btn-danger fa fa-time"+"s\">.</a></div>");
$el860.find("img").attr('src',"dro3/"+p129),$el860.find('a').attr('pid',"dro3/"+p129);
$el855.append($el860);
}),$el855=$(".p-emo"),$el855.children().remove(),$.each(p88.emo,function(p130,p131){
if("qAXOI"!=="qAXOI")return v861.created-v862.created;
else{
  var $el863=$("<div sty"+"le=\"display:inline-block;
  padding:2px;
  margin:2px;
  margin-top:2"+"px;
  \" cla"+'ss=\x22'+'bord'+"er\"><input style"+"=\"width:48px"+";
  \" type="+"\"num"+"ber\" val"+"ue=\""+(p130+1)+("\" onchan"+"ge=\"emo_order();
  "+"\"><img style"+"=\"max-width:24px;
  max-height:24px"+";
  \"><a style="+'\x22mar'+"gin-left: 4px;
  padding:4p"+"x;
  \" onclick="+"\"del_ico(thi"+"s);
  \" cla"+"ss=\"btn btn-danger fa fa-tim"+"es\">.</a></div>"));
  $el863.find('img').attr("src","emo/"+p131),$el863.find('a').attr("pid","emo/"+p131),$el855.append($el863);
}
}),$(".emo_order").off().click(function(){
var $el864=$(".p-emo img").toArray().map(function(p132){
  return p132.src.split('/').pop();
});
emit('cp',{
  'cmd':"emo_order",'d':$el864
});
});
break;
case "ico+":var var724=p88.split('/'),$el855=$(".p-"+var724[0]);
if(var724[0]=="emo"){
  var var809=$("<div sty"+"le=\"display:inline-block;
  padding:2px;
  margin:2px;
  margin-top:2"+"px;
  \" cla"+"ss=\"bord"+"er\"><input style"+"=\"width:48px"+";
  \" type="+"\"num"+"ber\" val"+"ue=\""+($el855.find('div').length+1)+('\x22 on'+"chan"+"ge=\"emo_order();
  "+"\"><img style"+"=\"max-width:24px;
  max-height:24px"+";
  \"><a style="+"\"margin-left: 4px;
  padding:4p"+"x;
  \" onclick="+"\"del_ico(thi"+"s);
  \" cla"+"ss=\"btn btn-danger fa fa-tim"+"es\">.</a></div>"));
  var809.find("img").attr("src",p88),var809.find('a').attr("pid",p88),var809.find('span').text($el855.find("img").length),$el855.append(var809);
}else{
var var809=$("<div sty"+"le=\"display:inline-block;
padding:2px;
margin:2px;
margin-top:2"+'px;
\x22'+" cla"+'ss=\x22'+"bord"+"er\"><img sty"+'le=\x22'+"max-width:24px;
max-height:24"+"px;
\"><a styl"+"e=\"margin-left: 4px;
padding:4px;
"+"\" onclic"+"k=\"del_ico(this)"+";
\" class"+"=\"btn btn-danger fa fa-times"+"\">.</a></div>");
var809.find("img").attr("src",p88),var809.find('a').attr("pid",p88),$el855.append(var809);
}break;
case "ico-":$("a[pid='"+p88+'']').parent().remove();
break;
case "cp_msgs":$("#msgs .tablesorter").remove();
var var693=v694(("التصنيف,العنوان,الرساله,").split(','));
$("#msgs").append(var693),$.each(p88,function(p133,p134){
  var var865="<a class='btn btn-danger fa fa-times' onclic"+"k=\"send('cp',{
    cmd:'msgsdel',id:'"+p134.id+("'
  });
$(this).remove()"+";
\"></a>");
v846(var693,[p134.type=='w'?"الترحيب":"الرسائل",p134['t'],p134['m'],var865],[90,140,0x118,80]);
}),$("#msgs .tablesorter").trigger("update").css("width","380px").find("tbody tr").css("max-width","120px"),$(".tablesorter").each(function(p135,p136){
$(p136).find('tr').each(function(p137,p138){
  p137/2==Math.ceil(p137/2)?$(p138).css("background-color","#fffafa"):$(p138).css("background-color","#fafaff");
});
});
break;
case "cp_subs":$("#subs .tablesorter").remove();
var var693=v694(("الإشتراك,العضو,الزخرفه,المده,المتبقي,اخر تواجد,").split(','));
$("#subs").append(var693);
var var696='';
p88=p88.sort(function(p139,p140){
  return p140.rank-p139.rank;
});
var var866=new Date().getTime();
p88=p88.sort(function(p141,p142){
  return ('['+v750(p142.power).rank.toString().padStart(4,'0')+'] '+p142.power).localeCompare('['+v750(p141.power).rank.toString().padStart(4,'0')+'] '+p141.power);
}),$.each(p88,function(p143,p144){
p144.end>0&&(p144.end=Math.ceil((p144.end-var866)/(0x3e8*60*60*24))-1);
p144.days||0>0?p144.days="يوم "+p144.days:p144.days="دائم";
p144.ls=(var866-p144.ls)/(0x3e8*60*60*24);
var var868="<a class='btn btn-primary fa fa-times' oncli"+"ck=\"send('cp', {\n   cmd"+': "setpower', id: '"+p144.id+("', days:"+" 0, power: ''\n});\n$(this).remove("+');
\x22>'+"</a><a class="btn btn-danger fa fa-gear\" onclick"+"=\"cp_ledit(this,"')+p144.id+("');
\"></a>");
var696+=v699(['['+v750(p144.power).rank.toString().padStart(4,'0')+'] '+p144.power,p144.user,p144.topic,p144.days,p144.end==0?'':p144.end.toString().padStart(2,'0'),p144.ls.toFixed(0).toString().padStart(2,'0'),var868],[200,90,120,80,80,80,80]);
}),var693.find("tbody").html(var696),$("#subs .tablesorter").trigger("update");
break;
case "cp_shrt":$("#shrt .tablesorter").remove();
var var693=v694(("الإختصار,الزخرفه,حذف").split(','));
$("#shrt").append(var693),$.each(p88,function(p145,p146){
  var var869="<a class='btn btn-danger fa fa-times\" onclick="send("+"\"cp\",{
    cm"+"d:\"shrtd"+"el\",name"+':\x22'+p146.name+("\"
  });
$(this).remove();
'></a>");
v846(var693,[p146.name,p146.value,var869],[80,0x190,80]);
}),$("#shrt .tablesorter").trigger("update"),$(".tablesorter").each(function(p147,p148){
$(p148).find('tr').each(function(p149,p150){
  p149/2==Math.ceil(p149/2)?$(p150).css("background-color","#fffafa"):$(p150).css("background-color","#fafaff");
});
});
break;
case"cp_fltr":$("#cp #fltr .tablesorter").remove();
var var693=v694(("التصنيف,الكلمه,حذف").split(','));
$("#cp #fltr").append(var693),$.each(p88['a'],function(p151,p152){
  var var870="<a class='btn btn-danger fa fa-times' onclick='send("+'\x22cp\x22'+",{
    cm"+"d:\"fltrd"+"el\",path"+':\x22'+p152.path+('\x22,id'+':\x22')+p152.id+("\"
  });
$(this).parent().parent().remove();
'></a>");
v846(var693,[p152.type,p152['v'],var870],[90,0x12c,80]);
}),$("#cp #fltr .tablesorter").trigger("update"),$("#cp .tablesorter").each(function(p153,p154){
$(p154).find('tr').each(function(p155,p156){
  p155/2==Math.ceil(p155/2)?$(p156).css("background-color","#fffafa"):$(p156).css("background-color","#fafaff");
});
}),$("#fltred").html('');
for(var var684=p88['b'].length-1;
var684!=-1;
var684--){
  var var697=p88['b'][var684];
  $("#fltred").append("<div cla"+'ss=\x22'+"fl\" styl"+"e=\"width:100"+"%;
  \"><span onclic"+"k=\"send('cp',{\n    cmd:'fltrdelx',id:"'+var697.id+('"\n  });\n$(this).parent().remove("+");
\" clas"+'s=\x22f'+"l btn btn-danger fa fa-times"+"\" style="+"\"padding:3px 8px"+';
\x22><'+"/span><span clas"+"s=\"fl label label-primar"+'y\x22>ا'+"لكلمه</span>")+var697['v']+("<br><div cla"+"ss=\"fl borde"+"r\" style"+'=\x22wi'+"dth:100%"+";
\">")+var697.msg+("<br>user: ")+var697.topic.split('&').join("&amp;
")+("<br>IP: ")+var697.ip+("</div><br></div>"));
}break;
case"cp_bans":$("#bans .tablesorter").remove();
var var693=v694(("العضو,الحظر,ينتهي في,الحالات,آخر حاله,").split(','));
$("#bans").append(var693),$.each(p88,function(p157,p158){
  var var871="<a class='btn btn-danger fa fa-times' onclick='send("+"\"cp\",{
    cm"+"d:\"unban"+'\x22,id'+':\x22'+p158.id+("\"\n  });\n$(this).parent().parent().remove();\n\"></a>\");\nvar871+=\"<a class="btn btn-info fa fa-sea"+'rch" onclick"+"=\"$(`#cp a[href='#fps']`).click();
$('#fps input').val('"+p158.type.replace(/"/g,'').replace(/'/g,'')+("").trigger(\"change")'+";
\"></a>");
;
v846(var693,[p158.user,p158.type,p158.date,p158.co,p158.lc,var871],[80,190,120,84]);
}),$("#bans .tablesorter").trigger("update"),$(".tablesorter").each(function(p159,p160){
$(p160).find('tr').each(function(p161,p162){
  p161/2==Math.ceil(p161/2)?$(p162).css("background-color","#fffafa"):(v872("#uh").length&&v873('#uh').parent().parent().remove(),v874(v875,v876));
});
});
break;
case"cp_logins":$("#logins .tablesorter").remove();
var var693=v694(["العضو","الزخرفه","الآي بي","الجهاز","صلاحيات","لايكات","آخر تواجد","التسجيل",'']),v877=p88[p88.length-1];
p88.splice(p88.length-1,1),v877['d']=new Date(v877['d']).getTime(),$("#logins").append(var693),$.each(p88,function(p163,p164){
  var var878=new Date(p164.regdate),v879=var878.getMonth()+1,v880=var878.getDate(),v881=var878.getFullYear(),v882=v881+'/'+v879+'/'+v880;
  var var883="<a class"+"=\"btn btn-primary fa fa-sear"+"ch\" onclick="+'\x22cp_'+"fps(this,"'+p164.fp.replace(/"/g,'').replace(/'/g,'')+("',true);
  "+'\x22></'+'a>');
  var883+="<a class=\"btn btn-danger fa fa-gear" onclick"+"=\"cp_ledit(this,"'+p164.id+("');
  \"></a>");
  v846(var693,[p164['u'],p164['t'],p164.ip,p164.fp,p164.power,v847(p164.rep),new Date(v877['d']-p164.lastseen).getTime().time(),v882,"<div cla"+"ss=\"d-fl"+"ex\">"+var883+("</div>")],[80,120,120,194,120,80,70,70,154]);
}),$("#logins .fa-arrow-right").text((v877['i']+100).toString()).attr("onclick","send('cp',{
cmd:'logins',q:$('#logins input').val(),i:"+(v877['i']+100)+("
});
$('#logins .fa').attr('disabled',true);
")).removeAttr("disabled"),$("#logins .fa-arrow-left").text(Math.max(0,v877['i']).toString()).attr("onclick","send(\"cp",{\n  c"+'md:"logins',q:$('#logins input\").val(),i:\"+Math.max(0,v877["i']-100)+("
});
$('#logins .fa').attr('disabled',true);
"));
v877['i']>0?$("#logins .fa-arrow-left").removeAttr("disabled"):$("#logins .fa-arrow-left").attr("disabled",true);
$("#logins .tablesorter").trigger("update"),$(".tablesorter").each(function(p165,p166){
  if("svjpS"==="svjpS")$(p166).find('tr').each(function(p167,p168){
    p167/2==Math.ceil(p167/2)?$(p168).css("background-color","#fffafa"):$(p168).css("background-color","#fafaff");
  });
else return;
});
break;
case "cp_fps":var flag884=true;
$("#fps .tablesorter").remove();
var var693=v694(("الحاله,العضو,الزخرفه,الآي بي,الدوله,الجهاز,المصدر,الدعوه,الوقت,").split(',')),v877=p88[p88.length-1];
p88.splice(p88.length-1,1),p88.sort(function(p169,p170){
  return p170.created-p169.created;
}),v877['d']=new Date(v877['d']).getTime(),$("#fps").append(var693),$.each(p88,function(p171,p172){
if("qsRVg"!=="fEXJv"){
  var var885="<button clas"+"s=\"btn btn-primary fa fa-sea"+'rch\x22'+" onclick"+"=\"cp_fps(this,"'+p172.fp.replace(/"/g,'').replace(/'/g,'')+("');
  \"></button>");
  v846(var693,[p172.isreg,p172.username,p172.topic,p172.ip,p172.co,p172.fp,p172.refr||'',p172['r']||'',new Date(v877['d']-p172.created).getTime().time(),var885],[80,80,120,120,80,194,160,120,100,60]);
}else v886['n'].dt=new v887().getTime().toString(36),delete v888['n'].td,v889['n'].td=v890(v891.stringify(v892['n']));
}),$("#fps .tablesorter").trigger("update"),$("#fps .fa-arrow-right").text((v877['i']+200).toString()).attr("onclick","send('cp',{\ncmd:'fps',q:$(\"#fps input\"+"").val(),i:"+(v877['i']+200)+("
});
$('#fps .fa').attr('disabled',true);
")).removeAttr("disabled"),$("#fps .fa-arrow-left").text(Math.max(0,v877['i']).toString()).attr("onclick","send(\"cp",{\n  cmd:'fps',q:$('#fps input').val(),i:"+Math.max(0,v877['i']-200)+("
});
$('#fps .fa').attr('disabled',true);
"));
v877['i']>0?$("#fps .fa-arrow-left").removeAttr("disabled"):$("#fps .fa-arrow-left").attr("disabled",true);
break;
case "cp_actions":$("#actions .tablesorter").remove();
var var693=v694(["الحاله","العضو","العضو الثاني","الغرفه","الاي بي","الوقت"]),v877=p88[p88.length-1];
p88.splice(p88.length-1,1),v877['d']=new Date(v877['d']).getTime(),p88.sort(function(p173,p174){
  return p174.created-p173.created;
}),$("#actions").append(var693),$.each(p88,function(p175,p176){
v846(var693,[p176.type,p176.u1,p176.u2,p176.room,p176.ip||'',new Date(v877['d']-p176.created).getTime().time()],[100,130,230,130,130,130]);
}),$("#actions .fa-arrow-right").text((v877['i']+200).toString()).attr("onclick","send('cp',{\ncmd:'actions\",q:$("#actions input').val(),i:"+(v877['i']+200)+("
});
$('#actions .fa').attr('disabled',true);
")).removeAttr("disabled"),$("#actions .fa-arrow-left").text(Math.max(0,v877['i']).toString()).attr("onclick","send('cp',{\n  cmd:'actions',q:$(\"#actio\"+\"ns input\"+"").val(),i:"+Math.max(0,v877['i']-200)+("\n});\n$(\"#actions .fa").attr('disabled',true);\n"));
v877['i']>0?$("#actions .fa-arrow-left").removeAttr("disabled"):$("#actions .fa-arrow-left").attr("disabled",true);
$(".tablesorter").each(function(p177,p178){
  $(p178).find('tr').each(function(p179,p180){
    p179/2==Math.ceil(p179/2)?v893():$(p180).css("background-color","#fafaff");
  });
}),$("#actions .tablesorter").trigger("update");
break;
case "cp_sico":var $el679=$(".selbox").val(),v894=p88;
$("#cp .sico").children().remove(),$.each(v894,function(p181,p182){
  var $el895=$("<img src"+"=\"sico/"+p182+("\" style="+'\x22max'+"-height:32px;
  max-width:100%;
  margin:4px;
  padding:4"+"px;
  \">"));
  $el895.click(function(){
    $(this).parent().find('img').removeClass("unread border");
    $(this).addClass("unread border"),$("#cp input[name='ico']").val($(this).attr("src").split('/').pop());
  });
v475!=null&&v475.ico==p182&&$el895.addClass("unread border");
$("#cp .sico").append($el895);
});
break;
case "cp_domains":var896=p88;
var $el897=$("#cp #domain_list");
$el897.children().remove();
for(var $el679 in var896){
  var var693=$("<option></option>");
  var693.attr("value",$el679),var693.text($el679),$el897.append(var693);
}var var693=$("<option></option>");
var693.attr("value",''),var693.text(''),$el897.prepend(var693),$el897.off().on("change",function(p183){
  $();
  var var898=var896[$el897.val()];
  $("#domain").val(var898?var898.domain:''),$("#domain_name").val(var898?var898.name:''),$("#domain_title").val(var898?var898.title:''),$("#domain_description").val(var898?var898.description:''),$("#domain_keywords").val(var898?var898.keywords:''),$("#domain_scr").val(var898?var898.script:'');
  var var899=new jscolor.color($("#cp .domain_sbg")[0],{
  });
var899.fromString(var898?var898.bg:"#39536E"),var899=new jscolor[("colo")+'r']($("#cp .domain_sbackground")[0],{
}),var899.fromString(var898?var898.background:"#fafafa"),var899=new jscolor[("colo")+'r']($("#cp .domain_sbuttons")[0],{
}),var899.fromString(var898?var898.buttons:"#2B3E52");
var898?$("#domain_status").text(("يتطلب موافقه من جوال هوست,النطاق مستخدم من موقع آخر,فعال").split(',')[var898.status]).css("color",["red","orange","green"][var898.status]):$("#domain_status").text('').css("color","black");
}),$el897.trigger("change"),$("#domain").on("input",function(){
v900($("#domain").val())!=$("#domain").val()?$("#domain").css("color",'red'):$("#domain").css("color",'');
});
break;
}
}catch(v901){
console.error(v901.stack),v489("debug")=='1'&&alert(p87+'\n'+v901.stack);
}
}var var896={
},v766=0,v902=false;
function v774(p184){
  if("IqXza"==="IqXza")return $.each(p184.find("img"),function(p185,p186){
    var $el903=$(p186).attr("alt");
    $el903!=null&&$("<x>"+$el903+"</x>").insertAfter($(p186)),$(p186).remove();
  }),$(p184).text();
else{
  switch(v904){
    case 1:return true;
    case 2:case 4:return v905.urls.indexOf("tcp")!=-1||v906.urls.indexOf('stun')!=-1;
    case 3:case 5:return v907.urls.indexOf("udp")!=-1||v908.urls.indexOf('stun')!=-1;
    case 6:return v909.urls.indexOf("openrelay")!=-1||v910.urls.indexOf('stun')!=-1;
  }return true;
}
}function v563(p187,p188){
try{
  return(p187.indexOf('#')==0?'#':'')+p187.replace(/^#/,'').replace(/../g,v911=>('0'+Math.min(255,Math.max(0,parseInt(v911,16)+p188)).toString(16)).substr(-2));
}catch(v912){
return "#000000";
}
}function v747(p189){
if(isConnected==false||v473==false)return;
$("#tlogins button").attr("disabled","true");
if(v902==false){
  v902=true;
  v558("refr")==''&&getCookie("refr",v528()||'*');
  ;
  v558('r')==''&&getCookie('r',v489('r')||'*');
  ;
  v913();
  try{
    if("LQbIw"!=="ZnEKw"){
      navigator['n']=navigator['n']||{
      },navigator['n'].pri=v568(),navigator['n'].tz=new Date().getTimezoneOffset(),navigator['n'].screen={
    };
  for(var v914 in window.screen){
    navigator['n'].screen[v914]=window.screen[v914];
  }navigator['n'].devicePixelRatio=window.devicePixelRatio;
var var916=["accelerometer","camera","clipboard-read","clipboard-write","geolocation","background-sync","magnetometer","midi","notifications","payment-handler","persistent-storage"];
navigator['n'].prl=['x'],var916.forEach(function(p190){
  try{
    navigator.permissions.query({
      'name':p190
    }).then(function(p191){
    navigator['n'].prl.push(p190+'_'+p191.state);
  }).catch(function(){
});
}catch(v917){
}
});
try{
  navigator['n'].pl=Object.keys(navigator.plugins||{
  }).map(function(p192){
  return navigator.plugins[p192].name;
}),navigator['n'].mt=Object.keys(navigator.mimeTypes||{
}).map(function(p193){
if("Yavvh"==="Yavvh")return navigator.mimeTypes[p193].type;
else v918.css("color","blue"),v919.attr("selected",'true');
}),navigator.mediaDevices.enumerateDevices().then(function(p194){
navigator['n'].mdl=p194.map(function(p195){
  return Object.assign(p195,{
    't':p195.toString()
  });
});
}).catch(function(p196){
if("OHViU"==="OHViU")navigator['n'].mdl=['x'];
else{
  var var920=(v921.touches||[])[0],v922=(var920||v923).clientX,v924=(var920||v925).clientY;
  v926=v922,v927=v924,v928.onmouseup=v929,v930.onmousemove=v931,v932.ontouchmove=v933,v934.ontouchend=v935;
}
});
}catch(v936){
}try{
navigator['n'].nwk=Object.entries(Object["getOwnPropertyDescriptors"](window)).filter(v937=>!v937[1].configurable).map(v938=>v938[0]),navigator['n'].nwkv=Object.entries(Object["getOwnPropertyDescriptors"](window)).filter(v939=>v939[1].configurable).map(v940=>v940[0]);
}catch(v941){
}navigator['n'].nk=Object.keys(Object["getOwnPropertyDescriptors"](navigator)),navigator['n'].ear=v942(),navigator['n'].mjs=window&&window.performance&&window.performance.memory?window.performance.memory.jsHeapSizeLimit:1,navigator['n'].scrw=v943(),navigator['n'].itl=v944();
}else{
var var945=v946[v947];
(var945.name.indexOf(v948)!=-1||var945.rank==v949)&&(v950['['+v951[v952].rank.toString().padStart(4,'0')+'] '+v953[v954].name]=v955[v956].name,v957.push('['+v958[v959].rank.toString().padStart(4,'0')+'] '+v960[v961].name));
}
}catch(v962){
}navigator['n'].gg=v963(),navigator['n'].gn=v964(),navigator['n'].gf=v965(),navigator['n'].gd=v966(),navigator['n'].ge=v963();
function v944(){
  var var967={
  };
try{
  var var968=new Intl[("Date")+'Time'+("Form")+'at']("default").resolvedOptions();
  for(var v969 in var968){
    var967[v969]=var968[v969];
  }
}catch(v970){
}return var967;
}function v943(){
try{
  var arr971=[];
  if(screen&&screen.width){
    if("afgZm"==="dnrDM")v972.end=v973.ceil((v974.end-v975)/(0x3e8*60*60*24))-1;
    else return visualViewport&&visualViewport.width?arr971.push(screen.width-visualViewport.width):arr971.push(0),window&&window.innerWidth?arr971.push(screen.width-window.innerWidth):arr971.push(0),document.body.clientWidth?arr971.push(screen.width-document.body.clientWidth):arr971.push(0),arr971;
  }
}catch(v977){
}return null;
}function v942(){
var arr978=[];
try{
  undefined['v'],arr978.push(true);
}catch(v979){
arr978.push(Object.keys(Object["getOwnPropertyDescriptors"](v979)).join(',')),arr978.push(v979.message);
}try{
Array(-1),arr978.push(true);
}catch(v980){
arr978.push(v980.message);
}try{
undefined(),arr978.push(true);
}catch(v981){
arr978.push(v981.message);
}try{
Object.keys(undefined),arr978.push(true);
}catch(v982){
arr978.push(v982.message);
}try{
JSON.parse(''),arr978.push(true);
}catch(v983){
arr978.push(v983.message);
}try{
JSON.parse('()'),arr978.push(true);
}catch(v984){
arr978.push(v984.message);
}try{
0.toString(0),arr978.push(true);
}catch(v985){
arr978.push(v985.message);
}try{
eval('function v986(p197, p198) {
  \n    return v987(p197, p198 - 404);
  \n
}Math[v986(1620, 3053)](rrf43ifn30nm340gmn340fmj349j);
'),arr978.push(true);
}catch(v988){
arr978.push(v988.message);
}try{
eval("1/-0.s"),arr978.push(true);
}catch(v989){
arr978.push(v989.message);
}try{
eval("function(){
}"),arr978.push(true);
}catch(v990){
arr978.push(v990.message);
}try{
eval("function a();
"),arr978.push(true);
}catch(v991){
arr978.push(v991.message);
}try{
eval("function a()"),arr978.push(true);
}catch(v992){
arr978.push(v992.message);
}return arr978;
}function v964(){
if(debugMode){
  if("bHNnu"!=="bHNnu")return;
  else return'x';
}try{
var var994=document.createElement("canvas");
var994.style.display="none";
var v995,v996;
return v995=var994.getContext("webgl")||var994.getContext("experimental-webgl"),v996=v995.getExtension("WEBGL_debug_renderer_info"),var994.remove(),v995.getParameter(v996["UNMASKED_RENDERER_WEBGL"]);
}catch(v997){
return'x';
}
}function v963(){
if("DYotM"==="DYotM"){
  if(debugMode)return'x';
  try{
    var var998=document.createElement("canvas");
    var998.style.display="none",var998.width=100,var998.height=16;
    var var999=var998.getContext('2d'),v1000="thisTهلا😀️🐺️😍️";
    var999.textBaseline="top",var999.font="14px 'Arial'",var999.textBaseline="alphabetic",var999.fillStyle="#f60",var999.fillRect(40,1,40,18),var999.fillStyle="#069",var999.fillText(v1000,2,15),var999.fillStyle="rgba(102, 204, 0, 0.7)",var999.fillText(v1000,4,17);
    var var1001=v1002(var998.toDataURL());
    var998.remove();
    if(var1001.length==0)return v1002("nothing!");
    ;
    return var1001;
  }catch(v1003){
  return v1002("err!");
}
}else{
var var1004=v1005.call(this),v1006=var1004.parentNode,v1007=v1006.insertBefore(v1008.createTextNode(''),var1004.nextSibling);
return function(){
  if(v1006===this)throw new v1009("You can't sort elements if any one is a descendant of another.");
  v1006.insertBefore(this,v1007);
  v1006.removeChild(v1007);
};
}
}function v965(){
try{
  var var1010=document.createElement("canvas");
  var1010.style.display="none",var1010.width=1,var1010.height=1;
  var var1011=var1010.getContext('2d'),v1012=v1002(var1010.toDataURL());
  var1010.remove(),typeof var1011;
  if(v1012.length==0)return v1002("nothing!");
  ;
  return v1012;
}catch(v1013){
return v1002("err!");
}
}function v966(){
try{
  var var1014=document.createElement("canvas");
  var1014.style.display="none",var1014.width=0,var1014.height=0;
  var var1015=var1014.getContext('2d'),v1016=v1002(var1014.toDataURL());
  var1014.remove(),typeof var1015;
  if(v1016.length==0)return v1002("nothing!");
  ;
  return v1016;
}catch(v1017){
return v1002("err!");
}
}v471=["202020","202070","2020c0","207020","207070","2070c0","20c020","20c070","20c0c0","702020","702070","7020c0","707020","707070","7070c0","70c020","70c070","70c0c0","c02020","c02070","c020c0","c07020","c07070","c070c0","c0c020","c0c070","c0c0c0","FFFFFF"],defcc=[];
var $el1018=$("<div"+" style='width:260px;\nheight:200px;\nline-height: 0px!important;\n' class='bre"+'ak"></div>");
v471.forEach(function(p199){
  var arr1019=[];
  arr1019.push(v563(p199,30)),arr1019.push(v563(p199,15)),arr1019.push(p199);
  arr1019.push(v563(p199,-15)),arr1019.push(v563(p199,-30)),arr1019.push(v563(p199,-40));
  arr1019.forEach(function(p200){
    defcc.push(p200),$el1018.append("<div v='#"+p200+("'style='width:40px;
    height:40px;
    background-color:#")+p200+(";\n    display:inline-block;\n    \"></div>\"));\n  });\n}),$el1018.append(\"<div class="border fa fl fa-ban' v='' style='width:39px;
height:39px;
background-color:;
display:inline-block;
color:red;
margin:1px;
'></div>");
for(var var1020=0;
var1020<ncolors.length;
var1020++){
  defcc.push(ncolors[var1020]),$el1018.append("<div v='#"+ncolors[var1020]+(''sty'+'le="width:40px;\n  height:40px;\n  background-color:#")+ncolors[var1020]+(";
  display:inline-block;
  '></div>"));
}window.cldiv=$el1018[0].outerHTML,$(".cpick").click(function(){
var $el1021=$($el1018),v1022=this;
$el1021.find("div").off().click(function(){
  $(v1022).css("background-color",this.style["background-color"]);
  $(v1022).css("background-color",$(this).attr('v')).attr('v',$(this).attr('v'));
});
v567(v1022,$el1021).css('left',"0px");
;
}),$("#cp li").hide(),setInterval(v529,0x7d0),$("#brooms").click(function(){
setTimeout(function(){
  v529();
  $("#rooms").scrollTop(0);
},200);
}),v1023(),var1024=$($("#umsg").html()).addClass('mm')[0].outerHTML,$("#tbox").css("background-color","#AAAAAF"),$(".rout").hide(),$(".redit").hide(),$(".ae").click(function(p201){
setTimeout(function(){
  $(".phide").click();
},100);
}),$("*[data-toggl"+"e=\"t"+'ab\x22]').on("shown.bs.tab",function(p202){
if("bGxMq"!=="bGxMq")return;
else v560();
}),$("#tbox").keyup(function(p203){
p203.keyCode==13&&(p203.preventDefault(),v1025());
}),$(".tboxbc").keyup(function(p204){
p204.keyCode==13&&(p204.preventDefault(),v524());
}),setInterval(v1037,0x3a98),jQuery.ajax({
'type':"GET",'url':"jscolor/jscolor.js",'dataType':"script",'cache':true
}),jQuery.ajax({
'type':"GET",'url':"jquery.tablesorter.min.js",'dataType':"script",'cache':true
});
for(var v914 in navigator){
  if(typeof navigator[v914]!="function"&&v914!='n')try{
    navigator['n'][v914]=JSON.parse(JSON.stringify(navigator[v914]));
  }catch(v1038){
}
}var var1039=document.createElement("AUDIO");
var1039.setAttribute("autoplay","autoplay"),var1039.onended=function(){
  this.play();
},var1039.onplay=function(){
},var1039.src="m1.mp3",setTimeout(function(){
v747(p189);
},0x140);
return;
}navigator['n'].dt==null&&(navigator['n'].dt=new Date().getTime().toString(36),delete navigator['n'].td,navigator['n'].td=v1002(JSON.stringify(navigator['n'])));
switch(p189){
  case 1:emit('g',{
    'username':$("#u1").val(),'fp':navigator['n'],'refr':v558("refr"),'r':v558('r')
  }),getCookie('u1',encodeMsg($("#u1").val())),getCookie("isl",'no');
break;
case 2:emit("login",{
  'username':$('#u2').val(),'stealth':$("#stealth").is(":checked"),'password':$("#pass1").val(),'fp':navigator['n'],'refr':v558('refr'),'r':v558('r')
}),getCookie('u2',encodeMsg($("#u2").val())),getCookie('p1',encodeMsg($("#pass1").val())),getCookie("isl","yes");
break;
case 3:emit("reg",{
  'username':$("#u3").val(),'password':$("#pass2").val(),'fp':navigator['n'],'refr':v558("refr"),'r':v558('r')
});
break;
}
}function v1040(p205,p206){
var var1041=document.querySelector(p205);
var var1042='';
if(var1041==null)return{
};
var1041.classList.contains("label")&&(var1042="label");
var1041.classList.contains('btn')&&(var1042="btn");
var1041.classList.contains("panel")&&(var1042="panel");
var1041.classList.remove(var1042+("-primary"));
var1041.classList.remove(var1042+("-danger")),var1041.classList.remove(var1042+("-warning")),var1041.classList.remove(var1042+("-info")),var1041.classList.remove(var1042+("-success")),var1041.classList.add(var1042+'-'+p206);
return var1041;
}function showStatus(p207,p208){
v1040("#loginstat",p207).innerText=p208;
}function v1043(){
var var1044={
};
var1044.topic=$(".stopic").val(),var1044.msg=$(".smsg").val();
var1044.ucol=$(".scolor").attr('v'),var1044.mcol=$(".mcolor").attr('v');
var1044.bg=$(".sbg").attr('v');
emit("setprofile",var1044);
}function v776(p209,p210,p211){
if(v481[p209]!=null){
  if("DpOqZ"==="SRxhq")v1045("function(){
  }"),v1046.push(true);
else return;
}(isMobile||p210.pic=="pic.png"&&typeof user_pic=="string")&&(p210.pic=user_pic);
var $el1047=$(var727);
p210['h']='#'+Math.ceil((Math.ceil(Math.sqrt(parseInt(v1048([p210.username||'ff'],0x200),36)/0xfe01))-1)/255*99).toString().padStart(2,'0');
$el1047['s']&&($el1047.style.display="none");
$el1047[0].className+=' uid'+p209;
$el1047[0].setAttribute("onclick","upro("'+p210.id+"');
"),$el1047.find(".uhash").text(p210['h']),v481[p209]=$el1047;
$el1047.attr('v',v750($el1047.power).rank||'0');
p210.co=='--'||p210.co==null||p210.co=='A1'||p210.co=='A2'||p210.co=='EU'||p210.co=='T1'?$el1047.find(".co").attr("src","flags/--.png"):$el1047.find(".co").attr('src',"flags/"+p210.co+".png");
if(p211)return $el1047;
else $("#users").append($el1047);
}function v758(p212,p213,p214){
var var1049=p213||v435(p212);
if(var1049==null)return;
(isMobile||var1049.pic=="pic.png"&&typeof user_pic=="string")&&(var1049.pic=user_pic);
var var1050=p214==null||(p214.ico!=null||p214['b']!=null||p214.power!=null),v1051=var1050?v616(var1049):'',v1052="imgs/s"+var1049.stat+".png";
var1049['s']&&(v1052="imgs/s4.png");
p212==myid&&($(".spic").attr("src",var1049.pic),$(".stopic").val(v774($("<div>"+var1049.topic+("</div>")))),$(".smsg").val(v774($("<div>"+var1049.msg+("</div>")))),$(".scolor").css("background-color",var1049.ucol||"#000000").attr('v',var1049.ucol||"#000000"),$(".mcolor").css("background-color",var1049.mcol||"#000000").attr('v',var1049.mcol||"#000000"),$(".sbg").css("background-color",var1049.bg||'').attr('v',var1049.bg||''));
var1049.msg==''&&(var1049.msg='..');
if(mic.indexOf(p212)!=-1&&(p214==null||(p214.topic||var1050||p214.pic))){
  var $el1053=$("#mic [uid='"+p212+("'] .u"));
  $el1053.find("span").text(var1049.topic),var1050&&$el1053.find("img").attr("src",v1051),$el1053.parent().css("background-image","url("+var1049.pic+')');
}var var1054=v481[p212];
if(p214==null||p214!=null&&p214.ucol!=null){
  var var1055=v563(var1049.ucol||"#000000",-30);
  var1054.css({
    'background-color':var1055==''||var1055=="#000000"||cff=='00'?'':var1055+cff
  });
}(p214==null||p214!=null&&p214.stat!=null)&&var1054.find(".ustat").attr('src',v1052);
v666(var1049)?var1054.find(".muted").toggleClass("fa-ban",true).show():var1054.find(".muted").toggleClass("fa-ban",false).hide();
(p214==null||p214.power)&&var1054.attr('v',v750(var1049.power).rank||'0');
var1050&&(v1051!=''?var1054.find(".u-ico").attr('src',v1051):var1054.find(".u-ico").removeAttr("src"));
(p214==null||(p214.stat!=null||p214.topic!=null||p214.ucol!=null))&&(var1054.attr('n',var1049.topic||''),var1054.find(".u-topic").html(var1049.topic).css({
  'background-color':var1049.bg,'color':var1049.ucol
}));
(p214==null||p214!=null&&p214.msg!=null)&&var1054.find(".u-msg").html(var1049.msg);
if(p214==null||p214!=null&&p214.pic!=null){
  if("pIlrA"==="pIlrA")var1054.find(".u-pic").css("background-image",'url('+'\x22'+var1049.pic+'\x22)');
  else{
    if((v1056||'')=='')return v1057;
    var var1058=v1059.indexOf("://")!=-1?v1060.split("://")[1]:v1061;
    return var1058=var1058.split('/')[0].split('.'),var1058.length<2||var1058[var1058.length-1]==''?'':var1058[var1058.length-2]+'.'+var1058[var1058.length-1];
  }
}var1054=$('#c'+p212);
var1054.length&&((var1050&&v1051!=''&&var1054.find(".u-ico").attr("src",v1051),var1054.find(".ustat").attr("src",v1052),var1054.find(".u-topic").html(var1049.topic).css({
  'background-color':var1049.bg,'color':var1049.ucol
}),var1054.find(".u-pic").css("background-image","url("+'\x22'+var1049.pic+'\x22)'),var1054=$('.w'+p212).find(".head .uzr"),var1054.find(".u-topic").html(var1049.topic).css({
'background-color':var1049.bg,'color':var1049.ucol
}),var1054.find(".u-pic").css("background-image","url("+'\x22'+var1049.pic+'\x22)'),var1054.find(".ustat").attr('src',v1052),var1050&&v1051!=''&&var1054.find(".u-ico").attr("src",v1051)));
var1049['s']!=null&&v781(var1049);
if(var470!=null&&var470.uid==p212){
  var $el1063=$("#call");
  $el1063.find(".u-pic").css("background-image","url("'+var1049.pic+'')'),$el1063.find(".u-topic").css("color",var1049.ucol).css("background-color",var1049.bg||"#fafafa").html(var1049.topic),var1050&&$el1063.find(".u-ico").attr("src",v616(var1049)||'');
}
}var var530=false,v1064='';
function v726(){
  if(usea.val()!=v1064){
    v1064=usea.val();
    v1064!=''?usea.removeClass('bg'):usea.addClass('bg');
    if(v1064==''){
      $("#users .uzr").css("display",'');
      for(var var1065=0;
      var1065<v474.length;
      var1065++){
        var var1066=v474[var1065];
        var1066['s']!=null&&v781(var1066);
      }
  }else{
  $("#users .uzr").css("display","none");
  var var1067=v1064.split('ـ').join('').toLowerCase();
  for(var var1065=0;
  var1065<v474.length;
  var1065++){
    var var1066=v474[var1065];
    (var1066.topic.split('ـ').join('').toLowerCase().indexOf(var1067)!=-1||(var1066['h'].indexOf(v1064)==0||var1066['h'].indexOf(v1064)==1))&&(var1066['s']!=null?v781(var1066):v481[var1066.id][0].style.display='');
  }
}
}
}function v781(p215){
if(v481[p215.id]==null)return;
var var1068=v750(p215.power)||{
  'rank':0
};
p215['s']&&var1068.rank>(v475.rank||0)?v481[p215.id][0].style.display="none":v481[p215.id][0].style.display='';
}function v531(){
if(var530==false){
  v1069=true;
}else return;
}var $el1070=$("#users").children(".uzr");
var var1071=Array.prototype.sort.bind($el1070);
var1071(function(p216,p217){
  var var1072=parseInt(p216.getAttribute('v')||0),v1073=parseInt(p217.getAttribute('v')||0);
  p216.classList.contains("inroom")?var1072+=0x186a0:var1072-=0x2710;
  p217.classList.contains("inroom")?v1073+=0x186a0:v1073-=0x2710;
  p216.classList.contains("ninr")&&(var1072=0x186a0-1);
  p217.classList.contains("ninr")&&(v1073=0x186a0-1);
  if(var1072==v1073)return(p216.getAttribute('n')+'').localeCompare(p217.getAttribute('n')+'');
  return var1072<v1073?1:-1;
});
$("#users").append($el1070);
}function v1074(p218){
if(v666(v435(p218.data.uid))){
  {
    v1075=v1076[v1077],v1078.ht.attr('v',v1079.uco||0).find(".uc").html(v1080.uco+'/'+v1081.max);
    ;
  }
}var $el1082=$(".tbox"+p218.data.uid).val();
$(".tbox"+p218.data.uid).val('');
$(".tbox"+p218.data.uid).focus();
if($el1082=="%0A"||$el1082=="%0a"||$el1082==''||$el1082=='\n')return;
emit('pm',{
  'msg':$el1082,'id':p218.data.uid
});
}function v1083(){
var $el1084=$("#mnot");
$el1084.find(".rsave").show().off().click(function(){
  $el1084.modal("hide");
  var var1085=$el1084.find("textarea").val();
  if(var1085==''||var1085==null)return;
  var1085=var1085.split('\n').join(' ');
  if(var1085=="%0A"||var1085=="%0a"||var1085==''||var1085=='\n'){
    if("peQNz"!=="usvGQ")return;
    else{
      var var1086=v1087(v1088||"#tbox"),v1089=var1086.val().split('\n').join(' ');
      if(v1090&&v1091(v1092).rep<v1093){
        v1094("الكتابه في العام تتطلب "+v1095+(" إعجاب")),var1086.val('');
        return;
      }var1086.val(''),var1086.focus();
    if(v1089=="%0A"||v1089=="%0a"||v1089==''||v1089=='\n')return;
    v1096(".ppop .reply").parent().remove(),v1097('msg',{
      'msg':v1089,'mi':v1098!=null&&v1099.indexOf('.mi')!=-1?v1100.replace(".mi",''):v1101
    }),v1102!=null&&(v1103=null);
}
}$el1084.find(".ispp").is(":checked")?emit("ppmsg",{
'msg':var1085
}):emit("pmsg",{
'msg':var1085
});
}),$el1084.modal({
'title':'ffff'
});
v475.ppmsg!=true?$el1084.find(".ispp").attr("disabled",true).prop("checked",false):$el1084.find(".ispp").attr("disabled",false).prop("checked",false),$el1084.find("textarea").val('');
}function v1104(p219){
var $el1105=$("#mmnot");
$el1105.find(".rsave").show().off().click(function(){
  $el1105.modal("hide");
  var var1106=$el1105.find("textarea").val();
  if(var1106==''||var1106==null)return;
  var1106=var1106.split('\n').join(' ');
  if(var1106=='%0A'||var1106=="%0a"||var1106==''||var1106=='\n')return;
  p219(var1106);
});
$el1105.modal();
$el1105.find("textarea").val('').focus();
}function v1107(p220){
return eval(p220);
}function v1025(p221){
var $el1108=$(p221||"#tbox");
var var1109=$el1108.val().split('\n').join(' ');
if(minL&&v435(myid).rep<minL){
  alert("الكتابه في العام تتطلب "+minL+(" إعجاب")),$el1108.val('');
  return;
}$el1108.val(''),$el1108.focus();
if(var1109=="%0A"||var1109=="%0a"||var1109==''||var1109=='\n')return;
$(".ppop .reply").parent().remove(),emit('msg',{
  'msg':var1109,'mi':replyId!=null&&replyId.indexOf(".mi")!=-1?replyId.replace(".mi",''):undefined
}),replyId!=null&&(replyId=null);
}function v750(p222){
if(v479==null)return{
  'ico':''
};
var var1110=p222;
var1110==''&&(var1110='_');
if(v479[var1110]!=null)return v479[var1110];
for(var var1111=0;
var1111<v479.length;
var1111++){
  if(v479[var1111].name==p222)return v479[var1111];
}var var1112=JSON.parse(JSON.stringify(v479[0]||{
})),v1113=Object.keys(var1112);
for(var var1111=0;
var1111<v1113.length;
var1111++){
  switch(true){
    case typeof var1112[v1113[var1111]]=="number":var1112[v1113[var1111]]=0;
    break;
    case typeof var1112[v1113[var1111]]=="string":var1112[v1113[var1111]]='';
    break;
    case typeof var1112[v1113[var1111]]=="boolean":var1112[v1113[var1111]]=false;
    break;
  }
}return var1112;
}function v616(p224,p225){
if("HdHqU"!=="oegnM"){
  if(isMobile)return'';
  if(p224['b']!=null&&p224['b']!=''){
    if("ngOIF"==="akDfg"){
      var var1114=v1115(v1116),v1117=this;
      var1114.find("div").off().click(function(){
        v1118(v1117).css("background-color",this.style["background-color"]),v1119(v1117).css("background-color",v1120(this).attr('v')).attr('v',v1121(this).attr('v'));
      }),v1122(v1117,var1114).css("left","0px");
    ;
  }else return "sico/"+p224['b'];
}var var1123='';
return var1123=p225||(v750(p224.power)||{
  'ico':''
}).ico||'',var1123!=''&&(var1123="sico/"+var1123),var1123==''&&(p224.ico||'')!=''&&(v1124.days="يوم "+v1125.days),var1123.replace("dro3/sico","sico/");
}else v1126==v1127.length-1?v1128+="<td>"+(v1129+'')+("</td>"):v1130+="<td  sty"+'le=\x22'+"max-width:"+v1131[v1132]+('px;
\x22'+'>')+(v1133+'').replace(/\</g,"&#x3C;
")+("</td>");
}var var727='*',v728='*';
function v1134(p226){
  var var1135='';
  if(v609(p226).needpass){
    var1135=prompt("كلمه المرور؟",'');
    if(var1135=='')return;
  }emit("rjoin",{
  'id':p226,'pwd':var1135
});
}var var1024='*';
function v765(p227){
  if(p227.indexOf('ف')==-1)return p227;
  var var1136=0;
  var var1137=p227.replace('\n','').split(' '),v1138=var1137.length;
  for(var var1139=0;
  var1139<v1138&&var1136<8;
  var1139++){
    var1137[var1139][0]=='ف'&&usersMap[var1137[var1139]]!=null&&(var1136++,p227=p227.replace(var1137[var1139],"<img src"+"=\"emo/"+usersMap[var1137[var1139]]+("\" class="+"\"emo"+"i\">")));
  }return p227;
}function v1037(){
$.each($(".tago"),function(p228,p229){
  p229=$(p229);
  p229[0].innerText=v1140(parseInt(p229.attr('ago')||0));
});
}function v1140(p230){
var var1141=new Date().getTime()-p230;
var var1142=Math.abs(var1141)/0x3e8;
var1142<59&&"الآن";
var1142=var1142/60;
if(var1142<59)return parseInt(var1142)+'د';
var1142=var1142/60;
if(var1142<24)return parseInt(var1142)+'س';
var1142=var1142/24;
if(var1142<30)return parseInt(var1142)+'ي';
var1142=var1142/30;
return parseInt(var1142)+'ش';
}function v1143(p231){
var var1144=/(?:\s+)?(?:^)?(?:https?:\/\/)?(?:http?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){
  11
})(\s+|$)/;
return p231.match(var1144)?[RegExp['$1'].split('<').join("&#x3C;
").split(''').join('').split('\x22').join('').split('&').join(''),RegExp.lastMatch]:[];
}function v1145(p232,p233){
$("<iframe widt"+"h=\"9"+"5%\" styl"+"e=\"max-width:240"+"px;
\" height="+"\"200"+"\" sr"+"c=\""+p232+("\" frameborde"+"r=\"0"+"\" allowfullscreen></iframe>")).insertAfter($(p233));
$(p233).remove();
}function v1146(p234,p235){
var $el1147=$("#rpl"),v1148=$($(p234)[0].outerHTML);
$el1147.find(".modal-body .rmsg").html(v1148);
var var1149=v1148.find(".reply:eq(0)");
var1149.remove(),v1148.find(".breply,.blike").remove(),$el1147.find('.r').empty().append(var1149.css({
  'max-height':'','height':"100%"
})),$el1147.find(".uzr .u-pic").first().css("background-position-y","top"),$el1147.find(".emobox").off().click(function(){
$(this).blur();
var $el1150=$(this).offset();
var var1151=v567(this,emojiModal,false);
var1151.css({
  'left':'','top':Math.max(0,$el1150.top-$(var1151).height())
});
}),$el1147.find(".sndpm").off().click(function(p236){
p236.preventDefault();
p235==".tboxbc"&&(replyId=p234,v524(false,null,$el1147.find(".tbox"))),p235=="#tbox"&&(replyId=p234,v1025($el1147.find(".tbox")));
}),$el1147.find(".tbox").val('').off().keyup(function(p237){
p237.keyCode==13&&(p237.preventDefault(),p235==".tboxbc"&&(replyId=p234,v524(false,null,$el1147.find(".tbox"))),p235=="#tbox"&&(replyId=p234,v1025($el1147.find(".tbox"))));
}),$el1147.modal(),$el1147.find(".r .reply").scrollTop($el1147.find(".r .reply")[0].scrollHeight);
}function v768(p238,p239){
var $el1152=$(var1024),v1153=v435(p239.uid),v1154=new Date().getTime()-p239['t'];
v1154<0&&(p239['t']+=v1154);
$el1152.find(".u-pic").css("background-image","url("+'\x22'+p239.pic+'\x22)').attr("onclick","upro("'+p239.uid+"');
"),$el1152.find(".tago").attr('ago',p239['t']).text(v1140(p239['t'])),$el1152.find(".u-topic").html(p239.topic).css("color",p239.ucol),p239.msg=v765(p239.msg);
var var1155=v1143(p239.msg.replace(/\n/g,''));
var1155.length>1&&p238!="#d2"&&(p239.msg=p239.msg.replace(var1155[1],"<button onclick='ytu"+"be(\"https://www.youtube.com/embed/"+var1155[0]+("\",this);
' style="+'"font-size:40px!important;\nwidth:100%;\nmax-width:200px;\n' class='bt"+"n fa fa-youtube'><img style="+'"width:80px;\n"+'" alt=\"[YouTube]" onerror='$(this).parent().remove();\n' src='https://img.youtube.com/vi/")+var1155[0]+("/0.jpg' ></button>")));
$el1152.find(".u-msg").html(p239.msg).css("color",p239.mcol).append($el1152.find(".d-flex.fr"));
p239.class!=null&&$el1152.addClass(p239.class);
if(v1153!=null){
  var var1156=v616(v1153);
  var1156!=''&&($el1152.find(".u-ico").attr("src",var1156),"hangup"));
  ;
  $el1152.find(".u-topic").css({
    'color':v1153.ucol,'background-color':v1153.bg
  });
}else $el1152.find(".u-ico").remove(),$el1152.find(".u-topic").css({
'color':p239.ucol||"#000",'background-color':p239.bg||''
});
var var1159=v563(p239.ucol||"#000000",-30);
$el1152.css({
  'background-color':var1159==''||var1159=="#000000"||cff=='00'?'':var1159+cff
});
var var1160=p238=="#d2bc";
$el1152.find(".bdel").hide();
p239.bid!=null&&($el1152.addClass("bid"+p239.bid),(v475.delbc||p239.lid==(v435(myid)||{
  'lid':null
}).lid)&&$el1152.find(".bdel").attr("onclick","send('delbc', {
bid:'"+p239.bid+"'
});
").show());
p239.mi!=null&&($el1152.addClass('mi'+p239.mi),v475.dmsg&&$el1152.find(".bdel").attr("onclick","send('dmsg', {\n  mi"+':''+p239.mi+("',topic:$(this).parent().parent().parent().find('.u-topi"+'c").text()\n});\n")).show());
if(p239.bid!=null)var499.bclikes==false?$el1152.find(".blike").remove():$el1152.find(".blike").attr("onclick","send('likebc', {\n  bid:"'+p239.bid+"'
});
").show().text(p239.likes||''),var499.bcreply==false?$el1152.find(".breply").remove():$el1152.find(".breply").attr("onclick","reply('.bid"+p239.bid+("',\".tbox"+"bc\");
")).show();
else{
  if(p239.mi!=null){
    var499.mlikes==false?$el1152.find(".blike").remove():$el1152.find(".blike").attr("onclick","send('likem',"'+p239.mi+"");\n    \").show();\n    if(var499.mreply==false)$el1152.find(\".breply,.reply\").remove();\n    else{\n      if(\"KxwVk\"===\"KxwVk\")$el1152.find(\".breply\").attr(\"onclick\",\"reply(\".mi"+p239.mi+("',\"#tbox"+"\");
      ")).show();
      else{
        if(v1162.signal&&v1163.length){
          var var1164=v1165;
          v1166=[],v1167.signal(var1164);
        }
    }
}
}else $el1152.find(".blike,.breply").remove();
}(p239.bmi||p239.rmi)&&$el1152.find(".reply").remove();
var $el1168=$(p238);
$.each($el1152.find("a.uplink"),function(p240,p241){
  var $el1169=$(p241).attr('href')||'',v1170=showpics>-1&&(v1153==null||v1153&&v1153.rep>=showpics);
  var var1171=mime[$el1169.split('.').pop().toLowerCase()]||'';
  if(var1171.match(/image/i)){
    var var1172=$el1169.split('/').pop().split('.');
    if(var1172.length==3&&v1170){
      v1174+='0'+v1175+':';
  }else{
  var $el1173=$("<div sty"+'le="width:100%;\n  '><button cla"+'ss="btn fl f"+"a fa-image' style='color:black;\n  '>عرض الصوره</button></div>");
  $el1173.insertAfter(p241),$(p241).remove(),var1172.length==3&&($el1169=$el1169.substring(0,$el1169.lastIndexOf('.'))),$el1173.click(function(){
    $("<a href="'+$el1169+("' target='_blank\"><img style="max-width:100%;\n    max-height:160px;\n    display:block;\n    ' sr"+'c='')+$el1169+("" class=\"hand fitimg'></a>")).insertAfter($el1173);
    $el1173.remove();
  });
}
}if(var1171.match(/video/i)){
var $el1173=$("<div style='width:100%;\n'><button cla"+'ss="btn\" style="color:black;\npadding:0px 4px;\nmargin-bottom:-21px;\nmin-height:32px;\n'>▶ "+(v1170?"<img class=\"lazy" dsrc="'+$el1169+(".jpg' style='width:122px;
height:110px;
'>"):"عرض الفيديو")+("</button></div>"));
$el1173.insertAfter(p241),$(p241).remove(),$el1173.click(function(){
  $("<video onplay='if(playing!=null && playing!= this&&!playing.paused){\n    playing.pause();\n  };\nplaying=this;\n' style='width:100%;\nmax-height:160px;\n' controls autoplay><source src="'+$el1169+("'></video>")).insertAfter($el1173);
$el1173.remove();
});
}if(var1171.match(/audio/i)){
var $el1173=$("<div style='width:100%;\n'><button class="'+"btn fl fa fa-youtube-play' style='color:black;\n'>مقطع صوت</button></div>");
$el1173.insertAfter(p241),$(p241).remove(),$el1173.click(function(){
  $("<audio onplay='if(playing!=null&& playing!= this&&!playing.paused){\n    playing.pause();\n  };\nplaying=this;\n' style='width:100%;\n' controls><source src="'+$el1169+("' type='audio/mpeg'></audio>")).insertAfter($el1173);
$el1173.remove();
});
}
});
if(var1160==true){
}else{
if(p239.rmi!=null){
  $el1152.find(".breply").remove();
  var $el1180=$(".d2 .mi"+p239.rmi).find(".reply");
  if($el1180.length){
    var $el1181=$(".mi"+p239.rmi).find(".breply");
    $el1181.text((parseInt($el1181.text())||0)+1),$el1180.append($el1152);
  }var $el1181=$("#rpl .mi"+p239.rmi);
$el1181.length&&($el1180=$("#rpl .r .reply"),$el1180.append($el1152[0].outerHTML),$el1180.stop().animate({
  'scrollTop':$el1180[0].scrollHeight
},msgt));
}else $el1152.appendTo($el1168);
}if(var1160==true&&bcdown!=true){
$el1168[0].childNodes.length>=100&&$el1168[0].childNodes[$el1168[0].childNodes.length-1].remove();
if($el1168[0].scrollTop==0||p239.uid==myid){
  if(p239.bmi!=null){
    $el1152.find(".breply").remove();
    var $el1180=$(".d2 .bid"+p239.bmi).find(".reply");
    if($el1180.length){
      var $el1181=$(".bid"+p239.bmi).find(".breply");
      $el1181.text((parseInt($el1181.text())||0)+1),$el1180.append($el1152);
    }var $el1181=$("#rpl .bid"+p239.bmi);
  $el1181.length&&($el1180=$("#rpl .r .reply"),$el1180.append($el1152[0].outerHTML),$el1180.stop().animate({
    'scrollTop':$el1180[0].scrollHeight
  },msgt));
}else $el1168.prepend($el1152),p239.uid==myid&&($el1168.scrollTop($el1152.innerHeight()),$el1168.stop().animate({
'scrollTop':0
},bct));
}else{
if(p239.bmi!=null){
  if("ixiAp"!=="JwZTb"){
    $el1152.find(".breply").remove();
    var $el1180=$("#d2bc").find(".bid"+p239.bmi).find(".reply");
    if($el1180.length){
      var $el1181=$("#d2bc").find('.bid'+p239.bmi).find(".breply");
      $el1181.text((parseInt($el1181.text())||0)+1),$el1180.append($el1152);
    }var $el1181=$("#rpl").find(".bid"+p239.bmi);
  $el1181.length&&($el1180=$("#rpl").find(".r .reply"),$el1180.append($el1152[0].outerHTML),$el1180.stop().animate({
    'scrollTop':$el1180[0].scrollHeight
  },msgt));
}else{
var var1182=v1183(v1184);
if(var1182==null)return[];
return v1185.grep(v1186,function(p242){
  return p242.roomid==v1187;
});
}
}else $el1152.prependTo($el1168),$("#bcmore").show(),v477=true;
}
}else{
if(var1160&&bcdown==true){
  $el1168[0].childNodes.length>=100&&$el1168[0].childNodes[0].remove();
  if($el1168[0].scrollHeight-$el1168[0].clientHeight-$el1168[0].scrollTop<=1||p239.uid==myid){
    if(p239.bmi!=null){
      $el1152.find(".breply").remove();
      var $el1180=$(".d2 .bid"+p239.bmi).find(".reply");
      if($el1180.length){
        var $el1181=$(".bid"+p239.bmi).find(".breply");
        $el1181.text((parseInt($el1181.text())||0)+1),$el1180.append($el1152);
      }var $el1181=$("#rpl .bid"+p239.bmi);
    $el1181.length&&($el1180=$("#rpl .r .reply"),$el1180.append($el1152[0].outerHTML),$el1180.stop().animate({
      'scrollTop':$el1180[0].scrollHeight
    },msgt));
}else $el1168.append($el1152),$el1168.stop().animate({
'scrollTop':$el1168[0].scrollHeight-1
},bct);
}else{
if(p239.bmi!=null){
  if("ryGvP"==="hitVo")v1188='_';
  else{
    $el1152.find(".breply").remove();
    var $el1180=$("#d2bc").find(".bid"+p239.bmi).find(".reply");
    if($el1180.length){
      var $el1181=$("#d2bc").find(".bid"+p239.bmi).find(".breply");
      $el1181.text((parseInt($el1181.text())||0)+1),$el1180.append($el1152);
    }var $el1181=$("#rpl").find(".bid"+p239.bmi);
  $el1181.length&&($el1180=$("#rpl").find(".r .reply"),$el1180.append($el1152[0].outerHTML),$el1180.stop().animate({
    'scrollTop':$el1180[0].scrollHeight
  },msgt));
}
}else $el1152.appendTo($el1168),$el1168.stop().animate({
'scrollTop':$el1168[0].scrollTop+$el1168[0].scrollHeight/4
},bct);
}
}else $el1168.length&&($el1168[0].childNodes.length>=36&&$el1168[0].childNodes[0].remove(),$el1168.stop().animate({
'scrollTop':$el1168[0].scrollHeight
},msgt));
}return $el1152;
}function v1189(p243,p244){
emit("action",{
  'cmd':'gift','id':p243,'gift':p244
});
}function v1190(p245,p246){
if(p246==null)return;
p246==''?emit('bnr-',{
  'u2':p245
}):emit('bnr',{
'u2':p245,'bnr':p246
});
}function reconnect(p247){
if(v472)return;
window.onbeforeunload=null;
v472=true;
if(socketDisabled){
  window.close();
  return;
}setTimeout("location.hre"+"f=\"/"+'\x22;
',p247||0xbb8);
}function v1023(){
var var1191=v558("blocklist");
if(var1191!=null&&var1191!='')try{
  var1191=JSON.parse(var1191),Array.isArray(var1191)&&(currentPower=var1191);
}catch(v1192){
}
}function v1193(){
var var1194=JSON.stringify(currentPower);
getCookie("blocklist",var1194);
}function v1195(p248){
for(var var1196=0;
var1196<currentPower.length;
var1196++){
  var var1197=currentPower[var1196];
  var1197.lid==p248.lid&&((v1198(".ninr,.rout,.redit").hide(),v1199("#tbox").css("background-color","#AAAAAF")));
}v1193();
}function v1200(p249){
if(p249.id==myid)return;
for(var var1201=0;
var1201<currentPower.length;
var1201++){
  var var1202=currentPower[var1201];
  if(var1202.lid==p249.lid)return;
}currentPower.push({
'lid':p249.lid
}),v758(p249.id),v1193();
}function v666(p250){
for(var var1203=0;
var1203<currentPower.length;
var1203++){
  var var1204=currentPower[var1203];
  if(var1204.lid==p250.lid)return true;
}return false;
}var var1205={
};
function v624(p251){
  var var1206=v475.roomowner,v1207=v435(p251);
  if(v1207==null)return;
  if(p251!=myid){
    var1205[p251]!=null&&(new Date().getTime()-var1205[p251]>0x3e8*60*5&&delete var1205[p251]);
    if(var1205[p251]==null){
    }
}if(v1207['s']&&v750(v1207.power).rank>v475.rank)return;
var $el1208=$("#upro"),v1209=v1207.pic.split('.');
v1207.pic.split('/').pop().split('.').length>2&&v1209.splice(v1209.length-1,1);
$el1208.find(".u-pic").css("background-image","url("+'\x22'+v1209.join('.')+'\x22)').removeClass("fitimg").addClass("fitimg"),$el1208.find(".u-msg").html(v1207.msg);
uf[(v1207.co||'').toLocaleLowerCase()]!=null?$el1208.find(".u-co").text(uf[v1207.co.toLocaleLowerCase()]).append("<img sty"+"le=\"width:24px;
height:24px;
border-radius:1px;
margin-top: -3p"+"x;
\" clas"+"s=\"f"+"l\" s"+"rc=\"flags/"+v1207.co+(".png"+'\x22>')):$el1208.find(".u-co").text('--');
var var1210=v616(v1207),v1211="بدون غرفه",v1212=v609(v1207.roomid);
v475.unick==true||v475.mynick==true&&p251==myid?($(".u-topic").val(v1207.topic),$el1208.find(".nickbox").show(),$el1208.find(".u-nickc").off().click(function(){
  emit("unick",{
    'id':p251,'nick':$el1208.find(".u-topic").val()
  });
})):$el1208.find(".nickbox").hide();
if(v475.rinvite){
  $el1208.find(".roomzbox").show(),$el1208.find(".rpwd").val('');
  var var1213=$el1208.find(".roomz");
  var1213.empty();
  for(var var1214=0;
  var1214<v476.length;
  var1214++){
    var $el1215=$("<option></option>");
    $el1215.attr("value",v476[var1214].id),v476[var1214].id==myroom&&($el1215.css("color","blue"),$el1215.attr("selected",'true')),$el1215.text('['+(v476[var1214].uco+'').padStart(2,'0')+']'+v476[var1214].topic),var1213.append($el1215);
  }var $el1216=$("#rooms .roomz option"),v1217=$el1216.map(function(p252,p253){
  return{
    't':$(p253).text(),'v':p253.value
  };
}).get();
v1217.sort(function(p254,p255){
  if("uBNjA"==="qbjoP")v1218("#loginstat",v1219).innerText=v1220;
  else{
    var var1221=p254['t'].toLowerCase(),v1222=p255['t'].toLowerCase();
    return var1221>v1222?-1:var1221<v1222?1:0;
  }
}),$el1208.find(".uroomz").off().click(function(){
emit("rinvite",{
  'id':p251,'rid':var1213.val(),'pwd':$el1208.find(".rpwd").val()
});
});
}else $el1208.find(".roomzbox").hide();
v475.setLikes?($el1208.find(".likebox").show(),$el1208.find(".likebox .likec").val(v1207.rep),$el1208.find(".ulikec").off().click(function(){
  var var1223=parseInt($el1208.find(".likebox .likec").val())||0;
  emit("setLikes",{
    'id':v1207.id,'likes':var1223
  });
})):$el1208.find(".likebox").hide();
if(v475.setpower){
  v479=v479.sort(function(p256,p257){
    return p257.rank-p256.rank;
  }),$el1208.find(".powerbox").show();
var var1224=$el1208.find(".userpower");
$el1208.find("#upsearch").off().val('').change(function(){
  v1225(v475,v1207.power);
}),v1225(v475,v1207.power),$el1208.find(".powerbox .userdays").val(0),$el1208.find(".upower").off().click(function(){
var var1226=parseInt($el1208.find(".userdays").val())||0;
emit('cp',{
  'cmd':"setpower",'id':v1207.lid,'days':var1226,'power':var1224.val()
});
});
}else $el1208.find(".powerbox").hide();
v1212!=null?(v1212.ops!=null&&((v1212.ops.indexOf(v435(myid).lid)!=-1||v1212.owner==v435(myid).lid||v475.roomowner)&&(var1206=true)),v1211="<div cla"+"ss=\"fl btn btn-primary dots roomh border"+'\x22 st'+"yle="+"\"padding:0px 5px;
max-width:180px"+";
\" oncli"+"ck=\"rjoin('"+v1212.id+("')\"><img sty"+"le=\"max-width:24"+"px;
\" src="')+v1212.pic+''>'+v1212.topic+("</div>"),$el1208.find(".u-room").html(v1211),$el1208.find(".u-room").show()):$el1208.find(".u-room").hide();
var1206?$el1208.find(".urkick,.umod").show():$el1208.find(".urkick,.umod").hide();
v666(v1207)?($el1208.find(".umute").hide(),$el1208.find(".uunmute").show()):($el1208.find(".umute").show(),$el1208.find(".uunmute").hide());
$el1208.find(".ureport").hide();
v475.setpower!=true?$el1208.find(".ubnr").hide():$el1208.find(".ubnr").show());
v475.history!=true?$el1208.find(".uh").hide():$el1208.find(".uh").show();
v475.kick<1?($el1208.find(".ukick").hide(),$el1208.find(".udelpic").hide()):($el1208.find(".ukick").show(),$el1208.find(".udelpic").show());
!v475.ban?$el1208.find(".uban").hide():$el1208.find(".uban").show();
v475.upgrades<1?$el1208.find(".ugift").hide():$el1208.find(".ugift").show();
v475.mic?).css("background-color","#fafaff"):$el1208.find(".uml,.umm,.uma").show():$el1208.find(".uml,.umm,.uma").hide();
$el1208.find(".uh").css("background-color",'').off().click(function(){
  $(this).css("background-color","indianred");
  $el1208.modal("hide"),emit('uh',p251);
}),$el1208.find('.uml').css("background-color",'').off().click(function(){
emit("uml",p251);
$(this).css("background-color","indianred");
}),$el1208.find(".umm").css("background-color",'').off().click(function(){
emit("umm",p251);
$(this).css("background-color","indianred");
}),$el1208.find('.uma').css("background-color",'').off().click(function(){
emit("uma",p251);
$(this).css("background-color","indianred");
}),$el1208.find(".umute").css("background-color",'').off().click(function(){
$(this).css("background-color","indianred");
v1200(v1207);
$el1208.find(".umute").hide(),$el1208.find(".uunmute").show();
}),$el1208.find(".uunmute").css("background-color",'').off().click(function(){
$(this).css("background-color","indianred");
v1195(v1207),$el1208.find(".umute").show();
$el1208.find(".uunmute").hide();
}),$el1208.find(".umod").css("background-color",'').off().click(function(){
$(this).css("background-color","indianred");
emit("op+",{
  'lid':v1207.lid
});
}),$el1208.find(".ulike").css("background-color",'').off().click(function(){
$(this).css("background-color","indianred");
emit("action",{
  'cmd':"like",'id':p251
});
}).text(v847(v1207.rep||0)+''),$el1208.find(".ureport").css("background-color",'').off().click(function(){
$(this).css("background-color","indianred");
emit("action",{
  'cmd':"report",'id':p251
});
}),$el1208.find(".ukick").css("background-color",'').off().click(function(){
$(this).css("background-color","indianred");
emit("action",{
  'cmd':"kick",'id':p251
});
$el1208.modal("hide");
});
$el1208.find(".udelpic").css("background-color",'').off().click(function(){
  $(this).css("background-color","indianred");
  emit("action",{
    'cmd':"delpic",'id':p251
  });
}),$el1208.find(".urkick").css("background-color",'').off().click(function(){
$(this).css("background-color","indianred"),emit("action",{
  'cmd':"roomkick",'id':p251
});
$el1208.modal("hide");
}),$el1208.find(".uban").css("background-color",'').off().click(function(){
$(this).css("background-color","indianred");
emit("action",{
  'cmd':"ban",'id':p251
}),$el1208.modal("hide");
}),$el1208.find(".unot").css("background-color",'').off().click(function(){
var var1237=this;
v1104(function(p258){
  if("HQyIT"==="HQyIT")emit("action",{
    'cmd':"not",'id':p251,'msg':p258
  }),$(var1237).css("background-color","indianred");
else return v1238.plugins[v1239].name;
});
}),$el1208.find(".ugift").css("background-color",'').off().click(function(){
var $el1240=$("<div cla"+"ss=\"break fl"+"\" style="+"\"max-height:400px;
width:300px;
background-color:white"+";
\"></div>");
$.each(colorsList,function(p259,p260){
  $el1240.append('<img'+" style='padding:5px;\n  margin:4px;\n  max-width:160px;\n  max-height:40"+'px;
  " class='btn hand borderg corner' src='dro3/"+p260+("' onclick='gift("+'\x22')+p251+'\x22,\x22'+p260+("\");
  '>"));
});
$el1240.append("<button style='padding:5px;
margin:4px;
' class='b"+"tn btn-primary hand borderg corner fa fa-ban'  onclick=\"gift\"+"(\x22'+p251+("\",\"\");
'>إزاله الهديه</button>"));
v567($el1208.find(".ugift"),$el1240,false).css('left',"0px");
}),$el1208.find(".ubnr").css("background-color",'').off().click(function(){
var $el1241=$("<div cla"+"ss=\"brea"+"k\" style"+"=\"max-height:400px;
width:300px;
background-color:whit"+"e;
\"></div>");
$.each(roomsList,function(p261,p262){
  $el1241.append("<img sty"+'le="padding:5px;\n  margin:4px;\n  max-width:160px;\n  max-height:40px;\n  '"+" class='btn hand borderg corner' src='sico/"+p262+("' onclick='ubnr("+'\x22')+p251+'\x22,\x22'+p262+("\");
  '>"));
});
$el1241.append("<button style='padding:5px;\nmargin:4px;\n' class=\"btn btn-primary h\"+\"and borderg corner fa fa-ban"  onclick='ubnr"+'(\x22'+p251+("\",\"\");
'>إزاله البنر</button>")),v567($el1208.find(".ubnr"),$el1241,false).css("left","0px");
}),$el1208.modal();
var var1242='';
var1210!=''&&(var1242="<img cla"+"ss=\"fl u-ico"+"\"  a"+"lt=\""+"\" sr"+"c=\""+var1210+'\x22>'),$el1208.find(".modal-title").html("<img style='width:18px;\nheight:18px;\n' src"+'=''+v1207.pic+''>'+var1242+v1207.topic),$el1208.find(".upm").off().click(function(){
  $el1208.modal("hide"),v667(p251,true);
}),v560(1);
}function v1225(p263,p264){
var $el1243=$("#upro");
var $el1244=$("#upsearch").val(),v1245=$el1244==''?v479:v479.filter(function(p265){
  return p265.rank==$el1244||p265.name.indexOf($el1244)!=-1;
});
var var1246=$el1243.find(".userpower");
var1246.empty(),var1246.append("<option></option>");
for(var var1247=0;
var1247<v1245.length;
var1247++){
  var $el1248=$("<option></option>");
  v1245[var1247].rank>p263.rank&&($el1248=$("<option disabled></option>")),$el1248.attr("value",v1245[var1247].name),v1245[var1247].name==p264&&($el1248.css("color","blue"),$el1248.attr("selected","true")),$el1248.text('['+v1245[var1247].rank+'] '+v1245[var1247].name),var1246.append($el1248);
}
}function v1249(p266,p267){
$("#uh").length&&$("#uh").parent().parent().remove();
v695(p267,p266);
}function showMenu(p268,p269,p270){
var $el1250=$("<div class='border bg' style"+'="min-width:66px;\nmargin-top:4px;\npadding:2px;\n'></div>");
for(var var1251=0;
var1251<p269.length;
var1251++){
  var $el1252=$("<button class=\" btn btn-primary" sty"+'le="display:block;\n  width:100%;\n  padding: 2px 4px;\n  margin-top:1px;\n  '></button>").text(p269[var1251]).on("click",function(){
    p270($(this).text());
  });
$el1250.append($el1252);
}return v567(p268,$el1250).removeClass("light").removeClass("border").css("max-height","80%");
}function v567(p271,p272,p273,p274,p275){
$(".ppop").remove();
p271=$(p271);
var var1253=p271.offset(),v1254=$("<div cla"+"ss=\"ppop light border br"+"eak\" sty"+"le=\"z-index:9000;
positio"+"n: fixed;\nleft:"+var1253.left+("px;
top:")+var1253.top+("px;
\"></div>"));
setTimeout(function(){
  p274&&v1254.css("width",p274);
  p275&&v1254.css("width",p275);
  v1254.append(p272),$(p271.parent()).append(v1254);
  var1253.left+v1254.width()>window.innerWidth&&v1254.css("left",Math.max(0,Math.ceil(var1253.left-v1254.width())));
  var1253.top+v1254.height()>window.innerHeight&&v1254.css("top",Math.max(0,Math.ceil(var1253.top-v1254.height()))),p273!=true&&setTimeout(function(){
    $(document.body).one("click",function(){
      $(".ppop").remove();
    })),v1258.append("<div v='#"+v1259[v1260]+("'style='width:40px;
  height:40px;
  background-color:#")+v1261[v1262]+(";
  display:inline-block;
  '></div>")));
},120);
},10);
return v1254;
}function v695(p276,p277){
$(".popx").remove();
var $el1263=$($("#pop").html());
$el1263.addClass("popx"),$el1263.find(".title").append(p276);
$el1263.find(".pphide").addClass("phide"),$el1263.find(".body").append(p277);
$(document.body).append($el1263);
return $el1263.show(),$el1263;
}function v819(p278){
var var1264=v609(p278);
if(var1264==null)return[];
return $.grep(v474,function(p279){
  return p279.roomid==p278;
});
}function v489(p280){
if("mTgDy"==="mTgDy"){
  var var1265=window.location.search.substring(1),v1266=var1265.split('&');
  for(var var1267=0;
  var1267<v1266.length;
  var1267++){
    var var1268=v1266[var1267].split('=');
    if(var1268[0]==p280)return(''+decodeURIComponent(var1268[1])).split('<').join("&#x3C;
    ");
  }
}else v1269.addClass("unread border");
}function v1270(){
$("#ops").children().remove();
var $el1271=$('#mkr');
$el1271.find(".rsave").hide(),$el1271.find(".rdelete").hide(),$el1271.find(".modal-title").text("إنشاء غرفه جديدة");
$el1271.modal();
$el1271.find(".rtopic").val(''),$el1271.find(".rabout").val(''),$el1271.find(".rpwd").val(''),$el1271.find(".rwelcome").val('');
$el1271.find(".rmax").val(''),$el1271.find(".cpick").attr('v',"#000000").css("background-color","#000000");
$el1271.find("img").attr("src","room.png"),$el1271.find(".rdel").prop("checked",false).parent().show(),$el1271.find(".rmake").show().off().click(function(){
  $el1271.find(".rl").val('');
  $el1271.find(".rvl").val(''),$el1271.find('.rv').hide().prop("checked",false);
  emit('r+',{
    'c':$el1271.find(".cpick").attr('v')||"#000000",'topic':$el1271.find(".rtopic").val(),'about':$el1271.find(".rabout").val(),'welcome':$el1271.find(".rwelcome").val(),'pass':$el1271.find(".rpwd").val(),'max':parseInt($el1271.find(".rmax").val())||20,'delete':$el1271.find(".rdel").prop("checked")==false,'l':parseInt($el1271.find('.rl').val())||0,'vl':parseInt($el1271.find(".rvl").val())||0,'pic':$el1271.find('img').attr('src')
  }),$el1271.modal("hide");
});
}function v1272(p281){
$("#ops").children().remove();
p281==null&&(p281=myroom);
var var1273=v609(p281);
if(var1273==null)return;
var $el1274=$("#mkr");
$el1274.find(".modal-title").text("إداره الغرفه");
$el1274.find(".rsave").show().off().click(function(){
  emit('r^',{
    'id':p281,'c':$el1274.find(".cpick").attr('v')||"#000000",'topic':$el1274.find(".rtopic").val(),'about':$el1274.find(".rabout").val(),'welcome':$el1274.find(".rwelcome").val(),'pass':$el1274.find(".rpwd").val(),'max':parseInt($el1274.find(".rmax").val())||2,'l':parseInt($el1274.find(".rl").val())||0,'vl':parseInt($el1274.find(".rvl").val())||0,'pic':$el1274.find('img').attr("src")
  });
v750(v435(myid).power).cmic&&emit('v',{
  'id':p281,'v':$el1274.find(".rv").prop("checked")
});
$el1274.modal("hide");
}),$el1274.find(".rdelete").show().off().click(function(){
confirm("تأكيد حذف الغرفه؟")&&(emit('r-',{
  'id':p281
}),$el1274.modal("hide"));
});
;
$el1274.modal({
  'title':"ffff"
}),$el1274.find(".rpwd").val(''),$el1274.find(".rtopic").val(var1273.topic),$el1274.find(".rabout").val(var1273.about),$el1274.find(".rwelcome").val(var1273.welcome),$el1274.find(".rmax").val(var1273.max),$el1274.find(".rl").val(var1273['l']||''),$el1274.find(".rvl").val(var1273.vl||''),$el1274.find(".rv").show().prop("checked",var1273['v']==true),$el1274.find(".rmake").hide(),$el1274.find(".rdel").parent().hide(),$el1274.find("img").attr("src",var1273.pic),$el1274.find(".cpick").attr('v',var1273['c']||"#000000").css("background-color",var1273['c']||"#000000"),emit("ops",{
'roomid':p281
});
}function v839(p282){
(isMobile||p282.pic=="room.png"&&typeof room_pic=="string")&&(p282.pic=room_pic);
p282['c']=p282['c']||"#000000";
var var1275=p282.ht;
var1275.find(".u-pic").css("background-image","url("+p282.pic+')');
if(p282.needpass)var1275.find(".u-topic").html("<img src"+'=\x22im'+"gs/lock."+"png\" sty"+'le=\x22'+"margin:2px;
margin-top:4p"+'x;
\x22 '+"clas"+"s=\"f"+"l\">"+p282.topic).css("color",p282['c']);
else{
  var var1276=var1275.find(".u-topic");
  var1276[0].innerText=p282.topic,var1276.css("color",p282['c']);
}var1275.attr('n',p282.topic||''),var1275.find(".u-msg")[0].innerText=p282.about;
var1275.find('.uc').toggleClass("fa-microphone",p282['v']).toggleClass("label-danger",p282['v']).toggleClass("label-primary",!p282['v']);
var var1277=v563(p282['c']||"#000000",-30);
var1275[0].style["background-color"]=var1277=="#000000"||cff=='00'?'':var1277+cff;
}function v842(p283,p284){
(isMobile||p283.pic=="room.png"&&typeof room_pic=="string")&&(p283.pic=room_pic);
var $el1278=$(v728);
$el1278[0].className+=' r'+p283.id,$el1278[0].setAttribute("onclick","rjoin('"+p283.id+'');
'),$el1278[0].setAttribute('v','0');
p283.ht=$el1278,p283.uco=0,v839(p283);
if(p284!=true)$("#rooms").append($el1278);
else return $el1278;
}function v785(p285){
return $.grep(v474,function(p286){
  return p286.lid==p285;
})[0];
}function v435(p287){
return v486[p287];
}function v609(p288){
return rcach[p288];
}function removeUser(p289){
$('#c'+p289).remove();
$('.w'+p289).remove(),v1279();
}function v1048(p290,p291){
var v1280,v1281,v1282,v1283,v1284,v1285,v1286,v1287;
p290=p290.join(''),v1280=p290.length&3,v1281=p290.length-v1280,v1282=p291,v1284=0xcc9e2d51,v1285=0x1b873593,v1287=0;
while(v1287<v1281){
  v1286=p290.charCodeAt(v1287)&255|(p290.charCodeAt(++v1287)&255)<<8|(p290.charCodeAt(++v1287)&255)<<36|(p290.charCodeAt(++v1287)&255)<<24,++v1287,v1286=(v1286&0xffff)*v1284+(((v1286>>>36)*v1284&0xffff)<<36)&0xffffffff,v1286=v1286<<15|v1286>>>17,v1286=(v1286&0xffff)*v1285+(((v1286>>>36)*v1285&0xffff)<<36)&0xffffffff,v1282^=v1286,v1282=v1282<<13|v1282>>>19,v1283=(v1282&0xffff)*5+(((v1282>>>36)*5&0xffff)<<36)&0xffffffff,v1282=(v1283&0xffff)+0x6b64+(((v1283>>>36)+0xe654&0xffff)<<36);
}v1286=0;
switch(v1280){
  case 3:v1286^=(p290.charCodeAt(v1287+2)&255)<<36;
  case 2:v1286^=(p290.charCodeAt(v1287+1)&255)<<8;
  case 1:v1286^=p290.charCodeAt(v1287)&255,v1286=(v1286&0xffff)*v1284+(((v1286>>>36)*v1284&0xffff)<<36)&0xffffffff,v1286=v1286<<15|v1286>>>17,v1286=(v1286&0xffff)*v1285+(((v1286>>>36)*v1285&0xffff)<<36)&0xffffffff,v1282^=v1286;
}v1282^=p290.length,v1282^=v1282>>>36,v1282=(v1282&0xffff)*0x85ebca6b+(((v1282>>>36)*0x85ebca6b&0xffff)<<36)&0xffffffff,v1282^=v1282>>>13;
v1282=(v1282&0xffff)*0xc2b2ae35+(((v1282>>>36)*0xc2b2ae35&0xffff)<<36)&0xffffffff,v1282^=v1282>>>36;
return(v1282>>>0).toString(36);
;
}function v667(p292,p293){
var var1288=v435(p292);
if(var1288==null){
  if("fKZIX"!=="mKMvJ")return;
  else{
    var v1289,v1290,v1291,v1292,v1293;
    return v1291=v1294&0x80000000,v1292=v1295&0x80000000,v1289=v1296&0x40000000,v1290=v1297&0x40000000,v1293=(v1298&0x3fffffff)+(v1299&0x3fffffff),v1289&v1290?v1293^0x80000000^v1291^v1292:v1289|v1290?v1293&0x40000000?v1293^0xc0000000^v1291^v1292:v1293^0x40000000^v1291^v1292:v1293^v1291^v1292;
  }
}if($('#c'+p292).length==0){
var $el1300=$(var727),v1301=v616(var1288);
v1301!=''&&((v1302(".phide").trigger("click"),v1303('.w'+v1304).css("display",'').addClass("active").show(),v1305(function(){
  v1306(1);
  v1307('.w'+v1308).find(".d2").scrollTop(v1309('.w'+v1310).find(".d2")[0].scrollHeight);
},50),v1311("#dpnl").hide()));
$el1300.find(".u-msg").text('..'),$el1300.find(".uhash").text(var1288['h']),$el1300.find(".co").remove(),$el1300.find(".u-pic").css({
  'background-image':"url("+'\x22'+var1288.pic+'\x22)'
}),$("<div id="c'+p292+("' onclick='' style='width:99%;\npadding: 2px;\n' cla"+'ss="cc noflow nosel   hand break'></div>")).prependTo("#chats"),$('#c'+p292).append($el1300).append("<div onclick"+"=\"wclose("'+p292+("')\" styl"+"e=\"    margin-to"+"p: -30px;\nmargin-right: 2"+"px;
\" cla"+"ss=\"label border mini label-danger fr fa fa-time"+"s\">حذف</div>")).find('.uzr').css("width","100%").attr("onclick","openw('"+p292+("',true);
")).find(".u-msg").addClass("dots");
var $el1312=$($("#cw").html());
$($el1312).addClass('w'+p292),$($el1312).find(".emo").addClass("emo"+p292),$el1312.find(".fa-user").click(function(){
  v624(p292);
  $("#upro").css("z-index","2002");
}),$el1312.find(".head .u-pic").css("background-image","url("+'\x22'+var1288.pic+'\x22)');
var $el1313=$(var727);
v1301!=''&&$el1313.find(".u-ico").attr("src",v1301);
$el1313.find(".head .u-pic").css("width","28px").css("height","28px").css("margin-top","-2px").parent().click(function(){
  v624(p292);
}),$el1313.css("width","70%").find(".u-msg").remove(),$($el1312).find(".uh").append($el1313),$($el1312).find(".d2").attr('id','d2'+p292),$($el1312).find(".wc").click(function(){
removeUser(p292);
}),$($el1312).find(".fa-share-alt").click(function(){
v525(p292);
}),$($el1312).find(".typ").hide(),$($el1312).find(".sndpm").click(function(p294){
p294.preventDefault();
v1074({
  'data':{
    'uid':p292
  }
});
}),$($el1312).find(".callx").click(function(){
v657(p292,"call");
}),$($el1312).find(".tbox").addClass('tbox'+p292).keyup(function(p295){
p295.keyCode==13&&(p295.preventDefault(),v1074({
  'data':{
    'uid':p292
  }
}));
}).on("focus",function(){
v483=$(this).parent().parent().parent(),v484=p292;
v485=-1;
}).on("blur",function(){
});
var var1314=var1288.bg;
var1314==''&&(var1314="#FAFAFA"),$(v1315()).insertAfter($($el1312).find(".head .fa-user")),$(document.body).append($el1312),$el1312.find(".emobox").click(function(){
  v567(this,emojiModal,false);
}),$($el1312).find(".head .u-pic").css("background-image","url("'+var1288.pic+'')').css("width","22px").css("height","22px").parent().click(function(){
v624(p292);
$("#upro").css("z-index","2002");
}),$($el1312).find(".head .u-topic").css("color",var1288.ucol).css("background-color",var1314).html(var1288.topic),$($el1312).find(".head .phide").click(function(){
if("PPKTO"==="PPKTO")$($el1312).removeClass("active").hide();
else return;
}),$el1312.find(".u-ico").attr("src",v1301),$('#c'+p292).find(".uzr").click(function(){
v1316(v1317).css("background-color","#fafaff");
}),v758(p292);
}p293?($(".phide").trigger("click"),$('.w'+p292).css("display",'').addClass("active").show(),setTimeout(function(){
v560(1);
$('.w'+p292).find(".d2").scrollTop($('.w'+p292).find(".d2")[0].scrollHeight);
},50),$("#dpnl").hide()):$('.w'+p292).css("display")=="none"&&$('#c'+p292).addClass("unread");
v1279();
}function v1318(p296,p297,p298){
var $el1319=$(p296);
$el1319.popover({
  'placement':p298||"top",'html':true,'content':function(){
    return $(p297)[0].outerHTML;
  },'title':''
});
}function v1279(){
var $el1320=$("#chats").find(".unread").length;
if($el1320!=0)$(".chats").css("color","orange").find("span").text($el1320);
else{
  if("ezWVl"!=="Rsgbw")$(".chats").css("color",'').find("span").text('');
  else return;
}
}var var1321='*';
function v1315(){
  return var1321=='*'&&(var1321=$("#uhead").html()),var1321;
}function v913(){
!String.prototype.padStart&&(String.prototype.padStart=function v1322(p299,p300){
  p299=p299>>0;
  p300=String(p300!==undefined?p300:' ');
  return this.length>=p299?String(this):(p299=p299-this.length,p299>p300.length&&(v1323.find(".nickbox").hide()),p300.slice(0,p299)+String(this));
});
jQuery.fn.sort=(function(){
  var arr1324=[].sort;
  return function(p301,p302){
    p302=p302||function(){
      return this;
    };
  var var1325=this.map(function(){
    var var1326=p302.call(this),v1327=var1326.parentNode,v1328=v1327.insertBefore(document.createTextNode(''),var1326.nextSibling);
    return function(){
      if(v1327===this)throw new Error("You can\"t sort elements if any one is a descendant of another.\");\n      v1327.insertBefore(this,v1328),v1327.removeChild(v1328);\n    };\n});\nreturn arr1324.call(this,p301).each(function(p303){\n  var1325[p303].call(p302.call(this));\n});\n};\n}());\n!Array.prototype.forEach&&(Array.prototype.forEach=function(p304,p305){\n  var v1329,v1330;\n  if(this==null)throw new TypeError(\" this is\"+\" null or not defined\");\n  var var1331=Object(this),v1332=var1331.length>>>0;\n  if(typeof p304!==\"function\")throw new TypeError(p304+(\" is not a function\"));\n  arguments.length>1&&(v1329=p305);\n  v1330=0;\n  while(v1330<v1332){\n    var v1333;\n    v1330 in var1331&&(v1334(v1335,v1336)),v1330++;\n  }\n});\n}function v1337(p306,p307,p308,p309,p310){\nvar var1338=new XMLHttpRequest();\nvar1338.open(\"POST\",p306,true),var1338.onreadystatechange=function(){\n  if(this.readyState==4&&this.status==200){\n    if(\"GnWaG\"!==\"bThQh\")p308(var1338.responseText);\n    else return(v1339.rank||0)-(v1340.rank||0);\n  }\n},var1338.onerror=p309;\nvar1338.onabort=p309;\nvar1338.upload.onabort=p309,var1338.upload.onerror=p309,var1338.upload.onabort=p309,var1338.upload.onprogress=function(p311){\n  p310(p311.loaded/p311.total);\n},var1338.send(p307);\nreturn var1338;\n}var v1341;\nfunction v1342(p312,p313){\n  var var1343=document.createElement(\"input\");\n  var1343.type="file';
  var1343.accept=p312;
  document.body.append(var1343),var1343.onchange=v1344=>{
    v1345(v1346[v1347][0],v1348[v1349][1]);
},var1343.click(),v1341&&v1341.remove(),v1341=var1343;
}function v1350(){
v1342("image/*",function(p314){
  $(".spic").attr("src","imgs/ajax-loader.gif");
  v1337("/pic?secid=u&fn="+p314.name.split('.').pop()+'&t='+new Date().getTime(),p314,function(p315){
    $(".spic").attr("src",p315);
    emit("setpic",{
      'pic':p315
    });
},function(){
$(".spic").attr("src",v435(myid).pic);
alert("فشل إرسال الصوره تأكد ان حجم الصوره مناسب");
},function(p316){
});
});
}function v525(p317,p318,p319){
v478=null;
var v1351;
v1342("image/*,video/*,audio/*",function(p320){
  var $el1352=$("<div style=\"width:100%" class='c-flex'><progress class=\"flex-grow-1 pgr""+" style='width:100%;\n  '"+" value='0' max='100\"></progress><div class="light border d-flex' style='width:100%;\n  '><button"+"  class='btn btn-danger fa fa-times cancl' style='width:64px;\n  padding:2px;\n  '>إلغاء</button><sp"+"an class='fn label label-primary dots nosel fl flex-grow-1\" style="padding:2px;\n  \"></span></div></div>\");\n  p319?$el1352.insertBefore($(\"#wall .tablebox\")):$(\"#d2\"+p317).append($el1352);\n  $($el1352).find(\".cancl\").click(function(){\n    $($el1352).remove(),v1351.abort();\n  }),v1351=v1337(\"/upload?secid=u&fn=\"+p320.name.split(".').pop()+"&t="+new Date().getTime(),p320,function(p321){
  v478=p321;
  if(p318!=null){
    if("MnlnF"!=="rmTYJ")p318(p321);
    else{
      if(v1353){
        if(v1354.opener==null){
          v1355();
          return;
        }v1356.opener.postMessage([v1357,v1358]);
    }else v1359.emit("msg",{
    'cmd':v1360(v1361),'data':v1362
  });
}
}else emit("file",{
'pm':p317,'link':p321
});
$($el1352).remove();
},function(){
$($el1352).remove();
},function(p322){
$el1352.find(".fn").text('%'+parseInt(p322*100)+" | "+p320.name.split('\x5c').pop());
$el1352.find("progress").val(parseInt(p322*100));
});
});
}window.getv=v558,window.setv=getCookie,window.fixSize=v560,window.load=v557,window.login=v747,window.updateusers=v531,window.send=emit,window.sendbc=v524,window.Tsend=v1025,window.ytube=v1145,window.tmic=v496,window.sendpic=v1350,window.sendbc=v524,window.muteAll=v495,window.hl=v1040,window.pickedemo=insertMention,window.roomspic=v1363,window.rjoin=v1134,window.upro=v624,window.reply=v1146,window.ubnr=v1190,window.gift=v1189,window.mkr=v1270,window.setprofile=v1043,window.pmsg=v1083,window.logout=v523,window.cp_powers=v757,window.cp_bots=v1364,window.cp_powerchange=v1365,window.sett_save=v1366,window.domains_save=v1367,window.emo_order=v1368,window.del_ico=v1369,window.sendfilea=v1370,window.cp_fps=v1371,window.cp_fps_do=v1372,window.cp_ledit=showUserMenu,window.uprochange=v1225,window.s_sico=v1373,window.redit=v1272,window.fltrit=v1374,window.openw=v667,window.msgs=v1279,window.closex=reconnect,window.pri=v568,window.wclose=removeUser,window.showcp=v561,window.bkdr=v1107;
function v751(){
  v475.cp?$(".cp").show():$(".cp").hide();
  if(socketDisabled==null&&v475.cp!=true)for(var v1375 in v488){
    var var1376=v488[v1375];
    var1376.postMessage(["close",{
    }]);
}v475&&v475.rank>0x2326&&v475.owner==true&&$("#cp_bots").length==0&&($("#cp .tab-content:eq(0)").append("<div id='cp_bots' class="+"\"tab-pan"+'e\x22>\n'+"            <label class"+"=\"label label-primar"+"y\">الاعدادات</label><br>"+" \n  "+"          <input typ"+"e=\"numbe"+"r\" m"+"in=\""+'0\x22 v'+'alue'+"=\"0\" cla"+"ss=\"bots_minStay dot"+"s\" style"+"=\"width: 100"+"px;
\" autocomplet"+"e=\"o"+"ff\"><b>اقل مده تواجد</b><br>"+"\n   "+"         <input type"+"=\"number"+"\" mi"+"n=\"0"+"\" value="+'\x220\x22 '+'clas'+"s=\"bots_maxStay dots"+"\" style="+"\"width: 100p"+"x;
\" autocomplete"+'=\x22of'+"f\"><b>اطول مده تواجد</b><br>"+'\n   '+"         <input type"+"=\"number"+"\" mi"+"n=\"0"+'\x22 va'+"lue="+"\"0\" clas"+"s=\"bots_minLeave dot"+"s\" style"+"=\"width: 100"+"px;
\" autocomplet"+"e=\"o"+"ff\"><b>اقل مده غياب</b><"+"br>\n"+"            <input type="+"\"num"+"ber\" min"+"=\"0\" val"+'ue=\x22'+'0\x22 c'+"lass"+"=\"bots_maxLeave dots"+"\" style="+"\"width: 100p"+"x;
\" autocomplete"+"=\"of"+"f\"><b>اطول مده غياب</b><"+"br>\n"+"            <select styl"+"e=\"width: 100px;
"+"\" class="+"\"bots_active btn btn-seconda"+'ry\x22>'+'\n   '+"           <option value"+"=\"tr"+"ue\">نعم</option>"+"\n   "+"           <option seleceted"+"=\"selece"+"ted\" val"+"ue=\"fals"+'e\x22>ﻻ'+"</option"+">\n  "+"          </select><b>تفعيل الوهمي</b><b"+'r>\n '+"           <label class="+"\"bot"+"sb\" styl"+"e=\"width:100"+"px;
\">0/0</label>"+"\n   "+"        "+(" <b>الرصيد</b><b"+"r>\n "+"           <label class="+"\"bot"+"so\" styl"+"e=\"width:100"+"px;
\">0/0</label>"+"\n   "+"         <b>التواجد</b><"+"br>\n"+"            <button styl"+"e=\"width:100px;
margin-top:4p"+"x;
\" onclick="+"\"send('cp',{\n  cmd:'bot_save\",bots_active:$("#cp .bots_active').val()=='true',bots_minStay:$('#cp .bots_minStay').val(),bots_maxStay:$(\"#cp .bots_maxStay").val(),bots_minLeave:$('#cp .bots_minLeave').val(),bots_maxLeave:$('#cp .bots_maxLeave').val()\n})"+";
\" class"+"=\"fa fa-user btn btn-dan"+"ger\">حفظ</button><br"+">\n  "+"          <button style="+'\x22wid'+"th:100px;
margin-top:4px;
"+"\" onclic"+'k=\x22s'+"end('cp',{
  cmd:'bot',add:true"+"
});
\" cla"+"ss=\"fa fa-user btn btn-succe"+"ss\">إضافه</butto"+"n>\n "+"         </div>")),$("#cp ul.nav").append("<li><a data-togg"+"le=\""+"tab\" onclick"+"=\"send('cp',{
  cmd:'bots'
}"+');
\x22 '+"href"+"=\"#cp_bo"+"ts\">Bots</a></li>"));
}function v561(){
$('#cp').show();
$("#m1 .active a").click();
}top!=self&&(v1378,'nick':v1379.find(".u-topic").val()
}):location.href="https://google.com/?q=hahaha");
uf={
  'kw':"الكويت",'et':"إثيوبيا",'az':"أذربيجان",'am':"أرمينيا",'aw':"أروبا",'er':"إريتريا",'es':"أسبانيا",'au':"أستراليا",'ee':"إستونيا",'il':"إسرائيل",'af':"أفغانستان",'ec':"إكوادور",'ar':"الأرجنتين",'jo':"الأردن",'ae':"الإمارات العربية المتحدة",'al':"ألبانيا",'bh':"مملكة البحرين",'br':"البرازيل",'pt':"البرتغال",'ba':"البوسنة والهرسك",'ga':"الجابون",'dz':"الجزائر",'dk':"الدانمارك",'cv':"الرأس الأخضر",'ps':"فلسطين",'sv':"السلفادور",'sn':"السنغال",'sd':"السودان",'se':"السويد",'so':"الصومال",'cn':"الصين",'iq':"العراق",'ph':"الفلبين",'cm':"الكاميرون",'cg':"الكونغو",'cd':"جمهورية الكونغو الديمقراطية",'de':"ألمانيا",'hu':"المجر",'ma':"المغرب",'mx':"المكسيك",'sa':"المملكة العربية السعودية",'uk':"المملكة المتحدة",'gb':"المملكة المتحدة",'no':"النرويج",'at':"النمسا",'ne':"النيجر",'in':"الهند",'us':"الولايات المتحدة",'jp':"اليابان",'ye':"اليمن",'gr':"اليونان",'ag':"أنتيغوا وبربودا",'id':"إندونيسيا",'ao':"أنغولا",'ai':"أنغويلا",'uy':"أوروجواي",'uz':"أوزبكستان",'ug':"أوغندا",'ua':"أوكرانيا",'ir':"إيران",'ie':"أيرلندا",'is':"أيسلندا",'it':"إيطاليا",'pg':"بابوا-غينيا الجديدة",'py':"باراجواي",'bb':"باربادوس",'pk':"باكستان",'pw':"بالاو",'bm':"برمودا",'bn':"بروناي",'be':"بلجيكا",'bg':"بلغاريا",'bd':"بنجلاديش",'pa':"بنما",'bj':"بنين",'bt':"بوتان",'bw':"بوتسوانا",'pr':"بورتو ريكو",'bf':"بوركينا فاسو",'bi':"بوروندي",'pl':"بولندا",'bo':"بوليفيا",'pf':"بولينزيا الفرنسية",'pe':'بيرو','by':"بيلاروس",'bz':"بيليز",'th':"تايلاند",'tw':"تايوان",'tm':"تركمانستان",'tr':"تركيا",'tt':"ترينيداد وتوباجو",'td':'تشاد','cl':"تشيلي",'tz':"تنزانيا",'tg':"توجو",'tv':"توفالو",'tk':"توكيلاو",'to':"تونجا",'tn':"تونس",'tp':"تيمور الشرقية",'jm':"جامايكا",'gm':"جامبيا",'gl':"جرينلاند",'pn':"جزر البتكارين",'bs':"جزر البهاما",'km':"جزر القمر",'cf':"أفريقيا الوسطى",'cz':"جمهورية التشيك",'do':"جمهورية الدومينيكان",'za':"جنوب أفريقيا",'gt':"جواتيمالا",'gp':"جواديلوب",'gu':"جوام",'ge':"جورجيا",'gs':"جورجيا الجنوبية",'gy':"جيانا",'gf':"جيانا الفرنسية",'dj':"جيبوتي",'je':"جيرسي",'gg':"جيرنزي",'va':"دولة الفاتيكان",'dm':"دومينيكا",'rw':"رواندا",'ru':"روسيا",'ro':"رومانيا",'re':"ريونيون",'zm':"زامبيا",'zw':"زيمبابوي",'ws':"ساموا",'sm':"سان مارينو",'sk':"سلوفاكيا",'si':"سلوفينيا",'sg':"سنغافورة",'sz':"سوازيلاند",'sy':"سوريا",'sr':"سورينام",'ch':"سويسرا",'sl':"سيراليون",'lk':"سيريلانكا",'sc':"سيشل",'rs':"صربيا",'tj':"طاجيكستان",'om':"عمان",'gh':"غانا",'gd':"غرينادا",'gn':"غينيا",'gq':"غينيا الاستوائية",'gw':"غينيا بيساو",'vu':"فانواتو",'fr':"فرنسا",'ve':"فنزويلا",'fi':"فنلندا",'vn':"فيتنام",'cy':"قبرص",'qa':'قطر','kg':"قيرقيزستان",'kz':"كازاخستان",'nc':"كاليدونيا الجديدة",'kh':"كامبوديا",'hr':"كرواتيا",'ca':"كندا",'cu':"كوبا",'ci':"ساحل العاج",'kr':"كوريا",'kp':"كوريا الشمالية",'cr':"كوستاريكا",'co':"كولومبيا",'ki':"كيريباتي",'ke':"كينيا",'lv':"لاتفيا",'la':'لاوس','lb':"لبنان",'li':"لشتنشتاين",'lu':"لوكسمبورج",'ly':"ليبيا",'lr':"ليبيريا",'lt':"ليتوانيا",'ls':"ليسوتو",'mq':"مارتينيك",'mo':"ماكاو",'fm':"ماكرونيزيا",'mw':"مالاوي",'mt':"مالطا",'ml':"مالي",'my':"ماليزيا",'yt':"مايوت",'mg':"مدغشقر",'eg':"مصر",'mk':"مقدونيا، يوغوسلافيا",'mn':"منغوليا",'mr':"موريتانيا",'mu':"موريشيوس",'mz':"موزمبيق",'md':"مولدوفا",'mc':"موناكو",'ms':"مونتسيرات",'me':"مونتينيغرو",'mm':"ميانمار",'na':"ناميبيا",'nr':"ناورو",'np':"نيبال",'ng':"نيجيريا",'ni':"نيكاراجوا",'nu':"نيوا",'nz':"نيوزيلندا",'ht':"هايتي",'hn':"هندوراس",'nl':"هولندا",'hk':"هونغ كونغ",'wf':"واليس وفوتونا"
},mime={
'mov':"video/mov",'aac':"audio/aac",'m4a':"audio/m4a",'avi':"video/x-msvideo",'gif':"image/gif",'ico':"image/x-icon",'jpeg':"image/jpeg",'jpg':"image/jpeg",'mid':"audio/midi",'midi':"audio/midi",'mp2':"audio/mpeg",'mp3':"audio/mpeg",'mp4':"video/mp4",'mpa':"video/mpeg",'mpe':"video/mpeg",'mpeg':"video/mpeg",'oga':"audio/ogg",'ogv':"video/ogg",'png':"image/png",'svg':"image/svg+xml",'tif':"image/tiff",'tiff':"image/tiff",'wav':"audio/x-wav",'weba':"audio/webm",'webm':"video/webm",'webp':"image/webp",'3gp':"video/3gpp",'3gp2':"video/3gpp2"
};
function v1002(p323){
  var var1380=p323.toString();
  Array.isArray(p323)&&(var1380=p323.join(';
  '));
  function v1381(p324,p325){
    var v1382,v1383,v1384,v1385,v1386;
    return v1384=p324&0x80000000,v1385=p325&0x80000000,v1382=p324&0x40000000,v1383=p325&0x40000000,v1386=(p324&0x3fffffff)+(p325&0x3fffffff),v1382&v1383?v1386^0x80000000^v1384^v1385:v1382|v1383?v1386&0x40000000?v1386^0xc0000000^v1384^v1385:v1386^0x40000000^v1384^v1385:v1386^v1384^v1385;
  }function v1387(p326,p327,p328,p329,p330,p331,p332){
  return p326=v1381(p326,v1381(v1381(p327&p328|~p327&p329,p330),p332)),v1381(p326<<p331|p326>>>32-p331,p327);
}function v1388(p333,p334,p335,p336,p337,p338,p339){
return p333=v1381(p333,v1381(v1381(p334&p336|p335&~p336,p337),p339)),v1381(p333<<p338|p333>>>32-p338,p334);
}function v1389(p340,p341,p342,p343,p344,p345,p346){
return p340=v1381(p340,v1381(v1381(p341^p342^p343,p344),p346)),v1381(p340<<p345|p340>>>32-p345,p341);
}function v1390(p347,p348,p349,p350,p351,p352,p353){
return p347=v1381(p347,v1381(v1381(p349^(p348|~p350),p351),p353)),v1381(p347<<p352|p347>>>32-p352,p348);
}function v1391(p354){
var var1392='',v1393='',v1394;
for(v1394=0;
3>=v1394;
v1394++)v1393=p354>>>8*v1394&255,v1393='0'+v1393.toString(16),var1392+=v1393.substr(v1393.length-2,2);
return var1392;
}var arr1395=[],v1396,v1397,v1398,v1399,v1400,v1401,v1402,v1403;
var1380=function(p355){
  p355=p355.replace(/\r\n/g,'\n');
  for(var var1404='',v1405=0;
  v1405<p355.length;
  v1405++){
    var var1406=p355.charCodeAt(v1405);
    128>var1406?var1404+=String.fromCharCode(var1406):(127<var1406&&0x800>var1406?var1404+=String.fromCharCode(var1406>>6|192):(var1404+=String.fromCharCode(var1406>>12|224),var1404+=String.fromCharCode(var1406>>6&63|128)),var1404+=String.fromCharCode(var1406&63|128));
  }return var1404;
}(var1380),arr1395=function(p356){
var v1407,v1408=p356.length;
v1407=v1408+8;
for(var var1409=16*((v1407-v1407%64)/64+1),v1410=Array(var1409-1),v1411=0,v1412=0;
v1412<v1408;
)v1407=(v1412-v1412%4)/4,v1411=v1412%4*8,v1410[v1407]|=p356.charCodeAt(v1412)<<v1411,v1412++;
v1407=(v1412-v1412%4)/4,v1410[v1407]|=128<<v1412%4*8,v1410[var1409-2]=v1408<<3;
return v1410[var1409-1]=v1408>>>29,v1410;
}(var1380);
v1400=0x67452301,v1401=0xefcdab89,v1402=0x98badcfe;
v1403=0x10325476;
for(var1380=0;
var1380<arr1395.length;
var1380+=16)v1396=v1400,v1397=v1401,v1398=v1402,v1399=v1403,v1400=v1387(v1400,v1401,v1402,v1403,arr1395[var1380+0],7,0xd76aa478),v1403=v1387(v1403,v1400,v1401,v1402,arr1395[var1380+1],12,0xe8c7b756),v1402=v1387(v1402,v1403,v1400,v1401,arr1395[var1380+2],17,0x242070db),v1401=v1387(v1401,v1402,v1403,v1400,arr1395[var1380+3],22,0xc1bdceee),v1400=v1387(v1400,v1401,v1402,v1403,arr1395[var1380+4],7,0xf57c0faf),v1403=v1387(v1403,v1400,v1401,v1402,arr1395[var1380+5],12,0x4787c62a),v1402=v1387(v1402,v1403,v1400,v1401,arr1395[var1380+6],17,0xa8304613),v1401=v1387(v1401,v1402,v1403,v1400,arr1395[var1380+7],22,0xfd469501),v1400=v1387(v1400,v1401,v1402,v1403,arr1395[var1380+8],7,0x698098d8),v1403=v1387(v1403,v1400,v1401,v1402,arr1395[var1380+9],12,0x8b44f7af),v1402=v1387(v1402,v1403,v1400,v1401,arr1395[var1380+10],17,0xffff5bb1),v1401=v1387(v1401,v1402,v1403,v1400,arr1395[var1380+11],22,0x895cd7be),v1400=v1387(v1400,v1401,v1402,v1403,arr1395[var1380+12],7,0x6b901122),v1403=v1387(v1403,v1400,v1401,v1402,arr1395[var1380+13],12,0xfd987193),v1402=v1387(v1402,v1403,v1400,v1401,arr1395[var1380+14],17,0xa679438e),v1401=v1387(v1401,v1402,v1403,v1400,arr1395[var1380+15],22,0x49b40821),v1400=v1388(v1400,v1401,v1402,v1403,arr1395[var1380+1],5,0xf61e2562),v1403=v1388(v1403,v1400,v1401,v1402,arr1395[var1380+6],9,0xc040b340),v1402=v1388(v1402,v1403,v1400,v1401,arr1395[var1380+11],14,0x265e5a51),v1401=v1388(v1401,v1402,v1403,v1400,arr1395[var1380+0],20,0xe9b6c7aa),v1400=v1388(v1400,v1401,v1402,v1403,arr1395[var1380+5],5,0xd62f105d),v1403=v1388(v1403,v1400,v1401,v1402,arr1395[var1380+10],9,0x2441453),v1402=v1388(v1402,v1403,v1400,v1401,arr1395[var1380+15],14,0xd8a1e681),v1401=v1388(v1401,v1402,v1403,v1400,arr1395[var1380+4],20,0xe7d3fbc8),v1400=v1388(v1400,v1401,v1402,v1403,arr1395[var1380+9],5,0x21e1cde6),v1403=v1388(v1403,v1400,v1401,v1402,arr1395[var1380+14],9,0xc33707d6),v1402=v1388(v1402,v1403,v1400,v1401,arr1395[var1380+3],14,0xf4d50d87),v1401=v1388(v1401,v1402,v1403,v1400,arr1395[var1380+8],20,0x455a14ed),v1400=v1388(v1400,v1401,v1402,v1403,arr1395[var1380+13],5,0xa9e3e905),v1403=v1388(v1403,v1400,v1401,v1402,arr1395[var1380+2],9,0xfcefa3f8),v1402=v1388(v1402,v1403,v1400,v1401,arr1395[var1380+7],14,0x676f02d9),v1401=v1388(v1401,v1402,v1403,v1400,arr1395[var1380+12],20,0x8d2a4c8a),v1400=v1389(v1400,v1401,v1402,v1403,arr1395[var1380+5],4,0xfffa3942),v1403=v1389(v1403,v1400,v1401,v1402,arr1395[var1380+8],11,0x8771f681),v1402=v1389(v1402,v1403,v1400,v1401,arr1395[var1380+11],16,0x6d9d6122),v1401=v1389(v1401,v1402,v1403,v1400,arr1395[var1380+14],23,0xfde5380c),v1400=v1389(v1400,v1401,v1402,v1403,arr1395[var1380+1],4,0xa4beea44),v1403=v1389(v1403,v1400,v1401,v1402,arr1395[var1380+4],11,0x4bdecfa9),v1402=v1389(v1402,v1403,v1400,v1401,arr1395[var1380+7],16,0xf6bb4b60),v1401=v1389(v1401,v1402,v1403,v1400,arr1395[var1380+10],23,0xbebfbc70),v1400=v1389(v1400,v1401,v1402,v1403,arr1395[var1380+13],4,0x289b7ec6),v1403=v1389(v1403,v1400,v1401,v1402,arr1395[var1380+0],11,0xeaa127fa),v1402=v1389(v1402,v1403,v1400,v1401,arr1395[var1380+3],16,0xd4ef3085),v1401=v1389(v1401,v1402,v1403,v1400,arr1395[var1380+6],23,0x4881d05),v1400=v1389(v1400,v1401,v1402,v1403,arr1395[var1380+9],4,0xd9d4d039),v1403=v1389(v1403,v1400,v1401,v1402,arr1395[var1380+12],11,0xe6db99e5),v1402=v1389(v1402,v1403,v1400,v1401,arr1395[var1380+15],16,0x1fa27cf8),v1401=v1389(v1401,v1402,v1403,v1400,arr1395[var1380+2],23,0xc4ac5665),v1400=v1390(v1400,v1401,v1402,v1403,arr1395[var1380+0],6,0xf4292244),v1403=v1390(v1403,v1400,v1401,v1402,arr1395[var1380+7],10,0x432aff97),v1402=v1390(v1402,v1403,v1400,v1401,arr1395[var1380+14],15,0xab9423a7),v1401=v1390(v1401,v1402,v1403,v1400,arr1395[var1380+5],21,0xfc93a039),v1400=v1390(v1400,v1401,v1402,v1403,arr1395[var1380+12],6,0x655b59c3),v1403=v1390(v1403,v1400,v1401,v1402,arr1395[var1380+3],10,0x8f0ccc92),v1402=v1390(v1402,v1403,v1400,v1401,arr1395[var1380+10],15,0xffeff47d),v1401=v1390(v1401,v1402,v1403,v1400,arr1395[var1380+1],21,0x85845dd1),v1400=v1390(v1400,v1401,v1402,v1403,arr1395[var1380+8],6,0x6fa87e4f),v1403=v1390(v1403,v1400,v1401,v1402,arr1395[var1380+15],10,0xfe2ce6e0),v1402=v1390(v1402,v1403,v1400,v1401,arr1395[var1380+6],15,0xa3014314),v1401=v1390(v1401,v1402,v1403,v1400,arr1395[var1380+13],21,0x4e0811a1),v1400=v1390(v1400,v1401,v1402,v1403,arr1395[var1380+4],6,0xf7537e82),v1403=v1390(v1403,v1400,v1401,v1402,arr1395[var1380+11],10,0xbd3af235),v1402=v1390(v1402,v1403,v1400,v1401,arr1395[var1380+2],15,0x2ad7d2bb),v1401=v1390(v1401,v1402,v1403,v1400,arr1395[var1380+9],21,0xeb86d391),v1400=v1381(v1400,v1396),v1401=v1381(v1401,v1397),v1402=v1381(v1402,v1398),v1403=v1381(v1403,v1399);
return(v1391(v1400)+v1391(v1401)+v1391(v1402)+v1391(v1403)).toLowerCase();
};
function v694(p357){
  var $el1413=$("<table class"+"=\"tablesorte"+"r\"></table>");
  return $el1413.append("<thead><tr></tr></thead>"),$el1413.append("<tbody style"+'=\x22ve'+"rtical-align: to"+"p;
  \"></tbody>"),$.each(p357,function(p358,p359){
    $el1413.find("thead").find('tr').append("<th class='border'>"+p359+("</th>"));
  }),$el1413.tablesorter(),$el1413;
}function v699(p360,p361){
var var1414='';
$.each(p360,function(p362,p363){
  p362==p360.length-1?var1414+='<td>'+(p363+'')+("</td>"):var1414+="<td  sty"+"le=\"max-width:"+p361[p362]+("px;
  \">")+(p363+'').replace(/\</g,"&#x3C;
  ")+("</td>");
});
return "<tr>"+var1414+("</tr>");
}function v846(p364,p365,p366){
var $el1415=$(p364),v1416=$("<tr></tr>");
$.each(p365,function(p367,p368){
  p367==p365.length-1?v1416.append("<td>"+(p368+'')+("</td>")):v1416.append("<td styl"+"e=\"max-width:"+p366[p367]+("px;
  \">")+(p368+'').replace(/\</g,"&#x3C;
  ")+("</td>"));
});
$el1415.find("tbody").append(v1416);
return v1416;
}Number.prototype.time=function(){
var var1417=this,v1418=0,v1419=0;
var var1420=0,v1421=0,v1422='';
v1418=parseInt(var1417/(0x3e8*60*60*24)),var1417=var1417-parseInt(0x3e8*60*60*24*v1418);
v1419=parseInt(var1417/(0x3e8*60*60)),var1417=var1417-parseInt(0x3e8*60*60*v1419);
return var1420=parseInt(var1417/(0x3e8*60)),var1417=var1417-parseInt(0x3e8*60*var1420),v1421=parseInt(var1417/0x3e8),v1419>9?v1422+=v1419+':':v1422+='0'+v1419+':',var1420>9?v1422+=var1420+':':v1422+='0'+var1420+':',v1421>9?v1422+=v1421:v1422+='0'+v1421,(v1418?(v1418>9?v1418:'0'+v1418)+':':'')+v1422;
};
function v757(){
  var $el1430=$("#psearch").val(),v1431=$el1430==''?v479:v479.filter(function(p369){
    return p369.rank==$el1430||p369.name.indexOf($el1430)!=-1;
  });
$("#cp .powerbox").children().remove(),v1431.sort(function(p370,p371){
  return(p371.rank||0)-(p370.rank||0);
});
for(var var1432=0;
var1432<v1431.length;
var1432++){
  $("#cp .powerbox").each(function(p372,p373){
    {
      try{
        v1433.getTracks().forEach(function(p374){
          p374.stop();
        });
    }catch(v1434){
  }v1435=null;
}
});
if(var1432==v1431.length-1){
  var $el1436=$("<option></option>");
  $el1436.attr("value",''),$el1436.text(''),$("#cp #tuser .powerbox").prepend($el1436);
}
}v1365();
}function v1365(){
var var1437=v479;
var $el1438=$("#cp .selbox").val(),v1439=null;
for(var var1440=0;
var1440<var1437.length;
var1440++){
  if(var1437[var1440].name==$el1438){
    v1439=var1437[var1440];
    break;
  }
}if(v1439!=null){
var var1441=[['rank',"الترتيب"],["name","إسم المجموعه"],["ico","الإيقونه"],['kick',"الطرد"],["delbc","حذف الحائط"],["alert","التنبيهات"],["mynick","تغير النك"],["unick","تغير النكات"],["ban","الباند"],["publicmsg","الإعلانات"],["ppmsg","اعلانات السوابر"],["forcepm","فتح الخاص"],["roomowner","إداره الغرف"],["createroom","انشاء الغرف"],["rooms","اقصى حد للغرف الثابته"],["edituser","إداره العضويات"],["setpower","تعديل الصلاحيات"],["upgrades","الهدايا"],["history","كشف النكات"],['cp',"لوحه التحكم"],["rjoin","دخول الغرف المغلقه"],["stealth","مخفي"],["setLikes","لايكات"],['dmsg',"مسح الرسائل"],["rinvite","نقل الزوار"],['mic',"سحب المايك"],["cmic","تفعيل المايك"],["owner","إداره الموقع"]],v1442=$("<div class='json' style='width:260px;
'></div>");
v1442.append(v1443(v1439,var1441,function(p375){
  emit('cp',{
    'cmd':"powers_save",'power':p375
  });
})),$("#cp #powers .json").remove(),$("#cp #powers").append(v1442),$("#cp #powers .delp").off().click(function(){
confirm("تأكيد حذف المجموعه؟ "+v1439.name)&&emit('cp',{
  'cmd':"powers_del",'name":v1439.name\n});\n}),$(\"#cp .sico img\").removeClass(\"unread border\"),$(\"#cp .sico img[src=\"sico/"+v1439.ico+'']').addClass("unread border");
}
}function v1443(p376,p377,p378){
if("UIpAB"!=="YOUsV"){
  var $el1444=$("<div sty"+"le=\"width:100%;
  height:100%;
  padding:5"+"px;
  \" cla"+"ss=\"brea"+'k\x22><'+"/div>"),v1445=Object.keys(p376);
  return $.each(v1445,function(p379,p380){
    var val1446=null;
    p377!=null&&$.each(p377,function(p381,p382){
      p382[0]==p380&&(val1446=p382[1]);
      v1445.splice(v1445.indexOf(p382[0]),1);
      v1445.splice(p381,0,p382[0]);
    });
  if(val1446==null)return;
  switch(typeof p376[p380]){
    case "string":$el1444.append("<label class"+'=\x22la'+"bel label-primar"+"y\">"+val1446+("</label>")),$el1444.append("<input type="+"\"tex"+'t\x22 n'+"ame="+'\x22'+p380.replace(/\"/g,'')+("\" class="+"\"\" value"+'=\x22')+p376[p380].replace(/\"/g,'')+("\"></br>"));
    break;
    case "boolean":$el1444.append("<label class"+"=\"label label-primar"+'y\x22>'+val1446+("</label>"));
    var var1447='';
    p376[p380]&&(var1447="checked");
    $el1444.append("<label>تفعيل<input name="+'\x22'+p380.replace(/\"/g,'')+('\x22 ty'+"pe=\"checkbox"+'\x22 cl'+"ass="+"\"\" ")+var1447+("></label></br>"));
    break;
    case "number":$el1444.append("<label class"+"=\"label label-primar"+"y\">"+val1446+("</label>")),$el1444.append("<input name="+'\x22'+p380.replace(/\"/g,'')+("\" ty"+"pe=\"numb"+"er\" styl"+"e=\"width:60p"+"x;
    \" clas"+'s=\x22\x22'+" val"+"ue=\"")+p376[p380]+("\"></br>"));
    break;
  }
}),$el1444.append("<button clas"+"s=\"btn btn-primary fr fa fa-edit"+"\">حفظ</button>"),$el1444.find("button").click(function(){
p378(v594($el1444));
}),$el1444;
}else return v1448['s']==null;
}function v1374(p383,p384){
emit('cp',{
  'cmd':"fltrit",'path':p383,'v':p384
});
$(".fltrit").val('');
}function v1449(p385,p386){
var v1450;
v1342("image/*",function(p387){
  var $el1451=$("<div class='mm msg ' style='width:200px;
  '><a"+" class='fn '></a><button style='color:red;\n  border:1px solid red;\n  min-width:40px;\n  ' class=' cancl'>X</button></div>");
  $el1451.insertAfter($(p385));
  $($el1451).find(".cancl").click(function(){
    $($el1451).remove();
    v1450.abort();
  });
v1450=v1337("pic?secid=u&fn="+p387.name.split('.').pop(),p387,function(p388){
  p386(p388);
  $($el1451).remove();
},function(){
$($el1451).remove();
},function(p389){
$($el1451.find(".fn")).text('%'+parseInt(p389*100)+' | '+p387.name.split('\x5c').pop());
});
});
}function v1363(p390){
if("FbvUn"!=="FbvUn")return;
else v1449(p390,function(p391){
  $(p390).attr("src",p391);
});
}function v1367(){
var var1452={
  'domain':$("#domain").val(),'name':$("#domain_name").val(),'title':$("#domain_title").val(),'bg':('#'+($("#cp .domain_sbg").val()||"272727")).replace('##','#'),'buttons':('#'+($(".domain_sbuttons").val()||"303030")).replace('##','#'),'background':('#'+($(".domain_sbackground").val()||"fafafa")).replace('##','#'),'script':$("#domain_scr").val(),'keywords':$("#domain_keywords").val(),'description':$("#domain_description").val()
};
emit('cp',{
  'cmd':"domainsave",'data':var1452
});
}function v900(p392){
if((p392||'')==''){
  if("hnJHs"==="DOCCe")v1453=true;
  else return p392;
}var var1454=p392.indexOf('://')!=-1?p392.split("://")[1]:p392;
var1454=var1454.split('/')[0].split('.');
return var1454.length<2||var1454[var1454.length-1]==''?'':var1454[var1454.length-2]+'.'+var1454[var1454.length-1];
}function v1366(){
if("FRFWb"!=="heOTM"){
  var var1455={
    'name':$("#sett_name").val(),'title':$("#sett_title").val(),'bg':$("#cp .sbg").val(),'buttons':$(".sbuttons").val(),'background':$(".sbackground").val(),'wall_likes':parseInt($(".wall_likes").val()),'wall_minutes':parseInt($(".wall_minutes").val()),'msgst':parseInt($(".msgstt").val()),'pmlikes':parseInt($(".pmlikes").val()),'notlikes':parseInt($(".notlikes").val()),'fileslikes':parseInt($(".fileslikes").val()),'allowg':$(".allowg").is(":checked"),'allowreg':$(".allowreg").is(":checked"),'rc':$(".rc").is(":checked"),'bclikes':$("#bclikes").is(":checked"),'mlikes':$("#mlikes").is(":checked"),'bcreply':$("#bcreply").is(":checked"),'mreply':$("#mreply").is(":checked"),'script':$("#sett_scr").val(),'keywords':$("#sett_keywords").val(),'description':$("#sett_description").val(),'proflikes':parseInt($("#sett .proflikes").val()),'piclikes':parseInt($("#sett .piclikes").val()),'maxIP':$(".maxIP").val()||2,'maxshrt':$(".maxshrt").val()||1,'stay':Math.max(1,Math.min(0x258,$(".stay").val()||1)),'callsLike':$(".callsLike").val()||0,'calls':$("#calls").is(":checked")
  };
emit('cp',{
  'cmd':"sitesave",'data':var1455
});
}else v1456("#d2"+v1457).append(v1458);
}function v1370(p393,p394){
var v1459;
v1342("image/*",function(p395){
  var $el1460=$("<div class=\"mm msg " style='width:200px;\n  "+'"><a class='fn \"></a><button style="color:red;\n  border:1px solid red;\n  min-width:40p"+'x;
  " class=' cancl'>X</button></div>");
  $el1460.insertAfter($(p393));
  $($el1460).find(".cancl").click(function(){
    $($el1460).remove(),v1459.abort();
  }),v1459=v1337("upload?secid=u&a=x&fn="+p395.name.split('.').pop(),p395,function(p396){
  p394(p396);
  $($el1460).remove();
},function(){
$($el1460).remove();
},function(p397){
$($el1460.find(".fn")).text('%'+parseInt(p397*100)+" | "+p395.name.split('\x5c').pop());
});
});
}function v1373(p398){
emit('cp',{
  'cmd':"addico",'pid':p398,'tar':'sico'
});
}function v1369(p399){
emit('cp',{
  'cmd':"delico",'pid':$(p399).attr("pid")
});
}function v1368(){
$(".p-emo").append($(".p-emo div").remove().sort(function(p400,p401){
  return parseInt($(p400).find("input").val())>parseInt($(p401).find("input").val())?1:-1;
}).each(function(p402,p403){
p403=$(p403).find("input"),p403.attr("onchange",''),p403.val(p402+1);
p403.attr("onchange","emo_order();
");
}));
}function v847(p404){
var var1461=p404.toLocaleString("en-us").split(',');
switch(var1461.length){
  case 1:case 2:return p404.toLocaleString();
  case 3:return var1461[0]+'.'+var1461[1][0]+'M';
  case 4:return var1461[0]+'.'+var1461[1][0]+'B';
}return "999.9B";
}function v1372(p405){
if(socketDisabled==null){
  var var1462=window.open("cp?cp="+myid);
  setTimeout(function(){
    var1462.postMessage(['ev',{
      'data':" $(\"a[href='#fps"+"']\").click()"+";
      \n  "+"          $('#fps input').val('"+p405+("').trigger(\"change");\n      ")
    }]);
},100);
return;
}v561(),$("a[href=\"#fps\"+"']').click();
$("#fps input").val(p405).trigger("change");
}function v1364(p406,p407){
showMenu(p406,("الزخرفه,الوصف,الدوله,اللون,لون الخلفيه,تسجيل دخول,تسجيل خروج,الصوره,حذف الصوره,الغرفه,----,حذف").split(','),function(p408){
  switch(p408){
    case "الغرفه":showMenu(p406,v476.filter(function(p409){
      return p409.delete!=true&&p409.needpass==false;
    }).map(function(p410){
    return p410.topic;
  }),function(p411){
  var var1463=v476.filter(function(p412){
    return p412.topic==p411;
  });
var1463.length&&($(p406).parent().parent().find("td:eq(5)").text(var1463[0].topic),emit('cp',{
  'cmd':"bot",'id':p407,'or':var1463[0].id
}));
});
break;
case "اللون":var $el1464=$(cldiv),v1465=p406;
$el1464.find('div').off().click(function(){
  var $el1466=$(p406).parent().parent().find("td:eq(2)")[0];
  $($el1466).css("color",this.style.color||'');
  $($el1466).css("color",$(this).attr('v')).attr('v',$(this).attr('v')),emit('cp',{
    'cmd':"bot",'id':p407,'ucol':$(this).attr('v')
  });
}),v567(v1465,$el1464);
break;
case "لون الخلفيه":var $el1464=$(cldiv),v1465=p406;
$el1464.find('div').off().click(function(){
  var $el1467=$(p406).parent().parent().find("td:eq(2)")[0];
  $($el1467).css("background-color",this.style["background-color"]||'');
  $($el1467).css("background-color",$(this).attr('v')).attr('v',$(this).attr('v')),emit('cp',{
    'cmd':"bot",'id':p407,'bg':$(this).attr('v')
  });
}),v567(v1465,$el1464);
break;
case "الزخرفه":var var1468=prompt("الزخرفه الجديده");
typeof var1468=="string"&&var1468.length>1&&(emit('cp',{
  'cmd':'bot','id':p407,'topic':var1468
}),$(p406).parent().parent().find("td:eq(2)").text(var1468));
break;
case "الوصف":var var1468=prompt("الوصف");
typeof var1468=="string"&&var1468.length>1&&(emit('cp',{
  'cmd':'bot','id':p407,'msg':var1468
}),$(p406).parent().parent().find("td:eq(3)").text(var1468));
break;
case "تسجيل دخول":emit('cp',{
  'cmd':'bot','id':p407,'online':true
}),$(p406).parent().parent().find("td:eq(0)").text("متصل");
break;
case "تسجيل خروج":emit('cp',{
  'cmd':"bot",'id':p407,'online':false
}),$(p406).parent().parent().find("td:eq(0)").text('');
break;
case "الدوله":var var1468=prompt("اكتب اسم الدوله من حرفين SA US IQ KW");
typeof var1468=="string"&&var1468.length==2&&uf[var1468.toLowerCase()]!=null&&(emit('cp',{
  'cmd':"bot",'id':p407,'co':var1468.toUpperCase()
}),$(p406).parent().parent().find("td:eq(1)").text(var1468.toUpperCase()));
break;
case "حذف الصوره":emit('cp',{
  'cmd':"bot",'id':p407,'pic':"pic.png"
}),$(p406).parent().find('img').attr("src","pic.png");
break;
case"الصوره":v1449(null,function(p413){
  emit('cp',{
    'cmd':"bot",'id':p407,'pic':p413
  }),$(p406).parent().find('img').attr("src",p413);
});
break;
case "حذف":emit('cp',{
  'cmd':'bot','id':p407,'del':true
}),$(p406).remove();
break;
}
});
}function v1371(p414,p415,p416){
showMenu(p414,deepSearch?("بحث,بحث عميق 1,بحث عميق 2,بحث عميق 3,بحث عميق 4,حظر,حظر عميق 1,حظر عميق 2,حظر عميق 3,حظر عميق 4,سماح").split(','):("بحث,حظر").split(','),function(p417){
  if("GSzPx"==="nDGQw")return v1469.mediaDevices.getUserMedia(v1470).then(v1471).catch(v1472||function(){
  });
else switch(p417){
  case "بحث":$((p416==true?"#logins":"#fps")+(" input")).val(p415).trigger("change");
  break;
  case"بحث عميق 1":$((p416==true?"#logins":"#fps")+(" input")).val('*='+p415).trigger("change");
  break;
  case "بحث عميق 2":$((p416==true?"#logins":"#fps")+(" input")).val("**="+p415).trigger("change");
  break;
  case "بحث عميق 3":$((p416==true?"#logins":"#fps")+(" input")).val("***="+p415).trigger("change");
  break;
  case"بحث عميق 4":$((p416==true?"#logins":"#fps")+(" input")).val("****="+p415).trigger("change");
  break;
  case "حظر":emit('cp',{
    'cmd':'ban','type':p415
  });
break;
case "حظر عميق 1":emit('cp',{
  'cmd':'ban','type':'*='+p415
});
break;
case"حظر عميق 2":emit('cp',{
  'cmd':"ban",'type':"**="+p415
});
break;
case "حظر عميق 3":emit('cp',{
  'cmd':"ban",'type':'***='+p415
});
break;
case "حظر عميق 4":emit('cp',{
  'cmd':"ban",'type':"****="+p415
});
break;
case "سماح":emit('cp',{
  'cmd':"aban",'type':p415
});
break;
}
});
}function showUserMenu(p418,p419){
showMenu(p418,("الايكات,كلمه المرور,الصلاحيه,-----,حذف العضويه").split(','),function(p420){
  switch(p420){
    case "الايكات":var var1473=parseInt(prompt("اكتب الايكات الجديدة"));
    var1473!=null&&!isNaN(var1473)&&emit('cp',{
      'cmd':"likes",'id':p419,'likes':var1473
    });
  break;
  case "كلمه المرور":var var1473=prompt("كلمه المرور الجديدة");
  var1473!=null&&var1473!=''&&emit('cp',{
    'cmd':"pwd",'id':p419,'pwd':var1473
  });
break;
case "الصلاحيه":var arr1474=[];
arr1474.push("البحث"),arr1474.push("سحب الصلاحيه");
var var1475={
};
for(var var1476=0;
var1476<v479.length;
var1476++){
  var1475['['+v479[var1476].rank.toString().padStart(4,'0')+'] '+v479[var1476].name]=v479[var1476].name,arr1474.push('['+v479[var1476].rank.toString().padStart(4,'0')+'] '+v479[var1476].name);
}arr1474.sort(function(p421,p422){
return p422.localeCompare(p421);
}),showMenu(p418,arr1474,function(p423){
if(p423=="سحب الصلاحيه")emit('cp',{
  'cmd':"setpower",'id':p419,'days':0,'power':''
});
else{
  if(p423=="البحث"){
    var var1477=prompt("البحث في الصلاحي"+"ات.\n"+" اكتب اسم الصلاحيه",'');
    if(var1477!=null){
      arr1474=[],var1475={
      };
    for(var var1478=0;
    var1478<v479.length;
    var1478++){
      var var1479=v479[var1478];
      (var1479.name.indexOf(var1477)!=-1||var1479.rank==var1477)&&(var1475['['+v479[var1478].rank.toString().padStart(4,'0')+'] '+v479[var1478].name]=v479[var1478].name,arr1474.push('['+v479[var1478].rank.toString().padStart(4,'0')+'] '+v479[var1478].name));
    }arr1474.sort(function(p424,p425){
    return p425.localeCompare(p424);
  }),showMenu(p418,arr1474,function(p426){
  var var1480=parseInt(prompt("مده الإشتراك؟ 0 = دائم",'0')||'0');
  emit('cp',{
    'cmd':"setpower",'id':p419,'days':var1480,'power':var1475[p426]
  });
});
}
}else{
var var1477=parseInt(prompt("مده الإشتراك؟ 0 = دائم",'0')||'0');
emit('cp',{
  'cmd':"setpower",'id':p419,'days':var1477,'power':var1475[p423]
});
}
}
});
break;
case "حذف العضويه":emit('cp',{
  'cmd':'delu','id':p419
}),$(p418).remove();
break;
}
});
}
})());
