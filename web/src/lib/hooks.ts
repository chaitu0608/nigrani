import { useCallback, useEffect, useRef, useState } from "react";

const BUS = "nigrani:refresh";
export const refreshAll = () => window.dispatchEvent(new Event(BUS));

export function useData<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = useCallback((quiet = false) => {
    const n = ++seq.current; if (!quiet) setLoading(true);
    fn().then((d) => { if (n === seq.current) { setData(d); setError(undefined); } })
      .catch((e) => { if (n === seq.current) setError(e); })
      .finally(() => { if (n === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = () => load(true); window.addEventListener(BUS, h); return () => window.removeEventListener(BUS, h); }, [load]);
  return { data, error, loading, reload: load, setData };
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = useCallback(() => {
    const d = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", d); localStorage.setItem("theme", d ? "dark" : "light"); setDark(d);
    window.dispatchEvent(new Event("nigrani:theme"));
  }, []);
  useEffect(() => { const h = () => setDark(document.documentElement.classList.contains("dark")); window.addEventListener("nigrani:theme", h); return () => window.removeEventListener("nigrani:theme", h); }, []);
  return { dark, toggle };
}

export function useCssVar(name: string) {
  const { dark } = useTheme();
  const [v, setV] = useState("");
  useEffect(() => { setV(getComputedStyle(document.documentElement).getPropertyValue(name).trim()); }, [dark, name]);
  return v;
}

export function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = () => setM(mq.matches); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h); }, [q]);
  return m;
}
