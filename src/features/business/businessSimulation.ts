import {z} from "zod";
import integrations from "@/config/businessIntegrations.json";
export const businessIntegrations=integrations;
export type SimulationService=keyof typeof integrations;
export const simulationScenarios={success:"Thành công",transient:"Lỗi tạm thời",delayed:"Phản hồi chậm",rejected:"Từ chối"} as const;
export const simulationStates={queued:"Đang chờ",retry:"Chờ thử lại",waiting:"Chờ phản hồi",succeeded:"Thành công mô phỏng",rejected:"Đã từ chối",cancelled:"Đã hủy"} as const;
export const businessSimulationCommand=z.object({requestId:z.string().uuid(),rowVersion:z.number().int().positive(),service:z.enum(["einvoice","signature","bank","email"]),scenario:z.enum(["success","transient","delayed","rejected"]),recipient:z.string().trim().max(254),operation:z.enum(["create","retry","callback","cancel"]),simulationId:z.string().uuid().nullable(),simulationVersion:z.number().int().nonnegative()}).strict().superRefine((value,ctx)=>{
 if(value.service==="email"?!z.email().safeParse(value.recipient).success:value.recipient!=="")ctx.addIssue({code:"custom",path:["recipient"],message:"Địa chỉ email chưa hợp lệ."});
 if(value.operation==="create"?(value.simulationId!==null||value.simulationVersion!==0):(!value.simulationId||value.simulationVersion<1))ctx.addIssue({code:"custom",path:["simulationId"],message:"Yêu cầu mô phỏng chưa hợp lệ."});
});
export interface SimulationReceipt{id:string;simulation:true;tenantName:string;service:SimulationService;scenario:keyof typeof simulationScenarios;sourceKind:string;sourceId:string;sourceVersion:number;sourceCode:string;sourceName:string;sourceSha256:string;recipient:string|null;state:keyof typeof simulationStates;attempts:number;rowVersion:number;reference:string;lastError:string|null;result:Record<string,unknown>;createdAt:string;completedAt:string|null;events:{sequence:number;operation:string;state:keyof typeof simulationStates;createdAt:string;actor:string}[]}
