import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type Task = {
      id: string | number;
      title: string;
      types: string[];
      completed: boolean;
      dueDate?: string;
      scheduleDate?: string;
};

type TasksViewProps = {
      tasks: Task[];
      outerOptions: string[];
      activeOuterIndex: number;
      handleTaskProperties: (task: Task) => void;
      handleTaskComplete: (id: string | number) => void;
};

function TasksViewInner({
      tasks,
      outerOptions,
      activeOuterIndex,
      handleTaskProperties,
      handleTaskComplete,
}: TasksViewProps) {
      return (
            <motion.div
                  key="tasks-view"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 font-plex"
            >
                  <AnimatePresence>
                        {tasks
                              .filter(
                                    (t) =>
                                          (t.scheduleDate || t.dueDate || '').toUpperCase() ===
                                          (outerOptions[activeOuterIndex] || '').toUpperCase()
                              )
                              .map((task) => (
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
                                                      <div
                                                            className={`absolute top-1/2 left-0 w-full h-[2px] bg-tertiary -translate-y-1/2 rounded-full transition-all duration-300 ease-out origin-left pointer-events-none ${task.completed ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
                                                                  }`}
                                                      />

                                                      <h3
                                                            className={`font-bold text-lg uppercase tracking-wide transition-colors duration-300 ${task.completed ? 'text-gray-500' : 'text-secondary'
                                                                  }`}
                                                      >
                                                            {task.title}
                                                      </h3>
                                                </div>
                                          </motion.div>
                                    </motion.div>
                              ))}
                  </AnimatePresence>
            </motion.div>
      );
}

export const TasksView = memo(TasksViewInner);
