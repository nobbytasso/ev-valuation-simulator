import { describe, expect, it } from 'vitest'
import {
  CLIMATE_TECH_SENSITIVITY_DRIVERS,
  DRUG_DISCOVERY_SENSITIVITY_DRIVERS,
  EC_D2C_SENSITIVITY_DRIVERS,
  MEDIA_TECH_SENSITIVITY_DRIVERS,
  MEDICAL_DEVICE_SENSITIVITY_DRIVERS,
  SAAS_SENSITIVITY_DRIVERS,
} from '../../engine/index.ts'
import { createScenario } from '../../store/defaultInputs.ts'
import type { Scenario, SectorId } from '../../store/scenarioTypes.ts'
import { drugDiscoveryDriverLabel } from '../sectors/drugDiscovery/drugDiscoveryDriverLabels.ts'
import { buildTornadoRows, SENSITIVITY_REGISTRY } from './sensitivityRegistry.ts'

function scenarioFor<T extends SectorId>(sector: T): Extract<Scenario, { sector: T }> {
  return createScenario(sector, 'test') as Extract<Scenario, { sector: T }>
}

/** レジストリ添字アクセスの相関ユニオン制約(phase4-spec.md §1.3)をテスト側でも1箇所に隔離する。 */
function driverIdsAndLabels(scenario: Scenario): { driverId: string; label: string }[] {
  switch (scenario.sector) {
    case 'saas_jp':
      return SENSITIVITY_REGISTRY.saas_jp
        .listDriverIds(scenario.inputs)
        .map((driverId) => ({ driverId, label: SENSITIVITY_REGISTRY.saas_jp.driverLabel(driverId, scenario.inputs) }))
    case 'drug_discovery':
      return SENSITIVITY_REGISTRY.drug_discovery
        .listDriverIds(scenario.inputs)
        .map((driverId) => ({
          driverId,
          label: SENSITIVITY_REGISTRY.drug_discovery.driverLabel(driverId, scenario.inputs),
        }))
    case 'medical_device':
      return SENSITIVITY_REGISTRY.medical_device
        .listDriverIds(scenario.inputs)
        .map((driverId) => ({
          driverId,
          label: SENSITIVITY_REGISTRY.medical_device.driverLabel(driverId, scenario.inputs),
        }))
    case 'media_tech':
      return SENSITIVITY_REGISTRY.media_tech
        .listDriverIds(scenario.inputs)
        .map((driverId) => ({
          driverId,
          label: SENSITIVITY_REGISTRY.media_tech.driverLabel(driverId, scenario.inputs),
        }))
    case 'ec_d2c':
      return SENSITIVITY_REGISTRY.ec_d2c
        .listDriverIds(scenario.inputs)
        .map((driverId) => ({ driverId, label: SENSITIVITY_REGISTRY.ec_d2c.driverLabel(driverId, scenario.inputs) }))
    case 'climate_tech':
      return SENSITIVITY_REGISTRY.climate_tech
        .listDriverIds(scenario.inputs)
        .map((driverId) => ({
          driverId,
          label: SENSITIVITY_REGISTRY.climate_tech.driverLabel(driverId, scenario.inputs),
        }))
  }
}

/** 未知の driverId に対するラベル。sector 毎に正しく型付けされたエントリを1箇所で呼び分ける。 */
function unknownDriverLabel(scenario: Scenario, driverId: string): string {
  switch (scenario.sector) {
    case 'saas_jp':
      return SENSITIVITY_REGISTRY.saas_jp.driverLabel(driverId, scenario.inputs)
    case 'drug_discovery':
      return SENSITIVITY_REGISTRY.drug_discovery.driverLabel(driverId, scenario.inputs)
    case 'medical_device':
      return SENSITIVITY_REGISTRY.medical_device.driverLabel(driverId, scenario.inputs)
    case 'media_tech':
      return SENSITIVITY_REGISTRY.media_tech.driverLabel(driverId, scenario.inputs)
    case 'ec_d2c':
      return SENSITIVITY_REGISTRY.ec_d2c.driverLabel(driverId, scenario.inputs)
    case 'climate_tech':
      return SENSITIVITY_REGISTRY.climate_tech.driverLabel(driverId, scenario.inputs)
  }
}

describe('sensitivityRegistry: 6セクターの列挙(§1.1)', () => {
  it('静的5セクターは対応する SENSITIVITY_DRIVERS と一致', () => {
    expect(SENSITIVITY_REGISTRY.saas_jp.listDriverIds(scenarioFor('saas_jp').inputs)).toEqual([
      ...SAAS_SENSITIVITY_DRIVERS,
    ])
    expect(SENSITIVITY_REGISTRY.medical_device.listDriverIds(scenarioFor('medical_device').inputs)).toEqual([
      ...MEDICAL_DEVICE_SENSITIVITY_DRIVERS,
    ])
    expect(SENSITIVITY_REGISTRY.media_tech.listDriverIds(scenarioFor('media_tech').inputs)).toEqual([
      ...MEDIA_TECH_SENSITIVITY_DRIVERS,
    ])
    expect(SENSITIVITY_REGISTRY.ec_d2c.listDriverIds(scenarioFor('ec_d2c').inputs)).toEqual([
      ...EC_D2C_SENSITIVITY_DRIVERS,
    ])
    expect(SENSITIVITY_REGISTRY.climate_tech.listDriverIds(scenarioFor('climate_tech').inputs)).toEqual([
      ...CLIMATE_TECH_SENSITIVITY_DRIVERS,
    ])
  })

  it('創薬は DRUG_DISCOVERY_SENSITIVITY_DRIVERS(動的生成関数)そのまま', () => {
    const inputs = scenarioFor('drug_discovery').inputs
    expect(SENSITIVITY_REGISTRY.drug_discovery.listDriverIds(inputs)).toEqual(DRUG_DISCOVERY_SENSITIVITY_DRIVERS(inputs))
  })
})

