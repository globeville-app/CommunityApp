/** Comparing app versions like "1.2.0", for the "Please update" check. */

/** True when `version` is older than `minimum`. An empty minimum means every version is fine. */
export function isOlderThan(version: string, minimum: string): boolean {
  if (!minimum) return false;
  const parts = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const a = parts(version);
  const b = parts(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
