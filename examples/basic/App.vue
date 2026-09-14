<script setup lang="ts">
import { ref } from 'vue'
import { DicomViewer, type DicomSource, type DicomAnnotations } from '@ys-reading/vue-dicom-canvas'

const sample = Array.from({ length: 12 }, (_, i) => `${import.meta.env.BASE_URL}series/slice-${String(i + 1).padStart(2, '0')}.dcm`)
const source = ref<DicomSource>(sample)
const viewer = ref<InstanceType<typeof DicomViewer> | null>(null)
const annotations = ref<DicomAnnotations | null>(null)
const saved = ref<string>('')
const message = ref('')
function selectFiles(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    if (files.length) { annotations.value = null; source.value = files }
    input.value = ''
}
function showSample() {
    annotations.value = null
    source.value = sample
    void viewer.value?.load(sample)
}
function save() {
    saved.value = JSON.stringify(viewer.value?.getAnnotations())
    message.value = 'Snapshot captured. Clear marks, then restore to test the database round trip.'
}
function clearMarks() {
    viewer.value?.setAnnotations(null)
    annotations.value = null
}
function restore() {
    try {
        const snapshot = JSON.parse(saved.value) as DicomAnnotations
        viewer.value?.setAnnotations(snapshot)
        annotations.value = snapshot
        message.value = 'Saved annotations restored.'
    } catch (error) { message.value = String(error) }
}
</script>

<template>
    <main>
        <h1>DICOM viewer</h1>
        <p>Navigate the 12-slice sample, select a shape and color, and drag to mark. Controls live inside the image.</p>
        <div class="demo-actions">
            <label>Open DICOM files <input type="file" multiple @change="selectFiles" /></label>
            <button @click="showSample">Load sample</button>
        </div>
        <DicomViewer ref="viewer" v-model:annotations="annotations" :source="source" height="min(75vh, 720px)"
            @annotation-error="message = $event.message" />
        <details>
            <summary>Try annotation save and restore</summary>
            <p>These demo buttons simulate your application's database integration. The snapshot is held in memory and is lost on refresh.</p>
            <div class="demo-actions">
                <button @click="save">Capture JSON</button>
                <button @click="clearMarks">Clear marks</button>
                <button :disabled="!saved" @click="restore">Restore saved marks</button>
            </div>
            <textarea v-if="saved" :value="saved" readonly aria-label="Saved annotation JSON" />
        </details>
        <p role="status">{{ message }}</p>
    </main>
</template>
<style>
:root { font-family: system-ui, sans-serif; color: #dce6f4; background: #0b1220; color-scheme: dark; }
body { margin: 0; }
main { max-width: 1100px; margin: auto; padding: 24px; }
p { color: #a7b8cd; line-height: 1.6; }
.demo-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 18px 0; align-items: center; }
.demo-actions button { padding: 8px 12px; cursor: pointer; }
details { margin-top: 20px; }
textarea { width: 100%; height: 120px; box-sizing: border-box; }
</style>
