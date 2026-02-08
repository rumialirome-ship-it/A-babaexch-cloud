
import React, { useState, useMemo, useEffect } from 'react';
import { Dealer, User, Game, PrizeRates, LedgerEntry, Bet, NumberLimit, SubGameType, Admin } from '../types';
import { Icons } from '../constants';
import { useAuth } from '../hooks/useAuth';

// --- TYPE DEFINITIONS ---
interface GameSummary {
  gameName: string;
  winningNumber: string;
  totalStake: number;
  totalPayouts: number;
  totalDealerProfit: number;
  totalCommissions: number;
  netProfit: number;
}

interface FinancialSummary {
  games: GameSummary[];
  totals: {
    totalStake: number;
    totalPayouts: number;
    totalDealerProfit: number;
    totalCommissions: number;
    netProfit: number;
  };
  totalBets: number;
}

// --- SHARED COMPONENTS ---

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'md' | 'lg' | 'xl'; themeColor?: string }> = ({ isOpen, onClose, title, children, size = 'md', themeColor = 'cyan' }) => {
    if (!isOpen) return null;
    const sizeClasses: Record<string, string> = { md: 'max-w-md', lg: 'max-w-3xl', xl: 'max-w-5xl' };
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
            <div className={`bg-slate-900 rounded-2xl shadow-2xl w-full border border-${themeColor}-500/30 ${sizeClasses[size]} flex flex-col max-h-[90vh] overflow-hidden`}>
                <div className="flex justify-between items-center p-5 border-b border-slate-700 flex-shrink-0">
                    <h3 className={`text-sm sm:text-lg font-black text-${themeColor}-400 uppercase tracking-widest`}>{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1">{Icons.close}</button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar">{children}</div>
            </div>
        </div>
    );
};

