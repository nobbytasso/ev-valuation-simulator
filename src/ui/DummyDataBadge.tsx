import './DummyDataBadge.css'

/**
 * ダミーデータ常時表示バッジ。出典: docs/requirements-rev4.md 設計原則5・§4.1.2
 * data_status: "dummy" のときは常にこのバッジを表示し、実データと混同させない。
 */
export function DummyDataBadge() {
  return (
    <span className="dummy-data-badge" role="status">
      ダミーデータ
    </span>
  )
}
