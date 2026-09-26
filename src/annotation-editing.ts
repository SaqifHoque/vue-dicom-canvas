import type { Annotation, Command, DrawController } from 'dwv'

export interface DicomAnnotationSelection {
    uid: string
    dataId: string
    colour: string
    label: string
}

export interface DicomAnnotationEdit {
    colour?: string
    label?: string
}

export type AddAnnotationCommand = (command: Command) => void

const annotationForSelection = (
    controller: DrawController,
    selection: DicomAnnotationSelection
): Annotation => {
    const annotation = controller.getAnnotation(selection.uid)
    if (!annotation) throw new Error('The selected annotation is no longer available.')
    return annotation
}

export function createAnnotationSelection(
    dataId: string,
    annotation: Pick<Annotation, 'trackingUid' | 'colour' | 'textExpr'>
): DicomAnnotationSelection {
    if (!dataId || !annotation.trackingUid) throw new TypeError('Invalid annotation selection.')
    return {
        uid: annotation.trackingUid,
        dataId,
        colour: annotation.colour,
        label: annotation.textExpr
    }
}

export function editAnnotation(
    controller: DrawController,
    selection: DicomAnnotationSelection,
    edit: DicomAnnotationEdit,
    addToUndoStack: AddAnnotationCommand
): DicomAnnotationSelection {
    const annotation = annotationForSelection(controller, selection)
    const original: DicomAnnotationEdit = {}
    const replacement: Record<string, string> = {}

    if (edit.colour !== undefined) {
        if (!/^#[0-9a-f]{6}$/i.test(edit.colour)) throw new TypeError('Annotation colour must be a six-digit hex value.')
        if (edit.colour !== annotation.colour) {
            original.colour = annotation.colour
            replacement.colour = edit.colour
        }
    }
    if (edit.label !== undefined) {
        if (edit.label.length > 4096) throw new RangeError('Annotation label is too long.')
        if (edit.label !== annotation.textExpr) {
            original.label = annotation.textExpr
            replacement.textExpr = edit.label
        }
    }

    if (Object.keys(replacement).length > 0) {
        const commandOriginal: Record<string, string> = {}
        if (original.colour !== undefined) commandOriginal.colour = original.colour
        if (original.label !== undefined) commandOriginal.textExpr = original.label
        controller.updateAnnotationWithCommand(selection.uid, commandOriginal, replacement, addToUndoStack)
    }
    return createAnnotationSelection(selection.dataId, annotation)
}

export function deleteAnnotation(
    controller: DrawController,
    selection: DicomAnnotationSelection,
    addToUndoStack: AddAnnotationCommand
): void {
    annotationForSelection(controller, selection)
    controller.removeAnnotationWithCommand(selection.uid, addToUndoStack)
}
