import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getViewerLayout, viewerLayoutBreakpoints } from '../src/responsive'

describe('responsive viewer layout', () => {
    it('uses stable narrow, compact, and wide boundaries', () => {
        assert.equal(getViewerLayout(320), 'narrow')
        assert.equal(getViewerLayout(viewerLayoutBreakpoints.narrow), 'narrow')
        assert.equal(getViewerLayout(viewerLayoutBreakpoints.narrow + 1), 'compact')
        assert.equal(getViewerLayout(viewerLayoutBreakpoints.compact), 'compact')
        assert.equal(getViewerLayout(viewerLayoutBreakpoints.compact + 1), 'wide')
    })

    it('rejects widths that cannot describe a rendered viewer', () => {
        assert.throws(() => getViewerLayout(-1), /non-negative/)
        assert.throws(() => getViewerLayout(Number.NaN), /finite/)
        assert.throws(() => getViewerLayout(Number.POSITIVE_INFINITY), /finite/)
    })
})
