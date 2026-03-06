import { useState, useEffect, memo } from 'react';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+{}[]|;:,.<>?';

interface EncryptedTextProps {
      text: string;
      duration?: number;
      className?: string;
}

function EncryptedTextInner({ text, duration = 400, className = '' }: EncryptedTextProps) {
      const [displayText, setDisplayText] = useState(text);

      useEffect(() => {
            let startTime: number | null = null;
            let animationFrameId: number;

            const animate = (timestamp: number) => {
                  if (!startTime) startTime = timestamp;
                  const progress = timestamp - startTime;

                  if (progress < duration) {
                        const resolvedRatio = progress / duration;
                        const resolvedLength = Math.floor(text.length * Math.min(resolvedRatio, 1));

                        let newText = text.substring(0, resolvedLength);

                        for (let i = resolvedLength; i < text.length; i++) {
                              if (text[i] === ' ') {
                                    newText += ' ';
                              } else {
                                    newText += CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
                              }
                        }

                        setDisplayText(newText);
                        animationFrameId = requestAnimationFrame(animate);
                  } else {
                        setDisplayText(text);
                  }
            };

            animationFrameId = requestAnimationFrame(animate);

            return () => {
                  cancelAnimationFrame(animationFrameId);
            };
      }, [text, duration]);

      return (
            <span className={className}>
                  {displayText}
            </span>
      );
}

export const EncryptedText = memo(EncryptedTextInner);
