import { cache } from "react";
import { headers } from "next/headers";

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { resolveRequestUser } from "@/services/auth/sessionService";
import { enabledModulePermissions, isErpModuleEnabled, moduleForApiPath } from "@/config/erpModules";
import { AppError } from "@/lib/api/errors";
import { readSettingsGroup } from "@/services/system-settings/systemSettingsService";

export const getRequestUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const user = await resolveRequestUser();
  if (!user) return null;
  const modules = await readSettingsGroup("modules");
  const requestHeaders = await headers();
  const moduleKey = moduleForApiPath(requestHeaders.get("x-dtech-pathname") ?? "");
  if (moduleKey && !isErpModuleEnabled(modules, moduleKey)) {
    throw new AppError("PERMISSION_DENIED", "Module này chưa được bật cho doanh nghiệp.");
  }
  return { ...user, permissions: enabledModulePermissions(user.permissions, modules) };
});
