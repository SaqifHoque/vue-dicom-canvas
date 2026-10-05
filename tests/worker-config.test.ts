import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    dicomWorkerFiles,
    normaliseDicomWorkerBasePath,
    resolveDicomWorkerUrl
} from '../src/worker-config'

describe('DICOM worker configuration', () => {
    it('normalises root and subpath deployments against the document URL', () => {
        assert.equal(
            normaliseDicomWorkerBasePath('/assets/workers', 'https://viewer.example/studies/42'),
            'https://viewer.example/assets/workers/'
        )
        assert.equal(
            normaliseDicomWorkerBasePath('./assets/workers/', 'https://viewer.example/radiology/index.html'),
            'https://viewer.example/radiology/assets/workers/'
        )
    })

    it('requires a trusted same-origin HTTP location', () => {
        assert.throws(() => normaliseDicomWorkerBasePath('', 'https://viewer.example/'), /cannot be empty/)
        assert.throws(() => normaliseDicomWorkerBasePath('data:text/javascript,', 'https://viewer.example/'), /HTTP or HTTPS/)
        assert.throws(() => normaliseDicomWorkerBasePath('https://cdn.example/workers', 'https://viewer.example/'), /application origin/)
        assert.throws(() => normaliseDicomWorkerBasePath('https://user:pass@viewer.example/workers', 'https://viewer.example/'), /credentials/)
    })

    it('remaps only known packaged workers', () => {
        const base = 'https://viewer.example/radiology/assets/workers/'
        for (const fileName of dicomWorkerFiles) {
            assert.equal(
                resolveDicomWorkerUrl(`https://viewer.example/chunks/assets/workers/${fileName}`, base),
                `${base}${fileName}`
            )
        }
        assert.equal(resolveDicomWorkerUrl('https://viewer.example/custom.worker.js', base), null)
        assert.equal(resolveDicomWorkerUrl('not a valid URL', 'not a base'), null)
    })
})
