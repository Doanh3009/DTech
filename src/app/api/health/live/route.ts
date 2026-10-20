export function GET() { return Response.json({status:"alive",checkedAt:new Date().toISOString()},{headers:{"cache-control":"no-store"}}); }
