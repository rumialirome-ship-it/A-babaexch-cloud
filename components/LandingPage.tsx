
import React, { useState } from 'react';
import { Game } from '../types';
import { useCountdown } from '../hooks/useCountdown';
import { Icons, GAME_LOGOS } from '../constants';
import { useAuth } from '../hooks/useAuth';

const formatTime12h = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
};

const GameDisplayCard: React.FC<{ game: Game; onClick: () => void }> = ({ game, onClick }) => {
    const { status, text: countdownText } = useCountdown(game.drawTime);
    const hasFinalWinner = !!game.winningNumber && !game.winningNumber.endsWith('_');
    const isMarketClosedForDisplay = !game.isMarketOpen;
    const themeColor = hasFinalWinner ? 'emerald' : 'cyan';
    const logo = GAME_LOGOS[game.name] || '';

    return (
        <button
            onClick={onClick}
            className={`relative group bg-slate-800/40 p-4 sm:p-6 flex flex-col items-center justify-between text-center transition-all duration-300 border border-slate-700 w-full overflow-hidden hover:border-cyan-500/50 shadow-lg active:scale-95 active:bg-slate-800/60`}
            style={{
                clipPath: 'polygon(0 12px, 12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)',
            }}
        >
            <div className="relative z-10 w-full flex flex-col h-full items-center">
                <div className="flex-grow flex flex-col items-center">
                    <img src={logo} alt={`${game.name} logo`} className="w-16 h-16 sm:w-24 sm:h-24 rounded-full mb-3 border-2 border-slate-700 group-hover:border-cyan-400 transition-colors bg-slate-900" />
                    <h3 className="text-lg sm:text-2xl text-white mb-0.5 uppercase tracking-wider font-black">{game.name}</h3>
                    <p className="text-slate-500 text-[10px] sm:text-xs font-bold">DRAW @ {formatTime12h(game.drawTime)}</p>
                </div>
                <div className={`text-center w-full p-2 mt-4 bg-black/40 border-t border-${themeColor}-400/20 min-h-[70px] flex flex-col justify-center rounded-lg`}>
                    {hasFinalWinner ? (
                        <>
                            <div className="text-[8px] sm:text-[10px] uppercase tracking-widest text-emerald-400 font-black mb-0.5">DRAW RESULT</div>
                            <div className="text-3xl sm:text-5xl font-mono font-black text-white drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                                {game.winningNumber}
                            </div>
                        </>
                    ) : isMarketClosedForDisplay ? (
                        <>
                            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">STATUS</div>
                            <div className="text-xl sm:text-2xl font-black text-red-500">CLOSED</div>
                        </>
                    ) : status === 'OPEN' ? (
                        <>
                            <div className="text-[8px] sm:text-[10px] uppercase tracking-widest text-cyan-400 font-black">CLOSES IN</div>
                            <div className="text-2xl sm:text-3xl font-mono font-black text-cyan-300">{countdownText}</div>
                        </>
                    ) : (
                        <>
                            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">OPENS AT</div>
                            <div className="text-lg sm:text-xl font-mono font-black text-slate-400">{countdownText}</div>
                        </>
                    )}
                </div>
            </div>
        </button>
    );
};

type LoginRole = 'User' | 'Dealer';

const LoginPanel: React.FC<{ onForgotPassword: () => void }> = ({ onForgotPassword }) => {
    const { login } = useAuth();
    const [activeTab, setActiveTab] = useState<LoginRole>('User');
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const roles: { name: LoginRole; theme: { text: string; ring: string; button: string; } }[] = [
        { name: 'User', theme: { text: 'text-cyan-400', ring: 'focus:ring-cyan-500', button: 'from-cyan-600 to-blue-600' } },
        { name: 'Dealer', theme: { text: 'text-emerald-400', ring: 'focus:ring-emerald-500', button: 'from-emerald-600 to-green-600' } }
    ];

    const activeRole = roles.find(r => r.name === activeTab)!;

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginId.trim() || !password.trim()) { setError("Fields required."); return; }
        setError(null);
        try { await login(loginId, password); } catch (err) { setError(err instanceof Error ? err.message : "Error."); }
    };

    return (
        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 overflow-hidden w-full max-w-sm mx-auto">
            <div className="p-1 flex bg-slate-900/50">
                {roles.map(role => (
                    <button key={role.name} onClick={() => { setActiveTab(role.name); setError(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 ${activeTab === role.name ? `bg-slate-800 ${role.theme.text} shadow-inner` : 'text-slate-500 hover:text-white'}`}>
                        {role.name}
                    </button>
                ))}
            </div>
            <div className="p-6 sm:p-8">
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Account ID</label>
                        <input type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)} className={`w-full bg-slate-900/50 p-3 rounded-xl border border-slate-700 text-white text-sm focus:ring-2 ${activeRole.theme.ring}`} placeholder={`ID`} />
                    </div>
                    <div>
                         <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                            <button type="button" onClick={onForgotPassword} className="text-[10px] font-black text-slate-600 hover:text-cyan-400 uppercase tracking-tighter active:opacity-50 transition-opacity">Forgot?</button>
                        </div>
                        <div className="relative">
                            <input type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full bg-slate-900/50 p-3 rounded-xl border border-slate-700 text-white text-sm focus:ring-2 ${activeRole.theme.ring} pr-10`} placeholder="••••••" />
                             <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 active:scale-75 transition-transform">
                                {isPasswordVisible ? Icons.eyeOff : Icons.eye}
                            </button>
                        </div>
                    </div>
                    {error && <p className="text-[10px] text-red-400 font-bold bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
                    <button type="submit" className={`w-full text-white font-black py-4 rounded-xl transition-all shadow-lg text-xs uppercase tracking-widest bg-gradient-to-r ${activeRole.theme.button} hover:scale-105 active:scale-95 active:brightness-90 btn-interactive`}>
                        Authenticate
                    </button>
                </form>
            </div>
        </div>
    );
};

const LandingPage: React.FC<{ games: Game[] }> = ({ games }) => {
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    
    return (
        <div className="min-h-screen p-4 sm:p-8 flex flex-col">
            <header className="text-center py-10 sm:py-16">
                <h1 className="text-3xl sm:text-6xl font-black mb-2 tracking-tighter glitch-text" data-text="A-BABA EXCHANGE">A-BABA EXCHANGE</h1>
                <p className="text-xs sm:text-base text-slate-500 font-bold uppercase tracking-widest px-4">The Digital Frontier of Luck & Strategy</p>
            </header>

            <section className="mb-12">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
                    {games.length === 0 ? (
                        Array.from({length: 5}).map((_,i) => <div key={i} className="bg-slate-800/20 h-40 animate-pulse border border-slate-700 rounded-xl"></div>)
                    ) : (
                        games.map(game => (
                            <GameDisplayCard key={game.id} game={game} onClick={() => document.getElementById('login')?.scrollIntoView({ behavior: 'smooth' })} />
                        ))
                    )}
                </div>
            </section>

            <section id="login" className="w-full max-w-sm mx-auto flex flex-col gap-4">
                <LoginPanel onForgotPassword={() => {}} />
                <button onClick={() => setIsAdminModalOpen(true)} className="w-full text-red-500 font-black py-3 px-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all text-[10px] uppercase tracking-widest active:scale-95 active:bg-red-500/20">
                    Authorized Admins Only
                </button>
            </section>

            <footer className="text-center py-10 mt-auto text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                <p>&copy; {new Date().getFullYear()} A-Baba Tech Ops</p>
            </footer>
        </div>
    );
};

export default LandingPage;
