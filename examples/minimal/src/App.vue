<script setup>
import { ref } from 'vue'
import { DicomViewer } from '@saqif/vue-dicom-canvas'
import '@saqif/vue-dicom-canvas/style.css'

const source = ref('/sample.dcm')
const error = ref('')
function openFiles(event) {
  const files = Array.from(event.target.files ?? [])
  if (files.length) source.value = files
}
</script>

<template>
  <main>
    <h1>DICOM component inside a div</h1>
    <p>A plain Vue page importing the published npm package. The image is synthetic.</p>
    <label>Choose your DICOM files <input type="file" multiple accept=".dcm,application/dicom" @change="openFiles"></label>
    <div id="component-container" style="width: 100%; max-width: 900px; border: 2px solid #475569; margin-top: 16px;">
      <DicomViewer :source="source" height="560px" worker-base-path="./assets/workers/" @error="error = $event.message" />
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </main>
</template>

<style>
body { margin: 24px; font-family: system-ui, sans-serif; color: #111827; background: white; }
main { max-width: 1000px; }
h1 { font-size: 24px; }
</style>
