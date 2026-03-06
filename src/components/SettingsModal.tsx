import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Info, Trash2, ChevronRight } from 'lucide-react';

type SettingsModalProps = {
      isOpen: boolean;
      onClose: () => void;
      isMuted: boolean;
      onToggleMute: () => void;
      themeName: string;
      onChangeTheme: (theme: string) => void;
      use24h: boolean;
      onToggle24h: () => void;
      hapticEnabled: boolean;
      onToggleHaptic: () => void;
      hiddenPages: string[];
      onTogglePage: (page: string) => void;
      onResetData: () => void;
};

// Reusable toggle switch
function Toggle({ isOn, onToggle, activeColor = 'bg-quaternary' }: { isOn: boolean; onToggle: () => void; activeColor?: string }) {
      return (
            <button
                  onClick={onToggle}
                  className={`w-11 h-6 rounded-full border transition-all flex items-center px-0.5 ${isOn ? `${activeColor}/30 border-quaternary/40` : 'bg-secondary/10 border-secondary/20'
                        }`}
            >
                  <motion.div
                        animate={{ x: isOn ? 18 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={`w-5 h-5 rounded-full ${isOn ? `${activeColor} shadow-[0_0_8px_rgba(78,104,81,0.4)]` : 'bg-gray-500'}`}
                  />
            </button>
      );
}

function SettingsModalInner({
      isOpen,
      onClose,
      isMuted,
      onToggleMute,
      themeName,
      onChangeTheme,
      use24h,
      onToggle24h,
      hapticEnabled,
      onToggleHaptic,
      hiddenPages,
      onTogglePage,
      onResetData,
}: SettingsModalProps) {
      const [showHelp, setShowHelp] = useState(false);
      const [showResetConfirm, setShowResetConfirm] = useState(false);

      const toggleablePages = ['CALENDAR', 'FINANCE', 'REVIEW'];

      return (
            <AnimatePresence>
                  {isOpen && (
                        <>
                              {/* Backdrop */}
                              <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                                    onClick={onClose}
                              />

                              {/* Panel */}
                              <motion.div
                                    initial={{ x: '100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '100%' }}
                                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                                    className="fixed top-0 right-0 bottom-0 w-[85%] max-w-[340px] z-50 hardware-panel border-l border-secondary/20 shadow-[-10px_0_30px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
                              >
                                    {/* Scrollable content */}
                                    <div className="flex-1 overflow-y-auto p-6">
                                          {/* Header */}
                                          <div className="flex justify-between items-center mb-8">
                                                <h2 className="text-sm font-bold uppercase tracking-widest text-secondary font-nothing">
                                                      Settings
                                                </h2>
                                                <button
                                                      onClick={onClose}
                                                      className="w-8 h-8 flex items-center justify-center rounded-full border border-secondary/20 hover:bg-secondary/10 active:scale-90 transition-all"
                                                >
                                                      <X className="w-4 h-4 text-secondary" />
                                                </button>
                                          </div>

                                          {/* Help overlay */}
                                          <AnimatePresence>
                                                {showHelp && (
                                                      <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 10 }}
                                                            className="absolute inset-0 z-10 hardware-panel p-6 overflow-y-auto"
                                                      >
                                                            <div className="flex justify-between items-center mb-6">
                                                                  <h3 className="text-sm font-bold uppercase tracking-widest text-secondary font-nothing">
                                                                        Help & Guide
                                                                  </h3>
                                                                  <button
                                                                        onClick={() => setShowHelp(false)}
                                                                        className="w-8 h-8 flex items-center justify-center rounded-full border border-secondary/20 hover:bg-secondary/10 active:scale-90 transition-all"
                                                                  >
                                                                        <X className="w-4 h-4 text-secondary" />
                                                                  </button>
                                                            </div>

                                                            <div className="space-y-5 text-xs text-secondary tracking-wider uppercase">
                                                                  <div>
                                                                        <span className="font-bold text-gray-400 block mb-1">Navigation</span>
                                                                        <p className="text-gray-500 leading-relaxed normal-case">Drag the <strong>outer wheel</strong> vertically to scroll through dates. Drag the <strong>inner wheel</strong> to switch between modes (Tasks, Calendar, Finance, Review).</p>
                                                                  </div>
                                                                  <div className="h-px bg-secondary/10" />
                                                                  <div>
                                                                        <span className="font-bold text-gray-400 block mb-1">Tasks</span>
                                                                        <p className="text-gray-500 leading-relaxed normal-case">Tap the <strong>bottom button</strong> to add a task for the selected date. Swipe a task <strong>left</strong> to see properties, <strong>right</strong> to complete. Tap the checkbox to toggle completion.</p>
                                                                  </div>
                                                                  <div className="h-px bg-secondary/10" />
                                                                  <div>
                                                                        <span className="font-bold text-gray-400 block mb-1">Finance</span>
                                                                        <p className="text-gray-500 leading-relaxed normal-case">Tap <strong>LOG FUNDS</strong> to add income or expenses. Tap a date on the wheel to see that day's transactions. Use the <strong>month selector</strong> in the header to navigate months.</p>
                                                                  </div>
                                                                  <div className="h-px bg-secondary/10" />
                                                                  <div>
                                                                        <span className="font-bold text-gray-400 block mb-1">Calendar</span>
                                                                        <p className="text-gray-500 leading-relaxed normal-case">See 5 days of upcoming tasks. Tap <strong>+view more</strong> to jump to that day in Tasks view.</p>
                                                                  </div>
                                                                  <div className="h-px bg-secondary/10" />
                                                                  <div>
                                                                        <span className="font-bold text-gray-400 block mb-1">Review</span>
                                                                        <p className="text-gray-500 leading-relaxed normal-case">Press <strong>PRINT LOG</strong> to generate a dot-matrix receipt summarizing your weekly productivity and finances.</p>
                                                                  </div>
                                                                  <div className="h-px bg-secondary/10" />
                                                                  <div>
                                                                        <span className="font-bold text-gray-400 block mb-1">Theme</span>
                                                                        <p className="text-gray-500 leading-relaxed normal-case">Swipe with <strong>3 fingers</strong> to toggle dark/light mode. Or use the toggle in Settings.</p>
                                                                  </div>
                                                            </div>
                                                      </motion.div>
                                                )}
                                          </AnimatePresence>

                                          {/* Settings List */}
                                          <div className="flex flex-col gap-5">
                                                {/* 24h Time */}
                                                <SettingRow
                                                      label="24-Hour Time"
                                                      description={use24h ? '14:30 format' : '2:30 PM format'}
                                                >
                                                      <Toggle isOn={use24h} onToggle={onToggle24h} />
                                                </SettingRow>

                                                <Divider />

                                                {/* Theme */}
                                                <div className="flex flex-col gap-3">
                                                      <span className="text-[11px] font-bold uppercase tracking-widest text-secondary block">
                                                            Theme
                                                      </span>
                                                      <div className="grid grid-cols-3 gap-2">
                                                            {[
                                                                  { id: 'theme-dark', label: 'DARK', bg: 'bg-[#0a0a0a]', border: 'border-white/20' },
                                                                  { id: 'theme-light', label: 'LIGHT', bg: 'bg-[#e4e6e8]', border: 'border-black/20' },
                                                                  { id: 'theme-cyberpunk', label: 'CYBER', bg: 'bg-[#0a0a0c]', border: 'border-[#FCEE0A]' },
                                                                  { id: 'theme-retro', label: 'RETRO', bg: 'bg-[#fef3c7]', border: 'border-[#d97706]' },
                                                                  { id: 'theme-sakura', label: 'SAKURA', bg: 'bg-[#ffe4e1]', border: 'border-[#ff8fab]' },
                                                                  { id: 'theme-ocean', label: 'OCEAN', bg: 'bg-[#0f172a]', border: 'border-[#38bdf8]' },
                                                            ].map((t) => (
                                                                  <button
                                                                        key={t.id}
                                                                        onClick={() => onChangeTheme(t.id)}
                                                                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${themeName === t.id ? t.border + ' scale-105 bg-black/10' : 'border-transparent opacity-60 hover:opacity-100 hover:bg-black/5'}`}
                                                                  >
                                                                        <div className={`w-8 h-8 rounded-full border border-secondary/20 shadow-inner ${t.bg}`} />
                                                                        <span className="text-[9px] font-bold uppercase tracking-widest text-secondary">{t.label}</span>
                                                                  </button>
                                                            ))}
                                                      </div>
                                                </div>

                                                <Divider />

                                                {/* Sound */}
                                                <SettingRow
                                                      label="Sound Effects"
                                                      description="Mechanical UI sounds"
                                                >
                                                      <Toggle isOn={!isMuted} onToggle={onToggleMute} />
                                                </SettingRow>

                                                <Divider />

                                                {/* Haptic */}
                                                <SettingRow
                                                      label="Haptic Feedback"
                                                      description="Vibration on interactions"
                                                      icon={<Smartphone className="w-3 h-3 text-gray-500" />}
                                                >
                                                      <Toggle isOn={hapticEnabled} onToggle={onToggleHaptic} />
                                                </SettingRow>

                                                <Divider />

                                                {/* Hidden Pages */}
                                                <div>
                                                      <span className="text-[11px] font-bold uppercase tracking-widest text-secondary block mb-3">
                                                            Visible Pages
                                                      </span>
                                                      <div className="flex flex-col gap-2">
                                                            {/* Tasks is always visible */}
                                                            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-secondary/5">
                                                                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Tasks</span>
                                                                  <span className="text-[9px] text-gray-600 uppercase tracking-wider">Always on</span>
                                                            </div>
                                                            {toggleablePages.map(page => (
                                                                  <div key={page} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/5 transition-colors">
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">{page}</span>
                                                                        <Toggle
                                                                              isOn={!hiddenPages.includes(page)}
                                                                              onToggle={() => onTogglePage(page)}
                                                                        />
                                                                  </div>
                                                            ))}
                                                      </div>
                                                </div>

                                                <Divider />

                                                {/* Help */}
                                                <button
                                                      onClick={() => setShowHelp(true)}
                                                      className="flex items-center justify-between py-2 hover:bg-secondary/5 rounded-lg px-1 transition-colors active:scale-[0.98]"
                                                >
                                                      <div className="flex items-center gap-2">
                                                            <Info className="w-3.5 h-3.5 text-gray-500" />
                                                            <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                                                                  Help & Shortcuts
                                                            </span>
                                                      </div>
                                                      <ChevronRight className="w-4 h-4 text-gray-500" />
                                                </button>

                                                <Divider />

                                                {/* Reset */}
                                                {!showResetConfirm ? (
                                                      <button
                                                            onClick={() => setShowResetConfirm(true)}
                                                            className="flex items-center gap-2 py-2 px-1 hover:bg-tertiary/10 rounded-lg transition-colors active:scale-[0.98]"
                                                      >
                                                            <Trash2 className="w-3.5 h-3.5 text-tertiary" />
                                                            <span className="text-[11px] font-bold uppercase tracking-widest text-tertiary">
                                                                  Reset All Data
                                                            </span>
                                                      </button>
                                                ) : (
                                                      <motion.div
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            className="border border-tertiary/30 rounded-xl p-4 bg-tertiary/5"
                                                      >
                                                            <p className="text-[10px] text-tertiary font-bold uppercase tracking-widest mb-3">
                                                                  Delete all tasks and transactions?
                                                            </p>
                                                            <div className="flex gap-2">
                                                                  <button
                                                                        onClick={() => {
                                                                              onResetData();
                                                                              setShowResetConfirm(false);
                                                                        }}
                                                                        className="flex-1 py-2 rounded-lg bg-tertiary text-white text-[10px] font-bold uppercase tracking-widest active:scale-95"
                                                                  >
                                                                        Confirm
                                                                  </button>
                                                                  <button
                                                                        onClick={() => setShowResetConfirm(false)}
                                                                        className="flex-1 py-2 rounded-lg border border-secondary/20 text-secondary text-[10px] font-bold uppercase tracking-widest active:scale-95"
                                                                  >
                                                                        Cancel
                                                                  </button>
                                                            </div>
                                                      </motion.div>
                                                )}
                                          </div>

                                          {/* App Info */}
                                          <div className="mt-10 text-center pb-6">
                                                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block">
                                                      Daily Driver v1.0
                                                </span>
                                                <span className="text-[9px] font-mono text-gray-600 uppercase tracking-wider block mt-1">
                                                      Cassette Futurism UI
                                                </span>
                                          </div>
                                    </div>
                              </motion.div>
                        </>
                  )}
            </AnimatePresence>
      );
}

// Helper components
function SettingRow({ label, description, icon, children }: {
      label: string;
      description: string;
      icon?: React.ReactNode;
      children: React.ReactNode;
}) {
      return (
            <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                        {icon}
                        <div>
                              <span className="text-[11px] font-bold uppercase tracking-widest text-secondary block">
                                    {label}
                              </span>
                              <p className="text-[9px] text-gray-500 mt-0.5 uppercase tracking-wider">
                                    {description}
                              </p>
                        </div>
                  </div>
                  {children}
            </div>
      );
}

function Divider() {
      return <div className="h-px bg-secondary/10" />;
}

export const SettingsModal = memo(SettingsModalInner);
