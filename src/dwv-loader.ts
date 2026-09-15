export type DwvModule = typeof import('dwv')

let modulePromise: Promise<DwvModule> | undefined

/** Load DWV once, on demand, so importing the Vue package stays lightweight and SSR-safe. */
export const loadDwv = (): Promise<DwvModule> => {
    modulePromise ??= import('dwv')
    return modulePromise
}
