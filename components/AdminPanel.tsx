
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
                <button type="button" onClick={onCancel} className="flex-1 py-3 text-xs font-black uppercase text-slate-400 hover:text-white transition-all active:scale-95">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase shadow-lg transition-all active:scale-95 active:bg-red-700">
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
            className={`bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-700 shadow-lg ${onClick ? 'cursor-pointer hover:border-cyan-500/50 transition-all active:scale-95 active:bg-slate-800/60' : ''}`}
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
                <SummaryCard title="Vault Balance (Guru)" value={admin.wallet} color="text-white" onClick={onOpenAdminLedger} />
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

// --- MAIN PANEL ---

interface AdminPanelProps {
  admin: Admin;
  dealers: Dealer[];
  onSaveDealer: (dealer: any, originalId?: string) => Promise<void>;
  onUpdateAdmin: (admin: Admin) => Promise<void>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  games: Game[];
  bets: Bet[];
  declareWinner: (gameId: string, winningNumber: string) => Promise<void>;
  updateWinner: (gameId: string, winningNumber: string) => Promise<void>;
  approvePayouts: (gameId: string) => Promise<void>;
  topUpDealerWallet: (dealerId: string, amount: number) => Promise<void>;
  withdrawFromDealerWallet: (dealerId: string, amount: number) => Promise<void>;
  toggleAccountRestriction: (id: string, type: 'user' | 'dealer') => Promise<void>;
  onPlaceAdminBets: (details: any) => Promise<void>;
  updateGameDrawTime: (gameId: string, drawTime: string) => Promise<void>;
  onRefreshData: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
    admin, dealers, onSaveDealer, 
}) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);
    const [isDealerModalOpen, setIsDealerModalOpen] = useState(false);
    const [selectedDealer, setSelectedDealer] = useState<Dealer | undefined>(undefined);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await fetch('/api/admin/summary', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                });
                if (res.ok) setSummary(await res.json());
            } catch (e) {}
        };
        fetchSummary();
        const interval = setInterval(fetchSummary, 30000);
        return () => clearInterval(interval);
    }, []);

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: Icons.chartBar },
        { id: 'dealers', label: 'Dealers', icon: Icons.userGroup },
        { id: 'users', label: 'Users', icon: Icons.user },
        { id: 'games', label: 'Markets', icon: Icons.gamepad },
    ];

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto min-h-[85vh]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h2 className="text-2xl sm:text-3xl font-black text-red-500 uppercase tracking-tighter">Admin Control Vault</h2>
                <div className="bg-slate-800/50 p-1 rounded-lg flex items-center space-x-1 border border-slate-700 w-full md:w-auto overflow-x-auto no-scrollbar">
                    {tabs.map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id)} 
                            className={`shrink-0 flex items-center space-x-2 py-2 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-md transition-all active:scale-95 ${activeTab === tab.id ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                        >
                            {tab.icon} <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="animate-fade-in">
                {activeTab === 'dashboard' && <DashboardView summary={summary} admin={admin} onOpenAdminLedger={() => setIsLedgerOpen(true)} />}
                
                {activeTab === 'dealers' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Dealer Network</h3>
                            <button 
                                onClick={() => { setSelectedDealer(undefined); setIsDealerModalOpen(true); }}
                                className="bg-red-600 hover:bg-red-500 text-white py-2 px-6 rounded-xl text-xs font-black uppercase shadow-lg active:scale-95"
                            >
                                Onboard Dealer
                            </button>
                        </div>
                        <div className="bg-slate-800/40 rounded-2xl border border-slate-700 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/80 border-b border-slate-700">
                                    <tr>
                                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase">Dealer</th>
                                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase text-right">Wallet</th>
                                        <th className="p-4 text-[10px] font-black text-slate-500 uppercase text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {dealers.map(d => (
                                        <tr key={d.id} className="hover:bg-slate-700/20">
                                            <td className="p-4">
                                                <div className="font-bold text-white">{d.name}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">{d.id}</div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-emerald-400 font-bold">Rs {d.wallet.toLocaleString()}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => { setSelectedDealer(d); setIsDealerModalOpen(true); }} className="text-cyan-400 hover:text-cyan-300 text-[10px] font-black uppercase mr-3">Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {(activeTab === 'users' || activeTab === 'games') && (
                    <div className="p-12 text-center text-slate-500 uppercase font-black tracking-widest border border-dashed border-slate-700 rounded-2xl">
                        Module Loading... (Management Interface In development)
                    </div>
                )}
            </div>

            <Modal isOpen={isLedgerOpen} onClose={() => setIsLedgerOpen(false)} title="Master Ledger (Guru)" size="xl" themeColor="red">
                <LedgerTable entries={admin.ledger} />
            </Modal>

            <Modal isOpen={isDealerModalOpen} onClose={() => setIsDealerModalOpen(false)} title={selectedDealer ? "Update Dealer" : "Onboard Dealer"} themeColor="red">
                <DealerForm dealer={selectedDealer} onSave={onSaveDealer} onCancel={() => setIsDealerModalOpen(false)} />
            </Modal>
        </div>
    );
};

// Fix for: Error in file App.tsx on line 6: Module '"file:///components/AdminPanel"' has no default export.
export default AdminPanel;
