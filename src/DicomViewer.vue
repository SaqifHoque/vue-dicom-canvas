<template>
    <div
        class="dicom-viewer"
        :class="`dicom-viewer--${status}`"
        :style="viewerStyle"
        :aria-busy="status === 'loading'"
        :aria-label="ariaLabel"
        role="region"
    >
        <div :id="containerId" ref="container" class="dicom-viewer__canvas" />

        <div v-if="status === 'loading'" class="dicom-viewer__overlay">
            <slot name="loading">Loading DICOM image…</slot>
        </div>

        <div v-else-if="status === 'error'" class="dicom-viewer__overlay dicom-viewer__error" role="alert">
            <slot name="error" :error="error" :retry="retry">
                <div class="dicom-viewer__error-content">
                    <span>{{ error?.message }}</span>
                    <button v-if="canRetry" type="button" @click="retry">Retry</button>
                </div>
            </slot>
        </div>

        <div v-else-if="!hasSource" class="dicom-viewer__overlay">
            <slot name="empty">No DICOM image selected.</slot>
        </div>
        <template v-if="showControls && status === 'ready'">
            <button class="dicom-viewer__toggle" :aria-label="panelOpen ? 'Hide settings' : 'Show settings'" :title="panelOpen ? 'Hide settings' : 'Show settings'" :aria-expanded="panelOpen" :aria-controls="`${containerId}-settings`" @click="toggleSettings">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
                    <path d="m9.5 3-.5 2a8 8 0 0 0-1.7 1L5.3 5.5 3 9.5 4.5 11a8 8 0 0 0 0 2L3 14.5l2.3 4 2-.5A8 8 0 0 0 9 19l.5 2h5l.5-2a8 8 0 0 0 1.7-1l2 .5 2.3-4-1.5-1.5a8 8 0 0 0 0-2L21 9.5l-2.3-4-2 .5A8 8 0 0 0 15 5l-.5-2Z" />
                </svg>
            </button>
            <div v-show="panelOpen" :id="`${containerId}-settings`" class="dicom-viewer__settings" @pointerdown.stop @wheel.stop>
                <label>Tool <select v-model="selectedTool" @change="applyTool">
                    <option value="Scroll">Scroll slices</option><option value="ZoomAndPan">Zoom / pan</option>
                    <option value="WindowLevel">Window / level</option><option>Ruler</option><option>Rectangle</option><option>Ellipse</option><option>Arrow</option>
                </select></label>
                <label>Color <input v-model="colour" type="color" @input="applyTool" /></label>
                <button :disabled="historyIndex <= historyFloor" @click="undo">Undo</button><button :disabled="historyIndex >= historyCeiling" @click="redo">Redo</button>
                <button @click="app?.fitToContainer()">Fit</button>
                <div class="dicom-viewer__slices">
                    <button :disabled="slice <= 1" aria-label="Previous slice" @click="setSlice(slice - 1)">‹</button>
                    <label :for="`${containerId}-slice`">Slice {{ slice }} / {{ sliceCount }}</label>
                    <input :id="`${containerId}-slice`" type="range" min="1" :max="sliceCount" :value="slice" :disabled="sliceCount < 2" @input="setSlice(Number(($event.target as HTMLInputElement).value))" />
                    <button :disabled="slice >= sliceCount" aria-label="Next slice" @click="setSlice(slice + 1)">›</button>
                </div>
            </div>
        </template>
    </div>
</template>

<script lang="ts">
let nextViewerId = 0
</script>

<script setup lang="ts">
import type { App } from 'dwv'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { exportGroups, importGroups, type DicomAnnotations } from './annotation-utils'
import type { DwvModule } from './dwv-loader'
import { loadDwv } from './dwv-loader'
import { isZipFile } from './file-utils'
import { LoadSessionController, type DicomLoadResult, type DicomLoadSession } from './load-session'
import { normaliseDicomSource } from './source-utils'
import type { DicomSource, DicomViewerProps, DicomViewerStatus } from './types'

