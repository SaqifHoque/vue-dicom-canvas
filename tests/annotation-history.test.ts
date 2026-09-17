import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as dwv from 'dwv'
import { AnnotationHistoryController } from '../src/annotation-history'
import { replaceAnnotationGroups, shouldRestoreAnnotationSnapshot } from '../src/annotation-utils'

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
        assert.equal(history.sync(4, 4).canRedo, false)
        assert.equal(history.sync(3, 4).canRedo, true)
        assert.equal(history.sync(4, 4).canRedo, false, 'a new command after undo discards the redo branch')
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

    it('creates a target group when the first annotation is added', () => {
        const incoming = new dwv.AnnotationGroup()
        const incomingMark = mark()
        incoming.add(incomingMark)
        const created = new dwv.AnnotationGroup()
        let createCount = 0

        const result = replaceAnnotationGroups([], [incoming], () => {
            createCount += 1
            return created
        })

        assert.equal(result.created, true)
        assert.equal(result.target, created)
        assert.equal(createCount, 1)
        assert.deepEqual(created.getList(), [incomingMark])
    })

    it('distinguishes reactive prop updates from emitted snapshots', () => {
        const snapshot = { version: 1, groups: [] } as const
        assert.equal(shouldRestoreAnnotationSnapshot(snapshot, JSON.stringify(snapshot)), false)
        assert.equal(shouldRestoreAnnotationSnapshot(snapshot, ''), true)

        const cyclic: { self?: unknown } = {}
        cyclic.self = cyclic
        assert.equal(shouldRestoreAnnotationSnapshot(cyclic, ''), true)
    })
})
