"use client";

import { useState } from "react";

const VISITOR_ID_KEY = "ai-workshop-visitor-id";

function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function useVisitorId(): string | null {
  const [visitorId] = useState(getOrCreateVisitorId);

  return visitorId;
}
