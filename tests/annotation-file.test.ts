import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    createAnnotationFile,
    decodeAnnotationSnapshot,
    readAnnotationFile,
    restoreAnnotationFile
} from '../src/annotation-file'
import { defaultAnnotationSnapshotLimits, type DicomAnnotations } from '../src/annotation-utils'

describe('annotation JSON files', () => {
    const snapshot: DicomAnnotations = { version: 1, groups: [{
        dicom: {}, appearance: [{ uid: 'mark-1', colour: '#abcdef', text: '測定', label: [1, 2] }]
    }] }

    it('round trips Unicode appearance data through a JSON blob', async () => {
        const file = createAnnotationFile(snapshot)
        assert.equal(file.type, 'application/json;charset=utf-8')
        const restored = await readAnnotationFile(file)
        assert.deepEqual(restored, snapshot)
        assert.notEqual(restored, snapshot)
    })

    it('accepts UTF-8 BOMs and rejects malformed or unsupported snapshots', () => {
        assert.deepEqual(decodeAnnotationSnapshot('\uFEFF{"version":1,"groups":[]}'), { version: 1, groups: [] })
        assert.throws(() => decodeAnnotationSnapshot('{invalid'), /valid JSON/)
        assert.throws(() => decodeAnnotationSnapshot('{"version":2,"groups":[]}'), /Unsupported/)
        assert.throws(() => decodeAnnotationSnapshot('{"version":1,"groups":[{}]}'), /Invalid annotation group/)
    })

    it('rejects oversized files before reading them', async () => {
        let read = false
        const file = {
            size: defaultAnnotationSnapshotLimits.maxSnapshotBytes + 1,
            text: async () => { read = true; return '{}' }
        } as Blob
        await assert.rejects(readAnnotationFile(file), /too large/)
        assert.equal(read, false)
    })

    it('measures raw JSON limits in UTF-8 bytes', () => {
        const text = '測'.repeat(Math.ceil(defaultAnnotationSnapshotLimits.maxSnapshotBytes / 3))
        assert.throws(() => decodeAnnotationSnapshot(text), /too large/)
    })

    it('does not apply an import after viewer state changes during a read', async () => {
        let finish: ((text: string) => void) | undefined
        let current = true
        let applied = false
        const file = { size: 40, text: () => new Promise<string>(resolve => { finish = resolve }) } as Blob
        const pending = restoreAnnotationFile(file, () => current, () => { applied = true })
        current = false
        finish?.('{"version":1,"groups":[]}')
        assert.equal(await pending, false)
        assert.equal(applied, false)
    })

    it('applies validated files once and preserves restore errors', async () => {
        let applied = 0
        assert.equal(await restoreAnnotationFile(createAnnotationFile(snapshot), () => true, value => {
            assert.deepEqual(value, snapshot)
            applied += 1
        }), true)
        assert.equal(applied, 1)
        await assert.rejects(restoreAnnotationFile(createAnnotationFile(snapshot), () => true, () => {
            throw new Error('Annotations belong to a different study')
        }), /different study/)
    })
})
