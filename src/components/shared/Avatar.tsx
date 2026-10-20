"use client";

import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

export interface AvatarProps {
  name: string;
  imageUrl?: string;
  className?: string;
  loading?: "eager" | "lazy";
}

export function Avatar({ name, imageUrl, className, loading = "eager" }: AvatarProps) {
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loadedSource, setLoadedSource] = useState<string>();
  useEffect(() => {
    const refresh = () => { setFailed(false); setRevision((value) => value + 1); };
    window.addEventListener("avatar-updated", refresh);
    return () => window.removeEventListener("avatar-updated", refresh);
  }, []);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const source = imageUrl ? `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}v=${revision}` : undefined;

  return (
    <span aria-label={name} className={cn("avatar", className)}>
      <span aria-hidden="true">{initials || <UserRound size={16} />}</span>
      {source && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className={cn("avatar__image", loadedSource === source && "is-loaded")} decoding="async" loading={loading} onError={() => setFailed(true)} onLoad={() => setLoadedSource(source)} src={source} />
      ) : null}
    </span>
  );
}
