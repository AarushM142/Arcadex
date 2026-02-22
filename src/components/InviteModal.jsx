import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserAuth } from '../context/AuthContext';

const InviteModal = ({ isOpen, onClose, gameName, roomId }) => {
    const { user } = UserAuth();
    const [friends, setFriends] = useState([]);

    const showGlobalToast = (msg) => {
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 md:top-24 left-1/2 -translate-x-1/2 bg-black/90 text-cyan-400 font-bold px-8 py-4 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.3)] border border-cyan-400/30 z-[9999] animate-bounce text-lg text-center transition-opacity duration-300 pointer-events-none uppercase tracking-widest';
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    useEffect(() => {
        if (isOpen && user) {
            fetchFriends();
        }
    }, [isOpen, user]);

    const fetchFriends = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('friendships')
            .select(`
                requester_id,
                receiver_id,
                profiles!friendships_requester_id_fkey(id, username, avatar_url),
                receiver:profiles!friendships_receiver_id_fkey(id, username, avatar_url)
            `)
            .eq('status', 'accepted')
            .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

        if (error) { console.error(error); return; }

        const formatted = data.map(f => f.requester_id === user.id ? f.receiver : f.profiles).filter(Boolean);
        setFriends(formatted);
    };

    const sendInvite = async (friendId) => {
        const inviteMessage = `[INVITE] GAME:${gameName} ROOM:${roomId}`;
        const { error } = await supabase
            .from('messages')
            .insert({
                sender_id: user.id,
                receiver_id: friendId,
                content: inviteMessage
            });

        if (!error) {
            showGlobalToast("Invite sent!");
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-black border border-cyan-500/30 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(34,211,238,0.1)]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black italic text-cyan-400">INVITE FRIEND</h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {friends.length === 0 ? (
                        <p className="text-center text-white/40 text-sm p-4">No friends found.</p>
                    ) : (
                        friends.map(f => (
                            <div key={f.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                                        {f.avatar_url ? <img src={f.avatar_url} alt={f.username} /> : <div className="w-full h-full flex items-center justify-center text-xs text-white/50">{f.username?.[0] || '?'}</div>}
                                    </div>
                                    <span className="font-bold text-sm">{f.username}</span>
                                </div>
                                <button onClick={() => sendInvite(f.id)} className="px-3 py-1.5 bg-cyan-500 text-black font-bold text-xs rounded-lg hover:bg-cyan-400 transition-colors">
                                    INVITE
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
export default InviteModal;
