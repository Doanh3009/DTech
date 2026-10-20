"use client";

import Link from "next/link";
import Image from "next/image";

import { useState } from "react";

import { useBranding, useOrganizationSettings } from "@/components/providers/SystemSettingsProvider";

export const OFFICIAL_APP_LOGO = "/brand/chau-tuan-logo.png";

export function BrandLogoMark({ alt = "", className = "", onError }: { alt?: string; className?: string; onError?: () => void }) {
  return (
    <span aria-hidden={alt ? undefined : true} aria-label={alt || undefined} className={`brand-logo__crop ${className}`} role={alt ? "img" : undefined}>
      <Image alt="" aria-hidden="true" height={559} loading="eager" onError={onError} src={OFFICIAL_APP_LOGO} unoptimized width={447} />
    </span>
  );
}

export function AppLogo({ compact = false, href = "/dashboard", label = "Về Dashboard" }: { compact?: boolean; href?: string; label?: string }) {
  const branding = useBranding();
  const organization = useOrganizationSettings();
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const candidates = compact ? [branding.logoCompactUrl?.trim(), branding.logoMainUrl?.trim(), OFFICIAL_APP_LOGO] : [branding.logoMainUrl?.trim(), OFFICIAL_APP_LOGO];
  const imageUrl = candidates.find((url): url is string => Boolean(url && !failedUrls.includes(url))) ?? null;
  const officialLogo = imageUrl === OFFICIAL_APP_LOGO;
  const initials = organization.shortName.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("vi") || "CT";
  const handleImageError = () => {
    if (imageUrl) setFailedUrls((urls) => urls.includes(imageUrl) ? urls : [...urls, imageUrl]);
  };

  return (
    <Link aria-label={`${organization.shortName}, ${label}`} className={`app-logo ${compact ? "app-logo--compact" : "app-logo--full"}`} href={href}>
      {imageUrl ? (
        officialLogo ? <BrandLogoMark className="app-logo__compact-crop" onError={handleImageError} /> : <Image
          alt=""
          aria-hidden="true"
          className={compact ? "app-logo__image app-logo__--compact" : "app-logo__image"}
          height={38}
          loading="eager"
          onError={handleImageError}
          src={imageUrl}
          unoptimized
          width={compact ? 38 : 150}
        />
      ) : (
        <span aria-hidden="true" className="app-logo__mark">{initials}</span>
      )}
      {!compact ? (
        <span className="app-logo__text">
          <strong>{organization.shortName}</strong>
          <small>{branding.systemName}</small>
        </span>
      ) : null}
    </Link>
  );
}
