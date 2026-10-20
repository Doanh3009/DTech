import { desktopNavigation, mobileNavigation } from "@/config/navigation";

export interface RouteMeta {
  title: string;
  description: string;
  module: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export const routeMetaByPath: Record<string, RouteMeta> = {
  "/personal": { title: "Cá nhân", description: "", module: "Cá nhân" },
  "/personal/payslips": { title: "Phiếu lương của tôi", description: "", module: "Cá nhân" },
  "/applications": { title: "Ứng dụng", description: "", module: "Cá nhân" },
  "/workspace": { title: "Không gian làm việc", description: "", module: "Tổng quan" },
  "/settings": { title: "Cấu hình nghiệp vụ", description: "", module: "Hệ thống" },
  "/approvals/pending": { title: "Cần tôi duyệt", description: "", module: "Phê duyệt" },
  "/approvals/completed": { title: "Đã hoàn tất", description: "", module: "Phê duyệt" },
  "/approvals/delegated": { title: "Được ủy quyền", description: "", module: "Phê duyệt" },
  "/documents": { title: "Tài liệu", description: "", module: "Quản lý" },
  "/documents/recent": { title: "Tài liệu gần đây", description: "", module: "Tài liệu" },
  "/documents/shared": { title: "Tài liệu dùng chung", description: "", module: "Tài liệu" },
  "/warehouse": { title: "Tổng quan kho", description: "", module: "Kho" },
  "/dashboard": {
    title: "Tổng quan",
    description: "Các việc cần theo dõi trong ngày và trạng thái nền tảng.",
    module: "Tổng quan"
  },
  "/home": { title: "Trang chủ", description: "", module: "Tổng quan" },
  "/dashboard/hr": { title: "Điều hành nhân sự", description: "", module: "Tổng quan" },
  "/dashboard/warehouse": { title: "Điều hành kho", description: "", module: "Tổng quan" },
  "/dashboard/import-export": { title: "Điều hành xuất nhập khẩu", description: "", module: "Tổng quan" },
  "/dashboard/management": { title: "Bản tin điều hành", description: "", module: "Tổng quan" },
  "/search": { title: "Tìm kiếm", description: "", module: "Tổng quan" },
  "/search/results": { title: "Kết quả tìm kiếm", description: "", module: "Tổng quan" },
  "/command": { title: "Trung tâm lệnh", description: "", module: "Tổng quan" },
  "/employees": {
    title: "Nhân viên",
    description: "Nền tảng quản lý hồ sơ nhân sự, tài khoản liên kết và lịch sử thay đổi.",
    module: "Nhân sự"
  },
  "/employees/insurance": { title: "Bảo hiểm xã hội", description: "", module: "Nhân sự" },
  "/employees/departments": { title: "Phòng ban", description: "", module: "Nhân sự" },
  "/employees/positions": { title: "Chức vụ", description: "", module: "Nhân sự" },
  "/employees/contracts": { title: "Hợp đồng lao động", description: "", module: "Nhân sự" },
  "/employees/new": {
    title: "Tạo hồ sơ nhân viên",
    description: "Route riêng cho form dài; nghiệp vụ chi tiết sẽ triển khai ở prompt Nhân sự.",
    module: "Nhân sự"
  },
  "/attendance": {
    title: "Chấm công",
    description: "Nền tảng chấm công cá nhân qua mobile, GPS, ảnh và trạng thái đồng bộ.",
    module: "Cá nhân"
  },
  "/attendance/me": { title: "Chấm công của tôi", description: "", module: "Cá nhân" },
  "/attendance/quick": { title: "Chấm công", description: "", module: "Cá nhân" },
  "/attendance/today": { title: "Kiểm tra công thông minh", description: "", module: "Quản trị công" },
  "/attendance/logs": { title: "Nhật ký công", description: "", module: "Quản trị công" },
  "/attendance/requests": { title: "Đơn của tôi", description: "", module: "Cá nhân" },
  "/attendance/notifications": { title: "Thông báo", description: "", module: "Cá nhân" },
  "/attendance/history": {
    title: "Lịch sử chấm công",
    description: "",
    module: "Cá nhân"
  },
  "/attendance/records": {
    title: "Kiểm tra chấm công",
    description: "",
    module: "Chấm công"
  },
  "/timesheets": {
    title: "Kỳ công",
    description: "Tầng tổng hợp dữ liệu công từ chấm công, điểm danh, đơn nghỉ và điều chỉnh.",
    module: "Quản trị công"
  },
  "/timesheets/matrix": { title: "Bảng công", description: "", module: "Quản trị công" },
  "/timesheets/exceptions": { title: "Ngoại lệ bảng công", description: "", module: "Quản trị công" },
  "/timesheets/adjustments": { title: "Điều chỉnh bảng công", description: "", module: "Quản trị công" },
  "/shifts": {
    title: "Ca làm",
    description: "Cấu hình ca làm và chính sách liên quan sẽ nằm trong dữ liệu cấu hình.",
    module: "Quản trị công"
  },
  "/shifts/calendar": { title: "Lịch ngày làm việc và ngày nghỉ", description: "", module: "Quản trị công" },
  "/leave": {
    title: "Nghỉ phép",
    description: "Nền tảng route cho đơn từ, phê duyệt và xuất PDF ở bước sau.",
    module: "Cá nhân"
  },
  "/leave/manage": { title: "Quản lý nghỉ phép", description: "", module: "Quản trị công" },
  "/leave/settlements": { title: "Thanh toán phép cuối năm", description: "", module: "Quản trị công" },
  "/projects": {
    title: "Gói / Công trường",
    description: "Quản lý project, worksite, phân công và roster theo cấu trúc mở rộng.",
    module: "Gói / Công trường"
  },
  "/projects/new": {
    title: "Tạo gói",
    description: "",
    module: "Gói / Công trường"
  },
  "/projects/updates": {
    title: "Cập nhật dự án",
    description: "Kênh cập nhật tình hình dự án, hình ảnh và lịch sử theo công trường.",
    module: "Dự án"
  },
  "/project-monitoring": {
    title: "Theo dõi dự án",
    description: "",
    module: "Dự án"
  },
  "/project-monitoring/issues": {
    title: "Trung tâm vấn đề",
    description: "",
    module: "Dự án"
  },
  "/project-monitoring/recent": {
    title: "Cập nhật gần đây",
    description: "",
    module: "Dự án"
  },
  "/worker-attendance": {
    title: "Điểm danh công nhân",
    description: "",
    module: "Dự án"
  },
  "/worker-attendance/today": { title: "Điểm danh hôm nay", description: "", module: "Dự án" },
  "/warehouse/items": {
    title: "Hàng hóa",
    description: "Danh mục hàng hóa dùng chung cho nhập, xuất, chuyển và kiểm kê.",
    module: "Kho"
  },
  "/warehouse/receipts": {
    title: "Nhập kho",
    description: "Route nghiệp vụ nhập kho, chứng từ và audit sẽ triển khai ở module Kho.",
    module: "Kho"
  },
  "/warehouse/issues": {
    title: "Xuất kho",
    description: "Route nghiệp vụ xuất kho có kiểm quyền và audit.",
    module: "Kho"
  },
  "/warehouse/transfers": {
    title: "Chuyển kho",
    description: "Route nghiệp vụ chuyển kho giữa các địa điểm.",
    module: "Kho"
  },
  "/warehouse/inventory": {
    title: "Tồn kho",
    description: "",
    module: "Kho"
  },
  "/warehouse/warehouses": { title: "Danh sách kho", description: "", module: "Kho" },
  "/warehouse/adjustments": { title: "Điều chỉnh kho", description: "", module: "Kho" },
  "/warehouse/stock-counts": { title: "Kiểm kê", description: "", module: "Kho" },
  "/warehouse/ledger": { title: "Sổ kho", description: "", module: "Kho" },
  "/settings/warehouse": { title: "Cấu hình kho", description: "", module: "Hệ thống" },
  "/import-export": { title: "Tổng quan xuất nhập khẩu", description: "", module: "Xuất nhập khẩu" },
  "/import-export/contracts": { title: "Hợp đồng mua hàng", description: "", module: "Xuất nhập khẩu" },
  "/import-export/shipments": {
    title: "Lô hàng",
    description: "",
    module: "Xuất nhập khẩu"
  },
  "/import-export/documents": {
    title: "Chứng từ XNK",
    description: "",
    module: "Xuất nhập khẩu"
  },
  "/import-export/partners": { title: "Đối tác", description: "", module: "Xuất nhập khẩu" },
  "/import-export/transport": { title: "Vận chuyển", description: "", module: "Xuất nhập khẩu" },
  "/import-export/customs": { title: "Thông quan", description: "", module: "Xuất nhập khẩu" },
  "/accounting": { title: "Tổng quan kế toán", description: "", module: "Kế toán" },
  "/accounting/salaries": { title: "Hồ sơ lương", description: "", module: "Kế toán" },
  "/accounting/salary-history": { title: "Nhật ký lương", description: "", module: "Kế toán" },
  "/accounting/payroll": { title: "Bảng lương", description: "", module: "Kế toán" },
  "/accounting/payslips": { title: "Phiếu lương", description: "", module: "Kế toán" },
  "/messages": { title: "Tin nhắn", description: "", module: "Tin nhắn" },
  "/settings/import-export": { title: "Cấu hình XNK", description: "", module: "Hệ thống" },
  "/approvals": {
    title: "Phê duyệt",
    description: "Hàng đợi phê duyệt dùng chung cho đơn từ và nghiệp vụ phát sinh.",
    module: "Quản lý"
  },
  "/reports": {
    title: "Báo cáo",
    description: "Nền tảng báo cáo, export Excel/PDF và tích hợp BI.",
    module: "Quản lý"
  },
  "/settings/users": {
    title: "Người dùng",
    description: "Tài khoản đăng nhập tách biệt với hồ sơ nhân sự.",
    module: "Hệ thống"
  },
  "/settings/organization": {
    title: "Cấu hình tổ chức",
    description: "Cấu hình doanh nghiệp và các dữ liệu nền tảng.",
    module: "Hệ thống"
  },
  "/settings/attendance": {
    title: "Cấu hình chấm công",
    description: "Extension point cho ca làm, GPS, ngày công và policy.",
    module: "Hệ thống"
  },
  "/settings/attendance/locations": {
    title: "Địa điểm chấm công",
    description: "",
    module: "Hệ thống"
  },
  "/settings/attendance/shifts": { title: "Ca làm", description: "", module: "Hệ thống" },
  "/settings/attendance/calendar": { title: "Lịch ngày làm việc và ngày nghỉ", description: "", module: "Hệ thống" },
  "/settings/attendance/policies": { title: "Chính sách chấm công", description: "", module: "Hệ thống" },
  "/settings/roles": {
    title: "Vai trò & phân quyền",
    description: "",
    module: "Hệ thống"
  },
  "/settings/permissions": {
    title: "Vai trò & phân quyền",
    description: "",
    module: "Hệ thống"
  },
  "/settings/approval-workflows": {
    title: "Quy trình duyệt",
    description: "Cấu hình workflow phê duyệt theo nghiệp vụ.",
    module: "Hệ thống"
  },
  "/settings/approval-delegations": { title: "Ủy quyền phê duyệt", description: "", module: "Hệ thống" },
  "/settings/notifications": { title: "Tùy chọn thông báo", description: "", module: "Hệ thống" },
  "/settings/export-templates": {
    title: "Mẫu xuất dữ liệu",
    description: "Cấu hình template Excel/PDF dùng chung.",
    module: "Hệ thống"
  },
  "/settings/integrations": {
    title: "Tích hợp",
    description: "API key, webhook và kết nối hệ thống bên ngoài.",
    module: "Hệ thống"
  },
  "/settings/integrations/api-keys": { title: "Khóa API", description: "", module: "Tích hợp" },
  "/settings/integrations/service-accounts": { title: "Tài khoản dịch vụ", description: "", module: "Tích hợp" },
  "/settings/integrations/webhooks": { title: "Webhooks", description: "", module: "Tích hợp" },
  "/settings/integrations/webhook-deliveries": { title: "Lịch sử gửi webhook", description: "", module: "Tích hợp" },
  "/settings/integrations/conflicts": { title: "Xung đột đồng bộ", description: "", module: "Tích hợp" },
  "/settings/integrations/imports": { title: "Import dữ liệu", description: "", module: "Tích hợp" },
  "/settings/integrations/attendance-devices": { title: "Máy chấm công", description: "", module: "Tích hợp" },
  "/settings/integrations/api-docs": { title: "Tài liệu API & Webhook", description: "", module: "Tích hợp" },
  "/settings/audit-log": {
    title: "Nhật ký hệ thống",
    description: "Theo dõi thay đổi quan trọng theo actor, entity, before/after và lý do.",
    module: "Hệ thống"
  },
  "/system-admin/branding": { title: "Thương hiệu", description: "", module: "Trung tâm quản trị" },
  "/system-admin/appearance": { title: "Giao diện", description: "", module: "Trung tâm quản trị" },
  "/system-admin/navigation": { title: "Điều hướng", description: "", module: "Trung tâm quản trị" },
  "/system-admin/dashboard": { title: "Bố cục bản tin", description: "", module: "Trung tâm quản trị" },
  "/system-admin/modules": { title: "Phân hệ", description: "", module: "Trung tâm quản trị" },
  "/system-admin/organization": { title: "Tổ chức", description: "", module: "Trung tâm quản trị" },
  "/system-admin/payslip-template": { title: "Mẫu phiếu lương", description: "", module: "Trung tâm quản trị" },
  "/system-admin/localization": { title: "Định dạng & thời gian", description: "", module: "Trung tâm quản trị" },
  "/system-admin/security": { title: "Bảo mật", description: "", module: "Trung tâm quản trị" },
  "/system-admin/config-history": { title: "Lịch sử cấu hình", description: "", module: "Trung tâm quản trị" },
  "/system-admin/audit": { title: "Nhật ký hệ thống", description: "", module: "Trung tâm quản trị" },
  "/system-admin/notices": { title: "Thông báo hệ thống", description: "", module: "Trung tâm quản trị" },
  "/notifications": {
    title: "Thông báo",
    description: "Route mobile cho thông báo nghiệp vụ và trạng thái đồng bộ.",
    module: "Cá nhân"
  },
  "/profile": {
    title: "Cá nhân",
    description: "Thông tin tài khoản, phiên đăng nhập và thiết lập cá nhân.",
    module: "Cá nhân"
  }
};

const employeeSectionLabels: Record<string, string> = {
  profile: "Hồ sơ",
  employment: "Công việc",
  contracts: "Hợp đồng",
  salary: "Lương & phúc lợi",
  attendance: "Chấm công",
  history: "Lịch sử",
  leave: "Nghỉ phép",
  account: "Tài khoản"
};

const projectSectionLabels: Record<string, string> = {
  today: "Hôm nay",
  progress: "Thi công",
  team: "Nhân lực",
  materials: "Vật tư",
  profile: "Thông tin",
  documents: "Tài liệu"
};

function getEmployeeSectionLabel(section: string) {
  return section === "edit" ? "Chỉnh sửa" : employeeSectionLabels[section] ?? "Chi tiết";
}

export function getRouteMeta(pathname: string): RouteMeta {
  const exact = routeMetaByPath[pathname];
  if (exact) {
    return exact;
  }

  const approvalCaseMatch = pathname.match(/^\/approvals\/([^/]+)$/);
  if (approvalCaseMatch) return { title: "Chi tiết phê duyệt", description: "", module: "Phê duyệt" };
  const documentMatch = pathname.match(/^\/documents\/([^/]+)$/);
  if (documentMatch) return { title: "Chi tiết tài liệu", description: "", module: "Tài liệu" };
  const messageMatch = pathname.match(/^\/messages\/([^/]+)$/);
  if (messageMatch) return { title: "Hội thoại", description: "", module: "Tin nhắn" };
  const integrationMatch = pathname.match(/^\/settings\/integrations\/([^/]+)(?:\/(logs|mappings))?$/);
  if (integrationMatch) return { title: integrationMatch[2] === "logs" ? "Nhật ký tích hợp" : integrationMatch[2] === "mappings" ? "Ánh xạ dữ liệu" : "Kết nối tích hợp", description: "", module: "Tích hợp" };

  {
    const warehouseMatch = pathname.match(/^\/warehouse\/(items|warehouses|receipts|issues|transfers|adjustments|stock-counts)\/(new|[^/]+)(?:\/(edit))?$/);
    if (warehouseMatch) {
      const labels: Record<string, string> = { items: "Hàng hóa", warehouses: "Kho", receipts: "Phiếu nhập", issues: "Phiếu xuất", transfers: "Phiếu chuyển", adjustments: "Phiếu điều chỉnh", "stock-counts": "Kiểm kê" };
      return { title: warehouseMatch[2] === "new" ? `Tạo ${labels[warehouseMatch[1]].toLowerCase()}` : warehouseMatch[3] === "edit" ? `Chỉnh sửa ${labels[warehouseMatch[1]].toLowerCase()}` : labels[warehouseMatch[1]], description: "", module: "Kho" };
    }
    const employeeTimesheet = pathname.match(/^\/timesheets\/periods\/([^/]+)\/employees\/([^/]+)$/);
    if (employeeTimesheet) return { title: "Công nhân viên", description: "", module: "Nhân sự" };
    const periodTimesheet = pathname.match(/^\/timesheets\/periods\/([^/]+)$/);
    if (periodTimesheet) return { title: "Chi tiết kỳ công", description: "", module: "Nhân sự" };
    const shipmentMatch = pathname.match(/^\/import-export\/shipments\/(new|[^/]+)(?:\/(overview|lines|containers|documents|customs|receiving|history))?$/);
    if (shipmentMatch) {
      const sectionLabels: Record<string,string> = { overview:"Tổng quan",lines:"Dòng hàng",containers:"Container",documents:"Chứng từ",customs:"Thông quan",receiving:"Nhận hàng",history:"Lịch sử" };
      return { title: shipmentMatch[1] === "new" ? "Tạo lô hàng" : sectionLabels[shipmentMatch[2] ?? "overview"], description: "", module: "Xuất nhập khẩu" };
    }
    const contractMatch = pathname.match(/^\/import-export\/contracts\/(new|[^/]+)$/);
    if (contractMatch) return { title: contractMatch[1] === "new" ? "Tạo hợp đồng mua hàng" : "Hợp đồng mua hàng", description: "", module: "Xuất nhập khẩu" };
    const personalPayslipMatch = pathname.match(/^\/personal\/payslips\/([^/]+)$/);
    if (personalPayslipMatch) return { title: "Chi tiết phiếu lương", description: "", module: "Cá nhân" };
    const employeePayrollMatch = pathname.match(/^\/accounting\/payroll\/([^/]+)\/employees\/([^/]+)$/);
    if (employeePayrollMatch) return { title: "Phiếu lương nhân viên", description: "", module: "Kế toán" };
    const payrollMatch = pathname.match(/^\/accounting\/payroll\/([^/]+)$/);
    if (payrollMatch) return { title: "Chi tiết bảng lương", description: "", module: "Kế toán" };
  }

  const employeeMatch = pathname.match(/^\/employees\/([^/]+)\/([^/]+)$/);
  if (employeeMatch) {
    const section = getEmployeeSectionLabel(employeeMatch[2]);
    return {
      title: `Hồ sơ nhân viên · ${section}`,
      description: "Route-backed tab cho hồ sơ nhân viên, giữ đúng URL khi refresh.",
      module: "Nhân sự"
    };
  }

  const projectUpdateMatch = pathname.match(/^\/projects\/([^/]+)\/updates\/(new|[^/]+)$/);
  if (projectUpdateMatch) {
    return { title: projectUpdateMatch[2] === "new" ? "Cập nhật dự án" : "Chi tiết cập nhật", description: "", module: "Dự án" };
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)\/([^/]+)$/);
  if (projectMatch) {
    const section = projectSectionLabels[projectMatch[2]] ?? "Chi tiết";
    return {
      title: projectMatch[2] === "materials" ? "Vật tư công trường" : section,
      description: "",
      module: "Gói / Công trường"
    };
  }

