import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isKeyboardInputTarget, resolveViewerKeyboardAction } from '../src/keyboard'

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
})
