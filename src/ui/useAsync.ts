import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload(): Promise<void>;
  setData(updater: (current: T | undefined) => T): void;
}

/** Carga datos asíncronos e ignora respuestas que lleguen tarde. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setDataState] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    const current = ++seq.current;
    setLoading(true);
    try {
      const result = await loaderRef.current();
      if (current === seq.current) {
        setDataState(result);
        setError(null);
      }
    } catch (e) {
      if (current === seq.current) setError(e);
    } finally {
      if (current === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater: (current: T | undefined) => T) => setDataState((c) => updater(c)), []);

  return { data, error, loading, reload, setData };
}
