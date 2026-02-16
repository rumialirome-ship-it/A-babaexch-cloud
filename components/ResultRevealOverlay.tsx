
import React, { useState, useEffect, useMemo } from 'react';

interface ResultRevealOverlayProps {
  gameName: string;
  winningNumber: string;
  onClose: () => void;
}

const TENSION_PHRASES = [
    "INITIATING DRAW SEQUENCE...",
    "HARNESSING GLOBAL LUCK...",
    "ORACLE IS CALCULATING...",
    "LOCKING IN FINAL VIBRATIONS...",
    "NUMBERS ARE ALIGNING...",
    "ALGORITHM SYNCHRONIZING...",
    "DECRYPTING FORTUNE...",
    "STABILIZING RESULT FIELD..."
];

const Confetti: React.FC = () => {
    const pieces = useMemo(() => {
        return Array.from({ length: 60 }).map((_, i) => ({
            left: Math.random() * 100 + '%',
            delay: Math.random() * 1 + 's',
            duration: Math.random() * 1 + 0.5 + 's',
            color: ['#fbbf24', '#ec4899', '#06b6d4', '#8b5cf6', '#ffffff'][Math.floor(Math.random() * 5)],
            size: Math.random() * 8 + 4 + 'px',
            rotation: Math.random() * 360 + 'deg'
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
                        transform: `rotate(${p.rotation})`,
                        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
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
  const [isShaking, setIsShaking] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showFlash, setShowFlash] = useState(false);

  // Set to 30 seconds for high-tension declaration
  const TOTAL_ROLL_TIME = 30000; 

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let phraseInterval: ReturnType<typeof setInterval>;
    let progressInterval: ReturnType<typeof setInterval>;

    if (phase === 'ROLLING') {
      interval = setInterval(() => {
        const randomNum = winningNumber.length === 1 
          ? Math.floor(Math.random() * 10).toString()
          : Math.floor(Math.random() * 100).toString().padStart(2, '0');
        setDisplayNum(randomNum);
      }, 50); // Rolling digits

      phraseInterval = setInterval(() => {
        setPhraseIndex(prev => (prev + 1) % TENSION_PHRASES.length);
      }, 3000); // Slower phrase rotation for 30s duration

      progressInterval = setInterval(() => {
        setElapsed(prev => prev + 100);
      }, 100);

      const timer = setTimeout(() => {
        setShowFlash(true);
        setTimeout(() => {
            setPhase('REVEAL');
            setDisplayNum(winningNumber);
            setIsShaking(true);
            setShowFlash(false);
            setTimeout(() => setIsShaking(false), 300);
        }, 100);
      }, TOTAL_ROLL_TIME);

      return () => {
        clearInterval(interval);
        clearInterval(phraseInterval);
        clearInterval(progressInterval);
        clearTimeout(timer);
      };
    }
  }, [phase, winningNumber]);

  const intensity = elapsed / TOTAL_ROLL_TIME;

  return (
    <div className={`fixed inset-0 z-[1000] flex flex-col items-center overflow-y-auto overflow-x-hidden bg-slate-950 transition-all duration-300 py-10 md:justify-center ${isShaking ? 'animate-shake scale-105' : ''}`}>
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div 
            className="w-[300vw] h-[300vw] opacity-40 animate-spotlight"
            style={{ 
                animationDuration: `${12 - (intensity * 10)}s`,
                background: `conic-gradient(from 0deg, 
                    transparent 0deg, 
                    rgba(6,182,212,0.3) 20deg, 
                    transparent 40deg, 
                    rgba(236,72,153,0.3) 60deg, 
                    transparent 80deg, 
                    rgba(251,191,36,0.3) 100deg, 
                    transparent 120deg)`
            }}
        ></div>
        <div className={`absolute inset-0 transition-colors duration-300 ${intensity > 0.8 ? 'bg-orange-500/20' : 'bg-cyan-500/10'}`}></div>
      </div>

      {showFlash && <div className="fixed inset-0 bg-white z-[1100] animate-pulse"></div>}
      {phase === 'REVEAL' && <Confetti />}

      <div className="relative z-[1010] text-center px-4 w-full max-w-4xl flex flex-col items-center">
        <div className="mb-8 w-full">
            <h2 className={`text-lg md:text-3xl font-black tracking-[0.4em] uppercase transition-all duration-300 ${phase === 'REVEAL' ? 'text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]' : 'text-white/90'}`}>
                {phase === 'REVEAL' ? '✨ RESULT DECLARED ✨' : TENSION_PHRASES[phraseIndex]}
            </h2>
            <div className="h-3 w-64 md:w-96 mx-auto mt-6 bg-slate-800 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div 
                    className={`h-full transition-all duration-100 ease-linear rounded-full ${intensity > 0.8 ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`} 
                    style={{ width: phase === 'REVEAL' ? '100%' : `${intensity * 100}%` }}
                ></div>
            </div>
            {phase === 'ROLLING' && (
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-3 animate-pulse">
                    Please wait for system validation...
                </p>
            )}
        </div>

        <h1 className={`text-5xl md:text-8xl font-black uppercase tracking-tighter mb-8 transition-all duration-300 ${phase === 'REVEAL' ? 'text-white scale-110' : 'text-slate-600'}`}>
          {gameName}
        </h1>

        <div className="relative inline-block">
            <div className={`absolute -inset-10 md:-inset-16 rounded-full blur-[50px] transition-all duration-300 ${phase === 'REVEAL' ? 'bg-amber-500/60 scale-110' : intensity > 0.8 ? 'bg-orange-600/40 animate-pulse' : 'bg-cyan-500/30'}`}></div>
            
            <div className={`
                w-44 h-44 md:w-80 md:h-80 rounded-full border-[8px] md:border-[12px] relative flex items-center justify-center transition-all duration-300 overflow-hidden
                ${phase === 'REVEAL' 
                    ? 'border-amber-400 bg-slate-900 shadow-[0_0_50px_rgba(251,191,36,0.6)]' 
                    : intensity > 0.8 
                    ? 'border-orange-500 bg-slate-900 shadow-[0_0_40px_rgba(249,115,22,0.4)]'
                    : 'border-slate-700 bg-slate-900 shadow-[0_0_30px_rgba(6,182,212,0.2)]'}
            `}>
                <div className={`
                    text-[5rem] md:text-[10rem] font-black font-mono tracking-tighter transition-all duration-100
                    ${phase === 'REVEAL' ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]' : 'text-cyan-400/50'}
                `}>
                    {displayNum}
                </div>
            </div>
        </div>

        <div className="mt-12 h-auto min-h-[10rem] flex flex-col items-center justify-center z-[1200]">
          {phase === 'REVEAL' ? (
            <div className="animate-reveal-slam-intense flex flex-col items-center">
              <button 
                onClick={onClose}
                className="group relative px-12 py-4 md:px-16 md:py-5 rounded-full overflow-hidden transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(251,191,36,0.3)] bg-amber-400 border-4 border-white"
              >
                <span className="relative z-10 text-slate-950 font-black text-xl md:text-2xl tracking-widest">CONTINUE</span>
                <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-200"></div>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
                <div className="text-white/50 text-xs font-mono uppercase tracking-[0.4em] animate-pulse">
                    GENERATING SECURE ENTROPY
                </div>
                <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
                    {Math.round(intensity * 100)}% COMPLETE
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultRevealOverlay;
