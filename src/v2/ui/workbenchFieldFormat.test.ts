import { describe, expect, it } from 'vitest'
import type { FieldDefinition } from '../domain/types.ts'
import { getSectorDefinition } from '../domain/sectorDefinitions.ts'
import { displayedValue, storedValue } from './workbenchFieldFormat.ts'

// commonCaseFields(InvestmentWorkbenchPage.tsx)相当。Exit時持分残存率は動的セクター
// フィールドではなく共通フィールドとして定義されているため、ここで直接再現する。
const dilutionRetentionField: FieldDefinition = {
  id: 'dilutionRetention',
  label: 'Exit時持分残存率',
  format: 'percent',
  step: 1,
  min: 0.01,
  max: 1,
}

function caseField(sector: Parameters<typeof getSectorDefinition>[0], id: string): FieldDefinition {
  const field = getSectorDefinition(sector).caseFields.find((f) => f.id === id)
  if (!field) throw new Error(`field not found: ${sector}.${id}`)
  return field
}

describe('workbenchFieldFormat: format=percent の代表フィールドが浮動小数点アーティファクトを出さない', () => {
  const cases: { label: string; field: FieldDefinition; ratio: number; expectedDisplay: number }[] = [
    {
      label: 'Exit時持分残存率(共通フィールド)',
      field: dilutionRetentionField,
      ratio: 0.7,
      expectedDisplay: 70,
    },
    {
      label: 'ピーク売上想定の年次変化率(創薬)',
      field: caseField('drug_discovery', 'peakSalesGrowth'),
      ratio: 0.07,
      expectedDisplay: 7,
    },
    {
      label: 'Exit時点の上市成功確率(創薬)',
      field: caseField('drug_discovery', 'posAtExit'),
      ratio: 0.14,
      expectedDisplay: 14,
    },
    {
      label: '売上価値の自社帰属率(創薬)',
      field: caseField('drug_discovery', 'valueCaptureRate'),
      ratio: 0.35,
      expectedDisplay: 35,
    },
  ]

  it.each(cases)('$label: 比率を浮動小数点アーティファクトなしの表示値に変換する', ({ field, ratio, expectedDisplay }) => {
    expect(field.format).toBe('percent')
    const displayed = displayedValue(ratio, field)
    expect(displayed).toBe(expectedDisplay)
    expect(Number.isInteger(displayed)).toBe(true)
  })

  it.each(cases)('$label: 表示値からの復元(storedValue)が入力比率に戻る', ({ field, ratio }) => {
    const displayed = displayedValue(ratio, field)
    const restored = storedValue(String(displayed), field)
    expect(restored).toBeCloseTo(ratio, 9)
  })

  it('0.07 * 100 は素のJSでは 7.000000000000001 になる(修正前の再現ケース)', () => {
    expect(0.07 * 100).not.toBe(7)
  })

  it('undefined の値は空文字を返す', () => {
    expect(displayedValue(undefined, dilutionRetentionField)).toBe('')
  })

  it('percent以外のformatは変換しない', () => {
    const moneyField: FieldDefinition = { id: 'x', label: 'x', format: 'money' }
    expect(displayedValue(0.07, moneyField)).toBe(0.07)
  })
})
