import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getTouchInteraction, TouchPointerTracker } from '../src/touch'

describe('touch interaction policy', () => {
    it('describes gestures according to the active tool', () => {
        assert.equal(getTouchInteraction('Scroll').mode, 'navigate')
        assert.match(getTouchInteraction('Scroll').instruction, /vertically for slices/)
        assert.equal(getTouchInteraction('ZoomAndPan').mode, 'transform')
        assert.match(getTouchInteraction('ZoomAndPan').instruction, /two fingers/)
        assert.equal(getTouchInteraction('WindowLevel').mode, 'contrast')
        assert.deepEqual(getTouchInteraction('ROI', 'Tap boundary points and double-click to finish.'), {
            mode: 'draw',
            instruction: 'Touch: Tap boundary points and double-click to finish.'
        })
    })

    it('tracks concurrent touch pointers without treating mouse input as a gesture', () => {
        const tracker = new TouchPointerTracker()
        assert.deepEqual(tracker.update({ type: 'pointerdown', pointerId: 1, pointerType: 'mouse' }), {
            active: false, count: 0, multiTouch: false
        })
        assert.equal(tracker.update({ type: 'pointerdown', pointerId: 2, pointerType: 'touch' }).count, 1)
        assert.deepEqual(tracker.update({ type: 'pointerdown', pointerId: 3, pointerType: 'touch' }), {
            active: true, count: 2, multiTouch: true
        })
        assert.equal(tracker.update({ type: 'pointerup', pointerId: 2, pointerType: 'touch' }).count, 1)
    })

    it('clears cancelled pointers and can reset an interrupted gesture', () => {
        const tracker = new TouchPointerTracker()
        tracker.update({ type: 'pointerdown', pointerId: 7, pointerType: 'touch' })
        tracker.update({ type: 'pointerdown', pointerId: 8, pointerType: 'touch' })
        assert.deepEqual(tracker.update({ type: 'pointercancel', pointerId: 7, pointerType: 'touch' }), {
            active: true, count: 1, multiTouch: false
        })
        assert.deepEqual(tracker.update({ type: 'lostpointercapture', pointerId: 8, pointerType: 'touch' }), {
            active: false, count: 0, multiTouch: false
        })
        tracker.update({ type: 'pointerdown', pointerId: 9, pointerType: 'touch' })
        assert.deepEqual(tracker.reset(), { active: false, count: 0, multiTouch: false })
    })
})
