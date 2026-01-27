import { useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';

/**
 * Custom hook for triggering confetti animation
 * @param {Object} options
 * @param {boolean} options.trigger - When true, triggers confetti
 * @param {number} [options.duration=3000] - Duration of confetti animation in ms
 */
export function useConfetti({ trigger, duration = 3000 }) {
  const fireConfetti = useCallback(() => {
    const end = Date.now() + duration;

    // Warm, elegant colors matching our palette (amber/gold tones)
    const colors = ['#f59e0b', '#d97706', '#b45309', '#92400e', '#fbbf24', '#fcd34d'];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Initial burst from center
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    // Continue with side bursts
    frame();
  }, [duration]);

  useEffect(() => {
    if (trigger) {
      fireConfetti();
    }
  }, [trigger, fireConfetti]);

  return { fireConfetti };
}