describe('sensitivityRegistry: 全列挙IDに非フォールバックラベルが付くこと', () => {
  const sectors = ['saas_jp', 'drug_discovery', 'medical_device', 'media_tech', 'ec_d2c', 'climate_tech'] as const

  it.each(sectors)('%s: 列挙された全driverIdがdriverId文字列そのままではないラベルを持つ', (sector) => {
    const scenario = scenarioFor(sector)
    const pairs = driverIdsAndLabels(scenario)
    expect(pairs.length).toBeGreaterThan(0)
    for (const { driverId, label } of pairs) {
      expect(label).not.toBe(driverId)
    }
  })
})

describe('sensitivityRegistry: 創薬の品目名合成(§2.1)', () => {
  it('assets[i].xxx は「{品目名}: {ドライバー名}」の形式で合成される', () => {
    const scenario = scenarioFor('drug_discovery')
    const assetName = scenario.inputs.assets[0].name
    expect(drugDiscoveryDriverLabel('assets[0].peakSales', scenario.inputs)).toBe(`${assetName}: ピーク売上`)
    expect(drugDiscoveryDriverLabel('assets[0].launchYear', scenario.inputs)).toBe(`${assetName}: 上市年`)
    expect(drugDiscoveryDriverLabel('assets[0].phaseSuccessProbs.phase2', scenario.inputs)).toBe(
      `${assetName}: フェーズ2成功確率`,
    )
    expect(drugDiscoveryDriverLabel('discountRate.base', scenario.inputs)).toBe('割引率(ベース)')
  })
})

describe('sensitivityRegistry: 未知IDフォールバック(§2.1)', () => {
  it('全セクター共通で未知の driverId は文字列そのまま返す', () => {
    for (const sector of ['saas_jp', 'medical_device', 'media_tech', 'ec_d2c', 'climate_tech'] as const) {
      const scenario = scenarioFor(sector)
      expect(unknownDriverLabel(scenario, 'unknownDriver')).toBe('unknownDriver')
    }
    const drugScenario = scenarioFor('drug_discovery')
    expect(drugDiscoveryDriverLabel('unknownDriver', drugScenario.inputs)).toBe('unknownDriver')
    expect(drugDiscoveryDriverLabel('assets[99].peakSales', drugScenario.inputs)).toBe('assets[99].peakSales')
  })
})

describe('buildTornadoRows: ドライバー単位δ上書きとisFixedDelta(§1.3)', () => {
  it('deltaByDriverIdで指定したドライバーのみ既定値と異なるdeltaが適用される', () => {
    const scenario = scenarioFor('saas_jp')
    const { rows } = buildTornadoRows(scenario, {
      defaultDelta: 0.2,
      deltaByDriverId: { arrGrowth: 0.05 },
    })
    const arrGrowthRow = rows.find((r) => r.driverId === 'arrGrowth')
    const multipleRow = rows.find((r) => r.driverId === 'evArrMultiple.base')
    expect(arrGrowthRow?.delta).toBe(0.05)
    expect(multipleRow?.delta).toBe(0.2)
    expect(arrGrowthRow?.isFixedDelta).toBe(false)
  })

  it('創薬のdiscountRate.baseはisFixedDelta=trueで、deltaByDriverIdの上書きが無効', () => {
    const scenario = scenarioFor('drug_discovery')
    const withOverride = buildTornadoRows(scenario, {
      defaultDelta: 0.2,
      deltaByDriverId: { 'discountRate.base': 0.5 },
    })
    const row = withOverride.rows.find((r) => r.driverId === 'discountRate.base')
    expect(row?.isFixedDelta).toBe(true)
    expect(row?.delta).toBe(0.02)

    const withoutOverride = buildTornadoRows(scenario, { defaultDelta: 0.2 })
    const rowWithoutOverride = withoutOverride.rows.find((r) => r.driverId === 'discountRate.base')
    // 上書きの有無に関わらず、discountRate.baseに対する実際のEV評価は同一(符号のみ使用のため)
    expect(rowWithoutOverride?.evAtLow).toBeCloseTo(row?.evAtLow as number, 9)
    expect(rowWithoutOverride?.evAtHigh).toBeCloseTo(row?.evAtHigh as number, 9)
  })

  it('baseEvと行数がscenarioのセクターに応じて正しく返る', () => {
    const scenario = scenarioFor('media_tech')
    const { baseEv, rows } = buildTornadoRows(scenario, { defaultDelta: 0.2 })
    expect(rows.length).toBe(MEDIA_TECH_SENSITIVITY_DRIVERS.length)
    expect(Number.isFinite(baseEv)).toBe(true)
  })

  it('span降順にソートされる', () => {
    const scenario = scenarioFor('climate_tech')
    const { rows } = buildTornadoRows(scenario, { defaultDelta: 0.2 })
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].span).toBeGreaterThanOrEqual(rows[i].span)
    }
  })
})
