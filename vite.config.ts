import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [vue()],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es', 'cjs'],
            fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
            cssFileName: 'style'
        },
        rollupOptions: {
            external: ['vue', 'dwv'],
            output: {
                globals: {
                    vue: 'Vue',
                    dwv: 'dwv'
                }
            }
        }
    }
})
