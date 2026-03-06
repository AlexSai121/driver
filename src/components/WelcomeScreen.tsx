import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer2, Layout, CheckSquare, Printer, ChevronRight, User } from 'lucide-react';

interface WelcomeScreenProps {
      onComplete: (name: string, balance: number) => void;
}

const slides = [
      {
            id: 'welcome',
            title: 'Daily Driver',
            subtitle: 'v2.0 OPERATING SYSTEM',
            description: 'Welcome to your new mechanical workspace. Designed for flow, refined for focus.',
            icon: <Layout className="w-12 h-12 text-tertiary" />,
            color: 'text-tertiary'
      },
      {
            id: 'navigation',
            title: 'Mechanical Input',
            subtitle: 'GEAR-BASED NAVIGATION',
            description: 'Drag the OUTER WHEEL to scroll through dates. Drag the INNER WHEEL to switch between modes.',
            icon: <MousePointer2 className="w-12 h-12 text-secondary" />,
            color: 'text-secondary'
      },
      {
            id: 'productivity',
            title: 'Deep Work',
            subtitle: 'TASKS & FINANCE',
            description: 'Swipe tasks LEFT to edit, RIGHT to complete. Log your capital in the Finance deck to track your standing.',
            icon: <CheckSquare className="w-12 h-12 text-quaternary" />,
            color: 'text-quaternary'
      },
      {
            id: 'utilities',
            title: 'Hardware Tools',
            subtitle: 'CALENDAR & REVIEW',
            description: 'Get a 5-day forecast in Calendar. Print your weekly summary receipt in the Review module.',
            icon: <Printer className="w-12 h-12 text-secondary" />,
            color: 'text-secondary'
      },
      {
            id: 'setup',
            title: 'Initialize',
            subtitle: 'OPERATOR IDENTITY',
            description: 'Setup your operating profile to begin the sequence.',
            icon: <User className="w-12 h-12 text-tertiary" />,
            color: 'text-tertiary'
      }
];

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
      const [currentSlide, setCurrentSlide] = useState(0);
      const [name, setName] = useState('');
      const [balanceStr, setBalanceStr] = useState('');

      const nextSlide = () => {
            if (currentSlide < slides.length - 1) {
                  setCurrentSlide(prev => prev + 1);
            }
      };

      const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const trimmedName = name.trim();
            const balanceNum = parseFloat(balanceStr);

            if (trimmedName && !isNaN(balanceNum)) {
                  onComplete(trimmedName, balanceNum);
            }
      };

      return (
            <AnimatePresence mode="wait">
                  <motion.div
                        key="welcome-container"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-[var(--bg-hardware)] flex flex-col items-center justify-center p-6 font-plex text-secondary overflow-hidden"
                  >
                        {/* Grid Background */}
                        <div className="absolute inset-0 pointer-events-none opacity-10"
                              style={{
                                    backgroundImage: 'linear-gradient(var(--secondary-color) 1px, transparent 1px), linear-gradient(90deg, var(--secondary-color) 1px, transparent 1px)',
                                    backgroundSize: '40px 40px'
                                    // backgroundImage: 'radial-gradient(circle at center, var(--secondary-color) 1px, transparent 1.5px)',
                                    // backgroundSize: '32px 32px'
                              }}
                        />

                        <motion.div
                              className="w-full max-w-sm relative z-10 flex flex-col h-full max-h-[600px]"
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                        >
                              <div className="flex-1 flex flex-col justify-center">
                                    <AnimatePresence mode="wait">
                                          <motion.div
                                                key={currentSlide}
                                                initial={{ x: 20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                exit={{ x: -20, opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className="flex flex-col items-center text-center"
                                          >
                                                <div className="mb-8 p-6 rounded-3xl bg-secondary/5 border border-secondary/10 shadow-inner">
                                                      {slides[currentSlide].icon}
                                                </div>

                                                <h1 className="text-4xl font-nothing tracking-widest uppercase mb-1 drop-shadow-sm">
                                                      {slides[currentSlide].title}
                                                </h1>
                                                <p className={`text-[10px] font-bold tracking-[0.3em] uppercase mb-6 ${slides[currentSlide].color}`}>
                                                      {slides[currentSlide].subtitle}
                                                </p>

                                                {currentSlide < slides.length - 1 ? (
                                                      <p className="text-sm text-gray-400 font-sans leading-relaxed px-4 normal-case">
                                                            {slides[currentSlide].description}
                                                      </p>
                                                ) : (
                                                      <form onSubmit={handleSubmit} className="w-full space-y-6 mt-4 hardware-panel p-6 rounded-2xl border border-[var(--inset-border)] shadow-xl">
                                                            <div className="text-left">
                                                                  <label className="block text-[9px] uppercase font-bold tracking-widest mb-2 text-gray-500 font-sans">Operator ID</label>
                                                                  <input
                                                                        type="text"
                                                                        value={name}
                                                                        onChange={(e) => setName(e.target.value)}
                                                                        placeholder="YOUR NAME"
                                                                        maxLength={20}
                                                                        className="w-full bg-transparent border-b border-secondary/30 focus:border-secondary py-2 text-lg font-bold uppercase tracking-widest outline-none transition-colors placeholder:text-gray-700"
                                                                        required
                                                                  />
                                                            </div>

                                                            <div className="text-left">
                                                                  <label className="block text-[9px] uppercase font-bold tracking-widest mb-2 text-gray-500 font-sans">Initial Capital</label>
                                                                  <div className="flex items-baseline border-b border-secondary/30 focus-within:border-secondary transition-colors">
                                                                        <span className="text-lg font-mono text-gray-500 mr-2">$</span>
                                                                        <input
                                                                              type="number"
                                                                              step="0.01"
                                                                              value={balanceStr}
                                                                              onChange={(e) => setBalanceStr(e.target.value)}
                                                                              placeholder="0.00"
                                                                              className="w-full bg-transparent py-2 text-2xl font-mono font-bold tracking-tighter outline-none placeholder:text-gray-700"
                                                                              required
                                                                        />
                                                                  </div>
                                                            </div>

                                                            <button
                                                                  type="submit"
                                                                  disabled={!name.trim() || isNaN(parseFloat(balanceStr))}
                                                                  className="w-full hardware-btn bg-secondary text-primary py-4 rounded-xl font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50"
                                                            >
                                                                  Begin Operation
                                                            </button>
                                                      </form>
                                                )}
                                          </motion.div>
                                    </AnimatePresence>
                              </div>

                              {/* Progress Dots */}
                              <div className="flex justify-center gap-2 mb-12">
                                    {slides.map((_, i) => (
                                          <div
                                                key={i}
                                                className={`h-1 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-secondary' : 'w-2 bg-secondary/20'}`}
                                          />
                                    ))}
                              </div>

                              {/* Footer Button */}
                              {currentSlide < slides.length - 1 && (
                                    <div className="mb-8">
                                          <button
                                                onClick={nextSlide}
                                                className="w-full h-16 rounded-2xl border-2 border-secondary/20 flex items-center justify-between px-8 hover:bg-secondary/5 active:scale-95 transition-all group"
                                          >
                                                <span className="text-xs font-bold uppercase tracking-[0.2em]">Next Protocol</span>
                                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                          </button>
                                    </div>
                              )}
                        </motion.div>
                  </motion.div>
            </AnimatePresence>
      );
}
