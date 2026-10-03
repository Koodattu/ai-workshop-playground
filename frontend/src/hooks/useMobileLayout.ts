import { useSyncExternalStore } from "react";

// Match Tailwind's md breakpoint. Hidden editors and previews must not take over
// the refs used by the visible workspace for streaming and preview controls.
const MOBILE_QUERY = "(width < 48rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useMobileLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
}
