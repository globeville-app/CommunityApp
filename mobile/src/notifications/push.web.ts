/**
 * BROWSER DEMO ONLY. Browsers here can't get the phone's push notifications,
 * so the demo pretends the phone said yes and sends nothing.
 */
export type PhonePermission = "granted" | "denied" | "undetermined";

let answer: PhonePermission = "undetermined";

export async function phonePermission(): Promise<PhonePermission> {
  return answer;
}

export async function pushTokenForThisPhone(): Promise<string | null> {
  return null;
}

export async function allowNotifications(_token: string): Promise<PhonePermission> {
  answer = "granted";
  return answer;
}

export async function registerThisPhone(_token: string) {}

export async function openPhoneSettings() {}
