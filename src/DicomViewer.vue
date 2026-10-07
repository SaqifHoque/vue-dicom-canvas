<template>
    <div
        class="dicom-viewer"
        :class="[
            `dicom-viewer--${status}`,
            `dicom-viewer--${viewerLayout}`,
            { 'dicom-viewer--touch-active': touchPointerState.active, 'dicom-viewer--multi-touch': touchPointerState.multiTouch }
        ]"
        :style="viewerStyle"
        :aria-busy="status === 'loading'"
        :aria-label="ariaLabel"
        :aria-describedby="`${containerId}-keyboard-description ${containerId}-touch-description`"
        :tabindex="status === 'ready' ? 0 : -1"
        role="region"
        @keydown="onViewerKeydown"
    >
        <p :id="`${containerId}-keyboard-description`" class="dicom-viewer__sr-only">
            When the viewer is focused, use the arrow keys to navigate. Open settings for all keyboard shortcuts.
        </p>
        <p :id="`${containerId}-touch-description`" class="dicom-viewer__sr-only">{{ touchInteraction.instruction }}</p>
        <p class="dicom-viewer__sr-only" aria-live="polite" aria-atomic="true">{{ keyboardAnnouncement }}</p>
        <div
            :id="containerId"
            ref="container"
            class="dicom-viewer__canvas"
            :data-touch-mode="touchInteraction.mode"
            @pointerdown="trackTouchPointer"
            @pointerup="trackTouchPointer"
            @pointercancel="trackTouchPointer"
            @lostpointercapture="trackTouchPointer"
        />

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
                    <option value="WindowLevel">Window / level</option>
                    <option v-for="shape in enabledDrawingShapeDefinitions" :key="shape.name" :value="shape.name" :disabled="readOnly || !annotationsVisible">{{ shape.label }}</option>
                </select></label>
                <small v-if="activeDrawingShape" class="dicom-viewer__tool-help">{{ activeDrawingShape.instruction }}</small>
                <small class="dicom-viewer__touch-help">{{ touchInteraction.instruction }}</small>
                <label>Color <input v-model="colour" type="color" :disabled="readOnly" @input="applyTool" /></label>
                <label><input v-model="annotationsVisible" type="checkbox" /> Show marks</label>
                <button :disabled="readOnly || !historyState.canUndo" @click="undo">Undo</button><button :disabled="readOnly || !historyState.canRedo" @click="redo">Redo</button>
                <div v-if="viewport" class="dicom-viewer__viewport-controls">
                    <strong>View</strong>
                    <button type="button" :disabled="viewport.zoom <= viewportZoomBounds.min" aria-label="Zoom out" @click="adjustViewportZoom(1 / 1.25)">−</button>
                    <output aria-live="polite">{{ Math.round(viewport.zoom * 100) }}%</output>
                    <button type="button" :disabled="viewport.zoom >= viewportZoomBounds.max" aria-label="Zoom in" @click="adjustViewportZoom(1.25)">+</button>
                    <button type="button" :disabled="viewport.isDefault" @click="resetViewportFromControls">Reset view</button>
                    <button type="button" @click="fitViewportFromControls">Fit</button>
                </div>
                <div v-if="windowLevel" class="dicom-viewer__window-level">
                    <strong>Contrast</strong>
                    <label>Preset
                        <select :value="windowLevel.preset" @change="selectWindowLevelPresetFromControls(($event.target as HTMLSelectElement).value)">
                            <option v-for="preset in windowLevel.presets" :key="preset" :value="preset">{{ preset }}</option>
                        </select>
                    </label>
                    <label>Center
                        <input type="number" step="any" :value="windowLevel.center" @change="setWindowLevelFromControls('center', ($event.target as HTMLInputElement))" />
                    </label>
                    <label>Width
                        <input type="number" min="0.000001" step="any" :value="windowLevel.width" @change="setWindowLevelFromControls('width', ($event.target as HTMLInputElement))" />
                    </label>
                    <button type="button" @click="resetWindowLevelFromControls">Reset</button>
                </div>
                <div v-if="selectedAnnotation && !readOnly && annotationsVisible" class="dicom-viewer__annotation-editor">
                    <strong>Selected mark</strong>
                    <label>Color <input :value="selectedAnnotation.colour" type="color" @change="updateSelectedAnnotation({ colour: ($event.target as HTMLInputElement).value })" /></label>
                    <label>Label <input :value="selectedAnnotation.label" type="text" maxlength="4096" @change="updateSelectedAnnotation({ label: ($event.target as HTMLInputElement).value })" /></label>
                    <button type="button" @click="deleteSelectedAnnotation">Delete mark</button>
                </div>
                <details v-if="annotationSummaries.length" class="dicom-viewer__annotation-list">
                    <summary>Marks ({{ annotationSummaries.length }})</summary>
                    <ol>
                        <li v-for="summary in annotationSummaries" :key="summary.uid">
                            <button
                                type="button"
                                :class="{ 'is-selected': selectedAnnotation?.uid === summary.uid }"
                                :disabled="!annotationsVisible"
                                :aria-pressed="selectedAnnotation?.uid === summary.uid"
                                @click="selectAnnotationFromList(summary.uid)"
                            >
                                <span class="dicom-viewer__annotation-swatch" :style="{ background: summary.colour }" aria-hidden="true" />
                                <span>{{ summary.label || summary.shape }}</span>
                                <small>{{ summary.shape }}<template v-if="summary.frameNumber"> · frame {{ summary.frameNumber }}</template></small>
                            </button>
                            <button v-if="!readOnly" type="button" :disabled="!annotationsVisible" :aria-label="`Delete ${summary.label || summary.shape}`" @click="deleteAnnotationFromList(summary.uid)">Delete</button>
                        </li>
                    </ol>
                </details>
                <details class="dicom-viewer__keyboard-help">
                    <summary>Keyboard shortcuts</summary>
                    <dl>
                        <template v-for="shortcut in viewerKeyboardShortcuts" :key="shortcut.keys">
                            <dt>{{ shortcut.keys }}</dt>
                            <dd>{{ shortcut.action }}</dd>
                        </template>
                    </dl>
                </details>
                <div class="dicom-viewer__navigation">
                    <div class="dicom-viewer__navigation-axis">
                        <button :disabled="navigation.slice <= 1" aria-label="Previous slice" @click="setSlice(navigation.slice - 1)">‹</button>
                        <label :for="`${containerId}-slice-number`">Slice
                            <input :id="`${containerId}-slice-number`" type="number" min="1" :max="navigation.sliceCount" :value="navigation.slice" @change="setSlice(Number(($event.target as HTMLInputElement).value))" />
                            / {{ navigation.sliceCount }}
                        </label>
                        <input :id="`${containerId}-slice`" type="range" min="1" :max="navigation.sliceCount" :value="navigation.slice" :disabled="navigation.sliceCount < 2" aria-label="Slice position" @input="setSlice(Number(($event.target as HTMLInputElement).value))" />
                        <button :disabled="navigation.slice >= navigation.sliceCount" aria-label="Next slice" @click="setSlice(navigation.slice + 1)">›</button>
                    </div>
                    <div v-if="navigation.frameCount > 1" class="dicom-viewer__navigation-axis">
                        <button :disabled="navigation.frame <= 1" aria-label="Previous frame" @click="setFrame(navigation.frame - 1)">‹</button>
                        <label :for="`${containerId}-frame-number`">Frame
                            <input :id="`${containerId}-frame-number`" type="number" min="1" :max="navigation.frameCount" :value="navigation.frame" @change="setFrame(Number(($event.target as HTMLInputElement).value))" />
                            / {{ navigation.frameCount }}
                        </label>
                        <input :id="`${containerId}-frame`" type="range" min="1" :max="navigation.frameCount" :value="navigation.frame" aria-label="Frame position" @input="setFrame(Number(($event.target as HTMLInputElement).value))" />
                        <button :disabled="navigation.frame >= navigation.frameCount" aria-label="Next frame" @click="setFrame(navigation.frame + 1)">›</button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script lang="ts">
