import {z} from "zod";
import {errorResponse} from "@/lib/api/errors";
import {parseWithSchema} from "@/lib/api/validation";
import {successResponse} from "@/lib/api/responses";
import {readTrialBody} from "@/features/marketing/trialRequestService";
import {importCommitSchema,importKindSchema} from "@/features/business/businessImport";
import {authorizeBusinessImport,commitBusinessImport,historyBusinessImport,previewBusinessImport,readImportUpload,templateBusinessImport} from "@/features/business/businessImportService";
type Context={params:Promise<{slug:string;kind:string}>};
export async function GET(request:Request,{params}:Context){try{
 const {slug,kind:raw}=await params,kind=parseWithSchema(importKindSchema,raw),query=parseWithSchema(z.object({view:z.enum(["template","history"])}).strict(),Object.fromEntries(new URL(request.url).searchParams));
 if(query.view==="history")return successResponse(await historyBusinessImport(slug,kind),{headers:{"cache-control":"private, no-store"}});
 return new Response(await templateBusinessImport(slug,kind),{headers:{"content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","content-disposition":`attachment; filename="${kind}-template.xlsx"`,"cache-control":"private, no-store"}});
}catch(error){return errorResponse(error);}}
export async function POST(request:Request,{params}:Context){try{
 const {slug,kind:raw}=await params,kind=parseWithSchema(importKindSchema,raw);
 await authorizeBusinessImport(slug,kind);
 const result=request.headers.get("content-type")?.startsWith("multipart/form-data")?await previewBusinessImport(slug,kind,await readImportUpload(request)):await commitBusinessImport(slug,kind,parseWithSchema(importCommitSchema,await readTrialBody(request,1000000)));
 return successResponse(result,{headers:{"cache-control":"private, no-store"}});
}catch(error){return errorResponse(error);}}
