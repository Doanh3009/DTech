import type { NavigationIcon } from "@/config/navigation";

export type ApplicationId =
  | "overview"
  | "human-resources"
  | "attendance"
  | "projects"
  | "warehouse"
  | "import-export"
  | "accounting"
  | "messaging"
  | "operations"
  | "system";

export type ModuleIconTone = "green" | "blue" | "amber" | "purple" | "red" | "slate" | "teal";

export interface ModuleIconDefinition {
  icon: NavigationIcon;
  tone: ModuleIconTone;
  accentColor: string;
  accentSoft: string;
}

/** Single source of truth for module icon and color treatment. */
export const moduleIconRegistry: Record<ApplicationId, ModuleIconDefinition> = {
  overview: { icon: "LayoutDashboard", tone: "teal", accentColor: "var(--accent-cyan)", accentSoft: "var(--pastel-cyan)" },
  "human-resources": { icon: "Users", tone: "green", accentColor: "var(--accent-green)", accentSoft: "var(--pastel-mint)" },
  attendance: { icon: "Clock3", tone: "blue", accentColor: "var(--accent-blue)", accentSoft: "var(--pastel-blue)" },
  projects: { icon: "BriefcaseBusiness", tone: "purple", accentColor: "var(--accent-violet)", accentSoft: "var(--pastel-lavender)" },
  warehouse: { icon: "Boxes", tone: "amber", accentColor: "var(--accent-orange)", accentSoft: "var(--pastel-cream)" },
  "import-export": { icon: "Ship", tone: "teal", accentColor: "var(--accent-cyan)", accentSoft: "var(--pastel-cyan)" },
  accounting: { icon: "WalletCards", tone: "purple", accentColor: "var(--accent-violet)", accentSoft: "var(--pastel-lavender)" },
  messaging: { icon: "MessageCircle", tone: "blue", accentColor: "var(--accent-blue)", accentSoft: "var(--pastel-blue)" },
  operations: { icon: "CheckSquare", tone: "red", accentColor: "var(--accent-red)", accentSoft: "var(--pastel-rose)" },
  system: { icon: "Settings", tone: "slate", accentColor: "var(--text-secondary)", accentSoft: "var(--pastel-neutral)" }
};
