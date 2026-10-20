"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";
import { goBackInApp } from "@/lib/navigation/backHistory";
import { LinkLoadingIndicator } from "@/components/shared/LinkLoadingIndicator";

interface BackLinkProps {
  href: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}

function isPlainPrimaryClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey;
}

export function BackLink({
  href,
  label = "Trở lại",
  className = "back-link",
  iconOnly = false,
}: BackLinkProps) {
  function navigateBack(event: MouseEvent<HTMLAnchorElement>) {
    if (isPlainPrimaryClick(event) && goBackInApp()) event.preventDefault();
  }

  return (
    <Link
      aria-label={iconOnly ? label : undefined}
      className={className}
      data-ui="back-control"
      href={href}
      replace
      onClick={navigateBack}
    >
      <ArrowLeft aria-hidden="true" size={iconOnly ? 21 : 17} />
      {iconOnly ? null : <span>{label}</span>}
      <LinkLoadingIndicator />
    </Link>
  );
}
