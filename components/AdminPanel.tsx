
import React, { useState, useMemo, useEffect } from 'react';
import { Dealer, User, Game, PrizeRates, LedgerEntry, Bet, NumberLimit, SubGameType, Admin } from '../types';
import { Icons } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { useCountdown } from '../hooks/useCountdown';

// --- TYPE DEFINITIONS ---
interface WinningTicket {
    id: string;
    userName: string;
    userId: string;
    dealerName: string;
    dealerId: string;
    gameName: string;
    winningNumber: string;
    payout: number;
    timestamp: string;
}

interface FinancialSummary {
  games: {
    gameId: string;
    gameName: string;
    winningNumber: string;
    totalStake: number;
    totalPayouts: number;
    userCommission: number;
    dealerCommission: number;
    netProfit: number;
  }[];
  totals: {
    totalStake: number;
    totalPayouts: number;
    totalUserCommission: number;
    totalDealerCommission: number;
    netProfit: number;
  };
}

interface NumberSummaryData {
    gameBreakdown: { name: string, total: number }[];
    twoDigit: { number: string, total: number }[];
    oneDigitOpen: { number: string, total: number }[];
    oneDigitClose: { number: string, total: number }[];
}

interface AdminPanelProps {
  admin: Admin;
  dealers: Dealer[];
  onSaveDealer?: (dealer: Dealer, originalId?: string) => Promise<void>;
  onUpdateAdmin?: (admin: Admin) => Promise<void>;
  users: User[];
  setUsers?: React.Dispatch<React.SetStateAction<User[]>>;
  games: Game[];
  bets: Bet[];
  declareWinner?: (gameId: string, winningNumber: string) => Promise<void>;
  updateWinner?: (gameId: string, winningNumber: string) => Promise<void>;
  approvePayouts?: (gameId: string) => Promise<void>;
  topUpDealerWallet?: (dealerId: string, amount: number) => Promise<void>;
  withdrawFromDealerWallet?: (dealerId: string, amount: number) => Promise<void>;
  toggleAccountRestriction?: (id: string, type: 'user' | 'dealer') => Promise<void>;
  onPlaceAdminBets?: (details: any) => Promise<void>;
  updateGameDrawTime?: (gameId: string, drawTime: string) => Promise<void>;
  onRefreshData?: () => void;
}

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'md' | 'lg' | 'xl'; themeColor?: string }> = ({ isOpen, onClose, title, children, size = 'md', themeColor = 'cyan' }) => {
    if (!isOpen) return null;
    const sizeClasses: Record<string, string> = { md: 'max-w-md', lg: 'max-w-3xl', xl: 'max-w-5xl' };
    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
            <div className={`bg-slate-900 rounded-2xl shadow-2xl w-full border border-${themeColor}-500/30 ${sizeClasses[size]} flex flex-col max-h-[90vh] overflow-hidden`}>
                <div className="flex justify-between items-center p-5 border-b border-slate-700 flex-shrink-0">
                    <h3 className={`text-sm sm:text-lg font-black text-${themeColor}-400 uppercase tracking-widest`}>{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 active:scale-75 transition-transform">{Icons.close}</button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar">{children}</div>
            </div>
        </div>
    );
};

const MarketCountdown: React.FC<{ drawTime: string }> = ({ drawTime }) => {
    const { status, text } = useCountdown(drawTime);
    return (
        <div className={`w-full text-center py-2 text-xs font-black uppercase tracking-[0.2em] rounded-t-xl border-x border-t transition-all ${status === 'OPEN' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10'}`}>
            {status === 'OPEN' ? `Active: ${text}` : `Closed: ${text}`}
        </div>
    );
};

