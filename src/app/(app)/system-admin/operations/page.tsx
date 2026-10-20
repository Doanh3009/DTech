import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { StatusBadge, type StatusBadgeTone } from "@/components/shared/StatusBadge";
import { detailedSystemHealth, integrationHealth, operationalJobs } from "@/features/operations/services/systemHealthService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

function tone(status:string):StatusBadgeTone{return ["healthy","connected","completed","delivered"].includes(status)?"success":["unavailable","error","failed","dead_letter"].includes(status)?"error":"warning";}
function time(value:unknown){if(!value)return "—";const parsed=new Date(String(value));return Number.isNaN(parsed.valueOf())?"—":new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(parsed);}

export default async function OperationsPage(){
  requirePermission(await getRequestUser(),"operations.view");
  const [health,jobs,integrations]=await Promise.all([detailedSystemHealth(),operationalJobs(),integrationHealth()]);
  return <AdminPage title="Vận hành">
    <section className="settings-form-card"><h3>Tình trạng hệ thống</h3><div className="platform-table" role="table"><div className="platform-table__head" role="row"><span>Thành phần</span><span>Trạng thái</span><span>Độ trễ</span><span>Kiểm tra lúc</span></div>{health.components.map(item=><div className="platform-table__row" key={item.component} role="row"><strong>{item.component}</strong><StatusBadge tone={tone(item.status)}>{item.status}</StatusBadge><span>{item.latencyMs===undefined?"—":`${item.latencyMs} ms`}</span><time>{time(item.checkedAt)}</time></div>)}</div></section>
    <section className="settings-form-card"><h3>Tích hợp</h3><div className="platform-table" role="table"><div className="platform-table__head" role="row"><span>Mã</span><span>Tên</span><span>Trạng thái</span><span>Lần thành công cuối</span></div>{integrations.map(item=><div className="platform-table__row" key={String(item.id)} role="row"><code>{String(item.code)}</code><strong>{String(item.name)}</strong><StatusBadge tone={tone(String(item.status))}>{String(item.status)}</StatusBadge><time>{time(item.last_success_at)}</time></div>)}</div></section>
    <section className="settings-form-card"><h3>Job gần đây</h3><div className="platform-table" role="table"><div className="platform-table__head" role="row"><span>Loại</span><span>Job</span><span>Trạng thái</span><span>Thời gian</span></div>{jobs.map(item=><div className="platform-table__row" key={`${item.kind}:${item.id}`} role="row"><span>{item.kind}</span><code>{item.label}</code><StatusBadge tone={tone(item.status)}>{item.status}</StatusBadge><time>{time(item.createdAt)}</time></div>)}</div></section>
  </AdminPage>;
}
