import { publicReadiness } from "@/features/operations/services/systemHealthService";
export async function GET() { const result=await publicReadiness(); return Response.json(result,{status:result.status==="ready"?200:503,headers:{"cache-control":"no-store"}}); }
