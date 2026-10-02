import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    createViewportState,
    validateViewportPan,
    validateViewportZoom,
    zoomStepForTarget
} from '../src/viewport'

describe('viewport state', () => {
    it('reports zoom relative to the fitted base scale and shared pan offset', () => {
        assert.deepEqual(createViewportState({
            getAddedScale: () => ({ x: 1.5, y: 1.5, z: 1.5 }),
            getOffset: () => ({ x: -24, y: 12, z: 0 })
        }), {
            zoom: 1.5,
            pan: { x: -24, y: 12 },
            isDefault: false
        })
    })

    it('recognises the fitted, unpanned viewport as the default', () => {
        assert.deepEqual(createViewportState({
            getAddedScale: () => ({ x: 1, y: 1, z: 1 }),
            getOffset: () => ({ x: 0, y: -0, z: 0 })
        }), {
            zoom: 1,
            pan: { x: 0, y: 0 },
            isDefault: true
        })
    })

    it('calculates absolute zoom changes without accumulating button error', () => {
        assert.equal(zoomStepForTarget(1, 1.25), 0.25)
        assert.equal(zoomStepForTarget(2, 1), -0.5)
    })

    it('bounds zoom and rejects invalid pan values', () => {
        assert.equal(validateViewportZoom(0.1), 0.1)
        assert.equal(validateViewportZoom(10), 10)
        assert.throws(() => validateViewportZoom(0.09), /between 0.1 and 10/)
        assert.throws(() => validateViewportZoom(Number.NaN), /finite number/)
        assert.deepEqual(validateViewportPan({ x: -10, y: 5 }), { x: -10, y: 5 })
        assert.throws(() => validateViewportPan({ x: Infinity, y: 0 }), /finite numbers/)
    })
})
