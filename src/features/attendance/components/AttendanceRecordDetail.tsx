"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { History, ImageIcon, ImageOff, UserRound } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input, Select } from "@/components/shared/FormControls";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AttendanceEvent, AttendanceEventAdjustment } from "@/features/attendance/types/attendanceTypes";
import styles from "./AttendanceDetail.module.css";
import { AttendanceLocationAddress } from "./AttendanceLocationAddress";

function localInput(value:string){const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,16);}

export function AttendanceRecordDetail({ id, canAdjust = false, canViewHistory = false, backHref = "/attendance/logs" }: { id: string; canAdjust?: boolean; canViewHistory?: boolean; backHref?: string }) {
  const [event,setEvent]=useState<AttendanceEvent>(),[history,setHistory]=useState<AttendanceEventAdjustment[]>([]),[error,setError]=useState<string>();
  const load=useCallback(async()=>{const[eventResponse,historyResponse]=await Promise.all([fetch(`/api/v1/attendance/records/${id}`,{cache:"no-store"}),canViewHistory?fetch(`/api/v1/attendance/records/${id}/adjustments`,{cache:"no-store"}):Promise.resolve(undefined)]);const body=await eventResponse.json()as{data?:AttendanceEvent;error?:{message:string}};if(!eventResponse.ok||!body.data)throw new Error(body.error?.message);setEvent(body.data);if(historyResponse){const historyBody=await historyResponse.json();if(historyResponse.ok)setHistory(historyBody.data??[]);}},[canViewHistory,id]);
  useEffect(()=>{queueMicrotask(()=>void load().catch(reason=>setError(reason instanceof Error?reason.message:"Không thể tải dữ liệu.")));},[load]);
  async function adjust(submitEvent:FormEvent<HTMLFormElement>){submitEvent.preventDefault();const form=new FormData(submitEvent.currentTarget),response=await fetch(`/api/v1/attendance/records/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({effectiveAt:new Date(String(form.get("effectiveAt"))).toISOString(),attendanceStatus:form.get("attendanceStatus"),reason:form.get("reason")})}),body=await response.json();if(!response.ok){setError(body.error?.message);return;}setError(undefined);await load();}
  if(!event&&!error)return <div className="attendance-day-detail"><BackLink href={backHref}/><LoadingState/></div>;if(!event)return <div className="attendance-day-detail"><BackLink href={backHref}/><ErrorState description={error}/></div>;
  const rows:Array<[string,ReactNode]>=[["Nhân viên",event.employeeName??"—"],["Loại",event.eventType==="check_in"?"Chấm vào":"Chấm ra"],["Thời gian hiệu lực",new Date(event.effectiveAt).toLocaleString("vi-VN")],["Server nhận",new Date(event.receivedAtServer).toLocaleString("vi-VN")],["Địa điểm",<AttendanceLocationAddress accuracyMeters={event.accuracyMeters} key="address" latitude={event.latitude} longitude={event.longitude} referenceName={event.locationName}/>],["Khoảng cách",event.distanceMeters===undefined?"—":`${Math.round(event.distanceMeters)} m`],["Độ chính xác GPS",event.accuracyMeters===undefined?"—":`${Math.round(event.accuracyMeters)} m`],["Đồng bộ",event.syncStatus==="synced"?"Đã đồng bộ":"Đang chờ"]];
  return <div className={`attendance-day-detail ${styles.page}`}>
    <BackLink href={backHref}/>
    <div className={`content-grid content-grid--two ${styles.layout} ${canAdjust ? "" : styles.layoutSingle}`}>
      <Card className={styles.panel}>
        <div className={`attendance-detail-heading ${styles.identity}`}><div className={styles.identityName}><span aria-hidden="true" className={styles.avatar}><UserRound size={21}/></span><strong>{event.employeeName}</strong></div><StatusBadge tone={event.attendanceStatus==="recorded"?"success":"warning"}>{event.attendanceStatus==="recorded"?"Đã ghi nhận":"Cần kiểm tra"}</StatusBadge></div>
        <dl className={`attendance-record-meta ${styles.meta}`}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className={styles.photoAction}>{event.photoId?<Link className="button button--secondary button--md" href={`/attendance/photos/${event.photoId}`}><ImageIcon aria-hidden="true" size={17}/>Xem ảnh</Link>:<><ImageOff aria-hidden="true" size={17}/><span>Ảnh chưa đồng bộ</span></>}</div>
      </Card>
      {canAdjust?<Card className={styles.panel}><h3>Điều chỉnh lượt công</h3><form className={`leave-form ${styles.form}`} onSubmit={adjust}><Input defaultValue={localInput(event.effectiveAt)} label="Thời gian hiệu lực" name="effectiveAt" required type="datetime-local"/><Select defaultValue={event.attendanceStatus} label="Trạng thái" name="attendanceStatus" options={[{value:"recorded",label:"Đã ghi nhận"},{value:"needs_review",label:"Cần kiểm tra"},{value:"rejected",label:"Từ chối"}]}/><Input label="Lý do" name="reason" required/><Button type="submit" variant="primary">Lưu điều chỉnh</Button></form></Card>:null}
    </div>
    {canViewHistory?<Card className={styles.panel}><h3>Lịch sử điều chỉnh</h3>{history.length?<ol className={`project-history-list ${styles.history}`}>{history.map(item=><li key={item.id}><time>{new Date(item.changedAt).toLocaleString("vi-VN")}</time><strong>{item.changedByName??"Hệ thống"}</strong><span>{item.reason}</span></li>)}</ol>:<div className={styles.historyEmpty}><History aria-hidden="true" size={18}/><span>Chưa có điều chỉnh.</span></div>}</Card>:null}
    {error?<p className="form-error">{error}</p>:null}
  </div>;
}
