import{z}from"zod";import{messageCreateSchema,messageQuerySchema}from"@/features/messaging/schemas";import{listMessages,sendMessage}from"@/features/messaging/service";import{AppError,errorResponse}from"@/lib/api/errors";import{successResponse}from"@/lib/api/responses";import{parseJsonBody,parseWithSchema}from"@/lib/api/validation";import{getRequestUser}from"@/services/auth/getRequestUser";import{requireAuthenticatedUser}from"@/services/authorization/requirePermission";const params=z.object({id:z.string().uuid()});
export async function GET(request:Request,context:RouteContext<"/api/v1/chat/conversations/[id]/messages">){try{const{id}=parseWithSchema(params,await context.params),query=parseWithSchema(messageQuerySchema,Object.fromEntries(new URL(request.url).searchParams));return successResponse(await listMessages(requireAuthenticatedUser(await getRequestUser()),id,query.cursor,query.limit));}catch(error){return errorResponse(error);}}
export async function POST(request:Request,context:RouteContext<"/api/v1/chat/conversations/[id]/messages">){
  try{
    const{id}=parseWithSchema(params,await context.params),user=requireAuthenticatedUser(await getRequestUser());
    if(request.headers.get("content-type")?.includes("multipart/form-data")){
      const form=await request.formData(),rawFile=form.get("file"),file=rawFile instanceof File&&rawFile.size>0?rawFile:undefined;
      if(rawFile!==null&&rawFile!==""&&!(rawFile instanceof File))throw new AppError("VALIDATION_ERROR","Tệp đính kèm không hợp lệ.");
      const input=parseWithSchema(messageCreateSchema,{body:form.get("body"),replyToId:form.get("replyToId")||undefined});
      return successResponse(await sendMessage(user,id,input,file),{status:201});
    }
    return successResponse(await sendMessage(user,id,await parseJsonBody(request,messageCreateSchema)),{status:201});
  }catch(error){return errorResponse(error);}
}