const LedgerTable: React.FC<{ entries: LedgerEntry[] }> = ({ entries }) => (
    <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
        <div className="overflow-y-auto max-h-[60vh] mobile-scroll-x no-scrollbar">
            <table className="w-full text-left min-w-[700px]">
                <thead className="bg-slate-900/80 sticky top-0 backdrop-blur-md z-10">
                    <tr className="border-b border-slate-800">
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Timestamp / ID</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Classification</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Narrative</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Debit (-)</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Credit (+)</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Portfolio Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                    {Array.isArray(entries) && [...entries].sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()).map(entry => {
                        const isCredit = entry.credit > 0;
                        const isDebit = entry.debit > 0;
                        
                        return (
                            <tr key={entry.id} className="hover:bg-cyan-500/5 transition-all group">
                                <td className="p-4 whitespace-nowrap">
                                    <div className="text-[11px] font-bold text-slate-300">{entry.timestamp?.toLocaleDateString()}</div>
                                    <div className="text-[9px] font-mono text-slate-600 uppercase">{entry.timestamp?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </td>
                                <td className="p-4">
                                    {isCredit ? (
                                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-emerald-500/20">CREDIT</span>
                                    ) : isDebit ? (
                                        <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-rose-500/20">DEBIT</span>
                                    ) : (
                                        <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-slate-700">ADJUST</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="text-xs text-white font-medium group-hover:text-cyan-400 transition-colors">{entry.description}</div>
                                </td>
                                <td className={`p-4 text-right font-mono text-sm ${isDebit ? 'text-rose-400 font-bold' : 'text-slate-700'}`}>
                                    {isDebit ? `-${entry.debit.toFixed(2)}` : '0.00'}
                                </td>
                                <td className={`p-4 text-right font-mono text-sm ${isCredit ? 'text-emerald-400 font-bold' : 'text-slate-700'}`}>
                                    {isCredit ? `+${entry.credit.toFixed(2)}` : '0.00'}
                                </td>
                                <td className="p-4 text-right whitespace-nowrap">
                                    <div className="text-xs font-black text-white font-mono bg-slate-900/50 px-3 py-1 rounded-lg inline-block border border-slate-800 group-hover:border-cyan-500/30">
                                        PKR {entry.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                     {(!Array.isArray(entries) || entries.length === 0) && (
                        <tr>
                            <td colSpan={6} className="p-20 text-center">
                                <div className="flex flex-col items-center gap-4 opacity-40">
                                    <div className="w-12 h-12 border-2 border-dashed border-slate-600 rounded-full flex items-center justify-center">{Icons.bookOpen}</div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Zero Ledger Footprint Found</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        <div className="bg-slate-900/50 p-4 border-t border-slate-800 flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Digital Audit Trail • Verified Node</span>
            <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest">{entries.length} Transactions Logged</span>
        </div>
    </div>
);

// --- FORMS ---

const DealerForm: React.FC<{ 
    dealer?: Dealer; 
    onSave: (dealer: any, originalId?: string) => Promise<void>; 
    onCancel: () => void 
}> = ({ dealer, onSave, onCancel }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        id: dealer?.id || '',
        name: dealer?.name || '',
        password: dealer?.password || '',
        area: dealer?.area || '',
        contact: dealer?.contact || '',
        wallet: dealer?.wallet?.toString() || '0',
        commissionRate: dealer?.commissionRate?.toString() || '10',
        prizeRates: {
            oneDigitOpen: dealer?.prizeRates?.oneDigitOpen?.toString() || '90',
            oneDigitClose: dealer?.prizeRates?.oneDigitClose?.toString() || '90',
            twoDigit: dealer?.prizeRates?.twoDigit?.toString() || '900',
        }
    });

    const inputClass = "w-full bg-slate-800 p-2.5 rounded-xl border border-slate-700 text-white text-sm focus:ring-2 focus:ring-red-500";
    const labelClass = "block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const payload = {
                ...formData,
                wallet: parseFloat(formData.wallet),
                commissionRate: parseFloat(formData.commissionRate),
                prizeRates: {
                    oneDigitOpen: parseFloat(formData.prizeRates.oneDigitOpen),
                    oneDigitClose: parseFloat(formData.prizeRates.oneDigitClose),
                    twoDigit: parseFloat(formData.prizeRates.twoDigit),
                }
            };
            await onSave(payload, dealer?.id);
            onCancel(); 
        } catch (err) {
            alert("Error saving dealer. ID might be already taken.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Login ID</label>
                    <input type="text" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} className={inputClass} required disabled={!!dealer} />
                </div>
                <div>
                    <label className={labelClass}>Display Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} required />
                </div>
                <div>
                    <label className={labelClass}>Password</label>
                    <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={inputClass} required />
                </div>
                <div>
                    <label className={labelClass}>Area / City</label>
                    <input type="text" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className={inputClass} required />
                </div>
                <div>
                    <label className={labelClass}>Contact Number</label>
                    <input type="text" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className={inputClass} required />
                </div>
                <div>
                    <label className={labelClass}>Commission Rate (%)</label>
                    <input type="number" step="0.1" value={formData.commissionRate} onChange={e => setFormData({...formData, commissionRate: e.target.value})} className={inputClass} required />
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="col-span-3 text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-1 text-center">Prize Multipliers</div>
                <div>
                    <label className={labelClass}>2-Digit</label>
                    <input type="number" value={formData.prizeRates.twoDigit} onChange={e => setFormData({...formData, prizeRates: {...formData.prizeRates, twoDigit: e.target.value}})} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>1-Open</label>
                    <input type="number" value={formData.prizeRates.oneDigitOpen} onChange={e => setFormData({...formData, prizeRates: {...formData.prizeRates, oneDigitOpen: e.target.value}})} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>1-Close</label>
                    <input type="number" value={formData.prizeRates.oneDigitClose} onChange={e => setFormData({...formData, prizeRates: {...formData.prizeRates, oneDigitClose: e.target.value}})} className={inputClass} />
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button type="button" onClick={onCancel} className="flex-1 py-3 text-xs font-black uppercase text-slate-400 hover:text-white transition-all">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase shadow-lg transition-all">
                    {isLoading ? 'Processing...' : dealer ? 'Update Dealer' : 'Create Dealer'}
                </button>
            </div>
        </form>
    );
};

// --- VIEWS ---

const DashboardView: React.FC<{ summary: FinancialSummary | null; admin: Admin; onOpenAdminLedger: () => void }> = ({ summary, admin, onOpenAdminLedger }) => {
    if (!summary) return <div className="text-center p-12 text-slate-500 font-bold animate-pulse uppercase text-xs tracking-widest">Compiling Analytics...</div>;

    const SummaryCard = ({ title, value, color, onClick }: { title: string; value: number; color: string; onClick?: () => void }) => (
        <div 
            onClick={onClick}
            className={`bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-700 shadow-lg ${onClick ? 'cursor-pointer hover:border-cyan-500/50 transition-all active:scale-95' : ''}`}
        >
            <div className="flex justify-between items-start">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{title}</p>
                {onClick && <span className="text-cyan-500">{Icons.bookOpen}</span>}
            </div>
            <p className={`text-2xl sm:text-3xl font-black font-mono ${color}`}>Rs {value.toLocaleString()}</p>
        </div>
    );
    
    return (
        <div className="animate-fade-in space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <SummaryCard title="Vault Balance (Admin)" value={admin.wallet} color="text-white" onClick={onOpenAdminLedger} />
                <SummaryCard title="Total Stake" value={summary.totals?.totalStake} color="text-cyan-400" />
                <SummaryCard title="Total Payouts" value={summary.totals?.totalPayouts} color="text-amber-400" />
                <SummaryCard title="Net Profit" value={summary.totals?.netProfit} color={summary.totals?.netProfit >= 0 ? "text-emerald-400" : "text-red-400"} />
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-black text-white uppercase tracking-widest">Market Breakdown</h3>
                <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-800/80 border-b border-slate-700">
                                <tr>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Market</th>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Stake</th>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Payouts</th>
                                    <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Net Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {summary.games?.map(game => (
                                    <tr key={game.gameName} className="hover:bg-slate-700/20 transition-all">
                                        <td className="p-4 font-bold text-white text-sm uppercase">{game.gameName} <span className="text-[10px] text-slate-500 ml-1">({game.winningNumber})</span></td>
                                        <td className="p-4 text-right font-mono text-white text-sm">{(game.totalStake || 0).toFixed(2)}</td>
                                        <td className="p-4 text-right font-mono text-amber-400 text-sm">{(game.totalPayouts || 0).toFixed(2)}</td>
                                        <td className={`p-4 text-right font-mono font-black text-sm ${(game.netProfit || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{(game.netProfit || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LiveBetsView: React.FC<{ games: Game[]; bets: Bet[]; users: User[] }> = ({ games, bets, users }) => {
    const liveGames = useMemo(() => games.filter(g => g.isMarketOpen), [games]);
    
    const recentBets = useMemo(() => {
        // Show last 50 bets overall, but highlight active ones
        return [...bets].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
    }, [bets]);

    const marketExposures = useMemo(() => {
        return liveGames.map(game => {
            const gameBets = bets.filter(b => b.gameId === game.id);
            const totalStake = gameBets.reduce((sum, b) => sum + b.totalAmount, 0);
            return {
                ...game,
                totalStake,
                betCount: gameBets.length
            };
        }).sort((a,b) => b.totalStake - a.totalStake);
    }, [liveGames, bets]);

    return (
        <div className="animate-fade-in space-y-8">
            <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Live Market Monitor</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketExposures.map(market => (
                    <div key={market.id} className="bg-slate-800/40 p-5 rounded-2xl border border-cyan-500/20 shadow-xl backdrop-blur-md relative overflow-hidden group hover:border-cyan-500/50 transition-all">
                        <div className="absolute top-0 right-0 p-3">
                             <span className="text-[8px] font-black uppercase text-cyan-400 tracking-[0.2em] animate-pulse">Recording</span>
                        </div>
                        <h4 className="text-white font-black text-xl uppercase mb-1">{market.name}</h4>
                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-4 tracking-widest">Draw Window: {market.drawTime}</div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                                <span className="text-[9px] text-slate-500 font-black uppercase block mb-1">Live Stake</span>
                                <span className="text-lg font-black text-emerald-400 font-mono">Rs {market.totalStake.toLocaleString()}</span>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                                <span className="text-[9px] text-slate-500 font-black uppercase block mb-1">Volume</span>
                                <span className="text-lg font-black text-white font-mono">{market.betCount} Tickets</span>
                            </div>
                        </div>
                    </div>
                ))}
                {marketExposures.length === 0 && (
                    <div className="col-span-full p-12 bg-slate-800/20 border border-dashed border-slate-700 rounded-2xl text-center text-slate-500 font-black uppercase tracking-widest text-xs">
                        No active markets currently accepting bets.
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Global Activity Stream</h4>
                <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-800/80 border-b border-slate-700">
                                <tr className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                                    <th className="p-4">Time</th>
                                    <th className="p-4">Player</th>
                                    <th className="p-4">Market</th>
                                    <th className="p-4">Details</th>
                                    <th className="p-4 text-right">Stake</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {recentBets.map(bet => {
                                    const user = users.find(u => u.id === bet.userId);
                                    const game = games.find(g => g.id === bet.gameId);
                                    const isActive = game?.isMarketOpen;
                                    return (
                                        <tr key={bet.id} className={`transition-all ${isActive ? 'bg-cyan-500/5 hover:bg-cyan-500/10' : 'hover:bg-slate-700/20 opacity-60'}`}>
                                            <td className="p-4 text-[10px] font-mono text-slate-400">
                                                {new Date(bet.timestamp).toLocaleTimeString()}
                                            </td>
                                            <td className="p-4">
                                                <div className="text-white font-bold text-xs">{user?.name || '---'}</div>
                                                <div className="text-[9px] text-slate-500 uppercase font-mono">{bet.userId}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                                                    {game?.name || '---'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {bet.numbers.slice(0, 3).map((n, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[9px] font-mono text-white">
                                                            {n}
                                                        </span>
                                                    ))}
                                                    {bet.numbers.length > 3 && <span className="text-[9px] text-slate-500">+{bet.numbers.length - 3}</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-white text-xs font-black">Rs {bet.totalAmount.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const BetSearchView: React.FC<{ games: Game[]; users: User[]; fetchWithAuth: any }> = ({ games, users, fetchWithAuth }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGame, setSelectedGame] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [results, setResults] = useState<Bet[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('q', searchQuery);
            if (selectedGame) params.append('gameId', selectedGame);
            if (selectedUser) params.append('userId', selectedUser);
            
            const res = await fetchWithAuth(`/api/admin/bets/search?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.map((b: any) => ({ ...b, timestamp: new Date(b.timestamp) })));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(handleSearch, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, selectedGame, selectedUser]);

    const inputClass = "bg-slate-800 p-2 rounded-xl border border-slate-700 text-white text-xs font-bold focus:ring-1 focus:ring-red-500 transition-all w-full";

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Quick Search (Numbers or User ID)</label>
                    <input type="text" placeholder="e.g. 43 or user123" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Game Category</label>
                    <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)} className={inputClass}>
                        <option value="">All Markets</option>
                        {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Filter By User</label>
                    <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className={inputClass}>
                        <option value="">All Users</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-slate-800/80 border-b border-slate-700">
                            <tr>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Player</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Market</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ticket Details</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Stake</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-10 text-center animate-pulse text-slate-500 uppercase tracking-widest text-xs">Accessing historical data...</td></tr>
                            ) : results.length === 0 ? (
                                <tr><td colSpan={5} className="p-10 text-center text-slate-500 font-black uppercase tracking-widest text-xs">No records found.</td></tr>
                            ) : results.map(bet => {
                                const user = users.find(u => u.id === bet.userId);
                                const game = games.find(g => g.id === bet.gameId);
                                return (
                                    <tr key={bet.id} className="hover:bg-slate-700/20 transition-all">
                                        <td className="p-4 text-[10px] text-slate-400 font-mono">{bet.timestamp.toLocaleString()}</td>
                                        <td className="p-4">
                                            <div className="text-white font-bold text-xs">{user?.name || '---'}</div>
                                            <div className="text-[9px] text-slate-500 uppercase font-mono">{bet.userId}</div>
                                        </td>
                                        <td className="p-4 text-cyan-400 font-black text-xs uppercase">{game?.name || '---'}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {bet.numbers.map((n, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-white">
                                                        {n}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-emerald-400 font-black text-xs">Rs {bet.totalAmount.toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const DealerTransactionForm: React.FC<{ 
    dealers: Dealer[]; 
    fixedDealerId?: string;
    onTransaction: (dealerId: string, amount: number) => Promise<void>; 
    onCancel: () => void; 
    type: 'Top-Up' | 'Withdrawal' 
}> = ({ dealers, fixedDealerId, onTransaction, onCancel, type }) => {
    const [selectedId, setSelectedId] = useState(fixedDealerId || '');
    const [amount, setAmount] = useState<number | ''>('');
    const themeColor = type === 'Top-Up' ? 'emerald' : 'amber';
    const inputClass = `w-full bg-slate-800 p-3 rounded-xl border border-slate-700 focus:ring-2 focus:ring-${themeColor}-500 text-white text-sm font-bold`;
    
    return (
        <form onSubmit={async (e) => { e.preventDefault(); if (selectedId && amount && amount > 0) { await onTransaction(selectedId, Number(amount)); } }} className="space-y-4">
            {!fixedDealerId && (
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass} required>
                    <option value="">-- Choose Dealer Profile --</option>
                    {dealers.map(d => (
                        <option key={d.id} value={d.id}>
                            {d.name} ({d.id}) — Pool: PKR {d.wallet.toLocaleString()}
                        </option>
                    ))}
                </select>
            )}
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder={`Amount to ${type} (PKR)`} className={inputClass} min="0.01" required step="0.01" autoFocus />
            <div className="flex gap-3 pt-4">
                <button type="button" onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all">Cancel</button>
                <button type="submit" className={`flex-1 font-black py-3 rounded-xl text-white text-xs shadow-lg bg-${themeColor}-600 hover:bg-${themeColor}-500 transition-all uppercase tracking-widest`}>Proceed {type}</button>
            </div>
        </form>
    );
};

// --- MAIN PANEL ---

interface AdminPanelProps {
  admin: Admin; 
  dealers: Dealer[]; 
  onSaveDealer: (dealer: any, originalId?: string) => Promise<void>;
  onUpdateAdmin?: (admin: any) => Promise<void>;
  users: User[]; 
  setUsers?: React.Dispatch<React.SetStateAction<User[]>>;
  games: Game[]; 
  bets: Bet[]; 
  declareWinner?: (gameId: string, winningNumber: string) => Promise<void>;
  updateWinner?: (gameId: string, newWinningNumber: string) => Promise<void>;
  approvePayouts?: (gameId: string) => Promise<void>;
  topUpDealerWallet: (dealerId: string, amount: number) => Promise<void>;
  withdrawFromDealerWallet: (dealerId: string, amount: number) => Promise<void>;
  toggleAccountRestriction: (accountId: string, accountType: 'user' | 'dealer') => void;
  onPlaceAdminBets?: (details: any) => Promise<void>;
  updateGameDrawTime?: (gameId: string, newDrawTime: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  admin, dealers, onSaveDealer, onUpdateAdmin, users, setUsers, games, bets, 
  declareWinner, updateWinner, approvePayouts, topUpDealerWallet, 
  withdrawFromDealerWallet, toggleAccountRestriction, onPlaceAdminBets, 
  updateGameDrawTime, onRefreshData 
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summaryData, setSummaryData] = useState<FinancialSummary | null>(null);
  const { fetchWithAuth } = useAuth();
  
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isDealerModalOpen, setIsDealerModalOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | undefined>(undefined);
  const [actionDealerId, setActionDealerId] = useState<string | undefined>(undefined);
  const [viewingLedgerId, setViewingLedgerId] = useState<string | null>(null);
  const [viewingLedgerType, setViewingLedgerType] = useState<'dealer' | 'admin' | null>(null);
  const [winnerInputMap, setWinnerInputMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeTab === 'dashboard') {
        fetchWithAuth('/api/admin/summary').then(r => r.json()).then(setSummaryData).catch(console.error);
    }
  }, [activeTab, fetchWithAuth]);

  const tabs = [
    { id: 'dashboard', label: 'Stats', icon: Icons.chartBar },
    { id: 'live', label: 'Live', icon: <span className="animate-pulse flex items-center justify-center bg-red-500 w-2 h-2 rounded-full mr-2"></span> },
    { id: 'dealers', label: 'Dealers', icon: Icons.userGroup }, 
    { id: 'users', label: 'Users', icon: Icons.user },
    { id: 'search', label: 'Bet Search', icon: Icons.search },
    { id: 'games', label: 'Markets', icon: Icons.gamepad },
    { id: 'winners', label: 'Winners', icon: Icons.star },
  ];

  const activeLedgerAccount = useMemo(() => {
    if (!viewingLedgerId) return null;
    if (viewingLedgerType === 'admin') return admin;
    if (viewingLedgerType === 'dealer') return dealers.find(d => d.id === viewingLedgerId);
    return null;
  }, [viewingLedgerId, viewingLedgerType, admin, dealers]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl sm:text-4xl font-black text-red-500 uppercase tracking-tighter text-shadow-glow">System Control</h2>
        <div className="bg-slate-800/80 p-1 rounded-xl flex items-center space-x-1 border border-slate-700 w-full sm:w-auto overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 flex items-center space-x-2 py-2 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab.id ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                {typeof tab.icon === 'string' ? tab.icon : tab.icon} <span>{tab.label}</span>
            </button>
            ))}
        </div>
      </div>
      
      {activeTab === 'dashboard' && <DashboardView summary={summaryData} admin={admin} onOpenAdminLedger={() => { setViewingLedgerId(admin.id); setViewingLedgerType('admin'); }} />}
      {activeTab === 'live' && <LiveBetsView games={games} bets={bets} users={users} />}
      {activeTab === 'search' && <BetSearchView fetchWithAuth={fetchWithAuth} games={games} users={users} />}

      {activeTab === 'dealers' && (
        <div className="animate-fade-in space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Dealer Network</h3>
            <button onClick={() => { setSelectedDealer(undefined); setIsDealerModalOpen(true); }} className="bg-red-600 hover:bg-red-500 text-white font-black py-2 px-4 rounded-xl text-[10px] uppercase tracking-widest shadow-xl shadow-red-900/20 transition-all">Add New Dealer</button>
          </div>
          <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 backdrop-blur-sm">
             <div className="overflow-x-auto">
                 <table className="w-full text-left min-w-[900px]">
                     <thead className="bg-slate-800/80 border-b border-slate-700">
                         <tr className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                             <th className="p-4">Entity Details</th>
                             <th className="p-4 text-right">Liquidity Pool</th>
                             <th className="p-4 text-center">Revenue Comm. %</th>
                             <th className="p-4 text-center">Auth Status</th>
                             <th className="p-4 text-center">Fund Controls</th>
                             <th className="p-4 text-right">System Actions</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800">
                         {dealers.map(dealer => (
                             <tr key={dealer.id} className="hover:bg-slate-700/20 transition-all">
                                 <td className="p-4">
                                     <div className="text-white font-black text-sm uppercase">{dealer.name}</div>
                                     <div className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">{dealer.id} | {dealer.area}</div>
                                 </td>
                                 <td className="p-4 text-right">
                                    <div className="font-mono text-emerald-400 font-black text-sm">PKR {dealer.wallet.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                 </td>
                                 <td className="p-4 text-center">
                                     <div className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-full text-xs font-black inline-block">
                                        {dealer.commissionRate.toFixed(1)}%
                                     </div>
                                 </td>
                                 <td className="p-4 text-center">
                                     <button onClick={() => toggleAccountRestriction(dealer.id, 'dealer')} className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter transition-all ${dealer.isRestricted ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                         {dealer.isRestricted ? 'Restricted' : 'Operational'}
                                     </button>
                                 </td>
                                 <td className="p-4">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => { setActionDealerId(dealer.id); setIsWithdrawModalOpen(true); }} className="bg-amber-600/10 text-amber-500 border border-amber-500/30 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest hover:bg-amber-600/20 transition-all">Withdraw</button>
                                        <button onClick={() => { setActionDealerId(dealer.id); setIsDepositModalOpen(true); }} className="bg-emerald-600/10 text-emerald-500 border border-emerald-500/30 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600/20 transition-all">Deposit</button>
                                    </div>
                                 </td>
                                 <td className="p-4 text-right flex justify-end gap-3">
                                    <button onClick={() => { setViewingLedgerId(dealer.id); setViewingLedgerType('dealer'); }} className="text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:underline hover:text-cyan-300">Audit Ledger</button>
                                    <button onClick={() => { setSelectedDealer(dealer); setIsDealerModalOpen(true); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all">Edit Profile</button>
                                 </td>
                             </tr>
                         ))}
                         {dealers.length === 0 && (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-500 font-bold uppercase text-xs tracking-widest">No Registered Dealers</td></tr>
                         )}
                     </tbody>
                 </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="animate-fade-in space-y-4">
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Global User Directory</h3>
            <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead className="bg-slate-800/80 border-b border-slate-700">
                            <tr className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                                <th className="p-4">User</th>
                                <th className="p-4">Parent Dealer</th>
                                <th className="p-4 text-right">Balance</th>
                                <th className="p-4 text-center">Restriction</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-slate-700/20 transition-all">
                                    <td className="p-4">
                                        <div className="text-white font-bold text-sm">{user.name}</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-mono">{user.id}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-cyan-400 font-mono text-xs">{user.dealerId}</div>
                                    </td>
                                    <td className="p-4 text-right font-mono text-white text-xs">Rs {user.wallet.toLocaleString()}</td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => toggleAccountRestriction(user.id, 'user')} className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter transition-all ${user.isRestricted ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                            {user.isRestricted ? 'Locked' : 'Open'}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white">Profile</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'games' && (
        <div className="animate-fade-in space-y-6">
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Market Control Center</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map(game => (
                    <div key={game.id} className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700 shadow-xl flex flex-col justify-between space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center border border-slate-700 text-cyan-400 font-black">{game.name.substring(0,2)}</div>
                                <div>
                                    <h4 className="text-white font-black uppercase text-base">{game.name}</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Draw: {game.drawTime}</p>
                                </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${game.isMarketOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                {game.isMarketOpen ? 'Bidding Open' : 'Closed'}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                            <label className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Winning Result</label>
                            {game.winningNumber && !game.winningNumber.endsWith('_') ? (
                                <div className="text-4xl font-black text-white font-mono drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{game.winningNumber}</div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        maxLength={2}
                                        placeholder="--"
                                        value={winnerInputMap[game.id] || ''}
                                        onChange={(e) => setWinnerInputMap({...winnerInputMap, [game.id]: e.target.value})}
                                        className="bg-slate-800 border border-slate-600 rounded-lg w-16 p-2 text-center text-xl font-mono text-white focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <button 
                                        onClick={async () => {
                                            if (winnerInputMap[game.id]) {
                                                await declareWinner?.(game.id, winnerInputMap[game.id]);
                                                setWinnerInputMap({...winnerInputMap, [game.id]: ''});
                                            }
                                        }}
                                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                    >Declare</button>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {game.winningNumber && !game.payoutsApproved && (
                                <button 
                                    onClick={() => approvePayouts?.(game.id)}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20"
                                >Authorize Payouts</button>
                            )}
                            {game.winningNumber && (
                                <button 
                                    onClick={() => {
                                        const newNum = prompt("Enter new winning number:", game.winningNumber);
                                        if (newNum) updateWinner?.(game.id, newNum);
                                    }}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                                >Override Result</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {activeTab === 'winners' && (
          <div className="animate-fade-in space-y-4">
              <h3 className="text-xl font-black text-white uppercase tracking-widest">Recent Market Results</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {games.filter(g => g.winningNumber).map(g => (
                    <div key={g.id} className="bg-slate-800/40 border border-slate-700 p-4 rounded-xl text-center">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{g.name}</div>
                        <div className="text-2xl font-black text-white font-mono">{g.winningNumber}</div>
                        <div className="text-[8px] text-slate-600 uppercase mt-1">{g.drawTime}</div>
                    </div>
                ))}
              </div>
          </div>
      )}

      {/* Account Management Modal */}
      <Modal isOpen={isDealerModalOpen} onClose={() => { setIsDealerModalOpen(false); setSelectedDealer(undefined); }} title={selectedDealer ? "Modify Dealer Access" : "Register New Dealer Entity"} themeColor="red">
          <DealerForm dealer={selectedDealer} onSave={onSaveDealer} onCancel={() => { setIsDealerModalOpen(false); setSelectedDealer(undefined); }} />
      </Modal>

      {/* Transaction Modals */}
      <Modal isOpen={isDepositModalOpen} onClose={() => { setIsDepositModalOpen(false); setActionDealerId(undefined); }} title="Internal Deposit (Admin -> Dealer)" themeColor="emerald">
          <DealerTransactionForm type="Top-Up" dealers={dealers} fixedDealerId={actionDealerId} onCancel={() => setIsDepositModalOpen(false)} onTransaction={async (id, amt) => { await topUpDealerWallet(id, amt); setIsDepositModalOpen(false); }} />
      </Modal>

      <Modal isOpen={isWithdrawModalOpen} onClose={() => { setIsWithdrawModalOpen(false); setActionDealerId(undefined); }} title="Internal Withdrawal (Dealer -> Admin)" themeColor="amber">
          <DealerTransactionForm type="Withdrawal" dealers={dealers} fixedDealerId={actionDealerId} onCancel={() => setIsWithdrawModalOpen(false)} onTransaction={async (id, amt) => { await withdrawFromDealerWallet(id, amt); setIsWithdrawModalOpen(false); }} />
      </Modal>

      {/* Ledger Modal */}
      {activeLedgerAccount && (
        <Modal isOpen={!!activeLedgerAccount} onClose={() => { setViewingLedgerId(null); setViewingLedgerType(null); }} title={`Financial Audit Ledger: ${activeLedgerAccount.name}`} size="xl">
            <LedgerTable entries={activeLedgerAccount.ledger} />
        </Modal>
      )}

      <div className="p-12 text-center text-slate-700 font-black uppercase text-[10px] tracking-widest italic opacity-30">
        Enterprise Cloud Node • Handshake Verified
      </div>
    </div>
  );
};

export default AdminPanel;