let nextViewerId = 0
</script>

<script setup lang="ts">
import type { Annotation, App } from 'dwv'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { defaultValidationConcurrency, someWithConcurrency } from './async-pool'
import {
    exportGroups,
    replaceAnnotationGroups,
    restoreAnnotationSnapshot,
    shouldRestoreAnnotationSnapshot,
    type DicomAnnotations
} from './annotation-utils'
import {
    AnnotationHistoryController,
    type AnnotationChangeDetails,
    type AnnotationChangeReason
} from './annotation-history'
import {
    createAnnotationSelection,
    deleteAnnotation,
    editAnnotation,
    type DicomAnnotationEdit,
    type DicomAnnotationSelection
} from './annotation-editing'
import {
    createAnnotationSummaries,
    indexForAnnotation,
    type DicomAnnotationSummary
} from './annotation-list'
import { applyAnnotationReviewState, assertAnnotationWritable } from './annotation-review'
import type { DwvModule } from './dwv-loader'
import { loadDwv } from './dwv-loader'
import { isZipFile } from './file-utils'
import {
    createViewerKeyboardCommand,
    resolveViewerKeyboardAction,
    viewerKeyboardShortcuts
} from './keyboard'
import {
    defaultDrawingShapes,
    drawingShapeDefinitions,
    isDicomDrawingShape,
    normaliseDrawingShapes
} from './drawing-shapes'
import { LoadSessionController, type DicomLoadResult, type DicomLoadSession } from './load-session'
import {
    createNavigationModel,
    indexForNavigation,
    type DicomNavigationAxis,
    type DicomNavigationState
} from './navigation'
import { normaliseDicomSource } from './source-utils'
import {
    createPerformanceMeasure,
    performanceNow,
    type DicomPerformanceOperation
} from './performance'
import {
    type DicomRemoteRequestOptions,
    RemoteRequestOptionsStore
} from './remote-request'
import { getViewerLayout, type DicomViewerLayout } from './responsive'
import { getTouchInteraction, TouchPointerTracker } from './touch'
import type { DicomSource, DicomViewerProps, DicomViewerStatus } from './types'
import {
    applyViewportPan,
    applyViewportZoom,
    createViewportState,
    viewportZoomBounds,
    type DicomViewportPoint,
    type DicomViewportState
} from './viewport'
import {
    createWindowLevelState,
    resetWindowLevelState,
    selectWindowLevelPreset,
    validateWindowLevel,
    type DicomWindowLevel,
    type DicomWindowLevelState
} from './window-level'
import { DicomWorkerLoadError, installDicomWorkerResolver } from './worker-runtime'

const props = withDefaults(
    defineProps<DicomViewerProps>(),
    {
        source: null,
        annotations: null,
        annotationsVisible: true,
        readOnly: false,
        drawingShapes: () => defaultDrawingShapes,
        workerBasePath: '',
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
        allowArchives: false,
        validationConcurrency: defaultValidationConcurrency
    }
)

