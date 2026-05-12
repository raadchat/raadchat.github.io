/**
 * ================================================================
 * server.js - سيرفر شات الرعد
 * ================================================================
 */

const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ─── منع التخزين المؤقت في وضع التطوير ───
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'Index.html'))
);

// ================================================================
// البيانات العامة
// ================================================================

const users = {};       // { socketId: userObject }
const bans  = new Set();// عناوين IP المحظورة

const rooms = [
  { id: 'main',  topic: 'غرفة الرعد العامة',   welcome: 'أهلاً بالجميع في غرفتنا',     users: 0 },
  { id: 'sanaa', topic: 'غرفة صنعاء',           welcome: 'ترحيب حار لكل أهل اليمن',      users: 0 },
];

// مستويات الصلاحيات — يجب أن تتطابق مع ما يتوقعه الكلايت
const powers = [
  { rank: 0,   name: 'زائر',       color: '#888888', ico: '', cp: false, publicmsg: 1 },
  { rank: 1,   name: 'عضو',        color: '#444444', ico: '', cp: false, publicmsg: 1 },
  { rank: 50,  name: 'مشرف',       color: '#2ecc71', ico: '', cp: true,  publicmsg: 1 },
  { rank: 90,  name: 'إدارة',      color: '#f39c12', ico: '', cp: true,  publicmsg: 1 },
  { rank: 100, name: 'المدير العام', color: '#e74c3c', ico: '', cp: true,  publicmsg: 1 },
];

// أسماء محمية بكلمة مرور { name: password }
const reservedNames = {
  'المدير': '123456',
};
const fs = require('fs');

// الوظيفة المسؤولة عن سحب البيانات من المصفوفات وحفظها في الملف
function syncDataToFile() {
    // تجميع البيانات من المصفوفات المعرفة لديك
    const dataToStore = {
        users: users,   // يسحب من كائن users المعرف عندك
        rooms: rooms,   // يسحب من مصفوفة rooms
        powers: powers, // يسحب من مصفوفة powers
        lastSync: new Date().toLocaleString('ar-YE') // إضافة وقت التحديث
    };

    // تحويل البيانات لنص وحفظها في ملف getonline.json
    fs.writeFile('getonline', JSON.stringify(dataToStore, null, 4), (err) => {
        if (err) {
            console.error("خطأ أثناء إنشاء الملف:", err);
        } else {
            console.log("تم تحديث ملف getonline.json بنجاح!");
        }
    });
}

// استدعاء الوظيفة لإنشاء الملف لأول مرة
syncDataToFile();
app.get('/getonline', (req, res) => {
    // إرسال البيانات كـ JSON للمتصفح
    res.json({
        users: users,
        rooms: rooms,
        powers: powers
    });
});

// ================================================================
// دوال مساعدة
// ================================================================

/** استخراج IP الحقيقي للمستخدم */
function clientIp(socket) {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return socket.handshake.address;
}

/** إرسال أمر لمقبس واحد */
function send(socket, cmd, data) {
  socket.emit('msg', { cmd, data });
}

/** إرسال أمر لجميع المقابس */
function broadcast(cmd, data) {
  io.emit('msg', { cmd, data });
}

/** تحديث عداد المستخدمين في كل غرفة */
function updateRoomCounts() {
  rooms.forEach((room) => {
    room.users = Object.values(users).filter(
      (u) => u.roomid === room.id
    ).length;
  });
}

/** قائمة المستخدمين كمصفوفة */
function userList() {
  return Object.values(users);
}

/** إيجاد مستوى الصلاحية المناسب لرتبة معينة */
function getPowerByRank(rank) {
  let best = powers[0];
  for (const p of powers) {
    if (rank >= p.rank) best = p;
  }
  return best;
}

/** بناء كائن المستخدم الجديد */
function makeUser(socket, data = {}, rank = 0) {
  const username = String(data.username || data.name || 'ضيف').trim().slice(0, 32) || 'ضيف';
  const p = getPowerByRank(rank);
  return {
    id:       socket.id,
    lid:      socket.id,
    uid:      socket.id,
    username,
    name:     username,
    topic:    data.topic   || '',
    msg:      data.msg     || '..',
    pic:      data.pic     || '',
    power:    p.name,          // اسم المستوى (مطلوب للكلايت)
    rank,                       // الرقم العددي
    roomid:   data.room || data.roomid || 'main',
    room:     data.room || data.roomid || 'main',
    stat:     0,
    co:       '--',
    bg:       '',
    ucol:     '#000000',
    mcol:     '#000000',
    ip:       clientIp(socket),
    token:    Math.random().toString(36).slice(2),
    h:        '',               // الموقع (يمكن تعبئته لاحقاً)
  };
}

// ================================================================
// تسجيل الدخول
// ================================================================

