import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mindfuel-theme';

function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    // Default to system preference
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.style.colorScheme = theme;
}

/**
 * Tiny theme hook — persists choice in localStorage, applies `.dark` class to
 * <html> so Tailwind/CSS variables flip the whole app. Reads system preference
 * on first visit.
 */
export function useTheme() {
    const [theme, setTheme] = useState<Theme>('light');

    // Apply on mount (after hydration to avoid SSR mismatch)
    useEffect(() => {
        const initial = getInitialTheme();
        setTheme(initial);
        applyTheme(initial);
    }, []);

    const toggle = useCallback(() => {
        setTheme(prev => {
            const next: Theme = prev === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem(STORAGE_KEY, next);
            return next;
        });
    }, []);

    const set = useCallback((next: Theme) => {
        setTheme(next);
        applyTheme(next);
        localStorage.setItem(STORAGE_KEY, next);
    }, []);

    return { theme, toggle, setTheme: set };
}
