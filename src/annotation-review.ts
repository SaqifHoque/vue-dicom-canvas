import type { App } from 'dwv'

export function assertAnnotationWritable(readOnly: boolean): void {
    if (readOnly) throw new Error('Annotations are read-only.')
}

/** Apply review settings to every annotation group and its rendered layers. */
export function applyAnnotationReviewState(
    app: Pick<App, 'getDataIds' | 'getData' | 'getDrawLayersByDataId'>,
    visible: boolean,
    readOnly: boolean
): void {
    for (const id of app.getDataIds()) {
        const group = app.getData(id)?.annotationGroup
        if (!group) continue
        group.setEditable(!readOnly)
        for (const layer of app.getDrawLayersByDataId(id)) layer.display(visible)
    }
}
