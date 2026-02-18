
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Dealer, User, PrizeRates, LedgerEntry, Bet, Game, SubGameType, BetLimits } from '../types';
import { Icons } from '../constants';
import { useCountdown } from '../hooks/useCountdown';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'md' | 'lg' | 'xl'; themeColor?: string }> = ({ isOpen, onClose, title, children, size = 'md', themeColor = 'emerald' }) => {
    if (!isOpen) return null;
    const sizeClasses: Record<string, string> = { md: 'max-w-md', lg: 'max-w-3xl', xl: 'max-w-5xl' };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50 p-4 overflow-y-auto">
            <div className={`bg-slate-900/95 rounded-xl shadow-2xl w-full border border-${themeColor}-500/30 ${sizeClasses[size]} flex flex-col my-auto max-h-[95vh]`}>
                <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-700 flex-shrink-0">
                    <h3 className={`text-base sm:text-lg font-bold text-${themeColor}-400 uppercase tracking-widest`}>{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 active:scale-75 transition-transform">{Icons.close}</button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar">{children}</div>
            </div>
        </div>
    );
};

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-2xl border flex items-center gap-3 animate-slide-in max-w-[90vw] sm:max-w-md ${
            type === 'success' ? 'bg-emerald-900 border-emerald-500 text-emerald-50' : 'bg-red-900 border-red-500 text-red-50'
        }`}>
            <span className="text-xl shrink-0">{type === 'success' ? '✅' : '⚠️'}</span>
            <span className="font-semibold text-sm">{message}</span>
            <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 p-1 active:scale-75 transition-transform">{Icons.close}</button>
        </div>
    );
};

const RevenueDashboard: React.FC<{ dealer: Dealer; bets: Bet[] }> = ({ dealer, bets }) => {
    const stats = useMemo(() => {
        const totalVolume = bets.reduce((sum, b) => sum + b.totalAmount, 0);
        const commissionEarned = totalVolume * (dealer.commissionRate / 100);
        return { totalVolume, commissionEarned, betCount: bets.length };
    }, [bets, dealer]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md">
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Commission Rate</div>
                <div className="text-3xl font-black text-white">{dealer.commissionRate}%</div>
                <div className="text-[9px] text-emerald-500 uppercase font-bold mt-1">Automatic Revenue Share</div>
            </div>
            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md">
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Network Volume</div>
                <div className="text-3xl font-black text-cyan-400 font-mono">Rs {stats.totalVolume.toLocaleString()}</div>
                <div className="text-[9px] text-slate-500 uppercase font-bold mt-1">From {stats.betCount} Active Tickets</div>
            </div>
            <div className="bg-slate-800/40 p-5 rounded-2xl border border-emerald-500/20 shadow-xl backdrop-blur-md bg-gradient-to-br from-emerald-500/5 to-transparent">
                <div className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em] mb-1">Total Comm. Profit</div>
                <div className="text-3xl font-black text-emerald-400 font-mono">Rs {stats.commissionEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <div className="text-[9px] text-emerald-500/60 uppercase font-bold mt-1">Ready for Withdrawal</div>
            </div>
        </div>
    );
};

const LedgerTable: React.FC<{ entries: LedgerEntry[] }> = ({ entries }) => {
    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }, [entries]);

    return (
        <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700 shadow-inner">
            <div className="overflow-y-auto max-h-[60vh] mobile-scroll-x no-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-sm z-10">
                        <tr className="border-b border-slate-700">
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Narrative</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Debit (-)</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Credit (+)</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Portfolio Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {sortedEntries.map(entry => (
                            <tr key={entry.id} className="hover:bg-emerald-500/5 transition-all group">
                                <td className="p-4 whitespace-nowrap text-[11px] font-mono text-slate-400">{new Date(entry.timestamp).toLocaleString()}</td>
                                <td className="p-4 text-xs text-white font-medium">{entry.description}</td>
                                <td className="p-4 text-right text-rose-400 font-mono text-xs">{entry.debit > 0 ? `-${entry.debit.toFixed(2)}` : '-'}</td>
                                <td className="p-4 text-right text-emerald-400 font-mono text-xs">{entry.credit > 0 ? `+${entry.credit.toFixed(2)}` : '-'}</td>
                                <td className="p-4 text-right font-black text-white font-mono text-xs">Rs {entry.balance.toFixed(2)}</td>
                            </tr>
                        ))}
                        {(!entries || entries.length === 0) && (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-black uppercase text-[10px] tracking-widest">No transaction logs available</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface DealerPanelProps {
  dealer: Dealer;
  users: User[];
  onSaveUser: (user: User, originalId?: string, initialDeposit?: number) => Promise<void>;
  onDeleteUser: (uId: string) => Promise<void>;
  topUpUserWallet: (userId: string, amount: number) => Promise<void>;
  withdrawFromUserWallet: (userId: string, amount: number) => Promise<void>;
  toggleAccountRestriction: (userId: string, userType: 'user') => void;
  bets: Bet[];
  games: Game[];
  placeBetAsDealer: (details: { userId: string; gameId: string; betGroups: any[] }) => Promise<void>;
  isLoaded?: boolean;
}

const DealerPanel: React.FC<DealerPanelProps> = ({ dealer, users, onSaveUser, onDeleteUser, topUpUserWallet, withdrawFromUserWallet, toggleAccountRestriction, bets, games, placeBetAsDealer, isLoaded = false }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [viewingUserLedgerFor, setViewingUserLedgerFor] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  const dealerUsers = useMemo(() => {
        return (users || [])
            .filter(user => {
                if (!user) return false;
                const query = searchQuery.toLowerCase();
                return (user.name || '').toLowerCase().includes(query) || (user.id || '').toLowerCase().includes(query) || (user.area || '').toLowerCase().includes(query);
            });
  }, [users, searchQuery]);

  const handleCopyBet = (bet: Bet) => {
    const formatted = bet.numbers.map(num => `${num} rs${bet.amountPerNumber}`).join('\n');
    navigator.clipboard.writeText(formatted);
    showToast("Ticket copied vertically!", "success");
  };

  const tabs = [
    { id: 'users', label: 'Network', icon: Icons.userGroup },
    { id: 'terminal', label: 'Terminal', icon: Icons.clipboardList },
    { id: 'tickets', label: 'Tickets', icon: Icons.bookOpen },
    { id: 'wallet', label: 'Vault', icon: Icons.wallet },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-2xl sm:text-4xl font-black text-emerald-500 uppercase tracking-tighter shadow-glow">Dealer Portal</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Authorized Agency ID: {dealer.id}</p>
          </div>
          <div className="bg-slate-800/80 p-1 rounded-xl flex items-center space-x-1 border border-slate-700 w-full md:w-auto overflow-x-auto no-scrollbar shadow-2xl">
            {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 flex items-center space-x-2 py-2 px-5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-500 hover:text-white'}`}>
                    {tab.icon} <span>{tab.label}</span>
                </button>
            ))}
          </div>
      </div>

      <RevenueDashboard dealer={dealer} bets={bets} />
      
      {activeTab === 'users' && (
        <div className="animate-fade-in space-y-4">
           <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Managed Accounts</h3>
            <div className="flex gap-2">
                <div className="relative flex-grow sm:w-64 bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex items-center">
                    <span className="pl-3 text-slate-500">{Icons.search}</span>
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none text-white w-full text-xs focus:ring-0 h-10" />
                </div>
                <button onClick={() => { setSelectedUser(undefined); setIsUserModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg font-black px-6 shadow-xl shadow-emerald-900/20 text-xs uppercase tracking-widest active:scale-95 transition-all">Add User</button>
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
            <div className="overflow-x-auto mobile-scroll-x no-scrollbar">
                <table className="w-full text-left min-w-[900px]">
                    <thead className="bg-slate-800/80 border-b border-slate-700">
                        <tr>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Identity</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Geography</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Liquidity Pool</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Comm. %</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Protocol</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Control</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {dealerUsers.length === 0 ? (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-600 font-black text-xs uppercase">No accounts found in network</td></tr>
                        ) : dealerUsers.map(user => (
                            <tr key={user.id} className="hover:bg-emerald-500/5 transition-all">
                                <td className="p-4">
                                    <div className="font-black text-white text-sm uppercase">{user.name}</div>
                                    <div className="text-[10px] text-slate-500 font-mono uppercase">{user.id}</div>
                                    {user.fixedStake > 0 && <div className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 inline-block mt-1">FIXED: Rs {user.fixedStake}</div>}
                                </td>
                                <td className="p-4">
                                    <div className="text-xs text-slate-300 font-bold uppercase">{user.area || 'UNSET'}</div>
                                    <div className="text-[10px] text-slate-500 font-mono">{user.contact || '-'}</div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="font-mono text-emerald-400 font-black text-sm">Rs {user.wallet.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-black inline-block">{user.commissionRate}%</div>
                                </td>
                                <td className="p-4 text-center">
                                    <button onClick={() => toggleAccountRestriction(user.id, 'user')} className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${user.isRestricted ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                        {user.isRestricted ? 'LOCKED' : 'ACTIVE'}
                                    </button>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => setViewingUserLedgerFor(user)} className="text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:underline active:opacity-50">Ledger</button>
                                        <button onClick={() => { setSelectedUser(user); setIsUserModalOpen(true); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white active:scale-90 transition-transform">Edit</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setIsWithdrawalModalOpen(true)} className="bg-slate-800 hover:bg-amber-900/30 text-amber-500 border border-amber-500/30 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95">Withdraw Funds</button>
                <button onClick={() => setIsTopUpModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all">Deposit Funds</button>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="animate-fade-in space-y-4">
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Network Live Tickets</h3>
            <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                <div className="overflow-x-auto mobile-scroll-x no-scrollbar">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-slate-800/80 border-b border-slate-700">
                            <tr>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500">Player</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500">Game</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500">Numbers</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 text-right">Total Stake</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {bets.slice().reverse().map(bet => {
                                const user = users.find(u => u.id === bet.userId);
                                const game = games.find(g => g.id === bet.gameId);
                                return (
                                    <tr key={bet.id} className="hover:bg-emerald-500/5 transition-all">
                                        <td className="p-4">
                                            <div className="text-white font-bold text-xs uppercase">{user?.name || 'Unknown'}</div>
                                            <div className="text-[9px] text-slate-500 font-mono">{bet.userId}</div>
                                        </td>
                                        <td className="p-4 text-emerald-400 font-black uppercase text-xs">{game?.name || '-'}</td>
                                        <td className="p-4">
                                            <div className="text-xs text-slate-300 font-mono flex flex-wrap gap-1">
                                                {bet.numbers.slice(0, 5).map((n, i) => <span key={i} className="bg-slate-900 px-1.5 rounded">{n}</span>)}
                                                {bet.numbers.length > 5 && <span>+{bet.numbers.length - 5} more</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right text-white font-mono font-bold text-xs">Rs {bet.totalAmount.toLocaleString()}</td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => handleCopyBet(bet)} className="text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1 ml-auto">
                                                {Icons.clipboardList} <span>Copy Stake</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'terminal' && <BettingTerminalView users={users} games={games} placeBetAsDealer={placeBetAsDealer} />}
      
      {activeTab === 'wallet' && (
        <div className="animate-fade-in space-y-6">
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Agency Financial Ledger</h3>
            <LedgerTable entries={dealer.ledger} />
        </div>
      )}

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={selectedUser ? "Modify Account" : "Register New Player"} themeColor="emerald">
          <UserForm user={selectedUser} onSave={async (u, o, i) => { await onSaveUser(u, o, i); setIsUserModalOpen(false); showToast(selectedUser ? "Account Updated" : "Account Created", "success"); }} onCancel={() => setIsUserModalOpen(false)} dealerPrizeRates={dealer.prizeRates} />
      </Modal>

      <Modal isOpen={isTopUpModalOpen} onClose={() => setIsTopUpModalOpen(false)} title="Internal Wallet Funding" themeColor="emerald">
          <UserTransactionForm type="Top-Up" users={dealerUsers} onTransaction={async (userId, amount) => { await topUpUserWallet(userId, amount); showToast("Deposit Successful", "success"); setIsTopUpModalOpen(false); }} onCancel={() => setIsTopUpModalOpen(false)} />
      </Modal>

      <Modal isOpen={isWithdrawalModalOpen} onClose={() => setIsWithdrawalModalOpen(false)} title="Internal Wallet Withdrawal" themeColor="amber">
          <UserTransactionForm type="Withdrawal" users={dealerUsers} onTransaction={async (userId, amount) => { await withdrawFromUserWallet(userId, amount); showToast("Withdrawal Successful", "success"); setIsWithdrawalModalOpen(false); }} onCancel={() => setIsWithdrawalModalOpen(false)} />
      </Modal>

      {viewingUserLedgerFor && (
        <Modal isOpen={!!viewingUserLedgerFor} onClose={() => setViewingUserLedgerFor(null)} title={`History: ${viewingUserLedgerFor.name}`} size="xl" themeColor="cyan">
            <LedgerTable entries={viewingUserLedgerFor.ledger} />
        </Modal>
      )}
    </div>
  );
};

const UserForm: React.FC<{ user?: User, onSave: (u: any, o?: string, i?: number) => Promise<void>, onCancel: () => void, dealerPrizeRates: PrizeRates }> = ({ user, onSave, onCancel, dealerPrizeRates }) => {
    const [name, setName] = useState(user?.name || '');
    const [id, setId] = useState(user?.id || '');
    const [password, setPassword] = useState(user?.password || '');
    const [area, setArea] = useState(user?.area || '');
    const [contact, setContact] = useState(user?.contact || '');
    const [commissionRate, setCommissionRate] = useState(user?.commissionRate || 5);
    const [initialDeposit, setInitialDeposit] = useState(0);
    const [prizeRates, setPrizeRates] = useState<PrizeRates>(user?.prizeRates || dealerPrizeRates);
    const [betLimits, setBetLimits] = useState<BetLimits>(user?.betLimits || { oneDigit: 5000, twoDigit: 5000, perDraw: 20000 });
    const [fixedStake, setFixedStake] = useState(user?.fixedStake || 0);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userData = { name, id, password, area, contact, commissionRate, prizeRates, betLimits, fixedStake };
            await onSave(userData, user?.id, initialDeposit);
        } catch (e: any) {
            alert(e.message || "Operation failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Account ID</label>
                    <input type="text" value={id} onChange={e => setId(e.target.value)} required disabled={!!user} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-1 focus:ring-emerald-500 disabled:opacity-50" />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Access Password</label>
                    <input type="text" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-1 focus:ring-emerald-500" />
                </div>
                {!user && (
                    <div>
                        <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Opening Deposit</label>
                        <input type="number" value={initialDeposit} onChange={e => setInitialDeposit(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-1 focus:ring-emerald-500" />
                    </div>
                )}
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Commission %</label>
                    <input type="number" value={commissionRate} onChange={e => setCommissionRate(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Fixed Stake Protocol (0 = Variable)</label>
                    <input type="number" value={fixedStake} onChange={e => setFixedStake(Number(e.target.value))} className="w-full bg-slate-800 border border-rose-500/30 rounded-lg p-2.5 text-rose-400 font-black text-sm focus:ring-1 focus:ring-rose-500" />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Area / Location</label>
                    <input type="text" value={area} onChange={e => setArea(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-1 focus:ring-emerald-500" />
                </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">Risk Management (Max Stakes)</h4>
                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <label className="block text-[9px] text-slate-600 font-bold uppercase mb-1">1-Digit Limit</label>
                        <input type="number" value={betLimits.oneDigit} onChange={e => setBetLimits({...betLimits, oneDigit: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs" />
                    </div>
                    <div>
                        <label className="block text-[9px] text-slate-600 font-bold uppercase mb-1">2-Digit Limit</label>
                        <input type="number" value={betLimits.twoDigit} onChange={e => setBetLimits({...betLimits, twoDigit: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs" />
                    </div>
                    <div>
                        <label className="block text-[9px] text-slate-600 font-bold uppercase mb-1">Total Draw Limit</label>
                        <input type="number" value={betLimits.perDraw} onChange={e => setBetLimits({...betLimits, perDraw: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs" />
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">Rate Protocols</h4>
                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <label className="block text-[9px] text-slate-600 font-bold uppercase mb-1">1-Digit Open</label>
                        <input type="number" value={prizeRates.oneDigitOpen} onChange={e => setPrizeRates({...prizeRates, oneDigitOpen: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs" />
                    </div>
                    <div>
                        <label className="block text-[9px] text-slate-600 font-bold uppercase mb-1">1-Digit Close</label>
                        <input type="number" value={prizeRates.oneDigitClose} onChange={e => setPrizeRates({...prizeRates, oneDigitClose: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs" />
                    </div>
                    <div>
                        <label className="block text-[9px] text-slate-600 font-bold uppercase mb-1">2-Digit</label>
                        <input type="number" value={prizeRates.twoDigit} onChange={e => setPrizeRates({...prizeRates, twoDigit: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs" />
                    </div>
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button type="button" onClick={onCancel} className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest">Cancel</button>
                <button type="submit" disabled={loading} className="flex-2 px-12 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">
                    {loading ? 'Saving...' : user ? 'Apply Changes' : 'Confirm Registration'}
                </button>
            </div>
        </form>
    );
};

const UserTransactionForm: React.FC<{ type: string, users: User[], onTransaction: (u: string, a: number) => Promise<void>, onCancel: () => void }> = ({ type, users, onTransaction, onCancel }) => {
    const [userId, setUserId] = useState('');
    const [amount, setAmount] = useState(0);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || amount <= 0) return;
        setLoading(true);
        try {
            await onTransaction(userId, amount);
        } catch (e: any) {
            alert(e.message || "Transaction failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Target Account</label>
                    <select value={userId} onChange={e => setUserId(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm font-black uppercase focus:ring-1 focus:ring-emerald-500">
                        <option value="">Select User Profile...</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.id}) - Rs {u.wallet.toLocaleString()}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Amount (PKR)</label>
                    <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} required min="1" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-lg font-mono font-black focus:ring-1 focus:ring-emerald-500" placeholder="0.00" />
                </div>
            </div>
            <div className="flex gap-3">
                <button type="button" onClick={onCancel} className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest">Abort</button>
                <button type="submit" disabled={loading || !userId || amount <= 0} className={`flex-2 px-12 py-3 ${type === 'Withdrawal' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50`}>
                    {loading ? 'Processing...' : `Execute ${type}`}
                </button>
            </div>
        </form>
    );
};

const BettingTerminalView: React.FC<{ users: User[]; games: Game[]; placeBetAsDealer: (details: any) => Promise<void> }> = ({ users, games, placeBetAsDealer }) => {
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedGameId, setSelectedGameId] = useState('');
    const [bulkInput, setBulkInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleProcessBets = async () => {
        if (!selectedUserId || !selectedGameId || !bulkInput.trim()) return;
        setIsLoading(true);
        try {
            const lines = bulkInput.split('\n').filter(l => l.trim());
            const betGroupsMap = new Map();

            const currentUser = users.find(u => u.id === selectedUserId);
            const currentGame = games.find(g => g.id === selectedGameId);
            const isAkcGame = currentGame?.name === 'AKC';
            const delimiterRegex = /[-.,_*\/+<>=%;'\s]+/;

            lines.forEach(line => {
                let currentLine = line.trim();
                const stakeMatch = currentLine.match(/(?:rs|r)?\s*(\d+\.?\d*)$/i);
                let stake = stakeMatch ? parseFloat(stakeMatch[1]) : 0;
                
                // Override with user's Fixed Stake if active
                if (currentUser && currentUser.fixedStake > 0) {
                    stake = currentUser.fixedStake;
                }

                if (stake <= 0) return;

                let betPart = currentLine.substring(0, stakeMatch ? stakeMatch.index : currentLine.length).trim();
                const isCombo = /\b(k|combo)\b/i.test(betPart);
                betPart = betPart.replace(/\b(k|combo)\b/i, '').trim();
                const tokens = betPart.split(delimiterRegex).filter(Boolean);

                const determineType = (token: string): SubGameType | null => {
                    if (isAkcGame) return /^[xX]?\d$/.test(token) ? SubGameType.OneDigitClose : null;
                    if (/^\d{1,2}$/.test(token)) return SubGameType.TwoDigit;
                    if (/^\d[xX]$/i.test(token)) return SubGameType.OneDigitOpen;
                    if (/^[xX]\d$/i.test(token)) return SubGameType.OneDigitClose;
                    return null;
                };

                tokens.forEach(token => {
                    if (isCombo) {
                        const digits = token.replace(/\D/g, '');
                        const uniqueDigits = [...new Set(digits.split(''))];
                        if (uniqueDigits.length >= 3 && uniqueDigits.length <= 6) {
                            for (let i = 0; i < uniqueDigits.length; i++) {
                                for (let j = 0; j < uniqueDigits.length; j++) {
                                    if (i !== j) {
                                        const num = uniqueDigits[i] + uniqueDigits[j];
                                        const key = `Combo__${stake}`;
                                        if (!betGroupsMap.has(key)) betGroupsMap.set(key, { subGameType: SubGameType.Combo, numbers: [], amountPerNumber: stake });
                                        betGroupsMap.get(key).numbers.push(num);
                                    }
                                }
                            }
                        }
                    } else {
                        const type = determineType(token);
                        if (type) {
                            let val = token;
                            if (type === SubGameType.TwoDigit) val = token.padStart(2, '0');
                            else if (type === SubGameType.OneDigitOpen) val = token[0];
                            else val = token.length === 2 ? token[1] : token[0];

                            const key = `${type}__${stake}`;
                            if (!betGroupsMap.has(key)) betGroupsMap.set(key, { subGameType: type, numbers: [], amountPerNumber: stake });
                            betGroupsMap.get(key).numbers.push(val);
                        }
                    }
                });
            });

            const betGroups = Array.from(betGroupsMap.values());
            if (betGroups.length === 0) throw new Error("No valid tokens found in terminal input");

            await placeBetAsDealer({ userId: selectedUserId, gameId: selectedGameId, betGroups });
            setBulkInput('');
            alert("Terminal batch processed successfully");
        } catch (error: any) {
            alert(error.message || "Processing failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">Batch Entry Console</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-xs font-black uppercase focus:ring-1 focus:ring-emerald-500">
                    <option value="">-- Choose User Profile --</option>
                    {(users || []).filter(u => !u.isRestricted).map(u => <option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
                </select>
                <select value={selectedGameId} onChange={e => setSelectedGameId(e.target.value)} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-xs font-black uppercase focus:ring-1 focus:ring-emerald-500">
                    <option value="">-- Choose Active Market --</option>
                    {(games || []).filter(g => g.isMarketOpen).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
            </div>
            <textarea rows={8} value={bulkInput} onChange={e => setBulkInput(e.target.value)} placeholder="Entry Format Example:&#10;14, 25 50&#10;x4, 9x 100&#10;k123 20" className="w-full bg-slate-900 text-white p-4 rounded-xl border border-slate-700 font-mono text-sm focus:ring-1 focus:ring-emerald-500 no-scrollbar" />
            <div className="flex justify-end pt-2">
                <button onClick={handleProcessBets} disabled={!selectedUserId || !selectedGameId || !bulkInput || isLoading} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-12 rounded-xl text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/30 active:scale-95 disabled:opacity-50">
                    {isLoading ? 'Processing Batch...' : 'Confirm System Entries'}
                </button>
            </div>
        </div>
    );
};

export default DealerPanel;
