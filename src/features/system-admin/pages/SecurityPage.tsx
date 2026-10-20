import { ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { getServerEnv } from "@/lib/env";

export function SecurityPage() {
  const env=getServerEnv();
  const controls=[
    {label:"Phiên Supabase Auth",ready:Boolean(env.NEXT_PUBLIC_SUPABASE_URL&&(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY)&&env.SESSION_HASH_PEPPER&&env.SESSION_HASH_PEPPER.length>=32)},
    {label:"Phân quyền route/API phía server",ready:true},
    {label:"Kiểm tra Origin request ghi",ready:true},
    {label:"CSP và security headers",ready:true},
    {label:"Kiểm tra nội dung tệp",ready:true},
    {label:"Mã hóa secret tích hợp",ready:Boolean(env.INTEGRATION_ENCRYPTION_KEY&&env.INTEGRATION_ENCRYPTION_KEY.length>=32)},
    {label:"Webhook signing",ready:Boolean(env.WEBHOOK_SIGNING_SECRET&&env.WEBHOOK_SIGNING_SECRET.length>=32)}
  ];
  return <AdminPage title="Bảo mật"><section className="settings-form-card security-status-grid">{controls.map(control=><div key={control.label}><ShieldCheck aria-hidden="true" size={18}/><strong>{control.label}</strong><StatusBadge tone={control.ready?"success":"warning"}>{control.ready?"Sẵn sàng":"Chưa cấu hình"}</StatusBadge></div>)}</section></AdminPage>;
}
