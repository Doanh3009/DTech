import type { ReactNode } from "react"; import { ProtectedAreaLayout } from "@/components/auth/ProtectedAreaLayout";
export default function Layout({children}:{children:ReactNode}){return <ProtectedAreaLayout area="attendance">{children}</ProtectedAreaLayout>;}
