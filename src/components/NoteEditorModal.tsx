import { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import type { Note } from './NotesView';

interface NoteEditorModalProps {
      onClose: () => void;
      onSave: (title: string, content: string, id?: string) => void;
      initialNote: Note | null;
}

function NoteEditorModalInner({ onClose, onSave, initialNote }: NoteEditorModalProps) {
      const [content, setContent] = useState('');

      useEffect(() => {
            setContent(initialNote ? initialNote.content : '');
      }, [initialNote]);

      const handleSaveAndClose = () => {
            const trimmed = content.trim();
            if (!trimmed) {
                  onClose();
                  return;
            }
            const lines = trimmed.split('\n');
            let title = lines[0].trim();
            if (title.length > 25) {
                  title = title.substring(0, 25) + '...';
            }
            onSave(title, trimmed, initialNote?.id);
            onClose();
      };

      return (
            <>
                  <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 z-40 backdrop-blur-sm"
                        onClick={handleSaveAndClose}
                  />

                  <motion.div

                        initial={{ y: '100%', borderRadius: '40px' }}
                        animate={{ y: 0, borderRadius: '40px' }}
                        exit={{ y: '100%', borderRadius: '40px' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350, mass: 0.8 }}
                        className="absolute bottom-0 left-0 right-0 h-[85vh] z-50 bg-[var(--bg-hardware)] rounded-t-[40px] flex flex-col items-center border-t border-x border-[var(--inset-border)] shadow-[var(--wheel-shadow-inner)] touch-none p-5"
                  >
                        <div className="w-full flex justify-between items-center py-2 px-2 shrink-0 mb-4 border-b border-gray-800 pb-4">
                              <span className="font-mono text-gray-500 text-[10px] uppercase tracking-widest">
                                    {initialNote ? 'EDIT BLOCK' : 'NEW BLOCK'}
                              </span>
                              <button
                                    onClick={handleSaveAndClose}
                                    className="px-4 py-2 rounded-full hardware-panel border-b-2 border-black text-secondary font-bold text-xs tracking-widest active:scale-95 transition-all shadow-md pointer-events-auto"
                              >
                                    COMMIT
                              </button>
                        </div>

                        <div className="flex-1 w-full pointer-events-auto h-full flex flex-col hardware-inset border border-black rounded-[24px] p-5 overflow-hidden relative shadow-[inset_0_10px_30px_rgba(0,0,0,0.8)]">
                              <div className="absolute top-0 right-4 w-[2px] h-full bg-gradient-to-b from-transparent via-red-900/10 to-transparent pointer-events-none"></div>
                              <textarea
                                    className="w-full h-full bg-transparent text-secondary font-mono text-sm resize-none outline-none leading-relaxed placeholder:text-gray-700 placeholder:italic z-10 p-1"
                                    placeholder="Initialize thought block here..."
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                              />
                        </div>
                  </motion.div>
            </>
      );
}

export const NoteEditorModal = memo(NoteEditorModalInner);
