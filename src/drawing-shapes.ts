export const drawingShapeDefinitions = Object.freeze([
    { name: 'Ruler', label: 'Ruler', interaction: 'drag', instruction: 'Drag between two points.' },
    { name: 'Rectangle', label: 'Rectangle', interaction: 'drag', instruction: 'Drag between opposite corners.' },
    { name: 'Ellipse', label: 'Ellipse', interaction: 'drag', instruction: 'Drag to set the ellipse bounds.' },
    { name: 'Circle', label: 'Circle', interaction: 'drag', instruction: 'Drag from the centre to the edge.' },
    { name: 'Arrow', label: 'Arrow', interaction: 'drag', instruction: 'Drag from the tail to the point.' },
    { name: 'Protractor', label: 'Angle', interaction: 'three-point', instruction: 'Choose three points to measure an angle.' },
    { name: 'ROI', label: 'Polygon / freehand ROI', interaction: 'multi-point', instruction: 'Add boundary points and double-click to finish.' }
] as const)

export type DicomDrawingShape = typeof drawingShapeDefinitions[number]['name']
export type DicomDrawingInteraction = typeof drawingShapeDefinitions[number]['interaction']

export const defaultDrawingShapes: readonly DicomDrawingShape[] = Object.freeze(
    drawingShapeDefinitions.map(shape => shape.name)
)

const supportedNames = new Set<string>(defaultDrawingShapes)

export const isDicomDrawingShape = (value: string): value is DicomDrawingShape =>
    supportedNames.has(value)

/** Validates and de-duplicates a runtime shape configuration without reordering it. */
export function normaliseDrawingShapes(values: readonly string[]): DicomDrawingShape[] {
    const result: DicomDrawingShape[] = []
    for (const value of values) {
        if (!isDicomDrawingShape(value)) throw new TypeError(`Unsupported drawing shape: ${value}.`)
        if (!result.includes(value)) result.push(value)
    }
    return result
}
