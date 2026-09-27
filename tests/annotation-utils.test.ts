import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reactive } from 'vue'
import * as dwv from 'dwv'
import {
    exportGroups,
    importGroups,
    restoreAnnotationSnapshot,
    validateAnnotationReferences,
    validateAnnotationSnapshot
} from '../src/annotation-utils'

function createGroup() {
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
    return group
}

describe('annotation persistence', () => {
    it('round trips geometry, image/frame references, color and labels through JSON', () => {
        const group = createGroup()
        const mark = group.getList()[0]!
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

    it('round trips circle, angle, and polygon ROI geometry', () => {
        const group = createGroup()
        for (const mark of [...group.getList()]) group.remove(mark.trackingUid)
        const shapes = [
            new dwv.Circle(new dwv.Point2D(25, 30), 12),
            new dwv.Protractor([
                new dwv.Point2D(10, 20),
                new dwv.Point2D(30, 40),
                new dwv.Point2D(50, 20)
            ]),
            new dwv.ROI([
                new dwv.Point2D(5, 5),
                new dwv.Point2D(40, 5),
                new dwv.Point2D(30, 35),
                new dwv.Point2D(5, 5)
            ])
        ]
        for (const [index, shape] of shapes.entries()) {
            const mark = new dwv.Annotation()
            mark.referencedSopInstanceUID = '2.25.3'
            mark.referencedSopClassUID = '1.2.840.10008.5.1.4.1.1.7'
            mark.mathShape = shape
            mark.colour = '#123456'
            mark.textExpr = `Shape ${index + 1}`
            group.add(mark)
        }

        const restored = importGroups(exportGroups([group], dwv), dwv)[0]!.getList()
        assert.ok(restored[0]!.mathShape instanceof dwv.Circle)
        assert.equal(restored[0]!.mathShape.getRadius(), 12)
        assert.ok(restored[1]!.mathShape instanceof dwv.Protractor)
        assert.equal(restored[1]!.mathShape.getLength(), 3)
        assert.ok(restored[2]!.mathShape instanceof dwv.ROI)
        assert.equal(restored[2]!.mathShape.getLength(), 4)
    })
    it('supports clearing and rejects unsupported versions', () => {
        assert.deepEqual(importGroups({ version: 1, groups: [] }, dwv), [])
        assert.throws(() => importGroups({ version: 2, groups: [] } as never, dwv))
    })

    it('validates snapshot structure and resource limits before parsing DICOM data', () => {
        assert.throws(() => validateAnnotationSnapshot({ version: 1, groups: [{}] }), /Invalid annotation group/)
        assert.throws(() => validateAnnotationSnapshot({
            version: 1,
            groups: [{ dicom: {}, appearance: [{ uid: '1', colour: '#fff', text: 'x'.repeat(5) }] }]
        }, { maxGroups: 1, maxAnnotations: 1, maxSnapshotBytes: 1000, maxTextLength: 4 }), /Invalid annotation text/)
        assert.throws(() => validateAnnotationSnapshot({
            version: 1,
            groups: [{ dicom: {}, appearance: [
                { uid: '1', colour: '#fff', text: '' },
                { uid: '1', colour: '#000', text: '' }
            ] }]
        }), /Duplicate annotation ID/)
        assert.throws(() => validateAnnotationSnapshot({ version: 1, groups: [] }, {
            maxGroups: 1, maxAnnotations: 1, maxSnapshotBytes: 1, maxTextLength: 4
        }), /too large/)
    })

    it('validates study, image, frame and shape references', () => {
        const group = createGroup()
        const context = {
            studyInstanceUIDs: new Set(['2.25.1']),
            includesImageUid: (uid: string) => uid === '2.25.3',
            frameCount: 4
        }
        assert.doesNotThrow(() => validateAnnotationReferences([group], dwv, context))

        group.setMetaValue('StudyInstanceUID', '9.9.9')
        assert.throws(() => validateAnnotationReferences([group], dwv, context), /different DICOM study/)
        group.setMetaValue('StudyInstanceUID', '2.25.1')
        group.getList()[0]!.referencedFrameNumber = 5
        assert.throws(() => validateAnnotationReferences([group], dwv, context), /unavailable DICOM frame/)
        group.getList()[0]!.referencedFrameNumber = 4
        group.getList()[0]!.mathShape = {}
        assert.throws(() => validateAnnotationReferences([group], dwv, context), /Unsupported annotation shape/)
    })

    it('leaves existing marks unchanged when a restore is invalid', () => {
        const current = createGroup()
        const savedUid = current.getList()[0]!.trackingUid
        const incoming = createGroup()
        const snapshot = exportGroups([incoming], dwv)
        let applied = false

        snapshot.groups[0]!.appearance[0]!.uid = 'missing-from-dicom-data'
        assert.throws(() => restoreAnnotationSnapshot(snapshot, dwv, {
            studyInstanceUIDs: new Set(['2.25.1']),
            includesImageUid: () => true,
            frameCount: 4
        }, () => { applied = true }), /appearance does not match/)

        incoming.setMetaValue('StudyInstanceUID', '9.9.9')
        const mismatchedSnapshot = exportGroups([incoming], dwv)

        assert.throws(() => restoreAnnotationSnapshot(mismatchedSnapshot, dwv, {
            studyInstanceUIDs: new Set(['2.25.1']),
            includesImageUid: () => true,
            frameCount: 4
        }, groups => {
            applied = true
            for (const mark of [...current.getList()]) current.remove(mark.trackingUid)
            for (const group of groups) for (const mark of group.getList()) current.add(mark)
        }), /different DICOM study/)

        assert.equal(applied, false)
        assert.equal(current.getLength(), 1)
        assert.equal(current.getList()[0]!.trackingUid, savedUid)
    })
})