const emit = defineEmits<{
    'update:annotations': [annotations: DicomAnnotations]
    'update:annotationsVisible': [visible: boolean]
    'annotations-change': [annotations: DicomAnnotations, details: AnnotationChangeDetails]
    'history-change': [history: AnnotationChangeDetails['history']]
    'annotation-error': [error: Error]
    'annotation-selection-change': [selection: DicomAnnotationSelection | null]
    'annotation-list-change': [annotations: readonly DicomAnnotationSummary[]]
    'navigation-change': [navigation: DicomNavigationState]
    'window-level-change': [windowLevel: DicomWindowLevelState | null]
    'window-level-error': [error: Error]
    'viewport-change': [viewport: DicomViewportState | null]
    'viewport-error': [error: Error]
    'worker-error': [error: DicomWorkerLoadError]
    'performance-measure': [measure: import('./performance').DicomPerformanceMeasure]
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
const annotationsVisible = ref(props.annotationsVisible)
const readOnly = computed(() => props.readOnly)
const selectedTool = ref('Scroll')
const enabledDrawingShapes = normaliseDrawingShapes(props.drawingShapes)
const enabledDrawingShapeDefinitions = drawingShapeDefinitions.filter(shape => enabledDrawingShapes.includes(shape.name))
const activeDrawingShape = computed(() => enabledDrawingShapeDefinitions.find(shape => shape.name === selectedTool.value))
const touchInteraction = computed(() => getTouchInteraction(selectedTool.value, activeDrawingShape.value?.instruction))
const colour = ref('#ffff80')
const navigation = ref<DicomNavigationState>({ slice: 1, sliceCount: 1, frame: 1, frameCount: 1 })
const windowLevel = ref<DicomWindowLevelState | null>(null)
const viewport = ref<DicomViewportState | null>(null)
const keyboardAnnouncement = ref('')
const viewerLayout = ref<DicomViewerLayout>('wide')
const touchPointers = new TouchPointerTracker()
const touchPointerState = ref(touchPointers.getState())
const selectedAnnotation = ref<DicomAnnotationSelection | null>(null)
const annotationSummaries = ref<DicomAnnotationSummary[]>([])
const history = new AnnotationHistoryController()
const historyState = ref(history.getState())
function syncHistory() {
    historyState.value = history.sync(app?.getCurrentStackIndex() ?? 0, app?.getStackSize() ?? 0)
    emit('history-change', historyState.value)
}
let historyAction: Extract<AnnotationChangeReason, 'undo' | 'redo'> | null = null
let annotationAction: Extract<AnnotationChangeReason, 'edit' | 'delete'> | null = null
function undo() {
    if (readOnly.value || !historyState.value.canUndo) return
    historyAction = 'undo'
    try { app?.undo() }
    finally { historyAction = null; syncHistory() }
}
function redo() {
    if (readOnly.value || !historyState.value.canRedo) return
    historyAction = 'redo'
    try { app?.redo() }
    finally { historyAction = null; syncHistory() }
}
let restoring = false
let lastEmitted = ''
let app: App | null = null
const annotationEvents = ['annotationadd', 'annotationupdate', 'annotationremove']

function reportPerformance(operation: DicomPerformanceOperation, itemCount: number, startedAt: number): void {
    emit('performance-measure', createPerformanceMeasure(operation, itemCount, startedAt, performanceNow()))
}

function syncAnnotationSummaries(): void {
    if (!app || !dwv) return
    const startedAt = performanceNow()
    const sources = app.getDataIds().flatMap(dataId => {
        const annotations = app?.getData(dataId)?.annotationGroup?.getList()
        return annotations ? [{ dataId, annotations }] : []
    })
    const next = createAnnotationSummaries(sources, dwv)
    reportPerformance('annotation-summary', next.length, startedAt)
    if (JSON.stringify(next) === JSON.stringify(annotationSummaries.value)) return
    annotationSummaries.value = next
    emit('annotation-list-change', next.map(summary => ({ ...summary })))
}

const getAnnotationSummaries = (): DicomAnnotationSummary[] =>
    annotationSummaries.value.map(summary => ({ ...summary }))

function setSelectedAnnotation(selection: DicomAnnotationSelection | null): void {
    if (
        selection?.uid === selectedAnnotation.value?.uid &&
        selection?.dataId === selectedAnnotation.value?.dataId &&
        selection?.colour === selectedAnnotation.value?.colour &&
        selection?.label === selectedAnnotation.value?.label
    ) return
    if (selection === null && selectedAnnotation.value === null) return
    selectedAnnotation.value = selection
    emit('annotation-selection-change', selection)
}

function selectAnnotation(uid: string): void {
    if (!app || !dwv || status.value !== 'ready') throw new Error('Load a DICOM image before selecting annotations.')
    if (!annotationsVisible.value) throw new Error('Show annotations before selecting a mark.')
    const summary = annotationSummaries.value.find(item => item.uid === uid)
    if (!summary) throw new Error('The annotation is no longer available.')
    const annotation = app.getData(summary.dataId)?.annotationGroup?.getList().find(item => item.trackingUid === uid)
    if (!annotation) throw new Error('The annotation is no longer available.')

    const view = viewController()
    const origin = view?.getOriginForImageUid(summary.imageUid)
    if (!view || !origin) throw new Error('The annotation image is not available in the current view.')
    const model = createNavigationModel(
        view.getImageSize().getValues(),
        view.getCurrentIndex().getValues(),
        view.getScrollDimIndex()
    )
    const target = indexForAnnotation(
        view.getCurrentIndex().getValues(),
        view.getIndexFromPosition(new dwv.Point(origin.getValues())).getValues(),
        model,
        summary.frameNumber
    )
    if (!target || !view.setCurrentIndex(new dwv.Index(target))) {
        throw new Error('The annotation position is outside the current view.')
    }
    syncNavigation()
    setSelectedAnnotation(createAnnotationSelection(summary.dataId, annotation))
}

function deleteAnnotationFromList(uid: string): void {
    try {
        selectAnnotation(uid)
        deleteSelectedAnnotation()
    } catch (error) { emit('annotation-error', toError(error)) }
}

function selectAnnotationFromList(uid: string): void {
    try { selectAnnotation(uid) }
    catch (error) { emit('annotation-error', toError(error)) }
}

function onAnnotationSelect(event: unknown): void {
    if (!app || !annotationsVisible.value || typeof event !== 'object' || event === null) return
    const { annotationid, dataid } = event as { annotationid?: unknown; dataid?: unknown }
    if (typeof annotationid !== 'string' || typeof dataid !== 'string') return
    const mark = app.getData(dataid)?.annotationGroup?.getList().find(item => item.trackingUid === annotationid)
    if (mark) setSelectedAnnotation(createAnnotationSelection(dataid, mark))
}

function selectedDrawController() {
    const selection = selectedAnnotation.value
    if (!app || !selection) return
    return app.getDrawLayersByDataId(selection.dataId)[0]?.getDrawController()
}

function updateSelectedAnnotation(edit: DicomAnnotationEdit): void {
    assertAnnotationWritable(readOnly.value)
    if (!app || !selectedAnnotation.value) return
    const controller = selectedDrawController()
    if (!controller) return
    try {
        annotationAction = 'edit'
        setSelectedAnnotation(editAnnotation(controller, selectedAnnotation.value, edit, app.addToUndoStack))
    } catch (error) { emit('annotation-error', toError(error)) }
    finally { annotationAction = null }
}

function deleteSelectedAnnotation(): void {
    assertAnnotationWritable(readOnly.value)
    if (!app || !selectedAnnotation.value) return
    const controller = selectedDrawController()
    if (!controller) return
    try {
        annotationAction = 'delete'
        deleteAnnotation(controller, selectedAnnotation.value, app.addToUndoStack)
    }
    catch (error) { emit('annotation-error', toError(error)) }
    finally { annotationAction = null }
}

const getSelectedAnnotation = (): DicomAnnotationSelection | null =>
    selectedAnnotation.value ? { ...selectedAnnotation.value } : null

function toggleSettings() {
    panelOpen.value = !panelOpen.value
    emit('update:settingsOpen', panelOpen.value)
}
function viewController() {
    return app?.getActiveLayerGroup()?.getBaseViewLayer()?.getViewController()
}
function syncViewport(): void {
    const group = app?.getActiveLayerGroup()
    const next = group ? createViewportState(group) : null
    if (JSON.stringify(next) === JSON.stringify(viewport.value)) return
    viewport.value = next
    emit('viewport-change', next ? { ...next, pan: { ...next.pan } } : null)
}
const getViewportState = (): DicomViewportState | null => viewport.value
    ? { ...viewport.value, pan: { ...viewport.value.pan } }
    : null
function requireViewportGroup() {
    const group = app?.getActiveLayerGroup()
    if (!group || status.value !== 'ready') throw new Error('Load a DICOM image before changing the viewport.')
    return group
}
function setViewportZoom(value: number): void {
    const group = requireViewportGroup()
    const center = viewController()?.getCurrentPosition().get3D()
    applyViewportZoom(group, value, center)
    syncViewport()
}
function setViewportPan(value: DicomViewportPoint): void {
    const group = requireViewportGroup()
    applyViewportPan(group, value)
    syncViewport()
}
function resetViewport(): void {
    if (!app || status.value !== 'ready') throw new Error('Load a DICOM image before resetting the viewport.')
    app.resetZoomPan()
    syncViewport()
}
function fitToContainer(): void {
    app?.fitToContainer()
    syncViewport()
}
function reportViewportControlError(value: unknown): void {
    emit('viewport-error', toError(value))
    syncViewport()
}
function adjustViewportZoom(factor: number): void {
    if (!viewport.value) return
    const target = Math.min(
        viewportZoomBounds.max,
        Math.max(viewportZoomBounds.min, viewport.value.zoom * factor)
    )
    try { setViewportZoom(target) }
    catch (error) { reportViewportControlError(error) }
}
function resetViewportFromControls(): void {
    try { resetViewport() }
    catch (error) { reportViewportControlError(error) }
}
function fitViewportFromControls(): void {
    try { fitToContainer() }
    catch (error) { reportViewportControlError(error) }
}
function syncWindowLevel(): void {
    const view = viewController()
    const next = view?.canWindowLevel() ? createWindowLevelState(view) : null
    if (JSON.stringify(next) === JSON.stringify(windowLevel.value)) return
    windowLevel.value = next
    emit('window-level-change', next ? { ...next, presets: [...next.presets] } : null)
}
const getWindowLevelState = (): DicomWindowLevelState | null => windowLevel.value
    ? { ...windowLevel.value, presets: [...windowLevel.value.presets] }
    : null
function requireWindowLevelController() {
    const view = viewController()
    if (!view || status.value !== 'ready') throw new Error('Load a DICOM image before adjusting window and level.')
    if (!view.canWindowLevel()) throw new Error('Window and level are unavailable for this image.')
    return view
}
function setWindowLevel(value: DicomWindowLevel): void {
    const view = requireWindowLevelController()
    if (!dwv) throw new Error('The DICOM viewer is not ready yet.')
    const next = validateWindowLevel(value)
    view.setWindowLevel(new dwv.WindowLevel(next.center, next.width))
    syncWindowLevel()
}
function setWindowLevelPreset(name: string): void {
    const view = requireWindowLevelController()
    selectWindowLevelPreset(view, name)
    syncWindowLevel()
}
function resetWindowLevel(): void {
    const view = requireWindowLevelController()
    resetWindowLevelState(view)
    syncWindowLevel()
}
function reportWindowLevelControlError(value: unknown): void {
    emit('window-level-error', toError(value))
    syncWindowLevel()
}
function setWindowLevelFromControls(key: keyof DicomWindowLevel, input: HTMLInputElement): void {
    if (!windowLevel.value) return
    try {
        setWindowLevel({
            center: key === 'center' ? Number(input.value) : windowLevel.value.center,
            width: key === 'width' ? Number(input.value) : windowLevel.value.width
        })
    } catch (error) {
        input.value = String(windowLevel.value[key])
        reportWindowLevelControlError(error)
    }
}
function selectWindowLevelPresetFromControls(name: string): void {
    try { setWindowLevelPreset(name) }
    catch (error) { reportWindowLevelControlError(error) }
}
function resetWindowLevelFromControls(): void {
    try { resetWindowLevel() }
    catch (error) { reportWindowLevelControlError(error) }
}
function syncNavigation() {
    const view = viewController()
    if (!view) return
    const model = createNavigationModel(
        view.getImageSize().getValues(),
        view.getCurrentIndex().getValues(),
        view.getScrollDimIndex()
    )
    const next: DicomNavigationState = {
        slice: model.slice,
        sliceCount: model.sliceCount,
        frame: model.frame,
        frameCount: model.frameCount
    }
    if (Object.keys(next).every(key => next[key as keyof DicomNavigationState] === navigation.value[key as keyof DicomNavigationState])) return
    navigation.value = next
    emit('navigation-change', next)
}
function setNavigation(axis: DicomNavigationAxis, value: number) {
    const view = viewController()
    if (!view || !dwv) return
    const currentIndex = view.getCurrentIndex().getValues()
    const model = createNavigationModel(
        view.getImageSize().getValues(),
        currentIndex,
        view.getScrollDimIndex()
    )
    const nextIndex = indexForNavigation(currentIndex, model, axis, value)
    if (!nextIndex) return
    view.setCurrentIndex(new dwv.Index(nextIndex))
    syncNavigation()
    syncWindowLevel()
}
const setSlice = (value: number): void => setNavigation('slice', value)
const setFrame = (value: number): void => setNavigation('frame', value)
const getNavigationState = (): DicomNavigationState => ({ ...navigation.value })
function applyTool() {
    if (!app || status.value !== 'ready') return
    const drawing = !readOnly.value && annotationsVisible.value && isDicomDrawingShape(selectedTool.value) && enabledDrawingShapes.includes(selectedTool.value)
    if (!drawing && isDicomDrawingShape(selectedTool.value)) selectedTool.value = 'Scroll'
    app.setTool(drawing ? 'Draw' : selectedTool.value)
    if (drawing) app.setToolFeatures({ shapeName: selectedTool.value, shapeColour: colour.value })
}
function trackTouchPointer(event: PointerEvent): void {
    if (event.type === 'pointerdown' && event.pointerType === 'touch') {
        try { (event.currentTarget as Element).setPointerCapture(event.pointerId) }
        catch { /* Pointer capture may be unavailable after an interrupted contact. */ }
    }
    touchPointerState.value = touchPointers.update(event)
}
function announceKeyboardAction(message: string): void {
    keyboardAnnouncement.value = ''
    void nextTick(() => { keyboardAnnouncement.value = message })
}
function onViewerKeydown(event: KeyboardEvent): void {
    if (status.value !== 'ready' || event.target !== event.currentTarget) return
    const action = resolveViewerKeyboardAction(event)
    if (!action || ((action === 'zoom-in' || action === 'zoom-out') && !viewport.value)) return
    const command = createViewerKeyboardCommand(action, {
        ...navigation.value,
        zoom: viewport.value?.zoom ?? 1
    })
    if (!command) return

    event.preventDefault()
    try {
        switch (command.type) {
            case 'slice': setSlice(command.value); break
            case 'frame': setFrame(command.value); break
            case 'zoom': setViewportZoom(command.value); break
            case 'reset-view': resetViewport(); break
            case 'fit-view': fitToContainer(); break
            case 'tool':
                selectedTool.value = command.value
                applyTool()
                break
        }
        announceKeyboardAction(command.announcement)
    } catch (error) {
        reportViewportControlError(error)
    }
}
function getAnnotations(): DicomAnnotations {
    if (!app || !dwv) return { version: 1, groups: [] }
    const groups = app.getDataIds().flatMap(id => {
        const group = app?.getData(id)?.annotationGroup
        return group ? [group] : []
    })
    const startedAt = performanceNow()
    try { return exportGroups(groups, dwv) }
    finally { reportPerformance('annotation-export', groups.length, startedAt) }
}
function emitAnnotationsChange(reason: AnnotationChangeReason, updateModel: boolean): void {
    const snapshot = getAnnotations()
    lastEmitted = JSON.stringify(snapshot)
    if (updateModel) emit('update:annotations', snapshot)
    emit('annotations-change', snapshot, { reason, history: historyState.value })
}
function annotationsChanged(event?: unknown) {
    if (restoring) return
    try {
        if (selectedAnnotation.value && typeof event === 'object' && event !== null) {
            const { type, data } = event as { type?: unknown; data?: Annotation }
            if (data?.trackingUid === selectedAnnotation.value.uid) {
                if (type === 'annotationremove') setSelectedAnnotation(null)
                else if (typeof data.colour === 'string' && typeof data.textExpr === 'string') {
                    setSelectedAnnotation(createAnnotationSelection(selectedAnnotation.value.dataId, data))
                }
            }
        }
        emitAnnotationsChange(historyAction ?? annotationAction ?? 'draw', true)
        syncAnnotationSummaries()
        if (app) applyAnnotationReviewState(app, annotationsVisible.value, readOnly.value)
    }
    catch (error) { emit('annotation-error', toError(error)) }
}
function replaceAnnotations(snapshot: DicomAnnotations | null): void {
    if (!app || !dwv || status.value !== 'ready') throw new Error('Load a DICOM image before setting annotations.')
    const currentApp = app
    const currentDwv = dwv
    const layer = currentApp.getActiveLayerGroup()?.getBaseViewLayer()
    const view = layer?.getViewController()
    if (!layer || !view) throw new Error('No image is available for annotations.')
    const studyInstanceUIDs = new Set<string>()
    let frameCount = 1
    for (const id of currentApp.getDataIds()) {
        const data = currentApp.getData(id)
        if (!data?.image) continue
        const meta = currentDwv.getAsSimpleElements(data.meta) as Record<string, unknown>
        if (typeof meta.StudyInstanceUID === 'string') studyInstanceUIDs.add(meta.StudyInstanceUID)
        const frames = Number(meta.NumberOfFrames ?? 1)
        if (Number.isInteger(frames) && frames > frameCount) frameCount = frames
    }
    const requestedSnapshot = snapshot ?? { version: 1 as const, groups: [] }
    const startedAt = performanceNow()
    try { restoreAnnotationSnapshot(requestedSnapshot, currentDwv, {
        studyInstanceUIDs,
        includesImageUid: uid => view.includesImageUid(uid),
        frameCount
    }, groups => {
        if (selectedAnnotation.value) setSelectedAnnotation(null)
        for (const group of groups) for (const mark of group.getList()) mark.setViewController(view)
        restoring = true
        try {
            let createdData: ReturnType<typeof currentApp.createAnnotationData> | undefined
            const currentGroups = currentApp.getDataIds().flatMap(id => {
                const group = currentApp.getData(id)?.annotationGroup
                return group ? [group] : []
            })
            const replacement = replaceAnnotationGroups(currentGroups, groups, () => {
                createdData = currentApp.createAnnotationData(layer.getDataId())
                if (!createdData.annotationGroup) throw new Error('Unable to create annotation data.')
                return createdData.annotationGroup
            })
            if (replacement.created && createdData) {
                currentApp.addAndRenderAnnotationData(createdData, containerId, layer.getDataId())
            }
            applyAnnotationReviewState(currentApp, annotationsVisible.value, readOnly.value)
            syncAnnotationSummaries()
            historyState.value = history.setBoundary(currentApp.getCurrentStackIndex())
            emit('history-change', historyState.value)
            applyTool()
        } finally { restoring = false }
    }) } finally { reportPerformance('annotation-restore', requestedSnapshot.groups.length, startedAt) }
}
function setAnnotations(snapshot: DicomAnnotations | null): void {
    assertAnnotationWritable(readOnly.value)
    replaceAnnotations(snapshot)
    emitAnnotationsChange(snapshot === null ? 'clear' : 'replace', true)
}
function restoreProvidedAnnotations(announce = false) {
    try {
        replaceAnnotations(props.annotations)
        if (announce) emitAnnotationsChange('prop', false)
    }
    catch (error) { emit('annotation-error', toError(error)) }
}

let resizeObserver: ResizeObserver | null = null
let releaseWorkerResolver: (() => void) | null = null
function syncViewerLayout(): void {
    const width = container.value?.clientWidth
    if (typeof width === 'number' && width >= 0) viewerLayout.value = getViewerLayout(width)
}
let isMounted = false
const loadSessions = new LoadSessionController()
let lastSource: DicomSource = null
const remoteRequestOptionsStore = new RemoteRequestOptionsStore()

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
    syncViewport()
    syncNavigation()
    setSlice(1)
    setFrame(1)
    applyTool()
    restoreProvidedAnnotations()
    if (app) applyAnnotationReviewState(app, annotationsVisible.value, readOnly.value)
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
    historyState.value = history.reset()
    emit('history-change', historyState.value)
    lastEmitted = ''
    if (annotationSummaries.value.length) {
        annotationSummaries.value = []
        emit('annotation-list-change', [])
    }
    hasSource.value = false
    canRetry.value = false
    navigation.value = { slice: 1, sliceCount: 1, frame: 1, frameCount: 1 }
    if (windowLevel.value) {
        windowLevel.value = null
        emit('window-level-change', null)
    }
    if (viewport.value) {
        viewport.value = null
        emit('viewport-change', null)
    }
    if (selectedAnnotation.value) setSelectedAnnotation(null)
    status.value = 'idle'
    error.value = null
}

