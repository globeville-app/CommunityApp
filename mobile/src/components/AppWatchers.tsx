/**
 * Things that happen when the app opens or comes back to the foreground:
 *   - unlock moments: unseen celebrations show once, never mid-post
 *   - auto check-in: refresh which event places the phone watches
 *   - push notifications: make sure the server has this phone's token
 *   - a badge collect link opened before joining: claim it now (Milestone 5)
 */
import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { ApiError, claimBadge, getCelebrations } from "../api";
import { useAuth } from "../auth";
import { syncGeofences } from "../checkin/geofencing";
import { savePendingClaim, takePendingClaim } from "../claims";
import { registerThisPhone } from "../notifications/push";

/** Screens an unlock moment may appear over. Never the post/edit flow or joining. */
export function canCelebrateOn(pathname: string) {
  return (
    pathname === "/events" ||
    pathname === "/profile" ||
    pathname === "/impact" ||
    pathname === "/badges" ||
    pathname.startsWith("/event/")
  );
}

export function AppWatchers() {
  const { token } = useAuth();
  const pathname = usePathname();
  // Set on open and on every return to the foreground; cleared once checked.
  const due = useRef(true);
  const checking = useRef(false);
  // Changing a ref doesn't re-render, so a return to the foreground also
  // bumps this, to run the check below right away.
  const [, setWoke] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      due.current = true;
      setWoke((n) => n + 1);
      if (token) syncGeofences(token).catch(() => undefined);
    });
    return () => sub.remove();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    syncGeofences(token).catch(() => undefined);
    registerThisPhone(token).catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!token || !due.current || checking.current || !canCelebrateOn(pathname)) return;
    checking.current = true;
    // A saved collect link first: claiming it adds the new celebrations.
    // Expired or already used: nothing to show, so it's simply dropped.
    takePendingClaim()
      .then((claimToken) =>
        claimToken
          ? claimBadge(token, { token: claimToken }).catch((e: ApiError) => {
              // Offline or a server hiccup: keep it for next time.
              if (["network", "timeout", "server_error"].includes(e.code)) return savePendingClaim(claimToken);
            })
          : undefined,
      )
      .catch(() => undefined)
      .then(() => getCelebrations(token))
      .then(({ celebrations }) => {
        due.current = false;
        if (celebrations.length > 0) router.push("/celebrate");
      })
      .catch(() => undefined)
      .finally(() => {
        checking.current = false;
      });
  });

  return null;
}
