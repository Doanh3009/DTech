import { describe,expect,it } from "vitest";
import { approvalRejectSchema,delegationSchema,notificationPreferencesSchema,systemNoticeSchema,workflowInputSchema } from "./schemas";

describe("shared platform validation",()=>{
  it("requires a rejection reason",()=>{expect(approvalRejectSchema.safeParse({comment:""}).success).toBe(false);expect(approvalRejectSchema.safeParse({comment:"Thiếu thông tin"}).success).toBe(true);});
  it("requires at least one valid workflow step",()=>{const base={code:"LEAVE_STD",name:"Nghỉ phép chuẩn",domainType:"LEAVE"};expect(workflowInputSchema.safeParse({...base,steps:[]}).success).toBe(false);expect(workflowInputSchema.safeParse({...base,steps:[{stepName:"Quản lý",approverSource:"direct_manager",resolverConfig:{}}]}).success).toBe(true);});
  it("prevents invalid delegation windows",()=>{const base={fromAccountId:"11111111-1111-4111-8111-111111111111",toAccountId:"22222222-2222-4222-8222-222222222222",scope:"ALL_APPROVALS",reason:"Đi công tác"};expect(delegationSchema.safeParse({...base,startAt:"2026-09-12T10:00:00.000Z",endAt:"2026-09-12T09:00:00.000Z"}).success).toBe(false);});
  it("validates system notice windows and typed preferences",()=>{expect(systemNoticeSchema.safeParse({title:"Bảo trì",message:"Bảo trì hệ thống",startAt:"2026-09-12T10:00:00.000Z",endAt:"2026-09-12T11:00:00.000Z",audienceType:"all_users",audienceIds:[],priority:"important",status:"active"}).success).toBe(true);expect(notificationPreferencesSchema.parse({categories:{approval:true,shipment:false}}).categories.shipment).toBe(false);});
});
