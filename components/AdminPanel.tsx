
import React, { useState, useMemo, useEffect } from 'react';
import { Dealer, User, Game, PrizeRates, LedgerEntry, Bet, NumberLimit, SubGameType, Admin } from '../types';
import { Icons } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { UserForm } from './DealerPanel'; // Import UserForm to reuse it

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

type SortKey = 'name' | 'wallet' | 'status';
type SortDirection = 'asc' | 'desc';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

// --- HELPER COMPONENTS (DEFINED OUTSIDE TO PREVENT REMOUNTING) ---

const StatefulLedgerTableWrapper: React.FC<{ entries: LedgerEntry[] }> = ({ entries }) => {
    const [startDate, setStartDate] = useState(getTodayDateString());
    const [endDate, setEndDate] = useState(getTodayDateString());

    const filteredEntries = useMemo(() => {
        if (!entries || !Array.isArray(entries)) return [];
        if (!startDate && !endDate) return entries;
        return entries.filter(entry => {
            const entryDateStr = entry.timestamp.toISOString().split('T')[0];
            if (startDate && entryDateStr < startDate) return false;
            if (endDate && entryDateStr > endDate) return false;
            return true;
        });
    }, [entries, startDate, endDate]);

    const inputClass = "w-full bg-slate-800 p-2 rounded-md border border-slate-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none text-white font-sans";

    return (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end mb-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">From Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">To Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
                </div>
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors h-fit">Show All History</button>
            </div>
            <LedgerTable entries={filteredEntries} />
        </div>
    );
};

