import type { TFunction } from "i18next";

import type { ApiError } from "../apiTypes";
import { APP_NAME } from "../config";

/**
 * The message for an error code, in the current language. The server only
 * sends codes; any code we don't have words for shows the generic message.
 */
export function errorMessage(t: TFunction, error: Pick<ApiError, "code"> | null): string | null {
  if (!error) return null;
  const key = `errors.${error.code}`;
  return t(key, { app: APP_NAME, defaultValue: t("errors.generic") });
}
