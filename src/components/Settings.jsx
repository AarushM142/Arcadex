import React, { useState, useEffect } from 'react';
import { UserAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
    const { user } = UserAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (user) {
            setEmail(user.email);
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            if (data) {
                setUsername(data.username || '');
                setAvatarUrl(data.avatar_url || '');
            }
        } catch (error) {
            console.error('Error fetching profile:', error.message);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    username: username.toLowerCase(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) {
                if (error.code === '23505') {
                    throw new Error('Username already taken. Please choose another one.');
                }
                throw error;
            }

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            return setMessage({ type: 'error', text: 'Passwords do not match' });
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            setMessage({ type: 'success', text: 'Password updated successfully!' });
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const uploadAvatar = async (event) => {
        try {
            setUploading(true);
            setMessage({ type: '', text: '' });

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('You must select an image to upload.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to 'avatars' bucket
            let { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update profile with new URL
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setAvatarUrl(publicUrl);
            setMessage({ type: 'success', text: 'Avatar uploaded successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setUploading(false);
        }
    };

    return (
        <AppShell>
            <div className="max-w-2xl mx-auto py-8">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/profile')}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        ←
                    </button>
                    <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
                </div>

                {message.text && (
                    <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                        <span>{message.type === 'success' ? '✅' : '❌'}</span>
                        {message.text}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Profile Section */}
                    <div className="glass card-xl p-8">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <span>👤</span> Public Profile
                        </h2>

                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-32 h-32 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden relative group">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-4xl">👤</span>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                                        <span className="text-xs font-medium text-white">CHANGE</span>
                                    </div>
                                    <input
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={uploadAvatar}
                                        disabled={uploading}
                                    />
                                </div>
                                {uploading && <p className="text-xs text-cyan-400 animate-pulse">Uploading...</p>}
                            </div>

                            {/* Info Fields */}
                            <div className="flex-1 w-full space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted mb-1.5 ml-1">Unique Username</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-8 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                                            placeholder="username"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted mt-2 ml-1">Your unique handle. This will be visible to other players.</p>
                                </div>

                                <button
                                    onClick={handleUpdateProfile}
                                    disabled={loading}
                                    className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                                >
                                    {loading ? 'SAVING...' : 'SAVE CHANGES'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Security Section */}
                    <div className="glass card-xl p-8">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <span>🔒</span> Security
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted mb-1.5 ml-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    disabled
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-muted cursor-not-allowed"
                                />
                            </div>

                            <hr className="border-white/5 my-4" />

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted mb-1.5 ml-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted mb-1.5 ml-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleChangePassword}
                                disabled={loading || !newPassword}
                                className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all"
                            >
                                {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

export default Settings;
