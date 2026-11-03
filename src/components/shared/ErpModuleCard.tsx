"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type {LucideIcon} from "lucide-react";

import { navigationIconMap } from "@/components/layout/icons";
import type { ApplicationDefinition } from "@/config/moduleRegistry";
import styles from "./ErpPlatform.module.css";

/** Canonical module entry, shared by the launcher and Design DNA catalog. */
export function ErpModuleCard({ application }: { application: Pick<ApplicationDefinition,"label"|"defaultRoute"|"accentColor"|"accentSoft"> & {icon:ApplicationDefinition["icon"]|LucideIcon} }) {
  const [intent, setIntent] = useState(false);
  const Icon = typeof application.icon==="string"?navigationIconMap[application.icon]:application.icon;
  return <Link aria-label={application.label} className={styles.moduleCard} href={application.defaultRoute} onFocus={() => setIntent(true)} onMouseEnter={() => setIntent(true)} onTouchStart={() => setIntent(true)} prefetch={intent ? true : false} style={{ "--module-accent": application.accentColor, "--module-surface": application.accentSoft } as CSSProperties}>
    <span className={styles.moduleCardTop}>
      <span className={styles.moduleIcon}><Icon aria-hidden="true" size={27} strokeWidth={1.7} /></span>
    </span>
    <strong>{application.label}</strong>
  </Link>;
}
