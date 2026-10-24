import { AppError } from "@/lib/api/errors";
import type { AccountStatus, Permission } from "@/lib/auth/permissions";
import { allFoundationPermissions } from "@/lib/auth/permissions";
import { employeeBaselinePermissions } from "@/services/authorization/employeeAccessPolicy";

export type PermissionGroup =
  | "Nhân sự"
  | "Tài khoản"
  | "Chấm công"
  | "Nghỉ phép"
  | "Dự án"
  | "Kho"
  | "XNK"
  | "Kế toán"
  | "Tin nhắn"
  | "Báo cáo"
  | "Hệ thống";

export interface PermissionDefinition {
  key: Permission;
  module: string;
  group: PermissionGroup;
  label: string;
  description: string;
  sensitive?: boolean;
}

export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionKeys: Permission[];
  userCount: number;
}

export interface AccountRoleState {
  accountId: string;
  status: AccountStatus;
  roleIds: string[];
}

export interface RoleInput {
  code: string;
  name: string;
  description?: string;
  permissionKeys: Permission[];
}

const adminGuardPermissions: Permission[] = [
  "role.manage",
  "account.assign_role",
  "settings.view"
];

export const permissionCatalog: PermissionDefinition[] = [
  { key: "crm.view", module: "system", group: "Hệ thống", label: "Xem CRM triển khai", description: "Hồ sơ khách hàng của team setup.", sensitive: true },
  { key: "crm.manage", module: "system", group: "Hệ thống", label: "Quản lý CRM triển khai", description: "Khảo sát và thiết lập môi trường khách hàng.", sensitive: true },
  { key: "trial_request.view", module: "system", group: "Hệ thống", label: "Xem yêu cầu dùng thử", description: "Xem thông tin doanh nghiệp và liên hệ đăng ký dùng thử.", sensitive: true },
  { key: "trial_request.manage", module: "system", group: "Hệ thống", label: "Xử lý yêu cầu dùng thử", description: "Cập nhật trạng thái và ghi nhận việc xử lý yêu cầu dùng thử.", sensitive: true },
  {
    key: "dashboard.view",
    module: "foundation",
    group: "Hệ thống",
    label: "Xem tổng quan",
    description: "Truy cập màn hình tổng quan nội bộ."
  },
  {
    key: "employee.view",
    module: "employees",
    group: "Nhân sự",
    label: "Xem danh sách nhân viên",
    description: "Xem hồ sơ nhân sự cơ bản, không gồm CCCD hoặc ngân hàng."
  },
  {
    key: "employee.view_sensitive",
    module: "employees",
    group: "Nhân sự",
    label: "Xem thông tin nhạy cảm",
    description: "Xem CCCD, ngân hàng, thuế, BHXH và tài liệu nhạy cảm.",
    sensitive: true
  },
  {
    key: "employee.create",
    module: "employees",
    group: "Nhân sự",
    label: "Tạo nhân viên",
    description: "Tạo hồ sơ nhân sự với các trường bắt buộc tối thiểu."
  },
  {
    key: "employee.edit",
    module: "employees",
    group: "Nhân sự",
    label: "Chỉnh sửa hồ sơ",
    description: "Cập nhật thông tin cơ bản và thông tin công việc."
  },
  {
    key: "employee.edit_sensitive",
    module: "employees",
    group: "Nhân sự",
    label: "Sửa thông tin nhạy cảm",
    description: "Cập nhật CCCD, ngân hàng, mã số thuế hoặc BHXH.",
    sensitive: true
  },
  {
    key: "employee.archive",
    module: "employees",
    group: "Nhân sự",
    label: "Lưu trữ hồ sơ",
    description: "Ẩn hồ sơ khỏi luồng vận hành mà không xóa lịch sử."
  },
  {
    key: "employee.offboard",
    module: "employees",
    group: "Nhân sự",
    label: "Xử lý nghỉ việc",
    description: "Ghi nhận nghỉ việc và vô hiệu hóa tài khoản theo chính sách."
  },
  {
    key: "employee.export_basic",
    module: "employees",
    group: "Nhân sự",
    label: "Xuất dữ liệu cơ bản",
    description: "Chuẩn bị dữ liệu nhân sự cơ bản cho report engine."
  },
  {
    key: "employee.export_sensitive",
    module: "employees",
    group: "Nhân sự",
    label: "Xuất dữ liệu nhạy cảm",
    description: "Xuất dữ liệu có CCCD, ngân hàng, thuế hoặc BHXH.",
    sensitive: true
  },
  {
    key: "account.view",
    module: "accounts",
    group: "Tài khoản",
    label: "Xem tài khoản",
    description: "Xem trạng thái tài khoản đăng nhập liên kết với nhân sự."
  },
  {
    key: "account.create",
    module: "accounts",
    group: "Tài khoản",
    label: "Cấp tài khoản",
    description: "Tạo tài khoản đăng nhập từ hồ sơ nhân sự."
  },
  {
    key: "account.disable",
    module: "accounts",
    group: "Tài khoản",
    label: "Vô hiệu hóa tài khoản",
    description: "Khóa tài khoản mà không xóa hồ sơ nhân sự."
  },
  {
    key: "account.delete",
    module: "accounts",
    group: "Tài khoản",
    label: "Xóa tài khoản",
    description: "Thu hồi tài khoản và hoàn tất xóa danh tính đăng nhập.",
    sensitive: true
  },
  {
    key: "account.enable",
    module: "accounts",
    group: "Tài khoản",
    label: "Kích hoạt tài khoản",
    description: "Cho phép tài khoản bị khóa quay lại sử dụng."
  },
  {
    key: "account.assign_role",
    module: "accounts",
    group: "Tài khoản",
    label: "Gán vai trò",
    description: "Thay đổi vai trò của tài khoản đăng nhập."
  },
  {
    key: "account.revoke_sessions",
    module: "accounts",
    group: "Tài khoản",
    label: "Thu hồi phiên",
    description: "Yêu cầu đăng nhập lại sau thao tác nhạy cảm."
  },
  {
    key: "attendance.view",
    module: "attendance",
    group: "Chấm công",
    label: "Xem chấm công",
    description: "Truy cập module chấm công cá nhân."
  },
  {
    key: "timesheet.view",
    module: "timesheets",
    group: "Chấm công",
    label: "Xem bảng công",
    description: "Truy cập bảng công tổng hợp."
  },
  {
    key: "leave.view",
    module: "leave",
    group: "Nghỉ phép",
    label: "Xem nghỉ phép",
    description: "Truy cập đơn nghỉ phép và đơn từ."
  },
  {
    key: "project.view",
    module: "projects",
    group: "Dự án",
    label: "Xem dự án",
    description: "Xem dự án, công trường và phân công cơ bản."
  },
  {
    key: "worker_attendance.view",
    module: "worker-attendance",
    group: "Dự án",
    label: "Điểm danh công nhân",
    description: "Truy cập luồng điểm danh công nhân tại hiện trường."
  },
  {
    key: "warehouse.view",
    module: "warehouse",
    group: "Kho",
    label: "Xem kho",
    description: "Truy cập các route kho hiện có."
  },
  {
    key: "import_export.view",
    module: "import-export",
    group: "XNK",
    label: "Xem XNK",
    description: "Truy cập shipment và chứng từ xuất nhập khẩu."
  },
  {
    key: "approval.view",
    module: "approvals",
    group: "Hệ thống",
    label: "Xem phê duyệt",
    description: "Truy cập hàng đợi phê duyệt."
  },
  {
    key: "report.view",
    module: "reports",
    group: "Báo cáo",
    label: "Xem báo cáo",
    description: "Truy cập nền tảng báo cáo."
  },
  {
    key: "notification.view",
    module: "notifications",
    group: "Hệ thống",
    label: "Xem thông báo",
    description: "Xem thông báo nghiệp vụ cá nhân."
  },
  {
    key: "profile.view",
    module: "profile",
    group: "Hệ thống",
    label: "Xem hồ sơ cá nhân",
    description: "Truy cập trang self-service cá nhân."
  },
  {
    key: "user.view",
    module: "settings",
    group: "Hệ thống",
    label: "Xem người dùng",
    description: "Xem danh sách tài khoản đăng nhập."
  },
  {
    key: "role.view",
    module: "settings",
    group: "Hệ thống",
    label: "Xem vai trò",
    description: "Xem vai trò và số lượng tài khoản đang dùng."
  },
  {
    key: "role.manage",
    module: "settings",
    group: "Hệ thống",
    label: "Quản lý vai trò",
    description: "Tạo, sửa vai trò và chọn permission.",
    sensitive: true
  },
  {
    key: "permission.view",
    module: "settings",
    group: "Hệ thống",
    label: "Xem quyền",
    description: "Xem catalog permission theo nhóm nghiệp vụ."
  },
  {
    key: "settings.view",
    module: "settings",
    group: "Hệ thống",
    label: "Xem cấu hình",
    description: "Truy cập cấu hình hệ thống."
  },
  {
    key: "system_admin.access",
    module: "system-admin",
    group: "Hệ thống",
    label: "Truy cập Trung tâm quản trị",
    description: "Truy cập khu vực cấu hình hệ thống."
  },
  {
    key: "branding.view",
    module: "system-admin",
    group: "Hệ thống",
    label: "Xem thương hiệu",
    description: "Xem cấu hình nhận diện hệ thống."
  },
  {
    key: "branding.manage",
    module: "system-admin",
    group: "Hệ thống",
    label: "Quản lý thương hiệu",
    description: "Cập nhật tên, logo và favicon.",
    sensitive: true
  },
  {
    key: "appearance.view",
    module: "system-admin",
    group: "Hệ thống",
    label: "Xem giao diện",
    description: "Xem cấu hình giao diện."
  },
  {
    key: "appearance.manage",
    module: "system-admin",
    group: "Hệ thống",
    label: "Quản lý giao diện",
    description: "Cập nhật màu và mật độ giao diện.",
    sensitive: true
  },
  {
    key: "navigation.manage",
    module: "system-admin",
    group: "Hệ thống",
    label: "Quản lý điều hướng",
    description: "Cập nhật thứ tự và hiển thị menu.",
    sensitive: true
  },
  {
    key: "module.manage",
    module: "system-admin",
    group: "Hệ thống",
    label: "Quản lý module",
    description: "Bật hoặc tắt module đã triển khai.",
    sensitive: true
  },
  {
    key: "organization_settings.view",
    module: "system-admin",
    group: "Hệ thống",
    label: "Xem cấu hình tổ chức",
    description: "Xem thông tin dùng chung của tổ chức."
  },
  {
    key: "organization_settings.manage",
    module: "system-admin",
    group: "Hệ thống",
    label: "Quản lý cấu hình tổ chức",
    description: "Cập nhật thông tin dùng chung của tổ chức.",
    sensitive: true
  },
  {
    key: "localization.manage",
    module: "system-admin",
    group: "Hệ thống",
    label: "Quản lý định dạng",
    description: "Cập nhật định dạng ngày và giờ."
  },
  {
    key: "config_history.view",
    module: "system-admin",
    group: "Hệ thống",
    label: "Xem lịch sử cấu hình",
    description: "Xem các phiên bản cấu hình đã xuất bản."
  },
  {
    key: "config_history.restore",
    module: "system-admin",
    group: "Hệ thống",
    label: "Khôi phục cấu hình",
    description: "Khôi phục phiên bản cấu hình được hỗ trợ.",
    sensitive: true
  },
  {
    key: "department.manage",
    module: "settings",
    group: "Hệ thống",
    label: "Quản lý phòng ban",
    description: "Thêm, sửa, vô hiệu hóa phòng ban."
  },
  {
    key: "position.manage",
    module: "settings",
    group: "Hệ thống",
    label: "Quản lý chức vụ",
    description: "Thêm, sửa, vô hiệu hóa chức vụ."
  },
  {
    key: "audit.view",
    module: "settings",
    group: "Hệ thống",
    label: "Xem audit log",
    description: "Xem lịch sử thay đổi quan trọng."
  },
  {
    key: "integration.view",
    module: "settings",
    group: "Hệ thống",
    label: "Xem tích hợp",
    description: "Xem API key, webhook và cấu hình kết nối."
  },
  {
    key: "file.read",
    module: "storage",
    group: "Hệ thống",
    label: "Đọc file nội bộ",
    description: "Tạo signed access ngắn hạn cho file private."
  },
  {
    key: "webhook.publish",
    module: "integrations",
    group: "Hệ thống",
    label: "Phát webhook",
    description: "Gửi sự kiện nghiệp vụ ra endpoint đã cấu hình."
  },
  { key: "employee.identity_document.view", module: "employees", group: "Nhân sự", label: "Xem ảnh CCCD", description: "Xem ảnh hai mặt giấy tờ định danh.", sensitive: true },
  { key: "employee.identity_document.edit", module: "employees", group: "Nhân sự", label: "Cập nhật ảnh CCCD", description: "Tải lên, thay thế hoặc xóa ảnh giấy tờ định danh.", sensitive: true },
  { key: "contract.view", module: "contracts", group: "Nhân sự", label: "Xem hợp đồng", description: "Xem lịch sử hợp đồng lao động." },
  { key: "contract.edit", module: "contracts", group: "Nhân sự", label: "Sửa hợp đồng", description: "Tạo và cập nhật hợp đồng lao động." },
  { key: "contract.file.view", module: "contracts", group: "Nhân sự", label: "Xem file hợp đồng", description: "Xem file PDF hợp đồng private.", sensitive: true },
  { key: "contract.file.upload", module: "contracts", group: "Nhân sự", label: "Tải file hợp đồng", description: "Tải lên hoặc thay thế file hợp đồng.", sensitive: true },
  { key: "insurance.view", module: "insurance", group: "Nhân sự", label: "Xem bảo hiểm", description: "Xem hồ sơ bảo hiểm xã hội." },
  { key: "insurance.edit", module: "insurance", group: "Nhân sự", label: "Cập nhật bảo hiểm", description: "Ghi nhận thay đổi hồ sơ bảo hiểm.", sensitive: true },
  { key: "insurance.history.view", module: "insurance", group: "Nhân sự", label: "Xem lịch sử bảo hiểm", description: "Xem lịch sử biến động bảo hiểm." },
  { key: "insurance.document.view", module: "insurance", group: "Nhân sự", label: "Xem tài liệu bảo hiểm", description: "Xem tài liệu bảo hiểm private.", sensitive: true },
  { key: "insurance.document.upload", module: "insurance", group: "Nhân sự", label: "Tải tài liệu bảo hiểm", description: "Tải tài liệu bảo hiểm vào kho private.", sensitive: true },
  { key: "attendance.self", module: "attendance", group: "Chấm công", label: "Chấm công của tôi", description: "Thực hiện chấm vào và chấm ra cá nhân." },
  { key: "attendance.manage", module: "attendance", group: "Chấm công", label: "Quản trị chấm công", description: "Xem dữ liệu chấm công toàn công ty." },
  { key: "attendance.log.view", module: "attendance", group: "Chấm công", label: "Xem nhật ký công", description: "Xem sự kiện và lịch sử điều chỉnh công." },
  { key: "shift.edit", module: "attendance", group: "Chấm công", label: "Chỉnh sửa ca", description: "Tạo phiên bản cấu hình ca có hiệu lực." },
  { key: "accounting.access", module: "accounting", group: "Kế toán", label: "Truy cập Kế toán", description: "Truy cập ứng dụng kế toán." },
  { key: "salary.view", module: "accounting", group: "Kế toán", label: "Xem lương", description: "Xem dữ liệu lương nhân viên.", sensitive: true },
  { key: "salary.edit", module: "accounting", group: "Kế toán", label: "Điều chỉnh lương", description: "Ghi nhận mức lương mới có hiệu lực.", sensitive: true },
  { key: "salary.history.view", module: "accounting", group: "Kế toán", label: "Xem lịch sử lương", description: "Xem toàn bộ lịch sử thay đổi lương.", sensitive: true },
  { key: "payroll.view", module: "accounting", group: "Kế toán", label: "Xem bảng lương", description: "Xem kỳ và dòng bảng lương.", sensitive: true },
  { key: "payroll.create", module: "accounting", group: "Kế toán", label: "Cập nhật số liệu lương", description: "Cập nhật số liệu từ kỳ công đã chốt.", sensitive: true },
  { key: "payroll.edit", module: "accounting", group: "Kế toán", label: "Sửa bảng lương", description: "Điều chỉnh bảng lương chưa khóa.", sensitive: true },
  { key: "payroll.lock", module: "accounting", group: "Kế toán", label: "Duyệt lương", description: "Duyệt bảng lương trước khi trình và gửi phiếu.", sensitive: true },
  { key: "payroll.export", module: "accounting", group: "Kế toán", label: "Xuất bảng lương", description: "Xuất dữ liệu bảng lương được phép xem ra Excel.", sensitive: true },
  { key: "payslip.create", module: "accounting", group: "Kế toán", label: "Tạo phiếu lương", description: "Sinh phiếu lương từ bảng lương khóa.", sensitive: true },
  { key: "payslip.publish", module: "accounting", group: "Kế toán", label: "Duyệt phiếu lương", description: "Duyệt và gửi phiếu cho tất cả hoặc từng nhân viên.", sensitive: true },
  { key: "payslip.revoke", module: "accounting", group: "Kế toán", label: "Thu hồi phiếu lương", description: "Thu hồi phiếu sai nhưng giữ lịch sử.", sensitive: true },
  { key: "payslip.self.view", module: "accounting", group: "Kế toán", label: "Xem phiếu lương cá nhân", description: "Xem phiếu lương đã phát hành của bản thân.", sensitive: true },
  { key: "bonus.manage", module: "accounting", group: "Kế toán", label: "Quản lý thưởng", description: "Quản lý khoản thưởng." },
  { key: "allowance.manage", module: "accounting", group: "Kế toán", label: "Quản lý phụ cấp", description: "Quản lý khoản phụ cấp." },
  { key: "deduction.manage", module: "accounting", group: "Kế toán", label: "Quản lý khấu trừ", description: "Quản lý khoản khấu trừ." },
  { key: "chat.access", module: "messaging", group: "Tin nhắn", label: "Truy cập tin nhắn", description: "Đọc và gửi tin trong các hội thoại được tham gia." },
  { key: "chat.group.create", module: "messaging", group: "Tin nhắn", label: "Tạo nhóm chat", description: "Tạo nhóm và chọn thành viên." }
];

