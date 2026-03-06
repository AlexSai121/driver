import { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';

type ClockProps = {
      use24h?: boolean;
};

function ClockInner({ use24h = false }: ClockProps) {
      const [currentTime, setCurrentTime] = useState(new Date());

      useEffect(() => {
            const timer = setInterval(() => setCurrentTime(new Date()), 1000);
            return () => clearInterval(timer);
      }, []);

      const hours = use24h
            ? String(currentTime.getHours()).padStart(2, '0')
            : currentTime.toLocaleTimeString([], { hour: '2-digit' }).replace(/ AM| PM/, '');

      const minutes = currentTime.toLocaleTimeString([], { minute: '2-digit' }).replace(/ AM| PM/, '');

      return (
            <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-widest text-gray-500 uppercase">Time</span>
                  <span className="text-4xl font-nothing font-normal tracking-wide mt-1 text-secondary flex items-baseline">
                        {hours}
                        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>:</motion.span>
                        {minutes}
                        {!use24h && (
                              <span className="text-xl ml-1">{currentTime.getHours() >= 12 ? 'PM' : 'AM'}</span>
                        )}
                  </span>
            </div>
      );
}

export const Clock = memo(ClockInner);
