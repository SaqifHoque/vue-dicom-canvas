import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    createWindowLevelState,
    resetWindowLevelState,
    selectWindowLevelPreset,
    validateWindowLevel,
    validateWindowLevelPreset
} from '../src/window-level'

describe('window and level state', () => {
    it('creates a detached typed snapshot from image-specific values', () => {
        const presets = ['Lung', 'Bone']
        const state = createWindowLevelState({
            getWindowLevel: () => ({ center: -600, width: 1500 }),
            getCurrentWindowPresetName: () => 'Lung',
            getWindowLevelPresetsNames: () => presets
        })

        presets.push('Changed later')
        assert.deepEqual(state, {
            center: -600,
            width: 1500,
            preset: 'Lung',
            presets: ['Lung', 'Bone']
        })
    })

    it('accepts modality values while rejecting invalid numeric input', () => {
        assert.deepEqual(validateWindowLevel({ center: -1024.5, width: 4096 }), {
            center: -1024.5,
            width: 4096
        })
        assert.throws(() => validateWindowLevel({ center: Number.NaN, width: 100 }), /finite number/)
        assert.throws(() => validateWindowLevel({ center: 40, width: 0 }), /positive finite number/)
        assert.throws(() => validateWindowLevel({ center: 40, width: Number.POSITIVE_INFINITY }), /positive finite number/)
    })

    it('allows only presets exposed by the current image', () => {
        assert.equal(validateWindowLevelPreset('Soft tissue', ['Soft tissue', 'Bone']), 'Soft tissue')
        assert.throws(() => validateWindowLevelPreset('Lung', ['Soft tissue', 'Bone']), /Unknown window\/level preset/)
    })

    it('selects presets and resets to the current image default', () => {
        const values = {
            Lung: { center: -600, width: 1500 },
            Bone: { center: 400, width: 1800 }
        }
        let preset: keyof typeof values = 'Lung'
        const source = {
            getWindowLevel: () => values[preset],
            getCurrentWindowPresetName: () => preset,
            getWindowLevelPresetsNames: () => Object.keys(values),
            setWindowLevelPreset: (name: string) => { preset = name as keyof typeof values },
            resetWindowLevel: () => { preset = 'Lung' }
        }

        assert.deepEqual(selectWindowLevelPreset(source, 'Bone'), {
            center: 400,
            width: 1800,
            preset: 'Bone',
            presets: ['Lung', 'Bone']
        })
        assert.deepEqual(resetWindowLevelState(source), {
            center: -600,
            width: 1500,
            preset: 'Lung',
            presets: ['Lung', 'Bone']
        })
    })
})
