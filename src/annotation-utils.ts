import type { AnnotationGroup, DataElement } from 'dwv'
import type { DwvModule } from './dwv-loader'

/** JSON-compatible snapshot for this package; not a DICOM file or Annotorious format. */
export interface DicomAnnotations {
    version: 1
    groups: Array<{
        dicom: Record<string, DataElement>
        appearance: Array<{ uid: string; colour: string; text: string; label?: [number, number] }>
    }>
}

export interface AnnotationSnapshotLimits {
    maxGroups: number
    maxAnnotations: number
    maxSnapshotBytes: number
    maxTextLength: number
}

export const defaultAnnotationSnapshotLimits: Readonly<AnnotationSnapshotLimits> = Object.freeze({
    maxGroups: 100,
    maxAnnotations: 1000,
    maxSnapshotBytes: 10 * 1024 * 1024,
    maxTextLength: 4096
})

export interface AnnotationReferenceContext {
    studyInstanceUIDs: ReadonlySet<string>
    includesImageUid: (uid: string) => boolean
    frameCount: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const requireString = (value: unknown, name: string, maxLength: number): string => {
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
        throw new TypeError(`Invalid annotation ${name}.`)
    }
    return value
}

/** Validate the package snapshot envelope before passing DICOM data to DWV. */
export function validateAnnotationSnapshot(
    value: unknown,
    limits: AnnotationSnapshotLimits = defaultAnnotationSnapshotLimits
): asserts value is DicomAnnotations {
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.groups)) {
        throw new TypeError('Unsupported annotation snapshot.')
    }
    if (value.groups.length > limits.maxGroups) throw new RangeError('Annotation snapshot has too many groups.')

    let json: string
    try { json = JSON.stringify(value) }
    catch { throw new TypeError('Annotation snapshot must be JSON-compatible.') }
    if (new TextEncoder().encode(json).byteLength > limits.maxSnapshotBytes) {
        throw new RangeError('Annotation snapshot is too large.')
    }

    let annotationCount = 0
    const appearanceIds = new Set<string>()
    for (const saved of value.groups) {
        if (!isRecord(saved) || !isRecord(saved.dicom) || !Array.isArray(saved.appearance)) {
            throw new TypeError('Invalid annotation group.')
        }
        annotationCount += saved.appearance.length
        if (annotationCount > limits.maxAnnotations) throw new RangeError('Annotation snapshot has too many annotations.')
        for (const item of saved.appearance) {
            if (!isRecord(item)) throw new TypeError('Invalid annotation appearance.')
            const uid = requireString(item.uid, 'ID', 128)
            requireString(item.colour, 'colour', 64)
            if (typeof item.text !== 'string' || item.text.length > limits.maxTextLength) {
                throw new TypeError('Invalid annotation text.')
            }
            if (appearanceIds.has(uid)) throw new TypeError('Duplicate annotation ID.')
            appearanceIds.add(uid)
            if (item.label !== undefined && (
                !Array.isArray(item.label) || item.label.length !== 2 || !item.label.every(Number.isFinite)
            )) throw new TypeError('Invalid annotation label position.')
        }
    }
}

export function exportGroups(groups: AnnotationGroup[], dwv: DwvModule): DicomAnnotations {
    const factory = new dwv.AnnotationGroupFactory()
    return JSON.parse(JSON.stringify({
        version: 1,
        groups: groups.filter(group => group.getLength() > 0).map(group => ({
            dicom: factory.toDicom(group),
            appearance: group.getList().map(mark => ({
                uid: mark.trackingUid, colour: mark.colour, text: mark.textExpr,
                label: mark.labelPosition ? [mark.labelPosition.getX(), mark.labelPosition.getY()] : undefined
            }))
        }))
    }))
}

export function importGroups(snapshot: DicomAnnotations, dwv: DwvModule): AnnotationGroup[] {
    validateAnnotationSnapshot(snapshot)
    const ids = new Set<string>()
    let annotationCount = 0
    return snapshot.groups.map(saved => {
        const group = new dwv.AnnotationGroupFactory().create(JSON.parse(JSON.stringify(saved.dicom)))
        annotationCount += group.getLength()
        if (annotationCount > defaultAnnotationSnapshotLimits.maxAnnotations) {
            throw new RangeError('Annotation snapshot has too many annotations.')
        }
        if (group.getLength() !== saved.appearance.length) throw new TypeError('Annotation appearance does not match DICOM data.')
        for (const mark of group.getList()) {
            if (ids.has(mark.trackingUid)) throw new TypeError('Duplicate annotation ID.')
            ids.add(mark.trackingUid)
            const style = saved.appearance.find(item => item.uid === mark.trackingUid)
            if (!style) throw new TypeError('Annotation appearance does not match DICOM data.')
            mark.colour = style.colour
            mark.textExpr = style.text
            if (style.label) {
                mark.labelPosition = new dwv.Point2D(...style.label)
            }
        }
        return group
    })
}

/** Validate imported marks against the image currently loaded in the viewer. */
export function validateAnnotationReferences(
    groups: AnnotationGroup[],
    dwv: DwvModule,
    context: AnnotationReferenceContext
): void {
    const supportedShapes = [dwv.Rectangle, dwv.Ellipse, dwv.ROI, dwv.Circle, dwv.Protractor]
    for (const group of groups) {
        const studyUid = group.getMetaValue('StudyInstanceUID')
        if (typeof studyUid !== 'string' || !context.studyInstanceUIDs.has(studyUid)) {
            throw new Error('Annotations belong to a different DICOM study.')
        }
        for (const mark of group.getList()) {
            if (typeof mark.referencedSopInstanceUID !== 'string' || !context.includesImageUid(mark.referencedSopInstanceUID)) {
                throw new Error('Annotations belong to a different DICOM image or series.')
            }
            if (typeof mark.referencedSopClassUID !== 'string' || mark.referencedSopClassUID.length === 0) {
                throw new TypeError('Invalid annotation image class reference.')
            }
            if (mark.referencedFrameNumber !== undefined && (
                !Number.isInteger(mark.referencedFrameNumber) ||
                mark.referencedFrameNumber < 1 ||
                mark.referencedFrameNumber > context.frameCount
            )) throw new RangeError('Annotation references an unavailable DICOM frame.')
            if (!supportedShapes.some(Shape => mark.mathShape instanceof Shape)) {
                throw new TypeError('Unsupported annotation shape.')
            }
        }
    }
}

/** Parse and validate a snapshot completely before allowing viewer state to change. */
export function restoreAnnotationSnapshot(
    snapshot: DicomAnnotations,
    dwv: DwvModule,
    context: AnnotationReferenceContext,
    apply: (groups: AnnotationGroup[]) => void
): void {
    const groups = importGroups(snapshot, dwv)
    validateAnnotationReferences(groups, dwv, context)
    apply(groups)
}

export interface AnnotationReplacementResult {
    target?: AnnotationGroup
    created: boolean
}

/** Replace all current marks only after a restore has been fully prepared. */
export function replaceAnnotationGroups(
    currentGroups: AnnotationGroup[],
    replacementGroups: AnnotationGroup[],
    createTarget: () => AnnotationGroup
): AnnotationReplacementResult {
    const replacements = replacementGroups.flatMap(group => group.getList())
    let target = currentGroups[0]
    const created = !target && replacements.length > 0
    if (created) target = createTarget()

    for (const group of currentGroups) {
        for (const mark of [...group.getList()]) group.remove(mark.trackingUid)
    }
    if (target) for (const mark of replacements) target.add(mark)
    return { target, created }
}
