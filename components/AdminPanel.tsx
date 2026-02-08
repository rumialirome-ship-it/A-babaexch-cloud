
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

const getTodayDateString = () => new Date().toISOString().split('T')[0];

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
                <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

const LedgerTable: React.FC<{ entries: LedgerEntry[] }> = ({ entries }) => (
    <div className="bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700">
        <div className="overflow-y-auto max-h-[60vh] mobile-scroll-x">
            <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-sm">
                    <tr>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Debit</th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Credit</th>
                        <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {Array.isArray(entries) && [...entries].sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()).map(entry => (
                        <tr key={entry.id} className="hover:bg-cyan-500/10 text-sm transition-colors">
                            <td className="p-3 text-slate-400 whitespace-nowrap">{entry.timestamp?.toLocaleString() || 'N/A'}</td>
                            <td className="p-3 text-white">{entry.description}</td>
                            <td className="p-3 text-right text-red-400 font-mono">{(entry.debit || 0) > 0 ? entry.debit.toFixed(2) : '-'}</td>
                            <td className="p-3 text-right text-green-400 font-mono">{(entry.credit || 0) > 0 ? entry.credit.toFixed(2) : '-'}</td>
                            <td className="p-3 text-right font-semibold text-white font-mono">{(entry.balance || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                     {(!Array.isArray(entries) || entries.length === 0) && (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">No ledger entries found.</td></tr>
                    )}
                </tbody>
            </table>
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
            onCancel(); // Closes the modal on success
        } catch (err) {
            alert("Error: Dealer ID might already exist or system error.");
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
            </div>
            
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="col-span-3 text-[10px] font-black text-red-500 uppercase">Prize Rates</div>
                <div>
                    <label className={labelClass}>2-Digit (x)</label>
                    <input type="number" value={formData.prizeRates.twoDigit} onChange={e => setFormData({...formData, prizeRates: {...formData.prizeRates, twoDigit: e.target.value}})} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>1-Open (x)</label>
                    <input type="number" value={formData.prizeRates.oneDigitOpen} onChange={e => setFormData({...formData, prizeRates: {...formData.prizeRates, oneDigitOpen: e.target.value}})} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>1-Close (x)</label>
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
    if (!summary) return <div className="text-center p-12 text-slate-500 font-bold animate-pulse uppercase text-xs tracking-widest">Compiling System Metrics...</div>;

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
                <SummaryCard title="Net Ecosystem Profit" value={summary.totals?.netProfit} color={summary.totals?.netProfit >= 0 ? "text-emerald-400" : "text-red-400"} />
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
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Search Numbers or Account ID</label>
                    <input type="text" placeholder="e.g. 43 or user01" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Market Filter</label>
                    <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)} className={inputClass}>
                        <option value="">All Markets</option>
                        {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">User Account</label>
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
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Numbers</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Stake</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-10 text-center animate-pulse text-slate-500 uppercase tracking-widest text-xs">Querying system database...</td></tr>
                            ) : results.length === 0 ? (
                                <tr><td colSpan={5} className="p-10 text-center text-slate-500 font-black uppercase tracking-widest text-xs">No matching bets found</td></tr>
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
                    <option value="">-- Select Dealer Account --</option>
                    {dealers.map(d => (
                        <option key={d.id} value={d.id}>
                            {d.name} ({d.id}) — Balance: PKR {d.wallet.toLocaleString()}
                        </option>
                    ))}
                </select>
            )}
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder={`Enter PKR amount to ${type}`} className={inputClass} min="0.01" required step="0.01" autoFocus />
            <div className="flex gap-3 pt-4">
                <button type="button" onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all">Cancel</button>
                <button type="submit" className={`flex-1 font-black py-3 rounded-xl text-white text-xs shadow-lg bg-${themeColor}-600 hover:bg-${themeColor}-500 transition-all uppercase tracking-widest`}>Process {type}</button>
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

  useEffect(() => {
    if (activeTab === 'dashboard') {
        fetchWithAuth('/api/admin/summary').then(r => r.json()).then(setSummaryData).catch(console.error);
    }
  }, [activeTab, fetchWithAuth]);

  const tabs = [
    { id: 'dashboard', label: 'Stats', icon: Icons.chartBar },
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
        <h2 className="text-2xl sm:text-4xl font-black text-red-500 uppercase tracking-tighter">System Administration</h2>
        <div className="bg-slate-800/80 p-1 rounded-xl flex items-center space-x-1 border border-slate-700 w-full sm:w-auto overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 flex items-center space-x-2 py-2 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab.id ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                {tab.icon} <span>{tab.label}</span>
            </button>
            ))}
        </div>
      </div>
      
      {activeTab === 'dashboard' && <DashboardView summary={summaryData} admin={admin} onOpenAdminLedger={() => { setViewingLedgerId(admin.id); setViewingLedgerType('admin'); }} />}
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
                             <th className="p-4 text-right">Pool Balance</th>
                             <th className="p-4 text-center">Status</th>
                             <th className="p-4 text-center">Fund Controls</th>
                             <th className="p-4 text-right">Actions</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800">
                         {dealers.map(dealer => (
                             <tr key={dealer.id} className="hover:bg-slate-700/20 transition-all">
                                 <td className="p-4">
                                     <div className="text-white font-black text-sm">{dealer.name}</div>
                                     <div className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">{dealer.id} | {dealer.area}</div>
                                 </td>
                                 <td className="p-4 text-right">
                                    <div className="font-mono text-emerald-400 font-bold text-sm">Rs {(dealer.wallet || 0).toLocaleString()}</div>
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
                                    <button onClick={() => { setViewingLedgerId(dealer.id); setViewingLedgerType('dealer'); }} className="text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:underline">Ledger</button>
                                    <button onClick={() => { setSelectedDealer(dealer); setIsDealerModalOpen(true); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all">Edit</button>
                                 </td>
                             </tr>
                         ))}
                         {dealers.length === 0 && (
                             <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-black uppercase text-xs tracking-widest">No Dealers Registered</td></tr>
                         )}
                     </tbody>
                 </table>
             </div>
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
        Enterprise Cloud Node • Secure Admin Handshake Verified
      </div>
    </div>
  );
};

export default AdminPanel;
