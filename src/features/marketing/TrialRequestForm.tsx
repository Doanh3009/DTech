"use client";

import Link from "next/link";
import {SelectControl} from "@/components/shared/SelectControl";
import { ArrowUpRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { trialCompanySizes, trialIndustries, trialRequestSchema } from "./trialSchemas";
import styles from "./Trial.module.css";

export function TrialRequestForm({initialIndustry="construction"}:{initialIndustry?:keyof typeof trialIndustries}) {
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [received,setReceived]=useState<string|null>(null);
  const inFlight=useRef(false);
  const command=useRef<{requestId:string;body:string}|null>(null);
  const resultRef=useRef<HTMLDivElement>(null);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    if (!command.current) {
      const values=Object.fromEntries(new FormData(event.currentTarget));
      const qualification=Object.fromEntries(["companyType","taxCode","companyWebsite","contactRole","province","address","branchCount","currentTools","rolloutWindow"].map(k=>[k,k==="branchCount"?Number(values[k]):values[k]]));
      for(const key of Object.keys(qualification))delete values[key];
      const parsed=trialRequestSchema.safeParse({...values,qualification,requestId:crypto.randomUUID(),consent:values.consent==="on"});
      if (!parsed.success) { setError("Vui lòng kiểm tra thông tin và đồng ý sử dụng thông tin liên hệ."); return; }
      command.current={requestId:parsed.data.requestId,body:JSON.stringify(parsed.data)};
    }
    inFlight.current=true; setBusy(true); setError(null);
    try {
      const response=await fetch("/api/v1/trial-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:command.current.body,signal:AbortSignal.timeout(20_000)});
      const body=await response.json();
      if (!response.ok || body.ok!==true) {
        if (response.status===400) { command.current=null; setPending(false); } else setPending(true);
        setError(body.error?.message || "Chưa thể xác nhận yêu cầu. Vui lòng thử lại."); return;
      }
      if (body.data?.requestId!==command.current.requestId || body.data?.received!==true) throw new Error("Unconfirmed receipt");
      setReceived(command.current.requestId); command.current=null; setPending(false);
      requestAnimationFrame(()=>resultRef.current?.focus());
    } catch { setPending(true); setError("Chưa thể xác nhận kết quả gửi. Thông tin được giữ nguyên; bạn có thể thử lại."); }
    finally { inFlight.current=false; setBusy(false); }
  }
  if (received) return <div className={styles.success} ref={resultRef} tabIndex={-1} role="status"><CheckCircle2 size={42} aria-hidden="true" /><h2>DIMIXO đã nhận yêu cầu.</h2><p>Đội ngũ DIMIXO sẽ liên hệ để trao đổi nhu cầu, thống nhất phạm vi và thiết lập môi trường dùng thử riêng.</p><div className={styles.receipt}><span>Mã yêu cầu</span><code>{received}</code></div><p>Bạn sẽ nhận đường dẫn ERP và tài khoản trong thông tin bàn giao từ DIMIXO.</p><Link className={styles.submit} href="/">Về trang chủ<ArrowUpRight aria-hidden="true" size={17} /></Link></div>;
  return <form aria-label="Đăng ký dùng thử" className={styles.form} onSubmit={submit}>
    <fieldset disabled={busy||pending}>
      <div className={styles.grid}>
        <label className={styles.full}>Tên doanh nghiệp <span>*</span><input autoComplete="organization" maxLength={120} minLength={2} name="companyName" required /></label>
        <label htmlFor="trial-companyType">Loại hình doanh nghiệp <span aria-hidden="true">*</span><SelectControl id="trial-companyType" aria-label="Loại hình doanh nghiệp" defaultValue={""} name="companyType" required options={[{value:"",label:"Chọn loại hình",disabled:true},...[{value:'limited',label:'Công ty TNHH'},{value:'joint_stock',label:'Công ty cổ phần'},{value:'private',label:'Doanh nghiệp tư nhân'},{value:'household',label:'Hộ kinh doanh'},{value:'other',label:'Loại hình khác'}]]}/></label>
        <label>Mã số thuế<input maxLength={30} name="taxCode" /></label>
        <label>Họ và tên <span>*</span><input autoComplete="name" maxLength={100} minLength={2} name="contactName" required /></label>
        <label>Chức vụ <span>*</span><input autoComplete="organization-title" maxLength={100} minLength={2} name="contactRole" required /></label>
        <label>Số điện thoại <span>*</span><input autoComplete="tel" inputMode="tel" maxLength={24} minLength={9} name="phone" required type="tel" /></label>
        <label className={styles.full}>Email liên hệ <span>*</span><input autoComplete="email" maxLength={254} name="email" required type="email" /></label>
        <label htmlFor="trial-industry">Lĩnh vực <span aria-hidden="true">*</span><SelectControl id="trial-industry" aria-label="Lĩnh vực" defaultValue={initialIndustry} name="industry" required options={Object.entries(trialIndustries).map(([value,label])=>({value,label}))}/></label>
        <label htmlFor="trial-companySize">Quy mô nhân sự <span aria-hidden="true">*</span><SelectControl id="trial-companySize" aria-label="Quy mô nhân sự" defaultValue={""} name="companySize" required options={[{value:"",label:"Chọn quy mô",disabled:true},...Object.entries(trialCompanySizes).map(([value,label])=>({value,label}))]}/></label>
        <label>Tỉnh / thành phố <span>*</span><input autoComplete="address-level1" name="province" maxLength={100} minLength={2} required /></label>
        <label>Số chi nhánh / công trường <span>*</span><input type="number" name="branchCount" defaultValue={1} min={1} max={10000} required /></label>
        <label className={styles.full}>Địa chỉ doanh nghiệp <span>*</span><input autoComplete="street-address" name="address" maxLength={240} minLength={5} required /></label>
        <label>Website doanh nghiệp<input type="url" name="companyWebsite" maxLength={240} placeholder="https://" /></label>
        <label htmlFor="trial-rolloutWindow">Thời gian triển khai <span aria-hidden="true">*</span><SelectControl id="trial-rolloutWindow" aria-label="Thời gian triển khai" defaultValue={""} name="rolloutWindow" required options={[{value:"",label:"Chọn thời gian",disabled:true},...[{value:'now',label:'Trong tháng này'},{value:'quarter',label:'Trong 3 tháng'},{value:'later',label:'Sau 3 tháng'},{value:'exploring',label:'Đang tìm hiểu'}]]}/></label>
        <label className={styles.full}>Công cụ đang sử dụng<input maxLength={500} name="currentTools" placeholder="Excel, phần mềm hiện tại..." /></label>
        <label className={styles.full}>Nhu cầu của doanh nghiệp <span>*</span><textarea maxLength={1500} minLength={10} required name="needs" placeholder="Ví dụ: quản lý sản xuất theo định mức, truy xuất lô hoặc đối chiếu chi phí công trình" rows={4} /></label>
        <label aria-hidden="true" className={styles.honeypot}>Website<input autoComplete="off" name="website" tabIndex={-1} /></label>
      </div>
      <label className={styles.consent}><input name="consent" required type="checkbox" /><span>Tôi đồng ý để DIMIXO sử dụng thông tin đã cung cấp nhằm liên hệ tư vấn và xử lý yêu cầu dùng thử. <Link href="/quyen-rieng-tu" target="_blank" rel="noopener noreferrer">Quyền riêng tư</Link></span></label>
    </fieldset>
    {error?<div className={styles.error} role="alert">{error}</div>:null}
    <button aria-busy={busy} className={styles.submit} disabled={busy} type="submit">{busy?"Đang gửi yêu cầu":pending?"Thử gửi lại yêu cầu":"Gửi yêu cầu dùng thử"}<ArrowUpRight aria-hidden="true" size={18} /></button>
    <span className={styles.security}><LockKeyhole size={13} aria-hidden="true" />Thông tin chỉ phục vụ tư vấn và thiết lập dùng thử.</span>
  </form>;
}
