
import React, { useState, useMemo, useEffect } from 'react';
import { Dealer, User, Game, PrizeRates, LedgerEntry, Bet, NumberLimit, SubGameType, Admin } from '../types';
import { Icons } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { useCountdown } from '../hooks/useCountdown';

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

    if (loading) return <div className="p-20 text-center animate-pulse text-slate-500 font-black uppercase text-xs tracking-widest">Aggregating Global Ledger...</div>;
    if (!summary) return null;

    const totalComms = summary.totals.totalDealerCommission + summary.totals.totalUserCommission;

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">System Revenue Overview</h3>
                <button onClick={loadSummary} className="px-4 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 text-emerald-400 font-black text-[10px] uppercase transition-all active:scale-90 border border-slate-700">Refresh Data</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700 shadow-xl">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Gross Sales</div>
                    <div className="text-3xl font-black text-white font-mono">Rs {summary.totals.totalStake.toLocaleString()}</div>
                    <div className="text-[8px] text-slate-600 font-bold uppercase mt-1">Total combined network volume</div>
                </div>
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-sky-500/20 shadow-xl">
                    <div className="text-[10px] text-sky-500 font-black uppercase tracking-widest mb-1">Network Payouts</div>
                    <div className="text-3xl font-black text-sky-400 font-mono">Rs {totalComms.toLocaleString()}</div>
                    <div className="text-[8px] text-sky-600 font-bold uppercase mt-1">Combined User & Dealer Commission</div>
                </div>
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-rose-500/20 shadow-xl">
                    <div className="text-[10px] text-rose-500 font-black uppercase tracking-widest mb-1">Prize Liabilities</div>
                    <div className="text-3xl font-black text-rose-400 font-mono">Rs {summary.totals.totalPayouts.toLocaleString()}</div>
                    <div className="text-[8px] text-rose-600 font-bold uppercase mt-1">Winning number payouts distributed</div>
                </div>
                <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/30 shadow-2xl">
                    <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">System Net Revenue</div>
                    <div className={`text-3xl font-black font-mono ${summary.totals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Rs {summary.totals.netProfit.toLocaleString()}</div>
                    <div className="text-[8px] text-emerald-700 font-bold uppercase mt-1">True Admin Profit (Sales - Comm - Prizes)</div>
                </div>
            </div>

            <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-slate-900/80 border-b border-slate-700">
                            <tr>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Market Name</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Stake Vol.</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">User Comm.</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Dealer Comm.</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Prize Paid</th>
                                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Net System Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {summary.games.map(game => (
                                <tr key={game.gameId} className="hover:bg-cyan-500/5 transition-all">
                                    <td className="p-4 font-black text-white uppercase text-xs">{game.gameName}</td>
                                    <td className="p-4 text-right font-mono text-white text-xs">Rs {game.totalStake.toLocaleString()}</td>
                                    <td className="p-4 text-right font-mono text-sky-400 text-xs">Rs {game.userCommission.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                                    <td className="p-4 text-right font-mono text-emerald-400 text-xs">Rs {game.dealerCommission.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                                    <td className="p-4 text-right font-mono text-rose-400 text-xs">Rs {game.totalPayouts.toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                                    <td className={`p-4 text-right font-black font-mono text-sm ${game.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        Rs {game.netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}
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

const AdminPanel: React.FC<any> = ({ 
  admin, dealers, users, games, declareWinner, approvePayouts, topUpDealerWallet, withdrawFromDealerWallet, toggleAccountRestriction, updateGameDrawTime, onRefreshData, onSaveDealer 
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [winnerInputMap, setWinnerInputMap] = useState<Record<string, string>>({});
  const [isLoadingAction, setIsLoadingAction] = useState<Record<string, boolean>>({});
  const { fetchWithAuth } = useAuth();

  const handleSetWinner = async (gameId: string) => {
    const val = winnerInputMap[gameId];
    if (!val) return;
    setIsLoadingAction(prev => ({ ...prev, [gameId]: true }));
    try {
        await declareWinner?.(gameId, val);
        setWinnerInputMap(prev => { const next = { ...prev }; delete next[gameId]; return next; });
        if (onRefreshData) await onRefreshData();
    } finally { setIsLoadingAction(prev => ({ ...prev, [gameId]: false })); }
  };

  const tabs = [
    { id: 'dashboard', label: 'Stats' },
    { id: 'games', label: 'Markets' },
    { id: 'dealers', label: 'Dealers' },
    { id: 'users', label: 'Users' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl sm:text-5xl font-black text-red-500 uppercase tracking-tighter shadow-glow">System Core</h2>
        <div className="bg-slate-800/80 p-1 rounded-xl flex items-center space-x-1 border border-slate-700 w-full sm:w-auto overflow-x-auto no-scrollbar shadow-2xl">
            {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 py-2.5 px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 ${activeTab === tab.id ? 'bg-red-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>{tab.label}</button>
            ))}
        </div>
      </div>
      {activeTab === 'dashboard' && <StakesView fetchWithAuth={fetchWithAuth} />}
      {activeTab === 'games' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((g: any) => (
                  <div key={g.id} className="bg-slate-800/60 rounded-3xl border border-slate-700 shadow-2xl p-6 space-y-6">
                      <div className="flex justify-between items-center"><h4 className="text-white font-black uppercase text-xl">{g.name}</h4><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Draw: {g.drawTime}</div></div>
                      <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 flex flex-col items-center">
                          <label className="text-[9px] text-slate-500 font-black uppercase mb-3">Official Result</label>
                          {g.winningNumber && !g.winningNumber.includes('_') ? <div className="text-6xl font-black text-white font-mono">{g.winningNumber}</div> : (
                              <div className="flex gap-2"><input type="text" maxLength={2} value={winnerInputMap[g.id] || ''} onChange={e => setWinnerInputMap({...winnerInputMap, [g.id]: e.target.value})} className="bg-slate-800 border border-slate-600 rounded-xl w-16 p-2 text-center text-2xl font-mono text-white focus:ring-2 focus:ring-cyan-500" placeholder="--" /><button onClick={() => handleSetWinner(g.id)} disabled={isLoadingAction[g.id]} className="bg-emerald-600 px-4 rounded-xl text-[10px] font-black uppercase transition-all active:scale-90 disabled:opacity-50">{isLoadingAction[g.id] ? '...' : 'SET'}</button></div>
                          )}
                      </div>
                      {!g.payoutsApproved && g.winningNumber && !g.winningNumber.includes('_') && <button onClick={async () => { if(window.confirm('Distribute Prizes?')){ await approvePayouts?.(g.id); onRefreshData?.(); } }} className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-xl shadow-amber-900/20">Release Prize Payouts</button>}
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};
export default AdminPanel;
