import { describe, expect, it } from 'vitest'
import { createScenario } from '../../store/defaultInputs.ts'
import type { Scenario } from '../../store/scenarioTypes.ts'
import {
  buildCompareColumns,
  buildEvChartData,
  buildSectorBlocks,
  computeExpectedReturns,
  MAX_COMPARE_SCENARIOS,
} from './compareEngine.ts'
import { evaluateScenario } from '../scenarioEvaluation/evaluateScenario.ts'

function withFundInvestment(scenario: Scenario): Scenario {
  return {
    ...scenario,
    capitalPolicy: {
      ...scenario.capitalPolicy,
      rounds: [
        {
          name: 'シリーズA',
          yearIndex: 1,
          preMoneyValuation: 1000,
          amountRaised: 300,
          optionPoolPostPct: 0.1,
          fundInvestment: 300,
        },
      ],
    },
  }
}

describe('buildCompareColumns', () => {
  it('不明idは found:false の列として残る(§2.1)', () => {
    const scenario = createScenario('saas_jp', 'A')
    const columns = buildCompareColumns(['does-not-exist', scenario.id], [scenario])
    expect(columns).toHaveLength(2)
    expect(columns[0]).toEqual({ id: 'does-not-exist', found: false, scenario: null, evaluation: null, expectedReturns: null })
    expect(columns[1].found).toBe(true)
  })

  it('比較件数上限(4件)を超えるidsは先頭4件に切り詰める(P5-6)', () => {
    const scenarios = Array.from({ length: 6 }, (_, i) => createScenario('saas_jp', `S${i}`))
    const columns = buildCompareColumns(
      scenarios.map((s) => s.id),
      scenarios,
    )
    expect(columns).toHaveLength(MAX_COMPARE_SCENARIOS)
    expect(columns.map((c) => c.id)).toEqual(scenarios.slice(0, MAX_COMPARE_SCENARIOS).map((s) => s.id))
  })
})

describe('computeExpectedReturns(期待IRR/MOICのガード)', () => {
  it('Exit株式価値が0以下のとき「—」+理由を返す', () => {
    const scenario = createScenario('saas_jp', 'A')
    scenario.vcMethod.netDebtAtExit = 1e9 // ev.base より十分大きくし equityValue <= 0 にする
    const evaluation = evaluateScenario(scenario)
    const result = computeExpectedReturns(scenario, evaluation)
    expect(result).toEqual({ irr: null, moic: null, unavailableReason: 'Exit株式価値が0以下' })
  })

  it('資本政策の入力エラー時は「—」+理由を返す', () => {
    const scenario = createScenario('saas_jp', 'A')
    scenario.capitalPolicy.rounds = [
      { name: '不正ラウンド', yearIndex: 1, preMoneyValuation: -100, amountRaised: 300, optionPoolPostPct: 0.1, fundInvestment: 0 },
    ]
    const evaluation = evaluateScenario(scenario)
    const result = computeExpectedReturns(scenario, evaluation)
    expect(result).toEqual({ irr: null, moic: null, unavailableReason: '資本政策の入力エラー' })
  })

  it('自ファンドの出資がない(ラウンド未登録)場合は「—」+理由を返す', () => {
    const scenario = createScenario('saas_jp', 'A')
    const evaluation = evaluateScenario(scenario)
    const result = computeExpectedReturns(scenario, evaluation)
    expect(result).toEqual({ irr: null, moic: null, unavailableReason: '自ファンドの出資がありません' })
  })

  it('自ファンド出資がある正常系では数値のIRR/MOICを返す', () => {
    const scenario = withFundInvestment(createScenario('saas_jp', 'A'))
    const evaluation = evaluateScenario(scenario)
    const result = computeExpectedReturns(scenario, evaluation)
    expect(result.unavailableReason).toBeNull()
    expect(result.irr).not.toBeNull()
    expect(result.moic).not.toBeNull()
  })
})

describe('buildEvChartData', () => {
  it('見つからない列・評価不能な列はチャートデータに含めない', () => {
    const scenario = createScenario('saas_jp', 'A')
    const columns = buildCompareColumns(['unknown', scenario.id], [scenario])
    const data = buildEvChartData(columns)
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('A')
  })
})

describe('buildSectorBlocks(セクター混在時のブロック出し分け、§2.2-2)', () => {
  it('同一セクターが1件のみのときはセクター別ブロックを生成しない', () => {
    const saas = createScenario('saas_jp', 'SaaS-A')
    const media = createScenario('media_tech', 'Media-A')
    const columns = buildCompareColumns([saas.id, media.id], [saas, media])
    const blocks = buildSectorBlocks(columns)
    expect(blocks).toHaveLength(0)
  })

  it('同一セクターが2件以上のときのみそのセクターのブロックを生成する', () => {
    const saasA = createScenario('saas_jp', 'SaaS-A')
    const saasB = createScenario('saas_jp', 'SaaS-B')
    const media = createScenario('media_tech', 'Media-A')
    const columns = buildCompareColumns([saasA.id, saasB.id, media.id], [saasA, saasB, media])
    const blocks = buildSectorBlocks(columns)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].sector).toBe('saas_jp')
    expect(blocks[0].columnIds).toEqual([saasA.id, saasB.id])
    // ruleOf40(keyMetrics) + arrGrowth/evArrMultiple.base(SENSITIVITY_DRIVERS)の3行
    expect(blocks[0].rows.map((r) => r.key)).toEqual(['ruleOf40', 'arrGrowth', 'evArrMultiple.base'])
  })

  it('創薬は品目数・合計ピーク売上・割引率(ベース)の3行固定になる(§2.2-2)', () => {
    const drugA = createScenario('drug_discovery', 'Drug-A')
    const drugB = createScenario('drug_discovery', 'Drug-B')
    const columns = buildCompareColumns([drugA.id, drugB.id], [drugA, drugB])
    const blocks = buildSectorBlocks(columns)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].rows.map((r) => r.key)).toEqual(['assetCount', 'totalPeakSales', 'discountRateBase'])
    expect(blocks[0].rows[0].valuesByColumnId[drugA.id]).toBe(1)
  })
})
