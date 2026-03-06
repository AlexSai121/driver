import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type Transaction = {
      id: string | number;
      title?: string;
      paymentMethod?: string;
      amount: number;
      type: 'income' | 'expense';
      category: string;
      note: string;
      date: string;
};

type FinanceViewProps = {
      transactions: Transaction[];
      selectedChartMonth: number;
      selectedChartYear: number;
      startingBalance: number;
      setIsChartSettingsOpen: (open: boolean) => void;
      setSelectedTransaction: (tx: Transaction | null) => void;
      setIsTransactionsModalOpen: (open: boolean) => void;
};

function FinanceViewInner({
      transactions,
      selectedChartMonth,
      selectedChartYear,
      startingBalance,
      setIsChartSettingsOpen,
      setSelectedTransaction,
      setIsTransactionsModalOpen,
}: FinanceViewProps) {
      const monthTx = transactions.filter((t) => {
            const d = new Date(t.date);
            return d.getMonth() === selectedChartMonth && d.getFullYear() === selectedChartYear;
      });
      const incomeTotal = monthTx.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0);
      const expenseTotal = monthTx.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
      const maxVal = Math.max(incomeTotal, expenseTotal, 500); // Scale relative to largest or 500 minimum
      const incomePct = (incomeTotal / maxVal) * 100;
      const expensePct = (expenseTotal / maxVal) * 100;
      const expenseBudget = 1000;
      const overBudget = expenseTotal > expenseBudget;

      return (
            <motion.div
                  key="finance-view"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.3 }}
                  className="font-plex space-y-8 pb-32 pointer-events-auto"
            >
                  {/* Top HUD */}
                  <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                              <span className="text-sm font-nothing tracking-widest text-secondary">Available:</span>
                              <motion.span
                                    key={`${startingBalance}-${incomeTotal}-${expenseTotal}`}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-3xl font-nothing tracking-wider text-secondary mt-1"
                              >
                                    ${(startingBalance + incomeTotal - expenseTotal).toFixed(0)}
                              </motion.span>
                        </div>
                  </div>

                  {/* Finance View Rendering - simplified to just show bars and transactions */}
                  <div className="flex flex-col gap-8">
                        {/* Income / Expense Bars */}
                        <div className="w-[70%]">
                              <div className="flex gap-8">
                                    <div className="flex flex-col items-center flex-1">
                                          <span className="font-nothing text-[10px] uppercase tracking-widest mb-2 text-secondary">
                                                INCOME
                                          </span>
                                          <div className="w-full h-24 border border-[var(--btn-inner-border)] rounded-sm relative overflow-hidden bg-[var(--inset-bg)] shadow-[var(--inset-shadow)]">
                                                <motion.div
                                                      initial={{ height: 0 }}
                                                      animate={{ height: `${incomePct}%` }}
                                                      transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                                                      className="absolute bottom-0 w-full border-t border-[var(--quaternary-color)]"
                                                      style={{
                                                            background: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(78,104,81,0.2) 4px, rgba(78,104,81,0.2) 6px)`,
                                                      }}
                                                />
                                                <span className="absolute left-2 top-2 text-[10px] font-mono font-bold text-secondary">
                                                      ${incomeTotal.toFixed(0)}
                                                </span>
                                          </div>
                                    </div>

                                    <div className="flex flex-col items-center flex-1">
                                          <div className="flex items-center gap-1 mb-2">
                                                {overBudget && (
                                                      <div className="w-1.5 h-1.5 led-glow-red rounded-full animate-pulse mr-1"></div>
                                                )}
                                                <span className="font-nothing text-[10px] uppercase tracking-widest text-secondary">
                                                      Expense
                                                </span>
                                          </div>
                                          <div className="w-full h-24 border border-[var(--btn-inner-border)] rounded-sm relative overflow-hidden bg-[var(--inset-bg)] shadow-[var(--inset-shadow)]">
                                                <motion.div
                                                      initial={{ height: 0 }}
                                                      animate={{ height: `${expensePct}%` }}
                                                      transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                                                      className="absolute bottom-0 w-full border-t border-[var(--tertiary-color)]"
                                                      style={{
                                                            background: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(184,58,45,0.2) 4px, rgba(184,58,45,0.2) 6px)`,
                                                      }}
                                                />
                                                <span className="absolute left-2 top-2 text-[10px] font-mono font-bold text-secondary">
                                                      ${expenseTotal.toFixed(0)}
                                                </span>
                                          </div>
                                    </div>
                              </div>
                        </div>

                        <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-2">
                                          {new Date(0, selectedChartMonth).toLocaleString('default', { month: 'long' })} Logs
                                    </span>
                                    <button
                                          className="flex border border-[var(--inset-border)] items-center px-3 py-1 rounded-full cursor-pointer hover:bg-[var(--inset-bg)] transition-colors text-secondary/60 text-[8px] uppercase tracking-widest font-mono font-bold"
                                          onClick={() => setIsChartSettingsOpen(true)}
                                    >
                                          Settings
                                    </button>
                              </div>

                              <AnimatePresence>
                                    {(() => {
                                          if (monthTx.length === 0) {
                                                return (
                                                      <p className="text-sm text-gray-500 italic mt-4 text-center uppercase tracking-widest font-sans font-bold">
                                                            No activity.
                                                      </p>
                                                );
                                          }

                                          const sortedTx = [...monthTx].sort(
                                                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                                          );

                                          return sortedTx.slice(0, 5).map((tx) => (
                                                <motion.div
                                                      layout
                                                      key={tx.id}
                                                      onClick={() => setSelectedTransaction(tx)}
                                                      className="flex items-center justify-between py-3 px-2 border-b border-[var(--inset-border)] cursor-pointer active:scale-95 transition-transform"
                                                >
                                                      <div className="flex flex-col">
                                                            <span className="font-bold text-secondary text-sm font-plex tracking-wider">
                                                                  {tx.title || tx.category}
                                                            </span>
                                                            <span className="text-[8px] text-gray-400 uppercase tracking-[0.2em]">
                                                                  {new Date(tx.date).toLocaleDateString('en-US', {
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                  })}
                                                            </span>
                                                      </div>
                                                      <span
                                                            className={`font-mono text-sm font-bold tracking-tighter ${tx.type === 'income' ? 'text-quaternary' : 'text-secondary'
                                                                  }`}
                                                      >
                                                            {tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toFixed(0)}
                                                      </span>
                                                </motion.div>
                                          ));
                                    })()}
                              </AnimatePresence>

                              <button
                                    onClick={() => setIsTransactionsModalOpen(true)}
                                    className="mt-4 text-[10px] text-secondary/40 font-bold uppercase tracking-widest hover:text-secondary transition-colors"
                              >
                                    See All &gt;
                              </button>
                        </div>
                  </div>
            </motion.div>
      );
}

export const FinanceView = memo(FinanceViewInner);