const props = withDefaults(
    defineProps<DicomViewerProps>(),
    {
        source: null,
        annotations: null,
        showControls: true,
        settingsOpen: true,
        viewerId: '',
        width: '100%',
        height: '400px',
        background: '#000',
        autoFit: true,
        ariaLabel: 'DICOM image viewer',
        maxSources: 2000,
        maxFileSizeBytes: 512 * 1024 * 1024,
        maxTotalFileSizeBytes: 2 * 1024 * 1024 * 1024,
        allowInsecureHttp: false,
        allowArchives: false
    }
)

const emit = defineEmits<{
    'update:annotations': [annotations: DicomAnnotations]
    'annotations-change': [annotations: DicomAnnotations]
    'annotation-error': [error: Error]
    'update:settingsOpen': [open: boolean]
    'load-start': [event: unknown]
    'load-progress': [event: unknown]
    'load-abort': [reason: 'reset' | 'dwv', event?: unknown]
    'load-timeout': [error: Error, event?: unknown]
    loaded: [event: unknown]
    error: [error: Error, event?: unknown]
}>()

const containerId = props.viewerId || `dicom-viewer-${++nextViewerId}`
const container = ref<HTMLElement | null>(null)
const status = ref<DicomViewerStatus>('idle')
const error = ref<Error | null>(null)
const hasSource = ref(false)
const canRetry = ref(false)
const viewerStyle = computed(() => ({
    width: typeof props.width === 'number' ? `${props.width}px` : props.width,
    height: typeof props.height === 'number' ? `${props.height}px` : props.height,
    background: props.background
}))

let dwv: DwvModule | null = null
const panelOpen = ref(props.settingsOpen)
const selectedTool = ref('Scroll')
const colour = ref('#ffff80')
const slice = ref(1)
const sliceCount = ref(1)
const historyIndex = ref(0)
const historyFloor = ref(0)
const historyCeiling = ref(0)
function syncHistory() {
    historyIndex.value = app?.getCurrentStackIndex() ?? 0
    historyCeiling.value = app?.getStackSize() ?? 0
}
function undo() {
    if (historyIndex.value > historyFloor.value) { app?.undo(); historyIndex.value = app?.getCurrentStackIndex() ?? 0 }
}
function redo() {
    if (historyIndex.value < historyCeiling.value) { app?.redo(); historyIndex.value = app?.getCurrentStackIndex() ?? 0 }
}
let restoring = false
let lastEmitted = ''
let app: App | null = null
const annotationEvents = ['annotationadd', 'annotationupdate', 'annotationremove']

