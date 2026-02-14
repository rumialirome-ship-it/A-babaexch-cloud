
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Role, User, Dealer, Admin, Game, Bet, LedgerEntry, SubGameType, PrizeRates } from './types';
import { Icons, GAME_LOGOS } from './constants';
import LandingPage from './components/LandingPage';
import AdminPanel from './components/AdminPanel';
import DealerPanel from './components/DealerPanel';
import UserPanel from './components/UserPanel';
import ResultRevealOverlay from './components/ResultRevealOverlay';
import { AuthProvider, useAuth } from './hooks/useAuth';

const Header: React.FC = () => {
    const { role, account, logout } = useAuth();
    if (!role || !account) return null;

    const roleColors: { [key in Role]: string } = {
        [Role.Admin]: 'bg-red-500/20 text-red-300 border-red-500/30',
        [Role.Dealer]: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        [Role.User]: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    };

    return (
        <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-cyan-400/20 shadow-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center h-16 sm:h-20">
                <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
                    {account.avatarUrl ? (
                        <img src={account.avatarUrl} alt={account.name} className="w-8 h-8 sm:w-11 sm:h-11 rounded-full object-cover border border-cyan-400/50" />
                    ) : (
                        <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-slate-800 border border-cyan-400/50 flex items-center justify-center shrink-0">
                            <span className="font-bold text-sm sm:text-lg text-cyan-300">{account.name ? account.name.charAt(0) : '?'}</span>
                        </div>
                    )}
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-xs sm:text-lg font-black tracking-tighter truncate hidden sm:block">A-BABA EXCHANGE</h1>
                        <div className="flex items-center min-w-0">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-black mr-2 shrink-0 ${roleColors[role]}`}>{role}</span>
                            <span className="text-slate-200 text-[10px] sm:text-sm font-bold truncate max-w-[80px] sm:max-w-none">{account.name}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                     { typeof account.wallet === 'number' && (
                        <div className="flex items-center bg-slate-800/80 px-2 sm:px-4 py-1 sm:py-2 rounded-lg border border-slate-700 shadow-inner">
                            <span className="text-emerald-400 mr-1 sm:mr-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>
                            </span>
                            <span className="font-bold text-[10px] sm:text-base text-white font-mono">{account.wallet.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                        </div>
                    )}
                    <button onClick={logout} className="bg-slate-700/50 hover:bg-red-500/20 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg border border-slate-600 transition-all">Out</button>
                </div>
            </div>
        </header>
    );
};

const AppContent: React.FC = () => {
    const { role, account, loading, fetchWithAuth, verifyData, setAccount } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [games, setGames] = useState<Game[]>([]);
    const [bets, setBets] = useState<Bet[]>([]);
    const [hasInitialFetched, setHasInitialFetched] = useState(false);
    
    const [activeReveal, setActiveReveal] = useState<{ name: string; number: string } | null>(null);
    const lastGamesRef = useRef<Game[]>([]);
    const isFetchingRef = useRef(false);

    const parseAllDates = (data: any) => {
        if (!data) return data;
        const parseLedger = (ledger: LedgerEntry[] = []) => ledger.map(e => ({...e, timestamp: new Date(e.timestamp)}));
        if (data.users && Array.isArray(data.users)) data.users = data.users.map((u: User) => u ? ({...u, ledger: parseLedger(u.ledger)}) : null).filter(Boolean);
        if (data.dealers && Array.isArray(data.dealers)) data.dealers = data.dealers.map((d: Dealer) => d ? ({...d, ledger: parseLedger(d.ledger)}) : null).filter(Boolean);
        if (data.bets && Array.isArray(data.bets)) data.bets = data.bets.map((b: Bet) => ({...b, timestamp: new Date(b.timestamp)}));
        if (data.account && data.account.ledger) data.account.ledger = parseLedger(data.account.ledger);
        return data;
    };

    const fetchPublicData = useCallback(async () => {
        try {
            const gamesResponse = await fetch('/api/games');
            if (gamesResponse.ok) {
                const data = await gamesResponse.json();
                setGames(prev => JSON.stringify(prev) === JSON.stringify(data) ? prev : data);
            }
        } catch (e) {}
    }, []);

    const fetchPrivateData = useCallback(async () => {
        if (!role || isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            const response = await fetchWithAuth('/api/auth/verify');
            if (response.ok) {
                const raw = await response.json();
                const parsedData = parseAllDates(raw);
                if (parsedData.account) setAccount(prev => JSON.stringify(prev) === JSON.stringify(parsedData.account) ? prev : parsedData.account);
                if (role === Role.Admin) { 
                    setUsers(parsedData.users || []); 
                    setDealers(parsedData.dealers || []); 
                    setBets(parsedData.bets || []); 
                }
                else if (role === Role.Dealer) { 
                    setUsers(parsedData.users || []); 
                    setBets(parsedData.bets || []); 
                }
                else { 
                    setBets(parsedData.bets || []); 
                }
                setHasInitialFetched(true);
            }
        } catch (error) {
            console.error("Private fetch error", error);
        } finally {
            isFetchingRef.current = false;
        }
    }, [role, fetchWithAuth, setAccount]);

    useEffect(() => {
        if (!loading && verifyData) {
            const parsed = parseAllDates(verifyData);
            if (parsed.users) setUsers(parsed.users);
            if (parsed.dealers) setDealers(parsed.dealers);
            if (parsed.bets) setBets(parsed.bets);
            setHasInitialFetched(true);
        }
    }, [loading, verifyData]);

    useEffect(() => {
        fetchPublicData();
        const interval = setInterval(fetchPublicData, 120000); 
        return () => clearInterval(interval);
    }, [fetchPublicData]);

    useEffect(() => {
        if (role) {
            fetchPrivateData();
            const interval = setInterval(fetchPrivateData, 95000); 
            return () => clearInterval(interval);
        } else {
            setHasInitialFetched(false);
            setUsers([]); setBets([]); setDealers([]);
        }
    }, [role, fetchPrivateData]);

    useEffect(() => {
        if (games.length > 0 && lastGamesRef.current.length > 0) {
            const revealEligibleGames = ['Ali Baba', 'OLA TV', 'OYO TV'];
            games.forEach(newGame => {
                const oldGame = lastGamesRef.current.find(g => g.id === newGame.id);
                if (
                    revealEligibleGames.includes(newGame.name) &&
                    newGame.winningNumber && 
                    !newGame.winningNumber.endsWith('_') && 
                    (!oldGame?.winningNumber || oldGame.winningNumber.endsWith('_'))
                ) {
                    setActiveReveal({ name: newGame.name, number: newGame.winningNumber });
                }
            });
        }
        lastGamesRef.current = games;
    }, [games]);

    const placeBet = async (d: any) => { 
        await fetchWithAuth('/api/user/bets', { method: 'POST', body: JSON.stringify(d) }); 
        fetchPrivateData(); 
    };
    
    const onSaveUser = async (u: any, o: any, i: any) => {
        const method = o ? 'PUT' : 'POST';
        const url = o ? `/api/dealer/users/${o}` : '/api/dealer/users';
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(o ? u : { userData: u, initialDeposit: i }) });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Operation failed');
        }
        fetchPrivateData();
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-cyan-400 text-xl font-bold">Connecting...</div>;

    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden">
            <div className="animated-bg"></div>
            {!role || !account ? (
                <LandingPage games={games} />
            ) : (
                <>
                    <Header />
                    <main className="flex-grow pb-10">
                        {role === Role.User && <UserPanel user={account as User} games={games} bets={bets} placeBet={placeBet} />}
                        {role === Role.Dealer && (
                            <DealerPanel 
                                dealer={account as Dealer} users={users} 
                                onSaveUser={onSaveUser} 
                                onDeleteUser={async (uId) => { await fetchWithAuth(`/api/dealer/users/${uId}`, { method: 'DELETE' }); fetchPrivateData(); }}
                                topUpUserWallet={async (id, amt) => { await fetchWithAuth('/api/dealer/topup/user', { method: 'POST', body: JSON.stringify({ userId: id, amount: amt }) }); fetchPrivateData(); }} 
                                withdrawFromUserWallet={async (id, amt) => { await fetchWithAuth('/api/dealer/withdraw/user', { method: 'POST', body: JSON.stringify({ userId: id, amount: amt }) }); fetchPrivateData(); }} 
                                toggleAccountRestriction={async (id) => { await fetchWithAuth(`/api/dealer/users/${id}/toggle-restriction`, { method: 'PUT' }); fetchPrivateData(); }} 
                                bets={bets} games={games} placeBetAsDealer={async (d) => { await fetchWithAuth('/api/dealer/bets/bulk', { method: 'POST', body: JSON.stringify(d) }); fetchPrivateData(); }} isLoaded={hasInitialFetched}
                            />
                        )}
                        {role === Role.Admin && (
                            <AdminPanel 
                                admin={account as Admin} dealers={dealers} 
                                onSaveDealer={async (d, o) => { const url = o ? `/api/admin/dealers/${o}` : '/api/admin/dealers'; await fetchWithAuth(url, { method: o ? 'PUT' : 'POST', body: JSON.stringify(d) }); fetchPrivateData(); }} 
                                onUpdateAdmin={async (a) => { await fetchWithAuth('/api/admin/profile', { method: 'PUT', body: JSON.stringify(a) }); fetchPrivateData(); }}
                                users={users} setUsers={setUsers} games={games} bets={bets} 
                                declareWinner={async (id, num) => { await fetchWithAuth(`/api/admin/games/${id}/declare-winner`, { method: 'POST', body: JSON.stringify({ winningNumber: num }) }); fetchPrivateData(); }}
                                updateWinner={async (id, num) => { await fetchWithAuth(`/api/admin/games/${id}/update-winner`, { method: 'PUT', body: JSON.stringify({ newWinningNumber: num }) }); fetchPrivateData(); }}
                                approvePayouts={async (id) => { await fetchWithAuth(`/api/admin/games/${id}/approve-payouts`, { method: 'POST' }); fetchPrivateData(); }}
                                topUpDealerWallet={async (id, amt) => { await fetchWithAuth('/api/admin/topup/dealer', { method: 'POST', body: JSON.stringify({ dealerId: id, amount: amt }) }); fetchPrivateData(); }}
                                withdrawFromDealerWallet={async (id, amt) => { await fetchWithAuth('/api/admin/withdraw/dealer', { method: 'POST', body: JSON.stringify({ dealerId: id, amount: amt }) }); fetchPrivateData(); }}
                                toggleAccountRestriction={async (id, type) => { await fetchWithAuth(`/api/admin/accounts/${type}/${id}/toggle-restriction`, { method: 'PUT' }); fetchPrivateData(); }}
                                onPlaceAdminBets={async (d) => { await fetchWithAuth('/api/admin/bulk-bet', { method: 'POST', body: JSON.stringify(d) }); fetchPrivateData(); }}
                                updateGameDrawTime={async (id, time) => { 
                                    await fetchWithAuth(`/api/admin/games/${id}/draw-time`, { method: 'PUT', body: JSON.stringify({ newDrawTime: time }) }); 
                                    await fetchPublicData();
                                    fetchPrivateData(); 
                                }}
                                onRefreshData={fetchPrivateData} 
                            />
                        )}
                    </main>
                </>
            )}
            {activeReveal && <ResultRevealOverlay gameName={activeReveal.name} winningNumber={activeReveal.number} onClose={() => setActiveReveal(null)} />}
        </div>
    );
};

function App() { return (<AuthProvider><AppContent /></AuthProvider>); }
export default App;
