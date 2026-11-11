/** BROWSER DEMO ONLY: the demo backend never uploads; the real app uses uploads.ts. */
import { ApiError } from "./apiTypes";

export type UploadFile = { uri: string; mimeType: string };

export async function uploadForm<T>(_path: string, _options: unknown): Promise<T> {
  throw new ApiError("network", 0, undefined, "The browser demo can't upload files.");
}
