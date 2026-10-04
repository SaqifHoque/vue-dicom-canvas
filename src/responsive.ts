export type DicomViewerLayout = 'narrow' | 'compact' | 'wide'

export const viewerLayoutBreakpoints = Object.freeze({ narrow: 480, compact: 720 })

export function getViewerLayout(width: number): DicomViewerLayout {
    if (!Number.isFinite(width) || width < 0) {
        throw new TypeError('Viewer width must be a non-negative finite number.')
    }
    if (width <= viewerLayoutBreakpoints.narrow) return 'narrow'
    if (width <= viewerLayoutBreakpoints.compact) return 'compact'
    return 'wide'
}
