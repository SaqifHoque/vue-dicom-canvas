import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { LoadSessionController } from '../src/load-session'

describe('LoadSessionController', () => {
    it('accepts only events owned by the active DWV data id', async () => {
        const sessions = new LoadSessionController()
        const first = sessions.begin()
        assert.equal(sessions.bind(first, 'study-1'), true)

        const second = sessions.begin()
        assert.deepEqual(await first.result, { status: 'superseded' })
        assert.equal(sessions.owns({ dataid: 'study-1' }), false)
        assert.equal(sessions.owns({ dataid: 'study-2' }), true)
        assert.equal(sessions.bind(second, 'study-2'), true)
        assert.equal(sessions.owns({ dataid: 'study-3' }), false)
    })

    it('settles each session once', async () => {
        const sessions = new LoadSessionController()
        const session = sessions.begin()
        const event = { dataid: 'study-1' }
        sessions.bind(session, 'study-1')

        assert.equal(sessions.settle({ status: 'loaded', event }), true)
        assert.equal(sessions.settle({ status: 'error', error: new Error('late') }), false)
        assert.deepEqual(await session.result, { status: 'loaded', event })
    })

    it('reports reset, DWV abort, timeout, and superseded outcomes', async () => {
        const sessions = new LoadSessionController()

        const reset = sessions.begin()
        assert.equal(sessions.cancel({ status: 'aborted', reason: 'reset' }), true)
        assert.deepEqual(await reset.result, { status: 'aborted', reason: 'reset' })

        const aborted = sessions.begin()
        sessions.bind(aborted, 'study-2')
        const abortEvent = { dataid: 'study-2' }
        assert.equal(sessions.owns(abortEvent), true)
        sessions.settle({ status: 'aborted', reason: 'dwv', event: abortEvent })
        assert.deepEqual(await aborted.result, { status: 'aborted', reason: 'dwv', event: abortEvent })

        const timedOut = sessions.begin()
        sessions.bind(timedOut, 'study-3')
        const timeout = new Error('timed out')
        sessions.settle({ status: 'timeout', error: timeout })
        assert.deepEqual(await timedOut.result, { status: 'timeout', error: timeout })

        const replaced = sessions.begin()
        sessions.begin()
        assert.deepEqual(await replaced.result, { status: 'superseded' })
    })

    it('ignores late terminal events after cancellation', async () => {
        const sessions = new LoadSessionController()
        const session = sessions.begin()
        sessions.bind(session, 'study-1')
        sessions.cancel({ status: 'superseded' })

        assert.equal(sessions.owns({ dataid: 'study-1' }), false)
        assert.deepEqual(await session.result, { status: 'superseded' })
    })
})
