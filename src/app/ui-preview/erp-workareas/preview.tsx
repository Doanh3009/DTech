"use client";
// Development fixtures only. Production is blocked by both page and parent layout.
import {useMemo,useState,useSyncExternalStore,type MouseEvent} from "react";
import {NavigationPromisesContext,PathnameContext,SearchParamsContext} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import {BusinessShell} from "@/features/business/BusinessShell";
import {BusinessWorkArea} from "@/features/business/BusinessWorkArea";
import {BusinessAreaLinks} from "@/features/business/BusinessAreaLinks";
import {BusinessRecords} from "@/features/business/BusinessRecords";
import {businessWorkAreas} from "@/features/business/businessWorkAreas";
import {businessEntities,featureKeys,featureLabels,type BusinessFeature,type EntityKind} from "@/features/business/businessCatalog";
import {confirmBusinessNavigation} from "@/features/business/businessNavigationGuard";
import type {BusinessWorkspace} from "@/features/business/businessSchemas";
import {Select} from "@/components/shared/FormControls";

const workspace:BusinessWorkspace={tenantId:"10000000-0000-4000-8000-000000000001",slug:"mau-local",name:"Doanh nghiệp mẫu",systemName:"DIMIXO ERP",industry:"construction",features:featureKeys,status:"active",trialEndsAt:"2027-01-01",accountId:"10000000-0000-4000-8000-000000000002",displayName:"Quản lý mẫu",username:"ui-preview",role:"owner",mustChangePassword:false,isDemo:true};
const subscribe=()=>()=>{};
export function ErpWorkAreaPreview(){
 const mounted=useSyncExternalStore(subscribe,()=>true,()=>false);
 const [route,setRoute]=useState("/erp/mau-local/module/purchasing");
 const url=useMemo(()=>new URL(route,"http://preview.local"),[route]);
 const feature=(url.pathname.split("/")[3]==="module"?url.pathname.split("/")[4]:businessEntities[url.pathname.split("/")[3] as EntityKind]?.feature) as BusinessFeature;
 const areas=businessWorkAreas(workspace,feature),area=areas.find(value=>value.key===url.searchParams.get("area"));
 const kind=(url.searchParams.get("view")??area?.kinds[0]??"") as EntityKind;
 function navigate(event:MouseEvent<HTMLDivElement>){
  const link=(event.target as Element).closest<HTMLAnchorElement>('a[href^="/erp/mau-local"]');if(!link)return;
  event.preventDefault();if(confirmBusinessNavigation())setRoute(link.getAttribute("href")!);
 }
 if(!mounted)return <p role="status">Đang mở mẫu giao diện…</p>;
 return <><div style={{padding:"12px 24px",background:"var(--surface)",borderBottom:"1px solid var(--border-default)",display:"flex",alignItems:"center",gap:16}} data-ui="preview-tools"><strong>Mẫu phát triển</strong><div style={{width:240,maxWidth:"65%"}}><Select label="Module mẫu" labelHidden value={feature} options={featureKeys.map(value=>({value,label:featureLabels[value]}))} onChange={event=>{if(confirmBusinessNavigation())setRoute(`/erp/mau-local/module/${event.target.value}`);}}/></div></div>
  <NavigationPromisesContext value={null}><PathnameContext value={url.pathname}><SearchParamsContext value={url.searchParams}>
   <div onClickCapture={navigate}><BusinessShell workspace={workspace}>{area&&kind?<BusinessWorkArea workspace={workspace} feature={feature} area={area} activeKind={kind}><BusinessRecords key={kind} workspace={workspace} kind={kind}/></BusinessWorkArea>:<div style={{display:"grid",gap:24}}><h1>{featureLabels[feature]}</h1><BusinessAreaLinks workspace={workspace} feature={feature}/></div>}</BusinessShell></div>
  </SearchParamsContext></PathnameContext></NavigationPromisesContext>
 </>;
}
