import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SetupScreenProps {
      onComplete: (name: string, balance: number) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
      const [name, setName] = useState('');
      const [balanceStr, setBalanceStr] = useState('');

      const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const trimmedName = name.trim();
            const balanceNum = parseFloat(balanceStr);

            if (trimmedName && !isNaN(balanceNum)) {
                  onComplete(trimmedName, balanceNum);
            }
      };

      return (
            <AnimatePresence>
                  <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-[var(--bg-hardware)] flex flex-col items-center justify-center p-6 font-plex text-secondary overflow-hidden"
                  >
                        {/* Visual Flair Background */}
                        <div className="absolute inset-0 pointer-events-none opacity-20"
                              style={{
                                    backgroundImage: 'radial-gradient(circle at center, var(--secondary-color) 1px, transparent 1.5px)',
                                    backgroundSize: '24px 24px'
                              }}
                        />

                        <motion.div
                              initial={{ scale: 0.9, y: 20, opacity: 0 }}
                              animate={{ scale: 1, y: 0, opacity: 1 }}
                              transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.2 }}
                              className="w-full max-w-sm relative z-10"
                        >
                              <div className="text-center mb-12">
                                    <h1 className="text-4xl font-nothing tracking-widest uppercase mb-2">Initialize</h1>
                                    <p className="text-xs uppercase tracking-widest text-gray-400 font-sans">Setup your operating profile</p>
                              </div>

                              <form onSubmit={handleSubmit} className="space-y-8 hardware-panel p-8 rounded-3xl border border-[var(--inset-border)] shadow-2xl">

                                    {/* Name Input */}
                                    <div>
                                          <label className="block text-xs uppercase font-bold tracking-widest mb-3 text-gray-400 font-sans">Operator ID</label>
                                          <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="YOUR NAME"
                                                maxLength={20}
                                                className="w-full bg-transparent border-b-2 border-secondary/30 focus:border-secondary py-2 text-xl font-bold uppercase tracking-widest outline-none transition-colors placeholder:text-gray-700"
                                                required
                                          />
                                    </div>

                                    {/* Starting Balance Input */}
                                    <div>
                                          <label className="block text-xs uppercase font-bold tracking-widest mb-3 text-gray-400 font-sans">Initial Capital</label>
                                          <div className="flex items-baseline border-b-2 border-secondary/30 focus-within:border-secondary transition-colors">
                                                <span className="text-2xl font-mono text-gray-500 mr-2">$</span>
                                                <input
                                                      type="number"
                                                      step="0.01"
                                                      value={balanceStr}
                                                      onChange={(e) => setBalanceStr(e.target.value)}
                                                      placeholder="0.00"
                                                      className="w-full bg-transparent py-2 text-3xl font-mono font-bold tracking-tighter outline-none placeholder:text-gray-700"
                                                      required
                                                />
                                          </div>
                                          <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-wide font-sans">Current standing account balance.</p>
                                    </div>

                                    <div className="pt-6">
                                          <button
                                                type="submit"
                                                disabled={!name.trim() || isNaN(parseFloat(balanceStr))}
                                                className="w-full hardware-btn bg-secondary text-primary py-4 rounded-xl font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50 disabled:pointer-events-none"
                                          >
                                                Commencing Sequence
                                          </button>
                                    </div>
                                    <p className="text-center text-[10px] text-gray-500 mt-6 uppercase tracking-widest font-sans">
                                          Instructions on how to use the app are available in Settings {'>'} Help
                                    </p>
                              </form>
                        </motion.div>
                  </motion.div>
            </AnimatePresence>
      );
}