export const roleCatalog: RoleDefinition[] = [
  {
    id: "role-admin",
    code: "admin",
    name: "Admin",
    description: "Quản trị toàn bộ quyền hiện có.",
    isSystem: true,
    permissionKeys: allFoundationPermissions,
    userCount: 0
  },
  {
    id: "role-hr",
    code: "hr",
    name: "HR",
    description: "Quản lý hồ sơ nhân sự, chấm công và nghỉ phép.",
    isSystem: true,
    permissionKeys: [
      "dashboard.view",
      "employee.view",
      "employee.view_sensitive",
      "employee.create",
      "employee.edit",
      "employee.edit_sensitive",
      "employee.archive",
      "employee.offboard",
      "employee.export_basic",
      "employee.identity_document.view",
      "employee.identity_document.edit",
      "contract.view",
      "contract.edit",
      "contract.file.view",
      "contract.file.upload",
      "insurance.view",
      "insurance.edit",
      "insurance.history.view",
      "insurance.document.view",
      "insurance.document.upload",
      "account.view",
      "account.create",
      "account.disable",
      "department.manage",
      "position.manage",
      "leave.approve",
      "leave.view_all",
      "leave.view_team",
      "attendance.manage",
      "attendance.view_all",
      "attendance.adjust",
      "attendance.log.view",
      "shift.edit",
      "chat.access",
      "chat.group.create",
      "file.read"
    ],
    userCount: 0
  },
  {
    id: "role-employee",
    code: "employee",
    name: "Nhân viên",
    description: "Self-service cá nhân và các module cơ bản.",
    isSystem: true,
    permissionKeys: [...employeeBaselinePermissions],
    userCount: 0
  },
  {
    id: "role-supervisor",
    code: "supervisor",
    name: "Giám sát",
    description: "Theo dõi nhân sự hiện trường và điểm danh công nhân.",
    isSystem: true,
    permissionKeys: [
      "dashboard.view",
      "worker_attendance.view",
      "project.view",
      "notification.view",
      "profile.view",
      "chat.access",
      "file.read"
    ],
    userCount: 0
  },
  {
    id: "role-accountant",
    code: "accountant",
    name: "Kế toán",
    description: "Quản lý lương, bảng lương và phiếu lương.",
    isSystem: true,
    permissionKeys: [
      "dashboard.view",
      "accounting.access",
      "salary.view",
      "salary.edit",
      "salary.history.view",
      "payroll.view",
      "payroll.create",
      "payroll.edit",
      "payroll.lock",
      "payroll.export",
      "payslip.create",
      "payslip.publish",
      "payslip.revoke",
      "payslip.self.view",
      "bonus.manage",
      "allowance.manage",
      "deduction.manage",
      "notification.view",
      "chat.access",
      "file.read"
    ],
    userCount: 0
  }
];

