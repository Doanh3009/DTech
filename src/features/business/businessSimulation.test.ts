// @vitest-environment node
import {describe,expect,it} from "vitest";
import {PDFDocument} from "pdf-lib";
import {businessSimulationCommand,type SimulationReceipt} from "./businessSimulation";
import {buildBusinessSimulationPdf} from "./businessSimulationPdf";
const input={requestId:"11111111-1111-4111-8111-111111111111",rowVersion:3,service:"email",scenario:"success",recipient:"test@example.invalid",operation:"create",simulationId:null,simulationVersion:0};
describe("simulation boundaries",()=>{
 it("requires a preview recipient for email and a receipt version for transitions",()=>{expect(businessSimulationCommand.safeParse(input).success).toBe(true);expect(businessSimulationCommand.safeParse({...input,recipient:""}).success).toBe(false);expect(businessSimulationCommand.safeParse({...input,operation:"callback"}).success).toBe(false);expect(businessSimulationCommand.safeParse({...input,service:"bank"}).success).toBe(false);expect(businessSimulationCommand.safeParse({...input,service:"bank",recipient:""}).success).toBe(true);});
 it("exports a Vietnamese receipt with explicit simulation metadata",async()=>{const receipt={id:input.requestId,simulation:true,tenantName:"Doanh nghiệp trải nghiệm",service:"email",scenario:"success",sourceKind:"cash_vouchers",sourceId:input.requestId,sourceVersion:3,sourceCode:"PT-001",sourceName:"Thu tiền",sourceSha256:"a".repeat(64),recipient:input.recipient,state:"succeeded",attempts:1,rowVersion:2,reference:"SIM-email-001",lastError:null,result:{subject:"PT-001 · Thu tiền"},createdAt:"2026-11-03T00:00:00Z",completedAt:"2026-11-03T00:00:00Z",events:[{sequence:2,operation:"create",state:"succeeded",actor:"Kế toán",createdAt:"2026-11-03T00:00:00Z"}]} satisfies SimulationReceipt;const bytes=await buildBusinessSimulationPdf(receipt),document=await PDFDocument.load(bytes);expect(document.getPageCount()).toBeGreaterThan(0);expect(document.getTitle()).toContain("MÔ PHỎNG");expect(document.getSubject()).toContain("Không có giá trị");});
});
