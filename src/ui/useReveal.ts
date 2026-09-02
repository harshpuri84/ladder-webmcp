import { useCallback, useRef } from 'react';

/**
 * An entrance on the landing page: the element rises a short way and fades in the first time
 * it enters the viewport, then stays. Driven by an IntersectionObserver, never by a scroll
 * handler.
 *
 * The page is visible without this. The stylesheet hides nothing on its own; the hidden state
 * is the `rv` class, which only this hook puts on, and only once it has an observer standing by
 * to take it off again. No observer (jsdom, an old browser), or a reader who asked for reduced
 * motion, and the element is left exactly as the stylesheet drew it. A reader whose script
 * arrives late reads a page that never hid anything.
 *
 * A callback ref rather than an effect, so the class goes on during commit, before the first
 * paint, and so an element that mounts later (the hero's stage list waits for the specimen)
 * is picked up when it arrives.
 */
const HIDDEN = 'rv';
const SHOWN = 'rv--in';

const REDUCED = '(prefers-reduced-motion: reduce)';

function motionAllowed(): boolean {
  if (typeof IntersectionObserver === 'undefined') return false;
  if (typeof matchMedia !== 'function') return false;
  return !matchMedia(REDUCED).matches;
}

export function useReveal<T extends HTMLElement>(): (node: T | null) => void {
  const stop = useRef<(() => void) | null>(null);

  return useCallback((node: T | null) => {
    stop.current?.();
    stop.current = null;
    if (!node || !motionAllowed()) return;

    node.classList.add(HIDDEN);
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      node.classList.add(SHOWN);
      io.disconnect();
      stop.current = null;
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(node);

    stop.current = () => {
      io.disconnect();
      node.classList.remove(HIDDEN, SHOWN);
    };
  }, []);
}