export function getPermissionCatalog(): PermissionDefinition[] {
  return permissionCatalog;
}

export function getPermissionGroups(): Array<{
  group: PermissionGroup;
  permissions: PermissionDefinition[];
}> {
  const groups = new Map<PermissionGroup, PermissionDefinition[]>();

  for (const permission of permissionCatalog) {
    const existing = groups.get(permission.group) ?? [];
    existing.push(permission);
    groups.set(permission.group, existing);
  }

  return Array.from(groups.entries()).map(([group, permissions]) => ({
    group,
    permissions
  }));
}

export function getRoleCatalog(accounts: readonly AccountRoleState[] = []): RoleDefinition[] {
  return roleCatalog.map((role) => ({
    ...role,
    userCount: accounts.filter((account) => account.roleIds.includes(role.id)).length
  }));
}

export function getRoleById(roleId: string): RoleDefinition | undefined {
  return roleCatalog.find((role) => role.id === roleId);
}

export function resolveRoleNames(roleIds: readonly string[], roles: readonly RoleDefinition[] = roleCatalog): string[] {
  return roleIds.map((roleId) => roles.find((role) => role.id === roleId)?.name ?? `Vai trò ${roleId.slice(0, 8)}`);
}

export function getEffectivePermissions(
  roleIds: readonly string[],
  roles: readonly RoleDefinition[] = roleCatalog
): Permission[] {
  const permissionSet = new Set<Permission>();

  for (const roleId of roleIds) {
    const role = roles.find((item) => item.id === roleId);
    if (!role) {
      continue;
    }

    for (const permission of role.permissionKeys) {
      permissionSet.add(permission);
    }
  }

  return Array.from(permissionSet);
}

