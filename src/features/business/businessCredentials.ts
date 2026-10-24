import "server-only";
import {createHmac,randomBytes,scrypt,timingSafeEqual} from "node:crypto";
import {AppError} from "@/lib/api/errors";
function pepper(){const p=process.env.SESSION_HASH_PEPPER;if(!p||p.length<32)throw new AppError("SERVER_ERROR","Khóa bảo vệ đăng nhập chưa được cấu hình.");return p;}
export function businessHash(domain:string,value:string){return createHmac("sha256",pepper()).update(`dtech:business:v1:${domain}:`).update(value).digest("hex");}
export function initialBusinessPassword(requestId:string){return `Dt!${businessHash("initial-password",requestId).slice(0,24)}9a`;}
function derive(password:string,salt:string):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(password,Buffer.from(salt,"hex"),64,{N:65536,r:8,p:2,maxmem:128*1024*1024},(err,key)=>err?reject(err):resolve(key)));}
export async function hashBusinessPassword(password:string,salt=randomBytes(16).toString("hex")){const key=await derive(password,salt);return `scrypt$65536$8$2$${salt}$${key.toString("hex")}`;}
export async function verifyBusinessPassword(password:string,encoded:string){const m=/^scrypt\$65536\$8\$2\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);if(!m)return false;const derived=await derive(password,m[1]);return timingSafeEqual(derived,Buffer.from(m[2],"hex"));}
export const businessSessionCookie="dtech_business_session";
export function newBusinessToken(){return randomBytes(32).toString("base64url");}
