const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Index.html'));
});

const users = {};
const bans = new Set();

const rooms = [
  { id: 'main', topic: 'غرفة الرعد العامة', welcome: 'أهلاً بالجميع في غرفتنا', users: 0 },
  { id: 'sanaa', topic: 'غرفة صنعاء', welcome: 'ترحيب حار لكل أهل اليمن', users: 0 },
];

const powers = [
  { rank: 0, name: 'زائر', color: '#888', ico: '' },
  { rank: 1, name: 'عضو', color: '#444', ico: '' },
  { rank: 50, name: 'مشرف', color: '#2ecc71', ico: '' },
  { rank: 90, name: 'إدارة', color: '#f39c12', ico: '' },
  { rank: 100, name: 'المدير العام', color: '#e74c3c', ico: '' },
];

const reservedNames = {
  'المدير': '123456',
};

function clientIp(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return socket.handshake.address;
}

function send(socket, cmd, data) {
  socket.emit('msg', { cmd, data });
}

function broadcast(cmd, data) {
  io.emit('msg', { cmd, data });
}

function updateRoomCounts() {
  rooms.forEach((room) => {
    room.users = Object.values(users).filter((user) => user.roomid === room.id || user.room === room.id).length;
  });
}

function userList() {
  return Object.values(users);
}

function makeUser(socket, data = {}, rank = 0) {
  const username = String(data.username || data.name || 'ضيف').trim().slice(0, 32) || 'ضيف';
  return {
    id: socket.id,
    lid: socket.id,
    uid: socket.id,
    username,
    name: username,
    topic: data.topic || '',
    msg: data.msg || '..',
    pic: data.pic || '',
    power: rank,
    rank,
    roomid: data.room || data.roomid || 'main',
    room: data.room || data.roomid || 'main',
    stat: 0,
    co: '--',
    bg: '',
    ucol: '#000000',
    mcol: '#000000',
    ip: clientIp(socket),
    token: Math.random().toString(36).slice(2),
  };
}

function completeLogin(socket, data = {}, rank = 0) {
  const ip = clientIp(socket);
  const username = String(data.username || data.name || 'ضيف').trim();

  if (bans.has(ip)) {
    send(socket, 'login', { msg: 'wrong' });
    socket.emit('login_error', { type: 'banned', msg: 'هذا الجهاز محظور من دخول الشات.' });
    return;
  }

  if (!username) {
    send(socket, 'login', { msg: 'badname' });
    return;
  }

  if (Object.values(users).some((user) => user.username === username && user.id !== socket.id)) {
    send(socket, 'login', { msg: 'usedname' });
    socket.emit('login_error', { type: 'taken', msg: 'هذا الاسم مستخدم حالياً، جرب اسماً آخر.' });
    return;
  }

  if (reservedNames[username] && data.password !== reservedNames[username] && data.pass !== reservedNames[username]) {
    send(socket, 'login', { msg: 'wrong' });
    socket.emit('login_error', { type: 'auth', msg: 'هذا الاسم محمي بكلمة مرور.' });
    return;
  }

  const user = makeUser(socket, data, rank);
  users[socket.id] = user;
  socket.join(user.roomid);
  updateRoomCounts();

  socket.emit('myid', socket.id);
  socket.emit('powers', powers);
  socket.emit('rooms', rooms);
  socket.emit('login_success', { id: socket.id, token: user.token, rank: user.rank });
  send(socket, 'login', { msg: 'ok', id: socket.id, ttoken: user.token });
  send(socket, 'powers', powers);
  send(socket, 'rlist', rooms);
  send(socket, 'ulist', userList());
  broadcast('u+', user);
  broadcast('ulist', userList());
  broadcast('rlist', rooms);
}

