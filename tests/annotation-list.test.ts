import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as dwv from 'dwv'
import { createAnnotationSummary, indexForAnnotation } from '../src/annotation-list'
import { createNavigationModel } from '../src/navigation'

describe('annotation list', () => {
    it('creates a stable public summary from a mark', () => {
        const annotation = new dwv.Annotation()
        annotation.colour = '#aabbcc'
        annotation.textExpr = 'Measured area'
        annotation.referencedSopInstanceUID = '2.25.3'
        annotation.referencedFrameNumber = 2
        annotation.mathShape = new dwv.Rectangle(new dwv.Point2D(1, 2), new dwv.Point2D(3, 4))

        assert.deepEqual(createAnnotationSummary('drawings', annotation, dwv), {
            uid: annotation.trackingUid,
            dataId: 'drawings',
            label: 'Measured area',
            colour: '#aabbcc',
            shape: 'Rectangle',
            imageUid: '2.25.3',
            frameNumber: 2
        })
    })

    it('focuses the referenced slice and frame while preserving other dimensions', () => {
        const model = createNavigationModel([128, 128, 12, 4], [8, 9, 2, 0], 2)
        assert.deepEqual(indexForAnnotation([8, 9, 2, 0], [0, 0, 7, 0], model, 3), [8, 9, 7, 2])
        assert.equal(indexForAnnotation([8, 9, 2, 0], [0, 0, 12, 0], model, 3), null)
        assert.equal(indexForAnnotation([8, 9, 2, 0], [0, 0, 7, 0], model, 5), null)
    })
})
