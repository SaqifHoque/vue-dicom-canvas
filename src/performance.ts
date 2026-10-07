export type DicomPerformanceOperation =
    | 'source-validation'
    | 'annotation-export'
    | 'annotation-restore'
    | 'annotation-summary'

export interface DicomPerformanceMeasure {
    operation: DicomPerformanceOperation
    durationMs: number
    itemCount: number
}

export type PerformanceClock = () => number

export const performanceNow: PerformanceClock = () =>
    typeof performance === 'undefined' ? Date.now() : performance.now()

/** Create a stable public measurement while tolerating non-monotonic fallback clocks. */
export function createPerformanceMeasure(
    operation: DicomPerformanceOperation,
    itemCount: number,
    startedAt: number,
    endedAt: number
): DicomPerformanceMeasure {
    return {
        operation,
        durationMs: Math.max(0, endedAt - startedAt),
        itemCount: Math.max(0, Math.trunc(itemCount))
    }
}
