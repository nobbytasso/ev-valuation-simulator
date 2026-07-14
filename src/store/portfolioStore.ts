/**
 * 仮想ポートフォリオ管理のZustandストア(Phase 2骨格)。
 * 出典: docs/requirements-rev4.md §4.1.3
 *
 * ファンド単位集計(IRR/MOIC/時価総額)は資本政策シミュレーターと接続する Phase 5 で実装する。
 * ここでは保有銘柄のCRUDのみ。
 */
import { create } from 'zustand'
import { LocalStorageAdapter } from '../adapters/storage/LocalStorageAdapter.ts'
import type { StorageAdapter } from '../adapters/storage/StorageAdapter.ts'
import { migratePortfolioHolding } from './portfolioMigration.ts'
import { PORTFOLIO_SCHEMA_VERSION } from './scenarioTypes.ts'
import type { PortfolioHolding, SectorId } from './scenarioTypes.ts'

export const PORTFOLIO_STORAGE_KEY = 'ev-valuation-simulator:portfolio:v1'

export interface PortfolioStoreState {
  holdings: PortfolioHolding[]
  isLoaded: boolean
  loadAll: () => Promise<void>
  addHolding: (input: {
    companyName: string
    sector: SectorId
    investmentAmount: number
    round: string
    ownershipPct: number
    scenarioId?: string
    investmentDate?: string | null
  }) => Promise<PortfolioHolding>
  updateHolding: (holding: PortfolioHolding) => Promise<void>
  removeHolding: (id: string) => Promise<void>
}

export function createPortfolioStore(adapter: StorageAdapter<PortfolioHolding>) {
  return create<PortfolioStoreState>((set, get) => ({
    holdings: [],
    isLoaded: false,

    loadAll: async () => {
      const holdings = await adapter.list()
      set({ holdings, isLoaded: true })
    },

    addHolding: async (input) => {
      const now = new Date().toISOString()
      const holding: PortfolioHolding = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        schemaVersion: PORTFOLIO_SCHEMA_VERSION,
        ...input,
        investmentDate: input.investmentDate ?? null,
      }
      await adapter.save(holding)
      set({ holdings: [...get().holdings, holding] })
      return holding
    },

    updateHolding: async (holding) => {
      const updated: PortfolioHolding = { ...holding, updatedAt: new Date().toISOString() }
      await adapter.save(updated)
      set({ holdings: get().holdings.map((h) => (h.id === updated.id ? updated : h)) })
    },

    removeHolding: async (id) => {
      await adapter.delete(id)
      set({ holdings: get().holdings.filter((h) => h.id !== id) })
    },
  }))
}

export const usePortfolioStore = createPortfolioStore(
  new LocalStorageAdapter<PortfolioHolding>(PORTFOLIO_STORAGE_KEY, migratePortfolioHolding),
)
