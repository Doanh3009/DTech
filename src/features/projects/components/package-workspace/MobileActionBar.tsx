import type { ReactNode } from "react";

import styles from "./PackageWorkspace.module.css";

export function MobileActionBar({ children }: { children: ReactNode }) {
  return <div className={styles.mobileActionBar}>{children}</div>;
}

