import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';

/** Request identity determines loading; effects only commit completed requests. */
export function useAsyncResource<T extends object>(load: () => Promise<T>, enabled = true) {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{
        load: typeof load;
        attempt: number;
        data: T | null;
        error: unknown;
    } | null>(null);
    const generation = useRef(0);
    const mounted = useRef(false);
    const context = useRef({ load, attempt, enabled });

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        context.current = { load, attempt, enabled };
        const request = ++generation.current;
        if (!enabled) return;
        let active = true;
        load()
            .then((data) => {
                if (active && request === generation.current)
                    setResult({ load, attempt, data, error: null });
            })
            .catch((error: unknown) => {
                if (active && request === generation.current)
                    setResult({ load, attempt, data: null, error });
            });
        return () => {
            active = false;
        };
    }, [load, attempt, enabled]);

    const setData = useCallback(
        (value: SetStateAction<T | null>) => {
            const current = context.current;
            if (!mounted.current || !current.enabled || current.load !== load) return;
            generation.current++;
            setResult((previous) => ({
                load,
                attempt: current.attempt,
                error: null,
                data:
                    typeof value === 'function'
                        ? value(previous?.load === load ? previous.data : null)
                        : value,
            }));
        },
        [load],
    );

    // A silent refresh keeps confirmed data visible and cannot replace a newer request.
    const refetch = useCallback(async () => {
        const current = context.current;
        if (!mounted.current || !current.enabled || current.load !== load) return;
        const request = ++generation.current;
        try {
            const data = await load();
            if (mounted.current && request === generation.current)
                setResult({ load, attempt: current.attempt, data, error: null });
        } catch {
            /* Keep confirmed data on a failed silent refresh. */
        }
    }, [load]);

    const current = enabled && result?.load === load ? result : null;
    return {
        data: current?.data ?? null,
        error: current?.attempt === attempt ? current.error : null,
        loading: enabled && current?.attempt !== attempt,
        retry: useCallback(() => setAttempt((value) => value + 1), []),
        setData,
        refetch,
    };
}
