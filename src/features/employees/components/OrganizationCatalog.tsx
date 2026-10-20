"use client";

/* eslint-disable react-hooks/set-state-in-effect -- catalog state is hydrated from the API. */
import Link from "next/link";
import { FilePlus2, FileUp, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { FilterBar } from "@/components/shared/FilterBar";
import { DatePicker, Input, SearchInput, Select, Textarea } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { DataSurface, ListPageLayout } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatBusinessDate } from "@/lib/time/timezone";
import contractStyles from "./EmployeeContractManager.module.css";

type EmployeeOption = { id: string; code: string; name: string };
type DepartmentRow = { id:string;code:string;name:string;parentDepartmentId?:string;managerEmployeeId?:string;managerName?:string;active:boolean;sortOrder:number;headcount:number };
type PositionRow = { id:string;code:string;name:string;departmentId?:string;departmentName?:string;active:boolean;sortOrder:number;headcount:number };
type Catalog = { departments:DepartmentRow[];positions:PositionRow[];employees:EmployeeOption[] };
type DepartmentDraft = Omit<DepartmentRow,"id"|"managerName"|"headcount">;
type PositionDraft = Omit<PositionRow,"id"|"departmentName"|"headcount">;
type ContractRow = { id:string;employeeId:string;employeeCode:string;employeeName:string;departmentName?:string;positionName?:string;contractNumber:string;contractType:string;signedDate?:string;effectiveDate:string;endDate?:string;status:string;archivedAt?:string;attachmentFileId?:string;attachmentFileName?:string;attachmentMimeType?:string };
type ContractEmployeeOption={id:string;code:string;name:string;departmentName?:string;positionName?:string};
type ContractTemplateOption={id:string;name:string;fileAssetId?:string;createdAt:string};
type ContractWorkspace={contracts:ContractRow[];employees:ContractEmployeeOption[];templates:ContractTemplateOption[]};

const emptyDepartment:DepartmentDraft={code:"",name:"",active:true,sortOrder:0};
const emptyPosition:PositionDraft={code:"",name:"",active:true,sortOrder:0};
const contractStatus:Record<string,string>={draft:"Nháp",active:"Đang hiệu lực",expired:"Hết hạn",terminated:"Đã chấm dứt"};

async function request<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(30_000),...init});
  const body=await response.json() as{data?:T;error?:{message?:string}};
  if(!response.ok||body.data===undefined)throw new Error(body.error?.message??"Không thể xử lý yêu cầu.");
  return body.data;
}

function activeBadge(active:boolean){return <StatusBadge tone={active?"success":"neutral"}>{active?"Đang dùng":"Ngừng dùng"}</StatusBadge>;}

