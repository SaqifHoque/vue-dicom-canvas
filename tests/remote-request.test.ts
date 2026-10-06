import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDwvUrlRequestOptions, RemoteRequestOptionsStore } from '../src/remote-request'

describe('remote DICOM request options', () => {
    it('maps typed headers, credentials, and batching to DWV options', () => {
        assert.deepEqual(createDwvUrlRequestOptions({
            headers: [
                { name: 'Authorization', value: 'Bearer token' },
                { name: 'X-Study-Context', value: 'review' }
            ],
            withCredentials: true,
            batchSize: 4
        }), {
            requestHeaders: [
                { name: 'Authorization', value: 'Bearer token' },
                { name: 'X-Study-Context', value: 'review' }
            ],
            withCredentials: true,
            batchSize: 4
        })
    })

    it('creates a detached header snapshot for each load', () => {
        const header = { name: 'Authorization', value: 'Bearer first' }
        const options = { headers: [header] }
        const first = createDwvUrlRequestOptions(options)
        header.value = 'Bearer second'
        const second = createDwvUrlRequestOptions(options)
        assert.equal(first?.requestHeaders?.[0]?.value, 'Bearer first')
        assert.equal(second?.requestHeaders?.[0]?.value, 'Bearer second')
        assert.notEqual(first?.requestHeaders, second?.requestHeaders)
    })

    it('rejects malformed, duplicated, and browser-controlled headers', () => {
        assert.throws(() => createDwvUrlRequestOptions({
            headers: [{ name: 'Bad Header', value: 'value' }]
        }), /valid HTTP tokens/)
        assert.throws(() => createDwvUrlRequestOptions({
            headers: [{ name: 'X-Test', value: 'safe\r\ninjected: yes' }]
        }), /control characters/)
        assert.throws(() => createDwvUrlRequestOptions({
            headers: [{ name: 'Cookie', value: 'session=secret' }]
        }), /controlled by the browser/)
        assert.throws(() => createDwvUrlRequestOptions({
            headers: [{ name: 'Authorization', value: 'one' }, { name: 'authorization', value: 'two' }]
        }), /duplicated/)
    })

    it('validates credential and batch controls', () => {
        assert.equal(createDwvUrlRequestOptions({}), undefined)
        assert.throws(() => createDwvUrlRequestOptions({ withCredentials: 'yes' as unknown as boolean }), /boolean/)
        assert.throws(() => createDwvUrlRequestOptions({ batchSize: 0 }), /1 through 1000/)
        assert.throws(() => createDwvUrlRequestOptions({ batchSize: 1.5 }), /integer/)
    })

    it('isolates retry credentials and clears them when a request is cancelled', () => {
        const store = new RemoteRequestOptionsStore()
        const header = { name: 'Authorization', value: 'Bearer first' }
        const prepared = store.prepare({ headers: [header], withCredentials: true })
        header.value = 'Bearer changed'

        assert.equal(prepared?.requestHeaders?.[0]?.value, 'Bearer first')
        const retry = store.getRetryOptions()
        assert.equal(retry?.headers?.[0]?.value, 'Bearer first')
        retry!.headers![0]!.value = 'Bearer mutated retry'
        assert.equal(store.getRetryOptions()?.headers?.[0]?.value, 'Bearer first')

        store.clear()
        assert.equal(store.getRetryOptions(), undefined)
    })
})
