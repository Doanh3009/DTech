"use client";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/Button";
import { clearSupabaseRealtimeAuthentication } from "@/lib/supabase/client";

export function LogoutButton({ className }: { className?: string } = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <Button className={className} disabled={busy} leftIcon={<LogOut aria-hidden="true" size={16} />} onClick={async () => { setBusy(true); try { await fetch("/api/v1/auth/logout", { method: "POST" }); } finally { clearSupabaseRealtimeAuthentication(); router.replace("/login"); router.refresh(); } }} variant="secondary" busy={busy}>{"Đăng xuất"}</Button>;
}