function toggleSettings() {
    panelOpen.value = !panelOpen.value
    emit('update:settingsOpen', panelOpen.value)
}
function viewController() {
    return app?.getActiveLayerGroup()?.getBaseViewLayer()?.getViewController()
}
function syncSlice() {
    const view = viewController()
    if (!view) return
    const size = view.getImageSize()
    const dim = size.length() > 3 && size.get(3) > 1 ? 3 : view.getScrollDimIndex()
    sliceCount.value = size.get(dim)
    slice.value = (view.getCurrentIndex().get(dim) ?? 0) + 1
}
function setSlice(value: number) {
    const view = viewController()
    if (!view || !dwv || !Number.isInteger(value) || value < 1 || value > sliceCount.value) return
    const size = view.getImageSize()
    const dim = size.length() > 3 && size.get(3) > 1 ? 3 : view.getScrollDimIndex()
    const values = view.getCurrentIndex().getValues().slice()
    values[dim] = value - 1
    view.setCurrentIndex(new dwv.Index(values))
    syncSlice()
}
function applyTool() {
    if (!app || status.value !== 'ready') return
    const drawing = ['Ruler', 'Rectangle', 'Ellipse', 'Arrow'].includes(selectedTool.value)
    app.setTool(drawing ? 'Draw' : selectedTool.value)
    if (drawing) app.setToolFeatures({ shapeName: selectedTool.value, shapeColour: colour.value })
}
function getAnnotations(): DicomAnnotations {
    if (!app || !dwv) return { version: 1, groups: [] }
    return exportGroups(app.getDataIds().flatMap(id => {
        const group = app?.getData(id)?.annotationGroup
        return group ? [group] : []
    }), dwv)
}
function annotationsChanged() {
    if (restoring) return
    try {
        const snapshot = getAnnotations()
        lastEmitted = JSON.stringify(snapshot)
        emit('update:annotations', snapshot)
        emit('annotations-change', snapshot)
    } catch (error) { emit('annotation-error', toError(error)) }
}
function setAnnotations(snapshot: DicomAnnotations | null): void {
    if (!app || !dwv || status.value !== 'ready') throw new Error('Load a DICOM image before setting annotations.')
    const groups = importGroups(snapshot ?? { version: 1, groups: [] }, dwv)
    const layer = app.getActiveLayerGroup()?.getBaseViewLayer()
    const view = layer?.getViewController()
    if (!layer || !view) throw new Error('No image is available for annotations.')
    for (const group of groups) for (const mark of group.getList()) {
        if (!view.includesImageUid(mark.referencedSopInstanceUID)) throw new Error('Annotations belong to a different DICOM image or series.')
        mark.setViewController(view)
    }
    restoring = true
    try {
        for (const id of app.getDataIds()) {
            const group = app.getData(id)?.annotationGroup
            if (group) for (const mark of [...group.getList()]) group.remove(mark.trackingUid)
        }
        const target = app.getDataIds().map(id => app?.getData(id)?.annotationGroup).find(Boolean)
        if (target) {
            for (const group of groups) for (const mark of group.getList()) target.add(mark)
        } else if (groups.length) {
            const data = app.createAnnotationData(layer.getDataId())
            for (const group of groups) for (const mark of group.getList()) data.annotationGroup?.add(mark)
            app.addAndRenderAnnotationData(data, containerId, layer.getDataId())
        }
        historyIndex.value = app.getCurrentStackIndex()
        historyFloor.value = historyIndex.value
        historyCeiling.value = historyIndex.value
        applyTool()
    } finally { restoring = false }
}
function restoreProvidedAnnotations() {
    try { setAnnotations(props.annotations) }
    catch (error) { emit('annotation-error', toError(error)) }
}

let resizeObserver: ResizeObserver | null = null
let isMounted = false
const loadSessions = new LoadSessionController()
let lastSource: DicomSource = null

const toError = (value: unknown): Error => {
    if (value instanceof Error) return value
    if (typeof value === 'object' && value !== null && 'error' in value) {
        const nestedError = (value as { error: unknown }).error
        if (nestedError instanceof Error) return nestedError
        if (typeof nestedError === 'string') return new Error(nestedError)
        if (typeof nestedError === 'object' && nestedError !== null && 'message' in nestedError) {
            return new Error(String((nestedError as { message: unknown }).message))
        }
    }
    if (typeof value === 'object' && value !== null && 'message' in value) return new Error(String((value as { message: unknown }).message))
    return new Error(typeof value === 'string' ? value : 'Unable to load the DICOM image.')
}

const onLoadStart = (event: unknown) => {
    if (!loadSessions.owns(event)) return
    status.value = 'loading'
    error.value = null
    emit('load-start', event)
}

const onLoadProgress = (event: unknown) => {
    if (loadSessions.owns(event)) emit('load-progress', event)
}

const onLoadEnd = (event: unknown) => {
    if (!loadSessions.owns(event)) return
    status.value = 'ready'
    if (props.autoFit) app?.fitToContainer()
    syncSlice()
    setSlice(1)
    applyTool()
    restoreProvidedAnnotations()
    emit('loaded', event)
    loadSessions.settle({ status: 'loaded', event })
}

const onLoadError = (event: unknown) => {
    if (!loadSessions.owns(event)) return
    const loadError = toError(event)
    reportError(loadError, event)
    loadSessions.settle({ status: 'error', error: loadError, event })
}

