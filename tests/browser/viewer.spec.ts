import { expect, test, type Page } from '@playwright/test'

const runtimeErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
    const errors: string[] = []
    runtimeErrors.set(page, errors)
    page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
    expect(runtimeErrors.get(page), 'Unexpected browser runtime errors').toEqual([])
})

async function openViewer(page: Page): Promise<void> {
    await page.goto('/')
    await expect(page.getByRole('region', { name: 'DICOM image viewer' })).toHaveClass(/dicom-viewer--ready/)
    await expect(page.getByRole('spinbutton', { name: /^Slice/ })).toHaveAttribute('max', '12')
}

async function drawRectangle(page: Page): Promise<void> {
    await page.getByRole('combobox', { name: 'Tool', exact: true }).selectOption('Rectangle')
    await page.getByRole('button', { name: 'Hide settings' }).click()
    const canvas = page.locator('.dicom-viewer__canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Viewer canvas is unavailable')
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.7, { steps: 8 })
    await page.mouse.up()
    await page.getByRole('button', { name: 'Show settings' }).click()
    await expect(page.getByText('Marks (1)', { exact: true })).toBeVisible()
}

test('loads the synthetic series and navigates with controls and keyboard', async ({ page }) => {
    await openViewer(page)
    const slice = page.getByRole('spinbutton', { name: /^Slice/ })
    await slice.fill('5')
    await slice.press('Tab')
    await expect(slice).toHaveValue('5')
    const viewer = page.getByRole('region', { name: 'DICOM image viewer' })
    await viewer.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slice).toHaveValue('6')
    await page.getByRole('button', { name: 'Hide settings' }).click()
    await expect(slice).toBeHidden()
    await page.getByRole('button', { name: 'Show settings' }).click()
    await expect(slice).toBeVisible()
})

test('draws, traverses history, and restores a captured snapshot', async ({ page }) => {
    await openViewer(page)
    await drawRectangle(page)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByText('Marks (1)', { exact: true })).toBeHidden()
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect(page.getByText('Marks (1)', { exact: true })).toBeVisible()
    await page.getByText('Try annotation save and restore', { exact: true }).click()
    await page.getByRole('button', { name: 'Capture JSON' }).click()
    const before = JSON.parse(await page.getByLabel('Saved annotation JSON').inputValue())
    expect(before.groups[0].appearance).toHaveLength(1)
    await page.getByRole('button', { name: 'Clear marks', exact: true }).click()
    await expect(page.getByText('Marks (1)', { exact: true })).toBeHidden()
    await page.getByRole('button', { name: 'Restore saved marks' }).click()
    await expect(page.getByText('Marks (1)', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Capture JSON' }).click()
    const after = JSON.parse(await page.getByLabel('Saved annotation JSON').inputValue())
    // DWV regenerates SR ContentDate and ContentTime on each export.
    for (const snapshot of [before, after]) for (const group of snapshot.groups) {
        delete group.dicom['00080023']
        delete group.dicom['00080033']
    }
    expect(after).toEqual(before)
})

test('downloads and imports annotation JSON and preserves marks on malformed input', async ({ page }) => {
    await openViewer(page)
    await drawRectangle(page)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download JSON' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('annotations.json')
    const path = await download.path()
    if (!path) throw new Error('Annotation download was not saved')
    await page.getByText('Try annotation save and restore', { exact: true }).click()
    await page.getByRole('button', { name: 'Clear marks', exact: true }).click()
    await page.getByLabel('Import JSON').setInputFiles(path)
    await expect(page.getByText('Annotations imported.', { exact: true })).toBeVisible()
    await expect(page.getByText('Marks (1)', { exact: true })).toBeVisible()
    await page.getByLabel('Import JSON').setInputFiles({
        name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid')
    })
    await expect(page.locator('.dicom-viewer__annotation-files')).toContainText('must contain valid JSON')
    await expect(page.getByText('Marks (1)', { exact: true })).toBeVisible()
})

test('reviews marks read-only while keeping navigation and download available', async ({ page }) => {
    await openViewer(page)
    await drawRectangle(page)
    await page.getByRole('checkbox', { name: 'Read-only review' }).check()
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await expect(page.getByLabel('Import JSON')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Download JSON' })).toBeEnabled()
    await expect(page.getByRole('combobox', { name: 'Tool', exact: true }).locator('option[value="Rectangle"]')).toHaveAttribute('disabled', '')
    await page.getByRole('button', { name: 'Next slice', exact: true }).click()
    await expect(page.getByRole('spinbutton', { name: /^Slice/ })).toHaveValue('2')
    await expect(page.getByText('Marks (1)', { exact: true })).toBeVisible()
})
