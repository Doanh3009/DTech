import"server-only";import{AppError}from"@/lib/api/errors";import type{AccountingIntegration,AttendanceDeviceAdapter,ConnectorHealth,NotificationChannelProvider,ReportingDataProvider}from"./types";
const unavailable=async():Promise<never>=>{throw new AppError("CONFLICT","Connector chưa được cấu hình với provider thật.");};
const health=async():Promise<ConnectorHealth>=>({ok:false,code:"NOT_CONFIGURED",checkedAt:new Date().toISOString()});
export class MisaConnector implements AccountingIntegration{pushTimesheetSummary=unavailable;pushWarehouseDocument=unavailable;pushEmployeeMaster=unavailable;healthCheck=health;}
export class PowerBiDataProvider implements ReportingDataProvider{datasets(){return["employees_summary","timesheet_summary","project_summary","warehouse_balance","shipment_status"] as const;}healthCheck=health;}
export class ZaloNotificationProvider implements NotificationChannelProvider{sendMessage=unavailable;healthCheck=health;}
export class EmailNotificationProvider implements NotificationChannelProvider{sendMessage=unavailable;healthCheck=health;}
export class GenericAttendanceDeviceAdapter implements AttendanceDeviceAdapter{ingestEvent=async(input:unknown)=>input;mapUser=async()=>undefined;healthCheck=health;}