const reportError = (loadError: Error, event?: unknown) => {
    status.value = 'error'
    error.value = loadError
    canRetry.value = lastSource !== null
    emit('error', loadError, event)
}

const onLoadAbort = (event: unknown) => {
    if (!loadSessions.owns(event)) return
    status.value = 'idle'
    hasSource.value = false
    emit('load-abort', 'dwv', event)
    loadSessions.settle({ status: 'aborted', reason: 'dwv', event })
}

const onLoadTimeout = (event: unknown) => {
    if (!loadSessions.owns(event)) return
    const loadError = new Error('The DICOM load timed out.')
    reportError(loadError, event)
    emit('load-timeout', loadError, event)
    loadSessions.settle({ status: 'timeout', error: loadError, event })
}

const clearViewer = (): void => {
    if (app) {
        app.abortAllLoads()
        app.reset()
    }
    historyIndex.value = 0
    historyFloor.value = 0
    historyCeiling.value = 0
    lastEmitted = ''
    hasSource.value = false
    canRetry.value = false
    slice.value = 1
    sliceCount.value = 1
    status.value = 'idle'
    error.value = null
}

const reset = (): void => {
    if (loadSessions.cancel({ status: 'aborted', reason: 'reset' })) emit('load-abort', 'reset')
    clearViewer()
}

const load = async (source: DicomSource = props.source): Promise<DicomLoadResult> => {
    if (!app) {
        const loadError = new Error('The DICOM viewer is not ready yet.')
        return { status: 'error', error: loadError }
    }

    loadSessions.cancel({ status: 'superseded' })
    clearViewer()
    if (!source) return { status: 'empty' }
    lastSource = source
    const session: DicomLoadSession = loadSessions.begin()

    await nextTick()

    try {
        const normalisedSource = normaliseDicomSource(source, {
            maxSources: props.maxSources,
            maxFileSizeBytes: props.maxFileSizeBytes,
            maxTotalFileSizeBytes: props.maxTotalFileSizeBytes,
            allowInsecureHttp: props.allowInsecureHttp
        })
        if (!normalisedSource) {
            loadSessions.cancel({ status: 'superseded' })
            return { status: 'empty' }
        }

        if (normalisedSource.kind === 'files' && !props.allowArchives) {
            const archiveResults = await Promise.all(normalisedSource.values.map(isZipFile))
            if (archiveResults.some(Boolean)) throw new TypeError('Archive input is disabled. Pass allow-archives only for trusted ZIP files.')
        }

        if (!isMounted || !loadSessions.isActive(session) || !app) return session.result

        hasSource.value = true
        const dataId = normalisedSource.kind === 'files'
            ? app.loadFiles(normalisedSource.values)
            : app.loadURLs(normalisedSource.values)
        if (dataId === '-1') throw new Error('DWV could not start the DICOM load.')
        loadSessions.bind(session, dataId)
    } catch (value) {
        if (isMounted && loadSessions.isActive(session)) onLoadError(value)
    }
    return session.result
}

const retry = (): Promise<DicomLoadResult> => load(lastSource)

const initialise = async (): Promise<void> => {
    dwv = await loadDwv()
    const { App, AppOptions, ViewConfig, ToolConfig } = dwv
    if (!isMounted) return

    app = new App()
    const options = new AppOptions({ '*': [new ViewConfig(containerId)] })
    options.tools = { Scroll: new ToolConfig(), ZoomAndPan: new ToolConfig(), WindowLevel: new ToolConfig(), Draw: new ToolConfig(['Ruler', 'Rectangle', 'Ellipse', 'Arrow']), ...props.tools }
    app.init(options)
    app.addEventListener('loadstart', onLoadStart)
    app.addEventListener('loadprogress', onLoadProgress)
    app.addEventListener('load', onLoadEnd)
    app.addEventListener('positionchange', syncSlice)
    app.addEventListener('undoadd', syncHistory)
    for (const event of annotationEvents) app.addEventListener(event, annotationsChanged)
    app.addEventListener('error', onLoadError)
    app.addEventListener('abort', onLoadAbort)
    app.addEventListener('timeout', onLoadTimeout)

    if (typeof ResizeObserver !== 'undefined' && container.value) {
        resizeObserver = new ResizeObserver(() => {
            if (status.value === 'ready' && props.autoFit) app?.fitToContainer()
        })
        resizeObserver.observe(container.value)
    }
}

