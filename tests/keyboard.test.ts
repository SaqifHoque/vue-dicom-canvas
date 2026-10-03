import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    createViewerKeyboardCommand,
    isKeyboardInputTarget,
    resolveViewerKeyboardAction,
    type DicomViewerKeyboardState
} from '../src/keyboard'

const state: DicomViewerKeyboardState = {
    slice: 3,
    sliceCount: 5,
    frame: 2,
    frameCount: 4,
    zoom: 1
}

describe('viewer keyboard shortcuts', () => {
    it('maps navigation, viewport, and tool keys', () => {
        assert.equal(resolveViewerKeyboardAction({ key: 'ArrowLeft' }), 'previous-slice')
        assert.equal(resolveViewerKeyboardAction({ key: 'PageDown' }), 'next-slice')
        assert.equal(resolveViewerKeyboardAction({ key: 'ArrowUp' }), 'previous-frame')
        assert.equal(resolveViewerKeyboardAction({ key: '+' }), 'zoom-in')
        assert.equal(resolveViewerKeyboardAction({ key: '0' }), 'reset-view')
        assert.equal(resolveViewerKeyboardAction({ key: 'F' }), 'fit-view')
        assert.equal(resolveViewerKeyboardAction({ key: 'z' }), 'zoom-tool')
    })

    it('does not override modified browser or application shortcuts', () => {
        assert.equal(resolveViewerKeyboardAction({ key: 'f', ctrlKey: true }), null)
        assert.equal(resolveViewerKeyboardAction({ key: 'ArrowLeft', altKey: true }), null)
        assert.equal(resolveViewerKeyboardAction({ key: '0', metaKey: true }), null)
    })

    it('does not intercept form controls, links, or editable content', () => {
        for (const tagName of ['input', 'SELECT', 'textarea', 'button', 'a']) {
            assert.equal(isKeyboardInputTarget({ tagName }), true)
            assert.equal(resolveViewerKeyboardAction({ key: 'ArrowRight', target: { tagName } }), null)
        }
        assert.equal(isKeyboardInputTarget({ tagName: 'DIV', isContentEditable: true }), true)
        assert.equal(resolveViewerKeyboardAction({ key: 'ArrowRight', target: { tagName: 'DIV' } }), 'next-slice')
    })

    it('ignores unassigned keys', () => {
        assert.equal(resolveViewerKeyboardAction({ key: 'Delete' }), null)
        assert.equal(resolveViewerKeyboardAction({ key: 'Enter' }), null)
    })

    it('creates bounded navigation commands with useful announcements', () => {
        assert.deepEqual(createViewerKeyboardCommand('next-slice', state), {
            type: 'slice', value: 4, announcement: 'Slice 4 of 5'
        })
        assert.deepEqual(createViewerKeyboardCommand('previous-frame', state), {
            type: 'frame', value: 1, announcement: 'Frame 1 of 4'
        })
        assert.equal(createViewerKeyboardCommand('next-frame', { ...state, frameCount: 1 }), null)
        assert.deepEqual(createViewerKeyboardCommand('next-slice', { ...state, slice: 5 }), {
            type: 'slice', value: 5, announcement: 'Slice 5 of 5'
        })
    })

    it('creates viewport and tool commands', () => {
        assert.deepEqual(createViewerKeyboardCommand('zoom-in', state), {
            type: 'zoom', value: 1.25, announcement: 'Zoom 125 percent'
        })
        assert.deepEqual(createViewerKeyboardCommand('zoom-out', { ...state, zoom: 0.1 }), {
            type: 'zoom', value: 0.1, announcement: 'Zoom 10 percent'
        })
        assert.deepEqual(createViewerKeyboardCommand('zoom-in', { ...state, zoom: 10 }), {
            type: 'zoom', value: 10, announcement: 'Zoom 1000 percent'
        })
        assert.deepEqual(createViewerKeyboardCommand('fit-view', state), {
            type: 'fit-view', announcement: 'Image fit to viewer'
        })
        assert.deepEqual(createViewerKeyboardCommand('window-level-tool', state), {
            type: 'tool', value: 'WindowLevel', announcement: 'Window and level tool selected'
        })
    })
})
