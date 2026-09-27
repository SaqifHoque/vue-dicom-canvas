import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    defaultDrawingShapes,
    drawingShapeDefinitions,
    isDicomDrawingShape,
    normaliseDrawingShapes
} from '../src/drawing-shapes'

describe('drawing shape configuration', () => {
    it('exposes every DWV draw factory supported by the viewer', () => {
        assert.deepEqual(defaultDrawingShapes, [
            'Ruler', 'Rectangle', 'Ellipse', 'Circle', 'Arrow', 'Protractor', 'ROI'
        ])
        assert.equal(isDicomDrawingShape('ROI'), true)
        assert.equal(isDicomDrawingShape('Freehand'), false)
    })

    it('describes multi-step interactions accurately', () => {
        assert.deepEqual(
            drawingShapeDefinitions.filter(shape => shape.interaction !== 'drag'),
            [
                { name: 'Protractor', label: 'Angle', interaction: 'three-point' },
                { name: 'ROI', label: 'Polygon / freehand ROI', interaction: 'multi-point' }
            ]
        )
    })

    it('validates and de-duplicates configured shapes', () => {
        assert.deepEqual(normaliseDrawingShapes(['ROI', 'Ruler', 'ROI']), ['ROI', 'Ruler'])
        assert.throws(() => normaliseDrawingShapes(['Freehand']), /Unsupported drawing shape/)
    })
})
