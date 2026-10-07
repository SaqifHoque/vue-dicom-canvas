import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPerformanceMeasure } from '../src/performance'

describe('performance measurements', () => {
    it('reports duration and normalized work size', () => {
        assert.deepEqual(createPerformanceMeasure('source-validation', 12.8, 10, 14.5), {
            operation: 'source-validation',
            durationMs: 4.5,
            itemCount: 12
        })
    })

    it('does not expose negative values from fallback clocks or counts', () => {
        assert.deepEqual(createPerformanceMeasure('annotation-export', -1, 20, 10), {
            operation: 'annotation-export',
            durationMs: 0,
            itemCount: 0
        })
    })
})
