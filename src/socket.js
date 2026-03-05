import { io } from "socket.io-client";

// Dynamic Socket URL: Use Env Var if Present (Prod), otherwise discover LAN IP (Dev)
export const getSocketUrl = () => {
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl) return envUrl;

    // Connect directly to the backend rather than using the Vite proxy
    return "http://127.0.0.1:8000";
};

export const wakeUpBackend = () => {
    fetch(`${getSocketUrl()}/api/health`).catch(() => console.log("Wake up ping completed."));
};

export const socket = io(getSocketUrl(), {
    autoConnect: false,
    transports: ["websocket"],
});

socket.on("connect_error", (err) => {
    console.warn(`Socket.io Error: ${err.message}. If local, ensure Python backend is running. If on Render free tier, it might be waking up.`);
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
