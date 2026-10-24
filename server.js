const { WebcastPushConnection } = require('tiktok-live-connector');
const { Server } = require('socket.io');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- CONFIGURACIÓN DE USUARIOS Y TIKTOK ---
const ADMIN_USERS = {
    "Soralus": "Soralus700.",
    "Nexus": "Nexus69<3"
};
const TIKTOK_USER = "salomyn_06"; // Usuario de TikTok a leer

let tiktokLiveConnection = null;
let topContributors = {};
let totalLikesSession = 0;
let isConnected = false;

io.on('connection', (socket) => {
    console.log('Página web conectada al servidor');
    
    // Si la página se recarga, enviar los datos que ya estaban
    socket.emit('update_data', { totalLikes: totalLikesSession, top: topContributors });

    // Escuchar el Login Secreto de cualquiera de los 2 usuarios
    socket.on('admin_login', (data) => {
        const { username, password } = data;
        
        // Verificar si el usuario existe y la contraseña coincide
        if (ADMIN_USERS[username] && ADMIN_USERS[username] === password) {
            if (!isConnected) {
                socket.emit('alert_msg', `✅ Bienvenido ${username}. Iniciando conexión con TikTok...`);
                startTikTokConnection();
            } else {
                socket.emit('alert_msg', `⚠️ Hola ${username}, el sistema ya está conectado al Live.`);
            }
        } else {
            socket.emit('alert_msg', '❌ Usuario o contraseña incorrectos.');
        }
    });
});

function startTikTokConnection() {
    tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USER);
    
    tiktokLiveConnection.connect().then(state => {
        isConnected = true;
        console.log(`Conectado al Live de: ${state.roomInfo.owner.display_id}`);
        io.emit('alert_msg', '📡 ¡Conectado al Live exitosamente!');
    }).catch(err => {
        io.emit('alert_msg', '❌ Error: Nexus no está en vivo o hay un bloqueo.');
        isConnected = false;
    });

    // Leer los Tap Taps (Likes)
    tiktokLiveConnection.on('like', data => {
        totalLikesSession = data.totalLikeCount;
        
        // Registrar Top Contribuidores
        if (!topContributors[data.userId]) {
            topContributors[data.userId] = {
                nickname: data.nickname,
                avatarUrl: data.profilePictureUrl,
                likes: 0
            };
        }
        topContributors[data.userId].likes += data.likeCount;

        // Enviar a la página web
        io.emit('tap_tap', {
            nickname: data.nickname,
            avatarUrl: data.profilePictureUrl,
            likes: data.likeCount,
            totalLikes: totalLikesSession,
            top: topContributors
        });
    });
    
    tiktokLiveConnection.on('streamEnd', () => {
        isConnected = false;
        io.emit('alert_msg', '🛑 El Live ha terminado.');
    });
}

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor listo en puerto ${PORT}`);
});
