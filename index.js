const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// مجلد الملفات العامة (التي رفعتها أنت b.js, sm.js, x3.js)
app.use(express.static('public'));

// تخزين بيانات المستخدمين النشطين
let users = {};

io.on('connection', (socket) => {
    console.log('مستخدم جديد اتصل:', socket.id);

    // عند دخول المستخدم (حدث login من x3.js)
    socket.on('login', (userData) => {
        users[socket.id] = {
            id: socket.id,
            name: userData.name || "زائر",
            power: userData.power || 0, // الرتبة الافتراضية
            room: userData.room || "العامة",
            pic: userData.pic || ""
        };
        
        // تحديث قائمة المستخدمين عند الجميع
        io.emit('updateusers', users);
        console.log(`دخل ${users[socket.id].name} برتبة ${users[socket.id].power}`);
    });

    // معالجة أوامر الإدارة (Command Processor)
    socket.on('cp', (data) => {
        const sender = users[socket.id];
        
        // التحقق من الصلاحيات (نفس المنطق في x3.js)
        if (!sender || sender.power < 50) {
            return socket.emit('alert', 'ليست لديك صلاحية كافية!');
        }

        switch (data.cmd) {
            case 'setpower':
                // تحديث رتبة مستخدم وإبلاغ الجميع
                if (users[data.id]) {
                    users[data.id].power = data.power;
                    io.emit('cp_powerchange', { id: data.id, newPower: data.power });
                }
                break;

            case 'delpic':
                // إبلاغ المستخدمين بحذف صورة مستخدم معين
                io.emit('cp_done', { cmd: 'delpic', id: data.id });
                break;

            case 'ban':
                // طرد المستخدم المحظور
                if (users[data.id]) {
                    io.to(data.id).emit('kick', 'لقد تم حظرك من قبل الإدارة');
                }
                break;
        }
    });

    // إرسال الرسائل (حدث send من x3.js)
    socket.on('send', (msgData) => {
        const user = users[socket.id];
        if (user) {
            io.emit('msg', {
                id: socket.id,
                name: user.name,
                text: msgData.text,
                power: user.power
            });
        }
    });

    // عند انقطاع الاتصال
    socket.on('disconnect', () => {
        if (users[socket.id]) {
            console.log(`غادر: ${users[socket.id].name}`);
            delete users[socket.id];
            io.emit('updateusers', users);
        }
    });
});

// تشغيل السيرفر على منفذ 3000
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`السيرفر يعمل الآن على الرابط المجاني: http://localhost:${PORT}`);
});