export function OrganizationCatalog({kind,canManage}:{kind:"departments"|"positions";canManage:boolean}){
  const[catalog,setCatalog]=useState<Catalog>(),[query,setQuery]=useState(""),[open,setOpen]=useState(false),[editingId,setEditingId]=useState<string>(),[department,setDepartment]=useState<DepartmentDraft>(emptyDepartment),[position,setPosition]=useState<PositionDraft>(emptyPosition),[error,setError]=useState(""),[saving,setSaving]=useState(false);
  const endpoint=`/api/v1/hr/${kind}`;
  const load=useCallback(async()=>{try{setCatalog(await request<Catalog>(endpoint));setError("");}catch(reason){setError(reason instanceof Error?reason.message:"Không thể tải dữ liệu.");}},[endpoint]);
  useEffect(()=>{void load();},[load]);
  function create(){setEditingId(undefined);setDepartment(emptyDepartment);setPosition(emptyPosition);setError("");setOpen(true);}
  function editDepartment(row:DepartmentRow){setEditingId(row.id);setDepartment({code:row.code,name:row.name,parentDepartmentId:row.parentDepartmentId,managerEmployeeId:row.managerEmployeeId,active:row.active,sortOrder:row.sortOrder});setOpen(true);}
  function editPosition(row:PositionRow){setEditingId(row.id);setPosition({code:row.code,name:row.name,departmentId:row.departmentId,active:row.active,sortOrder:row.sortOrder});setOpen(true);}
  async function submit(event:FormEvent){event.preventDefault();setSaving(true);setError("");try{const payload=kind==="departments"?department:position;setCatalog(await request<Catalog>(editingId?`${endpoint}/${editingId}`:endpoint,{method:editingId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}));setOpen(false);}catch(reason){setError(reason instanceof Error?reason.message:"Không thể lưu dữ liệu.");}finally{setSaving(false);}}
  const normalized=query.toLocaleLowerCase("vi");
  const departments=useMemo(()=>(catalog?.departments??[]).filter(row=>`${row.code} ${row.name} ${row.managerName??""}`.toLocaleLowerCase("vi").includes(normalized)),[catalog,normalized]);
  const positions=useMemo(()=>(catalog?.positions??[]).filter(row=>`${row.code} ${row.name} ${row.departmentName??""}`.toLocaleLowerCase("vi").includes(normalized)),[catalog,normalized]);
  const departmentName=new Map((catalog?.departments??[]).map(row=>[row.id,row.name]));
  const departmentColumns:DataTableColumn<DepartmentRow>[]=[{id:"code",header:"Mã",cell:row=><strong>{row.code}</strong>},{id:"name",header:"Phòng ban",accessor:"name"},{id:"parent",header:"Trực thuộc",cell:row=>row.parentDepartmentId?departmentName.get(row.parentDepartmentId)??"—":"—"},{id:"manager",header:"Trưởng phòng",cell:row=>row.managerName??"—"},{id:"headcount",header:"Nhân sự",accessor:"headcount",align:"right"},{id:"status",header:"Trạng thái",cell:row=>activeBadge(row.active)}];
  const positionColumns:DataTableColumn<PositionRow>[]=[{id:"code",header:"Mã",cell:row=><strong>{row.code}</strong>},{id:"name",header:"Chức vụ",accessor:"name"},{id:"department",header:"Phòng ban",cell:row=>row.departmentName??"Dùng chung"},{id:"headcount",header:"Nhân sự",accessor:"headcount",align:"right"},{id:"status",header:"Trạng thái",cell:row=>activeBadge(row.active)}];
  return <ListPageLayout><DataSurface><div className="data-surface__toolbar"><FilterBar actions={canManage?<Button leftIcon={<Plus size={16}/>} onClick={create} variant="primary">{kind==="departments"?"Thêm phòng ban":"Thêm chức vụ"}</Button>:undefined}><SearchInput onChange={event=>setQuery(event.target.value)} placeholder={kind==="departments"?"Mã, tên phòng ban, trưởng phòng":"Mã, tên chức vụ, phòng ban"} value={query}/></FilterBar></div>{kind==="departments"?<DataTable actions={canManage?row=><DropdownMenu label={`Thao tác ${row.name}`}><button onClick={()=>editDepartment(row)} type="button">Chỉnh sửa</button></DropdownMenu>:undefined} columns={departmentColumns} data={departments} emptyDescription="" emptyTitle="Chưa có phòng ban" error={error} getRowId={row=>row.id} loading={!catalog&&!error}/>:<DataTable actions={canManage?row=><DropdownMenu label={`Thao tác ${row.name}`}><button onClick={()=>editPosition(row)} type="button">Chỉnh sửa</button></DropdownMenu>:undefined} columns={positionColumns} data={positions} emptyDescription="" emptyTitle="Chưa có chức vụ" error={error} getRowId={row=>row.id} loading={!catalog&&!error}/>}</DataSurface><Drawer onClose={()=>setOpen(false)} open={open} title={`${editingId?"Chỉnh sửa":"Thêm"} ${kind==="departments"?"phòng ban":"chức vụ"}`}><form className="drawer-form" onSubmit={submit}>{kind==="departments"?<><Input label="Mã phòng ban" required value={department.code} onChange={event=>setDepartment({...department,code:event.target.value})}/><Input label="Tên phòng ban" required value={department.name} onChange={event=>setDepartment({...department,name:event.target.value})}/><Select label="Phòng ban cấp trên" options={(catalog?.departments??[]).filter(row=>row.id!==editingId).map(row=>({value:row.id,label:`${row.code} · ${row.name}`}))} placeholder="Không có" value={department.parentDepartmentId??""} onChange={event=>setDepartment({...department,parentDepartmentId:event.target.value||undefined})}/><Select label="Trưởng phòng" options={(catalog?.employees??[]).map(row=>({value:row.id,label:`${row.code} · ${row.name}`}))} placeholder="Chưa chọn" value={department.managerEmployeeId??""} onChange={event=>setDepartment({...department,managerEmployeeId:event.target.value||undefined})}/><Input label="Thứ tự" min="0" type="number" value={department.sortOrder} onChange={event=>setDepartment({...department,sortOrder:Number(event.target.value)})}/><Select label="Trạng thái" options={[{value:"active",label:"Đang dùng"},{value:"inactive",label:"Ngừng dùng"}]} value={department.active?"active":"inactive"} onChange={event=>setDepartment({...department,active:event.target.value==="active"})}/></>:<><Input label="Mã chức vụ" required value={position.code} onChange={event=>setPosition({...position,code:event.target.value})}/><Input label="Tên chức vụ" required value={position.name} onChange={event=>setPosition({...position,name:event.target.value})}/><Select label="Phòng ban" options={(catalog?.departments??[]).map(row=>({value:row.id,label:`${row.code} · ${row.name}`}))} placeholder="Dùng chung" value={position.departmentId??""} onChange={event=>setPosition({...position,departmentId:event.target.value||undefined})}/><Input label="Thứ tự" min="0" type="number" value={position.sortOrder} onChange={event=>setPosition({...position,sortOrder:Number(event.target.value)})}/><Select label="Trạng thái" options={[{value:"active",label:"Đang dùng"},{value:"inactive",label:"Ngừng dùng"}]} value={position.active?"active":"inactive"} onChange={event=>setPosition({...position,active:event.target.value==="active"})}/></>}{error?<p className="form-error" role="alert">{error}</p>:null}<div className="form-actions"><Button onClick={()=>setOpen(false)} type="button">Hủy</Button><Button disabled={saving} type="submit" variant="primary" busy={saving}>{"Lưu"}</Button></div></form></Drawer></ListPageLayout>;
}

