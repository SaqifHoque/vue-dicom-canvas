import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as dwv from 'dwv'
import {
    createAnnotationSelection,
    deleteAnnotation,
    editAnnotation
} from '../src/annotation-editing'

const createController = () => {
    const annotation = new dwv.Annotation()
    annotation.colour = '#112233'
    annotation.textExpr = 'Original label'
    const group = new dwv.AnnotationGroup([annotation])
    return { annotation, group, controller: new dwv.DrawController(group) }
}

describe('annotation editing', () => {
    it('creates a stable public selection from a DWV annotation', () => {
        const { annotation } = createController()
        assert.deepEqual(createAnnotationSelection('annotation-data', annotation), {
            uid: annotation.trackingUid,
            dataId: 'annotation-data',
            colour: '#112233',
            label: 'Original label'
        })
    })

    it('applies colour and label changes through one undoable command', () => {
        const { annotation, controller } = createController()
        const commands: dwv.Command[] = []
        const selection = createAnnotationSelection('annotation-data', annotation)
        const updated = editAnnotation(controller, selection, {
            colour: '#abcdef',
            label: 'Updated label'
        }, command => commands.push(command))

        assert.equal(commands.length, 1)
        assert.equal(annotation.colour, '#abcdef')
        assert.equal(annotation.textExpr, 'Updated label')
        assert.equal(updated.colour, '#abcdef')
        assert.equal(updated.label, 'Updated label')

        commands[0]!.undo()
        assert.equal(annotation.colour, '#112233')
        assert.equal(annotation.textExpr, 'Original label')
    })

    it('validates edits before changing the annotation', () => {
        const { annotation, controller } = createController()
        const selection = createAnnotationSelection('annotation-data', annotation)
        const addCommand = () => assert.fail('Invalid edits must not create commands')

        assert.throws(() => editAnnotation(controller, selection, { colour: 'red' }, addCommand), /six-digit hex/)
        assert.throws(() => editAnnotation(controller, selection, { label: 'x'.repeat(4097) }, addCommand), /too long/)
        assert.equal(annotation.colour, '#112233')
        assert.equal(annotation.textExpr, 'Original label')
    })

    it('deletes through an undoable command and rejects stale selections', () => {
        const { annotation, group, controller } = createController()
        const commands: dwv.Command[] = []
        const selection = createAnnotationSelection('annotation-data', annotation)

        deleteAnnotation(controller, selection, command => commands.push(command))
        assert.equal(group.getLength(), 0)
        commands[0]!.undo()
        assert.equal(group.getLength(), 1)

        group.remove(annotation.trackingUid)
        assert.throws(() => deleteAnnotation(controller, selection, () => undefined), /no longer available/)
    })
})
