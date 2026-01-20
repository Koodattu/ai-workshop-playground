"use client";

import { useState, useEffect } from "react";

const VISITOR_ID_KEY = "ai-workshop-visitor-id";

export function useVisitorId(): string | null {
  const [visitorId, setVisitorId] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage for existing visitorId
    let id = localStorage.getItem(VISITOR_ID_KEY);

    if (!id) {
      // Generate new UUID if not found
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }

    setVisitorId(id);
  }, []);

  return visitorId;
}
