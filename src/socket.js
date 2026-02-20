import { io } from "socket.io-client";

// Dynamic Socket URL: Use Env Var if Present (Prod), otherwise discover LAN IP (Dev)
const getSocketUrl = () => {
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl) return envUrl;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    // Assume backend is always on port 8000 for dev
    return `${protocol}://${host}:8000`;
};

export const socket = io(getSocketUrl(), {
    autoConnect: false,
    transports: ["websocket"],
});

// Utility to join a game room
export const joinGameRoom = (roomId) => {
    if (socket.connected) {
        socket.emit("join_room", { room_id: roomId });
    } else {
        socket.connect();
        socket.once("connect", () => {
            socket.emit("join_room", { room_id: roomId });
        });
    }
};

// Utility to send a game move
export const sendMove = (roomId, payload) => {
    socket.emit("send_move", { room_id: roomId, payload });
};

// Utility to leave a room (simple disconnect for now or custom event)
export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};
