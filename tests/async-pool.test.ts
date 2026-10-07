import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { someWithConcurrency } from '../src/async-pool'

describe('bounded async validation', () => {
    it('never exceeds its concurrency limit', async () => {
        let active = 0
        let peak = 0
        const matched = await someWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
            active += 1
            peak = Math.max(peak, active)
            await new Promise(resolve => setTimeout(resolve, 2))
            active -= 1
            return false
        })

        assert.equal(matched, false)
        assert.equal(peak, 2)
    })

    it('stops scheduling after a match', async () => {
        const visited: number[] = []
        const matched = await someWithConcurrency([1, 2, 3, 4, 5], 1, async value => {
            visited.push(value)
            return value === 2
        })

        assert.equal(matched, true)
        assert.deepEqual(visited, [1, 2])
    })

    it('stops scheduling when the caller cancels', async () => {
        let active = true
        const visited: number[] = []
        const matched = await someWithConcurrency([1, 2, 3], 1, async value => {
            visited.push(value)
            active = false
            return false
        }, () => active)

        assert.equal(matched, false)
        assert.deepEqual(visited, [1])
    })

    it('rejects invalid concurrency', async () => {
        await assert.rejects(someWithConcurrency([1], 0, async () => false), /positive integer/)
    })
})
