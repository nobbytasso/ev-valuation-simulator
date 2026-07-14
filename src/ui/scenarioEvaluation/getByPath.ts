/** ドット区切りパス(例: "evArrMultiple.base")でオブジェクトの値を取得する。存在しなければ undefined。 */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}
