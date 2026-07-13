import { describe, expect, it } from 'vitest'
import { StaticJsonSource } from './StaticJsonSource.ts'

describe('StaticJsonSource', () => {
  it('全6セクターのベンチマークデータを取得できる', async () => {
    const source = new StaticJsonSource()
    const sectors = [
      'saas_jp',
      'drug_discovery',
      'medical_device',
      'media_tech',
      'ec_d2c',
      'climate_tech',
    ] as const
    for (const sector of sectors) {
      const data = await source.fetchSector(sector)
      expect(data).not.toBeNull()
      expect(data?.sector).toBe(sector)
      expect(data?.data_status).toBe('dummy')
      expect(data?.benchmarks.length).toBeGreaterThan(0)
    }
  })

  it('存在しないセクターは null を返す', async () => {
    const source = new StaticJsonSource()
    // @ts-expect-error 意図的に不正なセクターIDを渡す
    const data = await source.fetchSector('unknown_sector')
    expect(data).toBeNull()
  })
})
