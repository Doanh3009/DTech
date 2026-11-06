import { notFound } from "next/navigation";
import { readBusinessWorkspace } from "@/features/business/businessService";
import { entitiesFor,workspaceFeatureFor } from "@/features/business/businessCatalog";
import { businessKind } from "@/features/business/businessSchemas";
import { BusinessRecords } from "@/features/business/BusinessRecords";
import {BusinessProjectTasks} from "@/features/business/BusinessProjectTasks";
import {businessCan} from "@/features/business/businessAccess";
import {BusinessWorkArea} from "@/features/business/BusinessWorkArea";
export default async function Page({params,searchParams}:{params:Promise<{slug:string;kind:string}>;searchParams:Promise<{q?:string}>}){const {slug,kind}=await params;const k=businessKind.safeParse(kind);if(!k.success)notFound();const w=await readBusinessWorkspace(slug);if(!entitiesFor(w.industry,w.features).includes(k.data)||!businessCan(w,k.data,"read"))notFound();const query=(await searchParams).q?.slice(0,100)??"";return <BusinessWorkArea workspace={w} feature={workspaceFeatureFor(k.data,w.features)} activeKind={k.data}>{k.data==="project_tasks"?<BusinessProjectTasks workspace={w}/>:<BusinessRecords key={kind+query} workspace={w} kind={k.data} initialQuery={query}/>}</BusinessWorkArea>;}
