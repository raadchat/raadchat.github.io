const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// إعداد الملفات العامة
app.use(express.static(path.join(__dirname, 'public')));

// قواعد البيانات في الذاكرة
let users = {}; 
let bans = []; // قائمة الحظر بالـ IP
let reservedNames = { "المدير": "123456" }; // أسماء محمية بكلمة سر

// مصفوفة الغرف (Rooms) كما يطلبها app.js
let rooms = [
    { id: 'main', name: 'غرفة الرعد العامة', users: 0, desc: 'أهلاً بالجميع في غرفتنا' },
    { id: 'sanaa', name: 'غرفة صنعاء', users: 0, desc: 'ترحيب حار لكل أهل اليمن' }
];

// نظام الرتب (Powers)
const powers = [
    { rank: 0, name: 'زائر', color: '#888' },
    { rank: 1, name: 'عضو', color: '#444' },
    { rank: 50, name: 'مشرف', color: '#2ecc71' },
    { rank: 90, name: 'إدارة', color: '#f39c12' },
    { rank: 100, name: 'المدير العام', color: '#e74c3c' }
];

io.on('connection', (socket) => {
    let clientIp = socket.handshake.address;

    // --- 1. معالجة حالات تسجيل الدخول ---
    socket.on('login', (data) => {
        // حالة الحظر
        if (bans.includes(clientIp)) {
            return socket.emit('login_error', { type: 'banned', msg: 'هذا الجهاز محظور من دخول الشات.' });
        }

        // حالة الاسم مكرر
        let isTaken = Object.values(users).some(u => u.name === data.name);
        if (isTaken) {
            return socket.emit('login_error', { type: 'taken', msg: 'هذا الاسم مستخدم حالياً، جرب اسماً آخر.' });
        }

        // حالة الاسم المحمي (Admin Check)
        if (reservedNames[data.name] && data.pass !== reservedNames[data.name]) {
            return socket.emit('login_error', { type: 'auth', msg: 'هذا الاسم محمي بكلمة مرور.' });
        }

        // حالة النجاح
        users[socket.id] = {
            id: socket.id,
            name: data.name,
            rank: data.rank || 0,
            room: data.room || 'main',
            pic: data.pic || '',
            ip: clientIp,
            token: Math.random().toString(36).substr(2) // التوكن الذي يطلبه app.js
        };

        // إرسال الردود المتسلسلة المطلوبة في app.js
        socket.emit('myid', socket.id);
        socket.emit('powers', powers);
        socket.emit('rooms', rooms);
        socket.emit('login_success', { 
            id: socket.id, 
            token: users[socket.id].token,
            rank: users[socket.id].rank 
        });

        // تحديث الجميع بقائمة المستخدمين
        io.emit('updateusers', users);
        console.log(`دخول: ${data.name} في ${users[socket.id].room}`);
    });

    // --- 2. نظام الرسائل (msgs) ---
    socket.on('send', (data) => {
        const user = users[socket.id];
        if (!user) return;

        if (data.to) { // رسالة خاصة (Private)
            io.to(data.to).emit('msgs', {
                from: socket.id,
                name: user.name,
                msg: data.msg,
                priv: true,
                color: data.color
            });
        } else { // رسالة عامة
            io.emit('msgs', {
                id: socket.id,
                name: user.name,
                msg: data.msg,
                rank: user.rank,
                color: data.color
            });
        }
    });

    // --- 3. أوامر الإدارة (cp) ---
    socket.on('cp', (data) => {
        const admin = users[socket.id];
        if (!admin || admin.rank < 50) return;

        switch (data.cmd) {
            case 'setpower': // تغيير الرتبة
                if (users[data.id] && admin.rank > data.rank) {
                    users[data.id].rank = data.rank;
                    io.emit('cp_powerchange', { id: data.id, newRank: data.rank });
                }
                break;
            
            case 'kick': // طرد
                if (users[data.id]) {
                    io.to(data.id).emit('kick', 'تم طردك من قبل الإدارة');
                }
                break;

            case 'ban': // حظر نهائي
                if (users[data.id]) {
                    bans.push(users[data.id].ip);
                    io.to(data.id).emit('kick', 'تم حظرك نهائياً من الشات');
                }
                break;

            case 'delpic': // حذف الصورة الشخصية
                io.emit('cp_done', { cmd: 'delpic', id: data.id });
                break;
        }
    });

    // --- 4. إشارات الوسائط (Mic & WebRTC) ---
    socket.on('tmic', () => {
        const user = users[socket.id];
        if (user) {
            socket.broadcast.emit('mic_on', { id: socket.id, name: user.name });
        }
    });

    socket.on('vchat', (data) => {
        // تمرير إشارات الفيديو بين الطرفين
        if (data.to) {
            io.to(data.to).emit('vchat', { from: socket.id, signal: data.signal });
        }
    });

    // --- 5. الخروج ---
    socket.on('disconnect', () => {
        if (users[socket.id]) {
            console.log('غادر:', users[socket.id].name);
            delete users[socket.id];
            io.emit('updateusers', users);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`السيرفر يعمل الآن على المنفذ ${PORT}`);
});
