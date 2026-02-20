import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { UserAuth } from '../context/AuthContext';

const FriendsSidebar = ({ isOpen, onClose, onNotificationChange }) => {
    const { user } = UserAuth();
    const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'search'
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [activeChat, setActiveChat] = useState(null); // friend's user object
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [hasViewedRequests, setHasViewedRequests] = useState(false);
    const [prevReqCount, setPrevReqCount] = useState(0);
    const messagesEndRef = useRef(null);

    // Initial Fetch
    useEffect(() => {
        if (user) {
            fetchFriends();
            fetchRequests();
            fetchUnread();
        }
    }, [user]);

    // Lift notification state up
    useEffect(() => {
        if (onNotificationChange) {
            const pendingRequestsCount = hasViewedRequests ? 0 : requests.length;
            onNotificationChange(pendingRequestsCount + (unreadMessagesCount || 0));
        }
    }, [requests.length, unreadMessagesCount, hasViewedRequests, onNotificationChange]);

    useEffect(() => {
        if (requests.length > prevReqCount) {
            setHasViewedRequests(false); // New request arrived
        }
        setPrevReqCount(requests.length);
    }, [requests.length, prevReqCount]);

    useEffect(() => {
        if (isOpen && activeTab === 'requests') {
            setHasViewedRequests(true);
        }
    }, [isOpen, activeTab]);    // Realtime Subscriptions
    useEffect(() => {
        if (!user) return;

        // Listen for new messages
        const msgSub = supabase.channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const newMsg = payload.new;
                // If it's related to the current open chat, append it and mark as read
                if (activeChat && (
                    (newMsg.sender_id === user.id && newMsg.receiver_id === activeChat.id) ||
                    (newMsg.sender_id === activeChat.id && newMsg.receiver_id === user.id)
                )) {
                    setMessages(prev => [...prev, newMsg]);
                    if (newMsg.receiver_id === user.id && isOpen) {
                        markChatAsRead(newMsg.sender_id);
                    }
                } else if (newMsg.receiver_id === user.id) {
                    fetchUnread();
                }
            }).subscribe();

        // Listen for friendship changes (new requests, accepts, etc)
        const friendSub = supabase.channel('public:friendships')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
                fetchFriends();
                fetchRequests();
            }).subscribe();

        return () => {
            supabase.removeChannel(msgSub);
            supabase.removeChannel(friendSub);
        };
    }, [user, activeChat]);

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchFriends = async () => {
        if (!user) return;

        // Find accepted friendships where user is either sender or receiver
        const { data, error } = await supabase
            .from('friendships')
            .select(`
                id,
                requester_id,
                receiver_id,
                profiles!friendships_requester_id_fkey(id, username, avatar_url),
                receiver:profiles!friendships_receiver_id_fkey(id, username, avatar_url)
            `)
            .eq('status', 'accepted')
            .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

        if (error) { console.error(error); return; }

        // Format so we get the *other* person's profile
        const formatted = data.map(f => {
            return f.requester_id === user.id ? f.receiver : f.profiles;
        }).filter(Boolean); // Remove nulls if profile lookup failed

        setFriends(formatted);
    };

    const fetchRequests = async () => {
        if (!user) return;
        // Fetch pending requests SENT TO the user
        const { data, error } = await supabase
            .from('friendships')
            .select(`
                id,
                profiles!friendships_requester_id_fkey(id, username, avatar_url)
            `)
            .eq('receiver_id', user.id)
            .eq('status', 'pending');

        if (!error && data) setRequests(data);
    };

    const fetchUnread = async () => {
        if (!user) return;
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('is_read', false);
        if (count !== null) setUnreadMessagesCount(count);
    };

    const searchUsers = async (e) => {
        if (e) e.preventDefault();
        if (!user) return;

        // Search profiles excluding self
        let query = supabase.from('profiles').select('id, username, avatar_url').neq('id', user.id).limit(10);
        if (searchQuery.trim()) {
            query = query.ilike('username', `%${searchQuery}%`);
        }

        const { data, error } = await query;
        if (!error && data) setSearchResults(data);
    };

    useEffect(() => {
        if (activeTab === 'search') {
            searchUsers();
        }
    }, [activeTab, searchQuery]);

    const sendFriendRequest = async (receiverId) => {
        const { error } = await supabase
            .from('friendships')
            .insert({
                requester_id: user.id,
                receiver_id: receiverId,
                status: 'pending'
            });

        if (!error) {
            alert('Friend request sent!');
            setSearchResults(prev => prev.filter(p => p.id !== receiverId));
        } else {
            alert(error.message.includes('duplicate') ? 'Request already exists.' : 'Failed to send request.');
        }
    };

    const respondToRequest = async (friendshipId, accept) => {
        if (accept) {
            await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
        } else {
            await supabase.from('friendships').delete().eq('id', friendshipId);
        }
        fetchRequests();
    };

    const unfriendUser = async (friendId) => {
        if (!window.confirm("Are you sure you want to unfriend this user?")) return;

        await supabase
            .from('friendships')
            .delete()
            .or(`and(requester_id.eq.${user.id},receiver_id.eq.${friendId}),and(requester_id.eq.${friendId},receiver_id.eq.${user.id})`);

        if (activeChat?.id === friendId) setActiveChat(null);
        fetchFriends();
    };

    const markChatAsRead = async (friendId) => {
        await supabase.from('messages').update({ is_read: true }).eq('receiver_id', user.id).eq('sender_id', friendId).eq('is_read', false);
        fetchUnread();
    };

    // Chat Logic
    const openChat = async (friendObj) => {
        setActiveChat(friendObj);
        markChatAsRead(friendObj.id);

        // Fetch message history
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendObj.id}),and(sender_id.eq.${friendObj.id},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true })
            .limit(50);

        if (!error && data) setMessages(data);
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChat || !user) return;

        const { error } = await supabase
            .from('messages')
            .insert({
                sender_id: user.id,
                receiver_id: activeChat.id,
                content: newMessage.trim()
            });

        if (!error) setNewMessage('');
    };

    // -- UI Components --
    const Avatar = ({ src, name, size = "w-10 h-10" }) => (
        <div className={`${size} rounded-full overflow-hidden border border-white/10 bg-white/5 shrink-0 flex items-center justify-center`}>
            {src ? <img src={src} className="w-full h-full object-cover" /> : <span className="text-white/40 font-bold uppercase">{name?.[0]}</span>}
        </div>
    );

    return (
        <div className={`fixed inset-y-0 right-0 w-80 bg-black/95 border-l border-white/10 shadow-2xl flex flex-col z-[100] transition-transform duration-300 backdrop-blur-3xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h2 className="text-xl font-black italic text-cyan-400">SOCIAL HUB</h2>
                <button onClick={onClose} className="text-white/50 hover:text-white font-bold p-2">✕</button>
            </div>

            {/* If Chat is Open */}
            {activeChat ? (
                <div className="flex-1 flex flex-col h-full bg-black/50">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setActiveChat(null)} className="text-white/50 hover:text-white text-xl">←</button>
                            <Avatar src={activeChat.avatar_url} name={activeChat.username} size="w-8 h-8" />
                            <span className="font-bold">{activeChat.username}</span>
                        </div>
                        <button
                            onClick={() => unfriendUser(activeChat.id)}
                            className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded text-xs font-bold transition-colors"
                            title="Unfriend"
                        >
                            UNFRIEND
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map(msg => {
                            const isMe = msg.sender_id === user?.id;
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${isMe ? 'bg-cyan-500 text-black rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-black/80">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-cyan-500"
                            />
                            <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-xl font-bold">▶</button>
                        </div>
                    </form>
                </div>
            ) : (
                /* Main Social View (Tabs) */
                <div className="flex flex-col h-full">
                    <div className="flex p-2 gap-1 bg-white/[0.02]">
                        {['friends', 'requests', 'search'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1.5 text-xs font-black uppercase rounded-lg transition-all relative ${activeTab === tab ? 'bg-cyan-500 text-black' : 'text-white/40 hover:text-white/80'}`}
                            >
                                {tab}
                                {tab === 'requests' && requests.length > 0 && !hasViewedRequests && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 border border-black" />}
                                {tab === 'friends' && unreadMessagesCount > 0 && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 border border-black" />}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">

                        {/* FRIENDS TAB */}
                        {activeTab === 'friends' && (
                            <div className="space-y-2">
                                {friends.length === 0 ? <p className="text-white/30 text-xs text-center p-4">No friends yet.</p> :
                                    friends.map(f => (
                                        <button key={f.id} onClick={() => openChat(f)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left group">
                                            <Avatar src={f.avatar_url} name={f.username} />
                                            <div className="flex-1">
                                                <div className="font-bold text-sm group-hover:text-cyan-400">{f.username}</div>
                                                <div className="text-[10px] text-white/40 uppercase">Click to chat</div>
                                            </div>
                                            <div className="text-white/10 group-hover:text-cyan-500">💬</div>
                                        </button>
                                    ))
                                }
                            </div>
                        )}

                        {/* REQUESTS TAB */}
                        {activeTab === 'requests' && (
                            <div className="space-y-4">
                                {requests.length === 0 ? <p className="text-white/30 text-xs text-center p-4">No pending requests.</p> :
                                    requests.map(req => (
                                        <div key={req.id} className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-3">
                                                <Avatar src={req.profiles.avatar_url} name={req.profiles.username} />
                                                <span className="font-bold text-sm">{req.profiles.username}</span>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={() => respondToRequest(req.id, true)} className="flex-1 bg-green-500/20 text-green-400 py-1.5 rounded-lg text-xs font-bold hover:bg-green-500 hover:text-black transition-colors">ACCEPT</button>
                                                <button onClick={() => respondToRequest(req.id, false)} className="flex-1 bg-red-500/20 text-red-400 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-colors">DECLINE</button>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        )}

                        {/* SEARCH TAB */}
                        {activeTab === 'search' && (
                            <div className="space-y-4">
                                <form onSubmit={searchUsers} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search username..."
                                        className="flex-1 bg-black border border-white/20 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
                                    />
                                    <button type="submit" className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg">🔍</button>
                                </form>

                                <div className="space-y-2">
                                    {searchResults.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                                            <div className="flex items-center gap-3">
                                                <Avatar src={p.avatar_url} name={p.username} size="w-8 h-8" />
                                                <span className="text-sm font-bold">{p.username}</span>
                                            </div>
                                            <button
                                                onClick={() => sendFriendRequest(p.id)}
                                                className="text-xs bg-cyan-500 text-black px-3 py-1.5 rounded-lg font-bold hover:bg-cyan-400"
                                            >
                                                ADD
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FriendsSidebar;