export function EmployeeContractList({canViewEmployee,canEdit,canUpload}:{canViewEmployee:boolean;canEdit:boolean;canUpload:boolean}){
  const[data,setData]=useState<ContractWorkspace>(),[query,setQuery]=useState(""),[status,setStatus]=useState(""),[error,setError]=useState(""),[contractOpen,setContractOpen]=useState(false),[templateListOpen,setTemplateListOpen]=useState(false),[templateOpen,setTemplateOpen]=useState(false),[saving,setSaving]=useState(false);
  const [documentMode,setDocumentMode]=useState("manual");const mutation=useRef(false);
  const load=useCallback(async()=>{try{setData(await request<ContractWorkspace>("/api/v1/hr/contracts"));setError("");}catch(reason){setError(reason instanceof Error?reason.message:"Không thể tải hợp đồng.");}},[]);
  useEffect(()=>{void load();},[load]);
  const rows=useMemo(()=>(data?.contracts??[]).filter(row=>(!status||row.status===status)&&`${row.contractNumber} ${row.employeeCode} ${row.employeeName} ${row.contractType}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))),[data,query,status]);
  async function createContract(event:FormEvent<HTMLFormElement>){event.preventDefault();if(mutation.current)return;mutation.current=true;const form=event.currentTarget;setSaving(true);setError("");try{await request<ContractRow>("/api/v1/hr/contracts",{method:"POST",body:new FormData(form)});setContractOpen(false);form.reset();await load();}catch(reason){setError(reason instanceof Error?reason.message:"Không thể tạo hợp đồng.");}finally{mutation.current=false;setSaving(false);}}
  async function uploadTemplate(event:FormEvent<HTMLFormElement>){event.preventDefault();if(mutation.current)return;mutation.current=true;const form=event.currentTarget;setSaving(true);setError("");try{await request<ContractTemplateOption>("/api/v1/hr/contract-templates",{method:"POST",body:new FormData(form)});setTemplateOpen(false);form.reset();await load();}catch(reason){setError(reason instanceof Error?reason.message:"Không thể lưu mẫu Word.");}finally{mutation.current=false;setSaving(false);}}
  const columns:DataTableColumn<ContractRow>[]=[
    {id:"number",header:"Hợp đồng",cell:row=>canViewEmployee?<Link className="text-link" href={`/employees/${row.employeeId}/contracts`}>{row.contractNumber}</Link>:row.contractNumber},
    {id:"employee",header:"Nhân viên",priority:"primary",cell:row=>canViewEmployee?<Link className="table-link" href={`/employees/${row.employeeId}/contracts`}><strong>{row.employeeName}</strong></Link>:<strong>{row.employeeName}</strong>},
    {id:"type",header:"Loại hợp đồng",accessor:"contractType",hiddenOnMobile:true},
    {id:"organization",header:"Phòng ban / Chức vụ",cell:row=>[row.departmentName,row.positionName].filter(Boolean).join(" · ")||"—",hiddenOnMobile:true},
    {id:"dates",header:"Hiệu lực / Hết hạn",cell:row=><>{formatBusinessDate(row.effectiveDate)}<br/><small>{row.endDate?formatBusinessDate(row.endDate):"Không thời hạn"}</small></>,hiddenOnMobile:true},
    {id:"status",header:"Trạng thái",cell:row=><StatusBadge tone={row.status==="active"?"success":row.status==="expired"||row.status==="terminated"?"neutral":"warning"}>{row.archivedAt?"Đã lưu trữ":contractStatus[row.status]??row.status}</StatusBadge>},
    {id:"file",header:"Tài liệu",cell:row=>row.attachmentFileId?<a className="text-link" href={`/api/v1/files/${row.attachmentFileId}/signed-url`} rel="noreferrer" target="_blank">{row.attachmentMimeType?.includes("wordprocessingml")?"Tải file Word":"Xem tài liệu"}</a>:"—",hiddenOnMobile:true}
  ];
  const templates=data?.templates??[];
  return <>
      <DataSurface className={contractStyles.surface}>
        <div className="data-surface__toolbar"><FilterBar className="contract-filter-bar" actions={<div className="contract-list-actions">{canUpload?<Button disabled={saving} onClick={()=>setTemplateListOpen(true)} variant="secondary">Mẫu Word · {templates.length}</Button>:null}{canEdit?<Button disabled={saving||!data} leftIcon={<Plus size={16}/>} onClick={()=>{setError("");setDocumentMode("manual");setContractOpen(true);}} variant="primary">Tạo hợp đồng</Button>:null}</div>}><SearchInput onChange={event=>setQuery(event.target.value)} placeholder="Số hợp đồng, nhân viên, loại hợp đồng" value={query}/><Select label="Trạng thái" options={Object.entries(contractStatus).map(([value,label])=>({value,label}))} placeholder="Tất cả" value={status} onChange={event=>setStatus(event.target.value)}/></FilterBar></div>
        <DataTable className="employee-contract-list" columns={columns} data={rows} emptyDescription="" emptyTitle="Chưa có hợp đồng" error={error} getRowHref={canViewEmployee?row=>`/employees/${row.employeeId}/contracts`:undefined} getRowId={row=>row.id} loading={!data&&!error}/>
      </DataSurface>
    <Drawer onClose={()=>setTemplateListOpen(false)} open={templateListOpen} title="Mẫu Word">
      <div className={`contract-template-drawer ${contractStyles.templateList}`}><div className="panel-header"><h3>{templates.length} mẫu</h3>{canUpload?<Button leftIcon={<FileUp size={15}/>} onClick={()=>{setError("");setTemplateListOpen(false);setTemplateOpen(true);}} size="sm">Thêm mẫu</Button>:null}</div>
        <ul className="contract-template-list">{templates.map(template=><li key={template.id}><FilePlus2 aria-hidden="true" size={18}/><span><strong>{template.name}</strong><small>{formatBusinessDate(template.createdAt)}</small></span>{template.fileAssetId?<a className="text-link" href={`/api/v1/files/${template.fileAssetId}/signed-url`} rel="noreferrer" target="_blank">Tải mẫu</a>:null}</li>)}</ul>
        {!templates.length?<div className="compact-empty-state">Chưa có mẫu Word</div>:null}
      </div>
    </Drawer>
    <Drawer onClose={()=>{if(!saving)setContractOpen(false);}} open={contractOpen} title="Tạo hợp đồng lao động"><form className={`drawer-form ${contractStyles.form}`} onSubmit={createContract}>
      <div className={contractStyles.fullWidth}><Select label="Nhân viên" name="employeeId" options={(data?.employees??[]).map(employee=>({value:employee.id,label:`${employee.code} · ${employee.name}${employee.departmentName?` · ${employee.departmentName}`:""}`}))} placeholder="Chọn nhân viên" required/></div>
      <Input label="Số hợp đồng" name="contractNumber" required/><Input label="Loại hợp đồng" name="contractType" required/><DatePicker label="Ngày ký" name="signedDate"/><DatePicker label="Ngày hiệu lực" name="effectiveDate" required/><DatePicker label="Ngày hết hạn" name="endDate"/><Select defaultValue="draft" label="Trạng thái" name="status" options={Object.entries(contractStatus).map(([value,label])=>({value,label}))}/>{canUpload&&templates.length?<Select label="Nguồn tài liệu" options={[{value:"manual",label:"Nhập thủ công"},{value:"template",label:"Mẫu Word"}]} value={documentMode} onChange={event=>setDocumentMode(event.target.value)}/>:null}{documentMode==="template"?<Select label="Mẫu Word" name="templateId" options={templates.map(template=>({value:template.id,label:template.name}))} placeholder="Chọn mẫu Word" required/>:canUpload?<Input accept="application/pdf" label="File hợp đồng PDF" name="file" type="file"/>:null}<div className={contractStyles.fullWidth}><Textarea label="Ghi chú" name="note"/></div>
      {error?<p className="form-error" role="alert">{error}</p>:null}<div className="form-actions"><Button disabled={saving} onClick={()=>setContractOpen(false)} type="button">Hủy</Button><Button disabled={saving} type="submit" variant="primary" busy={saving}>{documentMode==="template"?"Tạo và xuất Word":"Tạo hợp đồng"}</Button></div>
    </form></Drawer>
    <Drawer onClose={()=>{if(!saving)setTemplateOpen(false);}} open={templateOpen} title="Thêm mẫu Word"><form className="drawer-form" onSubmit={uploadTemplate}><Input label="Tên mẫu" name="name" required/><Input accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" label="File Word (.docx)" name="file" required type="file"/>{error?<p className="form-error" role="alert">{error}</p>:null}<div className="form-actions"><Button disabled={saving} onClick={()=>setTemplateOpen(false)} type="button">Hủy</Button><Button disabled={saving} type="submit" variant="primary" busy={saving}>{"Lưu mẫu"}</Button></div></form></Drawer>
  </>;
}
