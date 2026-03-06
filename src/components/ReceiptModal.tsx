import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Task = {
      id: string | number;
      title: string;
      types: string[];
      completed: boolean;
      dueDate?: string;
      scheduleDate?: string;
};

type Transaction = {
      id: string | number;
      title?: string;
      paymentMethod?: string;
      amount: number;
      type: 'income' | 'expense';
      category: string;
      note: string;
      date: string;
};

type ReceiptModalProps = {
      isOpen: boolean;
      onClose: () => void;
      tasks: Task[];
      transactions: Transaction[];
};

function ReceiptModalInner({ isOpen, onClose, tasks, transactions }: ReceiptModalProps) {
      // Calculate the current week range (Mon–Sun)
      const weekRange = useMemo(() => {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(now);
            monday.setDate(now.getDate() + mondayOffset);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);

            const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
            return {
                  start: monday,
                  end: sunday,
                  label: `${fmt(monday)} — ${fmt(sunday)}, ${now.getFullYear()}`
            };
      }, []);

      // Filter tasks for this week
      const weekTasks = useMemo(() => {
            return tasks.filter(t => {
                  const dateStr = t.scheduleDate || t.dueDate;
                  if (!dateStr) return false;
                  // Parse "MAR 5" format
                  const parsed = new Date(`${dateStr}, ${new Date().getFullYear()}`);
                  return parsed >= weekRange.start && parsed <= weekRange.end;
            });
      }, [tasks, weekRange]);

      const completedCount = weekTasks.filter(t => t.completed).length;
      const totalCount = weekTasks.length;
      const productivity = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      // Filter transactions for this week
      const weekTransactions = useMemo(() => {
            return transactions.filter(tx => {
                  const txDate = new Date(tx.date);
                  return txDate >= weekRange.start && txDate <= weekRange.end;
            });
      }, [transactions, weekRange]);

      const totalIncome = weekTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = weekTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const netAmount = totalIncome - totalExpenses;

      // Generate productivity bar
      const prodBar = useMemo(() => {
            const filled = Math.round(productivity / 10);
            const empty = 10 - filled;
            return '█'.repeat(filled) + '░'.repeat(empty);
      }, [productivity]);

      // Diagnostic status
      const sysStatus = useMemo(() => {
            if (productivity >= 80) return 'OPTIMAL';
            if (productivity >= 60) return 'NOMINAL';
            if (productivity >= 40) return 'SUBOPTIMAL';
            if (productivity >= 20) return 'DEGRADED';
            return 'CRITICAL';
      }, [productivity]);

      return (
            <AnimatePresence>
                  {isOpen && (
                        <>
                              {/* Backdrop */}
                              <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                                    onClick={onClose}
                              />

                              {/* Printer Housing */}
                              <div className="fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col items-center justify-end pointer-events-none overflow-hidden">
                                    {/* Done button */}
                                    <motion.button
                                          initial={{ opacity: 0, y: -20 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, y: -20 }}
                                          transition={{ delay: 0.5 }}
                                          onClick={onClose}
                                          className="absolute top-12 right-6 z-60 text-xs font-bold uppercase tracking-widest text-secondary bg-secondary/10 border border-secondary/20 px-5 py-2 rounded-full pointer-events-auto cursor-pointer active:scale-95 backdrop-blur-md"
                                    >
                                          Done
                                    </motion.button>

                                    {/* Printer slot bar */}
                                    <div className="w-full flex justify-center pointer-events-none absolute bottom-16">
                                          <div className="printer-slot w-[85%] max-w-[340px]" />
                                    </div>

                                    {/* Receipt Paper */}
                                    <motion.div
                                          initial={{ y: '100%' }}
                                          animate={{ y: 0 }}
                                          exit={{ y: '100%' }}
                                          transition={{
                                                type: 'spring',
                                                damping: 25,
                                                stiffness: 80,
                                                mass: 1.2,
                                          }}
                                          className="receipt-paper w-[85%] max-w-[340px] pointer-events-auto overflow-y-auto max-h-[80vh] mb-20"
                                    >
                                          <div className="p-6 pb-10">
                                                {/* Header */}
                                                <pre className="receipt-text text-center leading-relaxed">
                                                      {`================================
  DAILY DRIVER // WEEKLY LOG
  ${weekRange.label}
================================`}
                                                </pre>

                                                {/* Tasks Section */}
                                                <pre className="receipt-text mt-6 leading-loose">
                                                      {`[ TASKS COMPLETED ]`}
                                                </pre>
                                                <div className="mt-1">
                                                      {weekTasks.length > 0 ? (
                                                            weekTasks.map(t => (
                                                                  <pre key={t.id} className="receipt-text leading-relaxed truncate">
                                                                        {`${t.completed ? '✓' : '✗'} ${t.title.toUpperCase()}`}
                                                                  </pre>
                                                            ))
                                                      ) : (
                                                            <pre className="receipt-text leading-relaxed opacity-50">
                                                                  {`  (NO TASKS THIS WEEK)`}
                                                            </pre>
                                                      )}
                                                </div>
                                                <pre className="receipt-text mt-2 leading-relaxed">
                                                      {`──────────────────────────────
 ${String(totalCount).padStart(2)} TOTAL | ${String(completedCount).padStart(2)} DONE | ${String(productivity).padStart(3)}%`}
                                                </pre>

                                                {/* Finance Section */}
                                                <pre className="receipt-text mt-6 leading-loose">
                                                      {`[ FUNDS LOGGED ]`}
                                                </pre>
                                                <pre className="receipt-text mt-1 leading-relaxed">
                                                      {`+ $${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}  INCOME
- $${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}  EXPENSES
──────────────────────────────
NET: ${netAmount >= 0 ? '+' : ''}$${netAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                                </pre>

                                                {/* Diagnostic Footer */}
                                                <pre className="receipt-text mt-6 leading-relaxed text-center">
                                                      {`================================
SYS DIAGNOSTIC: ${sysStatus}
PRODUCTIVITY: ${prodBar} ${productivity}%
================================`}
                                                </pre>

                                                {/* Timestamp */}
                                                <pre className="receipt-text mt-4 text-center opacity-40 text-[8px]">
                                                      {`PRINTED ${new Date().toLocaleString('en-US', {
                                                            month: 'short', day: 'numeric', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                      }).toUpperCase()}`}
                                                </pre>
                                          </div>

                                          {/* Jagged bottom edge */}
                                          <div className="receipt-edge" />
                                    </motion.div>
                              </div>
                        </>
                  )}
            </AnimatePresence>
      );
}

export const ReceiptModal = memo(ReceiptModalInner);
