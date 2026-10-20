"use client";
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <html lang="vi"><body><main><h1>Hệ thống tạm thời gián đoạn</h1><p>Mã tham chiếu: <code>{error.digest||"global-error"}</code></p><button onClick={reset} type="button">Thử lại</button></main></body></html>;
}
