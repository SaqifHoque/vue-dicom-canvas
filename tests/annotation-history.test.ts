import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as dwv from 'dwv'
import { AnnotationHistoryController } from '../src/annotation-history'
import { replaceAnnotationGroups } from '../src/annotation-utils'

const mark = (): dwv.Annotation => {
    const value = new dwv.Annotation()
    value.mathShape = new dwv.Rectangle(new dwv.Point2D(0, 0), new dwv.Point2D(1, 1))
    return value
}

describe('annotation replacement and history', () => {
    it('keeps undo and redo inside the latest replacement boundary', () => {
        const history = new AnnotationHistoryController()
        assert.deepEqual(history.setBoundary(3), {
            index: 3, floor: 3, ceiling: 3, canUndo: false, canRedo: false
        })
        assert.equal(history.sync(4, 4).canUndo, true)
        assert.equal(history.sync(3, 4).canRedo, true)
        assert.deepEqual(history.reset(), {
            index: 0, floor: 0, ceiling: 0, canUndo: false, canRedo: false
        })
    })

    it('replaces and clears marks through one operation', () => {
        const current = new dwv.AnnotationGroup()
        current.add(mark())
        const incoming = new dwv.AnnotationGroup()
        const incomingMark = mark()
        incoming.add(incomingMark)

        const replaced = replaceAnnotationGroups([current], [incoming], () => new dwv.AnnotationGroup())
        assert.equal(replaced.created, false)
        assert.deepEqual(current.getList(), [incomingMark])

        replaceAnnotationGroups([current], [], () => new dwv.AnnotationGroup())
        assert.equal(current.getLength(), 0)
    })
})
