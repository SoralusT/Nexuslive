const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const TikTok = require('tiktok-live-connector');

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
        let connection;
        // PARCHE DEFINITIVO: Prueba todas las versiones posibles
        if (typeof TikTok === 'function') {
            connection = new TikTok(TIKTOK_USER);
        } else if (typeof TikTok.WebcastPushConnection === 'function') {
            connection = new TikTok.WebcastPushConnection(TIKTOK_USER);
        } else if (typeof TikTok.default === 'function') {
            connection = new TikTok.default(TIKTOK_USER);
        } else {
            console.error("No se encontró el constructor compatible.");
            return;
        }

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
