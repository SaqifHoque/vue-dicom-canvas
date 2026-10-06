export interface DicomRequestHeader {
    name: string
    value: string
}

export interface DicomRemoteRequestOptions {
    headers?: readonly DicomRequestHeader[]
    withCredentials?: boolean
    batchSize?: number
}

export interface DwvUrlRequestOptions {
    requestHeaders?: DicomRequestHeader[]
    withCredentials?: boolean
    batchSize?: number
}

const MAX_HEADERS = 64
const MAX_HEADER_VALUE_LENGTH = 8192
const MAX_BATCH_SIZE = 1000
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~\dA-Za-z-]+$/
const forbiddenHeaders = new Set([
    'connection',
    'content-length',
    'cookie',
    'host',
    'origin',
    'proxy-authorization',
    'referer',
    'transfer-encoding',
    'upgrade'
])

function normaliseHeaders(headers: readonly DicomRequestHeader[] | undefined): DicomRequestHeader[] | undefined {
    if (headers === undefined) return undefined
    if (!Array.isArray(headers)) throw new TypeError('Remote request headers must be an array.')
    if (headers.length > MAX_HEADERS) throw new RangeError(`Remote requests cannot contain more than ${MAX_HEADERS} headers.`)

    const names = new Set<string>()
    return headers.map((header) => {
        if (typeof header !== 'object' || header === null) throw new TypeError('Each remote request header must contain a name and value.')
        const name = header.name?.trim()
        const value = header.value
        if (!name || !HEADER_NAME_PATTERN.test(name)) throw new TypeError('Remote request header names must be valid HTTP tokens.')
        if (typeof value !== 'string') throw new TypeError(`Remote request header "${name}" must have a string value.`)
        if (/[\0\r\n]/.test(value)) throw new TypeError(`Remote request header "${name}" cannot contain control characters.`)
        if (value.length > MAX_HEADER_VALUE_LENGTH) throw new RangeError(`Remote request header "${name}" is too long.`)

        const lowerName = name.toLowerCase()
        if (forbiddenHeaders.has(lowerName) || lowerName.startsWith('sec-') || lowerName.startsWith('proxy-')) {
            throw new TypeError(`Remote request header "${name}" is controlled by the browser.`)
        }
        if (names.has(lowerName)) throw new TypeError(`Remote request header "${name}" is duplicated.`)
        names.add(lowerName)
        return { name, value }
    })
}

/** Validate and detach public options before handing one load to DWV. */
export function createDwvUrlRequestOptions(
    options: DicomRemoteRequestOptions | null | undefined
): DwvUrlRequestOptions | undefined {
    if (options === null || options === undefined) return undefined
    if (typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('Remote request options must be an object.')
    }

    const requestHeaders = normaliseHeaders(options.headers)
    if (options.withCredentials !== undefined && typeof options.withCredentials !== 'boolean') {
        throw new TypeError('withCredentials must be a boolean.')
    }
    if (
        options.batchSize !== undefined &&
        (!Number.isSafeInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > MAX_BATCH_SIZE)
    ) {
        throw new RangeError(`batchSize must be an integer from 1 through ${MAX_BATCH_SIZE}.`)
    }

    const result: DwvUrlRequestOptions = {}
    if (requestHeaders !== undefined) result.requestHeaders = requestHeaders
    if (options.withCredentials !== undefined) result.withCredentials = options.withCredentials
    if (options.batchSize !== undefined) result.batchSize = options.batchSize
    return Object.keys(result).length ? result : undefined
}

/** Keeps only the detached options needed to retry the current request. */
export class RemoteRequestOptionsStore {
    #retryOptions: DicomRemoteRequestOptions | undefined

    prepare(options: DicomRemoteRequestOptions | null | undefined): DwvUrlRequestOptions | undefined {
        const prepared = createDwvUrlRequestOptions(options)
        this.#retryOptions = prepared ? {
            headers: prepared.requestHeaders?.map(header => ({ ...header })),
            withCredentials: prepared.withCredentials,
            batchSize: prepared.batchSize
        } : undefined
        return prepared
    }

    getRetryOptions(): DicomRemoteRequestOptions | undefined {
        return this.#retryOptions ? {
            headers: this.#retryOptions.headers?.map(header => ({ ...header })),
            withCredentials: this.#retryOptions.withCredentials,
            batchSize: this.#retryOptions.batchSize
        } : undefined
    }

    clear(): void {
        this.#retryOptions = undefined
    }
}