function completeLogin(socket, data = {}, rank = 0) {
  const ip       = clientIp(socket);
  const username = String(data.username || data.name || 'ضيف').trim();

  // --- فحص الحظر ---
  if (bans.has(ip)) {
    send(socket, 'login', { msg: 'wrong' });
    socket.emit('login_error', { type: 'banned', msg: 'هذا الجهاز محظور من دخول الشات.' });
    return;
  }

  // --- فحص الاسم ---
  if (!username) {
    send(socket, 'login', { msg: 'badname' });
    return;
  }

  // --- الاسم مستخدم بالفعل ---
  if (Object.values(users).some((u) => u.username === username && u.id !== socket.id)) {
    send(socket, 'login', { msg: 'usedname' });
    socket.emit('login_error', { type: 'taken', msg: 'هذا الاسم مستخدم حالياً، جرب اسماً آخر.' });
    return;
  }

  // --- الاسم محمي بكلمة مرور ---
  if (
    reservedNames[username] &&
    data.password !== reservedNames[username] &&
    data.pass     !== reservedNames[username]
  ) {
    send(socket, 'login', { msg: 'wrong' });
    socket.emit('login_error', { type: 'auth', msg: 'هذا الاسم محمي بكلمة مرور.' });
    return;
  }

  // --- رفع الرتبة إذا كان الاسم محمياً وكلمة المرور صحيحة ---
  if (reservedNames[username]) rank = 100;

  // --- بناء المستخدم وتسجيله ---
  const user = makeUser(socket, data, rank);
  users[socket.id] = user;
  socket.join(user.roomid);
  updateRoomCounts();

  // إرسال الردود للمقبس الجديد
  socket.emit('myid',          socket.id);
  socket.emit('login_success', { id: socket.id, token: user.token, rank: user.rank });
  socket.emit('rooms',         rooms);
  socket.emit('powers',        powers);

  // الأوامر المتوقعة بصيغة { cmd, data }
  send(socket, 'login',  { msg: 'ok', id: socket.id, ttoken: user.token });
  send(socket, 'powers', powers);
  send(socket, 'rlist',  rooms);
  send(socket, 'ulist',  userList());

  // إشعار الكل بالمستخدم الجديد
  broadcast('u+',    user);
  broadcast('ulist', userList());
  broadcast('rlist', rooms);

  // ─── إرسال إشعار ترحيب للغرفة ───
  const roomObj = rooms.find((r) => r.id === user.roomid);
  if (roomObj && roomObj.welcome) {
    io.to(user.roomid).emit('msg', {
      cmd: 'not',
      data: { msg: `${user.username} انضم إلى ${roomObj.topic}` },
    });
  }
}

// ================================================================
// لوحة التحكم (Admin Actions)
// ================================================================

function handleAction(socket, action = {}) {
  const admin = users[socket.id];
  if (!admin || admin.rank < 50) return;

  const target = users[action.id];
  if (!target) return;

  // لا يمكن للمشرف التصرف ضد من رتبته أعلى أو مساوية
  if (target.rank >= admin.rank && admin.rank < 100) return;

  switch (action.cmd) {

    case 'kick':
    case 'roomkick':
      io.to(target.id).emit('kick', 'تم طردك من قبل الإدارة');
      send({ emit: (...a) => io.to(target.id).emit(...a) }, 'close', 'تم طردك من قبل الإدارة');
      // طرد حقيقي: قطع الاتصال بعد إشعار قصير
      setTimeout(() => {
        const s = io.sockets.sockets.get(target.id);
        if (s) s.disconnect(true);
      }, 1500);
      break;

    case 'ban':
      bans.add(target.ip);
      io.to(target.id).emit('kick', 'تم حظرك نهائياً من الشات');
      send({ emit: (...a) => io.to(target.id).emit(...a) }, 'close', 'تم حظرك نهائياً');
      setTimeout(() => {
        const s = io.sockets.sockets.get(target.id);
        if (s) s.disconnect(true);
      }, 1500);
      break;

    case 'setpower':
      if (typeof action.rank !== 'number') break;
      // لا يمكن منح رتبة أعلى من رتبة المشرف نفسه
      if (action.rank > admin.rank && admin.rank < 100) break;
      target.rank  = action.rank;
      target.power = getPowerByRank(action.rank).name;
      broadcast('u^', target);
      io.emit('cp_powerchange', { id: target.id, newRank: action.rank });
      break;
  }
}

// ================================================================
// Socket.IO — أحداث الاتصال
// ================================================================

