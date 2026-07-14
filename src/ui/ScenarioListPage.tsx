import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useScenarioStore } from '../store/scenarioStore.ts'
import { SECTOR_IDS, SECTOR_LABELS } from '../store/scenarioTypes.ts'
import type { SectorId } from '../store/scenarioTypes.ts'
import { MAX_COMPARE_SCENARIOS } from './compare/compareEngine.ts'
import { downloadJsonFile } from './downloadJsonFile.ts'

/**
 * シナリオCRUD + JSONインポート/エクスポートの仮画面。
 * 出典: docs/requirements-rev4.md §4.1.1
 */
export function ScenarioListPage() {
  const { scenarios, isLoaded, loadAll, create, duplicate, rename, remove, exportToJson, importFromJson } =
    useScenarioStore()
  const [newSector, setNewSector] = useState<SectorId>('saas_jp')
  const [importError, setImportError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (!isLoaded) void loadAll()
  }, [isLoaded, loadAll])

  const handleImport = async (file: File) => {
    setImportError(null)
    try {
      const text = await file.text()
      await importFromJson(text)
    } catch (e) {
      setImportError(`インポートに失敗しました: ${(e as Error).message}`)
    }
  }

  const handleExport = async (id: string, name: string) => {
    const json = await exportToJson(id)
    downloadJsonFile(`${name}.json`, json)
  }

  const handleRename = async (id: string, currentName: string) => {
    const name = window.prompt('新しい名前', currentName)
    if (name) await rename(id, name)
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_COMPARE_SCENARIOS
          ? prev
          : [...prev, id],
    )
  }

  return (
    <section>
      <h1>シナリオ一覧</h1>

      <div>
        <select value={newSector} onChange={(e) => setNewSector(e.target.value as SectorId)}>
          {SECTOR_IDS.map((id) => (
            <option key={id} value={id}>
              {SECTOR_LABELS[id]}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => create(newSector)}>
          新規作成
        </button>
        <label>
          JSONインポート
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {importError && <p role="alert">{importError}</p>}

      {!isLoaded ? (
        <p>読み込み中...</p>
      ) : scenarios.length === 0 ? (
        <p>シナリオがまだありません。</p>
      ) : (
        <>
          <div>
            <Link
              to={selectedIds.length > 0 ? `/compare?ids=${selectedIds.join(',')}` : '#'}
              aria-disabled={selectedIds.length === 0}
              onClick={(e) => {
                if (selectedIds.length === 0) e.preventDefault()
              }}
            >
              選択したシナリオを比較({selectedIds.length}件)
            </Link>
            {selectedIds.length >= MAX_COMPARE_SCENARIOS && <span> (上限{MAX_COMPARE_SCENARIOS}件)</span>}
          </div>
          <table>
            <thead>
              <tr>
                <th>比較</th>
                <th>名前</th>
                <th>セクター</th>
                <th>更新日時</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      disabled={!selectedIds.includes(s.id) && selectedIds.length >= MAX_COMPARE_SCENARIOS}
                      onChange={() => toggleSelected(s.id)}
                      aria-label={`${s.name}を比較対象に選択`}
                    />
                  </td>
                  <td>
                    <Link to={`/scenarios/${s.id}`}>{s.name}</Link>
                  </td>
                  <td>{SECTOR_LABELS[s.sector]}</td>
                  <td>{new Date(s.updatedAt).toLocaleString('ja-JP')}</td>
                  <td>
                    <button type="button" onClick={() => duplicate(s.id)}>
                      複製
                    </button>
                    <button type="button" onClick={() => handleRename(s.id, s.name)}>
                      名前変更
                    </button>
                    <button type="button" onClick={() => remove(s.id)}>
                      削除
                    </button>
                    <button type="button" onClick={() => handleExport(s.id, s.name)}>
                      エクスポート
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
