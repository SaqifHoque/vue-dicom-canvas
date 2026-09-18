export type DicomNavigationAxis = 'slice' | 'frame'

export interface DicomNavigationState {
    slice: number
    sliceCount: number
    frame: number
    frameCount: number
}

export interface DicomNavigationModel extends DicomNavigationState {
    sliceDimension: number
    frameDimension: number | null
}

const dimensionLength = (size: readonly number[], dimension: number): number => {
    const value = size[dimension]
    return Number.isInteger(value) && value > 0 ? value : 1
}

const positionAt = (index: readonly number[], dimension: number): number => {
    const value = index[dimension]
    return Number.isInteger(value) && value >= 0 ? value : 0
}

/** Maps DWV's spatial scroll dimension and optional fourth dimension independently. */
export function createNavigationModel(
    size: readonly number[],
    index: readonly number[],
    scrollDimension: number
): DicomNavigationModel {
    const sliceDimension = Number.isInteger(scrollDimension) && scrollDimension >= 0
        ? scrollDimension
        : 2
    const frameDimension = size.length > 3 && sliceDimension !== 3 ? 3 : null
    const sliceCount = dimensionLength(size, sliceDimension)
    const frameCount = frameDimension === null ? 1 : dimensionLength(size, frameDimension)

    return {
        slice: Math.min(positionAt(index, sliceDimension) + 1, sliceCount),
        sliceCount,
        frame: frameDimension === null
            ? 1
            : Math.min(positionAt(index, frameDimension) + 1, frameCount),
        frameCount,
        sliceDimension,
        frameDimension
    }
}

/** Returns a changed zero-based DWV index, or null when the requested position is invalid. */
export function indexForNavigation(
    currentIndex: readonly number[],
    model: DicomNavigationModel,
    axis: DicomNavigationAxis,
    oneBasedPosition: number
): number[] | null {
    const dimension = axis === 'slice' ? model.sliceDimension : model.frameDimension
    const count = axis === 'slice' ? model.sliceCount : model.frameCount
    if (
        dimension === null ||
        !Number.isInteger(oneBasedPosition) ||
        oneBasedPosition < 1 ||
        oneBasedPosition > count
    ) return null

    const nextIndex = currentIndex.slice()
    nextIndex[dimension] = oneBasedPosition - 1
    return nextIndex
}
