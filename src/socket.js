import { io } from "socket.io-client";

// Socket initialization: Use relative path so Vite proxy (dev) or production routing handles it
export const socket = io({
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
