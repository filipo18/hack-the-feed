import { useEffect, useState } from "react";

export function useResult<T>(load: () => Promise<T>, key: string) {
  const [result, setResult] = useState<T | null>(null);

  useEffect(() => {
    let live = true;
    setResult(null);
    load().then((loaded) => live && setResult(loaded));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return result;
}
