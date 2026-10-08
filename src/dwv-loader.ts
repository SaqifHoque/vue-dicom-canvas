export type DwvModule = typeof import('dwv')

/** Share successful imports while allowing a later mount to retry a failed import. */
export function createLazyLoader<T>(importModule: () => Promise<T>): () => Promise<T> {
    let modulePromise: Promise<T> | undefined
    return () => {
        if (!modulePromise) {
            modulePromise = Promise.resolve().then(importModule).catch(error => {
                modulePromise = undefined
                throw error
            })
        }
        return modulePromise
    }
}

/** Load DWV once, on demand, so importing the Vue package stays lightweight and SSR-safe. */
export const loadDwv = createLazyLoader<DwvModule>(() => import('dwv'))