const reset = (): void => {
    if (loadSessions.cancel({ status: 'aborted', reason: 'reset' })) emit('load-abort', 'reset')
    clearViewer()
    lastSource = null
    remoteRequestOptionsStore.clear()
}

const load = async (
    source: DicomSource = props.source,
    remoteRequestOptions: DicomRemoteRequestOptions | undefined = props.remoteRequestOptions
): Promise<DicomLoadResult> => {
    if (!app) {
        const loadError = new Error('The DICOM viewer is not ready yet.')
        return { status: 'error', error: loadError }
    }

    loadSessions.cancel({ status: 'superseded' })
    clearViewer()
    if (!source) {
        lastSource = null
        remoteRequestOptionsStore.clear()
        return { status: 'empty' }
    }
    lastSource = source
    remoteRequestOptionsStore.clear()
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
        const dwvRequestOptions = normalisedSource.kind === 'urls'
            ? remoteRequestOptionsStore.prepare(remoteRequestOptions)
            : undefined

        if (normalisedSource.kind === 'files' && !props.allowArchives) {
            const startedAt = performanceNow()
            try {
                const containsArchive = await someWithConcurrency(
                    normalisedSource.values,
                    props.validationConcurrency,
                    isZipFile,
                    () => isMounted && loadSessions.isActive(session)
                )
                if (containsArchive) throw new TypeError('Archive input is disabled. Pass allow-archives only for trusted ZIP files.')
            } finally { reportPerformance('source-validation', normalisedSource.values.length, startedAt) }
        }

        if (!isMounted || !loadSessions.isActive(session) || !app) return session.result

        hasSource.value = true
        const dataId = normalisedSource.kind === 'files'
            ? app.loadFiles(normalisedSource.values)
            : app.loadURLs(normalisedSource.values, dwvRequestOptions)
        if (dataId === '-1') throw new Error('DWV could not start the DICOM load.')
        loadSessions.bind(session, dataId)
    } catch (value) {
        if (isMounted && loadSessions.isActive(session)) onLoadError(value)
    }
    return session.result
}

