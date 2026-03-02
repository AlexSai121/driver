import { useState, useEffect, useRef } from 'react';
import { Plus, Calendar, Wrench } from 'lucide-react';
import { motion, useMotionValue, animate, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';

type Task = {
  id: string | number;
  title: string;
  types: string[];
  completed: boolean;
  dueDate?: string;
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

// Mock Tasks Data
const initialTasks: Task[] = [];

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

function App() {
  const [themeLayout, setThemeLayout] = useState<'theme-dark' | 'theme-light'>('theme-dark');

  useEffect(() => {
    let touchStartX = 0;
    let isThreeFingers = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 3) {
        isThreeFingers = true;
        touchStartX = e.touches[0].clientX;
      } else {
        isThreeFingers = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isThreeFingers && e.changedTouches.length > 0) {
        const touchEndX = e.changedTouches[0].clientX;
        if (touchStartX - touchEndX > 50) {
          setThemeLayout(prev => prev === 'theme-dark' ? 'theme-light' : 'theme-dark');
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([20, 50, 20]);
        }
      }
      isThreeFingers = false;
      touchStartX = 0;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);

  // General app state
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isChartSettingsOpen, setIsChartSettingsOpen] = useState(false);
  const [isDateTxListOpen, setIsDateTxListOpen] = useState(false);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [isGlobalDateSelectorOpen, setIsGlobalDateSelectorOpen] = useState(false);
  const [selectedTxDate, setSelectedTxDate] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState(1000);
  const [selectedChartMonth, setSelectedChartMonth] = useState(new Date().getMonth());
  const [selectedChartYear, setSelectedChartYear] = useState(new Date().getFullYear());
  const [mindfulView, setMindfulView] = useState<'PLANNER' | 'JRNL'>('PLANNER');

  const [currentTime, setCurrentTime] = useState(new Date());

  // Live Clock Effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [selectedMode, setSelectedMode] = useState('TASKS');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [propertiesModalTask, setPropertiesModalTask] = useState<Task | null>(null);
  const [propertiesExitDir, setPropertiesExitDir] = useState<'left' | 'right'>('right');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Outer wheel rotation
  const outerRotate = useMotionValue(0);
  const [isWheelScrolling, setIsWheelScrolling] = useState(false);
  const lastVibratedOuter = useRef(0);

  const [activeOuterIndex, setActiveOuterIndex] = useState(0);
  const modes = ['MINDFUL', 'TASKS', 'FINANCE', 'TOOLS'];
  const toolViews = ['POMODORO', 'CALCULATOR', 'RECORDER', 'COMPASS', 'QR GEN', 'CONVERTER'];
  const genericDates = getMonthDates(selectedChartYear, selectedChartMonth);
  // Outer options depend on selectedMode
  const outerOptions = selectedMode === 'TOOLS' ? toolViews : genericDates;
  const frontWheelDates = getUpcomingDates();

  const outerOptionsRef = useRef(outerOptions);
  outerOptionsRef.current = outerOptions;

  // Tools Modal State
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  // Tools State: Recorder
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (isRecording) interval = setInterval(() => setRecordTime(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordTime(0);
      setRecordedAudioUrl(null);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    } catch (err) {
      console.error('Microphone access denied', err);
      alert('Microphone access is required for the Voice Recorder.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    }
  };

  // Tools State: Compass
  const [compassHeading, setCompassHeading] = useState<number | null>(null);

  useEffect(() => {
    if (isToolsOpen && toolViews[activeOuterIndex] === 'COMPASS') {
      const handleOrientation = (e: DeviceOrientationEvent) => {
        let heading = e.alpha;
        if (typeof (e as any).webkitCompassHeading !== 'undefined') {
          heading = (e as any).webkitCompassHeading;
        }
        if (heading !== null) setCompassHeading(heading);
      };

      if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
      return () => window.removeEventListener('deviceorientation', handleOrientation, true);
    }
  }, [isToolsOpen, activeOuterIndex, toolViews]);

  // Tools State: QR Gen
  const [qrInput, setQrInput] = useState('');

  // Tools State: Converter
  const [convType, setConvType] = useState<'LENGTH' | 'WEIGHT'>('LENGTH');
  const [convInput, setConvInput] = useState<string>('1');

  const getConvertedVal = () => {
    const val = Number(convInput);
    if (isNaN(val)) return '0.00';
    if (convType === 'LENGTH') {
      // CM to Inches
      return (val / 2.54).toFixed(2);
    } else {
      // KG to LBS
      return (val * 2.20462).toFixed(2);
    }
  };

  // Tools State: Pomodoro
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');

  // Tools State: Calculator
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrevVal, setCalcPrevVal] = useState<number | null>(null);
  const [calcOperation, setCalcOperation] = useState<string | null>(null);
  const [calcNewNumber, setCalcNewNumber] = useState(true);

  const handleCalcPress = (val: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    if (!isNaN(Number(val)) || val === '.') {
      if (calcNewNumber) {
        setCalcDisplay(val === '.' ? '0.' : val);
        setCalcNewNumber(false);
      } else {
        setCalcDisplay(calcDisplay === '0' && val !== '.' ? val : calcDisplay + val);
      }
    } else if (val === 'C') {
      setCalcDisplay('0');
      setCalcPrevVal(null);
      setCalcOperation(null);
      setCalcNewNumber(true);
    } else if (val === '±') {
      setCalcDisplay((Number(calcDisplay) * -1).toString());
    } else if (val === '%') {
      setCalcDisplay((Number(calcDisplay) / 100).toString());
    } else if (['+', '-', 'x', '÷'].includes(val)) {
      setCalcPrevVal(Number(calcDisplay));
      setCalcOperation(val);
      setCalcNewNumber(true);
    } else if (val === '=') {
      if (calcPrevVal !== null && calcOperation) {
        const current = Number(calcDisplay);
        let res = 0;
        if (calcOperation === '+') res = calcPrevVal + current;
        if (calcOperation === '-') res = calcPrevVal - current;
        if (calcOperation === 'x') res = calcPrevVal * current;
        if (calcOperation === '÷') res = current === 0 ? 0 : calcPrevVal / current;
        setCalcDisplay(String(Number(res.toFixed(8))));
        setCalcPrevVal(null);
        setCalcOperation(null);
        setCalcNewNumber(true);
      }
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (isPomodoroRunning && pomodoroTime > 0) {
      interval = setInterval(() => setPomodoroTime(p => p - 1), 1000);
    } else if (pomodoroTime === 0) {
      setIsPomodoroRunning(false);
      setPomodoroTime(pomodoroMode === 'FOCUS' ? 5 * 60 : 25 * 60);
      setPomodoroMode(prev => prev === 'FOCUS' ? 'BREAK' : 'FOCUS');
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    return () => clearInterval(interval);
  }, [isPomodoroRunning, pomodoroTime, pomodoroMode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      lastVibratedOuter.current = tick;
    }
  });

  // Inner wheel rotation
  const innerRotate = useMotionValue(0);
  const lastVibratedInner = useRef(0);

  useMotionValueEvent(innerRotate, "change", (latest) => {
    const tick = Math.floor(latest / (360 / modes.length));
    if (tick !== lastVibratedInner.current) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
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

  useEffect(() => {
    if (!db) return;

    // Tasks Sync
    const unsubscribeTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(fetchedTasks);
    });

    // Transactions Sync
    const unsubscribeTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const fetchedTx = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      // Sort by date desc locally for now
      setTransactions(fetchedTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    return () => {
      unsubscribeTasks();
      unsubscribeTx();
    };
  }, []);

  const handleTaskComplete = async (id: string | number) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
    if (db && typeof id === 'string') {
      await updateDoc(doc(db, 'tasks', id), { completed: !target.completed });
    } else {
      setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    }
  };

  const handleTaskProperties = (task: Task) => {
    setPropertiesModalTask(task);
  };

  // Header Titles
  let currentTitle = selectedMode;
  if (selectedMode === 'TASKS') currentTitle = `${outerOptions[activeOuterIndex]} TASKS`;
  if (selectedMode === 'FINANCE') currentTitle = 'FINANCE';
  if (selectedMode === 'MINDFUL') currentTitle = mindfulView;
  if (selectedMode === 'TOOLS') currentTitle = 'TOOLS';

  const handleAddTask = async () => {
    if (newTaskName.trim()) {
      const newTask = {
        title: newTaskName,
        types: [selectedType],
        completed: false,
        dueDate: dueDate
      };

      if (db) {
        await addDoc(collection(db, 'tasks'), newTask);
      } else {
        setTasks([...tasks, { id: Date.now(), ...newTask }]);
      }
      setIsAddTaskOpen(false);
      setNewTaskName('');
    }
  };

  // Stacked Type Selector Helper
  const orderedTypes = [selectedType, ...taskTypes.filter(t => t !== selectedType)];

  return (
    <div className={`brutalist-container bg-hardware text-secondary selection:bg-tertiary/30 ${themeLayout}`}>
      {/* Dynamic CRT/Scanline Overlays could go here */}

      {/* Header */}
      <header className="px-6 pt-10 pb-4 flex justify-between items-baseline z-10 relative pointer-events-none">
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-widest text-gray-500 uppercase">Time</span>
          <span className="text-4xl font-nothing font-normal tracking-wide mt-1 text-secondary flex items-baseline">
            {currentTime.toLocaleTimeString([], { hour: '2-digit' }).replace(/ AM| PM/, '')}
            <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>:</motion.span>
            {currentTime.toLocaleTimeString([], { minute: '2-digit' }).replace(/ AM| PM/, '')}
            <span className="text-xl ml-1">{currentTime.getHours() >= 12 ? 'PM' : 'AM'}</span>
          </span>
        </div>
        <div
          className="flex flex-col text-right"
          onPointerDown={(e) => {
            const timer = setTimeout(() => setIsGlobalDateSelectorOpen(true), 600);
            e.currentTarget.dataset.timerId = timer.toString();
          }}
          onPointerUp={(e) => {
            clearTimeout(Number(e.currentTarget.dataset.timerId));
          }}
          onPointerLeave={(e) => {
            clearTimeout(Number(e.currentTarget.dataset.timerId));
          }}
        >
          <span className="text-sm font-bold tracking-widest text-gray-500 uppercase">Date</span>
          <div className="text-4xl font-nothing font-normal tracking-wide mt-1 text-secondary uppercase flex justify-end overflow-hidden w-40 pointer-events-auto">
            <AnimatePresence mode="popLayout">
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
                  <motion.span
                    key={activeOuterIndex}
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`inline-block ${colorClass} ${selectedMode === 'FINANCE' || selectedMode === 'MINDFUL' ? 'cursor-pointer active:scale-95' : ''}`}
                    onClick={(e) => {
                      if (selectedMode === 'FINANCE') {
                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
                        setSelectedTxDate(dateStr);
                        setIsDateTxListOpen(true);
                      } else if (selectedMode === 'MINDFUL') {
                        // Handle single vs double click
                        if (e.detail === 1) {
                          const timer = setTimeout(() => {
                            setMindfulView('PLANNER');
                            setIsPlanOpen(true);
                          }, 200);
                          e.currentTarget.dataset.clickTimer = timer.toString();
                        } else if (e.detail === 2) {
                          clearTimeout(Number(e.currentTarget.dataset.clickTimer));
                          setMindfulView('JRNL');
                          setIsJournalOpen(true);
                        }
                      }
                    }}
                  >
                    {dateStr}
                  </motion.span>
                );
              })()}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-6 pr-32 overflow-y-auto pb-32 z-10 relative scrollbar-hide pointer-events-none mt-10">
        <div className="mt-8 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.h2
              key={currentTitle}
              layoutId="main-title"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="text-xl font-bold uppercase tracking-widest text-gray-400 mb-4"
            >
              {currentTitle}
            </motion.h2>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {selectedMode === 'TASKS' && (
              <motion.div
                key="tasks-view"
                initial={{ opacity: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.3 }}
                className="space-y-3 font-plex"
              >
                <AnimatePresence>
                  {tasks.filter(t => (t.dueDate || '').toUpperCase() === outerOptions[activeOuterIndex].toUpperCase()).map(task => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      key={task.id}
                      className="relative mb-6 w-full h-12 pointer-events-none"
                    >
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.4}
                        onDragEnd={(_, info) => {
                          const threshold = 60;
                          if (info.offset.x > threshold) {
                            handleTaskProperties(task);
                          } else if (info.offset.x < -threshold) {
                            if (task.id) handleTaskComplete(task.id);
                          }
                        }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full absolute inset-0 flex items-center cursor-pointer pointer-events-auto"
                        animate={{
                          opacity: task.completed ? 0.3 : 1,
                          scale: 1,
                          x: 0,
                        }}
                      >
                        <div className="relative inline-block">
                          {/* Visual completion line */}
                          <div className={`absolute top-1/2 left-0 w-full h-[2px] bg-tertiary -translate-y-1/2 rounded-full transition-all duration-300 ease-out origin-left pointer-events-none ${task.completed ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'}`} />

                          <h3 className={`font-bold text-lg uppercase tracking-wide transition-colors duration-300 ${task.completed ? 'text-gray-500' : 'text-secondary'}`}>
                            {task.title}
                          </h3>
                        </div>
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {selectedMode === 'FINANCE' && (() => {
              const monthTx = transactions.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === selectedChartMonth && d.getFullYear() === selectedChartYear;
              });
              const incomeTotal = monthTx.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
              const expenseTotal = monthTx.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
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
                        key={`${incomeTotal}-${expenseTotal}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl font-nothing tracking-wider text-secondary mt-1"
                      >
                        ${(incomeTotal - expenseTotal).toFixed(0)}
                      </motion.span>
                    </div>
                  </div>

                  {/* Finance View Rendering - simplified to just show bars and transactions */}
                  <div className="flex flex-col gap-8">
                    {/* Income / Expense Bars */}
                    <div className="w-[70%]">
                      <div className="flex gap-8">
                        <div className="flex flex-col items-center flex-1">
                          <span className="font-nothing text-[10px] uppercase tracking-widest mb-2 text-secondary">INCOME</span>
                          <div className="w-full h-24 border border-[var(--btn-inner-border)] rounded-sm relative overflow-hidden bg-[var(--inset-bg)] shadow-[var(--inset-shadow)]">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${incomePct}%` }}
                              transition={{ type: "spring", stiffness: 60, damping: 15 }}
                              className="absolute bottom-0 w-full border-t border-[var(--quaternary-color)]"
                              style={{
                                background: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(78,104,81,0.2) 4px, rgba(78,104,81,0.2) 6px)`
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
                            <span className="font-nothing text-[10px] uppercase tracking-widest text-secondary">Expense</span>
                          </div>
                          <div className="w-full h-24 border border-[var(--btn-inner-border)] rounded-sm relative overflow-hidden bg-[var(--inset-bg)] shadow-[var(--inset-shadow)]">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${expensePct}%` }}
                              transition={{ type: "spring", stiffness: 60, damping: 15 }}
                              className="absolute bottom-0 w-full border-t border-[var(--tertiary-color)]"
                              style={{
                                background: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(184,58,45,0.2) 4px, rgba(184,58,45,0.2) 6px)`
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
                          const monthTx = transactions.filter(t => {
                            const d = new Date(t.date);
                            return d.getMonth() === selectedChartMonth && d.getFullYear() === selectedChartYear;
                          });

                          if (monthTx.length === 0) {
                            return <p className="text-sm text-gray-500 italic mt-4 text-center uppercase tracking-widest font-sans font-bold">No activity.</p>;
                          }

                          const sortedTx = [...monthTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                          return sortedTx.slice(0, 5).map(tx => (
                            <motion.div
                              layout
                              key={tx.id}
                              onClick={() => setSelectedTransaction(tx)}
                              className="flex items-center justify-between py-3 px-2 border-b border-[var(--inset-border)] cursor-pointer active:scale-95 transition-transform"
                            >
                              <div className="flex flex-col">
                                <span className="font-bold text-secondary text-sm font-plex tracking-wider">{tx.title || tx.category}</span>
                                <span className="text-[8px] text-gray-400 uppercase tracking-[0.2em]">
                                  {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <span className={`font-mono text-sm font-bold tracking-tighter ${tx.type === 'income' ? 'text-quaternary' : 'text-secondary'}`}>
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
            })()}

            {selectedMode === 'TOOLS' && (
              <motion.div
                key="tools-view"
                layoutId="main-content-panel"
                layout
                initial={{ opacity: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                className="font-plex space-y-8 pb-32 pointer-events-auto flex flex-col items-center justify-center mt-20"
              >
                <div className="text-secondary font-nothing text-2xl tracking-widest uppercase opacity-80 mb-6 drop-shadow-md">
                  {outerOptions[activeOuterIndex]}
                </div>

                <div className="text-center mt-12 opacity-30 px-6">
                  <div className="flex justify-center gap-2 mb-2">
                    <div className="w-1 h-1 bg-secondary rounded-full"></div>
                    <div className="w-1 h-1 bg-secondary rounded-full"></div>
                    <div className="w-1 h-1 bg-secondary rounded-full"></div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Rotate outer wheel to select.</p>
                </div>
              </motion.div>
            )}

            {selectedMode === 'MINDFUL' && (
              <motion.div
                key="mindful-view"
                layoutId="mindful-view"
                layout
                initial={{ opacity: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                className="font-plex space-y-8 pb-32 pointer-events-auto"
              >
                {/* Sub-mode Selection */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex bg-secondary/5 rounded-full p-1 border border-secondary/10">
                    {['PLANNER', 'JRNL'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setMindfulView(v as any)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all ${mindfulView === v ? 'bg-secondary text-primary' : 'text-gray-500 hover:text-secondary'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Folder Stack UI */}
                <div className="relative h-48 mb-12">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={selectedChartMonth}
                      initial={{ y: 20, opacity: 0, scale: 0.95 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: -20, opacity: 0, scale: 0.95 }}
                      className="absolute inset-0"
                    >
                      {/* Paper Layers */}
                      <div className="absolute inset-0 bg-secondary/5 border border-secondary/10 rounded-lg transform translate-x-2 translate-y-2"></div>
                      <div className="absolute inset-0 bg-secondary/5 border border-secondary/10 rounded-lg transform translate-x-1 translate-y-1"></div>
                      <div className="absolute inset-0 bg-[var(--bg-hardware)] border border-secondary/20 rounded-lg p-6 shadow-xl flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <span className="text-2xl font-bold uppercase tracking-[0.3em] text-secondary">
                            {new Date(selectedChartYear, selectedChartMonth).toLocaleString('default', { month: 'long' })}
                          </span>
                          <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">{selectedChartYear}</span>
                        </div>
                        <div className="flex justify-between items-end">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Active Day</span>
                            <span className="text-lg font-nothing text-secondary">{outerOptions[activeOuterIndex]}</span>
                          </div>
                          <div className="w-8 h-8 rounded-full border border-secondary/20 flex items-center justify-center text-xs text-secondary/40">
                            DOC
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Grid Overview */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">
                      # {mindfulView} THIS MONTH
                    </span>
                    <div className="w-12 h-[2px] bg-secondary/20 rounded-full"></div>
                  </div>

                  <div className="grid grid-cols-7 gap-x-2 gap-y-3 pt-2">
                    {genericDates.map((d, i) => {
                      // Mocking "presence" for now. 
                      // Red means planner only, Green means journal+planner.
                      // Logic: let's say odd days have planner, even days have both? Just a demo.
                      const hasPlanner = i % 3 === 0;
                      const hasJournal = i % 2 === 0;

                      let dotColor = 'bg-gray-800';
                      if (hasJournal && hasPlanner) dotColor = 'bg-quaternary shadow-[0_0_8px_rgba(78,104,81,0.6)]';
                      else if (hasPlanner) dotColor = 'bg-tertiary shadow-[0_0_8px_rgba(184,58,45,0.6)]';

                      return (
                        <div key={d} className="flex flex-col items-center gap-1">
                          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${dotColor}`}></div>
                          {d === outerOptions[activeOuterIndex] && (
                            <div className="w-4 h-[1px] bg-secondary/30 mt-0.5 animate-pulse"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <div className="flex items-center gap-1.5 grayscale opacity-50">
                      <div className="w-1.5 h-1.5 rounded-full bg-quaternary"></div>
                      <span className="text-[8px] uppercase font-bold text-gray-400">JRNL + PLAN</span>
                    </div>
                    <div className="flex items-center gap-1.5 grayscale opacity-50">
                      <div className="w-1.5 h-1.5 rounded-full bg-tertiary"></div>
                      <span className="text-[8px] uppercase font-bold text-gray-400">PLAN ONLY</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                <span
                  className={`font-mono text-xs absolute left-0 ${colorClass}`}
                  style={{
                    transform: 'rotate(90deg)',
                    pointerEvents: (selectedMode === 'FINANCE' && isActive) ? 'auto' : 'none',
                    cursor: (selectedMode === 'FINANCE' && isActive) ? 'pointer' : 'default'
                  }}
                  onClick={(e) => {
                    if (selectedMode === 'FINANCE' && isActive) {
                      e.stopPropagation();
                      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
                      setSelectedTxDate(opt);
                      setIsDateTxListOpen(true);
                    }
                  }}
                >
                  {opt}
                </span>
                <div className="absolute left-10 text-gray-600 top-1/2 -translate-y-1/2 font-bold opacity-30 pointer-events-none">▶</div>
              </div>
            );
          })}
        </motion.div>

        {/* Inner Wheel (Modes) */}
        <motion.div
          className="absolute inset-[60px] border border-[var(--inset-border)] bg-[var(--wheel-inner-bg)] backdrop-blur-md rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[var(--wheel-shadow-inner)]"
          style={{ rotate: innerRotate }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0}
          onDrag={(_, info) => {
            // Reduced sensitivity for larger scroll distance
            innerRotate.set(innerRotate.get() - info.delta.y * 0.3);
          }}
          onDragEnd={(_, info) => {
            const currentRot = innerRotate.get();
            const segment = 360 / modes.length;
            const velocityRot = currentRot - (info.velocity.y * 0.05);
            const nearestSeg = Math.round(velocityRot / segment) * segment;

            // Snappy calculation
            animate(innerRotate, nearestSeg, {
              type: "spring",
              stiffness: 950, // Increased for snappier feel
              damping: 28, // Decreased for more bounce
              mass: 0.4, // Lighter feel
              onUpdate: (latest) => {
                const segment = 360 / modes.length;
                // Direct mapping using the raw rotation (negated)
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
          layoutId="bottom-button-morph"
          className="braun-btn w-full h-[60px]"
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
            if (selectedMode === 'TASKS') {
              const activeDate = outerOptions[activeOuterIndex];
              setScheduleDate(activeDate);
              setDueDate(activeDate);
              setIsAddTaskOpen(true);
            }
            else if (selectedMode === 'FINANCE') setIsAddTransactionOpen(true);
            else if (selectedMode === 'MINDFUL') {
              if (mindfulView === 'PLANNER') setIsPlanOpen(true);
              else setIsJournalOpen(true);
            }
            else if (selectedMode === 'TOOLS') setIsToolsOpen(true);
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
                {selectedMode === 'MINDFUL' && (
                  <>
                    <Calendar className={`w-5 h-5 ${mindfulView === 'PLANNER' ? 'text-secondary' : 'text-gray-500'}`} />
                    <span className="uppercase">{mindfulView === 'PLANNER' ? 'PLAN' : 'JOURNAL'}</span>
                  </>
                )}
                {selectedMode === 'TOOLS' && <><Wrench className="w-5 h-5 text-secondary" /> <span className="uppercase">OPEN TOOL</span></>}
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

                    // Persist updates to DB or local state
                    if (db && typeof propertiesModalTask.id === 'string') {
                      await updateDoc(doc(db, 'tasks', propertiesModalTask.id), {
                        title: propertiesModalTask.title,
                        dueDate: propertiesModalTask.dueDate || null
                      });
                    } else {
                      setTasks(tasks.map(t => t.id === propertiesModalTask.id ? propertiesModalTask : t));
                    }

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
                            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5);
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

                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-widest mb-3 block font-nothing">Types</span>
                    <div className="flex flex-wrap gap-2">
                      {taskTypes.map(t => {
                        const isActive = propertiesModalTask.types.includes(t);
                        return (
                          <span
                            key={t}
                            onClick={() => {
                              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
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
                layoutId="bottom-button-morph"
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
                      autoFocus
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
      {/* Plan Bottom Sheet Modal */}
      <AnimatePresence>
        {
          isPlanOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
                onClick={() => setIsPlanOpen(false)}
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
                  // Swipe up OR down to save
                  if (Math.abs(info.offset.y) > 100 || Math.abs(info.velocity.y) > 500) {
                    setIsPlanOpen(false);
                  }
                }}
                className="absolute bottom-0 left-0 right-0 h-[85vh] z-50 hardware-panel rounded-t-[40px] flex flex-col font-plex text-secondary border-t border-x border-secondary/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] touch-none"
              >
                <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
                  <div className="w-16 h-1 bg-gray-600 rounded-full"></div>
                </div>

                <div className="flex-1 px-8 py-6 flex flex-col overflow-y-auto">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold uppercase tracking-widest text-secondary">Daily Plan</h2>
                    <span className="text-xs text-gray-500 uppercase font-nothing">&uarr; Swipe to Save</span>
                  </div>

                  <div className="space-y-8 pb-32">
                    <div>
                      <h3 className="text-xs uppercase tracking-widest font-nothing text-gray-500 mb-3">1% Goal / 1 Thing To Accomplish</h3>
                      <textarea
                        placeholder="What is the one thing that will make today a win?"
                        className="w-full bg-secondary/5 border border-secondary/20 rounded-xl p-4 text-sm focus:outline-none focus:border-quaternary transition-colors resize-none placeholder:text-gray-600"
                        rows={3}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs uppercase tracking-widest font-nothing text-gray-500">Today's To-Do</h3>
                      </div>

                      <div className="space-y-2 mb-3">
                        {/* Synced directly from tasks */}
                        {tasks.filter(t => !t.completed).slice(0, 3).map(task => (
                          <div key={task.id} className="p-3 border border-secondary/20 rounded flex items-center gap-3">
                            <div className="w-3 h-3 border border-secondary rounded-full"></div>
                            <span className="text-sm font-bold uppercase">{task.title}</span>
                          </div>
                        ))}
                        {tasks.length === 0 && <span className="text-sm text-gray-600 mb-2 block">No tasks tracked for today.</span>}
                      </div>

                      {/* Add Inline Task */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="New task for today..."
                          className="flex-1 bg-transparent border-b border-quaternary/50 py-2 text-sm uppercase tracking-widest focus:outline-none focus:border-quaternary transition-colors"
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              const newTask = { title: e.currentTarget.value, types: ['Routine'], completed: false };
                              if (db) {
                                await addDoc(collection(db, 'tasks'), newTask);
                              } else {
                                setTasks([...tasks, { id: Date.now(), ...newTask }]);
                              }
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                        <button className="px-4 py-2 bg-quaternary text-primary font-bold text-xs uppercase tracking-widest rounded transition-transform hover:scale-105 active:scale-95">
                          Add
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs uppercase tracking-widest font-nothing text-gray-500 mb-3">Meetings / Appointments</h3>
                      <div className="border border-dashed border-tertiary/50 text-tertiary rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-tertiary/10 transition-colors">
                        <span className="text-xl">+</span>
                        <span className="text-xs uppercase tracking-widest font-bold">Add Time Block</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )
        }
      </AnimatePresence >

      {/* Journal Bottom Sheet Modal */}
      <AnimatePresence>
        {
          isJournalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
                onClick={() => setIsJournalOpen(false)}
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
                  // Swipe up OR down to save
                  if (Math.abs(info.offset.y) > 100 || Math.abs(info.velocity.y) > 500) {
                    setIsJournalOpen(false);
                  }
                }}
                className="absolute bottom-0 left-0 right-0 h-[85vh] z-50 hardware-panel rounded-t-[40px] flex flex-col font-plex text-secondary border-t border-x border-secondary/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] touch-none"
              >
                <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
                  <div className="w-16 h-1 bg-gray-600 rounded-full"></div>
                </div>

                <div className="flex-1 px-8 py-6 flex flex-col overflow-y-auto">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold uppercase tracking-widest text-secondary">Journal Entry</h2>
                    <span className="text-xs text-gray-500 uppercase font-nothing">&uarr; Swipe to Save</span>
                  </div>

                  <div className="space-y-8 pb-32">
                    <div>
                      <h3 className="text-xs uppercase tracking-widest font-nothing text-quaternary mb-3">Diary Entry</h3>
                      <textarea
                        placeholder="What happened today?"
                        className="w-full bg-secondary/5 border border-secondary/20 rounded-xl p-4 text-sm focus:outline-none focus:border-quaternary transition-colors resize-y min-h-[120px] placeholder:text-gray-600"
                      />
                    </div>

                    <div>
                      <h3 className="text-xs uppercase tracking-widest font-nothing text-tertiary mb-3">Moments of the Day</h3>
                      <textarea
                        placeholder="Highlights, quotes, or wins."
                        className="w-full bg-secondary/5 border border-secondary/20 rounded-xl p-4 text-sm focus:outline-none focus:border-tertiary transition-colors resize-y min-h-[80px] placeholder:text-gray-600"
                      />
                    </div>

                    <div>
                      <h3 className="text-xs uppercase tracking-widest font-nothing text-gray-500 mb-3">Brain Dump</h3>
                      <textarea
                        placeholder="Clear your mind..."
                        className="w-full bg-transparent border-none p-0 text-sm focus:outline-none focus:border-none resize-y min-h-[100px] placeholder:text-gray-600"
                      />
                    </div>

                    {/* Automated hooks */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-secondary/5 rounded-xl p-4 border border-secondary/10">
                        <h3 className="text-[10px] uppercase font-bold text-tertiary mb-2">Logged Funds</h3>
                        <p className="text-xs text-gray-400 italic">Syncing via Firestore...</p>
                      </div>
                      <div className="bg-quaternary/10 text-quaternary rounded-xl p-4 border border-quaternary/30 flex flex-col items-center justify-center cursor-pointer hover:bg-quaternary/20 transition-colors">
                        <span className="text-xl mb-1">+</span>
                        <span className="text-[10px] uppercase font-bold">Add Photo</span>
                      </div>
                    </div>
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
                layoutId="bottom-button-morph"
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
                        const newTx = {
                          title: txTitle || 'Untitled',
                          amount: Number(txAmount),
                          type: txType,
                          category: txCategory || categoriesList[0],
                          paymentMethod: txPaymentMethod || paymentMethods[0],
                          note: txNote,
                          date: new Date(txDateStr + 'T12:00:00Z').toISOString()
                        };

                        if (db) {
                          // Import dynamically if needed, or assume addDoc is clean
                          const { addTransaction } = await import('./services/db');
                          await addTransaction(newTx);
                        } else {
                          setTransactions([{ id: String(Date.now()), ...newTx }, ...transactions]);
                        }

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

      {/* Global Date Selector Modal */}
      <AnimatePresence>
        {isGlobalDateSelectorOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setIsGlobalDateSelectorOpen(false)}
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="absolute top-[10%] left-[10%] right-[10%] bottom-[20%] z-50 hardware-panel rounded-[30px] flex flex-col font-plex text-secondary border border-secondary/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8 border-b border-secondary/20 pb-4">
                <span className="text-sm font-bold uppercase tracking-widest text-gray-500 leading-none">Select Date</span>
                <button onClick={() => setIsGlobalDateSelectorOpen(false)} className="text-xs font-bold uppercase tracking-widest leading-none bg-[var(--inset-bg)] border border-[var(--inset-border)] px-4 py-2 rounded-full cursor-pointer active:scale-95 shadow-[var(--btn-shadow-outer)]">Done</button>
              </div>

              <div className="flex-1 flex gap-4 h-full relative">
                {/* Visual selection glass bar */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-16 bg-secondary/10 border-y border-secondary/20 pointer-events-none rounded-lg" />

                {/* Month Wheel */}
                <div
                  className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide py-[50%] flex flex-col items-center gap-4 relative"
                  onScroll={(e) => {
                    const idx = Math.round(e.currentTarget.scrollTop / 48); // 48px is approx height of item + gap
                    if (idx >= 0 && idx < 12 && idx !== selectedChartMonth) {
                      setSelectedChartMonth(idx);
                      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5);
                    }
                  }}
                >
                  {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((m) => (
                    <div key={m} className="h-12 w-full flex items-center justify-center shrink-0 snap-center text-2xl font-nothing text-secondary cursor-pointer">
                      {m}
                    </div>
                  ))}
                </div>

                {/* Year Wheel */}
                <div
                  className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide py-[50%] flex flex-col items-center gap-4 border-l border-secondary/20 relative"
                  onScroll={(e) => {
                    const idx = Math.round(e.currentTarget.scrollTop / 48);
                    const years = Array.from({ length: 20 }, (_, i) => 2020 + i);
                    if (idx >= 0 && idx < years.length) {
                      const year = years[idx];
                      if (year !== selectedChartYear) {
                        setSelectedChartYear(year);
                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5);
                      }
                    }
                  }}
                >
                  {Array.from({ length: 20 }, (_, i) => 2020 + i).map((y) => (
                    <div key={y} className="h-12 w-full flex items-center justify-center shrink-0 snap-center text-3xl font-mono tracking-tighter text-secondary font-bold cursor-pointer">
                      {y}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tools Full View Modal */}
      <AnimatePresence>
        {isToolsOpen && (
          <>
            {/* Dark overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setIsToolsOpen(false)}
            />

            {/* Scale up content container */}
            <motion.div
              layoutId="bottom-button-morph" // Morph from action button if clicked
              initial={{ y: '100%', borderRadius: '40px' }}
              animate={{ y: 0, borderRadius: '40px' }}
              exit={{ y: '100%', borderRadius: '40px' }}
              transition={{ type: 'spring', damping: 25, stiffness: 350, mass: 0.8 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                // Swipe up OR down to close
                if (Math.abs(info.offset.y) > 100 || Math.abs(info.velocity.y) > 500) {
                  setIsToolsOpen(false);
                }
              }}
              className="absolute bottom-0 left-0 right-0 h-[85vh] z-50 bg-[var(--bg-hardware)] rounded-t-[40px] flex flex-col items-center border-t border-x border-[var(--inset-border)] shadow-[var(--wheel-shadow-inner)] touch-none"
            >
              {/* Drag Indicator */}
              <div className="w-full flex justify-center py-4 cursor-grab active:cursor-grabbing shrink-0 z-50">
                <div className="w-16 h-1 bg-gray-600 rounded-full"></div>
              </div>

              {/* Tool Header */}
              <div className="w-full text-center px-4 flex flex-col mb-4">
                <span className="font-serif italic text-sm text-secondary opacity-60">closing tool widget</span>
                <span className="font-nothing text-2xl tracking-widest text-secondary drop-shadow-md">
                  SWIPE DOWN
                </span>
              </div>

              {/* The Actual Tool Rendered inside the Modal */}
              <div className="flex-1 w-full flex justify-center items-center pointer-events-auto pb-10">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={toolViews[activeOuterIndex]}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 20 }}
                  >
                    {/* POMODORO */}
                    {toolViews[activeOuterIndex] === 'POMODORO' && (
                      <div className="hardware-panel rounded-[40px] w-full max-w-[320px] p-6 flex flex-col items-center relative shadow-2xl overflow-hidden border border-gray-700/30">
                        {/* Inner Screen Bezel */}
                        <div className="w-full h-32 hardware-inset rounded-2xl mb-8 flex flex-col items-center justify-center relative p-2 border-t-2 border-black">
                          <div className="absolute top-2 left-3 flex gap-2">
                            <span className={`text-[8px] tracking-widest uppercase font-bold transition-colors ${pomodoroMode === 'FOCUS' ? 'text-tertiary' : 'text-gray-600'}`}>Focus</span>
                            <span className={`text-[8px] tracking-widest uppercase font-bold transition-colors ${pomodoroMode === 'BREAK' ? 'text-quaternary' : 'text-gray-600'}`}>Break</span>
                          </div>
                          <span className="font-nothing text-5xl text-secondary drop-shadow-[0_0_8px_rgba(220,201,169,0.3)] tracking-widest mt-2">{formatTime(pomodoroTime)}</span>

                          <motion.div
                            animate={{ opacity: isPomodoroRunning ? [1, 0.2, 1] : 0.1 }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="absolute top-3 right-4 w-2 h-2 rounded-full bg-tertiary shadow-[0_0_5px_rgba(184,58,45,0.8)]"
                          />
                        </div>

                        {/* Physical Controls */}
                        <div className="flex gap-6 items-center w-full px-4 justify-between">
                          <button
                            onClick={() => {
                              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
                              setIsPomodoroRunning(false);
                              setPomodoroMode(m => m === 'FOCUS' ? 'BREAK' : 'FOCUS');
                              setPomodoroTime(pomodoroMode === 'FOCUS' ? 5 * 60 : 25 * 60);
                            }}
                            className="w-12 h-12 rounded-full hardware-panel flex items-center justify-center active:scale-95 transition-all shadow-md active:shadow-inner border-b-2 border-black cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-full matte-glass flex items-center justify-center text-[10px] uppercase font-bold text-gray-400">CHG</div>
                          </button>

                          <button
                            onClick={() => {
                              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
                              setIsPomodoroRunning(!isPomodoroRunning);
                            }}
                            className={`w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-all shadow-xl cursor-pointer border-b-4 border-black ${isPomodoroRunning ? 'bg-tertiary shadow-[0_5px_15px_rgba(184,58,45,0.4)]' : 'bg-secondary shadow-[0_5px_15px_rgba(220,201,169,0.2)]'}`}
                          >
                            <div className="w-16 h-16 rounded-full bg-black/10 flex items-center justify-center">
                              <span className={`font-bold font-nothing tracking-widest text-lg ${isPomodoroRunning ? 'text-white' : 'text-primary'}`}>{isPomodoroRunning ? 'PAUSE' : 'START'}</span>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
                              setIsPomodoroRunning(false);
                              setPomodoroTime(pomodoroMode === 'FOCUS' ? 25 * 60 : 5 * 60);
                            }}
                            className="w-12 h-12 rounded-full hardware-panel flex items-center justify-center active:scale-95 transition-all shadow-md active:shadow-inner border-b-2 border-black cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-full matte-glass flex items-center justify-center text-[10px] uppercase font-bold text-gray-400">RST</div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CALCULATOR */}
                    {toolViews[activeOuterIndex] === 'CALCULATOR' && (
                      <div className="hardware-panel rounded-[40px] w-full max-w-[320px] p-6 flex flex-col relative shadow-2xl border border-gray-700/30">
                        <div className="w-full h-24 bg-[#8b9380] rounded-xl mb-6 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] border-2 border-black flex items-end justify-end p-4 overflow-hidden relative">
                          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
                          <span className="font-nothing text-4xl text-black/80 tracking-widest leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.2)]">
                            {calcDisplay.length > 9 ? Number(calcDisplay).toExponential(2) : calcDisplay}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                          {['C', '±', '%', '÷', '7', '8', '9', 'x', '4', '5', '6', '-', '1', '2', '3', '+', '0', '00', '.', '='].map((keypad) => {
                            const isOp = ['÷', 'x', '-', '+', '='].includes(keypad);
                            const isClear = keypad === 'C';

                            return (
                              <button
                                key={keypad}
                                onClick={() => handleCalcPress(keypad)}
                                className={`
                                  relative h-14 rounded-xl hardware-panel flex items-center justify-center font-bold text-lg cursor-pointer
                                  active:translate-y-1 active:shadow-[inset_0_3px_5px_rgba(0,0,0,0.5)] transition-all shadow-md border-b-4
                                  ${isOp ? 'bg-secondary text-primary border-yellow-900/50' : isClear ? 'bg-tertiary text-white border-red-900/50' : 'bg-[#181818] text-gray-300 border-black'}
                                `}
                              >
                                <div className="w-full h-full rounded-lg matte-glass absolute inset-0 opacity-20 pointer-events-none"></div>
                                <span className="relative z-10 font-plex drop-shadow-md">{keypad}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* RECORDER */}
                    {toolViews[activeOuterIndex] === 'RECORDER' && (
                      <div className="hardware-panel rounded-[40px] w-full max-w-[320px] p-6 flex flex-col items-center relative shadow-2xl border border-gray-700/30">
                        <div className="w-full h-32 hardware-inset rounded-xl mb-8 flex flex-col items-center justify-center relative p-3 border-t-2 border-black overflow-hidden">
                          <div className="absolute inset-0 flex justify-between px-6 items-center opacity-30">
                            <div className={`w-16 h-16 rounded-full border-4 border-gray-600 flex items-center justify-center ${isRecording ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
                              <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                            </div>
                            <div className={`w-16 h-16 rounded-full border-4 border-gray-600 flex items-center justify-center ${isRecording ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
                              <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                            </div>
                          </div>

                          <div className="z-10 flex flex-col items-center">
                            <span className="font-nothing text-3xl text-secondary tracking-widest bg-[var(--inset-bg)]/80 px-2 rounded">{formatTime(recordTime)}</span>
                            {isRecording && <span className="text-[10px] text-tertiary uppercase font-bold mt-1 tracking-widest animate-pulse">Recording...</span>}
                            {!isRecording && recordedAudioUrl && <span className="text-[10px] text-green-500 uppercase font-bold mt-1 tracking-widest">Saved to Temp</span>}
                          </div>
                        </div>

                        {recordedAudioUrl && !isRecording && (
                          <div className="w-full mb-6 hardware-inset rounded-full px-4 py-2 border border-black/50">
                            <audio controls src={recordedAudioUrl} className="w-full h-8" />
                          </div>
                        )}

                        <div className="flex gap-4 items-center w-full justify-center">
                          <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-20 h-24 rounded-lg hardware-panel flex flex-col items-center justify-center active:translate-y-2 transition-all shadow-lg border-b-8 ${isRecording ? 'border-tertiary bg-black shadow-[inset_0_5px_15px_rgba(184,58,45,0.3)] translate-y-2' : 'border-gray-900 bg-[#181818]'}`}
                          >
                            <div className={`w-4 h-4 rounded-full mb-2 shadow-inner ${isRecording ? 'bg-tertiary shadow-[0_0_10px_rgba(184,58,45,1)]' : 'bg-red-900/40'}`}></div>
                            <span className="text-xs font-bold text-gray-500 tracking-wider">REC</span>
                          </button>

                          <button
                            onClick={stopRecording}
                            disabled={!isRecording}
                            className={`w-16 h-24 rounded-lg hardware-panel flex flex-col items-center justify-center active:translate-y-2 transition-all shadow-lg border-b-8 border-gray-900 bg-[#181818] ${!isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="w-4 h-4 rounded bg-gray-700/50 mb-2 shadow-inner"></div>
                            <span className="text-xs font-bold text-gray-500 tracking-wider">STOP</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* COMPASS */}
                    {toolViews[activeOuterIndex] === 'COMPASS' && (
                      <div className="hardware-panel rounded-full w-[300px] h-[300px] p-4 flex flex-col items-center justify-center relative shadow-2xl border-2 border-gray-700/50">
                        <div className="w-full h-full rounded-full hardware-inset border-t-4 border-black/80 flex items-center justify-center relative shadow-[inset_0_10px_30px_rgba(0,0,0,0.8)] overflow-hidden">
                          <div className="absolute z-30 w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-600 shadow-md flex items-center justify-center">
                            <div className="w-2 h-2 bg-black"></div>
                          </div>

                          {compassHeading !== null ? (
                            <motion.div
                              className="w-[85%] h-[85%] rounded-full relative"
                              animate={{ rotate: -compassHeading }}
                              transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                            >
                              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-tertiary font-bold text-xl font-plex drop-shadow-md">N</div>
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-secondary font-bold text-xl font-plex">S</div>
                              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-secondary font-bold text-xl font-plex">W</div>
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary font-bold text-xl font-plex">E</div>

                              {Array.from({ length: 24 }).map((_, i) => (
                                <div
                                  key={`tick-${i}`}
                                  className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-secondary/30 origin-center"
                                  style={{ transform: `rotate(${i * 15}deg)`, height: '100%' }}
                                ></div>
                              ))}

                              <div className="absolute top-8 bottom-1/2 left-1/2 -translate-x-1/2 w-2 bg-gradient-to-b from-tertiary to-red-900 rounded-t-full z-20 shadow-lg" style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}></div>
                              <div className="absolute top-1/2 bottom-8 left-1/2 -translate-x-1/2 w-2 bg-gradient-to-t from-gray-200 to-gray-500 rounded-b-full z-20 shadow-lg" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}></div>
                            </motion.div>
                          ) : (
                            <div className="text-center px-8 z-20">
                              <span className="text-secondary font-plex text-sm opacity-50 block mb-2">Sensor Unavailable</span>
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest">Please ensure device orientation is supported and granted.</span>
                            </div>
                          )}

                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-4 bg-yellow-500/80 z-40 rounded-b"></div>
                        </div>
                      </div>
                    )}

                    {/* QR GEN */}
                    {toolViews[activeOuterIndex] === 'QR GEN' && (
                      <div className="hardware-panel rounded-[40px] w-full max-w-[320px] p-6 flex flex-col items-center relative shadow-2xl border border-gray-700/30">
                        <div className="w-full h-48 bg-white/90 hardware-inset rounded-lg mb-6 flex flex-col items-center justify-center p-4 border-2 border-gray-400 overflow-hidden relative">
                          <div className="absolute top-0 left-0 w-full h-2 bg-black/20" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, #000 4px, #000 8px)' }}></div>

                          {qrInput ? (
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrInput)}&color=000000&bgcolor=ffffff`}
                              className="w-32 h-32 object-contain mix-blend-multiply opacity-90 filter contrast-125"
                              alt="QR Code"
                            />
                          ) : (
                            <div className="w-32 h-32 border-2 border-dashed border-gray-300 flex items-center justify-center">
                              <span className="text-gray-400 font-plex text-[10px] uppercase font-bold text-center px-4">Enter URL to Print</span>
                            </div>
                          )}

                          <div className="absolute bottom-0 left-0 w-full h-2 bg-black/20" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, #000 4px, #000 8px)' }}></div>
                        </div>

                        <div className="w-full flex">
                          <input
                            type="text"
                            value={qrInput}
                            onChange={(e) => setQrInput(e.target.value)}
                            placeholder="HTTPS://..."
                            className="flex-1 bg-black/50 text-secondary border-2 border-black rounded-l-lg p-3 font-plex text-sm focus:outline-none focus:border-tertiary shadow-inner"
                          />
                          <button
                            onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); setQrInput(''); }}
                            className="bg-tertiary text-white font-bold p-3 rounded-r-lg border-2 border-l-0 border-black active:bg-red-900 active:shadow-inner transition-colors"
                          >
                            CLR
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CONVERTER */}
                    {toolViews[activeOuterIndex] === 'CONVERTER' && (
                      <div className="hardware-panel rounded-[40px] w-full max-w-[320px] p-6 flex flex-col items-center relative shadow-2xl border border-gray-700/30">
                        <div className="flex w-full bg-black/40 rounded-full p-1 mb-8 shadow-inner border border-white/5">
                          <button
                            onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); setConvType('LENGTH'); }}
                            className={`flex-1 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${convType === 'LENGTH' ? 'hardware-panel text-secondary shadow-md' : 'text-gray-500 hover:text-gray-400'}`}
                          >
                            cm → in
                          </button>
                          <button
                            onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); setConvType('WEIGHT'); }}
                            className={`flex-1 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${convType === 'WEIGHT' ? 'hardware-panel text-secondary shadow-md' : 'text-gray-500 hover:text-gray-400'}`}
                          >
                            kg → lb
                          </button>
                        </div>

                        <div className="w-full flex items-center justify-between hardware-inset rounded-xl p-4 border-2 border-black bg-gradient-to-b from-gray-900 to-black relative overflow-hidden mb-6">
                          <div className="flex flex-col flex-1 border-r border-white/10 pr-4">
                            <span className="text-[10px] text-tertiary font-bold mb-1 uppercase drop-shadow-md">{convType === 'LENGTH' ? 'Centimeters' : 'Kilograms'}</span>
                            <input
                              type="number"
                              value={convInput}
                              onChange={(e) => setConvInput(e.target.value)}
                              className="bg-transparent text-3xl font-nothing text-white tracking-widest focus:outline-none w-full"
                            />
                          </div>
                          <div className="flex flex-col flex-1 pl-4 text-right">
                            <span className="text-[10px] text-quaternary font-bold mb-1 uppercase drop-shadow-md">{convType === 'LENGTH' ? 'Inches' : 'Pounds'}</span>
                            <span className="text-3xl font-nothing text-secondary tracking-widest">{getConvertedVal()}</span>
                          </div>
                          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                        </div>

                        <div className="w-full flex justify-between px-8 opacity-20">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="w-2 h-8 rounded-full bg-black shadow-inner"></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
