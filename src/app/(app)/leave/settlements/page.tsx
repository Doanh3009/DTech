import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeaveYearEndSettlement } from "@/features/leave/components/LeaveYearEndSettlement";
export default function Page() { return <div className="page-stack"><BackLink href="/leave/balances"/><PageHeader title="Thanh toán phép cuối năm"/><LeaveYearEndSettlement/></div>; }
