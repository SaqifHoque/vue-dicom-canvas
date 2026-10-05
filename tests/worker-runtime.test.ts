import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    DicomWorkerLoadError,
    installDicomWorkerResolver,
    type WorkerRuntimeScope
} from '../src/worker-runtime'

class FakeWorker {
    static created: FakeWorker[] = []
    readonly url: string
    readonly options?: WorkerOptions
    readonly listeners = new Map<string, EventListener>()

    constructor(url: string | URL, options?: WorkerOptions) {
        this.url = String(url)
        this.options = options
        FakeWorker.created.push(this)
    }

    addEventListener(type: string, listener: EventListener): void {
        this.listeners.set(type, listener)
    }

    fail(): void {
        this.listeners.get('error')?.(new Event('error'))
    }
}

const createScope = (): WorkerRuntimeScope => ({ Worker: FakeWorker as unknown as typeof Worker })

describe('DICOM worker runtime', () => {
    it('routes packaged workers while preserving unrelated workers and options', () => {
        FakeWorker.created = []
        const scope = createScope()
        const original = scope.Worker
        const release = installDicomWorkerResolver({
            workerBasePath: './assets/workers',
            documentUrl: 'https://viewer.example/radiology/index.html',
            scope
        }, () => undefined)

        new scope.Worker('https://viewer.example/chunks/assets/workers/rle.worker.min.js', { type: 'module' })
        new scope.Worker('https://viewer.example/custom.worker.js')
        assert.equal(FakeWorker.created[0]?.url, 'https://viewer.example/radiology/assets/workers/rle.worker.min.js')
        assert.equal(FakeWorker.created[0]?.options?.type, 'module')
        assert.equal(FakeWorker.created[1]?.url, 'https://viewer.example/custom.worker.js')

        release()
        assert.equal(scope.Worker, original)
    })

    it('reports the resolved URL when a decoder worker fails', () => {
        FakeWorker.created = []
        const scope = createScope()
        const errors: DicomWorkerLoadError[] = []
        const release = installDicomWorkerResolver({
            workerBasePath: '/assets/workers/',
            documentUrl: 'https://viewer.example/app',
            scope
        }, error => errors.push(error))

        new scope.Worker('https://viewer.example/chunks/assets/workers/jpeg2000.worker.min.js')
        FakeWorker.created[0]?.fail()
        assert.equal(errors.length, 1)
        assert.equal(errors[0]?.workerUrl, 'https://viewer.example/assets/workers/jpeg2000.worker.min.js')
        assert.match(errors[0]?.message ?? '', /Verify workerBasePath/)
        release()
    })

    it('shares one resolver and rejects conflicting mounted configurations', () => {
        const scope = createScope()
        const releaseFirst = installDicomWorkerResolver({
            workerBasePath: '/workers', documentUrl: 'https://viewer.example/', scope
        }, () => undefined)
        const routed = scope.Worker
        const releaseSecond = installDicomWorkerResolver({
            workerBasePath: '/workers/', documentUrl: 'https://viewer.example/study', scope
        }, () => undefined)
        assert.equal(scope.Worker, routed)
        assert.throws(() => installDicomWorkerResolver({
            workerBasePath: '/other-workers', documentUrl: 'https://viewer.example/', scope
        }, () => undefined), /already configured/)

        releaseFirst()
        assert.equal(scope.Worker, routed)
        releaseSecond()
        assert.notEqual(scope.Worker, routed)
    })
})
