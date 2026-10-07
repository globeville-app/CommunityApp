import { Href, router } from "expo-router";

/**
 * Go to a screen and forget the history behind it, so Back can't return to
 * e.g. the Welcome screen after logging in, or the Match screen after joining.
 */
export function resetTo(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
