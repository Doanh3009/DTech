"use client";
import { Button } from "@/components/shared/Button";
export default function ErrorBoundary({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <main className="login-page"><section className="login-card"><h1>Không thể tải trang</h1><p>Vui lòng thử lại. Mã tham chiếu: <code>{error.digest||"client-error"}</code></p><Button onClick={reset} variant="primary">Thử lại</Button></section></main>;
}
