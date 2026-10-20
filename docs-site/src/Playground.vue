<script setup>
import { ref, computed } from 'vue'
import { DicomViewer } from '@saqif/vue-dicom-canvas'
import '@saqif/vue-dicom-canvas/style.css'
const sample = Array.from({ length: 12 }, (_, i) => `${import.meta.env.BASE_URL}series/slice-${String(i + 1).padStart(2, '0')}.dcm`)
const source = ref(sample)
const viewer = ref(null)
const annotations = ref(null)
const readOnly = ref(false)
const saved = ref(null)
const message = ref('Loading synthetic series…')
const error = ref('')
const count = computed(() => annotations.value?.groups?.length ?? 0)
function openFiles(event) {
  const files = Array.from(event.target.files ?? [])
  if (files.length) { annotations.value = null; source.value = files; error.value = ''; message.value = 'Loading local files…' }
  event.target.value = ''
}
function loadSample() { source.value = [...sample]; annotations.value = null; error.value = ''; message.value = 'Loading synthetic series…' }
function capture() { saved.value = JSON.stringify(viewer.value?.getAnnotations()); message.value = 'Snapshot captured in memory. Draw or clear marks, then restore.' }
function restore() {
  try { viewer.value?.setAnnotations(JSON.parse(saved.value)); message.value = 'Snapshot restored.' }
  catch (e) { error.value = e.message }
}
function clear() {
  try { viewer.value?.setAnnotations(null); annotations.value = null; message.value = 'Annotations cleared.' }
  catch (e) { error.value = e.message }
}
</script>
<template>
  <div class="playground">
    <div class="playground-controls">
      <button @click="loadSample">Load 12-slice sample</button>
      <label>Open local files <input type="file" multiple accept=".dcm,application/dicom" @change="openFiles"></label>
      <label><input type="checkbox" v-model="readOnly"> Read-only</label>
    </div>
    <DicomViewer ref="viewer" :source="source" v-model:annotations="annotations" :read-only="readOnly" height="600px" worker-base-path="./assets/workers/" show-annotation-file-controls @loaded="message = 'Synthetic or local study ready. Choose a drawing tool in settings to annotate.'" @error="error = $event.message" @worker-error="error = $event.message" @annotation-error="error = $event.message" />
    <p class="playground-status" role="status">{{ message }}</p>
    <p v-if="error" class="playground-error" role="alert">{{ error }}</p>
    <div class="playground-controls" style="margin-top:14px;margin-bottom:0">
      <button @click="capture">Capture snapshot</button><button @click="clear" :disabled="readOnly">Clear marks</button><button @click="restore" :disabled="!saved || readOnly">Restore snapshot</button>
    </div>
    <details style="margin-top:15px;font-size:12px;color:var(--muted)"><summary>Inspect annotation JSON · {{ count }} groups</summary><pre class="playground-output">{{ JSON.stringify(annotations, null, 2) }}</pre></details>
    <p class="playground-status">Fictional study · Local files are processed in your browser · Captured snapshots reset on refresh.</p>
  </div>
</template>