export function assertKnownPermissions(permissionKeys: readonly Permission[]): void {
  const known = new Set(permissionCatalog.map((permission) => permission.key));
  const unknown = permissionKeys.filter((permissionKey) => !known.has(permissionKey));

  if (unknown.length > 0) {
    throw new AppError("VALIDATION_ERROR", "Quyền không hợp lệ.", { unknown });
  }
}

export function createRoleDefinition(
  input: RoleInput,
  existingRoles: readonly RoleDefinition[] = roleCatalog
): RoleDefinition {
  assertKnownPermissions(input.permissionKeys);

  if (existingRoles.some((role) => role.code.toLowerCase() === input.code.toLowerCase())) {
    throw new AppError("CONFLICT", "Mã vai trò đã tồn tại.");
  }

  return {
    id: globalThis.crypto.randomUUID(),
    code: input.code,
    name: input.name,
    description: input.description ?? "",
    isSystem: false,
    permissionKeys: Array.from(new Set(input.permissionKeys)),
    userCount: 0
  };
}

export function updateRoleDefinition(
  role: RoleDefinition,
  input: Partial<RoleInput>
): RoleDefinition {
  if (role.isSystem && input.code && input.code !== role.code) {
    throw new AppError("VALIDATION_ERROR", "Không đổi mã vai trò hệ thống.");
  }

  if (input.permissionKeys) {
    assertKnownPermissions(input.permissionKeys);
  }

  return {
    ...role,
    code: input.code ?? role.code,
    name: input.name ?? role.name,
    description: input.description ?? role.description,
    permissionKeys: input.permissionKeys
      ? Array.from(new Set(input.permissionKeys))
      : role.permissionKeys
  };
}

