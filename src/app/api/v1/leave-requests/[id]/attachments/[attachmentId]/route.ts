import { getLeaveAttachmentAsset } from "@/features/leave/services/leaveRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { NextResponse } from "next/server";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;attachmentId:string}>}){try{const user=requireAuthenticatedUser(await getRequestUser());const value=await params;const asset=await getLeaveAttachmentAsset(user,value.id,value.attachmentId);const {data,error}=await getSupabaseServiceClient()!.storage.from(asset.bucket).createSignedUrl(asset.path,300);if(error||!data.signedUrl)throw new AppError("SERVER_ERROR","Không thể mở tệp.");return NextResponse.redirect(data.signedUrl,307);}catch(error){return errorResponse(error);}}
