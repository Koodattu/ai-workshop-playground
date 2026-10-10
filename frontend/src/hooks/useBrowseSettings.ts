"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useBrowseSettings() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => api.getBrowseSettings().then((settings) => { if (active) setEnabled(settings.enabled); }).catch(() => { if (active) setEnabled(false); });
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);
  return enabled;
}
