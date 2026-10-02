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

export interface ViewportTransformTarget<TCenter = unknown> extends ViewportStateSource {
    getBaseScale(): { x: number; y: number; z: number }
    setScale(scale: { x: number; y: number; z: number }, center?: TCenter): void
    setOffset(offset: { x: number; y: number; z: number }): void
    draw(): void
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

export function applyViewportZoom<TCenter>(
    target: ViewportTransformTarget<TCenter>,
    value: number,
    center?: TCenter
): DicomViewportState {
    const zoom = validateViewportZoom(value)
    const base = target.getBaseScale()
    target.setScale({ x: base.x * zoom, y: base.y * zoom, z: base.z * zoom }, center)
    target.draw()
    return createViewportState(target)
}

export function applyViewportPan(
    target: ViewportTransformTarget,
    value: DicomViewportPoint
): DicomViewportState {
    const pan = validateViewportPan(value)
    target.setOffset({ ...pan, z: target.getOffset().z })
    target.draw()
    return createViewportState(target)
}
