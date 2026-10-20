import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cpSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = dirname(fileURLToPath(import.meta.url))
mkdirSync(resolve(root, 'public/assets'), { recursive: true })
cpSync(resolve(root, 'node_modules/@saqif/vue-dicom-canvas/workers'), resolve(root, 'public/assets/workers'), { recursive: true })
export default defineConfig({ plugins: [vue()], base: './' })