const LedgerTable: React.FC<{ entries: LedgerEntry[] }> = ({ entries }) => (
    <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700 shadow-inner">
        <div className="overflow-y-auto max-h-[60vh] mobile-scroll-x no-scrollbar">
            <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-sm z-10">
                    <tr className="border-b border-slate-700">
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date/Time</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Debit (-)</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Credit (+)</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {(entries || []).map(entry => (
                        <tr key={entry.id} className="hover:bg-cyan-500/5 transition-colors">
                            <td className="p-4 text-[10px] font-mono text-slate-400 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
                            <td className="p-4 text-xs text-white font-medium">{entry.description}</td>
                            <td className="p-4 text-right text-rose-400 font-mono text-xs">{entry.debit > 0 ? `-${entry.debit.toFixed(2)}` : '-'}</td>
                            <td className="p-4 text-right text-emerald-400 font-mono text-xs">{entry.credit > 0 ? `+${entry.credit.toFixed(2)}` : '-'}</td>
                            <td className="p-4 text-right font-black text-white font-mono text-xs">Rs {entry.balance.toFixed(2)}</td>
                        </tr>
                    ))}
                    {(!entries || entries.length === 0) && (
                        <tr><td colSpan={5} className="p-12 text-center text-slate-600 font-black uppercase text-[10px] tracking-widest">No history found</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

const LedgersView: React.FC<{ 
    admin: Admin; 
    dealers: Dealer[]; 
    topUpDealerWallet?: (id: string, amt: number) => Promise<void>; 
    withdrawFromDealerWallet?: (id: string, amt: number) => Promise<void>; 
    onRefresh: () => void;
}> = ({ admin, dealers, topUpDealerWallet, withdrawFromDealerWallet, onRefresh }) => {
    const [viewingAdminLedger, setViewingAdminLedger] = useState(false);
    const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
    const [amount, setAmount] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleAction = async (type: 'topup' | 'withdraw') => {
        if (!selectedDealer || !amount || parseFloat(amount) <= 0) return;
        setLoading(true);
        try {
            if (type === 'topup') await topUpDealerWallet?.(selectedDealer.id, parseFloat(amount));
            else await withdrawFromDealerWallet?.(selectedDealer.id, parseFloat(amount));
            setAmount('');
            setSelectedDealer(null);
            onRefresh();
        } catch (e) {
            alert("Transaction failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Financial Operations</h3>
                <button onClick={() => setViewingAdminLedger(true)} className="px-4 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 text-red-400 font-black text-[10px] uppercase transition-all border border-slate-700 flex items-center gap-2">
                    {Icons.bookOpen} Admin Ledger
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <h4 className="text-sm font-black text-cyan-400 uppercase tracking-widest mb-4">Dealer Wallet Management</h4>
                    <div className="space-y-4">
                        <select 
                            value={selectedDealer?.id || ''} 
                            onChange={(e) => setSelectedDealer(dealers.find(d => d.id === e.target.value) || null)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold text-xs uppercase focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="">Select Dealer...</option>
                            {dealers.map(d => <option key={d.id} value={d.id}>{d.name} (Rs {d.wallet.toLocaleString()})</option>)}
                        </select>
                        <input 
                            type="number" 
                            placeholder="Enter Amount" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono font-bold focus:ring-2 focus:ring-cyan-500"
                        />
                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleAction('withdraw')}
                                disabled={loading || !selectedDealer}
                                className="flex-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                            >
                                Withdrawal
                            </button>
                            <button 
                                onClick={() => handleAction('topup')}
                                disabled={loading || !selectedDealer}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-50"
                            >
                                Deposit
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700 shadow-xl overflow-hidden flex flex-col">
                    <h4 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-4">Dealer Portfolios</h4>
                    <div className="overflow-y-auto max-h-[300px] no-scrollbar space-y-3">
                        {dealers.map(d => (
                            <div key={d.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-cyan-500/30 transition-all">
                                <div>
                                    <div className="text-xs font-black text-white uppercase">{d.name}</div>
                                    <div className="text-[9px] text-slate-500 font-mono uppercase">{d.id}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black text-emerald-400 font-mono">Rs {d.wallet.toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Modal isOpen={viewingAdminLedger} onClose={() => setViewingAdminLedger(false)} title="System Master Ledger (Admin)" size="xl" themeColor="red">
                <LedgerTable entries={admin.ledger} />
            </Modal>
        </div>
    );
};

const DealerForm: React.FC<{ 
    dealer?: Dealer, 
    onSave: (d: any, originalId?: string) => Promise<void>, 
    onCancel: () => void, 
    adminPrizeRates: PrizeRates 
}> = ({ dealer, onSave, onCancel, adminPrizeRates }) => {
    const [name, setName] = useState(dealer?.name || '');
    const [id, setId] = useState(dealer?.id || '');
    const [password, setPassword] = useState(dealer?.password || '');
    const [area, setArea] = useState(dealer?.area || '');
    const [contact, setContact] = useState(dealer?.contact || '');
    const [commissionRate, setCommissionRate] = useState(dealer?.commissionRate || 10);
    const [prizeRates, setPrizeRates] = useState<PrizeRates>(dealer?.prizeRates || adminPrizeRates);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave({ name, id, password, area, contact, commissionRate, prizeRates, wallet: dealer?.wallet || 0 }, dealer?.id);
        } catch (e) {
            alert("Save failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Agency Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:ring-1 focus:ring-cyan-500" />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Agency ID</label>
                    <input type="text" value={id} onChange={e => setId(e.target.value)} required disabled={!!dealer} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:ring-1 focus:ring-cyan-500 disabled:opacity-50" />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Pass-Key</label>
                    <input type="text" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:ring-1 focus:ring-cyan-500" />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Network Comm %</label>
                    <input type="number" value={commissionRate} onChange={e => setCommissionRate(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:ring-1 focus:ring-cyan-500" />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Regional Area</label>
                    <input type="text" value={area} onChange={e => setArea(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:ring-1 focus:ring-cyan-500" />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Direct Contact</label>
                    <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:ring-1 focus:ring-cyan-500" />
                </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest text-center">Payout Multiplier Protocol</h4>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-[9px] text-slate-600 font-bold uppercase mb-1">1-D Open</label>
                        <input type="number" value={prizeRates.oneDigitOpen} onChange={e => setPrizeRates({...prizeRates, oneDigitOpen: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono" />
                    </div>
                    <div>
                        <label className="block text-[9px] text-slate-600 font-bold uppercase mb-1">1-D Close</label>
                        <input type="number" value={prizeRates.oneDigitClose} onChange={e => setPrizeRates({...prizeRates, oneDigitClose: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono" />
                    </div>
                    <div>
                        <label className="block text-[9px] text-slate-600 font-bold uppercase mb-1">2-Digit</label>
                        <input type="number" value={prizeRates.twoDigit} onChange={e => setPrizeRates({...prizeRates, twoDigit: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono" />
                    </div>
                </div>
            </div>

            <div className="flex gap-4 pt-4">
                <button type="button" onClick={onCancel} className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest border border-slate-700">Cancel</button>
                <button type="submit" disabled={loading} className="flex-2 px-12 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-cyan-900/20 active:scale-95 transition-all">
                    {loading ? 'SYNCING...' : dealer ? 'APPLY UPDATE' : 'COMMIT REGISTRATION'}
                </button>
            </div>
        </form>
    );
};

const BettingSheetView: React.FC<{ 
    games: Game[]; 
    fetchWithAuth: any;
    users: User[];
    dealers: Dealer[];
}> = ({ games, fetchWithAuth, users, dealers }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGameId, setSelectedGameId] = useState('');
    const [results, setResults] = useState<Bet[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('q', searchQuery);
            if (selectedGameId) params.append('gameId', selectedGameId);
            
            const res = await fetchWithAuth(`/api/admin/bets/search?${params.toString()}`);
            if (res.ok) {
                setResults(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, selectedGameId]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700">
                <div className="flex-grow w-full md:w-auto">
                    <h3 className="text-xl font-black text-white uppercase tracking-widest mb-1">Comprehensive Betting Sheet</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">System-wide Book Audit & Number Tracking</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative group min-w-[150px]">
                        <input 
                            type="text" 
                            placeholder="Search Number..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono font-bold focus:ring-2 focus:ring-red-500 transition-all uppercase"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{Icons.search}</div>
                    </div>
                    <select 
                        value={selectedGameId} 
                        onChange={(e) => setSelectedGameId(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold text-xs uppercase focus:ring-2 focus:ring-red-500 min-w-[180px]"
                    >
                        <option value="">All Active Markets</option>
                        {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-slate-800/40 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-slate-900/80 border-b border-slate-700">
                            <tr>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Time</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Market</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Player / Dealer</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Game Type</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Booked Numbers</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Stake</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={6} className="p-20 text-center animate-pulse text-slate-500 font-black uppercase text-xs">Querying Global Book...</td></tr>
                            ) : results.length === 0 ? (
                                <tr><td colSpan={6} className="p-20 text-center text-slate-600 font-black uppercase text-xs">No matching bookings found</td></tr>
                            ) : results.map(bet => {
                                const game = games.find(g => g.id === bet.gameId);
                                const user = users.find(u => u.id === bet.userId);
                                const dealer = dealers.find(d => d.id === bet.dealerId);
                                return (
                                    <tr key={bet.id} className="hover:bg-red-500/5 transition-colors group">
                                        <td className="p-4 text-[10px] font-mono text-slate-500">{new Date(bet.timestamp).toLocaleTimeString()}</td>
                                        <td className="p-4">
                                            <div className="text-white font-black text-xs uppercase">{game?.name || '---'}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs font-black text-white uppercase">{user?.name || bet.userId}</div>
                                            <div className="text-[9px] font-bold text-sky-400 uppercase tracking-widest">{dealer?.name || bet.dealerId}</div>
                                        </td>
                                        <td className="p-4 text-[10px] font-bold text-slate-400 uppercase">{bet.subGameType}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {bet.numbers.map((n, i) => (
                                                    <span 
                                                        key={i} 
                                                        className={`px-2 py-0.5 rounded font-mono text-xs font-bold border ${n === searchQuery ? 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
                                                    >
                                                        {n}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="text-emerald-400 font-black font-mono text-base">Rs {bet.totalAmount.toLocaleString()}</div>
                                            <div className="text-[8px] text-slate-500 uppercase font-black">Total Ticket Value</div>
                                        </td>
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

const LiveView: React.FC<{ games: Game[], dealers: Dealer[], fetchWithAuth: any }> = ({ games, dealers, fetchWithAuth }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [gameId, setGameId] = useState('');
    const [dealerId, setDealerId] = useState('');
    const [query, setQuery] = useState('');
    const [data, setData] = useState<NumberSummaryData | null>(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (date) params.append('date', date);
            if (gameId) params.append('gameId', gameId);
            if (dealerId) params.append('dealerId', dealerId);
            if (query) params.append('query', query);

            const res = await fetchWithAuth(`/api/admin/number-summary?${params.toString()}`);
            if (res.ok) setData(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleCopy = (numbers: { number: string, total: number }[]) => {
        const text = numbers.map(n => `${n.number} rs${n.total}`).join('\n');
        navigator.clipboard.writeText(text);
    };

    const clearFilters = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setGameId('');
        setDealerId('');
        setQuery('');
    };

    useEffect(() => { loadData(); }, [date, gameId, dealerId, query]);

    return (
        <div className="space-y-10 animate-fade-in">
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">Number-wise Stake Summary</h2>

            {/* Filter Bar */}
            <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-wrap gap-6 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-xs font-bold focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Game</label>
                    <select value={gameId} onChange={e => setGameId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-xs font-black uppercase focus:ring-2 focus:ring-cyan-500">
                        <option value="">All Games</option>
                        {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Dealer</label>
                    <select value={dealerId} onChange={e => setDealerId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-xs font-black uppercase focus:ring-2 focus:ring-cyan-500">
                        <option value="">All Dealers</option>
                        {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[250px]">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Filter by Number</label>
                    <input type="text" placeholder="e.g., ^5, 5$, 5" value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-xs font-bold focus:ring-2 focus:ring-cyan-500" />
                </div>
                <button onClick={clearFilters} className="bg-slate-700 hover:bg-slate-600 text-white font-black px-8 py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all h-[44px]">Clear Filters</button>
            </div>

            {loading ? (
                <div className="p-20 text-center animate-pulse text-slate-500 font-black uppercase text-xs tracking-widest">Querying Global Ledger...</div>
            ) : !data ? null : (
                <div className="space-y-10">
                    {/* Game Breakdown Row */}
                    <div>
                        <h3 className="text-xl font-black text-cyan-400 uppercase tracking-widest mb-6">GAME STAKE BREAKDOWN</h3>
                        <div className="flex flex-wrap gap-4">
                            {data.gameBreakdown.map(g => (
                                <div key={g.name} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 min-w-[150px] text-center shadow-lg group hover:border-cyan-500/50 transition-all">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-1 group-hover:text-cyan-400">{g.name}</div>
                                    <div className="text-lg font-black text-white font-mono">Rs {g.total.toLocaleString()}</div>
                                </div>
                            ))}
                            {data.gameBreakdown.length === 0 && (
                                <div className="text-slate-600 uppercase font-black text-xs">No volume detected</div>
                            )}
                        </div>
                    </div>

                    {/* Three Column View */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                        {/* 2 Digit */}
                        <div className="bg-slate-800/40 rounded-2xl border border-slate-700 overflow-hidden flex flex-col shadow-2xl h-[600px]">
                            <div className="p-5 border-b border-slate-700 bg-slate-800/60 flex justify-between items-center">
                                <h4 className="text-lg font-black text-cyan-400 uppercase tracking-widest">2 Digit Stakes</h4>
                                <button onClick={() => handleCopy(data.twoDigit)} className="bg-slate-700 hover:bg-slate-600 text-[10px] text-white px-3 py-1 rounded flex items-center gap-1 font-black uppercase">
                                    {Icons.clipboardList} Copy
                                </button>
                            </div>
                            <div className="flex-grow overflow-y-auto no-scrollbar p-6 space-y-6">
                                {data.twoDigit.map(item => (
                                    <div key={item.number} className="flex justify-between items-center group">
                                        <span className="text-3xl font-black text-cyan-300 font-mono tracking-tighter group-hover:scale-110 transition-transform">{item.number}</span>
                                        <span className="text-lg font-black text-white font-mono">Rs {item.total.toLocaleString()}</span>
                                    </div>
                                ))}
                                {data.twoDigit.length === 0 && <div className="text-center text-slate-600 uppercase text-xs font-black py-10">Empty</div>}
                            </div>
                        </div>

                        {/* 1 Digit Open */}
                        <div className="bg-slate-800/40 rounded-2xl border border-slate-700 overflow-hidden flex flex-col shadow-2xl h-[600px]">
                            <div className="p-5 border-b border-slate-700 bg-slate-800/60 flex justify-between items-center">
                                <h4 className="text-lg font-black text-amber-400 uppercase tracking-widest">1 Digit Open</h4>
                                <button onClick={() => handleCopy(data.oneDigitOpen)} className="bg-slate-700 hover:bg-slate-600 text-[10px] text-white px-3 py-1 rounded flex items-center gap-1 font-black uppercase">
                                    {Icons.clipboardList} Copy
                                </button>
                            </div>
                            <div className="flex-grow overflow-y-auto no-scrollbar p-6 space-y-6">
                                {data.oneDigitOpen.map(item => (
                                    <div key={item.number} className="flex justify-between items-center group">
                                        <span className="text-3xl font-black text-amber-400 font-mono tracking-tighter group-hover:scale-110 transition-transform">{item.number}</span>
                                        <span className="text-lg font-black text-white font-mono">Rs {item.total.toLocaleString()}</span>
                                    </div>
                                ))}
                                {data.oneDigitOpen.length === 0 && <div className="text-center text-slate-600 uppercase text-xs font-black py-10">Empty</div>}
                            </div>
                        </div>

                        {/* 1 Digit Close */}
                        <div className="bg-slate-800/40 rounded-2xl border border-slate-700 overflow-hidden flex flex-col shadow-2xl h-[600px]">
                            <div className="p-5 border-b border-slate-700 bg-slate-800/60 flex justify-between items-center">
                                <h4 className="text-lg font-black text-rose-400 uppercase tracking-widest">1 Digit Close</h4>
                                <button onClick={() => handleCopy(data.oneDigitClose)} className="bg-slate-700 hover:bg-slate-600 text-[10px] text-white px-3 py-1 rounded flex items-center gap-1 font-black uppercase">
                                    {Icons.clipboardList} Copy
                                </button>
                            </div>
                            <div className="flex-grow overflow-y-auto no-scrollbar p-6 space-y-6">
                                {data.oneDigitClose.map(item => (
                                    <div key={item.number} className="flex justify-between items-center group">
                                        <span className="text-3xl font-black text-rose-400 font-mono tracking-tighter group-hover:scale-110 transition-transform">{item.number}</span>
                                        <span className="text-lg font-black text-white font-mono">Rs {item.total.toLocaleString()}</span>
                                    </div>
                                ))}
                                {data.oneDigitClose.length === 0 && <div className="text-center text-slate-600 uppercase text-xs font-black py-10">Empty</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StakesView: React.FC<{ fetchWithAuth: any }> = ({ fetchWithAuth }) => {
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const loadSummary = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth('/api/admin/summary');
            if (res.ok) setSummary(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleDownloadBackup = async () => {
        try {
            const res = await fetchWithAuth('/api/admin/export');
            if (res.ok) {
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ababa_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (e) {
            alert("Backup failed to download.");
        }
    };

    useEffect(() => { loadSummary(); }, []);

    if (loading) return <div className="p-20 text-center animate-pulse text-slate-500 font-black uppercase text-xs">Aggregating Ledger...</div>;
    if (!summary) return null;

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Financial Summary</h3>
                <div className="flex gap-2">
                    <button onClick={handleDownloadBackup} className="px-4 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 text-sky-400 font-black text-[10px] uppercase transition-all border border-slate-700 flex items-center gap-2">
                        {Icons.clipboardList} Export System
                    </button>
                    <button onClick={loadSummary} className="px-4 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 text-emerald-400 font-black text-[10px] uppercase transition-all active:scale-90 border border-slate-700">Refresh</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Volume</div>
                    <div className="text-2xl font-black text-white font-mono">Rs {summary.totals.totalStake.toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700">
                    <div className="text-[10px] text-sky-500 font-black uppercase tracking-widest mb-1 text-sky-400">Dealer Comm. Burn</div>
                    <div className="text-2xl font-black text-sky-400 font-mono">Rs {summary.totals.totalDealerCommission.toLocaleString()}</div>
                    <div className="text-[8px] text-slate-600 font-bold uppercase mt-1">Agency network payouts</div>
                </div>
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700">
                    <div className="text-[10px] text-rose-500 font-black uppercase tracking-widest mb-1">Total Payouts</div>
                    <div className="text-2xl font-black text-rose-400 font-mono">Rs {summary.totals.totalPayouts.toLocaleString()}</div>
                </div>
                <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/20">
                    <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">Net Profit</div>
                    <div className={`text-2xl font-black font-mono ${summary.totals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Rs {summary.totals.netProfit.toLocaleString()}</div>
                    <div className="text-[8px] text-slate-600 font-bold uppercase mt-1">Stake - Payouts - (Dlr Comm + Usr Comm)</div>
                </div>
            </div>

            <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[900px]">
                        <thead className="bg-slate-800/80 border-b border-slate-700">
                            <tr>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Market</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Stake</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">User Comm.</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Dealer Comm.</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Payouts</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Net Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {summary.games.map(game => (
                                <tr key={game.gameId} className="hover:bg-cyan-500/5 transition-all">
                                    <td className="p-4 font-black text-white uppercase text-xs">{game.gameName}</td>
                                    <td className="p-4 text-right font-mono text-white text-xs">Rs {game.totalStake.toLocaleString()}</td>
                                    <td className="p-4 text-right font-mono text-sky-400 text-xs">{game.userCommission.toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono text-emerald-400 text-xs">{game.dealerCommission.toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono text-rose-400 text-xs">{game.totalPayouts.toFixed(2)}</td>
                                    <td className={`p-4 text-right font-black font-mono text-sm ${game.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        Rs {game.netProfit.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const WinnersView: React.FC<{ fetchWithAuth: any }> = ({ fetchWithAuth }) => {
    const [winners, setWinners] = useState<WinningTicket[]>([]);
    const [loading, setLoading] = useState(true);

    const loadWinners = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth('/api/admin/detailed-winners');
            if (res.ok) setWinners(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadWinners(); }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Official Winners List</h3>
                <button onClick={loadWinners} className="px-4 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 text-amber-400 font-black text-[10px] uppercase transition-all active:scale-90 border border-slate-700">Refresh Winners</button>
            </div>

            <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-slate-800/80 border-b border-slate-700">
                            <tr>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Player Identity</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Dealer</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Game Market</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Hit Number</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Prize Disbursed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-500 font-black uppercase text-xs tracking-widest">Filtering Hits...</td></tr>
                            ) : winners.length === 0 ? (
                                <tr><td colSpan={5} className="p-20 text-center text-slate-600 font-black uppercase text-xs tracking-widest">No matching hits detected in this cycle</td></tr>
                            ) : winners.map(win => (
                                <tr key={win.id} className="hover:bg-amber-500/5 transition-all group">
                                    <td className="p-4 border-l-4 border-transparent group-hover:border-amber-400">
                                        <div className="text-white font-black text-sm uppercase">{win.userName}</div>
                                        <div className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">{win.userId}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sky-400 font-bold text-xs uppercase">{win.dealerName}</div>
                                        <div className="text-[9px] text-slate-500 font-mono uppercase">{win.dealerId}</div>
                                    </td>
                                    <td className="p-4 text-slate-300 font-black uppercase text-xs">{win.gameName}</td>
                                    <td className="p-4 text-center">
                                        <span className="bg-amber-400/20 text-amber-400 px-5 py-1.5 rounded-xl border border-amber-400/30 font-mono font-black text-xl shadow-[0_0_15px_rgba(251,191,36,0.1)]">{win.winningNumber}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="text-emerald-400 font-black font-mono text-xl">Rs {win.payout.toLocaleString()}</div>
                                        <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{new Date(win.timestamp).toLocaleTimeString()}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  admin, dealers, users, games, declareWinner, updateWinner, approvePayouts, topUpDealerWallet, withdrawFromDealerWallet, toggleAccountRestriction, updateGameDrawTime, onRefreshData, onSaveDealer 
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [winnerInputMap, setWinnerInputMap] = useState<Record<string, string>>({});
  const [editingWinnerMap, setEditingWinnerMap] = useState<Record<string, boolean>>({});
  const [pendingDeclareMap, setPendingDeclareMap] = useState<Record<string, boolean>>({});
  const [viewingUserLedgerFor, setViewingUserLedgerFor] = useState<User | null>(null);
  const [viewingDealerLedgerFor, setViewingDealerLedgerFor] = useState<Dealer | null>(null);
  const [isDealerModalOpen, setIsDealerModalOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | undefined>(undefined);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [tempTime, setTempTime] = useState<string>('');

  const { fetchWithAuth } = useAuth();

  const handleDeclareAction = async (gameId: string, val: string, isUpdate: boolean) => {
    if (!val) return;
    setPendingDeclareMap(prev => ({ ...prev, [gameId]: true }));
    setEditingWinnerMap(prev => ({ ...prev, [gameId]: false }));
    try {
        if (isUpdate) {
            await updateWinner?.(gameId, val);
        } else {
            await declareWinner?.(gameId, val);
        }
        setWinnerInputMap(prev => { const next = { ...prev }; delete next[gameId]; return next; });
        if (onRefreshData) {
            await onRefreshData();
        }
    } catch (error) {
        alert("Operation Failed.");
        setEditingWinnerMap(prev => ({ ...prev, [gameId]: true }));
    } finally {
        setPendingDeclareMap(prev => ({ ...prev, [gameId]: false }));
    }
  };

  const handleManualPayout = async (gameId: string) => {
      if (!window.confirm("Disburse prize funds to all winners for this market?")) return;
      try {
          await approvePayouts?.(gameId);
          if (onRefreshData) onRefreshData();
          alert("Prizes credited to user accounts successfully.");
      } catch (e) {
          alert("Payout execution failed.");
      }
  };

  const adjustDrawTime = async (gameId: string, currentDrawTime: string, deltaMinutes: number) => {
      const [h, m] = currentDrawTime.split(':').map(Number);
      let totalMinutes = h * 60 + m + deltaMinutes;
      if (totalMinutes < 0) totalMinutes += 1440;
      if (totalMinutes >= 1440) totalMinutes -= 1440;
      const newH = Math.floor(totalMinutes / 60);
      const newM = totalMinutes % 60;
      const formattedTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
      try {
          await updateGameDrawTime?.(gameId, formattedTime);
          if (onRefreshData) await onRefreshData();
      } catch (e) {
          alert("Time update failed.");
      }
  };

  const tabs = [
    { id: 'dashboard', label: 'Stats' },
    { id: 'live', label: 'Live' },
    { id: 'ledgers', label: 'Ledgers' },
    { id: 'bettingsheet', label: 'Sheet' },
    { id: 'games', label: 'Markets' },
    { id: 'winners', label: 'Winners' },
    { id: 'users', label: 'Users' },
    { id: 'dealers', label: 'Dealers' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl sm:text-5xl font-black text-red-500 uppercase tracking-tighter shadow-glow">Admin Ops</h2>
        <div className="bg-slate-800/80 p-1 rounded-xl flex items-center space-x-1 border border-slate-700 w-full sm:w-auto overflow-x-auto no-scrollbar shadow-2xl">
            {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 py-2.5 px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 ${activeTab === tab.id ? 'bg-red-600 text-white shadow-xl shadow-red-900/20' : 'text-slate-500 hover:text-white'}`}>
                {tab.label}
            </button>
            ))}
        </div>
      </div>

      {activeTab === 'dashboard' && <StakesView fetchWithAuth={fetchWithAuth} />}
      {activeTab === 'live' && <LiveView games={games} dealers={dealers} fetchWithAuth={fetchWithAuth} />}
      {activeTab === 'ledgers' && (
          <LedgersView 
            admin={admin} 
            dealers={dealers} 
            topUpDealerWallet={topUpDealerWallet} 
            withdrawFromDealerWallet={withdrawFromDealerWallet}
            onRefresh={() => onRefreshData?.()}
          />
      )}
      {activeTab === 'bettingsheet' && (
          <BettingSheetView 
            games={games} 
            fetchWithAuth={fetchWithAuth} 
            users={users} 
            dealers={dealers} 
          />
      )}
      {activeTab === 'winners' && <WinnersView fetchWithAuth={fetchWithAuth} />}

      {activeTab === 'users' && (
          <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
              <div className="p-6 border-b border-slate-700 bg-slate-800/60">
                  <h3 className="text-white font-black uppercase tracking-widest">Global Player Database</h3>
              </div>
              <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left min-w-[700px]">
                      <thead className="bg-slate-900/50 border-b border-slate-800">
                          <tr>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User Identity</th>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Wallet Pool</th>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Audit</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                          {users.map(u => (
                              <tr key={u.id} className="hover:bg-cyan-500/5 transition-all">
                                  <td className="p-4">
                                      <div className="text-sm font-black text-white uppercase">{u.name}</div>
                                      <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-tighter">{u.id}</div>
                                  </td>
                                  <td className="p-4 text-xs font-mono text-emerald-400 font-black">Rs {u.wallet.toLocaleString()}</td>
                                  <td className="p-4 text-right">
                                      <button onClick={() => setViewingUserLedgerFor(u)} className="text-[10px] font-black text-cyan-400 hover:text-white uppercase tracking-widest transition-all mr-6">Open Ledger</button>
                                      <button onClick={() => toggleAccountRestriction?.(u.id, 'user')} className={`text-[10px] font-black uppercase tracking-widest transition-all ${u.isRestricted ? 'text-red-500' : 'text-emerald-500'}`}>
                                          {u.isRestricted ? 'Unlock' : 'Lock'}
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'dealers' && (
          <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700">
                  <h3 className="text-white font-black uppercase tracking-widest">Global Dealer Network</h3>
                  <button onClick={() => { setSelectedDealer(undefined); setIsDealerModalOpen(true); }} className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95">Make Dealer</button>
              </div>
              <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                  <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left min-w-[800px]">
                          <thead className="bg-slate-900/50 border-b border-slate-800">
                              <tr>
                                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Dealer Identity</th>
                                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</th>
                                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Wallet Pool</th>
                                  <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Audit</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                              {dealers.map(d => (
                                  <tr key={d.id} className="hover:bg-cyan-500/5 transition-all">
                                      <td className="p-4">
                                          <div className="text-sm font-black text-white uppercase">{d.name}</div>
                                          <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-tighter">{d.id}</div>
                                      </td>
                                      <td className="p-4">
                                          <div className="text-xs text-slate-300 font-bold uppercase">{d.area || 'N/A'}</div>
                                          <div className="text-[9px] text-slate-500">{d.contact || '-'}</div>
                                      </td>
                                      <td className="p-4 text-xs font-mono text-emerald-400 font-black">Rs {d.wallet.toLocaleString()}</td>
                                      <td className="p-4 text-right">
                                          <div className="flex justify-end gap-3 items-center">
                                              <button onClick={() => setViewingDealerLedgerFor(d)} className="text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:underline">Audit Ledger</button>
                                              <button onClick={() => { setSelectedDealer(d); setIsDealerModalOpen(true); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white">Edit</button>
                                              <button onClick={() => toggleAccountRestriction?.(d.id, 'dealer')} className={`text-[10px] font-black uppercase tracking-widest transition-all ${d.isRestricted ? 'text-red-500' : 'text-emerald-500'}`}>
                                                  {d.isRestricted ? 'Unlock' : 'Lock'}
                                              </button>
                                          </div>
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
        <div className="animate-fade-in space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map(game => {
                    const isEditingResult = editingWinnerMap[game.id];
                    const isPendingResult = pendingDeclareMap[game.id];
                    const winningNumber = game.winningNumber && !game.winningNumber.endsWith('_') ? game.winningNumber : null;
                    const isEditingTime = editingTimeId === game.id;

                    return (
                        <div key={game.id} className="bg-slate-800/60 rounded-3xl border border-slate-700 shadow-2xl flex flex-col transition-all group backdrop-blur-md">
                            <MarketCountdown drawTime={game.drawTime} />
                            <div className="p-6 space-y-6 flex-grow">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-white font-black uppercase text-xl tracking-tight">{game.name}</h4>
                                        <div className="flex items-center gap-3 mt-2">
                                            {isEditingTime ? (
                                                <div className="flex items-center gap-2 animate-fade-in bg-slate-900 px-2 py-1 rounded border border-cyan-500/30">
                                                    <input 
                                                        type="time" 
                                                        autoFocus
                                                        value={tempTime} 
                                                        onChange={(e) => setTempTime(e.target.value)}
                                                        className="bg-transparent border-none text-[10px] text-white font-bold focus:ring-0 p-0 w-20"
                                                    />
                                                    <button onClick={async () => { await updateGameDrawTime?.(game.id, tempTime); setEditingTimeId(null); if (onRefreshData) await onRefreshData(); }} className="text-emerald-400 hover:text-emerald-300 text-[10px] font-black">✓</button>
                                                    <button onClick={() => setEditingTimeId(null)} className="text-rose-400 hover:text-rose-300 text-[10px] font-black">✕</button>
                                                </div>
                                            ) : (
                                                <div 
                                                    onClick={() => { setEditingTimeId(game.id); setTempTime(game.drawTime); }}
                                                    className="group/time cursor-pointer flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-900 px-2 py-1 rounded border border-transparent hover:border-cyan-500/30 transition-all"
                                                    title="Click to edit draw time"
                                                >
                                                    <span>Draw: {game.drawTime}</span>
                                                    <span className="opacity-0 group-hover/time:opacity-100 text-[8px] text-cyan-500">Edit</span>
                                                </div>
                                            )}
                                            
                                            {!isEditingTime && (
                                                <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700 shadow-inner">
                                                    <button onClick={() => adjustDrawTime(game.id, game.drawTime, -5)} className="px-2 py-1 text-slate-500 hover:text-rose-400 transition-colors active:scale-75">{Icons.minus}</button>
                                                    <span className="w-px h-3 bg-slate-700 mx-0.5"></span>
                                                    <button onClick={() => adjustDrawTime(game.id, game.drawTime, 5)} className="px-2 py-1 text-slate-500 hover:text-emerald-400 transition-colors active:scale-75">{Icons.plus}</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900/80 p-8 rounded-2xl border border-slate-700 flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden group/box">
                                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mb-4">Official Result</label>
                                    {isPendingResult ? (
                                        <div className="text-cyan-400 font-black uppercase animate-pulse text-sm tracking-widest">Validating...</div>
                                    ) : winningNumber && !isEditingResult ? (
                                        <div className="cursor-pointer text-center group" onClick={() => { setEditingWinnerMap({ ...editingWinnerMap, [game.id]: true }); setWinnerInputMap({ ...winnerInputMap, [game.id]: winningNumber }); }}>
                                            <div className="text-7xl font-black text-white font-mono drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{winningNumber}</div>
                                            <div className="text-[8px] text-cyan-500 uppercase mt-4 opacity-0 group-hover:opacity-100 transition-all font-black tracking-widest">Modify Result</div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 animate-fade-in">
                                            <input type="text" maxLength={2} autoFocus value={winnerInputMap[game.id] || ''} onChange={(e) => setWinnerInputMap({...winnerInputMap, [game.id]: e.target.value})} className="bg-slate-800 border border-slate-600 rounded-xl w-24 p-3 text-center text-4xl font-mono font-black text-white focus:ring-2 focus:ring-cyan-500 shadow-inner" placeholder="--" />
                                            <button onClick={() => handleDeclareAction(game.id, winnerInputMap[game.id], !!winningNumber)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-90 transition-all">SET</button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2">
                                    {game.payoutsApproved ? (
                                        <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-center shadow-inner">
                                            <span className="text-xs">✓</span> Prizes Disbursed
                                        </div>
                                    ) : game.winningNumber && !game.winningNumber.endsWith('_') ? (
                                         <button 
                                            onClick={() => handleManualPayout(game.id)}
                                            className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 border border-amber-500/30 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg active:scale-95 transition-all"
                                         >
                                            Pay Amount to Winner
                                        </button>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 bg-slate-900/50 border border-slate-800 text-slate-500 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-center">
                                            Awaiting Declaration
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {viewingUserLedgerFor && (
          <Modal isOpen={!!viewingUserLedgerFor} onClose={() => setViewingUserLedgerFor(null)} title={`Ledger Audit: ${viewingUserLedgerFor.name}`} size="xl" themeColor="cyan">
              <LedgerTable entries={viewingUserLedgerFor.ledger} />
          </Modal>
      )}

      {viewingDealerLedgerFor && (
          <Modal isOpen={!!viewingDealerLedgerFor} onClose={() => setViewingDealerLedgerFor(null)} title={`Dealer Audit: ${viewingDealerLedgerFor.name}`} size="xl" themeColor="emerald">
              <LedgerTable entries={viewingDealerLedgerFor.ledger} />
          </Modal>
      )}

      <Modal isOpen={isDealerModalOpen} onClose={() => setIsDealerModalOpen(false)} title={selectedDealer ? "Edit Dealer Profile" : "Register New Agency Dealer"} themeColor="cyan">
          <DealerForm 
            dealer={selectedDealer} 
            adminPrizeRates={admin.prizeRates} 
            onCancel={() => setIsDealerModalOpen(false)}
            onSave={async (d, o) => {
                await onSaveDealer?.(d, o);
                setIsDealerModalOpen(false);
                if (onRefreshData) await onRefreshData();
            }}
          />
      </Modal>
    </div>
  );
};

export default AdminPanel;