export function assertNoAdminLockout({
  accounts,
  targetAccountId,
  nextStatus,
  nextRoleIds,
  roles = roleCatalog
}: {
  accounts: readonly AccountRoleState[];
  targetAccountId: string;
  nextStatus?: AccountStatus;
  nextRoleIds?: string[];
  roles?: readonly RoleDefinition[];
}): void {
  const activeAdminCapableAccounts = accounts.filter((account) => {
    const status = account.accountId === targetAccountId ? nextStatus ?? account.status : account.status;
    const roleIds = account.accountId === targetAccountId ? nextRoleIds ?? account.roleIds : account.roleIds;
    const permissions = getEffectivePermissions(roleIds, roles);

    return status === "active" && adminGuardPermissions.every((permission) => permissions.includes(permission));
  });

  if (activeAdminCapableAccounts.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Không thể khóa hoặc gỡ quyền quản trị khỏi tài khoản quản trị cuối cùng."
    );
  }
}

export function assertAdminAccessRemains({
  accounts,
  roles
}: {
  accounts: readonly AccountRoleState[];
  roles: readonly RoleDefinition[];
}): void {
  const hasActiveAdmin = accounts.some((account) => {
    if (account.status !== "active") return false;
    const permissions = getEffectivePermissions(account.roleIds, roles);
    return adminGuardPermissions.every((permission) => permissions.includes(permission));
  });

  if (!hasActiveAdmin) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Không thể gỡ quyền khỏi vai trò quản trị cuối cùng."
    );
  }
}
