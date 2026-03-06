import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Plus, Calendar, ChevronLeft, ChevronRight, Printer, Volume2, VolumeX, Settings } from 'lucide-react';
import { motion, useMotionValue, animate, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import { audioEngine } from './utils/audioEngine';
import { localDb } from './db/localDb';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock } from './components/Clock';
import { EncryptedText } from './components/EncryptedText';
import { addTransaction } from './services/db';
import type { Task } from './components/TasksView';
import type { Transaction } from './components/FinanceView';

// Performance: Code-splitting with React.lazy
const TasksView = lazy(() => import('./components/TasksView').then(m => ({ default: m.TasksView })));
const FinanceView = lazy(() => import('./components/FinanceView').then(m => ({ default: m.FinanceView })));
const CalendarView = lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const ReceiptView = lazy(() => import('./components/ReceiptView').then(m => ({ default: m.ReceiptView })));
const ReceiptModal = lazy(() => import('./components/ReceiptModal').then(m => ({ default: m.ReceiptModal })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const WelcomeScreen = lazy(() => import('./components/WelcomeScreen').then(m => ({ default: m.WelcomeScreen })));

// Security: Input sanitization utility
const sanitizeInput = (value: string, maxLength = 200): string => {
  return value
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control characters
    .slice(0, maxLength)
    .trim();
};



// Also generate a smaller set for the due date/schedule wheels (current day + 14 days)
const getUpcomingDates = () => {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < 15; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const monthShort = d.toLocaleString('default', { month: 'short' });
    dates.push(`${monthShort} ${d.getDate()}`);
  }
  return dates;
};

// Mock Tasks Data
const initialTasks: Task[] = [
  { id: 'mock-1', title: 'Plan Weekly Review', types: ['Work'], completed: false, scheduleDate: getUpcomingDates()[0] },
  { id: 'mock-2', title: 'Team Sync', types: ['Work'], completed: false, scheduleDate: getUpcomingDates()[0] },
  { id: 'mock-3', title: 'Buy Groceries', types: ['Routine'], completed: true, scheduleDate: getUpcomingDates()[0] },
  { id: 'mock-4', title: 'Study React', types: ['School'], completed: false, scheduleDate: getUpcomingDates()[1] },
];

// Generate all dates for a specific month and year
const getMonthDates = (year: number, month: number) => {
  const dates = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateObj = new Date(year, month, 1);
  const monthShort = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();

  for (let i = 1; i <= daysInMonth; i++) {
    dates.push(`${monthShort} ${i}`);
  }
  return dates;
};

function App() {
  const [themeName, setThemeName] = useState(() => localStorage.getItem('appTheme') || 'theme-dark');
  const handleThemeChange = (newTheme: string) => {
    setThemeName(newTheme);
    localStorage.setItem('appTheme', newTheme);
  };

  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  // General app state
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isChartSettingsOpen, setIsChartSettingsOpen] = useState(false);
  const [isDateTxListOpen, setIsDateTxListOpen] = useState(false);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [use24h, setUse24h] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [hiddenPages, setHiddenPages] = useState<string[]>([]);
  const [selectedTxDate, setSelectedTxDate] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState(1000);
  const [selectedChartMonth, setSelectedChartMonth] = useState(new Date().getMonth());
  const [selectedChartYear, setSelectedChartYear] = useState(new Date().getFullYear());

  // Setup State
  const [isSetupComplete, setIsSetupComplete] = useState(() => {
    return localStorage.getItem('appSetupComplete') === 'true';
  });
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('appUserName') || '';
  });
  const [startingBalance, setStartingBalance] = useState(() => {
    return Number(localStorage.getItem('appStartingBalance')) || 0;
  });

  const handleSetupComplete = (name: string, balance: number) => {
    setUserName(name);
    setStartingBalance(balance);
    setIsSetupComplete(true);
    localStorage.setItem('appUserName', name);
    localStorage.setItem('appStartingBalance', balance.toString());
    localStorage.setItem('appSetupComplete', 'true');
  };

  // Clock is extracted to /src/components/Clock.tsx

  const [selectedMode, setSelectedMode] = useState('TASKS');

  // Dexie Live Queries for automatic reactive updates
  const tasks = useLiveQuery(() => localDb.tasks.toArray()) || initialTasks;
  const transactions = useLiveQuery(() => localDb.transactions.orderBy('date').reverse().toArray()) || [];

  const [propertiesModalTask, setPropertiesModalTask] = useState<Task | null>(null);
  const [propertiesExitDir, setPropertiesExitDir] = useState<'left' | 'right'>('right');


  // Outer wheel rotation
  const outerRotate = useMotionValue(0);
  const [isWheelScrolling, setIsWheelScrolling] = useState(false);
  const lastVibratedOuter = useRef(0);

  const [activeOuterIndex, setActiveOuterIndex] = useState(0);
  const modes = useMemo(() => {
    return ['CALENDAR', 'TASKS', 'FINANCE', 'REVIEW'].filter(mode => mode === 'TASKS' || !hiddenPages.includes(mode));
  }, [hiddenPages]);
  const genericDates = useMemo(() => getMonthDates(selectedChartYear, selectedChartMonth), [selectedChartYear, selectedChartMonth]);
  const outerOptions = genericDates;
  const frontWheelDates = useMemo(() => getUpcomingDates(), []);


  const outerOptionsRef = useRef(outerOptions);
  outerOptionsRef.current = outerOptions;



  // Update outerOptions when month or year changes or mode changes
  // Not strictly needed as a side-effect now since outerOptions is derived directly from state,
  // but we leave this effect empty or remove it. For safety we just let standard React re-renders handle it.

  // Track velocity to trigger text fade and haptic ticks
  useMotionValueEvent(outerRotate, "change", (latest) => {
    // Velocity tracking for fading
    const velocity = outerRotate.getVelocity();
    if (Math.abs(velocity) > 10) {
      if (!isWheelScrolling) setIsWheelScrolling(true);
    } else {
      if (isWheelScrolling) setIsWheelScrolling(false);
    }

    // Update active index based on rotation angle (direct mapping)
    const segment = 360 / Math.max(1, outerOptionsRef.current.length);
    let activeIdx = Math.round(-latest / segment) % Math.max(1, outerOptionsRef.current.length);
    if (activeIdx < 0) activeIdx += Math.max(1, outerOptionsRef.current.length);
    if (activeIdx !== activeOuterIndex) setActiveOuterIndex(activeIdx);

    // Haptic tick (every 10 degrees)
    const tick = Math.floor(latest / 10);
    if (tick !== lastVibratedOuter.current) {
      if (typeof navigator !== 'undefined' && navigator.vibrate && hapticEnabled) {
        navigator.vibrate(10);
      }
      audioEngine.tickClick();
      lastVibratedOuter.current = tick;
    }
  });

  // Inner wheel rotation
  const innerRotate = useMotionValue(0);
  const lastVibratedInner = useRef(0);

  useMotionValueEvent(innerRotate, "change", (latest) => {
    const tick = Math.floor(latest / (360 / modes.length));
    if (tick !== lastVibratedInner.current) {
      if (typeof navigator !== 'undefined' && navigator.vibrate && hapticEnabled) {
        navigator.vibrate(12);
      }
      audioEngine.tickClick();
      lastVibratedInner.current = tick;
    }
  });

  // Add Task State
  const [newTaskName, setNewTaskName] = useState('');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const today = new Date();
    return `${today.toLocaleString('default', { month: 'short' }).toUpperCase()} ${today.getDate()}`;
  });
  const [dueDate, setDueDate] = useState(() => {
    const today = new Date();
    return `${today.toLocaleString('default', { month: 'short' }).toUpperCase()} ${today.getDate()}`;
  });
  const [selectedType, setSelectedType] = useState('School');
  const [taskTypes, setTaskTypes] = useState(['School', 'Work', 'Routine']);
  const [newTypeInput, setNewTypeInput] = useState('');

  // Add Transaction State
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txCategory, setTxCategory] = useState('Food');
  const [txPaymentMethod, setTxPaymentMethod] = useState('Apple Pay');
  const [txNote, setTxNote] = useState('');
  const [txDateStr, setTxDateStr] = useState(() => new Date().toISOString().split('T')[0]);

  // Customizable lists
  const [paymentMethods, setPaymentMethods] = useState(['Apple Pay', 'Cash', 'Credit Card', 'Bank Transfer']);
  const [categoriesList, setCategoriesList] = useState(['Food', 'Rent', 'Salary', 'Shopping', 'Fitness', 'Education', 'Investments', 'Health']);

  const [newCatInput, setNewCatInput] = useState('');
  const [newPmInput, setNewPmInput] = useState('');
  const [isEditingPaymentMethods, setIsEditingPaymentMethods] = useState(false);
  const [isEditingCategories, setIsEditingCategories] = useState(false);

  // No longer needed: Dexie useLiveQuery handles data sync automatically
  useEffect(() => {
    // We can still use this to initialize the DB with mock data if empty
    const initDb = async () => {
      const count = await localDb.tasks.count();
      if (count === 0) {
        await localDb.tasks.bulkAdd(initialTasks);
      }
    };
    initDb();
  }, []);

  const handleTaskComplete = useCallback(async (id: string | number) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
    audioEngine.taskSnap();
    await localDb.tasks.update(id, { completed: !target.completed });
  }, [tasks]);

  const handleTaskProperties = useCallback((task: Task) => {
    // Since tasks is reactive via useLiveQuery, find the latest version
    const latest = tasks.find(t => t.id === task.id);
    if (latest) setPropertiesModalTask({ ...latest });
  }, [tasks]);

  // Header Titles
  const currentTitle = useMemo(() => {
    if (selectedMode === 'TASKS') return `${outerOptions[activeOuterIndex]} TASKS`;
    if (selectedMode === 'FINANCE') return 'FINANCE';
    if (selectedMode === 'CALENDAR') return 'CALENDAR';
    if (selectedMode === 'REVIEW') return '';
    if (selectedMode === 'TOOLS') return 'TOOLS';
    return selectedMode;
  }, [selectedMode, outerOptions, activeOuterIndex]);

  const handleToggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    audioEngine.setMuted(next);
  }, [isMuted]);

  const handleAddTask = useCallback(async () => {
    const safeName = sanitizeInput(newTaskName, 100);
    if (safeName) {
      const newTask = {
        title: safeName,
        types: [selectedType],
        completed: false,
        dueDate: dueDate,
        scheduleDate: scheduleDate
      };

      await localDb.tasks.add(newTask as Task);
      setIsAddTaskOpen(false);
      setNewTaskName('');
    }
  }, [newTaskName, selectedType, dueDate, scheduleDate]);

  // Stacked Type Selector Helper
  const orderedTypes = useMemo(() => [selectedType, ...taskTypes.filter(t => t !== selectedType)], [selectedType, taskTypes]);

  // Navigate from Calendar "+ view more" to Tasks page for that date
  const handleViewMore = useCallback((dateStr: string) => {
    // Find the date index in outerOptions
    const dateIndex = outerOptions.indexOf(dateStr);
    if (dateIndex === -1) return;

    // Animate outer wheel to the target date
    const outerSegment = 360 / outerOptions.length;
    animate(outerRotate, -(dateIndex * outerSegment), {
      type: 'spring', stiffness: 400, damping: 30, mass: 0.8
    });

    // Animate inner wheel to TASKS mode (index 1)
    const innerSegment = 360 / modes.length;
    const tasksIndex = modes.indexOf('TASKS');
    animate(innerRotate, -(tasksIndex * innerSegment), {
      type: 'spring', stiffness: 400, damping: 30, mass: 0.8
    });

    setSelectedMode('TASKS');
  }, [outerOptions, modes, outerRotate, innerRotate]);

  // Month/year navigation helpers
  const handlePrevMonth = useCallback(() => {
    if (selectedChartMonth === 0) {
      setSelectedChartMonth(11);
      setSelectedChartYear(prev => prev - 1);
    } else {
      setSelectedChartMonth(prev => prev - 1);
    }
  }, [selectedChartMonth]);

  const handleNextMonth = useCallback(() => {
    if (selectedChartMonth === 11) {
      setSelectedChartMonth(0);
      setSelectedChartYear(prev => prev + 1);
    } else {
      setSelectedChartMonth(prev => prev + 1);
    }
  }, [selectedChartMonth]);

  const monthYearLabel = useMemo(() => {
    const monthName = new Date(selectedChartYear, selectedChartMonth).toLocaleString('default', { month: 'short' }).toUpperCase();
    return `${monthName} ${selectedChartYear}`;
  }, [selectedChartMonth, selectedChartYear]);

  return (
    <div
      className={`brutalist-container bg-hardware text-secondary selection:bg-tertiary/30 ${themeName}`}
      onPointerDown={() => audioEngine.init()}
    >
      {/* Dynamic CRT/Scanline Overlays could go here */}

      {/* Header */}
      <header className="px-6 pt-10 pb-4 flex justify-between items-baseline z-10 relative pointer-events-none">
        <div className="flex flex-col">
          <Clock use24h={use24h} />
          {userName && (
            <span className="text-[10px] font-bold tracking-widest text-tertiary uppercase mt-1">
              OP: {userName}
            </span>
          )}
          {(selectedMode === 'TASKS' || selectedMode === 'CALENDAR') && (
            <div className="flex items-center gap-2 mt-2 pointer-events-auto">
              <button
                onClick={handlePrevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-secondary/20 hover:bg-secondary/10 active:scale-90 transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-secondary" />
              </button>
              <span className="text-xs font-bold tracking-widest text-gray-400 uppercase font-plex min-w-[90px] text-center">
                {monthYearLabel}
              </span>
              <button
                onClick={handleNextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-secondary/20 hover:bg-secondary/10 active:scale-90 transition-all"
              >
                <ChevronRight className="w-4 h-4 text-secondary" />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col text-right">
          <span className="text-sm font-bold tracking-widest text-gray-500 uppercase">Date</span>
          <div className="text-4xl font-nothing font-normal tracking-wide mt-1 text-secondary uppercase flex justify-end overflow-hidden w-40 pointer-events-auto">
            {(() => {
              let dateStr = outerOptions[activeOuterIndex];
              if (selectedMode === 'TOOLS') {
                const today = new Date();
                dateStr = `${today.toLocaleString('default', { month: 'short' }).toUpperCase()} ${today.getDate()}`;
              }

              let colorClass = 'text-secondary';
              if (selectedMode === 'FINANCE') {
                const dayTx = transactions.filter(tx => {
                  const txD = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                  return txD === dateStr.toUpperCase();
                });
                const hasInc = dayTx.some(t => t.type === 'income');
                const hasExp = dayTx.some(t => t.type === 'expense');
                if (hasExp) colorClass = 'text-tertiary drop-shadow-[0_0_8px_rgba(184,58,45,0.6)]';
                else if (hasInc) colorClass = 'text-quaternary drop-shadow-[0_0_8px_rgba(78,104,81,0.6)]';
              }

              return (
                <span
                  className={`inline-block ${colorClass} ${selectedMode === 'FINANCE' ? 'cursor-pointer active:scale-95' : ''}`}
                  onClick={() => {
                    if (selectedMode === 'FINANCE') {
                      if (typeof navigator !== 'undefined' && navigator.vibrate && hapticEnabled) navigator.vibrate(10);
                      setSelectedTxDate(dateStr);
                      setIsDateTxListOpen(true);
                    }
                  }}
                >
                  <EncryptedText text={dateStr} />
                </span>
              );
            })()}
          </div>
          {/* Header Controls */}
          <div className="flex justify-end gap-3 mt-4 pointer-events-auto">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary/5 border border-secondary/10 hover:bg-secondary/15 active:scale-95 transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-secondary opacity-70" />
            </button>
            <button
              onClick={handleToggleMute}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary/5 border border-secondary/10 hover:bg-secondary/15 active:scale-95 transition-all"
            >
              {isMuted
                ? <VolumeX className="w-3.5 h-3.5 text-gray-500" />
                : <Volume2 className="w-3.5 h-3.5 text-secondary opacity-70" />
              }
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-6 pr-32 overflow-y-auto pb-32 z-10 relative scrollbar-hide pointer-events-none mt-2">
        <div className="mt-2 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.h2
              key={currentTitle}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-4"
            >
              {currentTitle}
            </motion.h2>
          </AnimatePresence>

          <Suspense fallback={null}>
            <AnimatePresence mode="wait">
              {selectedMode === 'TASKS' && (
                <TasksView
                  tasks={tasks}
                  outerOptions={outerOptions}
                  activeOuterIndex={activeOuterIndex}
                  handleTaskProperties={handleTaskProperties}
                  handleTaskComplete={handleTaskComplete}
                />
              )}

              {selectedMode === 'FINANCE' && (
                <FinanceView
                  transactions={transactions}
                  selectedChartMonth={selectedChartMonth}
                  selectedChartYear={selectedChartYear}
                  startingBalance={startingBalance}
                  setIsChartSettingsOpen={setIsChartSettingsOpen}
                  setSelectedTransaction={setSelectedTransaction}
                  setIsTransactionsModalOpen={setIsTransactionsModalOpen}
                />
              )}


              {selectedMode === 'CALENDAR' && (
                <CalendarView
                  tasks={tasks}
                  dates={outerOptions}
                  activeIndex={activeOuterIndex}
                  onAddTask={(date) => {
                    setScheduleDate(date);
                    setDueDate(date);
                    setIsAddTaskOpen(true);
                  }}
                  onViewMore={handleViewMore}
                />
              )}

              {selectedMode === 'REVIEW' && (
                <ReceiptView onPrint={() => setIsReceiptOpen(true)} />
              )}
            </AnimatePresence>
          </Suspense>
        </div>
      </main>

      {/* Dual Wheel Navigation System */}
      <div
        className="absolute right-[-150px] top-1/2 -translate-y-1/2 w-[300px] h-[300px] z-0 touch-none"
        onDoubleClick={() => {
          // Find today's index in the dates array
          const today = new Date();
          const monthShort = today.toLocaleString('default', { month: 'short' }).toUpperCase();
          const todayStr = `${monthShort} ${today.getDate()}`;
          const todayIndex = outerOptions.indexOf(todayStr);

          if (todayIndex !== -1) {
            const segment = 360 / outerOptions.length;
            const targetAngle = todayIndex * segment;

            // Animate outer wheel back to today
            animate(outerRotate, -targetAngle, {
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 0.8
            });
          }
        }}
      >

        {/* Outer Wheel (Dates) */}
        <motion.div
          className="absolute inset-0 border border-[var(--inset-border)] bg-[var(--wheel-bg)] backdrop-blur-md rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[var(--wheel-shadow-outer)]"
          style={{ rotate: outerRotate }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0}
          onDrag={(_, info) => {
            // Reduced sensitivity for larger scroll distance
            outerRotate.set(outerRotate.get() - info.delta.y * 0.25);
          }}
          onDragEnd={(_, info) => {
            const currentRot = outerRotate.get();
            const segment = 360 / outerOptions.length;
            // Snappier gear-like animation
            const nearestSeg = Math.round(currentRot / segment) * segment;

            animate(outerRotate, nearestSeg - (info.velocity.y * 0.05), {
              type: "spring",
              stiffness: 900, // Increased for snappier feel
              damping: 25, // Decreased for more bounce
              mass: 0.6 // Decreased for lighter feel
            });
          }}
        >
          {/* Compass-like tick marks for outer wheel */}
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-[1px] flex justify-end"
              style={{ transform: `rotate(${i * 12}deg)` }}
            >
              <div className="w-[4px] h-[1px] bg-gray-600"></div>
            </div>
          ))}

          {outerOptions.map((opt, i) => {
            const angle = (i * 360) / outerOptions.length;

            // Generate visual coloring for wheel dates in FINANCE mode
            let colorClass = 'text-gray-500';
            if (selectedMode === 'FINANCE') {
              const dayTx = transactions.filter(tx => {
                const txD = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                return txD === opt.toUpperCase();
              });
              const hasInc = dayTx.some(t => t.type === 'income');
              const hasExp = dayTx.some(t => t.type === 'expense');
              if (hasExp) colorClass = 'text-tertiary font-bold drop-shadow-[0_0_2px_rgba(184,58,45,0.4)]';
              else if (hasInc) colorClass = 'text-quaternary font-bold drop-shadow-[0_0_2px_rgba(78,104,81,0.4)]';
            }

            const isActive = i === activeOuterIndex;

            return (
              <div
                key={opt}
                className="absolute w-[180px] origin-right transition-opacity duration-300 pointer-events-none"
                style={{
                  right: '50%',
                  transform: `rotate(${angle}deg)`,
                  opacity: (isWheelScrolling || selectedMode === 'FINANCE') && isActive ? 1 : 0
                }}
              >
                <div
                  className={`font-mono text-xs absolute left-0 flex items-center gap-2 ${colorClass}`}
                  style={{
                    transform: 'rotate(90deg)',
                    pointerEvents: (selectedMode === 'FINANCE' && isActive) ? 'auto' : 'none',
                    cursor: (selectedMode === 'FINANCE' && isActive) ? 'pointer' : 'default'
                  }}
                  onClick={(e) => {
                    if (selectedMode === 'FINANCE' && isActive) {
                      e.stopPropagation();
                      if (typeof navigator !== 'undefined' && navigator.vibrate && hapticEnabled) navigator.vibrate(10);
                      setSelectedTxDate(opt);
                      setIsDateTxListOpen(true);
                    }
                  }}
                >
                  <span>{opt}</span>
                </div>

              </div>
            );
          })}
        </motion.div>

        {/* Inner Wheel (Modes) */}
        <motion.div
          className="absolute inset-[60px] border border-[var(--inset-border)] bg-[var(--wheel-inner-bg)] backdrop-blur-md rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[var(--wheel-shadow-inner)]"
          style={{ rotate: innerRotate }}
          onDoubleClick={() => {
            const today = new Date();
            const todayStr = `${today.toLocaleString('default', { month: 'short' }).toUpperCase()} ${today.getDate()}`;
            const todayIndex = outerOptions.findIndex(o => o === todayStr);
            if (todayIndex !== -1) {
              setActiveOuterIndex(todayIndex);
              setSelectedMode('TASKS');
              setSelectedChartMonth(today.getMonth());
              setSelectedChartYear(today.getFullYear());
              if (typeof navigator !== 'undefined' && navigator.vibrate && hapticEnabled) navigator.vibrate(12);
              audioEngine.tickClick();
            }
          }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0}
          onDrag={(_, info) => {
            innerRotate.set(innerRotate.get() - info.delta.y * 0.3);
          }}
          onDragEnd={(_, info) => {
            const currentRot = innerRotate.get();
            const segment = 360 / modes.length;
            const velocityRot = currentRot - (info.velocity.y * 0.05);
            const nearestSeg = Math.round(velocityRot / segment) * segment;

            animate(innerRotate, nearestSeg, {
              type: "spring",
              stiffness: 950,
              damping: 28,
              mass: 0.4,
              onUpdate: (latest) => {
                const segment = 360 / modes.length;
                let index = Math.round(-latest / segment) % modes.length;
                if (index < 0) index += modes.length;

                if (modes[index] !== selectedMode) {
                  setSelectedMode(modes[index]);
                }
              }
            });
          }}
        >
          {/* Compass ticks inner */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-[1.5px] flex justify-end"
              style={{ transform: `rotate(${i * 30}deg)` }}
            >
              <div className="w-[6px] h-[1.5px] bg-gray-500"></div>
            </div>
          ))}

          {modes.map((mode, i) => {
            const angle = (i * 360) / modes.length;
            return (
              <div
                key={mode}
                className="absolute w-[100px] origin-right"
                style={{ right: '50%', transform: `rotate(${angle}deg)` }}
              >
                <span className={`font-mono text-[10px] absolute left-6 -translate-y-1/2 transition-colors duration-200 ${selectedMode === mode ? 'text-secondary font-bold tracking-widest' : 'text-gray-500'}`} style={{ transform: 'rotate(90deg)' }}>
                  {mode}
                </span>
                <div className={`w-[2px] h-3 absolute left-3 top-1/2 -translate-y-1/2 rounded-full ${selectedMode === mode ? 'bg-secondary' : 'bg-transparent'}`}></div>
              </div>
            );
          })}
        </motion.div>

        {/* Center Compass Dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 hardware-panel rounded-full z-30 shadow-2xl"></div>

        {/* Indicator Line */}
        <div className="absolute top-1/2 -translate-y-1/2 -left-6 w-12 h-[2px] bg-secondary z-30 pointer-events-none drop-shadow-lg"></div>

      </div >

      {/* Bottom Nav - Braun Single Button Action */}
      < div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80%] max-w-[300px] z-30 pointer-events-auto" >
        <motion.button
          className="braun-btn w-full h-[60px]"
          onClick={() => {
            audioEngine.init();
            audioEngine.buttonThud();
            if (typeof navigator !== 'undefined' && navigator.vibrate && hapticEnabled) navigator.vibrate(20);
            if (selectedMode === 'TASKS') {
              const activeDate = outerOptions[activeOuterIndex];
              setScheduleDate(activeDate);
              setDueDate(activeDate);
              setIsAddTaskOpen(true);
            }
            else if (selectedMode === 'FINANCE') setIsAddTransactionOpen(true);
            else if (selectedMode === 'CALENDAR') {
              const activeDate = outerOptions[activeOuterIndex];
              setScheduleDate(activeDate);
              setDueDate(activeDate);
              setIsAddTaskOpen(true);
            }
            else if (selectedMode === 'REVIEW') {
              audioEngine.printerBuzz();
              setIsReceiptOpen(true);
            }

          }}
        >
          <div className="braun-btn-inner text-secondary font-bold tracking-widest text-sm relative overflow-hidden">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={selectedMode}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 absolute inset-0 justify-center"
              >
                {selectedMode === 'TASKS' && <><Plus className="w-5 h-5 text-tertiary" /> <span className="uppercase">ADD TASK</span></>}
                {selectedMode === 'FINANCE' && <><Plus className="w-5 h-5 text-quaternary" /> <span className="uppercase">LOG FUNDS</span></>}
                {selectedMode === 'CALENDAR' && (
                  <>
                    <Calendar className="w-5 h-5 text-secondary" />
                    <span className="uppercase">NEW EVENT</span>
                  </>
                )}
                {selectedMode === 'REVIEW' && (
                  <>
                    <Printer className="w-5 h-5 text-secondary" />
                    <span className="uppercase">PRINT LOG</span>
                  </>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </motion.button>
      </div >

      {/* Properties Modal */}
      <AnimatePresence>
        {
          propertiesModalTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-[2px]"
            >
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={async (_, info) => {
                  const threshold = 60;
                  if (info.offset.x > threshold || info.velocity.x > 500) {
                    // Swipe Right to Save
                    setPropertiesExitDir('right');

                    // Persist updates to DB
                    await localDb.tasks.update(propertiesModalTask.id!, {
                      title: propertiesModalTask.title,
                      dueDate: propertiesModalTask.dueDate || undefined,
                      scheduleDate: propertiesModalTask.scheduleDate || undefined,
                      types: propertiesModalTask.types
                    });

                    setPropertiesModalTask(null);
                  } else if (info.offset.x < -threshold || info.velocity.x < -500) {
                    // Swipe Left to Cancel
                    setPropertiesExitDir('left');
                    setPropertiesModalTask(null);
                  }
                }}
                initial={{ scale: 0.9, opacity: 0, x: 0 }}
                animate={{ scale: 1, opacity: 1, x: 0 }}
                exit={{
                  scale: propertiesExitDir === 'right' ? 0.8 : 1.1,
                  opacity: 0,
                  x: propertiesExitDir === 'right' ? 100 : -100
                }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="bg-[var(--bg-hardware)] rounded-3xl w-full p-8 text-secondary font-plex shadow-2xl border border-[var(--inset-border)] relative overflow-hidden"
              >
                <AnimatePresence>
                  {/* Dynamically show CANCELLED text if swiping left */}
                  {propertiesExitDir === 'left' && !propertiesModalTask && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="absolute top-0 right-0 h-full w-16 bg-gradient-to-l from-tertiary/20 to-transparent flex items-center justify-center pointer-events-none"
                    >
                      <span className="text-sm tracking-widest uppercase origin-center -rotate-90 whitespace-nowrap text-tertiary font-bold font-sans">
                        CANCELLED
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Swipe Hints */}
                <div className="absolute top-0 right-0 h-full w-8 flex items-center justify-center pointer-events-none opacity-30">
                  <span className="text-[8px] tracking-widest uppercase origin-center -rotate-90 whitespace-nowrap text-gray-400 font-bold font-sans">
                    Right: Save
                  </span>
                </div>
                <div className="absolute top-0 left-0 h-full w-8 flex items-center justify-center pointer-events-none opacity-30">
                  <span className="text-[8px] tracking-widest uppercase origin-center -rotate-90 whitespace-nowrap text-gray-400 font-bold font-sans">
                    Left: Cancel
                  </span>
                </div>

                <div className="flex justify-between items-start mb-8 px-4">
                  <input
                    type="text"
                    value={propertiesModalTask.title}
                    onChange={(e) => setPropertiesModalTask({ ...propertiesModalTask, title: e.target.value })}
                    className="text-2xl font-bold uppercase w-full bg-transparent border-b border-transparent focus:border-tertiary/50 outline-none transition-colors"
                  />
                </div>

                <div className="space-y-8 px-4">
                  {/* Due Date Horizontal Wheel */}
                  <div>
                    <span className="text-xs text-tertiary uppercase tracking-widest mb-3 block font-nothing flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_5px_rgba(184,58,45,0.8)] animate-pulse"></div>
                      Due Date
                    </span>
                    <div className="flex items-center">
                      <div
                        className="w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide flex gap-4 relative [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] py-2"
                        onScroll={(e) => {
                          const tick = Math.floor(e.currentTarget.scrollLeft / 50);
                          if (tick !== lastVibratedOuter.current) {
                            if (typeof navigator !== 'undefined' && navigator.vibrate && hapticEnabled) navigator.vibrate(5);
                            lastVibratedOuter.current = tick;
                          }
                        }}
                      >
                        <div className="w-[20%] shrink-0"></div>
                        {frontWheelDates.map((d: string, i: number) => (
                          <div
                            key={d}
                            className="shrink-0 w-24 flex flex-col items-center justify-center snap-center cursor-pointer"
                            onClick={() => setPropertiesModalTask({ ...propertiesModalTask, dueDate: d })}
                          >
                            <span className={`text-sm tracking-widest uppercase transition-all duration-300 ${propertiesModalTask.dueDate === d || (!propertiesModalTask.dueDate && i === 2) ? 'text-tertiary font-bold text-lg scale-110 drop-shadow-[0_0_8px_rgba(184,58,45,0.4)]' : 'text-gray-600'}`}>
                              {d}
                            </span>
                            {/* Indicator dot for selected */}
                            {(propertiesModalTask.dueDate === d || (!propertiesModalTask.dueDate && i === 2)) && <div className="w-1.5 h-1.5 led-glow-red rounded-full mt-2"></div>}
                          </div>
                        ))}
                        <div className="w-[20%] shrink-0"></div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Date Horizontal Wheel */}
                  <div>
                    <span className="text-xs text-secondary uppercase tracking-widest mb-3 block font-nothing flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-secondary opacity-50"></div>
                      Schedule Date
                    </span>
                    <div className="flex items-center">
                      <div
                        className="w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide flex gap-4 relative [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] py-2"
                      >
                        <div className="w-[20%] shrink-0"></div>
                        {frontWheelDates.map((d: string, i: number) => (
                          <div
                            key={d}
                            className="shrink-0 w-24 flex flex-col items-center justify-center snap-center cursor-pointer"
                            onClick={() => setPropertiesModalTask({ ...propertiesModalTask, scheduleDate: d })}
                          >
                            <span className={`text-sm tracking-widest uppercase transition-all duration-300 ${propertiesModalTask.scheduleDate === d || (!propertiesModalTask.scheduleDate && i === 2) ? 'text-secondary font-bold text-lg scale-110 drop-shadow-[0_0_8px_rgba(220,201,169,0.4)]' : 'text-gray-600'}`}>
                              {d}
                            </span>
                            {/* Indicator dot for selected */}
                            {(propertiesModalTask.scheduleDate === d || (!propertiesModalTask.scheduleDate && i === 2)) && <div className="w-1.5 h-1.5 bg-secondary rounded-full mt-2"></div>}
                          </div>
                        ))}
                        <div className="w-[20%] shrink-0"></div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-widest mb-3 block font-nothing">Types</span>
                    <div className="flex flex-wrap gap-2">
                      {taskTypes.map(t => {
                        const isActive = propertiesModalTask.types.includes(t);
                        return (
                          <span
                            key={t}
                            onClick={() => {
                              if (typeof navigator !== 'undefined' && navigator.vibrate && hapticEnabled) navigator.vibrate(10);
                              setPropertiesModalTask({
                                ...propertiesModalTask,
                                types: isActive
                                  ? propertiesModalTask.types.filter(type => type !== t)
                                  : [...propertiesModalTask.types, t]
                              });
                            }}
                            className={`px-3 py-1.5 text-xs uppercase rounded-full border cursor-pointer flex items-center justify-center relative overflow-hidden transition-colors ${isActive ? 'bg-secondary text-[var(--bg-hardware)] border-secondary font-bold shadow-[0_0_10px_rgba(220,201,169,0.3)]' : 'bg-[var(--btn-bg)] text-[var(--text-muted)] border-[var(--inset-border)] hover:border-secondary/30'}`}
                          >
                            <div className={`absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
                            {t}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* Add Task Bottom Sheet Modal */}
      <AnimatePresence>
        {
          isAddTaskOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
                onClick={() => setIsAddTaskOpen(false)}
              />

              <motion.div

                initial={{ y: '100%', borderRadius: '40px' }}
                animate={{ y: 0, borderRadius: '40px' }}
                exit={{ y: '100%', borderRadius: '40px' }}
                transition={{ type: 'spring', damping: 25, stiffness: 350, mass: 0.8 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.4}
                onDragEnd={(_, info) => {
                  // Swipe up OR down to close/save
                  if (Math.abs(info.offset.y) > 100 || Math.abs(info.velocity.y) > 500) {
                    setIsAddTaskOpen(false);
                  }
                }}
                className="absolute bottom-0 left-0 right-0 h-[85vh] z-50 bg-[var(--bg-hardware)] rounded-t-[40px] flex flex-col font-plex text-secondary border-t border-x border-[var(--inset-border)] shadow-[var(--wheel-shadow-inner)] touch-none"
              >
                {/* Drag Indicator (Push this down to cancel) */}
                <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
                  <div className="w-16 h-1 bg-gray-600 rounded-full"></div>
                </div>

                <div className="flex-1 px-8 py-6 flex flex-col overflow-y-auto">
                  {/* Task Name Input */}
                  <div className="mb-10">
                    <input
                      type="text"
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      placeholder="TASK NAME"
                      className="w-full bg-transparent border-b-2 border-secondary py-2 text-2xl font-bold uppercase tracking-widest focus:outline-none placeholder:text-gray-700"
                    />
                  </div>

                  {/* Date Wheels Section */}
                  <div className="flex justify-between px-2 mb-12">
                    {/* Schedule On */}
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-sans uppercase tracking-widest font-bold mb-4">Schedule on</span>
                      <div className="h-[120px] w-24 overflow-y-auto snap-y snap-mandatory scrollbar-hide relative text-center border-y border-secondary/20 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]">
                        <div className="h-[40px]"></div>
                        {frontWheelDates.map(d => (
                          <div key={d} className="h-[40px] flex items-center justify-center snap-center cursor-pointer" onClick={() => setScheduleDate(d)}>
                            <span className={`text-sm tracking-widest uppercase ${scheduleDate === d ? 'text-secondary font-bold text-base' : 'text-gray-600'}`}>
                              {d}
                            </span>
                          </div>
                        ))}
                        <div className="h-[40px]"></div>
                      </div>
                    </div>

                    {/* Due */}
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-sans uppercase tracking-widest font-bold mb-4">Due</span>
                      <div className="h-[120px] w-24 overflow-y-auto snap-y snap-mandatory scrollbar-hide relative text-center border-y border-secondary/20 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]">
                        <div className="h-[40px]"></div>
                        {frontWheelDates.map(d => (
                          <div key={d} className="h-[40px] flex items-center justify-center snap-center cursor-pointer" onClick={() => setDueDate(d)}>
                            <span className={`text-sm tracking-widest uppercase ${dueDate === d ? 'text-secondary font-bold text-base' : 'text-gray-600'}`}>
                              {d}
                            </span>
                          </div>
                        ))}
                        <div className="h-[40px]"></div>
                      </div>
                    </div>
                  </div>

                  {/* Layered Stacked TYPE Selection */}
                  <div className="flex flex-col items-center flex-1 w-full pb-8">
                    <span className="text-sm font-sans uppercase tracking-widest font-bold mb-6">Type</span>

                    <div
                      className="relative w-48 h-16 cursor-pointer group mb-12"
                      onClick={() => {
                        const nextIdx = (taskTypes.indexOf(selectedType) + 1) % taskTypes.length;
                        setSelectedType(taskTypes[nextIdx]);
                      }}
                    >
                      {/* Render from bottom to top for visual stacking */}
                      {[...orderedTypes].reverse().map((t, i) => {
                        const total = orderedTypes.length;
                        const isTop = i === total - 1; // Last rendered is top

                        return (
                          <div
                            key={t}
                            className={`absolute w-full h-[50px] rounded-[25px] border-2 border-[var(--btn-inner-border)] flex items-center justify-center font-bold tracking-widest uppercase transition-all duration-300 ${isTop ? 'bg-[var(--inset-bg)] backdrop-blur-md shadow-lg' : 'bg-[var(--bg-hardware)]'}`}
                            style={{
                              bottom: `${i * -10}px`,
                              zIndex: i,
                              transform: `scale(${1 - ((total - 1 - i) * 0.08)})`,
                              opacity: 1 - ((total - 1 - i) * 0.3)
                            }}
                          >
                            {t}
                          </div>
                        )
                      })}
                    </div>

                    {/* Add New Type Input */}
                    <div className="w-full max-w-[200px] flex items-center gap-2 mt-4">
                      <input
                        type="text"
                        value={newTypeInput}
                        onChange={(e) => setNewTypeInput(e.target.value)}
                        placeholder="+ NEW TYPE"
                        className="flex-1 bg-transparent border-b border-secondary/30 py-1 text-xs uppercase tracking-widest focus:outline-none focus:border-secondary transition-colors"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const val = newTypeInput.trim();
                          if (val && !taskTypes.includes(val)) {
                            setTaskTypes([...taskTypes, val]);
                            setSelectedType(val);
                            setNewTypeInput('');
                          }
                        }}
                        className="p-1 px-3 border border-secondary/30 rounded hover:bg-secondary/10 text-xs font-bold transition-colors"
                      >
                        ADD
                      </button>
                    </div>
                  </div>

                  {/* Floating Add Button */}
                  <div className="absolute bottom-8 right-8">
                    <button
                      onClick={handleAddTask}
                      className="w-14 h-14 bg-secondary text-primary rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl"
                    >
                      <Plus className="w-8 h-8" />
                    </button>
                  </div>

                </div>
              </motion.div>
            </>
          )
        }
      </AnimatePresence >
      {/* Add Transaction Modal */}
      <AnimatePresence>
        {
          isAddTransactionOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
                onClick={() => setIsAddTransactionOpen(false)}
              />

              <motion.div

                initial={{ y: '100%', borderRadius: '40px' }}
                animate={{ y: 0, borderRadius: '40px' }}
                exit={{ y: '100%', borderRadius: '40px' }}
                transition={{ type: 'spring', damping: 25, stiffness: 350, mass: 0.8 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.4}
                onDragEnd={(_, info) => {
                  if (Math.abs(info.offset.y) > 100 || Math.abs(info.velocity.y) > 500) {
                    setIsAddTransactionOpen(false);
                  }
                }}
                className="absolute bottom-0 left-0 right-0 h-[85vh] z-50 hardware-panel rounded-t-[40px] flex flex-col font-plex text-secondary border-t border-x border-secondary/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] touch-none"
              >
                <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
                  <div className="w-16 h-1 bg-gray-600 rounded-full"></div>
                </div>

                <div className="flex-1 px-8 py-6 flex flex-col overflow-y-auto">
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-bold uppercase tracking-widest text-secondary">Log Funds</h2>
                    <span className="text-xs text-gray-500 uppercase font-nothing">&uarr; Swipe to Close</span>
                  </div>

                  <div className="space-y-8 pb-32">
                    {/* Amount & Title Input */}
                    <div className="flex flex-col gap-4 border-b-2 border-secondary pb-4">
                      <input
                        type="text"
                        value={txTitle}
                        onChange={(e) => setTxTitle(e.target.value)}
                        placeholder="MERCHANT / TITLE"
                        className="w-full bg-transparent text-xl font-bold font-nothing tracking-widest focus:outline-none placeholder:text-gray-700 uppercase"
                      />
                      <div className="flex items-baseline">
                        <span className="text-2xl font-mono text-gray-500 mr-2">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={txAmount}
                          onChange={(e) => setTxAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-transparent text-4xl font-bold font-mono tracking-tighter focus:outline-none placeholder:text-gray-700"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Type Toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-secondary/20 p-1 bg-secondary/5">
                      <button
                        onClick={() => setTxType('expense')}
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest rounded-lg transition-colors ${txType === 'expense' ? 'bg-tertiary text-primary shadow-lg' : 'text-gray-500 hover:text-secondary'}`}
                      >
                        Expense
                      </button>
                      <button
                        onClick={() => setTxType('income')}
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest rounded-lg transition-colors ${txType === 'income' ? 'bg-quaternary text-primary shadow-lg' : 'text-gray-500 hover:text-secondary'}`}
                      >
                        Income
                      </button>
                    </div>

                    {/* Date, Payment, Category & Note */}
                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <span className="text-[10px] font-sans uppercase tracking-widest font-bold mb-2 block text-gray-500">Date</span>
                          <input
                            type="date"
                            value={txDateStr}
                            onChange={(e) => setTxDateStr(e.target.value)}
                            className="w-full bg-transparent border-b border-secondary/30 py-1 text-xs uppercase font-mono tracking-widest focus:outline-none focus:border-secondary transition-colors text-secondary"
                          />
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] font-sans uppercase tracking-widest font-bold mb-2 block text-gray-500">Time (Auto)</span>
                          <div className="w-full border-b border-secondary/30 py-1 text-xs uppercase font-mono tracking-widest text-gray-600">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* Payment Method Selector */}
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-sans uppercase tracking-widest font-bold text-gray-500">Payment Method</span>
                          <button
                            onClick={() => setIsEditingPaymentMethods(!isEditingPaymentMethods)}
                            className="text-[10px] uppercase font-bold text-secondary underline decoration-secondary/30 hover:decoration-secondary"
                          >
                            {isEditingPaymentMethods ? 'Done' : 'Edit'}
                          </button>
                        </div>
                        <div className="flex gap-2 w-full overflow-x-auto scrollbar-hide snap-x pb-2">
                          {paymentMethods.map(pm => (
                            <div key={pm} className="relative shrink-0 snap-start">
                              <button
                                onClick={() => !isEditingPaymentMethods && setTxPaymentMethod(pm)}
                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase border transition-all ${txPaymentMethod === pm ? 'border-secondary bg-secondary text-primary shadow-sm' : 'border-secondary/20 text-gray-500 hover:border-secondary/50'} ${isEditingPaymentMethods ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                              >
                                {pm}
                              </button>
                              {isEditingPaymentMethods && paymentMethods.length > 1 && (
                                <button
                                  onClick={() => {
                                    const newMethods = paymentMethods.filter(m => m !== pm);
                                    setPaymentMethods(newMethods);
                                    if (txPaymentMethod === pm) setTxPaymentMethod(newMethods[0]);
                                  }}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/80 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-500 z-10"
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex mt-1 items-end">
                          <input type="text" value={newPmInput} onChange={e => setNewPmInput(e.target.value)} placeholder="+ Add Method" className="text-[10px] bg-transparent border-b border-secondary/20 text-secondary focus:outline-none focus:border-secondary uppercase tracking-widest w-24 px-1 pb-1" />
                          <button onClick={() => { if (newPmInput.trim() && !paymentMethods.includes(newPmInput)) { setPaymentMethods([...paymentMethods, newPmInput]); setTxPaymentMethod(newPmInput); setNewPmInput(''); } }} className="text-[10px] ml-2 font-bold text-gray-500 hover:text-secondary uppercase">Add</button>
                        </div>
                      </div>

                      {/* Category Selector */}
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-sans uppercase tracking-widest font-bold text-gray-500">Category</span>
                          <button
                            onClick={() => setIsEditingCategories(!isEditingCategories)}
                            className="text-[10px] uppercase font-bold text-secondary underline decoration-secondary/30 hover:decoration-secondary"
                          >
                            {isEditingCategories ? 'Done' : 'Edit'}
                          </button>
                        </div>
                        <div className="flex gap-2 w-full overflow-x-auto scrollbar-hide snap-x pb-2">
                          {categoriesList.map(cat => (
                            <div key={cat} className="relative shrink-0 snap-start">
                              <button
                                onClick={() => !isEditingCategories && setTxCategory(cat)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase border transition-all ${txCategory === cat ? 'border-secondary bg-secondary/10 text-secondary' : 'border-secondary/10 text-gray-600 hover:border-secondary/30'} ${isEditingCategories ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                              >
                                {cat}
                              </button>
                              {isEditingCategories && categoriesList.length > 1 && (
                                <button
                                  onClick={() => {
                                    const newCats = categoriesList.filter(c => c !== cat);
                                    setCategoriesList(newCats);
                                    if (txCategory === cat) setTxCategory(newCats[0]);
                                  }}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/80 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-500 z-10"
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex mt-1 items-end">
                          <input type="text" value={newCatInput} onChange={e => setNewCatInput(e.target.value)} placeholder="+ Add Category" className="text-[10px] bg-transparent border-b border-secondary/20 text-secondary focus:outline-none focus:border-secondary uppercase tracking-widest w-24 px-1 pb-1" />
                          <button onClick={() => { if (newCatInput.trim() && !categoriesList.includes(newCatInput)) { setCategoriesList([...categoriesList, newCatInput]); setTxCategory(newCatInput); setNewCatInput(''); } }} className="text-[10px] ml-2 font-bold text-gray-500 hover:text-secondary uppercase">Add</button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-sans uppercase tracking-widest font-bold mb-2 block text-gray-500">Note (Optional)</span>
                        <input
                          type="text"
                          value={txNote}
                          onChange={(e) => setTxNote(e.target.value)}
                          placeholder="..."
                          className="w-full bg-transparent border-b border-secondary/30 py-1 text-xs text-secondary focus:outline-none focus:border-secondary transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Floating Add Button */}
                  <div className="absolute bottom-8 right-8">
                    <button
                      onClick={async () => {
                        if (!txAmount || isNaN(Number(txAmount))) return;
                        const safeAmount = Math.min(Math.max(0, Number(txAmount)), 999999999);
                        const safeTitle = sanitizeInput(txTitle, 100) || 'Untitled';
                        const safeNote = sanitizeInput(txNote, 500);
                        const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(txDateStr) ? txDateStr : new Date().toISOString().split('T')[0];
                        const newTx = {
                          title: safeTitle,
                          amount: safeAmount,
                          type: txType,
                          category: txCategory || categoriesList[0],
                          paymentMethod: txPaymentMethod || paymentMethods[0],
                          note: safeNote,
                          date: new Date(safeDate + 'T12:00:00Z').toISOString()
                        };

                        await addTransaction(newTx);

                        setIsAddTransactionOpen(false);
                        setTxTitle('');
                        setTxAmount('');
                        setTxNote('');
                        setTxDateStr(new Date().toISOString().split('T')[0]);
                      }}
                      className={`w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl ${txType === 'expense' ? 'bg-tertiary text-primary text-xl font-bold' : 'bg-quaternary text-primary font-bold text-xl'}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )
        }

        {/* Chart Settings Modal */}
        {isChartSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-[2px]"
          >
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.y > 60 || info.velocity.y > 500) setIsChartSettingsOpen(false);
              }}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-[var(--bg-hardware)] rounded-3xl w-full p-8 text-secondary font-plex shadow-2xl border border-[var(--inset-border)] relative overflow-hidden"
            >
              <div className="absolute top-0 w-full left-0 flex justify-center pt-4 opacity-50">
                <span className="text-[8px] uppercase tracking-widest font-bold">Swipe down to close</span>
              </div>

              <h3 className="text-xl font-bold uppercase tracking-widest mb-8 mt-2 text-center text-secondary">Chart Settings</h3>

              <div className="space-y-6">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-bold block mb-2">Analysis Month</label>
                  <select
                    value={selectedChartMonth}
                    onChange={(e) => setSelectedChartMonth(Number(e.target.value))}
                    className="w-full bg-[var(--inset-bg)] border border-[var(--inset-border)] rounded-xl py-3 px-4 text-secondary text-sm focus:outline-none mb-4"
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date();
                      date.setMonth(i);
                      return (
                        <option key={i} value={i}>
                          {date.toLocaleString('default', { month: 'long' })}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-bold block mb-2">Monthly Expense Budget</label>
                  <div className="flex items-center border-b border-[var(--inset-border)] pb-2">
                    <span className="text-xl font-mono text-gray-500 mr-2">$</span>
                    <input
                      type="number"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(Number(e.target.value) || 0)}
                      className="bg-transparent text-2xl font-mono font-bold text-secondary focus:outline-none w-full"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2 tracking-wide uppercase font-sans">
                    Warning signals will activate when expenses pass this threshold.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Date Transactions Modal */}
        {isDateTxListOpen && selectedTxDate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setIsDateTxListOpen(false)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 20, stiffness: 400, mass: 0.6 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.y) > 100 || Math.abs(info.velocity.y) > 500) {
                  setIsDateTxListOpen(false);
                }
              }}
              className="absolute bottom-0 left-0 right-0 h-[85vh] z-50 hardware-panel rounded-t-[40px] flex flex-col font-plex text-secondary border-t border-x border-secondary/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] touch-none"
            >
              <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
                <div className="w-16 h-1 bg-gray-600 rounded-full"></div>
              </div>

              <div className="flex-1 px-8 py-6 flex flex-col overflow-y-auto pb-32">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-bold uppercase tracking-widest text-secondary font-nothing">{selectedTxDate}</h3>
                  <span className="text-xs text-gray-500 uppercase font-nothing">&uarr; Swipe to Close</span>
                </div>

                <div className="flex-1 space-y-3 pb-8">
                  {(() => {
                    const dayTx = transactions.filter(tx => {
                      const txD = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                      return txD === (selectedTxDate || '').toUpperCase();
                    });

                    if (dayTx.length === 0) return <p className="text-sm text-gray-500 italic mt-8 text-center uppercase tracking-widest font-sans font-bold">No activity logged.</p>;

                    return dayTx.map(tx => (
                      <div key={tx.id} className="flex justify-between items-center p-4 bg-[var(--inset-bg)] border border-[var(--inset-border)] rounded-xl shadow-[var(--inset-shadow)]">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold uppercase text-secondary tracking-widest">{tx.category}</span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 opacity-70">{tx.note || 'No note'}</span>
                        </div>
                        <span className={`font-mono font-bold ${tx.type === 'income' ? 'text-quaternary' : 'text-tertiary'}`}>
                          {tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-[55] backdrop-blur-sm"
              onClick={() => setSelectedTransaction(null)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 20, stiffness: 400, mass: 0.6 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.y) > 100 || Math.abs(info.velocity.y) > 500) {
                  setSelectedTransaction(null);
                }
              }}
              className="absolute bottom-0 left-0 right-0 h-[85vh] z-[60] hardware-panel rounded-t-[40px] flex flex-col font-plex text-secondary border-t border-x border-secondary/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] touch-none"
            >
              <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
                <div className="w-16 h-1 bg-gray-600 rounded-full"></div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6 h-full flex flex-col pt-8">
                {/* Value Header */}
                <div className="flex flex-col items-center">
                  <span className={`text-[52px] font-mono font-bold tracking-tighter ${selectedTransaction.type === 'income' ? 'text-quaternary' : 'text-secondary'}`}>
                    {selectedTransaction.type === 'income' ? '+' : '-'}${Math.abs(selectedTransaction.amount).toFixed(1)}
                  </span>
                </div>

                {/* Details Grid (Braun style) */}
                <div className="mt-12 flex flex-col border-t border-[var(--inset-border)] pt-4 relative">
                  {/* Row 1: Title */}
                  <div className="flex w-full items-center py-5 border-b border-[var(--inset-border)] pr-4 bg-[var(--bg-hardware)]">
                    <span className="w-1/3 min-w-[100px] text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-4 shrink-0 border-r border-[var(--inset-border)] h-10 flex items-center">Merchant</span>
                    <span className="text-xl font-bold font-plex tracking-wider pl-4">{selectedTransaction.title || selectedTransaction.category}</span>
                  </div>

                  {/* Row 2: Date & Time */}
                  <div className="flex w-full border-b border-[var(--inset-border)] bg-[var(--bg-hardware)]">
                    <div className="flex flex-col w-1/3 min-w-[100px] border-r border-[var(--inset-border)] py-4 pl-4 gap-1 shrink-0 justify-center">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Date</span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-4">Time</span>
                    </div>
                    <div className="flex flex-col py-4 pl-4 gap-1 flex-1 justify-center">
                      <span className="text-sm font-bold font-sans uppercase tracking-widest leading-none text-secondary">
                        {new Date(selectedTransaction.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-sm font-bold font-sans uppercase tracking-widest leading-none text-secondary mt-4">
                        {new Date(selectedTransaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/ AM| PM/, '')} {new Date(selectedTransaction.date).getHours() >= 12 ? 'PM' : 'AM'}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Payment Method & Code */}
                  <div className="flex w-full py-4 relative bg-[var(--bg-hardware)] border-b border-[var(--inset-border)]">
                    <div className="flex flex-col w-1/3 min-w-[100px] border-r border-[var(--inset-border)] pl-4 gap-1 shrink-0 justify-center">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Method</span>
                    </div>
                    <div className="flex items-center pl-4 py-3 flex-1">
                      <span className="text-sm font-bold font-sans uppercase tracking-widest">{selectedTransaction.paymentMethod || 'CASH'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Transactions Full List Modal */}
      <AnimatePresence>
        {isTransactionsModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setIsTransactionsModalOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.8 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100 || info.velocity.x > 500) {
                  setIsTransactionsModalOpen(false);
                }
              }}
              className="absolute top-0 bottom-0 left-0 right-0 z-50 hardware-panel flex flex-col font-plex text-secondary touch-none"
            >
              <div className="w-full flex justify-between items-center px-6 py-8 border-b border-[var(--inset-border)]">
                <div className="flex flex-col">
                  <span className="text-gray-500 font-bold uppercase tracking-widest text-sm mb-1">All Recent</span>
                  <h3 className="text-3xl font-normal tracking-wide text-secondary font-nothing">Transactions</h3>
                </div>
                <button
                  onClick={() => setIsTransactionsModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-[var(--inset-bg)] border border-[var(--inset-border)] shadow-[var(--btn-shadow-outer)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  <span className="font-nothing tracking-widest text-xs">&times;</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 pb-32">
                {transactions.slice(0, 50).map(tx => (
                  <div key={tx.id} className="relative w-full border-b border-[var(--inset-border)] overflow-hidden">
                    <motion.div
                      onClick={() => setSelectedTransaction(tx)}
                      className="flex items-center justify-between py-4 pr-2 bg-[var(--bg-hardware)] cursor-pointer active:scale-95 transition-transform relative z-10 w-full"
                    >
                      <div className="flex flex-col pl-2">
                        <span className="font-bold text-secondary text-lg font-plex tracking-wider">{tx.title || tx.category}</span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                          {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &bull; {tx.category}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`font-mono text-xl font-bold tracking-tighter ${tx.type === 'income' ? 'text-quaternary' : 'text-secondary'}`}>
                          {tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toFixed(1)}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">
                          {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/ AM| PM/, '')} {new Date(tx.date).getHours() >= 12 ? 'PM' : 'AM'}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                ))}

                {transactions.length === 0 && (
                  <p className="text-sm text-gray-500 italic mt-8 text-center uppercase tracking-widest font-sans font-bold">No activity logged.</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <ReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          tasks={tasks}
          transactions={transactions}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          themeName={themeName}
          onChangeTheme={handleThemeChange}
          use24h={use24h}
          onToggle24h={() => setUse24h(!use24h)}
          hapticEnabled={hapticEnabled}
          onToggleHaptic={() => setHapticEnabled(!hapticEnabled)}
          hiddenPages={hiddenPages}
          onTogglePage={(page) => {
            setHiddenPages(prev => prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]);
            if (selectedMode === page) setSelectedMode('TASKS');
          }}
          onResetData={async () => {
            // Clear Dexie tables
            await localDb.tasks.clear();
            await localDb.transactions.clear();
            await localDb.journals.clear();
            // Reset mock data
            await localDb.tasks.bulkAdd(initialTasks);
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        {!isSetupComplete && (
          <WelcomeScreen onComplete={handleSetupComplete} />
        )}
      </Suspense>

    </div>
  );
}

export default App;
