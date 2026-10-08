import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, it } from 'node:test'
import { createRenderer, createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { DicomViewer } from '../dist/index.js'

describe('built package SSR integration', () => {
    it('imports both package formats without browser globals', () => {
        assert.equal(typeof document, 'undefined')
        assert.equal(typeof window, 'undefined')
        assert.ok(DicomViewer)
        assert.ok(createRequire(import.meta.url)('../dist/index.cjs').DicomViewer)
    })

    it('renders stable unique IDs across independent SSR requests', async () => {
        const render = () => renderToString(createSSRApp({
            render: () => h('main', [h(DicomViewer), h(DicomViewer)])
        }))
        const first = await render()
        assert.equal(await render(), first)
        const ids = [...first.matchAll(/ id="([^"]+)"/g)].map(match => match[1])
        assert.ok(ids.length >= 6)
        assert.equal(new Set(ids).size, ids.length)
        for (const match of first.matchAll(/aria-controls="([^"]+)"/g)) {
            assert.ok(ids.includes(match[1]))
        }
    })

    it('supports app prefixes, explicit IDs, and independent accessible labels', async () => {
        const app = createSSRApp({
            render: () => h('main', [
                h(DicomViewer, { viewerId: 'review-left', settingsOpen: false, ariaLabel: 'Left image' }),
                h(DicomViewer, { ariaLabel: 'Right image' })
            ])
        })
        app.config.idPrefix = 'review'
        const html = await renderToString(app)
        assert.match(html, /id="review-left"/)
        assert.match(html, /id="dicom-viewer-review-1"/)
        assert.match(html, /aria-label="Left image"/)
        assert.match(html, /aria-label="Right image"/)
    })
})

// A Vue host renderer exercises mount/unmount without introducing browser globals.
function createHost() {
    const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
    const renderer = createRenderer({
        createElement: type => node(type),
        createText: text => node('text', text),
        createComment: text => node('comment', text),
        setText: (target, text) => { target.text = text },
        setElementText: (target, text) => { target.text = text },
        parentNode: target => target.parent,
        nextSibling: target => {
            const siblings = target.parent?.children ?? []
            return siblings[siblings.indexOf(target) + 1] ?? null
        },
        patchProp: (target, key, previous, value) => { target.props[key] = value },
        insert: (target, parent, anchor = null) => {
            target.parent = parent
            const index = parent.children.indexOf(anchor)
            if (index < 0) parent.children.push(target)
            else parent.children.splice(index, 0, target)
        },
        remove: target => {
            const children = target.parent?.children
            if (children) children.splice(children.indexOf(target), 1)
        }
    })
    return { renderer, root: node('root') }
}

describe('multiple viewer lifecycle', () => {
    it('keeps exposed state independent and ignores initialization after unmount', async () => {
        const { renderer, root } = createHost()
        const viewers = []
        const errors = []
        const app = renderer.createApp({
            render: () => h('main', [0, 1].map(index => h(DicomViewer, {
                ref: value => { viewers[index] = value },
                onError: error => errors.push(error),
                onAnnotationError: error => errors.push(error)
            })))
        })
        app.mount(root)
        const [left, right] = viewers
        assert.notEqual(left, right)
        assert.equal(left.getStatus(), 'idle')
        assert.equal(right.getStatus(), 'idle')
        const snapshot = left.getAnnotations()
        snapshot.groups.push({ dicom: {}, appearance: [] })
        assert.deepEqual(right.getAnnotations(), { version: 1, groups: [] })
        left.reset()
        assert.equal(right.getStatus(), 'idle')
        app.unmount()
        await nextTick()
        await new Promise(resolve => setTimeout(resolve, 30))
        assert.equal(left.getApp(), null)
        assert.equal(right.getApp(), null)
        assert.deepEqual(errors, [])
    })
})
