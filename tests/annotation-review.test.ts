import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as dwv from 'dwv'
import { applyAnnotationReviewState, assertAnnotationWritable } from '../src/annotation-review'
import { exportGroups, importGroups } from '../src/annotation-utils'

describe('annotation review state', () => {
    it('changes only annotation layers and allows navigation data to remain available', () => {
        const first = new dwv.AnnotationGroup()
        const second = new dwv.AnnotationGroup()
        const calls: Array<[string, boolean]> = []
        const app = {
            getDataIds: () => ['image', 'first', 'second'],
            getData: (id: string) => id === 'image' ? { image: {} } : { annotationGroup: id === 'first' ? first : second },
            getDrawLayersByDataId: (id: string) => [{ display: (visible: boolean) => calls.push([id, visible]) }]
        } as unknown as dwv.App

        applyAnnotationReviewState(app, false, true)
        assert.equal(first.isEditable(), false)
        assert.equal(second.isEditable(), false)
        assert.deepEqual(calls, [['first', false], ['second', false]])

        applyAnnotationReviewState(app, true, false)
        assert.equal(first.isEditable(), true)
        assert.equal(second.isEditable(), true)
        assert.deepEqual(calls.slice(2), [['first', true], ['second', true]])
    })

    it('keeps marks in snapshots while hidden and reapplies review state after restoration', () => {
        const mark = new dwv.Annotation()
        mark.referencedSopInstanceUID = '2.25.3'
        mark.referencedSopClassUID = '1.2.840.10008.5.1.4.1.1.7'
        mark.mathShape = new dwv.Rectangle(new dwv.Point2D(10, 20), new dwv.Point2D(40, 70))
        const original = new dwv.AnnotationGroup([mark])
        original.setMetaValue('Modality', 'SR')
        original.setMetaValue('StudyInstanceUID', '2.25.1')
        original.setMetaValue('CurrentRequestedProcedureEvidenceSequence', { value: [{
            StudyInstanceUID: '2.25.1', ReferencedSeriesSequence: { value: [{ SeriesInstanceUID: '2.25.2' }] }
        }] })
        const snapshot = exportGroups([original], dwv)
        const restored = importGroups(snapshot, dwv)[0]!
        const visibility: boolean[] = []
        const app = {
            getDataIds: () => ['annotations'],
            getData: () => ({ annotationGroup: restored }),
            getDrawLayersByDataId: () => [{ display: (visible: boolean) => visibility.push(visible) }]
        } as unknown as dwv.App

        applyAnnotationReviewState(app, false, true)
        assert.equal(restored.isEditable(), false)
        assert.equal(restored.getLength(), 1)
        assert.deepEqual(exportGroups([restored], dwv).groups[0]?.appearance, snapshot.groups[0]?.appearance)
        assert.deepEqual(visibility, [false])
        assert.throws(() => assertAnnotationWritable(true), /read-only/)
        assert.doesNotThrow(() => assertAnnotationWritable(false))
    })
})
