# Error codes

`VALIDATION_ERROR` 400; `AUTHENTICATION_REQUIRED`, `INVALID_CREDENTIALS`, `SESSION_EXPIRED` 401; `PERMISSION_DENIED`, `ACCOUNT_DISABLED`, `ACCOUNT_NOT_PROVISIONED` 403; `NOT_FOUND` 404; `CONFLICT`, `DUPLICATE` 409; location/photo validation 422; `RATE_LIMITED` 429; `NETWORK_ERROR` 503; `SERVER_ERROR` 500.

API errors include `error.requestId` and `x-request-id`. Support searches structured logs using request ID/release SHA/time; UI must not display stack, Supabase errors, signed URLs or raw request bodies.
