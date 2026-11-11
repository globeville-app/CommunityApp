/**
 * Sending a photo to the server: profile and organization photos, and
 * problem-report screenshots.
 *
 * Uploads go through expo-file-system's native uploader, not fetch with
 * FormData. In the 1.0.0 TestFlight build, fetch+FormData uploads never left
 * the phone ("Can't reach the server", with nothing in the server log), while
 * every other request worked. The native uploader reads the file itself and
 * sends a standard multipart form.
 *
 * (uploads.web.ts is the browser demo's version.)
 */
import { File, UploadType } from "expo-file-system";

import { ApiError } from "./apiTypes";
import { API_BASE_URL, UPLOAD_TIMEOUT_MS } from "./config";

export type UploadFile = { uri: string; mimeType: string };

export async function uploadForm<T>(
  path: string,
  options: {
    token: string | null;
    fieldName: string;
    file: UploadFile;
    fields?: Record<string, string>;
    idempotencyKey?: string;
  },
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Token ${options.token}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, UPLOAD_TIMEOUT_MS);

  let result: { status: number; body: string };
  try {
    result = await new File(options.file.uri).upload(`${API_BASE_URL}${path}`, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: options.fieldName,
      mimeType: options.file.mimeType,
      parameters: options.fields,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new ApiError("timeout");
    throw new ApiError("network", 0, undefined, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = result.body ? JSON.parse(result.body) : null;
  } catch {
    data = null;
  }
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(data?.code ?? "server_error", result.status, data?.fields);
  }
  return data as T;
}
