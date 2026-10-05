import {
    normaliseDicomWorkerBasePath,
    resolveDicomWorkerUrl
} from './worker-config'

type WorkerConstructor = new (scriptURL: string | URL, options?: WorkerOptions) => Worker

export interface WorkerRuntimeScope {
    Worker: WorkerConstructor
}

export interface DicomWorkerResolverOptions {
    workerBasePath: string
    documentUrl: string
    scope?: WorkerRuntimeScope
}

export class DicomWorkerLoadError extends Error {
    readonly workerUrl: string

    constructor(workerUrl: string) {
        super(`DICOM worker failed to load from ${workerUrl}. Verify workerBasePath and copy the packaged worker files to that directory.`)
        this.name = 'DicomWorkerLoadError'
        this.workerUrl = workerUrl
    }
}

interface WorkerInstallation {
    baseUrl: string
    nativeWorker: WorkerConstructor
    routedWorker: WorkerConstructor
    listeners: Set<(error: DicomWorkerLoadError) => void>
    references: number
}

const installations = new WeakMap<object, WorkerInstallation>()

export function installDicomWorkerResolver(
    options: DicomWorkerResolverOptions,
    onError: (error: DicomWorkerLoadError) => void
): () => void {
    const scope = options.scope ?? globalThis as unknown as WorkerRuntimeScope
    if (typeof scope.Worker !== 'function') throw new Error('Web Workers are unavailable in this environment.')
    const baseUrl = normaliseDicomWorkerBasePath(options.workerBasePath, options.documentUrl)
    const existing = installations.get(scope)
    if (existing) {
        if (existing.baseUrl !== baseUrl) {
            throw new Error(`DICOM workers are already configured at ${existing.baseUrl}. All mounted viewers must use the same workerBasePath.`)
        }
        existing.references += 1
        existing.listeners.add(onError)
        return createRelease(scope, existing, onError)
    }

    const nativeWorker = scope.Worker
    const listeners = new Set([onError])
    const routedWorker = class extends nativeWorker {
        constructor(scriptURL: string | URL, workerOptions?: WorkerOptions) {
            const resolvedUrl = resolveDicomWorkerUrl(scriptURL, baseUrl)
            super(resolvedUrl ?? scriptURL, workerOptions)
            if (resolvedUrl) {
                this.addEventListener('error', () => {
                    const error = new DicomWorkerLoadError(resolvedUrl)
                    for (const listener of listeners) listener(error)
                }, { once: true })
            }
        }
    }
    const installation: WorkerInstallation = {
        baseUrl,
        nativeWorker,
        routedWorker,
        listeners,
        references: 1
    }
    installations.set(scope, installation)
    scope.Worker = routedWorker
    return createRelease(scope, installation, onError)
}

function createRelease(
    scope: WorkerRuntimeScope,
    installation: WorkerInstallation,
    listener: (error: DicomWorkerLoadError) => void
): () => void {
    let released = false
    return () => {
        if (released) return
        released = true
        installation.listeners.delete(listener)
        installation.references -= 1
        if (installation.references > 0) return
        if (scope.Worker === installation.routedWorker) scope.Worker = installation.nativeWorker
        installations.delete(scope)
    }
}
