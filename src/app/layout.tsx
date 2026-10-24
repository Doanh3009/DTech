import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@/styles/inter-vietnamese.css";
import "@/styles/tokens.css";
import "@/app/globals.css";
import "@/app/theme.css";
import "@/app/mobile.css";
import "@/styles/enterprise.css";
import "@/styles/mobile-design.css";
import "@/styles/mobile-shell.css";
import "@/styles/mobile-components.css";
import "@/styles/mobile-workspaces.css";
import "@/styles/mobile-home.css";
import "@/styles/brand-logo.css";
import "@/styles/mobile-polish.css";
import "@/styles/workspace-fit.css";
import "@/styles/interaction-finish.css";
import "@/styles/mobile-launcher.css";
import "@/styles/mobile-motion.css";
import "@/styles/header-toolbar.css";
import "@/styles/ui-dna.css";
import "@/styles/erp-platform.css";
import "@/styles/erp-workspace.css";
import { SystemSettingsProvider } from "@/components/providers/SystemSettingsProvider";
import { GlobalLoadingIndicator } from "@/components/shared/GlobalLoadingIndicator";
import { deriveBrandColorTokens } from "@/config/systemSettings";
import { readPresentationSettings } from "@/services/system-settings/systemSettingsService";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await readPresentationSettings();
  return {
    title: {
      default: settings.branding.systemName,
      template: `%s | ${settings.branding.systemName}`
    },
    description: settings.branding.loginSubtitle,
    icons: settings.branding.faviconUrl
      ? { icon: `${settings.branding.faviconUrl}?v=${settings.branding.assetVersion}` }
      : undefined
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const settings = await readPresentationSettings();
  const tokens = deriveBrandColorTokens(settings.appearance.primaryColor);
  const themeStyle = {
    "--color-primary": tokens.primary,
    "--color-primary-hover": tokens.primaryHover,
    "--color-primary-active": tokens.primaryActive,
    "--color-primary-soft": tokens.primarySubtle,
    "--color-primary-border": tokens.primaryBorder,
    "--color-primary-foreground": tokens.primaryForeground,
    "--color-focus-ring": tokens.focusRing
  } as React.CSSProperties;

  return (
    <html
      data-density={settings.appearance.density}
      data-table-density={settings.appearance.tableDensity}
      lang="vi"
      style={themeStyle}
    >
      <body className="font-inter">
        <SystemSettingsProvider initialSettings={settings}>{children}</SystemSettingsProvider>
        <GlobalLoadingIndicator />
      </body>
    </html>
  );
}