  return {
    title: "Không tìm thấy",
    description: "Đường dẫn không tồn tại hoặc chưa được cấp quyền.",
    module: "Hệ thống"
  };
}

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/dashboard") {
    return [];
  }

  const shipmentMatch = pathname.match(/^\/import-export\/shipments\/([^/]+)(?:\/([^/]+))?$/);
  if (shipmentMatch) return [{label:"Xuất nhập khẩu",href:"/import-export"},{label:"Lô hàng",href:"/import-export/shipments"},{label:shipmentMatch[1],href:`/import-export/shipments/${shipmentMatch[1]}/overview`},{label:getRouteMeta(pathname).title}];
  const contractMatch = pathname.match(/^\/import-export\/contracts\/([^/]+)$/);
  if (contractMatch) return [{label:"Xuất nhập khẩu",href:"/import-export"},{label:"Hợp đồng mua hàng",href:"/import-export/contracts"},{label:getRouteMeta(pathname).title}];

  const employeeMatch = pathname.match(/^\/employees\/([^/]+)\/([^/]+)$/);
  if (employeeMatch) {
    return [
      { label: "Nhân sự", href: "/employees" },
      { label: employeeMatch[1], href: `/employees/${employeeMatch[1]}/profile` },
      { label: getEmployeeSectionLabel(employeeMatch[2]) }
    ];
  }

  const projectUpdateMatch = pathname.match(/^\/projects\/([^/]+)\/updates\/(new|[^/]+)$/);
  if (projectUpdateMatch) {
    return [{ label: "Gói / Công trường", href: "/projects" }, { label: projectUpdateMatch[1], href: `/projects/${projectUpdateMatch[1]}/progress` }, { label: "Cập nhật", href: `/projects/${projectUpdateMatch[1]}/updates` }, { label: projectUpdateMatch[2] === "new" ? "Tạo mới" : "Chi tiết" }];
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)\/([^/]+)$/);
  if (projectMatch) {
    return [
      { label: "Gói / Công trường", href: "/projects" },
      { label: /^[0-9a-f-]{36}$/i.test(projectMatch[1]) ? "Công trường" : projectMatch[1], href: `/projects/${projectMatch[1]}/today` },
      { label: projectSectionLabels[projectMatch[2]] ?? "Chi tiết" }
    ];
  }

  const meta = getRouteMeta(pathname);
  if (meta.module === meta.title) {
    return [];
  }

  return [{ label: meta.module }, { label: meta.title }];
}

