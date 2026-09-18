import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createNavigationModel, indexForNavigation } from '../src/navigation'

describe('DICOM navigation', () => {
    it('models a spatial series without inventing temporal frames', () => {
        assert.deepEqual(createNavigationModel([512, 512, 12], [0, 0, 4], 2), {
            slice: 5,
            sliceCount: 12,
            frame: 1,
            frameCount: 1,
            sliceDimension: 2,
            frameDimension: null
        })
    })

    it('models spatial slices and temporal frames independently', () => {
        assert.deepEqual(createNavigationModel([256, 256, 8, 20], [0, 0, 2, 6], 2), {
            slice: 3,
            sliceCount: 8,
            frame: 7,
            frameCount: 20,
            sliceDimension: 2,
            frameDimension: 3
        })
    })

    it('preserves the frame while changing slice and preserves the slice while changing frame', () => {
        const current = [0, 0, 2, 6]
        const model = createNavigationModel([256, 256, 8, 20], current, 2)

        assert.deepEqual(indexForNavigation(current, model, 'slice', 8), [0, 0, 7, 6])
        assert.deepEqual(indexForNavigation(current, model, 'frame', 20), [0, 0, 2, 19])
    })

    it('rejects non-integer and out-of-range jumps without changing the current index', () => {
        const current = [0, 0, 2, 6]
        const model = createNavigationModel([256, 256, 8, 20], current, 2)

        assert.equal(indexForNavigation(current, model, 'slice', 0), null)
        assert.equal(indexForNavigation(current, model, 'slice', 9), null)
        assert.equal(indexForNavigation(current, model, 'frame', 1.5), null)
        assert.deepEqual(current, [0, 0, 2, 6])
    })

    it('uses the DWV scroll dimension for reoriented spatial navigation', () => {
        const current = [3, 4, 5]
        const model = createNavigationModel([9, 10, 11], current, 1)

        assert.equal(model.slice, 5)
        assert.equal(model.sliceCount, 10)
        assert.deepEqual(indexForNavigation(current, model, 'slice', 10), [3, 9, 5])
    })
})
