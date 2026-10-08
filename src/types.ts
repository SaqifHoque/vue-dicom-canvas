export type DicomSource = File | string | readonly File[] | readonly string[] | null

export type DicomViewerStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DicomViewerProps {
    annotations?: import('./annotation-utils').DicomAnnotations | null
    /** Show annotation layers without removing marks from exported snapshots. */
    annotationsVisible?: boolean
    /** Prevent viewer-originated annotation changes while allowing navigation and prop restores. */
    readOnly?: boolean
    showControls?: boolean
    settingsOpen?: boolean
    /** DWV tools configured at mount; keep this object stable. */
    tools?: Record<string, import('dwv').ToolConfig>
    /** Built-in DWV annotation shapes shown in the tool selector; read at mount. */
    drawingShapes?: readonly import('./drawing-shapes').DicomDrawingShape[]
    /** Same-origin directory containing the packaged DWV workers; read at mount. */
    workerBasePath?: string
    /** Headers, cookie credentials, and batching applied to subsequent URL loads. */
    remoteRequestOptions?: import('./remote-request').DicomRemoteRequestOptions
    source?: DicomSource
    /** Stable unique DOM ID; generated with Vue useId when omitted. Read at setup. */
    viewerId?: string
    width?: string | number
    height?: string | number
    background?: string
    autoFit?: boolean
    ariaLabel?: string
    maxSources?: number
    maxFileSizeBytes?: number
    maxTotalFileSizeBytes?: number
    allowInsecureHttp?: boolean
    allowArchives?: boolean
    /** Maximum simultaneous local-file signature reads during archive validation. */
    validationConcurrency?: number
}