export function getBackHref(pathname: string): string | null {
  if (pathname === "/attendance/quick") return "/personal";
  const functionRoutes = new Set([
    ...desktopNavigation.flatMap((group) => group.items.map((item) => item.href)),
    ...mobileNavigation.map((item) => item.href),
    "/accounting",
    "/command",
    "/home",
    "/import-export",
    "/messages",
    "/notifications",
    "/profile",
    "/search",
    "/settings",
    "/system-admin",
    "/warehouse",
    "/workspace",
    "/dashboard"
  ]);
  // Primary destinations already have a persistent navigation entry. Reserve
  // the return control for a child record or a task within that destination.
  if (pathname === "/dashboard") return null;
  if (pathname === "/attendance/logs") return "/attendance/today";
  if (/^\/attendance\/records\/[^/]+$/.test(pathname)) return "/attendance/logs";
  if (functionRoutes.has(pathname)) return null;

  const breadcrumbParent = [...getBreadcrumbs(pathname)]
    .reverse()
    .find((item) => item.href && item.href !== pathname)?.href;
  if (breadcrumbParent) return breadcrumbParent;

  const segments = pathname.split("/").filter(Boolean);
  for (let length = segments.length - 1; length > 0; length -= 1) {
    const candidate = `/${segments.slice(0, length).join("/")}`;
    if (routeMetaByPath[candidate] || getRouteMeta(candidate).title !== "Không tìm thấy") {
      return candidate;
    }
  }

  return null;
}

export const employeeDetailSections = Object.entries(employeeSectionLabels).map(
  ([value, label]) => ({ value, label })
);

export const projectDetailSections = Object.entries(projectSectionLabels).map(
  ([value, label]) => ({ value, label })
);
