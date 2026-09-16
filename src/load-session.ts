export type DicomLoadResult =
    | { status: 'loaded'; event: unknown }
    | { status: 'error'; error: Error; event?: unknown }
    | { status: 'aborted'; reason: 'reset' | 'dwv' | 'unmount'; event?: unknown }
    | { status: 'timeout'; error: Error; event?: unknown }
    | { status: 'empty' }
    | { status: 'superseded' }

export interface DicomLoadSession {
    readonly generation: number
    readonly result: Promise<DicomLoadResult>
}

interface ActiveSession extends DicomLoadSession {
    dataId?: string
    settled: boolean
    resolve: (result: DicomLoadResult) => void
}

const getDataId = (event: unknown): string | undefined => {
    if (typeof event !== 'object' || event === null || !('dataid' in event)) return undefined
    const dataId = (event as { dataid?: unknown }).dataid
    return typeof dataId === 'string' ? dataId : undefined
}

/** Associates DWV's global app events with exactly one component load request. */
export class LoadSessionController {
    private generation = 0
    private active: ActiveSession | null = null
    private readonly retiredDataIds = new Set<string>()

    begin(): DicomLoadSession {
        this.settleActive({ status: 'superseded' })

        let resolve!: (result: DicomLoadResult) => void
        const result = new Promise<DicomLoadResult>(done => { resolve = done })
        const active: ActiveSession = { generation: ++this.generation, result, resolve, settled: false }
        this.active = active
        return active
    }

    bind(session: DicomLoadSession, dataId: string): boolean {
        if (!this.isActive(session) || this.retiredDataIds.has(dataId)) return false
        const active = this.active as ActiveSession
        if (active.dataId && active.dataId !== dataId) return false
        active.dataId = dataId
        return true
    }

    owns(event: unknown): boolean {
        if (!this.active || this.active.settled) return false
        const dataId = getDataId(event)
        if (!dataId) return true
        if (this.retiredDataIds.has(dataId)) return false
        if (!this.active.dataId) this.active.dataId = dataId
        return this.active.dataId === dataId
    }

    isActive(session: DicomLoadSession): boolean {
        return this.active?.generation === session.generation && !this.active.settled
    }

    settle(result: DicomLoadResult): boolean {
        if (!this.active || this.active.settled) return false
        this.retire(this.active)
        this.active.settled = true
        this.active.resolve(result)
        this.active = null
        return true
    }

    cancel(result: Extract<DicomLoadResult, { status: 'aborted' | 'superseded' }>): boolean {
        return this.settleActive(result)
    }

    get activeDataId(): string | undefined {
        return this.active?.dataId
    }

    private settleActive(result: DicomLoadResult): boolean {
        if (!this.active || this.active.settled) return false
        this.retire(this.active)
        this.active.settled = true
        this.active.resolve(result)
        this.active = null
        return true
    }

    private retire(session: ActiveSession): void {
        if (!session.dataId) return
        this.retiredDataIds.add(session.dataId)
        // A component has few concurrent loads; cap retained IDs for long-lived viewers.
        if (this.retiredDataIds.size > 100) {
            const oldest = this.retiredDataIds.values().next().value
            if (oldest) this.retiredDataIds.delete(oldest)
        }
    }
}
