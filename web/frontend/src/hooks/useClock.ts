import { useEffect, useState } from 'react';

/** Time is external state; reading it during render would make rendering impure. */
export function useClock(interval = 60_000) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), interval);
        return () => clearInterval(timer);
    }, [interval]);
    return now;
}
