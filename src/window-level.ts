export interface DicomWindowLevel {
    center: number
    width: number
}

export interface DicomWindowLevelState extends DicomWindowLevel {
    preset: string
    presets: readonly string[]
}

export interface WindowLevelSource {
    getWindowLevel(): DicomWindowLevel
    getCurrentWindowPresetName(): string | undefined
    getWindowLevelPresetsNames(): string[]
}

export function validateWindowLevel(value: DicomWindowLevel): DicomWindowLevel {
    if (!Number.isFinite(value.center)) throw new TypeError('Window center must be a finite number.')
    if (!Number.isFinite(value.width) || value.width <= 0) {
        throw new RangeError('Window width must be a positive finite number.')
    }
    return { center: value.center, width: value.width }
}

export function createWindowLevelState(source: WindowLevelSource): DicomWindowLevelState {
    const value = validateWindowLevel(source.getWindowLevel())
    const presets = source.getWindowLevelPresetsNames()
    return {
        ...value,
        preset: source.getCurrentWindowPresetName() ?? 'manual',
        presets: [...presets]
    }
}

export function validateWindowLevelPreset(name: string, presets: readonly string[]): string {
    if (!presets.includes(name)) throw new RangeError(`Unknown window/level preset: ${name}.`)
    return name
}
