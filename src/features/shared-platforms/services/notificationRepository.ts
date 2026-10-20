import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { eventCategory, renderTemplate, validateTemplate } from "@/features/shared-platforms/rules";
import type { notificationTemplateSchema } from "@/features/shared-platforms/schemas";
import type { AppNotification } from "@/features/shared-platforms/types";
import { resolvePlatformIdentity } from "./platformIdentity";
import { recordAuditLog } from "@/services/audit/auditLog";

type Row = Record<string, unknown>;
const mandatoryCategories = new Set(["security", "system"]);
function db(){const client=getSupabaseServiceClient();if(!client)throw new AppError("SERVER_ERROR","Supabase chưa được cấu hình.");return client;}
function text(row:Row,key:string){const value=row[key];return typeof value==="string"&&value?value:undefined;}
function mapNotification(row:Row):AppNotification{return{id:String(row.id),eventKey:String(row.event_key),type:String(row.type),title:String(row.title),message:String(row.message),entityType:text(row,"entity_type"),entityId:text(row,"entity_id"),deepLink:text(row,"deep_link"),priority:row.priority as AppNotification["priority"],readAt:text(row,"read_at"),createdAt:String(row.created_at)};}

export async function listNotifications(user:AuthenticatedUser,options:{unreadOnly?:boolean;limit?:number}={}){
  if(!can(user.permissions,"notification.self.view")&&!can(user.permissions,"notification.view"))throw new AppError("PERMISSION_DENIED");
  const client=db(),actor=await resolvePlatformIdentity(client,user);let query=client.from("notifications").select("*").eq("recipient_account_id",actor.accountId).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("created_at",{ascending:false}).limit(Math.min(options.limit??50,100));if(options.unreadOnly)query=query.is("read_at",null);const{data,error}=await query;if(error)throw new AppError("SERVER_ERROR","Không thể đọc thông báo.");return(data??[]).map(row=>mapNotification(row as Row));
}
export async function unreadNotificationCount(user:AuthenticatedUser){
  if(!can(user.permissions,"notification.self.view")&&!can(user.permissions,"notification.view"))throw new AppError("PERMISSION_DENIED");
  const client=db();
  const accountId=/^[0-9a-f-]{36}$/i.test(user.id)&&user.status==="active"?user.id:(await resolvePlatformIdentity(client,user)).accountId;
  const{count,error}=await client.from("notifications").select("id",{count:"exact",head:true}).eq("recipient_account_id",accountId).is("read_at",null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  if(error)throw new AppError("SERVER_ERROR");
  return count??0;
}
export async function markNotificationRead(user:AuthenticatedUser,id:string){const client=db(),actor=await resolvePlatformIdentity(client,user);const{data,error}=await client.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("recipient_account_id",actor.accountId).is("read_at",null).select("id").maybeSingle();if(error)throw new AppError("SERVER_ERROR");return{id:data?.id??id};}
export async function markAllNotificationsRead(user:AuthenticatedUser){const client=db(),actor=await resolvePlatformIdentity(client,user);const{error}=await client.from("notifications").update({read_at:new Date().toISOString()}).eq("recipient_account_id",actor.accountId).is("read_at",null);if(error)throw new AppError("SERVER_ERROR");return{updated:true};}

export async function getNotificationPreferences(user:AuthenticatedUser){const client=db(),actor=await resolvePlatformIdentity(client,user);const{data,error}=await client.from("notification_preferences").select("category,in_app_enabled").eq("account_id",actor.accountId);if(error)throw new AppError("SERVER_ERROR");return{categories:Object.fromEntries(["project","approval","shipment","warehouse","document"].map(category=>[category,(data??[]).find(item=>item.category===category)?.in_app_enabled??true])),mandatory:["security","system"]};}
export async function updateNotificationPreferences(user:AuthenticatedUser,categories:Record<string,boolean>){if(!can(user.permissions,"notification.preference.manage"))throw new AppError("PERMISSION_DENIED");const client=db(),actor=await resolvePlatformIdentity(client,user);const rows=Object.entries(categories).filter(([category])=>!mandatoryCategories.has(category)).map(([category,enabled])=>({account_id:actor.accountId,category,in_app_enabled:enabled,updated_at:new Date().toISOString()}));if(rows.length){const{error}=await client.from("notification_preferences").upsert(rows,{onConflict:"account_id,category"});if(error)throw new AppError("SERVER_ERROR","Không thể lưu tùy chọn.");}await recordAuditLog({actorId:actor.accountId,action:"notification.preferences_updated",entityType:"notification_preferences",entityId:actor.accountId,after:{categories}});return getNotificationPreferences(user);}

export async function listNotificationTemplates(user:AuthenticatedUser){
  if(!can(user.permissions,"notification.system_notice.manage"))throw new AppError("PERMISSION_DENIED");
  const{data,error}=await db().from("notification_templates").select("id,event_key,title_template,message_template,allowed_placeholders,mandatory,active,version,updated_at").order("event_key");
  if(error)throw new AppError("SERVER_ERROR","Không thể đọc mẫu thông báo.");return data??[];
}

export async function updateNotificationTemplate(user:AuthenticatedUser,eventKey:string,input:z.infer<typeof notificationTemplateSchema>){
  if(!can(user.permissions,"notification.system_notice.manage"))throw new AppError("PERMISSION_DENIED");
  const client=db(),actor=await resolvePlatformIdentity(client,user),{data:before,error:readError}=await client.from("notification_templates").select("*").eq("event_key",eventKey).maybeSingle();
  if(readError)throw new AppError("SERVER_ERROR");if(!before)throw new AppError("NOT_FOUND","Không tìm thấy mẫu thông báo.");
  const allowed=before.allowed_placeholders as string[],errors=[...validateTemplate(input.titleTemplate,allowed),...validateTemplate(input.messageTemplate,allowed)];
  if(errors.length)throw new AppError("VALIDATION_ERROR",errors[0]);
  const after={title_template:input.titleTemplate,message_template:input.messageTemplate,version:Number(before.version)+1,updated_by:actor.accountId};
  const{data,error}=await client.from("notification_templates").update(after).eq("id",before.id).select("id,event_key,title_template,message_template,allowed_placeholders,mandatory,active,version,updated_at").single();
  if(error||!data)throw new AppError("SERVER_ERROR","Không thể lưu mẫu thông báo.");
  await recordAuditLog({actorId:actor.accountId,action:"notification.template_updated",entityType:"notification_template",entityId:before.id,before:{titleTemplate:before.title_template,messageTemplate:before.message_template,version:before.version},after:{titleTemplate:input.titleTemplate,messageTemplate:input.messageTemplate,version:after.version}});return data;
}

export async function publishNotificationEvent(input:{eventKey:string;aggregateType:string;aggregateId:string;actorAccountId?:string;correlationId?:string;idempotencyKey:string;recipients:string[];values:Record<string,string>;deepLink?:string;priority?:AppNotification["priority"]},client?:SupabaseClient){
  const database=client??db();const{data:event,error:eventError}=await database.from("domain_events").upsert({event_key:input.eventKey,aggregate_type:input.aggregateType,aggregate_id:input.aggregateId,actor_account_id:input.actorAccountId??null,correlation_id:input.correlationId??crypto.randomUUID(),payload:input.values,idempotency_key:input.idempotencyKey},{onConflict:"idempotency_key",ignoreDuplicates:false}).select("id").single();if(eventError||!event)throw new AppError("SERVER_ERROR","Không thể ghi nhận sự kiện.");
  const{data:template,error:templateError}=await database.from("notification_templates").select("*").eq("event_key",input.eventKey).eq("active",true).maybeSingle();if(templateError)throw new AppError("SERVER_ERROR","Không thể đọc mẫu thông báo.");if(!template){const{error:processedError}=await database.from("domain_events").update({processed_at:new Date().toISOString()}).eq("id",event.id);if(processedError)throw new AppError("SERVER_ERROR","Không thể hoàn tất sự kiện thông báo.");return{eventId:event.id,created:0};}const allowed=template.allowed_placeholders as string[];const errors=[...validateTemplate(template.title_template,allowed),...validateTemplate(template.message_template,allowed)];if(errors.length)throw new AppError("VALIDATION_ERROR",errors[0]);const category=eventCategory(input.eventKey);let created=0;
  for(const recipient of [...new Set(input.recipients)]){const{data:preference,error:preferenceError}=await database.from("notification_preferences").select("in_app_enabled").eq("account_id",recipient).eq("category",category).maybeSingle();if(preferenceError)throw new AppError("SERVER_ERROR","Không thể đọc tùy chọn thông báo.");if(!template.mandatory&&preference?.in_app_enabled===false)continue;const deliveryKey=`${input.idempotencyKey}:${recipient}:${template.id}:in_app`;const{data:notification,error}=await database.from("notifications").upsert({recipient_account_id:recipient,event_id:event.id,event_key:input.eventKey,type:input.eventKey.toUpperCase().replaceAll(".","_"),title:renderTemplate(template.title_template,input.values),message:renderTemplate(template.message_template,input.values),entity_type:input.aggregateType,entity_id:input.aggregateId,deep_link:input.deepLink??null,priority:input.priority??"normal",template_version:template.version,delivery_key:deliveryKey},{onConflict:"delivery_key",ignoreDuplicates:true}).select("id").maybeSingle();if(error)throw new AppError("SERVER_ERROR","Không thể tạo thông báo.");if(notification)created++;}
  const{error:processedError}=await database.from("domain_events").update({processed_at:new Date().toISOString()}).eq("id",event.id);if(processedError)throw new AppError("SERVER_ERROR","Không thể hoàn tất sự kiện thông báo.");return{eventId:event.id,created};
}
