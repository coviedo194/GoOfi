import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'goofi.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // localStorage no disponible (p. ej. bloqueado en el iframe)
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(DARK_QUERY).matches;
}

/**
 * Preferencia de tema del usuario (Sistema / Claro / Oscuro), persistida en localStorage.
 * Con "system" sigue en vivo el tema del sistema operativo.
 */
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    const mql = window.matchMedia?.(DARK_QUERY);
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignorar: la preferencia sólo dura la sesión
    }
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  return { preference, setPreference, isDark };
}