io.on('connection', (socket) => {
  // إرسال البيانات الأولية للمتصل الجديد
  send(socket, 'server', { online: io.engine.clientsCount });
  send(socket, 'powers', powers);
  send(socket, 'rlist',  rooms);
  send(socket, 'ulist',  userList());
  send(socket, 'emos',   []);
  send(socket, 'sico',   []);
  send(socket, 'dro3',   []);

  // ─── تسجيل الدخول عبر حدث مستقل ───
  socket.on('login', (data = {}) => {
    completeLogin(socket, data, data?.rank || 1);
  });

  // ─── إرسال رسالة عبر حدث مستقل ───
  socket.on('send', (data = {}) => {
    const user = users[socket.id];
    if (!user) return;

    const payload = {
      uid:    socket.id,
      id:     Date.now().toString(36),
      msg:    data.msg || data.message || '',
      mcol:   data.color || user.mcol || '#000000',
      roomid: user.roomid,
      pic:    user.pic,
      topic:  user.topic,
      name:   user.username,
      rank:   user.rank,
    };

    if (data.to) {
      // رسالة خاصة
      io.to(data.to).emit('msgs', {
        from: socket.id, name: user.username,
        msg: payload.msg, priv: true, color: payload.mcol,
      });
      io.to(data.to).emit('msg', { cmd: 'pmsg', data: payload });
      socket.emit('msg', { cmd: 'pmsg', data: payload });
    } else {
      // رسالة عامة في الغرفة
      io.to(user.roomid).emit('msgs', {
        id: socket.id, name: user.username,
        msg: payload.msg, rank: user.rank, color: payload.mcol,
      });
      io.to(user.roomid).emit('msg', { cmd: 'msg', data: payload });
    }
  });

  // ─── أوامر لوحة التحكم ───
  socket.on('cp', (data) => handleAction(socket, data));

  // ─── الأوامر المجمعة عبر { cmd, data } ───
  socket.on('msg', ({ cmd, data } = {}) => {
    const user = users[socket.id];

    // ── تسجيل الدخول بأنماط مختلفة ──
    if (cmd === 'g') {
      completeLogin(socket, data || {}, 0);   // ضيف
      return;
    }
    if (cmd === 'login') {
      completeLogin(socket, data || {}, 1);   // عضو
      return;
    }
    if (cmd === 'reg') {
      // تسجيل حساب جديد — نفس منطق login في هذا السيرفر
      completeLogin(socket, data || {}, 1);
      return;
    }
    if (cmd === 'gh') {
      // إعادة اتصال بجلسة سابقة — نُعيد تسجيل الدخول إن وُجد token
      // (يمكن تطوير هذا لاحقاً بحفظ الجلسات)
      if (user) {
        send(socket, 'ok', {});
      }
      return;
    }

    if (!user) return;

    switch (cmd) {

      // إرسال رسالة
      case 'msg': {
        const payload = {
          uid:    socket.id,
          id:     Date.now().toString(36),
          msg:    data?.msg || '',
          mcol:   user.mcol || '#000000',
          roomid: user.roomid,
          pic:    user.pic,
          topic:  user.topic,
          name:   user.username,
          rank:   user.rank,
        };
        io.to(user.roomid).emit('msg', { cmd: 'msg', data: payload });
        break;
      }

      // الانضمام لغرفة أخرى
      case 'rjoin': {
        const nextRoom = data?.id || 'main';
        socket.leave(user.roomid);
        user.roomid = nextRoom;
        user.room   = nextRoom;
        socket.join(nextRoom);
        updateRoomCounts();
        broadcast('u^',    user);
        broadcast('rlist', rooms);
        // إرسال رسالة ترحيب بالغرفة الجديدة
        const rObj = rooms.find((r) => r.id === nextRoom);
        if (rObj) {
          send(socket, 'not', { msg: rObj.welcome || `أهلاً في ${rObj.topic}` });
        }
        break;
      }

      // تعديل الملف الشخصي
      case 'setprofile':
        Object.assign(user, {
          topic: data?.topic ?? user.topic,
          msg:   data?.msg   ?? user.msg,
          ucol:  data?.ucol  ?? user.ucol,
          mcol:  data?.mcol  ?? user.mcol,
          bg:    data?.bg    ?? user.bg,
        });
        broadcast('u^', user);
        break;

      // تغيير الصورة الشخصية
      case 'setpic':
        user.pic = data?.pic || '';
        broadcast('u^', user);
        break;

      // أوامر إدارية
      case 'action':
        handleAction(socket, data);
        break;

      // تسجيل الخروج
      case 'logout':
        socket.disconnect(true);
        break;
    }
  });

  // ─── المايك ───
  socket.on('tmic', () => {
    const user = users[socket.id];
    if (!user) return;
    socket.broadcast.emit('mic_on', { id: socket.id, name: user.username });
    socket.broadcast.emit('msg', {
      cmd: 'not',
      data: { msg: `${user.username} فتح المايك` },
    });
  });

  // ─── الدردشة المرئية (WebRTC signaling) ───
  socket.on('vchat', (data = {}) => {
    if (data.to) {
      io.to(data.to).emit('vchat', { from: socket.id, signal: data.signal });
    }
  });

  // ─── قطع الاتصال ───
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const user = users[socket.id];
      delete users[socket.id];
      updateRoomCounts();
      broadcast('u-',    socket.id);
      broadcast('ulist', userList());
      broadcast('rlist', rooms);
      // إشعار مغادرة
      io.to(user.roomid).emit('msg', {
        cmd: 'not',
        data: { msg: `${user.username} غادر الشات` },
      });
    }
  });
});

// ================================================================
// تشغيل السيرفر
// ================================================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`✅  Chat server running → http://${HOST}:${PORT}`);
});