function handleAction(socket, action = {}) {
  const admin = users[socket.id];
  if (!admin || admin.rank < 50) return;

  const target = users[action.id];
  if (!target) return;

  if (action.cmd === 'kick' || action.cmd === 'roomkick') {
    io.to(target.id).emit('kick', 'تم طردك من قبل الإدارة');
    io.to(target.id).emit('msg', { cmd: 'close', data: 'تم طردك من قبل الإدارة' });
  }

  if (action.cmd === 'ban') {
    bans.add(target.ip);
    io.to(target.id).emit('kick', 'تم حظرك نهائياً من الشات');
    io.to(target.id).emit('msg', { cmd: 'close', data: 'تم حظرك نهائياً من الشات' });
  }

  if (action.cmd === 'setpower' && typeof action.rank === 'number') {
    target.rank = action.rank;
    target.power = action.rank;
    broadcast('u^', target);
    io.emit('cp_powerchange', { id: target.id, newRank: action.rank });
  }
}

io.on('connection', (socket) => {
  send(socket, 'server', { online: io.engine.clientsCount });
  send(socket, 'powers', powers);
  send(socket, 'rlist', rooms);
  send(socket, 'ulist', userList());
  send(socket, 'emos', []);
  send(socket, 'sico', []);
  send(socket, 'dro3', []);

  socket.on('login', (data) => completeLogin(socket, data, data?.rank || 0));

  socket.on('send', (data = {}) => {
    const user = users[socket.id];
    if (!user) return;

    const payload = {
      uid: socket.id,
      id: Date.now().toString(36),
      msg: data.msg || data.message || '',
      mcol: data.color || user.mcol || '#000000',
      roomid: user.roomid,
      pic: user.pic,
      topic: user.topic,
    };

    if (data.to) {
      io.to(data.to).emit('msgs', { from: socket.id, name: user.username, msg: payload.msg, priv: true, color: payload.mcol });
      io.to(data.to).emit('msg', { cmd: 'pmsg', data: payload });
      socket.emit('msg', { cmd: 'pmsg', data: payload });
    } else {
      io.emit('msgs', { id: socket.id, name: user.username, msg: payload.msg, rank: user.rank, color: payload.mcol });
      io.to(user.roomid).emit('msg', { cmd: 'msg', data: payload });
    }
  });

  socket.on('cp', (data) => handleAction(socket, data));

  socket.on('msg', ({ cmd, data } = {}) => {
    const user = users[socket.id];

    if (cmd === 'g' || cmd === 'login' || cmd === 'reg') {
      completeLogin(socket, data || {}, cmd === 'login' ? 1 : 0);
      return;
    }

    if (!user) return;

    if (cmd === 'msg') {
      const payload = {
        uid: socket.id,
        id: Date.now().toString(36),
        msg: data?.msg || '',
        mcol: user.mcol || '#000000',
        roomid: user.roomid,
        pic: user.pic,
        topic: user.topic,
      };
      io.to(user.roomid).emit('msg', { cmd: 'msg', data: payload });
      return;
    }

    if (cmd === 'rjoin') {
      const nextRoom = data?.id || 'main';
      socket.leave(user.roomid);
      user.roomid = nextRoom;
      user.room = nextRoom;
      socket.join(nextRoom);
      updateRoomCounts();
      broadcast('u^', user);
      broadcast('rlist', rooms);
      return;
    }

    if (cmd === 'setprofile') {
      Object.assign(user, {
        topic: data?.topic ?? user.topic,
        msg: data?.msg ?? user.msg,
        ucol: data?.ucol ?? user.ucol,
        mcol: data?.mcol ?? user.mcol,
        bg: data?.bg ?? user.bg,
      });
      broadcast('u^', user);
      return;
    }

    if (cmd === 'setpic') {
      user.pic = data?.pic || '';
      broadcast('u^', user);
      return;
    }

    if (cmd === 'action') {
      handleAction(socket, data);
    }
  });

  socket.on('tmic', () => {
    const user = users[socket.id];
    if (user) {
      socket.broadcast.emit('mic_on', { id: socket.id, name: user.username });
      socket.broadcast.emit('msg', { cmd: 'not', data: { msg: `${user.username} فتح المايك` } });
    }
  });

  socket.on('vchat', (data = {}) => {
    if (data.to) {
      io.to(data.to).emit('vchat', { from: socket.id, signal: data.signal });
    }
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      delete users[socket.id];
      updateRoomCounts();
      broadcast('u-', socket.id);
      broadcast('ulist', userList());
      broadcast('rlist', rooms);
    }
  });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Chat server running on ${HOST}:${PORT}`);
});
