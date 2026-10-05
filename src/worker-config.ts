export const dicomWorkerFiles = Object.freeze([
    'jpeg2000.worker.min.js',
    'jpegbaseline.worker.min.js',
    'jpegloss.worker.min.js',
    'labeling.worker.min.js',
    'resampling.worker.min.js',
    'rle.worker.min.js'
] as const)

export type DicomWorkerFile = typeof dicomWorkerFiles[number]

const workerFileSet = new Set<string>(dicomWorkerFiles)

export function normaliseDicomWorkerBasePath(value: string, documentUrl: string): string {
    if (!value.trim()) throw new TypeError('Worker base path cannot be empty.')

    let page: URL
    let base: URL
    try {
        page = new URL(documentUrl)
        base = new URL(value, page)
    } catch {
        throw new TypeError('Worker base path must be a valid URL or URL path.')
    }

    if (!['http:', 'https:'].includes(base.protocol)) {
        throw new TypeError('Worker base path must use HTTP or HTTPS.')
    }
    if (base.username || base.password) {
        throw new TypeError('Worker base path cannot include credentials.')
    }
    if (base.origin !== page.origin) {
        throw new TypeError('Worker base path must use the application origin.')
    }
    base.search = ''
    base.hash = ''
    if (!base.pathname.endsWith('/')) base.pathname += '/'
    return base.href
}

export function resolveDicomWorkerUrl(
    requestedUrl: string | URL,
    workerBaseUrl: string
): string | null {
    let requested: URL
    try { requested = new URL(requestedUrl, workerBaseUrl) }
    catch { return null }

    const fileName = requested.pathname.split('/').pop() ?? ''
    if (!workerFileSet.has(fileName)) return null
    return new URL(fileName, workerBaseUrl).href
}
