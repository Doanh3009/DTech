import { beforeEach,afterEach,it,expect,vi } from "vitest";
const mock=vi.hoisted(()=>({user:vi.fn()}));
vi.mock("@/services/auth/getRequestUser",()=>({getRequestUser:mock.user}));
import { requireControlCenter } from "./controlCenterAccess";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","true");mock.user.mockResolvedValue(null);});afterEach(()=>vi.unstubAllEnvs());
it("customer ERP disables the entire control plane before reading session",async()=>{vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","false");await expect(requireControlCenter()).rejects.toMatchObject({status:404});expect(mock.user).not.toHaveBeenCalled();});
it("anonymous and ERP admin without CRM grant cannot enter",async()=>{await expect(requireControlCenter()).rejects.toMatchObject({status:401});mock.user.mockResolvedValue({id:"operator",status:"active",permissions:["system_admin.access"]});await expect(requireControlCenter()).rejects.toMatchObject({status:403});});
it("team setup can enter without ERP administrator privileges",async()=>{mock.user.mockResolvedValue({id:"operator",status:"active",permissions:["crm.view","crm.manage"]});expect((await requireControlCenter("crm.manage")).id).toBe("operator");});
it("read permission cannot mutate",async()=>{mock.user.mockResolvedValue({id:"reader",status:"active",permissions:["crm.view"]});await expect(requireControlCenter("crm.manage")).rejects.toMatchObject({status:403});});
