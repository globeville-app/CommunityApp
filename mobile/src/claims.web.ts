/** BROWSER DEMO ONLY: the demo has no guest badges, so a collect link is just remembered for the tab. */
let pending: string | null = null;

export async function savePendingClaim(token: string) {
  pending = token;
}

export async function takePendingClaim(): Promise<string | null> {
  const token = pending;
  pending = null;
  return token;
}
