import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normaliseDicomSource } from '../src/source-utils'

describe('normaliseDicomSource', () => {
    it('normalises one URL and URL arrays', () => {
        assert.deepEqual(normaliseDicomSource('/scan.dcm'), { kind: 'urls', values: ['/scan.dcm'] })
        assert.deepEqual(normaliseDicomSource(['/a.dcm', '/b.dcm']), { kind: 'urls', values: ['/a.dcm', '/b.dcm'] })
    })

    it('treats absent and empty sources as empty', () => {
        assert.equal(normaliseDicomSource(null), null)
        assert.equal(normaliseDicomSource([]), null)
    })

    it('rejects blank URLs', () => {
        assert.throws(() => normaliseDicomSource('  '), /cannot be empty/)
    })

    it('rejects unsafe URL schemes and embedded credentials', () => {
        assert.throws(() => normaliseDicomSource('data:application/dicom;base64,AA=='), /not allowed/)
        assert.throws(() => normaliseDicomSource('https://user:secret@example.test/scan.dcm'), /credentials/)
        assert.throws(() => normaliseDicomSource('http://example.test/scan.dcm'), /not allowed/)
        assert.doesNotThrow(() => normaliseDicomSource('http://localhost/scan.dcm'))
    })

    it('limits the number of source items', () => {
        assert.throws(() => normaliseDicomSource(['/a.dcm', '/b.dcm'], { maxSources: 1 }), /more than 1/)
    })

    it('limits individual and total local file sizes', () => {
        class TestFile {
            name: string
            size: number
            type = 'application/dicom'

            constructor(name: string, size: number) {
                this.name = name
                this.size = size
            }
        }

        const previousFile = globalThis.File
        Object.defineProperty(globalThis, 'File', { configurable: true, value: TestFile })
        try {
            const large = new TestFile('large.dcm', 11) as unknown as File
            const first = new TestFile('first.dcm', 6) as unknown as File
            const second = new TestFile('second.dcm', 6) as unknown as File
            assert.throws(() => normaliseDicomSource(large, { maxFileSizeBytes: 10 }), /size limit/)
            assert.throws(() => normaliseDicomSource([first, second], { maxTotalFileSizeBytes: 10 }), /total size limit/)
        } finally {
            if (previousFile) Object.defineProperty(globalThis, 'File', { configurable: true, value: previousFile })
            else Reflect.deleteProperty(globalThis, 'File')
        }
    })
})
