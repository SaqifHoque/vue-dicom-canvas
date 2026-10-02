export const viewportZoomBounds = Object.freeze({ min: 0.1, max: 10 })

export interface DicomViewportPoint {
    x: number
    y: number
}

export interface DicomViewportState {
    zoom: number
    pan: DicomViewportPoint
    isDefault: boolean
}

export interface ViewportStateSource {
    getAddedScale(): { x: number; y: number; z: number }
    getOffset(): { x: number; y: number; z: number }
}

const normaliseZero = (value: number): number => Object.is(value, -0) ? 0 : value

export function createViewportState(source: ViewportStateSource): DicomViewportState {
    const scale = source.getAddedScale()
    const offset = source.getOffset()
    if (![scale.x, scale.y, offset.x, offset.y].every(Number.isFinite)) {
        throw new TypeError('Viewport transform values must be finite numbers.')
    }
    const zoom = (Math.abs(scale.x) + Math.abs(scale.y)) / 2
    const pan = { x: normaliseZero(offset.x), y: normaliseZero(offset.y) }
    return {
        zoom,
        pan,
        isDefault: Math.abs(zoom - 1) < 1e-9 && pan.x === 0 && pan.y === 0
    }
}

export function validateViewportZoom(value: number): number {
    if (!Number.isFinite(value)) throw new TypeError('Viewport zoom must be a finite number.')
    if (value < viewportZoomBounds.min || value > viewportZoomBounds.max) {
        throw new RangeError(`Viewport zoom must be between ${viewportZoomBounds.min} and ${viewportZoomBounds.max}.`)
    }
    return value
}

export function zoomStepForTarget(current: number, target: number): number {
    validateViewportZoom(current)
    validateViewportZoom(target)
    return target / current - 1
}

export function validateViewportPan(point: DicomViewportPoint): DicomViewportPoint {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        throw new TypeError('Viewport pan values must be finite numbers.')
    }
    return { ...point }
}
