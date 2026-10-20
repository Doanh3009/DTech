import {NextResponse} from "next/server";import {z} from "zod";
import {errorResponse} from "@/lib/api/errors";import {parseJsonBody} from "@/lib/api/validation";
import {ACCOUNT_PASSWORD_MESSAGE,ACCOUNT_PASSWORD_PATTERN} from "@/lib/auth/passwordPolicy";
import {changeCurrentPassword,clearSessionCookies} from "@/services/auth/sessionService";
const password=z.string().regex(ACCOUNT_PASSWORD_PATTERN,ACCOUNT_PASSWORD_MESSAGE);
const schema=z.object({currentPassword:password,newPassword:password}).strict().refine(value=>value.currentPassword!==value.newPassword,{message:"Mật khẩu mới phải khác mật khẩu hiện tại.",path:["newPassword"]});
export async function POST(request:Request){try{const input=await parseJsonBody(request,schema);await changeCurrentPassword(input.currentPassword,input.newPassword);const response=NextResponse.json({ok:true,data:null},{headers:{"cache-control":"no-store"}});clearSessionCookies(response.cookies);return response;}catch(error){return errorResponse(error);}}
