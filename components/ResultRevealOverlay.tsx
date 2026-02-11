
import React, { useState, useEffect, useMemo } from 'react';

interface ResultRevealOverlayProps {
  gameName: string;
  winningNumber: string;
  onClose: () => void;
}

const Confetti: React.FC = () => {
    const pieces = useMemo(() => {
        return Array.from({ length: 50 }).map((_, i) => ({
            left: Math.random() * 100 + '%',
            delay: Math.random() * 1 + 's',
            duration: Math.random() * 1 + 1 + 's',
            color: ['#fbbf24', '#fcd34d', '#ec4899', '#06b6d4', '#ffffff'][Math.floor(Math.random() * 5)],
            size: Math.random() * 8 + 4 + 'px'
        }));
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
            {pieces.map((p, i) => (
                <div 
                    key={i} 
                    className="confetti-piece" 
                    style={{ 
                        left: p.left, 
                        animationDelay: p.delay, 
                        animationDuration: p.duration,
                        backgroundColor: p.color,
                        width: p.size,
                        height: p.size,
                        borderRadius: '2px',
                        boxShadow: `0 0 10px ${p.color}`
                    }} 
                />
            ))}
        </div>
    );
};

const ResultRevealOverlay: React.FC<ResultRevealOverlayProps> = ({ gameName, winningNumber, onClose }) => {
  const [phase, setPhase] = useState<'ROLLING' | 'REVEAL'>('ROLLING');
  const [displayNum, setDisplayNum] = useState('00');
  const [showFlash, setShowFlash] = useState(false);

  // Ultra-fast reveal: 2 seconds
  const TOTAL_ROLL_TIME = 2000; 

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (phase === 'ROLLING') {
      interval = setInterval(() => {
        const randomNum = winningNumber.length === 1 
          ? Math.floor(Math.random() * 10).toString()
          : Math.floor(Math.random() * 100).toString().padStart(2, '0');
        setDisplayNum(randomNum);
      }, 30);

      const timer = setTimeout(() => {
        setShowFlash(true);
        setTimeout(() => {
            setPhase('REVEAL');
            setDisplayNum(winningNumber);
            setShowFlash(false);
        }, 100);
      }, TOTAL_ROLL_TIME);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [phase, winningNumber]);

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl">
      
      {showFlash && <div className="fixed inset-0 bg-white z-[2100]"></div>}
      {phase === 'REVEAL' && <Confetti />}

      <div className="relative z-[2010] text-center px-4 w-full flex flex-col items-center">
        <h2 className="text-xl md:text-3xl font-black text-cyan-400 tracking-widest uppercase mb-4 animate-pulse">
            {phase === 'REVEAL' ? '✨ WINNING RESULT ✨' : 'CALCULATING DRAW...'}
        </h2>

        <h1 className="text-4xl md:text-7xl font-black text-white uppercase mb-8">{gameName}</h1>

        <div className={`
            w-56 h-56 md:w-80 md:h-80 rounded-full border-[10px] flex items-center justify-center transition-all duration-300
            ${phase === 'REVEAL' ? 'border-amber-400 bg-slate-900 shadow-[0_0_80px_rgba(251,191,36,0.6)]' : 'border-slate-700 bg-slate-950'}
        `}>
            <div className={`text-8xl md:text-[10rem] font-black font-mono transition-all ${phase === 'REVEAL' ? 'text-white scale-110 drop-shadow-glow' : 'text-slate-700'}`}>
                {displayNum}
            </div>
        </div>

        <div className="mt-12">
          {phase === 'REVEAL' && (
            <button 
              onClick={onClose}
              className="bg-amber-400 hover:bg-white text-black font-black px-12 py-4 rounded-full text-xl shadow-2xl transition-all transform active:scale-95"
            >
              CONTINUE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultRevealOverlay;
