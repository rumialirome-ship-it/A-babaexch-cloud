import React, { useMemo } from 'react';
import { LedgerEntry } from '../types';

export const LedgerTable: React.FC<{ entries: LedgerEntry[] }> = ({ entries }) => {
    const sortedEntries = useMemo(() => {
        if (!entries) return [];
        return [...entries].sort((a, b) => {
            const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return timeB - timeA; // Descending: Latest first
        });
    }, [entries]);

    return (
        <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700 shadow-inner">
            <div className="overflow-y-auto max-h-[60vh] mobile-scroll-x no-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-800/50 sticky top-0 backdrop-blur-sm z-10">
                        <tr className="border-b border-slate-700">
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date/Time</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Debit (-)</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Credit (+)</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Portfolio Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {sortedEntries.map(entry => (
                            <tr key={entry.id} className="hover:bg-cyan-500/5 transition-colors">
                                <td className="p-4 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                    {new Date(entry.timestamp).toLocaleString()}
                                </td>
                                <td className="p-4 text-xs text-white font-medium">{entry.description}</td>
                                <td className="p-4 text-right text-rose-400 font-mono text-xs">
                                    {entry.debit > 0 ? `-${entry.debit.toFixed(2)}` : '-'}
                                </td>
                                <td className="p-4 text-right text-emerald-400 font-mono text-xs">
                                    {entry.credit > 0 ? `+${entry.credit.toFixed(2)}` : '-'}
                                </td>
                                <td className="p-4 text-right font-black text-white font-mono text-xs">
                                    Rs {entry.balance.toFixed(2)}
                                </td>
                            </tr>
                        ))}
                        {sortedEntries.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-slate-600 font-black uppercase text-[10px] tracking-widest">
                                    No history found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
