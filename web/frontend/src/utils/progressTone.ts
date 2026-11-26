export type ProgressBarTone = 'low' | 'mid' | 'high' | 'complete';

export function progressToneFromPercent(clampedPercent: number): ProgressBarTone {
    if (clampedPercent >= 100) return 'complete';
    if (clampedPercent >= 75) return 'high';
    if (clampedPercent >= 25) return 'mid';
    return 'low';
}
