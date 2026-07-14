/**
 * 算出不能値の表記統一(純粋関数)。出典: docs/phase6-spec.md §7「表記統一」
 * MOIC空セル vs IRR「—(理由)」の非対称(Phase 5査定指摘)を解消し、画面・Excelとも
 * 算出不能は「—(理由)」に統一する。理由なしのときは「—」のみ。
 */
export function formatUnavailable(reason: string | null): string {
  return reason ? `—(${reason})` : '—'
}
