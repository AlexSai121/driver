import { memo } from 'react';
import { motion } from 'framer-motion';
import { Printer } from 'lucide-react';

type ReceiptViewProps = {
      onPrint: () => void;
};

function ReceiptViewInner({ onPrint }: ReceiptViewProps) {
      return (
            <motion.div
                  key="review-view"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  className="font-plex w-full flex flex-col pb-32 pointer-events-auto min-h-[400px]"
            >
                  {/* Header — left aligned */}
                  <div className="mb-10">
                        <h2 className="text-lg font-bold uppercase tracking-widest text-secondary font-nothing">
                              WEEKLY LOG
                        </h2>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                              Your week at a glance
                        </p>
                  </div>

                  {/* Printer Button — compact */}
                  <motion.button
                        onClick={onPrint}
                        className="relative group self-start"
                        whileTap={{ scale: 0.92 }}
                        whileHover={{ scale: 1.02 }}
                  >
                        <div className="w-32 h-32 hardware-panel rounded-[20px] border border-secondary/20 shadow-[0_6px_20px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center gap-3 transition-all group-active:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                              {/* Printer slot */}
                              <div className="w-20 h-1 bg-secondary/30 rounded-full shadow-inner" />

                              {/* Icon */}
                              <Printer className="w-8 h-8 text-secondary opacity-60 group-hover:opacity-90 transition-opacity" />

                              {/* Label */}
                              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-gray-500 font-mono">
                                    Print Log
                              </span>
                        </div>

                        {/* Indicator LED */}
                        <motion.div
                              className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-quaternary shadow-[0_0_6px_rgba(78,104,81,0.6)]"
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                  </motion.button>

                  {/* Subtext */}
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest mt-5 font-mono">
                        Tasks • Funds • Diagnostics
                  </p>
            </motion.div>
      );
}

export const ReceiptView = memo(ReceiptViewInner);
