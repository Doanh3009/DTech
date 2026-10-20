import {readdir,readFile} from "node:fs/promises";
import {join} from "node:path";
const directory=join(process.cwd(),"supabase","migrations");
const files=(await readdir(directory)).filter(file=>file.endsWith(".sql")).sort();
const names=new Set(); let previous=""; const errors=[];
for(const file of files){
  const prefix=file.match(/^(\d{12,14})_/i)?.[1];
  if(!prefix)errors.push(`${file}: tên không có timestamp`);
  if(names.has(prefix))errors.push(`${file}: timestamp trùng ${prefix}`); names.add(prefix);
  if(previous&&file.localeCompare(previous)<=0)errors.push(`${file}: thứ tự không tăng`); previous=file;
  const sql=await readFile(join(directory,file),"utf8");
  if(/\bdrop\s+(table|schema|database)\b/i.test(sql)&&!/--\s*destructive-reviewed:/i.test(sql))errors.push(`${file}: câu lệnh DROP phá hủy chưa có destructive-reviewed`);
}
if(errors.length){console.error(errors.join("\n"));process.exit(1);}console.log(`Validated ${files.length} ordered migrations.`);