onMounted(async () => {
    isMounted = true
    try {
        await initialise()
        if (isMounted) await load()
    } catch (value) {
        reportError(toError(value), value)
    }
})

watch(
    () => props.source,
    (source) => {
        void load(source)
    },
    { deep: false }
)

watch(() => props.settingsOpen, value => { panelOpen.value = value })
watch(() => props.annotations, value => {
    if (status.value === 'ready' && JSON.stringify(value) !== lastEmitted) restoreProvidedAnnotations()
}, { deep: true })

onBeforeUnmount(() => {
    isMounted = false
    loadSessions.cancel({ status: 'aborted', reason: 'unmount' })
    resizeObserver?.disconnect()
    if (app) {
        app.removeEventListener('loadstart', onLoadStart)
        app.removeEventListener('loadprogress', onLoadProgress)
        app.removeEventListener('load', onLoadEnd)
        app.removeEventListener('positionchange', syncSlice)
        app.removeEventListener('undoadd', syncHistory)
        for (const event of annotationEvents) app.removeEventListener(event, annotationsChanged)
        app.removeEventListener('error', onLoadError)
        app.removeEventListener('abort', onLoadAbort)
        app.removeEventListener('timeout', onLoadTimeout)
        app.abortAllLoads()
        app.reset()
    }
    app = null
})

defineExpose({
    load,
    retry,
    reset,
    fitToContainer: () => app?.fitToContainer(),
    getApp: () => app,
    getStatus: () => status.value,
    getAnnotations,
    setAnnotations,
    setSlice
})
</script>

<style scoped>
.dicom-viewer {
    position: relative;
    display: block;
    min-width: 0;
    overflow: hidden;
}

.dicom-viewer__canvas {
    width: 100%;
    height: 100%;
}

.dicom-viewer__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    color: #fff;
    background: rgb(0 0 0 / 55%);
    text-align: center;
}

.dicom-viewer__error {
    color: #fecaca;
}

.dicom-viewer__error-content { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.dicom-viewer__error-content button { border: 1px solid currentColor; border-radius: 5px; padding: 6px 12px; background: #450a0a; color: inherit; cursor: pointer; }
.dicom-viewer__toggle { position: absolute; top: 10px; right: 10px; z-index: 5; display: grid; place-items: center; width: 40px; height: 40px; }
.dicom-viewer__toggle[aria-expanded=true] { color: #67e8f9; border-color: #67e8f9; }
.dicom-viewer__settings { position: absolute; bottom: 12px; left: 12px; right: 12px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px; border-radius: 8px; background: rgb(15 23 42 / 88%); color: white; font: 13px system-ui, sans-serif; max-height: 60%; overflow: auto; }
.dicom-viewer__settings label { display: flex; align-items: center; gap: 6px; }
.dicom-viewer__settings button, .dicom-viewer__toggle, .dicom-viewer__settings select { border: 1px solid #64748b; border-radius: 5px; padding: 6px 9px; background: #1e293b; color: white; cursor: pointer; font: inherit; }
.dicom-viewer__settings button:disabled { opacity: .4; cursor: default; }
.dicom-viewer__settings input[type=color] { width: 36px; height: 28px; padding: 0; border: 0; }
.dicom-viewer__slices { display: flex; width: 100%; align-items: center; gap: 8px; }
.dicom-viewer__slices input { flex: 1; min-width: 40px; }
.dicom-viewer__settings :focus-visible, .dicom-viewer__toggle:focus-visible { outline: 2px solid #67e8f9; outline-offset: 2px; }
</style>
