"use client";

import { DimixoLogo, DIMIXO_LOGO } from "@/components/shared/DimixoLogo";
import Image from "next/image";
import { useState } from "react";

export function LoginBrand({ shortName, logoUrl }: { shortName: string; logoUrl: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const initials = shortName.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("vi") || "DT";
  if (!logoUrl || failedUrl === logoUrl) return <span aria-label={shortName} className="erp-login__monogram" role="img">{initials}</span>;
  if(logoUrl===DIMIXO_LOGO)return <DimixoLogo/>;
  return <Image
    alt={`Logo ${shortName}`}
    className="login-brand__image login-brand__image--official-full"
    height={559}
    loading="eager"
    onError={() => setFailedUrl(logoUrl)}
    src={logoUrl}
    unoptimized
    width={447}
  />;
}
