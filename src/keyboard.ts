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
    target?: KeyboardTargetLike | null
}

export function isKeyboardInputTarget(target: KeyboardTargetLike | null | undefined): boolean {
    if (!target) return false
    if (target.isContentEditable) return true
    return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName?.toUpperCase() ?? '')
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
