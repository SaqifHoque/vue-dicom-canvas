export type DicomSource = File | string | readonly File[] | readonly string[] | null

export type DicomViewerStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DicomViewerProps {
    annotations?: import('./annotation-utils').DicomAnnotations | null
    showControls?: boolean
    settingsOpen?: boolean
    /** DWV tools configured at mount; keep this object stable. */
    tools?: Record<string, import('dwv').ToolConfig>
    /** Built-in DWV annotation shapes shown in the tool selector; read at mount. */
    drawingShapes?: readonly import('./drawing-shapes').DicomDrawingShape[]
    source?: DicomSource
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
}
