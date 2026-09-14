import { resolve } from 'node:path'
import { cpSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const root = resolve(__dirname)
cpSync(resolve(root, '../../workers'), resolve(root, 'public/assets/workers'), { recursive: true })

export default defineConfig({
    root,
    base: './',
    plugins: [vue()],
    build: { outDir: resolve(root, '../../example-dist'), emptyOutDir: true }
})
