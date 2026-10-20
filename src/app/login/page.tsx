import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { LoginBrand } from "@/features/system-admin/components/LoginBrand";
import { LoginBackdrop } from "@/features/system-admin/components/LoginBackdrop";
import { resolveLandingPage } from "@/features/dashboard/registry";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { readSettingsGroup, readSystemSettings } from "@/services/system-settings/systemSettingsService";
import { testToolsAvailable } from "@/lib/testing/policy.mjs";
import { TestAccountPicker } from "@/features/testing/TestAccountPicker";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;
  const [settings, dashboard, user] = await Promise.all([readSystemSettings(), readSettingsGroup("dashboard"), getRequestUser()]);
  if (user) redirect(resolveLandingPage(user, dashboard));
  const testEnvironment = testToolsAvailable();
  return <main className="login-page"><LoginBackdrop /><section className="login-shell">
    <aside className="login-brand-panel">
      <div className="login-brand-lockup"><LoginBrand shortName={settings.organization.shortName} /></div>
    </aside>
    <section className="login-card">
      <div className="login-card__title"><span>ĐĂNG NHẬP HỆ THỐNG</span><h2>{settings.branding.systemName}</h2></div>
      {reason === "session-expired" ? <p className="form-alert form-alert--warning" role="status">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</p> : null}
      <LoginForm />
      {testEnvironment ? <TestAccountPicker environment={testEnvironment.environment} /> : null}
      <small>{settings.organization.companyName}</small>
    </section>
  </section></main>;
}
