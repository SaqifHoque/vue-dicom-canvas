import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reactive } from 'vue'
import * as dwv from 'dwv'
import { exportGroups, importGroups } from '../src/annotation-utils'

describe('annotation persistence', () => {
    it('round trips geometry, image/frame references, color and labels through JSON', () => {
        const group = new dwv.AnnotationGroup()
        group.setMetaValue('Modality', 'SR')
        group.setMetaValue('StudyInstanceUID', '2.25.1')
        group.setMetaValue('CurrentRequestedProcedureEvidenceSequence', { value: [{
            StudyInstanceUID: '2.25.1', ReferencedSeriesSequence: { value: [{ SeriesInstanceUID: '2.25.2' }] }
        }] })
        const mark = new dwv.Annotation()
        mark.referencedSopInstanceUID = '2.25.3'
        mark.referencedSopClassUID = '1.2.840.10008.5.1.4.1.1.7'
        mark.referencedFrameNumber = 4
        mark.mathShape = new dwv.Rectangle(new dwv.Point2D(10, 20), new dwv.Point2D(40, 70))
        mark.colour = '#12ab34'
        mark.textExpr = 'Saved region'
        mark.labelPosition = new dwv.Point2D(42, 75)
        group.add(mark)
        const saved = JSON.parse(JSON.stringify(exportGroups([group], dwv)))
        const restored = importGroups(reactive(saved), dwv)[0]!.getList()[0]!
        assert.equal(restored.trackingUid, mark.trackingUid)
        assert.equal(restored.referencedSopInstanceUID, mark.referencedSopInstanceUID)
        assert.equal(restored.referencedFrameNumber, 4)
        assert.equal(restored.colour, '#12ab34')
        assert.equal(restored.textExpr, 'Saved region')
        assert.equal(restored.labelPosition?.getX(), 42)
        assert.ok(restored.mathShape instanceof dwv.Rectangle)
        assert.equal(restored.mathShape.getEnd().getY(), 70)
    })
    it('supports clearing and rejects unsupported versions', () => {
        assert.deepEqual(importGroups({ version: 1, groups: [] }, dwv), [])
        assert.throws(() => importGroups({ version: 2, groups: [] } as never, dwv))
    })
})
