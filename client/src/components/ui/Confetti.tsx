import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

const COLORS = ['#CCFF00', '#00F0FF', '#F1F5F9', '#22C55E', '#F59E0B', '#FF3EA5'];

interface Particle {
  id: number;
  dx: number;
  dy: number;
  rotate: number;
  size: number;
  color: string;
  round: boolean;
  delay: number;
}

interface Burst {
  id: number;
  x: number;
  y: number;
  particles: Particle[];
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const velocity = 90 + Math.random() * 220;
    return {
      id: i,
      dx: Math.cos(angle) * velocity,
      // bias upward, gravity is applied in the keyframes
      dy: Math.sin(angle) * velocity - 120,
      rotate: (Math.random() - 0.5) * 720,
      size: 5 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() > 0.6,
      delay: Math.random() * 0.08,
    };
  });
}

/**
 * Lightweight confetti using framer-motion.
 * const { fire, confetti } = useConfetti();  →  render {confetti}, call fire(x, y)
 */
export function useConfetti() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  const fire = useCallback((x?: number, y?: number, count = 60) => {
    const burst: Burst = {
      id: Date.now() + Math.random(),
      x: x ?? window.innerWidth / 2,
      y: y ?? window.innerHeight / 2,
      particles: makeParticles(count),
    };
    setBursts((b) => [...b, burst]);
  }, []);

  /** Fire from the centre of a DOM element (e.g. the clicked button). */
  const fireFrom = useCallback(
    (el: Element | null, count?: number) => {
      if (!el) return fire(undefined, undefined, count);
      const r = el.getBoundingClientRect();
      fire(r.left + r.width / 2, r.top + r.height / 2, count);
    },
    [fire],
  );

  const remove = useCallback((id: number) => setBursts((b) => b.filter((x) => x.id !== id)), []);

  const confetti = createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden="true">
      {bursts.map((b) => (
        <BurstView key={b.id} burst={b} onDone={() => remove(b.id)} />
      ))}
    </div>,
    document.body,
  );

  return { fire, fireFrom, confetti };
}

function BurstView({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      {burst.particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute block"
          style={{
            left: burst.x,
            top: burst.y,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            backgroundColor: p.color,
            borderRadius: p.round ? '9999px' : '2px',
            boxShadow: `0 0 6px ${p.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{
            x: [0, p.dx * 0.7, p.dx],
            y: [0, p.dy * 0.7, p.dy + 260],
            opacity: [1, 1, 0],
            rotate: p.rotate,
            scale: [0.6, 1, 0.8],
          }}
          transition={{ duration: 1.4 + Math.random() * 0.3, delay: p.delay, ease: [0.15, 0.6, 0.4, 1] }}
        />
      ))}
    </>
  );
}
