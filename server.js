const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// MODO EMERGENCIA: Importación a prueba de balas
const TikTok = require('tiktok-live-connector');
const WebcastConnection = TikTok.WebcastPushConnection || TikTok;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const TIKTOK_USER = "nexusfvl";
let totalLikes = 0;
let contributors = {};
let isConnected = false;

io.on('connection', (socket) => {
    if (!isConnected) iniciarConexion();
    io.emit('updateData', { totalLikes, top: getTop() });
});

function getTop() {
    return Object.keys(contributors)
        .map(u => ({ uniqueId: u, likes: contributors[u] }))
        .sort((a, b) => b.likes - a.likes);
}

function iniciarConexion() {
    try {
        const connection = new WebcastConnection(TIKTOK_USER);
        connection.connect().then(() => {
            isConnected = true;
            io.emit('tiktokConnected');
        }).catch(() => {
            isConnected = false;
            io.emit('tiktokDisconnected');
        });

        connection.on('like', data => {
            totalLikes += data.likeCount;
            contributors[data.uniqueId] = (contributors[data.uniqueId] || 0) + data.likeCount;
            io.emit('updateData', { totalLikes, top: getTop(), lastLike: data });
        });

        connection.on('streamEnd', () => {
            isConnected = false;
            io.emit('tiktokDisconnected');
        });
    } catch (e) {
        console.error("Error salvado:", e.message);
    }
}

server.listen(process.env.PORT || 3000);
