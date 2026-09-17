export interface AnnotationHistoryState {
    index: number
    floor: number
    ceiling: number
    canUndo: boolean
    canRedo: boolean
}

export type AnnotationChangeReason = 'draw' | 'undo' | 'redo' | 'replace' | 'clear' | 'prop'

export interface AnnotationChangeDetails {
    reason: AnnotationChangeReason
    history: AnnotationHistoryState
}

const normaliseIndex = (value: number): number =>
    Number.isInteger(value) && value > 0 ? value : 0

/** Tracks the portion of DWV's undo stack owned by the current annotation set. */
export class AnnotationHistoryController {
    private index = 0
    private floor = 0
    private ceiling = 0

    reset(): AnnotationHistoryState {
        this.index = 0
        this.floor = 0
        this.ceiling = 0
        return this.getState()
    }

    setBoundary(stackIndex: number): AnnotationHistoryState {
        this.index = normaliseIndex(stackIndex)
        this.floor = this.index
        this.ceiling = this.index
        return this.getState()
    }

    sync(stackIndex: number, stackSize: number): AnnotationHistoryState {
        this.index = Math.max(this.floor, normaliseIndex(stackIndex))
        this.ceiling = Math.max(this.index, normaliseIndex(stackSize))
        return this.getState()
    }

    getState(): AnnotationHistoryState {
        return {
            index: this.index,
            floor: this.floor,
            ceiling: this.ceiling,
            canUndo: this.index > this.floor,
            canRedo: this.index < this.ceiling
        }
    }
}
