
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

interface NumberStake {
    number: string;
    stake: number;
}

interface NumberSummaryData {
    twoDigit: NumberStake[];
    oneDigitOpen: NumberStake[];
    oneDigitClose: NumberStake[];
    gameBreakdown: { gameId: string; stake: number }[];
}

// Added missing AdminPanelProps interface
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
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 active:scale-75 transition-transform">{Icons.close}</button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar">{children}</div>
            </div>
        </div>
    );
};

const LedgerTable: React.FC<{ entries: LedgerEntry[] }> = ({ entries }) => {
    const sortedEntries = useMemo(() => {
        if (!entries || !Array.isArray(entries)) return [];
        return [...entries].sort((a, b) => {
            const dateA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const dateB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return dateB - dateA;
        });
    }, [entries]);

    const formatTimestamp = (ts: any) => {
        const d = ts instanceof Date ? ts : new Date(ts);
        if (isNaN(d.getTime())) return { date: 'Invalid', time: 'Date' };
        return {
            date: d.toLocaleDateString(),
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    };

    return (
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
                        {sortedEntries.map(entry => {
                            const isCredit = entry.credit > 0;
                            const isDebit = entry.debit > 0;
                            const ts = formatTimestamp(entry.timestamp);
                            
                            return (
                                <tr key={entry.id} className="hover:bg-cyan-500/5 transition-all group">
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="text-[11px] font-bold text-slate-300">{ts.date}</div>
                                        <div className="text-[9px] font-mono text-slate-600 uppercase">{ts.time}</div>
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
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  admin, dealers, onSaveDealer, users, games, bets, 
  declareWinner, updateWinner, approvePayouts, topUpDealerWallet, 
  withdrawFromDealerWallet, toggleAccountRestriction, onRefreshData 
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [winnerInputMap, setWinnerInputMap] = useState<Record<string, string>>({});
  const [editingWinnerMap, setEditingWinnerMap] = useState<Record<string, boolean>>({});
  const [pendingDeclareMap, setPendingDeclareMap] = useState<Record<string, boolean>>({});

  const handleDeclareAction = async (gameId: string, isUpdate: boolean) => {
    const val = winnerInputMap[gameId];
    if (!val) return;

    // OPTIMISTIC UPDATE: Close input and show "publishing" instantly
    setPendingDeclareMap(prev => ({ ...prev, [gameId]: true }));
    setEditingWinnerMap(prev => ({ ...prev, [gameId]: false }));
    
    try {
        if (isUpdate) {
            await updateWinner?.(gameId, val);
        } else {
            await declareWinner?.(gameId, val);
        }
        setWinnerInputMap(prev => {
            const next = { ...prev };
            delete next[gameId];
            return next;
        });
    } catch (error) {
        alert("Server Error. Reverting result.");
        setEditingWinnerMap(prev => ({ ...prev, [gameId]: true }));
    } finally {
        setPendingDeclareMap(prev => ({ ...prev, [gameId]: false }));
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl sm:text-4xl font-black text-red-500 uppercase tracking-tighter">Command Center</h2>
        <div className="bg-slate-800/80 p-1 rounded-xl flex items-center space-x-1 border border-slate-700 w-full sm:w-auto overflow-x-auto no-scrollbar">
            {['dashboard', 'live', 'stakes', 'ledger', 'dealers', 'users', 'games'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 py-2 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-red-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                {tab}
            </button>
            ))}
        </div>
      </div>

      {activeTab === 'games' && (
        <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map(game => {
                const isEditing = editingWinnerMap[game.id];
                const isPending = pendingDeclareMap[game.id];
                const winningNumber = game.winningNumber && !game.winningNumber.endsWith('_') ? game.winningNumber : null;
                
                return (
                    <div key={game.id} className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700 shadow-xl space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-white font-black uppercase">{game.name}</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Draw: {game.drawTime}</p>
                            </div>
                            <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${game.isMarketOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {game.isMarketOpen ? 'Active' : 'Closed'}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center min-h-[140px]">
                            <label className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-3">Winning Result</label>
                            
                            {isPending ? (
                                <div className="text-cyan-400 font-black uppercase animate-pulse text-xs">PUBLISHING...</div>
                            ) : winningNumber && !isEditing ? (
                                <div className="cursor-pointer group" onClick={() => {
                                    setEditingWinnerMap({ ...editingWinnerMap, [game.id]: true });
                                    setWinnerInputMap({ ...winnerInputMap, [game.id]: winningNumber });
                                }}>
                                    <div className="text-5xl font-black text-white font-mono">{winningNumber}</div>
                                    <div className="text-[8px] text-cyan-500 uppercase mt-2 opacity-0 group-hover:opacity-100">Click to Edit</div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        maxLength={2}
                                        autoFocus
                                        value={winnerInputMap[game.id] || ''}
                                        onChange={(e) => setWinnerInputMap({...winnerInputMap, [game.id]: e.target.value})}
                                        className="bg-slate-800 border border-slate-600 rounded-lg w-16 p-2 text-center text-2xl font-mono text-white focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <button 
                                        onClick={() => handleDeclareAction(game.id, !!winningNumber)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all active:scale-90"
                                    >
                                        {winningNumber ? 'Fix' : 'SET'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {game.winningNumber && !game.payoutsApproved && (
                                <button onClick={() => approvePayouts?.(game.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-[10px] uppercase shadow-lg active:scale-95">Authorize Payouts</button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
