
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

interface LiveStats {
    dealerBookings: { id: string, name: string, total: number }[];
    typeBookings: { type: string, total: number }[];
    topPlayers: { id: string, name: string, total: number }[];
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
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
        <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${status === 'OPEN' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10'}`}>
            {status === 'OPEN' ? `Closes in: ${text}` : `Market: ${text}`}
        </div>
    );
};

const LedgerTable: React.FC<{ entries: LedgerEntry[] }> = ({ entries }) => (
    <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700 shadow-inner">
        <div className="overflow-y-auto max-h-[60vh] no-scrollbar">
            <table className="w-full text-left">
                <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-sm z-10">
                    <tr className="border-b border-slate-700">
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Debit</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Credit</th>
                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {(entries || []).slice().reverse().map(entry => (
                        <tr key={entry.id} className="hover:bg-cyan-500/5">
                            <td className="p-4 text-[10px] font-mono text-slate-400">{new Date(entry.timestamp).toLocaleString()}</td>
                            <td className="p-4 text-xs text-white">{entry.description}</td>
                            <td className="p-4 text-right text-rose-400 font-mono text-xs">{entry.debit > 0 ? `-${entry.debit.toFixed(2)}` : '-'}</td>
                            <td className="p-4 text-right text-emerald-400 font-mono text-xs">{entry.credit > 0 ? `+${entry.credit.toFixed(2)}` : '-'}</td>
                            <td className="p-4 text-right font-black text-white font-mono text-xs">Rs {entry.balance.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const LiveView: React.FC<{ fetchWithAuth: any }> = ({ fetchWithAuth }) => {
    const [stats, setStats] = useState<LiveStats | null>(null);
    const [loading, setLoading] = useState(true);

    const loadLiveStats = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth('/api/admin/live-stats');
            if (res.ok) setStats(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadLiveStats(); }, []);

    if (loading) return <div className="p-20 text-center animate-pulse text-slate-500 font-black uppercase text-xs">Capturing Live Stream...</div>;
    if (!stats) return null;

    return (
        <div className="space-y-8 animate-fade-in">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Live Operations Monitor</h3>
                <button onClick={loadLiveStats} className="px-4 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 text-sky-400 font-black text-[10px] uppercase transition-all border border-slate-700">Refresh Pulse</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Booking by Dealers */}
                <div className="bg-slate-800/40 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
                    <div className="p-6 bg-slate-800/60 border-b border-slate-700">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Bookings by Dealer</h4>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[400px] no-scrollbar">
                        <table className="w-full text-left">
                            <thead className="border-b border-slate-700">
                                <tr>
                                    <th className="p-3 text-[10px] text-slate-500 uppercase tracking-widest">Dealer Name</th>
                                    <th className="p-3 text-[10px] text-slate-500 uppercase tracking-widest text-right">Total Stake</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {stats.dealerBookings.map(d => (
                                    <tr key={d.id} className="hover:bg-sky-500/5">
                                        <td className="p-3">
                                            <div className="text-white font-bold text-sm uppercase">{d.name}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{d.id}</div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="text-sky-400 font-black font-mono">Rs {d.total.toLocaleString()}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Booking Type Breakdown */}
                <div className="bg-slate-800/40 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
                    <div className="p-6 bg-slate-800/60 border-b border-slate-700">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Booking Type Breakdown</h4>
                    </div>
                    <div className="p-4 space-y-4">
                        {stats.typeBookings.map(t => (
                            <div key={t.type} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-2xl border border-slate-700">
                                <div className="text-white font-black uppercase text-xs tracking-wider">{t.type}</div>
                                <div className="text-xl font-black text-emerald-400 font-mono">Rs {t.total.toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Players by Stake */}
                <div className="bg-slate-800/40 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl lg:col-span-2">
                    <div className="p-6 bg-slate-800/60 border-b border-slate-700 flex justify-between items-center">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Top Players (By Stake)</h4>
                        <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded border border-red-500/20 font-black">HIGH VOLUME PLAYERS</span>
                    </div>
                    <div className="p-4 overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                            <thead className="border-b border-slate-700">
                                <tr>
                                    <th className="p-4 text-[10px] text-slate-500 uppercase tracking-widest">User Name</th>
                                    <th className="p-4 text-[10px] text-slate-500 uppercase tracking-widest">Account ID</th>
                                    <th className="p-4 text-[10px] text-slate-500 uppercase tracking-widest text-right">Total Play (PKR)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {stats.topPlayers.map(p => (
                                    <tr key={p.id} className="hover:bg-red-500/5 group transition-colors">
                                        <td className="p-4 text-white font-black text-sm uppercase">{p.name}</td>
                                        <td className="p-4 text-slate-500 font-mono text-xs">{p.id}</td>
                                        <td className="p-4 text-right">
                                            <div className="text-emerald-400 font-black font-mono text-lg group-hover:scale-110 transition-transform origin-right">Rs {p.total.toLocaleString()}</div>
                                        </td>
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

    useEffect(() => { loadSummary(); }, []);

    if (loading) return <div className="p-20 text-center animate-pulse text-slate-500 font-black uppercase text-xs">Aggregating Global Stake Ledger...</div>;
    if (!summary) return null;

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Global Financial Audit</h3>
                <button onClick={loadSummary} className="px-4 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 text-emerald-400 font-black text-[10px] uppercase transition-all active:scale-90 border border-slate-700">Refresh Financials</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Volume</div>
                    <div className="text-2xl font-black text-white font-mono">Rs {summary.totals.totalStake.toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700">
                    <div className="text-[10px] text-sky-500 font-black uppercase tracking-widest mb-1">Comm. Burn (U+D)</div>
                    <div className="text-2xl font-black text-sky-400 font-mono">Rs {(summary.totals.totalUserCommission + summary.totals.totalDealerCommission).toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700">
                    <div className="text-[10px] text-rose-500 font-black uppercase tracking-widest mb-1">Payout Liability</div>
                    <div className="text-2xl font-black text-rose-400 font-mono">Rs {summary.totals.totalPayouts.toLocaleString()}</div>
                </div>
                <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/20">
                    <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">Net House Profit</div>
                    <div className={`text-2xl font-black font-mono ${summary.totals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Rs {summary.totals.netProfit.toLocaleString()}</div>
                </div>
            </div>

            <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                <div className="overflow-x-auto mobile-scroll-x no-scrollbar">
                    <table className="w-full text-left min-w-[900px]">
                        <thead className="bg-slate-800/80 border-b border-slate-700">
                            <tr>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Market</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Stake Volume</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">User Comm. (-)</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Dealer Comm. (-)</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Payouts (-)</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Net Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {summary.games.map(game => (
                                <tr key={game.gameId} className="hover:bg-cyan-500/5 transition-all">
                                    <td className="p-4 font-black text-white uppercase text-xs">{game.gameName}</td>
                                    <td className="p-4 text-right font-mono text-white text-xs">Rs {game.totalStake.toLocaleString()}</td>
                                    <td className="p-4 text-right font-mono text-sky-400 text-xs">{game.userCommission > 0 ? `Rs ${game.userCommission.toLocaleString()}` : '-'}</td>
                                    <td className="p-4 text-right font-mono text-emerald-400 text-xs">{game.dealerCommission > 0 ? `Rs ${game.dealerCommission.toLocaleString()}` : '-'}</td>
                                    <td className="p-4 text-right font-mono text-rose-400 text-xs">{game.totalPayouts > 0 ? `Rs ${game.totalPayouts.toLocaleString()}` : '-'}</td>
                                    <td className={`p-4 text-right font-black font-mono text-sm ${game.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Global Payout Audit</h3>
                <button onClick={loadWinners} className="px-4 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 text-cyan-400 font-black text-[10px] uppercase transition-all active:scale-90 border border-slate-700">Sync Hit List</button>
            </div>

            <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                <div className="overflow-x-auto mobile-scroll-x no-scrollbar">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-slate-800/80 border-b border-slate-700">
                            <tr>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Lucky Player</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Market Entity</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Hit Number</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Prize (PKR)</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Verification</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-500 font-black uppercase text-xs">Decrypting historical hits...</td></tr>
                            ) : winners.length === 0 ? (
                                <tr><td colSpan={5} className="p-20 text-center text-slate-600 font-black uppercase text-xs">Zero winning matches found</td></tr>
                            ) : winners.map(win => (
                                <tr key={win.id} className="hover:bg-cyan-500/5 transition-all group">
                                    <td className="p-4">
                                        <div className="text-white font-black text-sm uppercase">{win.userName}</div>
                                        <div className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">{win.userId}</div>
                                    </td>
                                    <td className="p-4 text-cyan-400 font-black uppercase text-[10px] tracking-widest">{win.gameName}</td>
                                    <td className="p-4 text-center">
                                        <span className="bg-emerald-500/10 text-emerald-400 px-4 py-1 rounded-lg border border-emerald-500/20 font-mono font-black text-lg shadow-[0_0_15px_rgba(52,211,153,0.1)]">{win.winningNumber}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="text-emerald-400 font-black font-mono text-lg group-hover:scale-110 transition-transform origin-right">Rs {win.payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter bg-slate-900 px-2 py-1 rounded border border-slate-800">SECURE-PAY</span>
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
  admin, dealers, onSaveDealer, users, games, bets, 
  declareWinner, updateWinner, approvePayouts, topUpDealerWallet, 
  withdrawFromDealerWallet, toggleAccountRestriction, updateGameDrawTime, onRefreshData 
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [winnerInputMap, setWinnerInputMap] = useState<Record<string, string>>({});
  const [editingWinnerMap, setEditingWinnerMap] = useState<Record<string, boolean>>({});
  const [pendingDeclareMap, setPendingDeclareMap] = useState<Record<string, boolean>>({});
  const [viewingUserLedgerFor, setViewingUserLedgerFor] = useState<User | null>(null);
  const { fetchWithAuth } = useAuth();

  const handleDeclareAction = async (gameId: string, isUpdate: boolean) => {
    const val = winnerInputMap[gameId];
    if (!val) return;
    setPendingDeclareMap(prev => ({ ...prev, [gameId]: true }));
    setEditingWinnerMap(prev => ({ ...prev, [gameId]: false }));
    try {
        if (isUpdate) await updateWinner?.(gameId, val);
        else await declareWinner?.(gameId, val);
        setWinnerInputMap(prev => { const next = { ...prev }; delete next[gameId]; return next; });
    } catch (error) {
        alert("Operation Failed.");
        setEditingWinnerMap(prev => ({ ...prev, [gameId]: true }));
    } finally {
        setPendingDeclareMap(prev => ({ ...prev, [gameId]: false }));
        onRefreshData?.();
    }
  };

  const adjustDrawTime = async (gameId: string, currentDrawTime: string, deltaMinutes: number) => {
      const [h, m] = currentDrawTime.split(':').map(Number);
      let totalMinutes = h * 60 + m + deltaMinutes;
      // Handle wrap around
      if (totalMinutes < 0) totalMinutes += 1440;
      if (totalMinutes >= 1440) totalMinutes -= 1440;
      
      const newH = Math.floor(totalMinutes / 60);
      const newM = totalMinutes % 60;
      const formattedTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
      
      try {
          await updateGameDrawTime?.(gameId, formattedTime);
          onRefreshData?.();
      } catch (e) {
          alert("Time adjustment failed.");
      }
  };

  const tabs = [
    { id: 'dashboard', label: 'Stats' },
    { id: 'live', label: 'Live' },
    { id: 'stakes', label: 'Stakes' },
    { id: 'games', label: 'Markets' },
    { id: 'winners', label: 'Hit List' },
    { id: 'dealers', label: 'Dealers' },
    { id: 'users', label: 'Users' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl sm:text-5xl font-black text-red-500 uppercase tracking-tighter text-shadow-glow">Command Console</h2>
        <div className="bg-slate-800/80 p-1 rounded-xl flex items-center space-x-1 border border-slate-700 w-full sm:w-auto overflow-x-auto no-scrollbar shadow-2xl">
            {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 py-2.5 px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 ${activeTab === tab.id ? 'bg-red-600 text-white shadow-xl shadow-red-900/20' : 'text-slate-500 hover:text-white'}`}>
                {tab.label}
            </button>
            ))}
        </div>
      </div>

      {activeTab === 'live' && <LiveView fetchWithAuth={fetchWithAuth} />}
      {activeTab === 'stakes' && <StakesView fetchWithAuth={fetchWithAuth} />}
      {activeTab === 'winners' && <WinnersView fetchWithAuth={fetchWithAuth} />}

      {activeTab === 'users' && (
          <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
              <div className="p-6 border-b border-slate-700 bg-slate-800/60">
                  <h3 className="text-white font-black uppercase tracking-widest">Global User Directory</h3>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-slate-900/50">
                          <tr>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User ID</th>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name</th>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Wallet Pool</th>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Management</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                          {users.map(u => (
                              <tr key={u.id} className="hover:bg-cyan-500/5">
                                  <td className="p-4 text-xs font-mono text-cyan-400 uppercase">{u.id}</td>
                                  <td className="p-4 text-xs font-black text-white uppercase">{u.name}</td>
                                  <td className="p-4 text-xs font-mono text-emerald-400">Rs {u.wallet.toLocaleString()}</td>
                                  <td className="p-4 text-right">
                                      <button onClick={() => setViewingUserLedgerFor(u)} className="text-[10px] font-black text-cyan-400 hover:text-white uppercase tracking-widest transition-colors mr-4">View Ledger</button>
                                      <button onClick={() => toggleAccountRestriction?.(u.id, 'user')} className={`text-[10px] font-black uppercase tracking-widest ${u.isRestricted ? 'text-red-400' : 'text-emerald-400'}`}>
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

      {activeTab === 'games' && (
        <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map(game => {
                const isEditing = editingWinnerMap[game.id];
                const isPending = pendingDeclareMap[game.id];
                const winningNumber = game.winningNumber && !game.winningNumber.endsWith('_') ? game.winningNumber : null;
                
                return (
                    <div key={game.id} className="bg-slate-800/60 p-6 rounded-3xl border border-slate-700 shadow-2xl space-y-6 backdrop-blur-md relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-white font-black uppercase text-xl tracking-tight">{game.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Draw Window: {game.drawTime}</p>
                                    <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                                        <button onClick={() => adjustDrawTime(game.id, game.drawTime, -5)} className="px-1 text-slate-400 hover:text-rose-400 transition-colors">{Icons.minus}</button>
                                        <button onClick={() => adjustDrawTime(game.id, game.drawTime, 5)} className="px-1 text-slate-400 hover:text-emerald-400 transition-colors">{Icons.plus}</button>
                                    </div>
                                </div>
                            </div>
                            <MarketCountdown drawTime={game.drawTime} />
                        </div>

                        <div className="bg-slate-900/80 p-8 rounded-2xl border border-slate-700 flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden">
                            <label className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mb-4">Official Winning Result</label>
                            
                            {isPending ? (
                                <div className="text-cyan-400 font-black uppercase animate-pulse text-sm tracking-widest">Validating Result...</div>
                            ) : winningNumber && !isEditing ? (
                                <div className="cursor-pointer text-center group" onClick={() => { setEditingWinnerMap({ ...editingWinnerMap, [game.id]: true }); setWinnerInputMap({ ...winnerInputMap, [game.id]: winningNumber }); }}>
                                    <div className="text-7xl font-black text-white font-mono drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{winningNumber}</div>
                                    <div className="text-[8px] text-cyan-500 uppercase mt-4 opacity-0 group-hover:opacity-100 transition-all font-black tracking-widest">Modify Record</div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 animate-fade-in">
                                    <input type="text" maxLength={2} autoFocus value={winnerInputMap[game.id] || ''} onChange={(e) => setWinnerInputMap({...winnerInputMap, [game.id]: e.target.value})} className="bg-slate-800 border border-slate-600 rounded-xl w-24 p-3 text-center text-4xl font-mono font-black text-white focus:ring-2 focus:ring-cyan-500 shadow-inner" placeholder="--" />
                                    <button onClick={() => handleDeclareAction(game.id, !!winningNumber)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-90 transition-all">SET</button>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {game.winningNumber && !game.payoutsApproved && (
                                <button onClick={() => approvePayouts?.(game.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-900/30 transition-all active:scale-95">Authorize Batch Payouts</button>
                            )}
                            {game.payoutsApproved && (
                                <div className="flex-1 bg-slate-900/50 text-slate-500 border border-slate-800 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-center italic">Verified & Paid</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      {viewingUserLedgerFor && (
          <Modal isOpen={!!viewingUserLedgerFor} onClose={() => setViewingUserLedgerFor(null)} title={`User Ledger: ${viewingUserLedgerFor.name}`} size="xl" themeColor="cyan">
              <LedgerTable entries={viewingUserLedgerFor.ledger} />
          </Modal>
      )}
    </div>
  );
};

export default AdminPanel;
