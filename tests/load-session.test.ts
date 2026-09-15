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
})
