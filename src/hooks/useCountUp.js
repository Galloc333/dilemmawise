import { useEffect, useState, useRef } from 'react';

/**
 * Custom hook for animating numbers counting up
 * @param {number} end - The target number to count to
 * @param {Object} options
 * @param {number} [options.duration=2000] - Duration of animation in ms
 * @param {number} [options.start=0] - Starting number
 * @param {number} [options.decimals=0] - Number of decimal places
 * @param {boolean} [options.enabled=true] - Whether animation is enabled
 * @returns {number} The current animated value
 */
export function useCountUp(end, { duration = 2000, start = 0, decimals = 0, enabled = true } = {}) {
  const [count, setCount] = useState(enabled ? start : end);
  const animationRef = useRef(null);

  useEffect(() => {
    // If disabled, we already initialized with end value
    if (!enabled) {
      return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentCount = start + (end - start) * easeOut;
      setCount(currentCount);

      if (progress < 1) {
        animationRef.current = window.requestAnimationFrame(step);
      }
    };

    animationRef.current = window.requestAnimationFrame(step);

    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, [end, duration, start, enabled]);

  return decimals > 0 ? Number(count.toFixed(decimals)) : Math.floor(count);
}
