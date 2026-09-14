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
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.groups) || snapshot.groups.length > 100) {
        throw new TypeError('Unsupported annotation snapshot.')
    }
    const ids = new Set<string>()
    return snapshot.groups.map(saved => {
        if (!saved.dicom || !Array.isArray(saved.appearance)) throw new TypeError('Invalid annotation group.')
        const group = new dwv.AnnotationGroupFactory().create(JSON.parse(JSON.stringify(saved.dicom)))
        for (const mark of group.getList()) {
            if (ids.has(mark.trackingUid)) throw new TypeError('Duplicate annotation ID.')
            ids.add(mark.trackingUid)
            const style = saved.appearance.find(item => item.uid === mark.trackingUid)
            if (style) {
                if (typeof style.colour !== 'string' || typeof style.text !== 'string') throw new TypeError('Invalid annotation appearance.')
                mark.colour = style.colour
                mark.textExpr = style.text
                if (style.label) {
                    if (style.label.length !== 2 || !style.label.every(Number.isFinite)) throw new TypeError('Invalid annotation label position.')
                    mark.labelPosition = new dwv.Point2D(...style.label)
                }
            }
        }
        return group
    })
}