const SortableHeader: React.FC<{
    label: string;
    sortKey: SortKey;
    currentSortKey: SortKey;
    sortDirection: SortDirection;
    onSort: (key: SortKey) => void;
    className?: string;
}> = ({ label, sortKey, currentSortKey, sortDirection, onSort, className }) => {
    const isActive = sortKey === currentSortKey;
    const icon = isActive ? (sortDirection === 'asc' ? '▲' : '▼') : '';
    return (
        <th className={`p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${className}`} onClick={() => onSort(sortKey)}>
            <div className="flex items-center gap-2">
                <span>{label}</span>
                <span className="text-cyan-400">{icon}</span>
            </div>
        </th>
    );
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'md' | 'lg' | 'xl'; themeColor?: string }> = ({ isOpen, onClose, title, children, size = 'md', themeColor = 'cyan' }) => {
    if (!isOpen) return null;
    const sizeClasses: Record<string, string> = { md: 'max-w-md', lg: 'max-w-3xl', xl: 'max-w-5xl' };
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className={`bg-slate-900/80 rounded-lg shadow-2xl w-full border border-${themeColor}-500/30 ${sizeClasses[size]} flex flex-col max-h-[90vh]`}>
                <div className="flex justify-between items-center p-5 border-b border-slate-700 flex-shrink-0">
                    <h3 className={`text-lg font-bold text-${themeColor}-400 uppercase tracking-widest`}>{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">{Icons.close}</button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
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
                    {Array.isArray(entries) && [...entries].reverse().map(entry => (
                        <tr key={entry.id} className="hover:bg-cyan-500/10 text-sm transition-colors">
                            <td className="p-3 text-slate-400 whitespace-nowrap">{entry.timestamp?.toLocaleString() || 'N/A'}</td>
                            <td className="p-3 text-white">{entry.description}</td>
                            <td className="p-3 text-right text-red-400 font-mono">{(entry.debit || 0) > 0 ? entry.debit.toFixed(2) : '-'}</td>
                            <td className="p-3 text-right text-green-400 font-mono">{(entry.credit || 0) > 0 ? entry.credit.toFixed(2) : '-'}</td>
                            <td className="p-3 text-right font-semibold text-white font-mono">{(entry.balance || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                     {(!Array.isArray(entries) || entries.length === 0) && (
                        <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500">
                                No ledger entries found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

// --- WINNERS VIEW COMPONENT ---
interface WinnerRecord {
    betId: string;
    timestamp: Date;
    userName: string;
    dealerName: string;
    gameName: string;
    winningNumber: string;
    subGameType: string;
    selectedNumbers: string[];
    winningNumbersInBet: string[];
    stake: number;
    payout: number;
    payoutApproved: boolean;
}

const WinnersView: React.FC<{ bets: Bet[], games: Game[], users: User[], dealers: Dealer[] }> = ({ bets, games, users, dealers }) => {
    const [startDate, setStartDate] = useState(getTodayDateString());
    const [endDate, setEndDate] = useState(getTodayDateString());
    const [searchTerm, setSearchTerm] = useState('');

    const winnerData = useMemo(() => {
        const records: WinnerRecord[] = [];
        const finalizedGames = games.filter(g => g.winningNumber && !g.winningNumber.includes('_'));

        finalizedGames.forEach(game => {
            const gameBets = bets.filter(b => b.gameId === game.id);
            const winningNumber = game.winningNumber!;

            gameBets.forEach(bet => {
                const user = users.find(u => u.id === bet.userId);
                const dealer = dealers.find(d => d.id === bet.dealerId);
                if (!user) return;

                const winningNumbersInBet = bet.numbers.filter(num => {
                    switch (bet.subGameType) {
                        case SubGameType.OneDigitOpen:
                            return winningNumber.length === 2 && num === winningNumber[0];
                        case SubGameType.OneDigitClose:
                            if (game.name === 'AKC') return num === winningNumber;
                            return winningNumber.length === 2 && num === winningNumber[1];
                        default: // 2 Digit, Bulk, Combo
                            return num === winningNumber;
                    }
                });

                if (winningNumbersInBet.length > 0) {
                    const getPrizeMultiplier = (rates: PrizeRates, type: SubGameType) => {
                        if (!rates) return 0;
                        if (type === SubGameType.OneDigitOpen) return rates.oneDigitOpen || 0;
                        if (type === SubGameType.OneDigitClose) return rates.oneDigitClose || 0;
                        return rates.twoDigit || 0;
                    };

                    const multiplier = getPrizeMultiplier(user.prizeRates, bet.subGameType);
                    const payout = winningNumbersInBet.length * (bet.amountPerNumber || 0) * multiplier;

                    records.push({
                        betId: bet.id,
                        timestamp: bet.timestamp,
                        userName: user.name,
                        dealerName: dealer?.name || 'Unknown',
                        gameName: game.name,
                        winningNumber: winningNumber,
                        subGameType: bet.subGameType,
                        selectedNumbers: bet.numbers,
                        winningNumbersInBet,
                        stake: bet.totalAmount || 0,
                        payout,
                        payoutApproved: !!game.payoutsApproved
                    });
                }
            });
        });

        return records.filter(r => {
            const dateStr = r.timestamp?.toISOString().split('T')[0];
            const matchesDate = (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);
            const matchesSearch = !searchTerm.trim() || 
                r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.gameName.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesDate && matchesSearch;
        }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [bets, games, users, dealers, startDate, endDate, searchTerm]);

    const inputClass = "bg-slate-800 p-2 rounded-md border border-slate-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none text-white w-full";

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h3 className="text-xl font-semibold text-white">Winner Detail Sheet</h3>
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded text-xs text-emerald-400 font-bold uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Real-time Winner Tracking
                </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">From Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">To Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Search User/Game</label>
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClass} />
                </div>
                <button onClick={() => { setStartDate(getTodayDateString()); setEndDate(getTodayDateString()); setSearchTerm(''); }} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-md transition-colors">Clear</button>
            </div>

            <div className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700">
                <div className="overflow-x-auto mobile-scroll-x">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Time</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Dealer</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Game</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Result</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Winner Pick</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Stake</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Prize</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {winnerData.length === 0 ? (
                                <tr><td colSpan={9} className="p-10 text-center text-slate-500">No winners found for this selection.</td></tr>
                            ) : winnerData.map((record, i) => (
                                <tr key={i} className="hover:bg-emerald-500/5 transition-colors">
                                    <td className="p-4 text-xs text-slate-400 whitespace-nowrap">{record.timestamp?.toLocaleString() || 'N/A'}</td>
                                    <td className="p-4 font-bold text-white">{record.userName}</td>
                                    <td className="p-4 text-slate-400">{record.dealerName}</td>
                                    <td className="p-4 text-cyan-400 font-semibold">{record.gameName}</td>
                                    <td className="p-4 font-mono text-emerald-400 text-lg">{record.winningNumber}</td>
                                    <td className="p-4">
                                        <div className="text-xs text-slate-500">{record.subGameType}</div>
                                        <div className="text-white font-mono">{record.winningNumbersInBet.join(', ')}</div>
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-300">{(record.stake || 0).toFixed(0)}</td>
                                    <td className="p-4 text-right font-mono text-emerald-400 font-bold">{(record.payout || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${record.payoutApproved ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {record.payoutApproved ? 'Paid' : 'Pending'}
                                        </span>
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

const DealerForm: React.FC<{ dealer?: Dealer; dealers: Dealer[]; onSave: (dealer: Dealer, originalId?: string) => Promise<void>; onCancel: () => void; adminPrizeRates: PrizeRates }> = ({ dealer, dealers, onSave, onCancel, adminPrizeRates }) => {
    const [formData, setFormData] = useState(() => {
        if (dealer) {
            return {
                id: dealer.id,
                name: dealer.name,
                password: '',
                area: dealer.area || '',
                contact: dealer.contact || '',
                commissionRate: (dealer.commissionRate ?? 0).toString(),
                prizeRates: {
                    oneDigitOpen: (dealer.prizeRates?.oneDigitOpen ?? 0).toString(),
                    oneDigitClose: (dealer.prizeRates?.oneDigitClose ?? 0).toString(),
                    twoDigit: (dealer.prizeRates?.twoDigit ?? 0).toString(),
                },
                avatarUrl: dealer.avatarUrl || '',
                wallet: dealer.wallet.toString()
            };
        }
        return {
            id: '',
            name: '',
            password: '',
            area: '',
            contact: '',
            commissionRate: '0',
            prizeRates: {
                oneDigitOpen: adminPrizeRates?.oneDigitOpen?.toString() || '0',
                oneDigitClose: adminPrizeRates?.oneDigitClose?.toString() || '0',
                twoDigit: adminPrizeRates?.twoDigit?.toString() || '0',
            },
            avatarUrl: '',
            wallet: '0'
        };
    });
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({ 
                ...prev, 
                [parent]: { 
                    ...(prev[parent as keyof typeof prev] as object), 
                    [child]: value 
                } 
            }));
        } else {
            setFormData(prev => ({ 
                ...prev, 
                [name]: type === 'checkbox' ? (checked as any) : value 
            }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newPassword = dealer ? password : formData.password;
        if (newPassword && newPassword !== confirmPassword) { alert("New passwords do not match."); return; }
        if (!dealer && !newPassword) { alert("Password is required for new dealers."); return; }
        
        const formId = (formData.id as string).toLowerCase();
        if (!dealer && dealers.some(d => d.id.toLowerCase() === formId)) {
            alert("This Dealer Login ID is already taken. Please choose another one.");
            return;
        }

        const finalData: Dealer = {
            id: formData.id,
            name: formData.name,
            password: newPassword ? newPassword : (dealer?.password || ''),
            area: formData.area,
            contact: formData.contact,
            wallet: Number(formData.wallet) || 0,
            commissionRate: Number(formData.commissionRate) || 0,
            isRestricted: dealer?.isRestricted ?? false,
            prizeRates: {
                oneDigitOpen: Number(formData.prizeRates.oneDigitOpen) || 0,
                oneDigitClose: Number(formData.prizeRates.oneDigitClose) || 0,
                twoDigit: Number(formData.prizeRates.twoDigit) || 0,
            },
            ledger: [],
            avatarUrl: formData.avatarUrl,
        };

        onSave(finalData, dealer?.id);
    };

    const displayPassword = dealer ? password : formData.password;
    const inputClass = "w-full bg-slate-800 p-2.5 rounded-md border border-slate-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none text-white";

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-slate-200">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Dealer Login ID</label>
                <input type="text" name="id" value={formData.id} onChange={handleChange} placeholder="Dealer Login ID" className={inputClass} required />
            </div>
            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Dealer Display Name" className={inputClass} required />
            <div className="relative">
                <input type={isPasswordVisible ? 'text' : 'password'} name="password" value={displayPassword} onChange={dealer ? (e) => setPassword(e.target.value) : handleChange} placeholder={dealer ? "New Password (optional)" : "Password"} className={inputClass + " pr-10"} required={!dealer} />
                <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white">{isPasswordVisible ? Icons.eyeOff : Icons.eye}</button>
            </div>
            {displayPassword && (
                 <div className="relative">
                    <input type={isConfirmPasswordVisible ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm New Password" className={inputClass + " pr-10"} required />
                    <button type="button" onClick={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white">{isConfirmPasswordVisible ? Icons.eyeOff : Icons.eye}</button>
                </div>
            )}
            <input type="url" name="avatarUrl" value={formData.avatarUrl || ''} onChange={handleChange} placeholder="Avatar URL (optional)" className={inputClass} />
            <input type="text" name="area" value={formData.area} onChange={handleChange} placeholder="Area / Region" className={inputClass} />
            <input type="text" name="contact" value={formData.contact} onChange={handleChange} placeholder="Contact Number" className={inputClass} />
             {!dealer && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Initial Wallet Amount (PKR)</label>
                  <input type="text" name="wallet" value={formData.wallet} onChange={handleChange} placeholder="e.g. 10000" className={inputClass} />
                </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Dealer Commission Rate (%)</label>
              <input type="text" name="commissionRate" value={formData.commissionRate} onChange={handleChange} placeholder="e.g. 5" className={inputClass} />
            </div>
            
            <fieldset className="border border-slate-600 p-4 rounded-md">
                <legend className="px-2 text-sm font-medium text-slate-400">Prize Rates</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className="text-xs">2 Digit</label><input type="text" name="prizeRates.twoDigit" value={formData.prizeRates.twoDigit} onChange={handleChange} className={inputClass} /></div>
                    <div><label className="text-xs">1D Open</label><input type="text" name="prizeRates.oneDigitOpen" value={formData.prizeRates.oneDigitOpen} onChange={handleChange} className={inputClass} /></div>
                    <div><label className="text-xs">1D Close</label><input type="text" name="prizeRates.oneDigitClose" value={formData.prizeRates.oneDigitClose} onChange={handleChange} className={inputClass} /></div>
                </div>
            </fieldset>

            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors">Cancel</button>
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors">Save Dealer</button>
            </div>
        </form>
    );
};

const DashboardView: React.FC<{ summary: FinancialSummary | null; admin: Admin }> = ({ summary, admin }) => {
    if (!summary) {
        return <div className="text-center p-8 text-slate-400">Loading financial summary...</div>;
    }

    const SummaryCard: React.FC<{ title: string; value: number; color: string }> = ({ title, value, color }) => (
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <p className="text-sm text-slate-400 uppercase tracking-wider">{title}</p>
            <p className={`text-3xl font-bold font-mono ${color}`}>{(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
    );
    
    return (
        <div>
            <h3 className="text-xl font-semibold text-white mb-4">Financial Dashboard</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <SummaryCard title="System Wallet" value={admin.wallet} color="text-cyan-400" />
                <SummaryCard title="Total Bets Placed" value={summary.totals?.totalStake} color="text-white" />
                <SummaryCard title="Total Prize Payouts" value={summary.totals?.totalPayouts} color="text-amber-400" />
                <SummaryCard title="Net System Profit" value={summary.totals?.netProfit} color={(summary.totals?.netProfit || 0) >= 0 ? "text-green-400" : "text-red-400"} />
            </div>

            <h3 className="text-xl font-semibold text-white mb-4">Game-by-Game Breakdown</h3>
            <div className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700">
                <div className="overflow-x-auto mobile-scroll-x">
                    <table className="w-full text-left min-w-[700px]">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Game</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Stake</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Payouts</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Dealer Profit</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Commissions</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Net Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {summary.games?.map(game => (
                                <tr key={game.gameName} className="hover:bg-cyan-500/10 transition-colors">
                                    <td className="p-4 font-medium text-white">{game.gameName} <span className="text-xs text-slate-400">({game.winningNumber})</span></td>
                                    <td className="p-4 text-right font-mono text-white">{(game.totalStake || 0).toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono text-amber-400">{(game.totalPayouts || 0).toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono text-emerald-400">{(game.totalDealerProfit || 0).toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono text-sky-400">{(game.totalCommissions || 0).toFixed(2)}</td>
                                    <td className={`p-4 text-right font-mono font-bold ${(game.netProfit || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{(game.netProfit || 0).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-800/50 border-t-2 border-slate-600">
                            <tr className="font-bold text-white">
                                <td className="p-4 text-sm uppercase">Grand Total</td>
                                <td className="p-4 text-right font-mono">{(summary.totals?.totalStake || 0).toFixed(2)}</td>
                                <td className="p-4 text-right font-mono text-amber-300">{(summary.totals?.totalPayouts || 0).toFixed(2)}</td>
                                <td className="p-4 text-right font-mono text-emerald-300">{(summary.totals?.totalDealerProfit || 0).toFixed(2)}</td>
                                <td className="p-4 text-right font-mono text-sky-300">{(summary.totals?.totalCommissions || 0).toFixed(2)}</td>
                                <td className={`p-4 text-right font-mono ${(summary.totals?.netProfit || 0) >= 0 ? "text-green-300" : "text-red-300"}`}>{(summary.totals?.netProfit || 0).toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

const NumberLimitsView: React.FC = () => {
    const [limits, setLimits] = useState<NumberLimit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [formState, setFormState] = useState<Omit<NumberLimit, 'id'>>({
        gameType: '2-digit',
        numberValue: '',
        limitAmount: 0,
    });
    const { fetchWithAuth } = useAuth();

    const fetchLimits = async () => {
        setIsLoading(true);
        try {
            const response = await fetchWithAuth('/api/admin/number-limits');
            const data = await response.json();
            setLimits(data);
        } catch (error) {
            console.error("Failed to fetch number limits:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLimits();
    }, []);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        let processedValue = value;
        if (name === 'numberValue') {
            processedValue = value.replace(/\D/g, ''); 
            const maxLength = formState.gameType === '2-digit' ? 2 : 1;
            if (processedValue.length > maxLength) {
                processedValue = processedValue.slice(0, maxLength);
            }
        }

        setFormState(prev => ({
            ...prev,
            [name]: name === 'limitAmount' ? (value ? parseFloat(value) : 0) : processedValue
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { numberValue, limitAmount } = formState;
        if (!numberValue.trim() || limitAmount <= 0) {
            alert("Please enter a valid number and a limit amount.");
            return;
        }

        try {
            await fetchWithAuth('/api/admin/number-limits', {
                method: 'POST',
                body: JSON.stringify(formState)
            });
            setFormState({ gameType: '2-digit', numberValue: '', limitAmount: 0 });
            await fetchLimits();
        } catch (error) {
            alert("Failed to save limit.");
        }
    };
    
    const handleDelete = async (limitId: number) => {
        if (window.confirm("Are you sure?")) {
            try {
                await fetchWithAuth(`/api/admin/number-limits/${limitId}`, { method: 'DELETE' });
                await fetchLimits();
            } catch (error) {
                alert("Failed to delete limit.");
            }
        }
    };

    const inputClass = "bg-slate-800 p-2 rounded-md border border-slate-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none w-full";
    const gameTypeLabels: Record<NumberLimit['gameType'], string> = {
        '1-open': '1 Digit Open',
        '1-close': '1 Digit Close',
        '2-digit': '2 Digit',
    };

    return (
        <div>
            <h3 className="text-xl font-semibold text-white mb-4">Manage Number Betting Limits</h3>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Game Type</label>
                        <select name="gameType" value={formState.gameType} onChange={handleInputChange} className={inputClass}>
                            <option value="2-digit">2 Digit</option>
                            <option value="1-open">1 Digit Open</option>
                            <option value="1-close">1 Digit Close</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Number</label>
                        <input type="text" name="numberValue" value={formState.numberValue} onChange={handleInputChange} className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Max Stake (PKR)</label>
                        <input type="number" name="limitAmount" value={formState.limitAmount || ''} onChange={handleInputChange} className={inputClass} />
                    </div>
                    <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors h-fit">Set Limit</button>
                </form>
            </div>
             <div className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700">
                 <div className="overflow-x-auto mobile-scroll-x">
                     <table className="w-full text-left min-w-[600px]">
                         <thead className="bg-slate-800/50">
                             <tr>
                                 <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Game Type</th>
                                 <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Number</th>
                                 <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Limit (PKR)</th>
                                 <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-800">
                            {isLoading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-400">Loading limits...</td></tr>
                            ) : limits.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">No limits set.</td></tr>
                            ) : (
                                limits.map(limit => (
                                     <tr key={limit.id} className="hover:bg-cyan-500/10 transition-colors">
                                         <td className="p-4 text-white">{gameTypeLabels[limit.gameType]}</td>
                                         <td className="p-4 font-mono text-cyan-300 text-lg">{limit.numberValue}</td>
                                         <td className="p-4 font-mono text-white">{(limit.limitAmount || 0).toLocaleString()}</td>
                                         <td className="p-4">
                                             <button onClick={() => handleDelete(limit.id)} className="bg-red-500/20 hover:bg-red-500/40 text-red-300 font-semibold py-1 px-3 rounded-md text-sm transition-colors">Delete</button>
                                         </td>
                                     </tr>
                                ))
                            )}
                         </tbody>
                     </table>
                 </div>
            </div>
        </div>
    );
};

const NumberSummaryView: React.FC<{ games: Game[]; dealers: Dealer[]; users: User[]; }> = ({ games, dealers, users }) => {
    const [filters, setFilters] = useState({ gameId: '', dealerId: '', date: getTodayDateString() });
    const [summary, setSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { fetchWithAuth } = useAuth();
    
    const fetchSummary = async () => {
        setIsLoading(true);
        const params = new URLSearchParams(filters);
        try {
            const response = await fetchWithAuth(`/api/admin/number-summary?${params.toString()}`);
            const data = await response.json();
            setSummary(data);
        } catch (error) {
            setSummary(null);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => { fetchSummary(); }, [filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const SummaryColumn = ({ title, data, color }: any) => (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col">
            <h4 className={`text-lg font-semibold ${color} mb-3`}>{title}</h4>
            <div className="flex-grow overflow-y-auto pr-2 space-y-2 max-h-[60vh]">
                {(!data || data.length === 0) ? (
                    <p className="text-slate-500 text-sm text-center pt-4">No data.</p>
                ) : (
                    data.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-baseline p-2 rounded bg-slate-900/50 border-l-2 border-cyan-500">
                            <span className={`font-mono text-2xl font-bold ${color}`}>{item.number}</span>
                            <span className="font-mono text-white">Rs {(item.stake || 0).toLocaleString()}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const inputClass = "w-full bg-slate-800 p-2 rounded-md border border-slate-600 text-white";

    return (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div><label className="text-xs text-slate-400 uppercase">Date</label><input type="date" name="date" value={filters.date} onChange={handleFilterChange} className={inputClass} /></div>
                <div><label className="text-xs text-slate-400 uppercase">Game</label><select name="gameId" value={filters.gameId} onChange={handleFilterChange} className={inputClass}><option value="">All Games</option>{games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                <div><label className="text-xs text-slate-400 uppercase">Dealer</label><select name="dealerId" value={filters.dealerId} onChange={handleFilterChange} className={inputClass}><option value="">All Dealers</option>{dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            </div>
            {isLoading ? <div className="text-center p-8 text-slate-400">Loading...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SummaryColumn title="2 Digit" data={summary?.twoDigit} color="text-cyan-400" />
                    <SummaryColumn title="Open" data={summary?.oneDigitOpen} color="text-amber-400" />
                    <SummaryColumn title="Close" data={summary?.oneDigitClose} color="text-rose-400" />
                </div>
            )}
        </div>
    );
};

interface AdminPanelProps {
  admin: Admin; 
  dealers: Dealer[]; 
  onSaveDealer: (dealer: Dealer, originalId?: string) => Promise<void>;
  onUpdateAdmin: (admin: Admin) => Promise<void>;
  users: User[]; 
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  games: Game[]; 
  bets: Bet[]; 
  declareWinner: (gameId: string, winningNumber: string) => void;
  updateWinner: (gameId: string, newWinningNumber: string) => void;
  approvePayouts: (gameId: string) => void;
  topUpDealerWallet: (dealerId: string, amount: number) => void;
  withdrawFromDealerWallet: (dealerId: string, amount: number) => void;
  toggleAccountRestriction: (accountId: string, accountType: 'user' | 'dealer') => void;
  onPlaceAdminBets: (details: any) => Promise<void>;
  updateGameDrawTime: (gameId: string, newDrawTime: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ admin, dealers, onSaveDealer, onUpdateAdmin, users, setUsers, games, bets, declareWinner, updateWinner, approvePayouts, topUpDealerWallet, withdrawFromDealerWallet, toggleAccountRestriction, updateGameDrawTime, onRefreshData }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summaryData, setSummaryData] = useState<FinancialSummary | null>(null);
  const { fetchWithAuth } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | undefined>(undefined);
  const [viewingLedgerId, setViewingLedgerId] = useState<string | null>(null);
  const [viewingLedgerType, setViewingLedgerType] = useState<'dealer' | 'admin' | 'user' | null>(null);

  useEffect(() => {
    if (activeTab === 'dashboard') {
        fetchWithAuth('/api/admin/summary').then(r => r.json()).then(setSummaryData).catch(console.error);
    }
  }, [activeTab, fetchWithAuth]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.chartBar },
    { id: 'dealers', label: 'Dealers', icon: Icons.userGroup }, 
    { id: 'users', label: 'Users', icon: Icons.clipboardList },
    { id: 'games', label: 'Games', icon: Icons.gamepad },
    { id: 'winners', label: 'Winners', icon: Icons.star },
    { id: 'numberSummary', label: 'Number Summary', icon: Icons.chartBar },
    { id: 'limits', label: 'Limits', icon: Icons.clipboardList }, 
    { id: 'history', label: 'Ledgers', icon: Icons.bookOpen },
  ];

  const activeLedgerAccount = useMemo(() => {
    if (!viewingLedgerId) return null;
    if (viewingLedgerType === 'admin') return admin;
    if (viewingLedgerType === 'dealer') return dealers.find(d => d.id === viewingLedgerId);
    if (viewingLedgerType === 'user') return users.find(u => u.id === viewingLedgerId);
    return null;
  }, [viewingLedgerId, viewingLedgerType, admin, dealers, users]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-red-400 mb-6 uppercase tracking-widest">Admin Console</h2>
      <div className="bg-slate-800/50 p-1.5 rounded-lg flex items-center space-x-2 mb-6 self-start flex-wrap border border-slate-700">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center space-x-2 py-2 px-4 text-sm font-semibold rounded-md transition-all duration-300 ${activeTab === tab.id ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}>
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>
      
      {activeTab === 'dashboard' && <DashboardView summary={summaryData} admin={admin} />}
      {activeTab === 'winners' && <WinnersView bets={bets} games={games} users={users} dealers={dealers} />}
      {activeTab === 'numberSummary' && <NumberSummaryView games={games} dealers={dealers} users={users} />}
      {activeTab === 'limits' && <NumberLimitsView />}

      {activeTab === 'dealers' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-white">Dealers</h3>
            <button onClick={() => { setSelectedDealer(undefined); setIsModalOpen(true); }} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md">Create Dealer</button>
          </div>
          <div className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700">
             <table className="w-full text-left">
                 <thead className="bg-slate-800/50">
                     <tr className="text-xs text-slate-400 uppercase">
                         <th className="p-4">Name</th><th className="p-4">Wallet</th><th className="p-4">Status</th><th className="p-4">Actions</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800">
                     {dealers.map(dealer => (
                         <tr key={dealer.id} className="hover:bg-cyan-500/10">
                             <td className="p-4 text-white font-bold">{dealer.name}</td>
                             <td className="p-4 font-mono">Rs {(dealer.wallet || 0).toLocaleString()}</td>
                             <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] ${dealer.isRestricted ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{dealer.isRestricted ? 'Restricted' : 'Active'}</span></td>
                             <td className="p-4 flex gap-2">
                                <button onClick={() => { setSelectedDealer(dealer); setIsModalOpen(true); }} className="text-cyan-400 hover:underline">Edit</button>
                                <button onClick={() => { setViewingLedgerId(dealer.id); setViewingLedgerType('dealer'); }} className="text-emerald-400 hover:underline">Ledger</button>
                             </td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700 p-6">
            <p className="text-slate-400 mb-4 italic">Select an account below to view its complete financial transaction history.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button onClick={() => { setViewingLedgerId(admin.id); setViewingLedgerType('admin'); }} className="p-4 bg-slate-700 rounded-lg text-white font-bold hover:bg-slate-600 border border-slate-600">Admin General Ledger</button>
                {dealers.map(d => <button key={d.id} onClick={() => { setViewingLedgerId(d.id); setViewingLedgerType('dealer'); }} className="p-4 bg-slate-800/50 rounded-lg text-slate-300 hover:bg-slate-700 border border-slate-700">{d.name} Ledger</button>)}
            </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedDealer ? "Edit Dealer" : "Create Dealer"}>
          <DealerForm dealer={selectedDealer} dealers={dealers} onSave={onSaveDealer} onCancel={() => setIsModalOpen(false)} adminPrizeRates={admin.prizeRates} />
      </Modal>

      {activeLedgerAccount && (
        <Modal isOpen={!!activeLedgerAccount} onClose={() => { setViewingLedgerId(null); setViewingLedgerType(null); }} title={`Ledger: ${activeLedgerAccount.name}`} size="xl">
            <StatefulLedgerTableWrapper entries={activeLedgerAccount.ledger} />
        </Modal>
      )}

    </div>
  );
};

export default AdminPanel;
