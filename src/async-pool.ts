export const defaultValidationConcurrency = 8

/** Test values with bounded concurrency and stop scheduling work after a match or cancellation. */
export async function someWithConcurrency<T>(
    values: readonly T[],
    concurrency: number,
    predicate: (value: T, index: number) => Promise<boolean>,
    shouldContinue: () => boolean = () => true
): Promise<boolean> {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new RangeError('Validation concurrency must be a positive integer.')
    }

    let nextIndex = 0
    let matched = false
    const worker = async (): Promise<void> => {
        while (!matched && shouldContinue()) {
            const index = nextIndex++
            if (index >= values.length) return
            if (await predicate(values[index], index)) matched = true
        }
    }

    await Promise.all(Array.from(
        { length: Math.min(concurrency, values.length) },
        () => worker()
    ))
    return matched
}
