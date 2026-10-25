import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly interpolates a target number using 60fps requestAnimationFrame.
 * Prevents jitter during high-frequency server updates.
 */
export function useLerp(target: number, alpha = 0.18, precision = 2): number {
  const [current, setCurrent] = useState(target > 0 ? target : 0);
  const targetRef = useRef(target > 0 ? target : 0);
  const currentRef = useRef(target > 0 ? target : 0);
  const rafRef = useRef<number | null>(null);

  if (target > 0) {
    targetRef.current = target;
    if (currentRef.current === 0) {
      currentRef.current = target;
      setCurrent(target);
    }
  }

  useEffect(() => {
    if (targetRef.current <= 0) return;
    const threshold = Math.pow(10, -precision - 1);

    const animate = () => {
      const diff = targetRef.current - currentRef.current;
      if (Math.abs(diff) < threshold) {
        currentRef.current = targetRef.current;
        setCurrent(targetRef.current);
        rafRef.current = null;
        return;
      }

      currentRef.current += diff * alpha;
      setCurrent(currentRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, alpha, precision]);

  return current;
}
