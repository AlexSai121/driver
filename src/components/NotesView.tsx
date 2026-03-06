import { memo } from 'react';
import { motion } from 'framer-motion';

export interface Note {
      id?: string;
      title: string;
      content: string;
      createdAt: number;
      updatedAt: number;
}

interface NotesViewProps {
      notes: Note[];
      activeOuterIndex: number;
      outerOptions: string[];
}

function NotesViewInner({ notes, activeOuterIndex, outerOptions }: NotesViewProps) {
      const activeOption = outerOptions[activeOuterIndex] || '';
      const isCreateNew = activeOption === 'CREATE NEW' || activeOption === 'NOTES';

      const selectedNote = notes.find(n => n.title === activeOption && activeOption !== 'CREATE NEW');

      return (
            <motion.div
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-start justify-start w-full mt-4 pointer-events-auto px-4"
            >
                  <div className="w-full max-w-[280px] flex flex-col items-start">
                        {isCreateNew || !selectedNote ? (
                              <div className="w-full hardware-inset rounded-2xl p-6 border border-gray-700/50 flex flex-col items-center justify-center text-center opacity-60 min-h-[160px]">
                                    <span className="font-plex text-secondary text-sm mb-2 opacity-50">++ READY ++</span>
                                    <span className="font-nothing text-2xl text-secondary tracking-widest drop-shadow-md">NO ENTRY</span>
                                    <span className="font-plex text-[10px] mt-4 text-gray-400 uppercase tracking-widest max-w-[200px] leading-relaxed">
                                          Press the main dial to initialize a thought block.
                                    </span>
                              </div>
                        ) : (
                              <div
                                    className="w-full hardware-inset rounded-[24px] p-6 border border-gray-600 flex flex-col items-start min-h-[160px] max-h-[280px] overflow-hidden relative"
                              >
                                    <div className="absolute top-0 right-0 p-4 flex gap-2">
                                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-2 py-0.5 border border-gray-600 rounded-full shadow-inner bg-black/50">
                                                {new Date(selectedNote.updatedAt).toLocaleDateString()}
                                          </span>
                                    </div>
                                    <h2 className="font-mono text-xl text-secondary font-bold tracking-tight w-4/5 truncate pb-1">
                                          {selectedNote.title}
                                    </h2>
                                    <div className="w-full h-[1px] bg-gray-700 mb-3 opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.5)]"></div>
                                    <div
                                          className="text-secondary font-mono text-xs leading-relaxed whitespace-pre-wrap opacity-70 w-full"
                                          style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}
                                    >
                                          {selectedNote.content}
                                    </div>
                              </div>
                        )}
                  </div>
            </motion.div>
      );
}

export const NotesView = memo(NotesViewInner);
