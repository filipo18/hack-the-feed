import { useCallback, useEffect, useState } from "react";

export function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCountUp(target: number, active: boolean, duration = 1100) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (reducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);

  return value;
}

const seen = new Set<string>();

/** Dashboard tabs pass once = true, so the scan plays on arrival and not on every tab. */
export function useScan(key: string, once: boolean) {
  const shouldScan = () => !reducedMotion() && !(once && seen.has(key));
  const [scanning, setScanning] = useState(shouldScan);

  useEffect(() => {
    setScanning(shouldScan());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const finish = useCallback(() => {
    seen.add(key);
    setScanning(false);
  }, [key]);

  return { scanning, finish };
}
