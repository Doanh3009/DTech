import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BusinessShell } from "@/features/business/BusinessShell";
import { readBusinessWorkspace } from "@/features/business/businessService";
import { AppError } from "@/lib/api/errors";
import { ErrorState } from "@/components/shared/States";
export const metadata={robots:{index:false,follow:false}};
export default async function Layout({params,children}:{params:Promise<{slug:string}>;children:ReactNode}){const {slug}=await params;let w;try{w=await readBusinessWorkspace(slug);}catch(e){if(e instanceof AppError&&e.status===401)redirect(`/erp/${slug}/login`);return <main><ErrorState title={e instanceof AppError?e.message:"Không thể kết nối ERP"}/></main>;}if(w.mustChangePassword)redirect(`/erp/${slug}/password`);return <BusinessShell workspace={w}>{children}</BusinessShell>;}
