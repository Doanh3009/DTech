import type { Instrumentation } from "next";
import { errorFingerprint, logger } from "@/lib/logger";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest=typeof error==="object"&&error!==null&&"digest" in error?String(error.digest):undefined;
  logger.error("next.request_error",{route:new URL(request.path,"http://internal").pathname,method:request.method,errorCode:digest||errorFingerprint(error),metadata:{routerKind:context.routerKind,routeType:context.routeType,renderSource:context.renderSource}});
};
