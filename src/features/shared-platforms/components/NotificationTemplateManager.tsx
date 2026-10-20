"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback,useEffect,useState } from "react";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input,Textarea } from "@/components/shared/FormControls";

interface Template{id:string;event_key:string;title_template:string;message_template:string;allowed_placeholders:string[];mandatory:boolean;version:number}

export function NotificationTemplateManager(){
  const[items,setItems]=useState<Template[]>([]),[result,setResult]=useState("");
  const load=useCallback(async()=>{const response=await fetch("/api/v1/notification-templates");if(!response.ok)return;const body=await response.json() as{data?:Template[]};setItems(body.data??[]);},[]);
  useEffect(()=>{void load();},[load]);
  function change(id:string,field:"title_template"|"message_template",value:string){setItems(current=>current.map(item=>item.id===id?{...item,[field]:value}:item));}
  async function save(item:Template){const response=await fetch(`/api/v1/notification-templates/${encodeURIComponent(item.event_key)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({titleTemplate:item.title_template,messageTemplate:item.message_template})}),body=await response.json() as{error?:{message:string}};setResult(response.ok?`Đã lưu ${item.event_key}.`:body.error?.message??"Không thể lưu mẫu.");if(response.ok)await load();}
  if(!items.length)return null;
  return <Card><h2>Mẫu thông báo</h2><div className="template-list">{items.map(item=><article className="template-editor" key={item.id}><div className="template-editor__heading"><strong>{item.event_key}</strong><span>v{item.version}</span></div><Input label="Tiêu đề" value={item.title_template} onChange={event=>change(item.id,"title_template",event.target.value)}/><Textarea label="Nội dung" value={item.message_template} onChange={event=>change(item.id,"message_template",event.target.value)}/><div className="template-editor__footer"><code>{item.allowed_placeholders.map(value=>`{{${value}}}`).join(" · ")}</code><Button onClick={()=>void save(item)}>Lưu mẫu</Button></div></article>)}</div>{result?<p role="status">{result}</p>:null}</Card>;
}
