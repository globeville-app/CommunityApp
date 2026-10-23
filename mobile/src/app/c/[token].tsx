/**
 * A collect link opened in the app (globeville.app/c/{token}): the badge a
 * guest earned at an event. The token is saved and claimed as soon as
 * they're signed in with a finished profile (AppWatchers), so joining first
 * is fine.
 */
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { savePendingClaim } from "../../claims";
import { Loading } from "../../ui";

export default function CollectLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    savePendingClaim(token)
      .catch(() => undefined)
      .finally(() => setSaved(true));
  }, [token]);

  if (!saved) return <Loading />;
  // The start screen sends them on (joining, or the events tab), and
  // AppWatchers claims it once they get there.
  return <Redirect href="/" />;
}
