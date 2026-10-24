import { BusinessLoginEntry } from "@/features/business/BusinessLoginEntry";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { LoginBrand } from "@/features/system-admin/components/LoginBrand";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { readPresentationSettings } from "@/services/system-settings/systemSettingsService";
import { testToolsAvailable } from "@/lib/testing/policy.mjs";
import { TestAccountPicker } from "@/features/testing/TestAccountPicker";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if(controlCenterEnabled())return <BusinessLoginEntry/>;
  const { reason } = await searchParams;
  const [settings, user] = await Promise.all([readPresentationSettings(), getRequestUser()]);
  if (user) redirect("/applications");
  const testEnvironment = testToolsAvailable();
  return <main className="login-page erp-login"><section className="login-shell">
    <aside className="login-brand-panel">
      <span className="erp-login__product">{settings.branding.systemName}</span>
      <div className="login-brand-lockup"><LoginBrand logoUrl={settings.branding.logoMainUrl} shortName={settings.organization.shortName} /><strong className="erp-login__company">{settings.organization.companyName}</strong></div>
    </aside>
    <section className="login-card">
      {controlCenterEnabled()?<Link className="erp-login__back" href="/"><ArrowLeft aria-hidden="true" size={17}/>Giới thiệu DIMIXO ERP</Link>:null}
      <div className="login-card__title"><span>{settings.branding.systemName}</span><h1>Đăng nhập</h1></div>
      {reason === "session-expired" ? <p className="form-alert form-alert--warning" role="status">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</p> : null}
      <LoginForm />
      {controlCenterEnabled()?<Link className="erp-login__trial" href="/dang-ky-dung-thu">Đăng ký dùng thử cho doanh nghiệp</Link>:null}
      {testEnvironment ? <TestAccountPicker environment={testEnvironment.environment} /> : null}
      <small>{settings.organization.companyName}</small>
    </section>
  </section></main>;
}
