const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);

// Habilitar conexión con GitHub Pages
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Usuario a escanear
const TIKTOK_USER = "zodaga";

// Credenciales (Como no usaste variables de entorno, quedan directas)
const ADMIN_USERS = {
    "Soralus": "Soralus700.",
    "Nexus": "Nexus69<3"
};

let totalLikes = 0;
let contributors = {}; // Aquí se guardan TODOS los usuarios sin límite
let tiktokLiveConnection = null;
let isConnected = false;

io.on('connection', (socket) => {
    console.log('Página web conectada al servidor');
    
    if (isConnected) {
        socket.emit('tiktokConnected');
    }
    
    socket.on('login', (credentials) => {
        const { username, password } = credentials;
        
        if (ADMIN_USERS[username] && ADMIN_USERS[username] === password) {
            socket.emit('loginSuccess', `Bienvenido ${username}. Conectando a TikTok...`);
            iniciarConexionTikTok();
        } else {
            socket.emit('loginError', 'Credenciales incorrectas');
        }
    });
});

function iniciarConexionTikTok() {
    if (isConnected) return;
    
    tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USER);
    
    tiktokLiveConnection.connect().then(state => {
        console.info(`Conectado al Live de ${state.roomId}`);
        isConnected = true;
        io.emit('tiktokConnected');
    }).catch(err => {
        console.error('Error al conectar:', err);
        io.emit('loginError', 'Error: El live no está activo o fue bloqueado temporalmente.');
    });

    // LÓGICA PARA EVITAR LA PÉRDIDA DE LIKES
    tiktokLiveConnection.on('like', data => {
        // data.likeCount es la RÁFAGA AGRUPADA. Así no se pierde ningún like.
        const likesRecibidos = data.likeCount; 
        const usuario = data.uniqueId;

        totalLikes += likesRecibidos;

        if (!contributors[usuario]) {
            contributors[usuario] = 0;
        }
        contributors[usuario] += likesRecibidos;

        // Ordenar la lista sin usar el límite (.slice)
        const todosLosContribuidores = Object.keys(contributors)
            .map(user => ({ uniqueId: user, likes: contributors[user] }))
            .sort((a, b) => b.likes - a.likes);

        io.emit('updateData', {
            totalLikes: totalLikes,
            top: todosLosContribuidores, // Enviamos toda la lista
            lastLike: { uniqueId: usuario, likeCount: likesRecibidos }
        });
    });

    tiktokLiveConnection.on('streamEnd', () => {
        isConnected = false;
        io.emit('tiktokDisconnected');
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
