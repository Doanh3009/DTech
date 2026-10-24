import { notFound } from "next/navigation";
import { readBusinessWorkspace } from "@/features/business/businessService";
import { entitiesFor } from "@/features/business/businessCatalog";
import { businessKind } from "@/features/business/businessSchemas";
import { BusinessRecords } from "@/features/business/BusinessRecords";
import {businessCan} from "@/features/business/businessAccess";
export default async function Page({params,searchParams}:{params:Promise<{slug:string;kind:string}>;searchParams:Promise<{q?:string}>}){const {slug,kind}=await params;const k=businessKind.safeParse(kind);if(!k.success)notFound();const w=await readBusinessWorkspace(slug);if(!entitiesFor(w.industry,w.features).includes(k.data)||!businessCan(w,k.data,"read"))notFound();const query=(await searchParams).q?.slice(0,100)??"";return <BusinessRecords key={kind+query} workspace={w} kind={k.data} initialQuery={query}/>;}
