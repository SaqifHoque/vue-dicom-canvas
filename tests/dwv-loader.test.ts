import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLazyLoader } from '../src/dwv-loader'

describe('lazy DWV loading', () => {
    it('imports on demand and shares concurrent and successful requests', async () => {
        let calls = 0
        const module = { ready: true }
        const load = createLazyLoader(async () => { calls += 1; return module })
        assert.equal(calls, 0)
        const first = load()
        assert.equal(load(), first)
        assert.equal(await first, module)
        assert.equal(await load(), module)
        assert.equal(calls, 1)
    })

    it('allows a new mount to retry a failed shared import', async () => {
        let calls = 0
        const load = createLazyLoader(async () => {
            calls += 1
            if (calls === 1) throw new Error('Import failed')
            return 'ready'
        })
        const first = load()
        assert.equal(load(), first)
        await assert.rejects(first, /Import failed/)
        assert.equal(await load(), 'ready')
        assert.equal(calls, 2)
    })
})
