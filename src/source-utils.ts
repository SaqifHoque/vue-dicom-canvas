import type { DicomSource } from './types'

export type NormalisedDicomSource = { kind: 'files'; values: File[] } | { kind: 'urls'; values: string[] } | null

export interface DicomSourcePolicy {
    maxSources?: number
    maxFileSizeBytes?: number
    maxTotalFileSizeBytes?: number
    allowInsecureHttp?: boolean
    baseUrl?: string
}

const DEFAULT_MAX_SOURCES = 2000
const DEFAULT_MAX_FILE_SIZE = 512 * 1024 * 1024
const DEFAULT_MAX_TOTAL_FILE_SIZE = 2 * 1024 * 1024 * 1024
const MAX_URL_LENGTH = 8192
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const validateLimit = (value: number, name: string): void => {
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive safe integer.`)
}

const validateUrl = (value: string, policy: DicomSourcePolicy): string => {
    const sourceUrl = value.trim()
    if (!sourceUrl) throw new TypeError('DICOM URL sources cannot be empty.')
    if (sourceUrl.length > MAX_URL_LENGTH) throw new TypeError(`DICOM URLs cannot exceed ${MAX_URL_LENGTH} characters.`)

    const baseUrl = policy.baseUrl ?? (typeof window !== 'undefined' ? window.location.href : 'https://localhost/')
    let parsed: URL
    try {
        parsed = new URL(sourceUrl, baseUrl)
    } catch {
        throw new TypeError('DICOM URL source is invalid.')
    }

    if (parsed.username || parsed.password) throw new TypeError('DICOM URLs cannot contain embedded credentials.')
    const isRelative = !/^[a-z][a-z\d+.-]*:/i.test(sourceUrl) && !sourceUrl.startsWith('//')
    if (isRelative) return sourceUrl
    if (parsed.protocol === 'https:' || parsed.protocol === 'blob:') return sourceUrl
    if (parsed.protocol === 'http:' && (policy.allowInsecureHttp || LOOPBACK_HOSTS.has(parsed.hostname))) return sourceUrl

    throw new TypeError(`DICOM URL protocol "${parsed.protocol}" is not allowed.`)
}

/** Validate a public source value and return a mutable array suitable for DWV. */
export const normaliseDicomSource = (source: DicomSource, policy: DicomSourcePolicy = {}): NormalisedDicomSource => {
    if (source === null || source === undefined) return null

    const values = Array.isArray(source) ? [...source] : [source]
    if (values.length === 0) return null

    const maxSources = policy.maxSources ?? DEFAULT_MAX_SOURCES
    validateLimit(maxSources, 'maxSources')
    if (values.length > maxSources) throw new RangeError(`DICOM source contains more than ${maxSources} items.`)

    if (values.every((item): item is string => typeof item === 'string')) {
        return { kind: 'urls', values: values.map((url) => validateUrl(url, policy)) }
    }

    if (typeof File !== 'undefined' && values.every((item): item is File => item instanceof File)) {
        const maxFileSize = policy.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE
        const maxTotalFileSize = policy.maxTotalFileSizeBytes ?? DEFAULT_MAX_TOTAL_FILE_SIZE
        validateLimit(maxFileSize, 'maxFileSizeBytes')
        validateLimit(maxTotalFileSize, 'maxTotalFileSizeBytes')

        if (values.some((file) => file.size > maxFileSize)) throw new RangeError(`A DICOM file exceeds the ${maxFileSize}-byte size limit.`)
        const totalSize = values.reduce((total, file) => total + file.size, 0)
        if (!Number.isSafeInteger(totalSize) || totalSize > maxTotalFileSize) {
            throw new RangeError(`DICOM files exceed the ${maxTotalFileSize}-byte total size limit.`)
        }
        return { kind: 'files', values }
    }

    throw new TypeError('DICOM source must contain only File objects or only URL strings.')
}
