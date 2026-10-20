import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = process.cwd()
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const temporary = await mkdtemp(join(tmpdir(), 'dicom-package-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const cache = join(temporary, 'npm-cache')
const run = (command, args, cwd = temporary) => execFileSync(command, args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']
})

try {
    // The caller runs the release checks first; avoid recursively running prepack here.
    const [packed] = JSON.parse(run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary, '--cache', cache], root))
    const paths = new Set(packed.files.map(file => file.path))
    const workers = ['jpeg2000', 'jpegbaseline', 'jpegloss', 'labeling', 'resampling', 'rle']
    for (const path of [
        'package.json', 'README.md', 'CHANGELOG.md', 'SECURITY.md', 'MIGRATION.md', 'RELEASE.md', 'LICENSE',
        'dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/DicomViewer.vue.d.ts', 'dist/style.css',
        'workers/LICENSE.txt', 'workers/NOTICE.md', 'workers/SHA256SUMS',
        ...workers.map(worker => `workers/${worker}.worker.min.js`)
    ]) assert.ok(paths.has(path), `Tarball is missing ${path}`)
    for (const path of paths) {
        assert.ok(!/(^|\/)(\.git|\.env[^/]*|node_modules|test-results|playwright-report|src|tests|examples|example-dist|demo-dist|docs-site)(\/|$)/.test(path), `Unexpected tarball file: ${path}`)
        assert.ok(!path.endsWith('.tsbuildinfo') && !path.endsWith('.log'), `Unexpected build artifact: ${path}`)
        assert.ok(!/\.(dcm|dicom|zip)$/i.test(path), `Demo data or archive in tarball: ${path}`)
    }
    assert.equal([...paths].filter(path => /\.worker\.min\.js$/.test(path)).length, 6)

    const dependencies = { [manifest.name]: resolve(temporary, packed.filename) }
    for (const name of ['vue', 'dwv', 'typescript', 'vite']) {
        const installed = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8'))
        dependencies[name] = installed.version
    }
    await writeFile(join(temporary, 'package.json'), JSON.stringify({
        name: 'dicom-fresh-consumer', private: true, type: 'module', dependencies
    }))
    run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', cache])

    await writeFile(join(temporary, 'smoke.mjs'), `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { DicomViewer, dicomWorkerFiles, decodeAnnotationSnapshot } from '${manifest.name}'
const require = createRequire(import.meta.url)
assert.ok(require('${manifest.name}').DicomViewer)
assert.equal(typeof document, 'undefined')
assert.deepEqual(decodeAnnotationSnapshot('{"version":1,"groups":[]}'), {version: 1, groups: []})
assert.ok(require.resolve('${manifest.name}/style.css'))
for (const worker of dicomWorkerFiles) assert.ok(require.resolve('${manifest.name}/workers/' + worker))
assert.match(await renderToString(createSSRApp({render: () => h(DicomViewer)})), /DICOM image viewer/)
`)
    run(process.execPath, ['smoke.mjs'])
    await writeFile(join(temporary, 'main.ts'), `
import { createApp, h } from 'vue'
import { DicomViewer, type DicomViewerProps, type DicomAnnotations, type DicomLoadResult } from '${manifest.name}'
import '${manifest.name}/style.css'
const annotations: DicomAnnotations = {version: 1, groups: []}
const props: DicomViewerProps = {source: null, annotations, readOnly: true, showAnnotationFileControls: true, workerBasePath: '/workers/'}
const result: DicomLoadResult = {status: 'empty'}
console.log(result.status)
createApp({render: () => h(DicomViewer, props)}).mount('#app')
`)
    await writeFile(join(temporary, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'Bundler', strict: true, skipLibCheck: false, noEmit: true, lib: ['ES2020', 'DOM', 'DOM.Iterable'] },
        include: ['main.ts']
    }))
    await writeFile(join(temporary, 'index.html'), '<div id="app"></div><script type="module" src="/main.ts"></script>')
    run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'])
    run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'])
    console.log(`Verified ${packed.files.length} tarball files, fresh consumer installation, ESM/CJS imports, SSR, public types, CSS/worker exports, and Vite build.`)
} finally {
    await rm(temporary, { recursive: true, force: true })
}
