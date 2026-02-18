
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Game, SubGameType, LedgerEntry, Bet, PrizeRates, BetLimits } from '../types';
import { Icons } from '../constants';
import { useCountdown } from '../hooks/useCountdown';
import { useAuth } from '../hooks/useAuth';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);
    return (
        <div className={`fixed top-4 right-4 z-[2000] p-4 rounded-lg shadow-2xl border flex items-center gap-3 animate-slide-in max-w-[90vw] sm:max-w-md ${type === 'success' ? 'bg-emerald-900 border-emerald-500 text-emerald-50' : 'bg-red-900 border-red-500 text-red-50'}`}>
            <span className="text-xl shrink-0">{type === 'success' ? '✅' : '⚠️'}</span>
            <span className="font-semibold text-sm">{message}</span>
            <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 p-1 active:scale-75 transition-transform">{Icons.close}</button>
        </div>
    );
};

const calculateBetPayout = (bet: Bet, game: Game | undefined, userPrizeRates: PrizeRates) => {
    if (!game || !game.winningNumber || game.winningNumber.includes('_') || !userPrizeRates) return 0;
    const win = game.winningNumber; let count = 0;
    const isAK = game.name === 'AK';
    const isAKC = game.name === 'AKC';
    
    bet.numbers.forEach(num => {
        let isWin = false;
        if (isAK) isWin = num === win;
        else if (isAKC) isWin = num === win;
        else if (bet.subGameType === SubGameType.OneDigitOpen) isWin = win.length >= 1 && num === win[0];
        else if (bet.subGameType === SubGameType.OneDigitClose) isWin = game.name === 'AKC' ? num === win : (win.length === 2 && num === win[1]);
        else isWin = num === win;
        if (isWin) count++;
    });
    const mult = bet.subGameType === SubGameType.OneDigitOpen ? userPrizeRates.oneDigitOpen : (bet.subGameType === SubGameType.OneDigitClose ? userPrizeRates.oneDigitClose : userPrizeRates.twoDigit);
    return count * bet.amountPerNumber * (mult || 0);
};

