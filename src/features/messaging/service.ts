import"server-only";import type{SupabaseClient}from"@supabase/supabase-js";import type{z}from"zod";import{AppError}from"@/lib/api/errors";import{can,type AuthenticatedUser}from"@/lib/auth/permissions";import{safeUploadName,validateUploadedFile}from"@/lib/security/filePolicy";import{getSupabaseServiceClient}from"@/lib/supabase/server";import{recordAuditLog}from"@/services/audit/auditLog";import type{conversationCreateSchema,messageCreateSchema}from"./schemas";import type{ChatMessage,ConversationSummary,MessageAttachment}from"./types";
type Row=Record<string,unknown>;function db(){const client=getSupabaseServiceClient();if(!client)throw new AppError("SERVER_ERROR","Supabase chưa được cấu hình.");return client;}function requireChat(user:AuthenticatedUser){if(!can(user.permissions,"chat.access"))throw new AppError("PERMISSION_DENIED");}async function account(client:SupabaseClient,user:AuthenticatedUser){let query=client.from("app_accounts").select("id,display_name").limit(1);query=/^[0-9a-f-]{36}$/i.test(user.id)?query.eq("id",user.id):query.eq("primary_email",user.email);const{data}=await query.maybeSingle();if(!data?.id)throw new AppError("PERMISSION_DENIED","Không tìm thấy tài khoản vận hành.");return{id:String(data.id),name:String(data.display_name)};}async function membership(client:SupabaseClient,conversationId:string,accountId:string){const{data}=await client.from("conversation_members").select("conversation_id,last_read_at").eq("conversation_id",conversationId).eq("account_id",accountId).is("left_at",null).maybeSingle();if(!data)throw new AppError("NOT_FOUND","Không tìm thấy hội thoại.");return data;}
export async function listChatAccounts(user:AuthenticatedUser){
  requireChat(user);
  const client=db(),self=await account(client,user),accounts:Row[]=[];
  const pageSize=500;
  for(let offset=0;;offset+=pageSize){
    const{data,error}=await client.from("app_accounts").select("id,display_name,employee_id").eq("status","active").neq("id",self.id).order("display_name").order("id").range(offset,offset+pageSize-1);
    if(error)throw new AppError("SERVER_ERROR","Không thể đọc danh sách người dùng.");
    accounts.push(...((data??[])as Row[]));
    if((data??[]).length<pageSize)break;
  }
  const employeeIds=[...new Set(accounts.map(item=>item.employee_id).filter((id):id is string=>typeof id==="string"&&Boolean(id)))];
  const employees=new Map<string,Row>();
  for(let offset=0;offset<employeeIds.length;offset+=pageSize){
    const{data,error}=await client.from("employees").select("id,employee_code,full_name,department_id").in("id",employeeIds.slice(offset,offset+pageSize));
    if(error)throw new AppError("SERVER_ERROR","Không thể đọc hồ sơ nhân viên trong danh bạ.");
    for(const row of data??[])employees.set(String(row.id),row as Row);
  }
  const departmentIds=[...new Set([...employees.values()].map(item=>item.department_id).filter((id):id is string=>typeof id==="string"&&Boolean(id)))];
  const departments=new Map<string,string>();
  for(let offset=0;offset<departmentIds.length;offset+=pageSize){
    const{data,error}=await client.from("departments").select("id,name").in("id",departmentIds.slice(offset,offset+pageSize));
    if(error)throw new AppError("SERVER_ERROR","Không thể đọc phòng ban trong danh bạ.");
    for(const row of data??[])departments.set(String(row.id),String(row.name));
  }
  return accounts.map(item=>{
    const person=item.employee_id?employees.get(String(item.employee_id)):undefined;
    return{id:String(item.id),name:String(person?.full_name??item.display_name),employeeCode:person?.employee_code?String(person.employee_code):undefined,department:person?.department_id?departments.get(String(person.department_id)):undefined,roleLabel:person?undefined:"Tài khoản hệ thống"};
  });
}
export async function listConversations(user:AuthenticatedUser):Promise<ConversationSummary[]>{requireChat(user);const client=db(),self=await account(client,user);const{data:summaries,error}=await client.rpc("list_conversation_summaries",{p_account_id:self.id});if(error)throw new AppError("SERVER_ERROR","Không thể đọc hội thoại.");const rows=(summaries??[])as Row[],ids=rows.map((item)=>String(item.conversation_id));if(!ids.length)return[];const{data:members,error:memberError}=await client.from("conversation_members").select("conversation_id,account_id,app_accounts(display_name)").in("conversation_id",ids).is("left_at",null);if(memberError)throw new AppError("SERVER_ERROR","Không thể đọc thành viên hội thoại.");return rows.map((item)=>{const related=(members??[]).filter(value=>value.conversation_id===item.conversation_id),people=related.map(value=>{const rawAccount=value.app_accounts as Row|Row[]|null,profile=(Array.isArray(rawAccount)?rawAccount[0]:rawAccount)as Row;return{accountId:String(value.account_id),name:String(profile?.display_name??"Người dùng")};});return{id:String(item.conversation_id),type:item.conversation_type as"direct"|"group",title:item.conversation_type==="group"?String(item.conversation_title):people.find(person=>person.accountId!==self.id)?.name??"Hội thoại",updatedAt:String(item.conversation_updated_at),unreadCount:Number(item.unread_count),lastMessage:item.last_created_at?{body:String(item.last_body),senderName:String(item.last_sender_name??"Người dùng"),createdAt:String(item.last_created_at)}:undefined,members:people};});}
export async function createConversation(user:AuthenticatedUser,input:z.infer<typeof conversationCreateSchema>){requireChat(user);const client=db(),self=await account(client,user);if(input.type==="group"&&!can(user.permissions,"chat.group.create"))throw new AppError("PERMISSION_DENIED");const memberIds=input.type==="direct"?[self.id,input.accountId]:[self.id,...input.accountIds];const unique=[...new Set(memberIds)];if(unique.length<2)throw new AppError("VALIDATION_ERROR","Cần chọn thành viên khác.");const directKey=input.type==="direct"?[self.id,input.accountId].sort().join(":"):null;if(directKey){const{data:existing}=await client.from("conversations").select("id").eq("direct_key",directKey).maybeSingle();if(existing)return{id:String(existing.id)};}const{data:conversation,error}=await client.from("conversations").insert({type:input.type,title:input.type==="group"?input.title:null,direct_key:directKey,created_by:self.id}).select("id").single();if(error||!conversation){if(directKey){const{data:existing}=await client.from("conversations").select("id").eq("direct_key",directKey).maybeSingle();if(existing)return{id:String(existing.id)};}throw new AppError("SERVER_ERROR","Không thể tạo hội thoại.");}const{error:memberError}=await client.from("conversation_members").insert(unique.map(id=>({conversation_id:conversation.id,account_id:id,role:id===self.id?"owner":"member"})));if(memberError){await client.from("conversations").delete().eq("id",conversation.id);throw new AppError("SERVER_ERROR","Không thể thêm thành viên.");}await recordAuditLog({actorId:self.id,action:"chat.conversation_created",entityType:"conversation",entityId:String(conversation.id),metadata:{type:input.type,memberCount:unique.length}});return{id:String(conversation.id)};}
function messageAttachments(row:Row):MessageAttachment[]{const raw=row.message_attachments,links=(Array.isArray(raw)?raw:[])as Row[];return links.map(link=>{const value=link.file_assets,file=(Array.isArray(value)?value[0]:value)as Row|undefined,metadata=(file?.metadata??{})as Row;return{id:String(link.id),fileName:String(metadata.originalName??"Tệp đính kèm"),mimeType:String(file?.mime_type??"application/octet-stream"),sizeBytes:Number(file?.byte_size??0)};});}
export async function listMessages(user:AuthenticatedUser,conversationId:string,cursor?:string,limit=50){
  requireChat(user);
  const client=db(),self=await account(client,user);
  await membership(client,conversationId,self.id);
  let query=client.from("messages").select("*,app_accounts(display_name),message_attachments(id,file_assets(mime_type,byte_size,metadata))")
    .eq("conversation_id",conversationId).is("deleted_at",null).order("created_at",{ascending:false}).limit(limit+1);
  if(cursor)query=query.lt("created_at",cursor);
  const embedded=await query;
  let data:Row[]=(embedded.data??[]) as Row[];
  if(embedded.error){
    // A stale PostgREST relationship cache must not make the message body unreadable.
    let baseQuery=client.from("messages").select("id,conversation_id,sender_account_id,body,reply_to_id,created_at,edited_at,metadata")
      .eq("conversation_id",conversationId).is("deleted_at",null).order("created_at",{ascending:false}).limit(limit+1);
    if(cursor)baseQuery=baseQuery.lt("created_at",cursor);
    const base=await baseQuery;
    if(base.error)throw new AppError("SERVER_ERROR","Không thể đọc tin nhắn.");
    data=(base.data??[]) as Row[];
    const accountIds=[...new Set(data.map(row=>String(row.sender_account_id)))];
    const messageIds=data.map(row=>String(row.id));
    const [accounts,attachments]=await Promise.all([
      accountIds.length?client.from("app_accounts").select("id,display_name").in("id",accountIds):Promise.resolve({data:[],error:null}),
      messageIds.length?client.from("message_attachments").select("id,message_id,file_id").in("message_id",messageIds):Promise.resolve({data:[],error:null})
    ]);
    if(accounts.error||attachments.error)throw new AppError("SERVER_ERROR","Không thể đọc chi tiết tin nhắn.");
    const fileIds=[...new Set((attachments.data??[]).map(row=>String(row.file_id)))];
    const files=fileIds.length?await client.from("file_assets").select("id,mime_type,byte_size,metadata").in("id",fileIds):{data:[],error:null};
    if(files.error)throw new AppError("SERVER_ERROR","Không thể đọc tệp đính kèm.");
    const accountById=new Map((accounts.data??[]).map(row=>[String(row.id),row]));
    const fileById=new Map((files.data??[]).map(row=>[String(row.id),row]));
    data=data.map(row=>({
      ...row,
      app_accounts:accountById.get(String(row.sender_account_id))??null,
      message_attachments:(attachments.data??[]).filter(link=>link.message_id===row.id)
        .map(link=>({...link,file_assets:fileById.get(String(link.file_id))??null}))
    }));
  }
  const hasMore=data.length>limit,rows=data.slice(0,limit).reverse();
  return{items:rows.map(row=>{
    const raw=row.app_accounts as Row|Row[]|null,profile=(Array.isArray(raw)?raw[0]:raw) as Row;
    const metadata=(row.metadata??{}) as Row;
    return{id:String(row.id),conversationId:String(row.conversation_id),senderAccountId:String(row.sender_account_id),senderName:String(profile?.display_name??"Người dùng"),body:String(row.body),replyToId:row.reply_to_id?String(row.reply_to_id):undefined,createdAt:String(row.created_at),editedAt:row.edited_at?String(row.edited_at):undefined,attachments:messageAttachments(row),metadata:metadata.payslipId?{payslipId:String(metadata.payslipId),payslipPeriod:metadata.payslipPeriod?String(metadata.payslipPeriod):undefined}:undefined} satisfies ChatMessage;
  }),nextCursor:hasMore?String(data[limit-1].created_at):undefined,selfAccountId:self.id};
}
export async function sendMessage(user:AuthenticatedUser,conversationId:string,input:z.infer<typeof messageCreateSchema>,file?:File){
  requireChat(user);
  const client=db(),self=await account(client,user);
  await membership(client,conversationId,self.id);
  if(input.replyToId){
    const{data:reply}=await client.from("messages").select("id").eq("id",input.replyToId).eq("conversation_id",conversationId).maybeSingle();
    if(!reply)throw new AppError("VALIDATION_ERROR","Tin nhắn trả lời không thuộc hội thoại.");
  }
  const{data,error}=await client.from("messages").insert({conversation_id:conversationId,sender_account_id:self.id,body:input.body,reply_to_id:input.replyToId??null,metadata:file?{deliveryState:"uploading"}:{deliveryState:"sent"}}).select("id,created_at").single();
  if(error||!data)throw new AppError("SERVER_ERROR","Không thể gửi tin nhắn.");
  let attachment:MessageAttachment|undefined;
  try{
    if(file)attachment=await uploadMessageAttachment(user,conversationId,String(data.id),file);
    const{error:finalizeError}=await client.from("messages").update({metadata:{deliveryState:"sent"}}).eq("id",data.id);
    if(finalizeError)throw new AppError("SERVER_ERROR","Không thể hoàn tất tin nhắn.");
    await client.from("conversations").update({updated_at:data.created_at}).eq("id",conversationId);
  }catch(reason){
    const{data:links}=await client.from("message_attachments").select("id,file_id,file_assets(bucket,object_path)").eq("message_id",data.id);
    for(const link of links??[]){
      const raw=link.file_assets,fileAsset=(Array.isArray(raw)?raw[0]:raw)as Row|undefined;
      if(fileAsset?.bucket&&fileAsset?.object_path)await client.storage.from(String(fileAsset.bucket)).remove([String(fileAsset.object_path)]);
      if(link.file_id)await client.from("file_assets").delete().eq("id",link.file_id);
    }
    await client.from("messages").delete().eq("id",data.id);
    throw reason;
  }
  return{id:String(data.id),createdAt:String(data.created_at),attachment};
}export async function uploadMessageAttachment(user:AuthenticatedUser,conversationId:string,messageId:string,file:File){requireChat(user);const client=db(),self=await account(client,user);await membership(client,conversationId,self.id);const{data:message,error:messageError}=await client.from("messages").select("id,sender_account_id").eq("id",messageId).eq("conversation_id",conversationId).is("deleted_at",null).maybeSingle();if(messageError||!message)throw new AppError("NOT_FOUND","Không tìm thấy tin nhắn.");if(String(message.sender_account_id)!==self.id)throw new AppError("PERMISSION_DENIED","Chỉ người gửi mới được thêm tệp vào tin nhắn.");const allowed=["image/jpeg","image/png","image/webp","application/pdf"] as const,bytes=await validateUploadedFile(file,{allowedMimeTypes:allowed,maxBytes:15*1024*1024}),assetId=crypto.randomUUID(),attachmentId=crypto.randomUUID(),path=`${conversationId}/${messageId}/${assetId}-${safeUploadName(file.name,"attachment")}`;const{error:uploadError}=await client.storage.from("message-attachments").upload(path,bytes,{contentType:file.type,upsert:false});if(uploadError)throw new AppError("SERVER_ERROR","Không thể tải tệp đính kèm.");const{error:assetError}=await client.from("file_assets").insert({id:assetId,bucket:"message-attachments",object_path:path,owner_entity_type:"message",owner_entity_id:messageId,mime_type:file.type,byte_size:file.size,visibility:"private",created_by:self.id,metadata:{originalName:file.name}});if(assetError){await client.storage.from("message-attachments").remove([path]);throw new AppError("SERVER_ERROR","Không thể lưu tệp đính kèm.");}const{error:linkError}=await client.from("message_attachments").insert({id:attachmentId,conversation_id:conversationId,message_id:messageId,file_id:assetId});if(linkError){await client.from("file_assets").delete().eq("id",assetId);await client.storage.from("message-attachments").remove([path]);throw new AppError("SERVER_ERROR","Không thể gắn tệp vào tin nhắn.");}await recordAuditLog({actorId:self.id,action:"chat.attachment_added",entityType:"message",entityId:messageId,metadata:{attachmentId,fileId:assetId,mimeType:file.type}});return{id:attachmentId,fileName:file.name,mimeType:file.type,sizeBytes:file.size};}
export async function getMessageAttachmentAsset(user:AuthenticatedUser,conversationId:string,attachmentId:string){requireChat(user);const client=db(),self=await account(client,user);await membership(client,conversationId,self.id);const{data,error}=await client.from("message_attachments").select("id,messages!inner(deleted_at),file_assets(bucket,object_path,metadata)").eq("id",attachmentId).eq("conversation_id",conversationId).is("messages.deleted_at",null).maybeSingle();if(error||!data)throw new AppError("NOT_FOUND","Không tìm thấy tệp đính kèm.");const raw=data.file_assets,file=(Array.isArray(raw)?raw[0]:raw)as Row|undefined;if(!file)throw new AppError("NOT_FOUND","Không tìm thấy tệp đính kèm.");const metadata=(file.metadata??{})as Row;return{bucket:String(file.bucket),path:String(file.object_path),fileName:String(metadata.originalName??"attachment")};}
export async function markConversationRead(user:AuthenticatedUser,conversationId:string){requireChat(user);const client=db(),self=await account(client,user);await membership(client,conversationId,self.id);const now=new Date().toISOString();await client.from("conversation_members").update({last_read_at:now}).eq("conversation_id",conversationId).eq("account_id",self.id);const{data:latest}=await client.from("messages").select("id").eq("conversation_id",conversationId).is("deleted_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();if(latest)await client.from("message_reads").upsert({message_id:latest.id,account_id:self.id,read_at:now});return{readAt:now};}
export async function unreadMessageCount(user:AuthenticatedUser){
  requireChat(user);
  const client=db();
  const accountId=/^[0-9a-f-]{36}$/i.test(user.id)&&user.status==="active"?user.id:(await account(client,user)).id;
  const{data,error}=await client.rpc("list_conversation_summaries",{p_account_id:accountId});
  if(error)throw new AppError("SERVER_ERROR","Không thể đọc số tin nhắn chưa đọc.");
  return((data??[]) as Row[]).reduce((sum,row)=>sum+Number(row.unread_count??0),0);
}