const retry = (): Promise<DicomLoadResult> => load(lastSource, remoteRequestOptionsStore.getRetryOptions())

const initialise = async (): Promise<void> => {
    if (props.workerBasePath) {
        releaseWorkerResolver = installDicomWorkerResolver({
            workerBasePath: props.workerBasePath,
            documentUrl: document.baseURI
        }, workerError => emit('worker-error', workerError))
    }
    dwv = await loadDwv()
    const { App, AppOptions, ViewConfig, ToolConfig } = dwv
    if (!isMounted) return

    app = new App()
    const options = new AppOptions({ '*': [new ViewConfig(containerId)] })
    options.tools = { Scroll: new ToolConfig(), ZoomAndPan: new ToolConfig(), WindowLevel: new ToolConfig(), Draw: new ToolConfig(enabledDrawingShapes), ...props.tools }
    app.init(options)
    app.addEventListener('loadstart', onLoadStart)
    app.addEventListener('loadprogress', onLoadProgress)
    app.addEventListener('load', onLoadEnd)
    app.addEventListener('positionchange', syncNavigation)
    app.addEventListener('wlchange', syncWindowLevel)
    app.addEventListener('zoomchange', syncViewport)
    app.addEventListener('offsetchange', syncViewport)
    app.addEventListener('annotationselect', onAnnotationSelect)
    app.addEventListener('undoadd', syncHistory)
    for (const event of annotationEvents) app.addEventListener(event, annotationsChanged)
    app.addEventListener('error', onLoadError)
    app.addEventListener('abort', onLoadAbort)
    app.addEventListener('timeout', onLoadTimeout)

    if (typeof ResizeObserver !== 'undefined' && container.value) {
        resizeObserver = new ResizeObserver(() => {
            syncViewerLayout()
            if (status.value === 'ready' && props.autoFit) fitToContainer()
        })
        resizeObserver.observe(container.value)
    }
    syncViewerLayout()
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
watch(() => props.annotationsVisible, value => { annotationsVisible.value = value })
watch(annotationsVisible, value => {
    if (!value) setSelectedAnnotation(null)
    if (app) applyAnnotationReviewState(app, value, readOnly.value)
    applyTool()
    if (value !== props.annotationsVisible) emit('update:annotationsVisible', value)
})
watch(readOnly, value => {
    if (app) applyAnnotationReviewState(app, annotationsVisible.value, value)
    applyTool()
})
watch(() => props.annotations, value => {
    if (status.value === 'ready' && shouldRestoreAnnotationSnapshot(value, lastEmitted)) restoreProvidedAnnotations(true)
}, { deep: true })

onBeforeUnmount(() => {
    isMounted = false
    remoteRequestOptionsStore.clear()
    touchPointerState.value = touchPointers.reset()
    loadSessions.cancel({ status: 'aborted', reason: 'unmount' })
    resizeObserver?.disconnect()
    if (app) {
        app.removeEventListener('loadstart', onLoadStart)
        app.removeEventListener('loadprogress', onLoadProgress)
        app.removeEventListener('load', onLoadEnd)
        app.removeEventListener('positionchange', syncNavigation)
        app.removeEventListener('wlchange', syncWindowLevel)
        app.removeEventListener('zoomchange', syncViewport)
        app.removeEventListener('offsetchange', syncViewport)
        app.removeEventListener('annotationselect', onAnnotationSelect)
        app.removeEventListener('undoadd', syncHistory)
        for (const event of annotationEvents) app.removeEventListener(event, annotationsChanged)
        app.removeEventListener('error', onLoadError)
        app.removeEventListener('abort', onLoadAbort)
        app.removeEventListener('timeout', onLoadTimeout)
        app.abortAllLoads()
        app.reset()
    }
    app = null
    releaseWorkerResolver?.()
    releaseWorkerResolver = null
})

defineExpose({
    load,
    retry,
    reset,
    fitToContainer,
    getApp: () => app,
    getStatus: () => status.value,
    getAnnotations,
    setAnnotations,
    getHistoryState: () => history.getState(),
    getSelectedAnnotation,
    getAnnotationSummaries,
    selectAnnotation,
    updateSelectedAnnotation,
    deleteSelectedAnnotation,
    getNavigationState,
    setSlice,
    setFrame,
    getWindowLevelState,
    setWindowLevel,
    setWindowLevelPreset,
    resetWindowLevel,
    getViewportState,
    setViewportZoom,
    setViewportPan,
    resetViewport
})
</script>

<style scoped>
.dicom-viewer {
    position: relative;
    display: block;
    min-width: 0;
    overflow: hidden;
}

.dicom-viewer:focus-visible {
    outline: 2px solid #67e8f9;
    outline-offset: -2px;
}

.dicom-viewer__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

.dicom-viewer__canvas {
    width: 100%;
    height: 100%;
    touch-action: none;
}

.dicom-viewer--touch-active { user-select: none; }
.dicom-viewer--multi-touch .dicom-viewer__toggle { pointer-events: none; }

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
.dicom-viewer__settings { position: absolute; bottom: 12px; left: 12px; right: 12px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px; border-radius: 8px; background: rgb(15 23 42 / 88%); color: white; font: 13px system-ui, sans-serif; max-height: 60%; overflow: auto; overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch; }
.dicom-viewer__settings label { display: flex; align-items: center; gap: 6px; }
.dicom-viewer__settings button, .dicom-viewer__toggle, .dicom-viewer__settings select { border: 1px solid #64748b; border-radius: 5px; padding: 6px 9px; background: #1e293b; color: white; cursor: pointer; font: inherit; }
.dicom-viewer__settings button:disabled { opacity: .4; cursor: default; }
.dicom-viewer__settings input[type=color] { width: 36px; height: 28px; padding: 0; border: 0; }
.dicom-viewer__tool-help { color: #cbd5e1; }
.dicom-viewer__touch-help { width: 100%; color: #cbd5e1; }
.dicom-viewer__viewport-controls { display: flex; align-items: center; gap: 8px; }
.dicom-viewer__viewport-controls output { min-width: 3.5em; text-align: center; font-variant-numeric: tabular-nums; }
.dicom-viewer__window-level { display: flex; width: 100%; align-items: center; gap: 8px; }
.dicom-viewer__window-level input[type=number] { width: 7em; }
.dicom-viewer__annotation-editor { display: flex; width: 100%; align-items: center; gap: 8px; }
.dicom-viewer__annotation-editor label { flex: 0 1 auto; }
.dicom-viewer__annotation-editor input[type=text] { min-width: 12rem; }
.dicom-viewer__annotation-list { width: 100%; }
.dicom-viewer__annotation-list summary { cursor: pointer; font-weight: 600; }
.dicom-viewer__annotation-list ol { display: grid; gap: 6px; max-height: 11rem; margin: 8px 0 0; padding: 0; overflow: auto; list-style: none; }
.dicom-viewer__annotation-list li { display: flex; gap: 6px; }
.dicom-viewer__annotation-list li > button:first-child { display: grid; flex: 1; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; min-width: 0; text-align: left; }
.dicom-viewer__annotation-list li > button.is-selected { color: #67e8f9; border-color: #67e8f9; }
.dicom-viewer__annotation-list li small { color: #cbd5e1; }
.dicom-viewer__annotation-swatch { width: 12px; height: 12px; border: 1px solid rgb(255 255 255 / 60%); border-radius: 50%; }
.dicom-viewer__keyboard-help { width: 100%; }
.dicom-viewer__keyboard-help summary { cursor: pointer; font-weight: 600; }
.dicom-viewer__keyboard-help dl { display: grid; grid-template-columns: minmax(9rem, auto) 1fr; gap: 4px 12px; margin: 8px 0 0; }
.dicom-viewer__keyboard-help dt { font-weight: 600; }
.dicom-viewer__keyboard-help dd { margin: 0; color: #cbd5e1; }
.dicom-viewer__navigation { display: grid; width: 100%; gap: 8px; }
.dicom-viewer__navigation-axis { display: flex; width: 100%; align-items: center; gap: 8px; }
.dicom-viewer__navigation-axis input[type=range] { flex: 1; min-width: 40px; }
.dicom-viewer__navigation-axis input[type=number] { width: 5em; }
.dicom-viewer__settings :focus-visible, .dicom-viewer__toggle:focus-visible { outline: 2px solid #67e8f9; outline-offset: 2px; }

.dicom-viewer--compact .dicom-viewer__settings {
    max-height: 68%;
    align-items: stretch;
}
.dicom-viewer--compact .dicom-viewer__window-level,
.dicom-viewer--compact .dicom-viewer__annotation-editor { flex-wrap: wrap; }

.dicom-viewer--narrow .dicom-viewer__settings {
    inset: auto 6px 6px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    max-height: 72%;
    padding: 8px;
}
.dicom-viewer--narrow .dicom-viewer__settings > label,
.dicom-viewer--narrow .dicom-viewer__tool-help,
.dicom-viewer--narrow .dicom-viewer__viewport-controls,
.dicom-viewer--narrow .dicom-viewer__window-level,
.dicom-viewer--narrow .dicom-viewer__annotation-editor,
.dicom-viewer--narrow .dicom-viewer__annotation-list,
.dicom-viewer--narrow .dicom-viewer__keyboard-help,
.dicom-viewer--narrow .dicom-viewer__navigation { grid-column: 1 / -1; }
.dicom-viewer--narrow .dicom-viewer__viewport-controls,
.dicom-viewer--narrow .dicom-viewer__window-level,
.dicom-viewer--narrow .dicom-viewer__annotation-editor,
.dicom-viewer--narrow .dicom-viewer__navigation-axis { flex-wrap: wrap; }
.dicom-viewer--narrow .dicom-viewer__settings select,
.dicom-viewer--narrow .dicom-viewer__annotation-editor input[type=text] { min-width: 0; max-width: 100%; }
.dicom-viewer--narrow .dicom-viewer__navigation-axis input[type=range] { order: 3; flex-basis: 100%; }

@media (pointer: coarse) {
    .dicom-viewer__toggle,
    .dicom-viewer__settings button,
    .dicom-viewer__settings select,
    .dicom-viewer__settings input[type=number],
    .dicom-viewer__settings input[type=text],
    .dicom-viewer__settings summary { min-height: 44px; }
    .dicom-viewer__settings input[type=range] { min-height: 44px; }
    .dicom-viewer__settings input[type=checkbox] { width: 24px; height: 24px; }
    .dicom-viewer__settings input[type=color] { width: 44px; height: 44px; }
}
</style>
