import type { Annotation } from 'dwv'
import type { DwvModule } from './dwv-loader'
import type { DicomDrawingShape } from './drawing-shapes'
import type { DicomNavigationModel } from './navigation'

export interface DicomAnnotationSummary {
    uid: string
    dataId: string
    label: string
    colour: string
    shape: DicomDrawingShape | 'Unknown'
    imageUid: string
    frameNumber?: number
}

export interface AnnotationSummarySource {
    dataId: string
    annotations: readonly Annotation[]
}

const shapeFromTrackingId = (trackingId: string): DicomAnnotationSummary['shape'] => {
    const value = trackingId.toLowerCase()
    if (value.includes('protractor')) return 'Protractor'
    if (value.includes('rectangle')) return 'Rectangle'
    if (value.includes('ellipse')) return 'Ellipse'
    if (value.includes('circle')) return 'Circle'
    if (value.includes('arrow')) return 'Arrow'
    if (value.includes('ruler')) return 'Ruler'
    if (value.includes('roi')) return 'ROI'
    return 'Unknown'
}

export function createAnnotationSummary(
    dataId: string,
    annotation: Annotation,
    dwv: DwvModule
): DicomAnnotationSummary {
    let shape = shapeFromTrackingId(annotation.trackingId)
    if (shape === 'Unknown') {
        if (annotation.mathShape instanceof dwv.Rectangle) shape = 'Rectangle'
        else if (annotation.mathShape instanceof dwv.Ellipse) shape = 'Ellipse'
        else if (annotation.mathShape instanceof dwv.Circle) shape = 'Circle'
        else if (annotation.mathShape instanceof dwv.Protractor) shape = 'Protractor'
        else if (annotation.mathShape instanceof dwv.ROI) shape = 'ROI'
    }
    return {
        uid: annotation.trackingUid,
        dataId,
        label: annotation.textExpr,
        colour: annotation.colour,
        shape,
        imageUid: annotation.referencedSopInstanceUID,
        frameNumber: annotation.referencedFrameNumber
    }
}

export function createAnnotationSummaries(
    sources: readonly AnnotationSummarySource[],
    dwv: DwvModule
): DicomAnnotationSummary[] {
    return sources.flatMap(source =>
        source.annotations.map(annotation => createAnnotationSummary(source.dataId, annotation, dwv))
    )
}

export function annotationSummariesEqual(
    left: readonly DicomAnnotationSummary[],
    right: readonly DicomAnnotationSummary[]
): boolean {
    return left.length === right.length && left.every((item, index) => {
        const other = right[index]
        return item.uid === other?.uid &&
            item.dataId === other.dataId &&
            item.label === other.label &&
            item.colour === other.colour &&
            item.shape === other.shape &&
            item.imageUid === other.imageUid &&
            item.frameNumber === other.frameNumber
    })
}

/** Build a complete index that focuses an annotation while preserving unrelated dimensions. */
export function indexForAnnotation(
    currentIndex: readonly number[],
    imageIndex: readonly number[],
    navigation: DicomNavigationModel,
    frameNumber?: number
): number[] | null {
    const slice = imageIndex[navigation.sliceDimension]
    if (typeof slice !== 'number' || !Number.isInteger(slice) || slice < 0 || slice >= navigation.sliceCount) return null
    const result = currentIndex.slice()
    result[navigation.sliceDimension] = slice

    if (navigation.frameDimension !== null) {
        const frame = frameNumber === undefined
            ? currentIndex[navigation.frameDimension]
            : frameNumber - 1
        if (typeof frame !== 'number' || !Number.isInteger(frame) || frame < 0 || frame >= navigation.frameCount) return null
        result[navigation.frameDimension] = frame
    }
    return result
}
