import {
    defaultAnnotationSnapshotLimits,
    validateAnnotationSnapshot,
    type DicomAnnotations
} from './annotation-utils'

/** Decode the package JSON format; image-reference validation happens during viewer restore. */
export function decodeAnnotationSnapshot(json: string): DicomAnnotations {
    if (new TextEncoder().encode(json).byteLength > defaultAnnotationSnapshotLimits.maxSnapshotBytes) {
        throw new RangeError('Annotation file is too large.')
    }
    let snapshot: unknown
    try { snapshot = JSON.parse(json.replace(/^\uFEFF/, '')) }
    catch { throw new TypeError('Annotation file must contain valid JSON.') }
    validateAnnotationSnapshot(snapshot)
    return snapshot
}

export function encodeAnnotationSnapshot(snapshot: DicomAnnotations): string {
    validateAnnotationSnapshot(snapshot)
    return JSON.stringify(snapshot)
}

/** Reject oversized files before reading their contents into memory. */
export async function readAnnotationFile(file: Blob): Promise<DicomAnnotations> {
    if (file.size > defaultAnnotationSnapshotLimits.maxSnapshotBytes) {
        throw new RangeError('Annotation file is too large.')
    }
    return decodeAnnotationSnapshot(await file.text())
}

export function createAnnotationFile(snapshot: DicomAnnotations): Blob {
    return new Blob([encodeAnnotationSnapshot(snapshot)], { type: 'application/json;charset=utf-8' })
}

/** Apply only while the original viewer state is still current. */
export async function restoreAnnotationFile(
    file: Blob,
    isCurrent: () => boolean,
    apply: (snapshot: DicomAnnotations) => void
): Promise<boolean> {
    const snapshot = await readAnnotationFile(file)
    if (!isCurrent()) return false
    apply(snapshot)
    return true
}