const GameStakeBreakdown: React.FC<{ games: Game[], bets: Bet[], user: User }> = ({ games, bets, user }) => {
    const data = useMemo(() => {
        if (!user?.prizeRates) return [];
        return (games || []).map(game => {
            const gameBets = (bets || []).filter(b => b.gameId === game.id);
            const totalStake = gameBets.reduce((sum, b) => sum + b.totalAmount, 0);
            const totalComm = gameBets.reduce((sum, b) => sum + (b.totalAmount * (user.commissionRate / 100)), 0);
            const totalPrize = gameBets.reduce((sum, b) => sum + calculateBetPayout(b, game, user.prizeRates), 0);
            return { id: game.id, name: game.name, logo: game.logo, totalStake, totalComm, totalPrize, netProfit: (totalPrize + totalComm) - totalStake, winningNumber: game.winningNumber };
        }).filter(d => d.totalStake > 0).sort((a, b) => b.totalStake - a.totalStake);
    }, [games, bets, user]);
    if (data.length === 0) return null;
    return (
        <div className="mb-8 animate-fade-in space-y-4">
            <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">Activity Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.map(item => (
                    <div key={item.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700 backdrop-blur-md shadow-lg">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2"><img src={item.logo} className="w-8 h-8 rounded-full border border-slate-600 bg-slate-900" /><div className="text-xs font-black text-white uppercase tracking-tight">{item.name}</div></div>
                            <div className="text-right"><div className="text-[8px] text-slate-500 uppercase font-black">Net Profit</div><div className={`text-xs font-mono font-black ${item.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{item.netProfit >= 0 ? '+' : ''}{item.netProfit.toLocaleString()}</div></div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 pt-3 border-t border-slate-700/50">
                            <div className="text-center"><div className="text-[7px] text-slate-500 uppercase font-black">Stake</div><div className="text-[10px] font-mono font-bold text-white">{item.totalStake.toLocaleString()}</div></div>
                            <div className="text-center"><div className="text-[7px] text-emerald-500 uppercase font-black">Prize</div><div className="text-[10px] font-mono font-bold text-emerald-400">{item.totalPrize.toLocaleString()}</div></div>
                            <div className="text-center"><div className="text-[7px] text-sky-500 uppercase font-black">Comm</div><div className="text-[10px] font-mono font-bold text-sky-400">{item.totalComm.toFixed(0)}</div></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BetHistoryView: React.FC<{ bets: Bet[], games: Game[], user: User }> = ({ bets, games, user }) => {
    const [date, setDate] = useState(getTodayDateString());
    const filtered = useMemo(() => (!bets ? [] : bets.filter(b => !date || b.timestamp.toISOString().split('T')[0] === date)), [bets, date]);
    return (
        <div className="mt-8 space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-xl font-black text-white uppercase tracking-widest">Recent Tickets</h3><input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[10px] text-white focus:ring-1 focus:ring-sky-500" /></div>
            <div className="bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-700 shadow-xl">
                {/* Desktop View */}
                <div className="hidden sm:block overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="bg-slate-900/50 border-b border-slate-700"><tr className="text-[10px] text-slate-500 font-black uppercase tracking-widest"><th className="p-4">Time</th><th className="p-4">Game</th><th className="p-4">Numbers</th><th className="p-4 text-right">Stake</th><th className="p-4 text-right">Status</th></tr></thead>
                        <tbody className="divide-y divide-slate-800">
                            {filtered.map(bet => {
                                const game = games.find(g => g.id === bet.gameId);
                                const payout = calculateBetPayout(bet, game, user.prizeRates);
                                const status = (!game?.winningNumber || game.winningNumber.includes('_')) ? { t: 'Pending', c: 'text-amber-400' } : (payout > 0 ? { t: `Win Rs ${payout}`, c: 'text-emerald-400' } : { t: 'Lost', c: 'text-red-400' });
                                return (
                                    <tr key={bet.id} className="hover:bg-sky-500/5 transition-all">
                                        <td className="p-4 text-[10px] font-mono text-slate-500">{bet.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="p-4 text-xs font-black text-white uppercase">{game?.name || '---'}</td>
                                        <td className="p-4 text-[10px] text-slate-400 truncate max-w-[200px]">{bet.numbers.join(', ')}</td>
                                        <td className="p-4 text-right font-mono text-xs text-white">Rs {bet.totalAmount}</td>
                                        <td className={`p-4 text-right text-[10px] font-black uppercase ${status.c}`}>{status.t}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {/* Mobile View */}
                <div className="sm:hidden divide-y divide-slate-800">
                    {filtered.length === 0 ? <div className="p-8 text-center text-slate-600 font-black text-[10px] uppercase">No tickets recorded</div> : filtered.map(bet => {
                        const game = games.find(g => g.id === bet.gameId);
                        const payout = calculateBetPayout(bet, game, user.prizeRates);
                        const status = (!game?.winningNumber || game.winningNumber.includes('_')) ? { t: 'Pending', c: 'text-amber-400' } : (payout > 0 ? { t: `Win Rs ${payout}`, c: 'text-emerald-400 font-black' } : { t: 'Lost', c: 'text-red-400' });
                        return (
                            <div key={bet.id} className="p-4 space-y-2">
                                <div className="flex justify-between items-start">
                                    <div><div className="text-white font-black text-xs uppercase">{game?.name || '---'}</div><div className="text-[9px] font-mono text-slate-500">{bet.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div>
                                    <div className="text-right"><div className="font-mono text-white font-black text-sm">Rs {bet.totalAmount}</div><div className={`text-[9px] font-black uppercase ${status.c}`}>{status.t}</div></div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {bet.numbers.map((n, i) => <span key={i} className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400">{n}</span>)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const BettingModal: React.FC<{ game: Game | null, games: Game[], user: User, onClose: () => void, onPlaceBet: (details: any) => Promise<void> }> = ({ game, games, user, onClose, onPlaceBet }) => {
    const { fetchWithAuth } = useAuth();
    const isAK = game?.name === 'AK';
    const isAKC = game?.name === 'AKC';
    
    const [subType, setSubType] = useState<SubGameType>(isAK ? SubGameType.OneDigitOpen : (isAKC ? SubGameType.OneDigitClose : SubGameType.TwoDigit));
    const [manualNums, setManualNums] = useState('');
    const [manualAmt, setManualAmt] = useState(user?.fixedStake > 0 ? user.fixedStake.toString() : '');
    const [bulk, setBulk] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const { text: countdown } = useCountdown(game?.drawTime || '00:00');

    const tabs = useMemo(() => {
        if (!game) return [];
        if (isAK) return [SubGameType.OneDigitOpen];
        if (isAKC) return [SubGameType.OneDigitClose];
        const all = [SubGameType.TwoDigit, SubGameType.OneDigitOpen, SubGameType.OneDigitClose, SubGameType.Bulk, SubGameType.Combo];
        return all;
    }, [game, isAK, isAKC]);

    useEffect(() => { 
        setManualNums(''); 
        setManualAmt(user?.fixedStake > 0 ? user.fixedStake.toString() : ''); 
        setBulk(''); 
        setError(null); 
        setIsConfirming(false); 
        if (tabs.length > 0 && !tabs.includes(subType)) setSubType(tabs[0]); 
    }, [subType, user?.fixedStake, game, tabs]);

    const finalCost = useMemo(() => {
        if (subType === SubGameType.Bulk) {
            let tc = 0; const lines = bulk.split('\n');
            lines.forEach(l => { const sm = l.match(/(?:rs|r)?\s*(\d+\.?\d*)$/i); const s = user?.fixedStake > 0 ? user.fixedStake : (sm ? parseFloat(sm[1]) : 0); const tokens = l.replace(/(?:rs|r)?\s*(\d+\.?\d*)$/i, '').split(/[-.,_*\/+<>=%;'\s]+/).filter(Boolean); tc += tokens.length * s; });
            return tc;
        }
        const n = manualNums.replace(/\D/g, '').length / (subType === SubGameType.TwoDigit ? 2 : 1);
        const s = user?.fixedStake > 0 ? user.fixedStake : parseFloat(manualAmt);
        return (isNaN(n) || isNaN(s)) ? 0 : Math.floor(n) * s;
    }, [subType, bulk, manualNums, manualAmt, user?.fixedStake]);

    const handleBet = async () => {
        setError(null); setIsSubmitting(true);
        try {
            if (subType === SubGameType.Bulk) {
                const lines = bulk.split('\n').filter(l => l.trim()); const betsByGame = new Map();
                lines.forEach(line => {
                    const sm = line.match(/(?:rs|r)?\s*(\d+\.?\d*)$/i); let s = user?.fixedStake > 0 ? user.fixedStake : (sm ? parseFloat(sm[1]) : 0);
                    const tokens = line.replace(/(?:rs|r)?\s*(\d+\.?\d*)$/i, '').split(/[-.,_*\/+<>=%;'\s]+/).filter(Boolean);
                    tokens.forEach(t => {
                        let type;
                        if (isAK) type = SubGameType.OneDigitOpen;
                        else if (isAKC) type = SubGameType.OneDigitClose;
                        else type = /^\d[xX]$/i.test(t) ? SubGameType.OneDigitOpen : (/^[xX]\d$/i.test(t) || /^\d$/.test(t) ? SubGameType.OneDigitClose : SubGameType.TwoDigit);
                        
                        let num;
                        if (type === SubGameType.TwoDigit) num = t.padStart(2, '0');
                        else if (type === SubGameType.OneDigitOpen || type === SubGameType.OneDigitClose) num = t.replace(/\D/g, '').charAt(0);
                        else num = t.replace(/\D/g, '').charAt(0);

                        if (num) {
                            const key = `${type}__${s}`; if (!betsByGame.has(key)) betsByGame.set(key, { subGameType: type, numbers: [], amountPerNumber: s });
                            betsByGame.get(key).numbers.push(num);
                        }
                    });
                });
                await onPlaceBet({ gameId: game!.id, betGroups: Array.from(betsByGame.values()) });
            } else {
                const numsRaw = manualNums.replace(/\D/g, '');
                const numStep = (subType === SubGameType.TwoDigit) ? 2 : 1;
                const nums = [];
                for (let i = 0; i < numsRaw.length; i += numStep) {
                    let n = numsRaw.substring(i, i + numStep);
                    if (subType === SubGameType.TwoDigit) n = n.padStart(2, '0');
                    nums.push(n);
                }
                await onPlaceBet({ gameId: game!.id, betGroups: [{ subGameType: subType, numbers: [...new Set(nums)], amountPerNumber: user.fixedStake > 0 ? user.fixedStake : parseFloat(manualAmt) }] });
            }
        } catch (e: any) { setError(e.message); setIsConfirming(false); } finally { setIsSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-slate-900 border border-sky-500/30 w-full max-w-md rounded-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <div><h3 className="text-lg font-black text-white uppercase">{isConfirming ? 'Verify Bet' : game?.name}</h3><div className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">Draw closes: {countdown}</div></div>
                    {!isConfirming && <button onClick={onClose} className="text-slate-500 hover:text-white p-2 active:scale-75 transition-transform">{Icons.close}</button>}
                </div>
                <div className="p-5 overflow-y-auto no-scrollbar space-y-5">
                    {isConfirming ? (
                        <div className="text-center space-y-6">
                            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700"><div className="text-[10px] text-slate-500 font-black uppercase mb-1">Total Payable</div><div className="text-4xl font-black text-emerald-400 font-mono">Rs {finalCost.toLocaleString()}</div></div>
                            <div className="flex gap-3"><button onClick={() => setIsConfirming(false)} className="flex-1 py-5 bg-slate-800 text-slate-300 font-black uppercase text-[10px] rounded-xl active:scale-95 transition-all">Back</button><button onClick={handleBet} disabled={isSubmitting} className="flex-2 py-5 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl shadow-lg active:scale-95 transition-all">{isSubmitting ? 'SYNCING...' : 'CONFIRM & PAY'}</button></div>
                        </div>
                    ) : (
                        <>
                            <div className="flex bg-slate-800 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar">{tabs.map(t => <button key={t} onClick={() => setSubType(t)} className={`flex-1 min-w-[70px] py-2.5 text-[8px] font-black uppercase rounded-lg transition-all ${subType === t ? 'bg-slate-700 text-sky-400 shadow-inner' : 'text-slate-500'}`}>{t}</button>)}</div>
                            {subType === SubGameType.Bulk ? (
                                <div><label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Bulk Terminal (Num RS)</label><textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={5} placeholder={isAK || isAKC ? "Format: 4 50\n9 100" : "Format: 14, 05 50"} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm focus:ring-1 focus:ring-sky-500" /></div>
                            ) : (
                                <>
                                    <div><label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Numbers</label><textarea value={manualNums} onChange={e => setManualNums(e.target.value)} rows={2} placeholder={isAK || isAKC ? "e.g. 4, 9" : "e.g. 14, 05"} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm focus:ring-1 focus:ring-sky-500" /></div>
                                    <div><label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Stake (Rs)</label><input type="number" value={user?.fixedStake > 0 ? user.fixedStake : manualAmt} onChange={e => setManualAmt(e.target.value)} disabled={user?.fixedStake > 0} className={`w-full p-4 rounded-xl border ${user?.fixedStake > 0 ? 'bg-red-500/10 border-red-500/30 text-red-400 font-black' : 'bg-slate-800 border-slate-700 text-white'} font-mono text-sm`} /></div>
                                </>
                            )}
                            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex justify-between items-center"><div className="text-left"><div className="text-[8px] text-slate-500 font-black uppercase">Total Bet</div><div className="text-xl font-black text-white font-mono">Rs {finalCost}</div></div><div className="text-right"><div className="text-[8px] text-slate-500 font-black uppercase">Wallet</div><div className="text-sm font-black text-emerald-400">Rs {user?.wallet?.toLocaleString() || 0}</div></div></div>
                            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] p-3 rounded-lg font-bold">{error}</div>}
                            <button onClick={() => { if(finalCost > 0) setIsConfirming(true); }} disabled={finalCost <= 0 || !!error} className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-5 rounded-xl text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">PROCEED TO BET</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const LedgerTable: React.FC<{ entries: LedgerEntry[] }> = ({ entries }) => {
    const sortedEntries = useMemo(() => [...(entries || [])].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()), [entries]);
    return (
        <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700 shadow-inner">
            {/* Desktop View */}
            <div className="hidden sm:block overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-700">
                        <tr>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Narrative</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Debit (-)</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Credit (+)</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {sortedEntries.map(entry => (
                            <tr key={entry.id} className="hover:bg-sky-500/5 transition-all group">
                                <td className="p-4 whitespace-nowrap text-[11px] font-mono text-slate-400">{new Date(entry.timestamp).toLocaleString()}</td>
                                <td className="p-4 text-xs text-white font-medium">{entry.description}</td>
                                <td className="p-4 text-right text-rose-400 font-mono text-xs">{entry.debit > 0 ? `-${entry.debit.toFixed(2)}` : '-'}</td>
                                <td className="p-4 text-right text-emerald-400 font-mono text-xs">{entry.credit > 0 ? `+${entry.credit.toFixed(2)}` : '-'}</td>
                                <td className="p-4 text-right font-black text-white font-mono text-xs">Rs {entry.balance.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Mobile View */}
            <div className="sm:hidden divide-y divide-slate-800">
                {sortedEntries.length === 0 ? <div className="p-8 text-center text-slate-600 font-black text-[10px] uppercase">No transaction logs available</div> : sortedEntries.map(entry => (
                    <div key={entry.id} className="p-4 space-y-1">
                        <div className="flex justify-between items-start">
                            <div className="text-white text-xs font-bold leading-snug max-w-[70%]">{entry.description}</div>
                            <div className={`text-right font-mono font-black text-xs ${entry.credit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {entry.credit > 0 ? `+${entry.credit}` : `-${entry.debit}`}
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono">
                            <div className="text-slate-500">{new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {new Date(entry.timestamp).toLocaleDateString()}</div>
                            <div className="text-slate-300 font-black">Balance: Rs {entry.balance.toFixed(0)}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const UserPanel: React.FC<{ user: User, games: Game[], bets: Bet[], placeBet: (details: any) => Promise<void> }> = ({ user, games, bets, placeBet }) => {
    const [sel, setSel] = useState<Game | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const handleBet = async (d: any) => { try { await placeBet(d); setToast({ msg: "Ticket Booked!", type: 'success' }); setSel(null); } catch (e: any) { setToast({ msg: e.message || "Failed", type: 'error' }); throw e; } };
    
    if (!user) return <div className="p-20 text-center animate-pulse text-cyan-500 font-black uppercase text-xs tracking-widest">Constructing Dashboard...</div>;

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 pb-20">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tighter shadow-glow">My Account</h2><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Authorized Player ID: {user?.id}</p></div>
                <div className="bg-slate-800/60 px-6 py-4 rounded-2xl border border-slate-700 shadow-2xl flex flex-col items-end min-w-[200px]">
                    <div className="text-[10px] text-slate-500 font-black uppercase mb-1">Available Pool</div>
                    <div className="text-3xl font-black text-emerald-400 font-mono">Rs {(user?.wallet || 0).toLocaleString()}</div>
                    <div className="flex gap-2 mt-2">
                        {user?.fixedStake > 0 && <span className="text-[7px] bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-0.5 rounded uppercase font-black">Stake Locked: {user.fixedStake}</span>}
                        <span className="text-[7px] bg-sky-500/20 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded uppercase font-black">Draw Limit: {user?.betLimits?.perDraw || 0}</span>
                    </div>
                </div>
            </div>
            <GameStakeBreakdown games={games} bets={bets} user={user} />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {games.map(g => (
                    <div key={g.id} className={`bg-slate-800/40 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between transition-all ${g.isMarketOpen ? 'hover:border-sky-500/50 shadow-lg' : 'opacity-60 grayscale-[0.5]'}`}>
                        <div className="flex flex-col items-center text-center mb-4">
                            <img src={g.logo} className="w-12 h-12 rounded-full mb-2 border-2 border-slate-700 bg-slate-900" />
                            <div className="text-sm font-black text-white uppercase tracking-tight">{g.name}</div>
                            <div className="text-[8px] text-slate-500 font-bold">{g.drawTime}</div>
                        </div>
                        <div className="bg-black/20 p-2 rounded-xl text-center mb-3 min-h-[40px] flex items-center justify-center">
                            {(g.winningNumber && !g.winningNumber.includes('_')) ? <div className="text-xl font-black text-emerald-400 font-mono drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">{g.winningNumber}</div> : <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{g.isMarketOpen ? 'MARKET OPEN' : 'CLOSED'}</div>}
                        </div>
                        <button onClick={() => setSel(g)} disabled={!g.isMarketOpen || user.isRestricted} className="w-full py-3 bg-sky-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg active:scale-95 disabled:bg-slate-700 transition-all shadow-lg">Play Now</button>
                    </div>
                ))}
            </div>
            {sel && <BettingModal game={sel} games={games} user={user} onClose={() => setSel(null)} onPlaceBet={handleBet} />}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><BetHistoryView bets={bets} games={games} user={user} /><div className="mt-8 space-y-4"><h3 className="text-xl font-black text-white uppercase tracking-widest">Financial Ledger</h3><LedgerTable entries={user?.ledger || []} /></div></div>
        </div>
    );
};

export default UserPanel;
