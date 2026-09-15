import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const packagedDirectory = resolve(root, 'workers')
const upstreamDirectory = resolve(root, 'node_modules/dwv/dist/assets/workers')
const checksumFile = resolve(packagedDirectory, 'SHA256SUMS')
const workerPattern = /\.worker\.min\.js$/

const sha256 = (content) => createHash('sha256').update(content).digest('hex')
const workerNames = (names) => names.filter((name) => workerPattern.test(name)).sort()

const [packagedNames, upstreamNames, checksumText] = await Promise.all([
    readdir(packagedDirectory).then(workerNames),
    readdir(upstreamDirectory).then(workerNames),
    readFile(checksumFile, 'utf8')
])

if (JSON.stringify(packagedNames) !== JSON.stringify(upstreamNames)) {
    throw new Error('Packaged worker names do not match the installed DWV release.')
}

const recordedChecksums = new Map(
    checksumText
        .trim()
        .split('\n')
        .map((line) => {
            const [hash, filePath] = line.trim().split(/\s+/, 2)
            return [filePath.replace(/^workers\//, ''), hash]
        })
)

for (const name of packagedNames) {
    const [packaged, upstream] = await Promise.all([readFile(resolve(packagedDirectory, name)), readFile(resolve(upstreamDirectory, name))])
    const packagedHash = sha256(packaged)

    if (packagedHash !== sha256(upstream)) throw new Error(`${name} does not match the installed DWV release.`)
    if (packagedHash !== recordedChecksums.get(name)) throw new Error(`${name} does not match workers/SHA256SUMS.`)
}

if (recordedChecksums.size !== packagedNames.length) throw new Error('workers/SHA256SUMS contains missing or unexpected entries.')

console.log(`Verified ${packagedNames.length} DWV workers and their SHA-256 checksums.`)
