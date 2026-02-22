import { io } from "socket.io-client";

const getSocketUrl = () => {
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl) return envUrl;

    // Local development: use relative path for Vite proxy
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin;
    }

    // Production: Always point to the Render backend (Vercel doesn't host the socket)
    return 'https://neu-backend.onrender.com';
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
