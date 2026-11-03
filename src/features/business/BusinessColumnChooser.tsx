"use client";
import {useState} from "react";
import {Columns3} from "lucide-react";
import {Button} from "@/components/shared/Button";
import {Checkbox} from "@/components/shared/FormControls";
import {Drawer} from "@/components/shared/Overlays";
import type {RecordFieldEntry} from "./businessPresentation";
import styles from "./Business.module.css";
export function BusinessColumnChooser({fields,selected,onChange,onReset}:{fields:RecordFieldEntry[];selected:string[];onChange:(fields:string[])=>void;onReset:()=>void}){
 const [open,setOpen]=useState(false);
 return <><Button leftIcon={<Columns3 size={16} aria-hidden="true"/>} onClick={()=>setOpen(true)}>Cột hiển thị</Button><Drawer open={open} title="Cột hiển thị" onClose={()=>setOpen(false)} footer={<div className={styles.recordFooter}><Button onClick={onReset}>Khôi phục mặc định</Button><Button variant="primary" onClick={()=>setOpen(false)}>Xong</Button></div>}><div className={styles.columnOptions}>{fields.map(([key,field])=><Checkbox key={key} label={field.label} checked={selected.includes(key)} onChange={event=>onChange(event.target.checked?[...selected,key]:selected.filter(value=>value!==key))}/>)}</div></Drawer></>;
}
