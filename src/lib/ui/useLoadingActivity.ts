"use client";

import { useEffect } from "react";
import { beginLoadingActivity } from "./loadingActivity";

export function useLoadingActivity(active: boolean, kind: "page" | "action" = "action") {
  useEffect(() => {
    if (active) return beginLoadingActivity(kind);
  }, [active, kind]);
}
