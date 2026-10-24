"use client";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input, PasswordInput } from "@/components/shared/FormControls";
import { businessPassword } from "./businessSchemas";

export function BusinessAuthForm({slug,changePassword=false}:{slug:string;changePassword?:boolean}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const submitting=useRef(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(submitting.current)return;const f=new FormData(e.currentTarget);const password=String(f.get("password")??"");
  if(changePassword&&(!businessPassword.safeParse(password).success||password!==f.get("confirmPassword"))){setError("Mật khẩu cần ít nhất 12 ký tự, chữ hoa, chữ thường, số, ký hiệu và xác nhận trùng khớp.");return;}
  submitting.current=true;setBusy(true);setError("");try{
   const r=await fetch(`/api/v1/business/${slug}/${changePassword?"password":"login"}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(changePassword?{currentPassword:f.get("currentPassword"),password}:{username:f.get("username"),password}),signal:AbortSignal.timeout(25000)});const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message||"Không thể đăng nhập.");window.location.assign(changePassword?`/erp/${slug}`:b.data.destination);
  }catch(e){setError(e instanceof Error?e.message:"Không thể kết nối.");}finally{setBusy(false);submitting.current=false;}
 }
 return <form onSubmit={submit} aria-busy={busy}>{changePassword?<PasswordInput name="currentPassword" label="Mật khẩu hiện tại" autoComplete="current-password" required maxLength={128}/>:<Input label="Tên tài khoản" name="username" required autoComplete="username" autoCapitalize="none" maxLength={32}/>}<PasswordInput name="password" label={changePassword?"Mật khẩu mới":"Mật khẩu"} autoComplete={changePassword?"new-password":"current-password"} required minLength={changePassword?12:1} maxLength={128}/>{changePassword?<PasswordInput name="confirmPassword" label="Xác nhận mật khẩu mới" autoComplete="new-password" required minLength={12} maxLength={128}/>:null}{error?<p role="alert" className="form-error">{error}</p>:null}<Button variant="primary" type="submit" busy={busy} disabled={busy}>{changePassword?"Đổi mật khẩu":"Đăng nhập"}</Button></form>;
}
