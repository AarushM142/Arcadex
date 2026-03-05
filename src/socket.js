import { io } from "socket.io-client";

// Dynamic Socket URL: This decides where our WebSockets (the "live cables") should plug into.
// In Production, it plugs into the Render server URL.
// In Local Development, it plugs directly into the Python backend running on port 8000.
export const getSocketUrl = () => {
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl) return envUrl;

    return "http://127.0.0.1:8000";
};

// Free-Tier Workaround: Render puts free servers to sleep after 15 minutes of inactivity.
// This function acts as a tiny alarm clock. It sends a single HTTP Ping the moment the 
// user opens the website to force the Python server to wake up before they try to join a multiplayer game.
export const wakeUpBackend = () => {
    fetch(`${getSocketUrl()}/api/health`).catch(() => console.log("Wake up ping completed."));
};

// Initialize the Socket.io connection.
// 'autoConnect: false' ensures we don't spam the server with live connections 
// until the user actually enters a multiplayer lobby.
export const socket = io(getSocketUrl(), {
    autoConnect: false,
    transports: ["websocket"], // Forces the browser to use raw WebSockets for lowest latency
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
