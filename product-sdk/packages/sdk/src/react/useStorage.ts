/**
 * useStorage hook
 */

import { useState, useEffect, useCallback } from "react";
import { useProductSDK } from "./context.js";

/**
 * Hook for key-value storage operations
 *
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const [theme, setTheme, { loading }] = useStorage('theme', 'light');
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
 *       Current: {theme}
 *     </button>
 *   );
 * }
 * ```
 */
export function useStorage<T = string>(
    key: string,
    defaultValue?: T,
): [T | null, (value: T) => Promise<void>, { loading: boolean; error: Error | null }] {
    const app = useProductSDK();

    const [value, setValue] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Load initial value
    useEffect(() => {
        let mounted = true;

        const loadValue = async () => {
            try {
                setLoading(true);
                const stored = await app.storage.getJSON<T>(key);
                if (mounted) {
                    setValue(stored ?? defaultValue ?? null);
                    setLoading(false);
                }
            } catch (e) {
                if (mounted) {
                    setError(e instanceof Error ? e : new Error(String(e)));
                    setLoading(false);
                }
            }
        };

        loadValue();

        return () => {
            mounted = false;
        };
    }, [app, key, defaultValue]);

    const setStoredValue = useCallback(
        async (newValue: T) => {
            try {
                setError(null);
                await app.storage.setJSON(key, newValue);
                setValue(newValue);
            } catch (e) {
                setError(e instanceof Error ? e : new Error(String(e)));
                throw e;
            }
        },
        [app, key],
    );

    return [value, setStoredValue, { loading, error }];
}

/**
 * Hook for string storage (simpler API)
 *
 * @param key - Storage key
 * @param defaultValue - Default value
 */
export function useStorageString(
    key: string,
    defaultValue?: string,
): [string | null, (value: string) => Promise<void>, { loading: boolean }] {
    const app = useProductSDK();

    const [value, setValue] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const loadValue = async () => {
            const stored = await app.storage.get(key);
            if (mounted) {
                setValue(stored ?? defaultValue ?? null);
                setLoading(false);
            }
        };

        loadValue();

        return () => {
            mounted = false;
        };
    }, [app, key, defaultValue]);

    const setStoredValue = useCallback(
        async (newValue: string) => {
            await app.storage.set(key, newValue);
            setValue(newValue);
        },
        [app, key],
    );

    return [value, setStoredValue, { loading }];
}
