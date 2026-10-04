export type DicomTouchInteractionMode = 'navigate' | 'transform' | 'contrast' | 'draw'

export interface DicomTouchInteraction {
    mode: DicomTouchInteractionMode
    instruction: string
}

export function getTouchInteraction(tool: string, drawingInstruction?: string): DicomTouchInteraction {
    switch (tool) {
        case 'Scroll':
            return {
                mode: 'navigate',
                instruction: 'Touch: drag vertically for slices or horizontally for frames.'
            }
        case 'ZoomAndPan':
            return {
                mode: 'transform',
                instruction: 'Touch: drag with one finger to pan; use two fingers to zoom or scroll.'
            }
        case 'WindowLevel':
            return {
                mode: 'contrast',
                instruction: 'Touch: drag over the image to adjust window and level.'
            }
        default:
            return {
                mode: 'draw',
                instruction: `Touch: ${drawingInstruction ?? 'use one finger to place or draw the selected mark.'}`
            }
    }
}

export interface TouchPointerEventLike {
    type: string
    pointerId: number
    pointerType: string
}

export interface TouchPointerState {
    active: boolean
    count: number
    multiTouch: boolean
}

export class TouchPointerTracker {
    readonly #activePointers = new Set<number>()

    update(event: TouchPointerEventLike): TouchPointerState {
        if (event.pointerType !== 'touch') return this.getState()
        if (event.type === 'pointerdown') this.#activePointers.add(event.pointerId)
        else if (
            event.type === 'pointerup' ||
            event.type === 'pointercancel' ||
            event.type === 'lostpointercapture'
        ) this.#activePointers.delete(event.pointerId)
        return this.getState()
    }

    reset(): TouchPointerState {
        this.#activePointers.clear()
        return this.getState()
    }

    getState(): TouchPointerState {
        const count = this.#activePointers.size
        return { active: count > 0, count, multiTouch: count > 1 }
    }
}
