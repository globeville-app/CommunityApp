/**
 * BROWSER DEMO ONLY. The real app runs on phones and uses api.ts, which
 * talks to the Django backend. In a web browser, the screens use this file
 * instead, which answers from a pretend backend inside the page
 * (src/demo/fakeBackend.ts). Same functions, same errors, same shapes.
 */
import { AppConfig } from "./apiTypes";
import { APP_NAME } from "./config";
import { INTERESTS } from "./demo/fakeBackend";

export * from "./apiTypes";
export {
  getMyProfile,
  login,
  logout,
  matchAddress,
  saveProfile,
  signup,
  updateLanguage,
  uploadPhoto,
} from "./demo/fakeBackend";

export async function getConfig(): Promise<AppConfig> {
  return { app_name: APP_NAME, interests: INTERESTS, languages: ["en", "es"] };
}
