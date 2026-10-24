const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// PARCHE APLICADO AQUÍ: Detecta automáticamente la versión de tu librería
let WebcastPushConnection = require('tiktok-live-connector');
if (WebcastPushConnection.WebcastPushConnection) {
    WebcastPushConnection = WebcastPushConnection.WebcastPushConnection;
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const TIKTOK_USER = "nexusfvl"; // Dejado listo para Nexus
let totalLikes = 0;
let contributors = {};
let tiktokLiveConnection = null;
let isConnected = false;

io.on('connection', (socket) => {
    console.log('Alguien entró a la web. Despertando a Render...');
    if (!isConnected) {
        iniciarConexionTikTok();
    } else {
        socket.emit('tiktokConnected');
        enviarDatosActualizados();
    }
});

function enviarDatosActualizados(lastLike = null) {
    const todosLosContribuidores = Object.keys(contributors)
        .map(user => ({ uniqueId: user, likes: contributors[user] }))
        .sort((a, b) => b.likes - a.likes);

    io.emit('updateData', {
        totalLikes: totalLikes,
        top: todosLosContribuidores,
        lastLike: lastLike
    });
}

function iniciarConexionTikTok() {
    if (isConnected) return;
    
    tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USER);
    
    tiktokLiveConnection.connect().then(state => {
        console.info(`✅ Conectado al Live de ${TIKTOK_USER}`);
        isConnected = true;
        io.emit('tiktokConnected');
    }).catch(err => {
        console.error('❌ Error al conectar a TikTok:', err.message);
        isConnected = false;
        io.emit('tiktokDisconnected');
    });

    tiktokLiveConnection.on('like', data => {
        const likesRecibidos = data.likeCount; 
        const usuario = data.uniqueId;

        totalLikes += likesRecibidos;
        if (!contributors[usuario]) contributors[usuario] = 0;
        contributors[usuario] += likesRecibidos;

        enviarDatosActualizados({ uniqueId: usuario, likeCount: likesRecibidos });
    });

    tiktokLiveConnection.on('streamEnd', () => {
        isConnected = false;
        io.emit('tiktokDisconnected');
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
