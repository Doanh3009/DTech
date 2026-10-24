import {businessEntities,entitiesFor,type BusinessFeature,type EntityKind} from "./businessCatalog";
import type {BusinessWorkspace} from "./businessSchemas";
export const businessActionLabels={read:"Xem",report:"Báo cáo",create:"Tạo",update:"Sửa",calculate:"Tính toán",approve:"Duyệt",post:"Ghi nhận / ghi sổ",release:"Phát hành / mở kỳ",complete:"Hoàn thành / khóa kỳ",cancel:"Hủy nháp",reverse:"Đảo chứng từ"};
export function businessCan(w:BusinessWorkspace,kind:EntityKind,action:keyof typeof businessActionLabels){
 if(w.role==="owner")return true;
 if(w.customAccess&&w.accessExpiresAt&&Date.parse(w.accessExpiresAt)<=Date.now())return false;
 if(action==="reverse"||(w.role==="viewer"&&action!=="read"&&action!=="report"))return false;
 return !w.customAccess||!!w.grants?.find(g=>g.kind===kind)?.actions.includes(action);
}
export function businessCanReport(w:BusinessWorkspace,features?:BusinessFeature[]){
 if(w.role==="owner"||!w.customAccess)return true;
 if(w.accessExpiresAt&&Date.parse(w.accessExpiresAt)<=Date.now())return false;
 return entitiesFor(w.industry,w.features).filter(k=>!features||features.includes(businessEntities[k].feature)).every(k=>w.grants?.some(g=>g.kind===k&&g.scope==="tenant"&&g.actions.includes("read")&&g.actions.includes("report")));
}
