import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getFileExtension, isDicomFile, isZipFile } from '../src/file-utils'

describe('file utilities', () => {
    const file = (name: string, type = '') => ({ name, type }) as File

    it('extracts a case-insensitive final extension', () => {
        assert.equal(getFileExtension('scan.DCM'), 'dcm')
        assert.equal(getFileExtension('scan.part.dcm'), 'dcm')
        assert.equal(getFileExtension('scan'), '')
    })

    it('recognises DICOM extensions and MIME types', () => {
        assert.equal(isDicomFile(file('scan.dcm')), true)
        assert.equal(isDicomFile(file('scan', 'application/dicom')), true)
        assert.equal(isDicomFile(file('scan.jpg', 'image/jpeg')), false)
    })

    it('detects ZIP files by signature even when disguised', async () => {
        const asFile = (bytes: number[]) => {
            const blob = new Blob([new Uint8Array(bytes)], { type: 'application/dicom' })
            Object.defineProperty(blob, 'name', { value: 'scan.dcm' })
            return blob as File
        }
        const zip = asFile([0x50, 0x4b, 0x03, 0x04])
        const dicom = asFile([0, 0, 0, 0])

        assert.equal(await isZipFile(zip), true)
        assert.equal(await isZipFile(dicom), false)
    })
})
