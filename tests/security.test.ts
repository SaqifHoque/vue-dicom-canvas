import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DicomParser, logger } from 'dwv'

logger.level = logger.levels.ERROR

describe('untrusted DICOM parsing', () => {
    it('rejects truncated and zero-filled inputs', () => {
        for (const byteLength of [0, 1, 4, 128, 132, 1024]) {
            assert.throws(() => new DicomParser().parse(new ArrayBuffer(byteLength)))
        }
    })

    it('rejects malformed preamble input', () => {
        const bytes = new Uint8Array(256)
        bytes.set([0x44, 0x49, 0x43, 0x4d], 128)
        bytes.set([0xff, 0xff, 0xff, 0xff], 132)
        assert.throws(() => new DicomParser().parse(bytes.buffer))
    })
})
