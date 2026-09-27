export const drawingShapeDefinitions = Object.freeze([
    { name: 'Ruler', label: 'Ruler', interaction: 'drag' },
    { name: 'Rectangle', label: 'Rectangle', interaction: 'drag' },
    { name: 'Ellipse', label: 'Ellipse', interaction: 'drag' },
    { name: 'Circle', label: 'Circle', interaction: 'drag' },
    { name: 'Arrow', label: 'Arrow', interaction: 'drag' },
    { name: 'Protractor', label: 'Angle', interaction: 'three-point' },
    { name: 'ROI', label: 'Polygon / freehand ROI', interaction: 'multi-point' }
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
