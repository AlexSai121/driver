import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

type Task = {
      id: string | number;
      title: string;
      types: string[];
      completed: boolean;
      dueDate?: string;
      scheduleDate?: string;
};

type CalendarViewProps = {
      tasks: Task[];
      dates: string[];
      activeIndex: number;
      onAddTask: (date: string) => void;
      onViewMore?: (dateStr: string) => void;
};

// Stagger animation variants for date entries
const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
            opacity: 1,
            transition: {
                  staggerChildren: 0.08,
                  delayChildren: 0.05,
            },
      },
      exit: {
            opacity: 0,
            transition: { staggerChildren: 0.04, staggerDirection: -1 },
      },
};

const dateItemVariants = {
      hidden: { opacity: 0, x: -20, filter: 'blur(4px)' },
      visible: {
            opacity: 1,
            x: 0,
            filter: 'blur(0px)',
            transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
      },
      exit: {
            opacity: 0,
            x: 20,
            filter: 'blur(4px)',
            transition: { duration: 0.15 },
      },
};

function CalendarViewInner({ tasks, dates, activeIndex, onAddTask, onViewMore }: CalendarViewProps) {
      // Show 5 days starting from activeIndex
      const visibleDates = [];
      for (let i = 0; i < 5; i++) {
            const idx = (activeIndex + i) % Math.max(1, dates.length);
            visibleDates.push(dates[idx]);
      }

      // Derive month from the first visible date (e.g. "MAR 15")
      const firstDate = visibleDates[0] || '';
      const month = firstDate.split(' ')[0] || '';

      return (
            <motion.div
                  key="calendar-view"
                  layout
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  className="font-plex w-full flex flex-col pb-32 pointer-events-auto"
            >
                  <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-bold uppercase tracking-widest text-secondary font-nothing">
                              WEEK OF {new Date().getFullYear()} {month}
                        </h2>
                  </div>

                  <div className="flex-1 relative pr-6 mr-6 h-full">
                        <AnimatePresence mode="wait">
                              <motion.div
                                    key={`dates-${activeIndex}`}
                                    className="space-y-8"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                              >
                                    {visibleDates.map((dateStr) => {
                                          const dayStr = dateStr.split(' ')[1] || dateStr;
                                          const dayTasks = tasks.filter(t => (t.scheduleDate || t.dueDate || '').toUpperCase() === dateStr.toUpperCase());

                                          return (
                                                <motion.div
                                                      key={dateStr}
                                                      className="flex flex-col"
                                                      variants={dateItemVariants}
                                                >
                                                      <div className="text-center font-bold text-lg text-secondary border-b-[1px] border-secondary/30 w-1/3 mx-auto mb-3">
                                                            {dayStr}
                                                      </div>
                                                      <div className="flex flex-col gap-1.5 ml-8">
                                                            {dayTasks.slice(0, 2).map(t => (
                                                                  <motion.span
                                                                        key={t.id}
                                                                        initial={{ opacity: 0, y: 4 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        transition={{ duration: 0.2 }}
                                                                        className={`text-sm tracking-widest uppercase truncate ${t.completed ? 'text-gray-500 line-through' : 'text-secondary'}`}
                                                                  >
                                                                        - {t.title}
                                                                  </motion.span>
                                                            ))}
                                                            {dayTasks.length === 0 && (
                                                                  <span className="text-xs text-gray-600 italic ml-2">- No tasks</span>
                                                            )}
                                                            {dayTasks.length > 2 && (
                                                                  <span
                                                                        className="text-xs text-secondary font-bold mt-1 ml-2 uppercase opacity-60 cursor-pointer hover:opacity-100 transition-opacity active:scale-95"
                                                                        onClick={() => onViewMore?.(dateStr)}
                                                                  >
                                                                        + view more
                                                                  </span>
                                                            )}
                                                      </div>
                                                </motion.div>
                                          );
                                    })}
                              </motion.div>
                        </AnimatePresence>
                  </div>

                  <div className="mt-12 flex justify-center w-full">
                        <button
                              onClick={() => onAddTask(firstDate)}
                              className="w-[90%] border border-secondary rounded-[20px] py-4 flex items-center justify-center gap-2 hover:bg-secondary/10 transition-colors uppercase tracking-widest font-bold text-sm text-secondary bg-transparent active:scale-95"
                        >
                              <Plus className="w-5 h-5 stroke-[3]" /> Add Task
                        </button>
                  </div>
            </motion.div>
      );
}

export const CalendarView = memo(CalendarViewInner);
