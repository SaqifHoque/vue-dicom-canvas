export type DicomViewerKeyboardAction =
    | 'previous-slice'
    | 'next-slice'
    | 'previous-frame'
    | 'next-frame'
    | 'zoom-out'
    | 'zoom-in'
    | 'reset-view'
    | 'fit-view'
    | 'scroll-tool'
    | 'zoom-tool'
    | 'window-level-tool'

export interface DicomViewerKeyboardState {
    slice: number
    sliceCount: number
    frame: number
    frameCount: number
    zoom: number
}

export type DicomViewerKeyboardCommand =
    | { type: 'slice'; value: number; announcement: string }
    | { type: 'frame'; value: number; announcement: string }
    | { type: 'zoom'; value: number; announcement: string }
    | { type: 'reset-view' | 'fit-view'; announcement: string }
    | { type: 'tool'; value: 'Scroll' | 'ZoomAndPan' | 'WindowLevel'; announcement: string }

export const viewerKeyboardShortcuts = Object.freeze([
    { keys: 'Arrow Left or Page Up', action: 'Previous slice' },
    { keys: 'Arrow Right or Page Down', action: 'Next slice' },
    { keys: 'Arrow Up / Arrow Down', action: 'Previous / next frame' },
    { keys: 'Plus / Minus', action: 'Zoom in / out' },
    { keys: '0', action: 'Reset view' },
    { keys: 'F', action: 'Fit image' },
    { keys: 'S / Z / W', action: 'Scroll / zoom-pan / window-level tool' }
])

interface KeyboardTargetLike {
    tagName?: string
    isContentEditable?: boolean
}

interface KeyboardEventLike {
    key: string
    altKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    target?: EventTarget | KeyboardTargetLike | null
}

export function isKeyboardInputTarget(target: EventTarget | KeyboardTargetLike | null | undefined): boolean {
    if (!target) return false
    const element = target as KeyboardTargetLike
    if (element.isContentEditable) return true
    return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(element.tagName?.toUpperCase() ?? '')
}

export function resolveViewerKeyboardAction(event: KeyboardEventLike): DicomViewerKeyboardAction | null {
    if (event.altKey || event.ctrlKey || event.metaKey || isKeyboardInputTarget(event.target)) return null
    switch (event.key.toLowerCase()) {
        case 'arrowleft':
        case 'pageup': return 'previous-slice'
        case 'arrowright':
        case 'pagedown': return 'next-slice'
        case 'arrowup': return 'previous-frame'
        case 'arrowdown': return 'next-frame'
        case '-': return 'zoom-out'
        case '+':
        case '=': return 'zoom-in'
        case '0': return 'reset-view'
        case 'f': return 'fit-view'
        case 's': return 'scroll-tool'
        case 'z': return 'zoom-tool'
        case 'w': return 'window-level-tool'
        default: return null
    }
}

const boundedPosition = (value: number, count: number): number =>
    Math.min(Math.max(value, 1), Math.max(count, 1))

const boundedZoom = (value: number): number => Math.min(Math.max(value, 0.1), 10)

export function createViewerKeyboardCommand(
    action: DicomViewerKeyboardAction,
    state: DicomViewerKeyboardState
): DicomViewerKeyboardCommand | null {
    switch (action) {
        case 'previous-slice':
        case 'next-slice': {
            const slice = boundedPosition(state.slice + (action === 'previous-slice' ? -1 : 1), state.sliceCount)
            return { type: 'slice', value: slice, announcement: `Slice ${slice} of ${state.sliceCount}` }
        }
        case 'previous-frame':
        case 'next-frame': {
            if (state.frameCount < 2) return null
            const frame = boundedPosition(state.frame + (action === 'previous-frame' ? -1 : 1), state.frameCount)
            return { type: 'frame', value: frame, announcement: `Frame ${frame} of ${state.frameCount}` }
        }
        case 'zoom-out':
        case 'zoom-in': {
            const factor = action === 'zoom-out' ? 1 / 1.25 : 1.25
            const zoom = boundedZoom(state.zoom * factor)
            return { type: 'zoom', value: zoom, announcement: `Zoom ${Math.round(zoom * 100)} percent` }
        }
        case 'reset-view': return { type: 'reset-view', announcement: 'View reset' }
        case 'fit-view': return { type: 'fit-view', announcement: 'Image fit to viewer' }
        case 'scroll-tool': return { type: 'tool', value: 'Scroll', announcement: 'Scroll slices tool selected' }
        case 'zoom-tool': return { type: 'tool', value: 'ZoomAndPan', announcement: 'Zoom and pan tool selected' }
        case 'window-level-tool': return { type: 'tool', value: 'WindowLevel', announcement: 'Window and level tool selected' }
    }
}
