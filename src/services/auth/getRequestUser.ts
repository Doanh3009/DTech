import { cache } from "react";

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { resolveRequestUser } from "@/services/auth/sessionService";

export const getRequestUser = cache(async (): Promise<AuthenticatedUser | null> => resolveRequestUser());
