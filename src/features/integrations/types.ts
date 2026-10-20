export const externalApiScopes = ["employees.read","employee_sensitive.read","attendance.read","attendance.write","timesheets.read","projects.read","warehouse.read","warehouse.write","shipments.read","shipments.write","reports.read"] as const;
export type ExternalApiScope=(typeof externalApiScopes)[number];
export type IntegrationStatus="not_configured"|"connected"|"degraded"|"error"|"disabled";
export type DeliveryStatus="pending"|"delivering"|"retry_scheduled"|"delivered"|"failed"|"dead_letter";
export interface ExternalPrincipal{apiKeyId:string;serviceAccountId:string;serviceAccountName:string;scopes:ExternalApiScope[];rateLimitPerMinute:number;rateLimitRemaining:number;rateLimitResetAt:string;requestId:string;correlationId:string;sourceIp?:string}
export interface WebhookEnvelope{id:string;event:string;version:"1";occurred_at:string;data:Record<string,unknown>}
export interface ConnectorHealth{ok:boolean;code:string;checkedAt:string}
export interface AccountingIntegration{pushTimesheetSummary(input:unknown):Promise<never>;pushWarehouseDocument(input:unknown):Promise<never>;pushEmployeeMaster(input:unknown):Promise<never>;healthCheck():Promise<ConnectorHealth>}
export interface ReportingDataProvider{datasets():readonly string[];healthCheck():Promise<ConnectorHealth>}
export interface NotificationChannelProvider{sendMessage(input:unknown):Promise<never>;healthCheck():Promise<ConnectorHealth>}
export interface AttendanceDeviceAdapter{ingestEvent(input:unknown):Promise<unknown>;mapUser(externalCode:string):Promise<string|undefined>;healthCheck():Promise<ConnectorHealth>}
