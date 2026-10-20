import type {
  AppAccountRecord,
  Department,
  EmployeeContract,
  EmployeeDocument,
  EmployeeEmergencyContact,
  EmployeeHistoryEvent,
  EmployeeRecord,
  EmployeeSensitiveProfile,
  EmploymentType,
  Position
} from "@/features/employees/types";

export const departments: Department[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    code: "board",
    name: "Ban giám đốc",
    active: true,
    sortOrder: 10
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    code: "hr",
    name: "Nhân sự",
    active: true,
    sortOrder: 20
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    code: "engineering",
    name: "Kỹ thuật",
    active: true,
    sortOrder: 30
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    code: "construction",
    name: "Công trường",
    active: true,
    sortOrder: 40
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    code: "warehouse",
    name: "Kho",
    active: true,
    sortOrder: 50
  }
];

export const positions: Position[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    code: "director",
    name: "Giám đốc",
    active: true,
    sortOrder: 10
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    code: "hr_specialist",
    name: "Nhân viên nhân sự",
    departmentId: "10000000-0000-4000-8000-000000000002",
    active: true,
    sortOrder: 20
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    code: "engineer",
    name: "Kỹ sư",
    departmentId: "10000000-0000-4000-8000-000000000003",
    active: true,
    sortOrder: 30
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    code: "site_supervisor",
    name: "Giám sát hiện trường",
    departmentId: "10000000-0000-4000-8000-000000000004",
    active: true,
    sortOrder: 40
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    code: "worker",
    name: "Công nhân",
    departmentId: "10000000-0000-4000-8000-000000000004",
    active: true,
    sortOrder: 50
  }
];

export const employmentTypes: EmploymentType[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    code: "office_employee",
    name: "Nhân viên văn phòng",
    workerCategory: "office",
    active: true,
    sortOrder: 10
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    code: "engineer",
    name: "Kỹ sư",
    workerCategory: "engineer",
    active: true,
    sortOrder: 20
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    code: "supervisor",
    name: "Giám sát",
    workerCategory: "supervisor",
    active: true,
    sortOrder: 30
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    code: "worker",
    name: "Công nhân",
    workerCategory: "worker",
    active: true,
    sortOrder: 40
  },
  {
    id: "30000000-0000-4000-8000-000000000005",
    code: "seasonal_worker",
    name: "Nhân sự thời vụ",
    workerCategory: "seasonal",
    active: true,
    sortOrder: 50
  },
  {
    id: "30000000-0000-4000-8000-000000000006",
    code: "subcontractor_worker",
    name: "Nhân sự nhà thầu phụ",
    workerCategory: "contractor",
    active: true,
    sortOrder: 60
  },
  {
    id: "30000000-0000-4000-8000-000000000007",
    code: "support_staff",
    name: "Nhân sự hỗ trợ",
    workerCategory: "support",
    active: true,
    sortOrder: 70
  }
];

export const employeeRecords: EmployeeRecord[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    employeeCode: "NV001",
    fullName: "Nguyễn Văn An",
    displayName: "An Nguyễn",
    dateOfBirth: "1992-05-12",
    gender: "male",
    personalPhone: "0901234567",
    normalizedPhone: "84901234567",
    personalEmail: "an.nguyen@example.com",
    companyEmail: "an.nguyen@chautuan.local",
    currentAddress: "Quận 7, TP. Hồ Chí Minh",
    permanentAddress: "Biên Hòa, Đồng Nai",
    province: "TP. Hồ Chí Minh",
    ward: "Tân Phong",
    country: "Việt Nam",
    departmentId: "10000000-0000-4000-8000-000000000003",
    positionId: "20000000-0000-4000-8000-000000000003",
    employmentTypeId: "30000000-0000-4000-8000-000000000002",
    managerEmployeeId: "40000000-0000-4000-8000-000000000003",
    joinDate: "2024-03-15",
    probationStartDate: "2024-03-15",
    officialDate: "2024-05-15",
    employmentStatus: "active",
    profileStatus: "complete",
    profileCompleteness: 92,
    createdBy: "demo-admin",
    createdAt: "2026-09-09T02:00:00.000Z",
    updatedAt: "2026-09-09T02:00:00.000Z",
    rowVersion: 3
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    employeeCode: "CN018",
    fullName: "Trần Thị Bình",
    displayName: "Bình Trần",
    gender: "female",
    personalPhone: "0912345678",
    normalizedPhone: "84912345678",
    currentAddress: "Thủ Đức, TP. Hồ Chí Minh",
    province: "TP. Hồ Chí Minh",
    country: "Việt Nam",
    departmentId: "10000000-0000-4000-8000-000000000004",
    positionId: "20000000-0000-4000-8000-000000000005",
    employmentTypeId: "30000000-0000-4000-8000-000000000006",
    managerEmployeeId: "40000000-0000-4000-8000-000000000003",
    contractorName: "Đội thi công Minh Phát",
    joinDate: "2026-08-20",
    employmentStatus: "pending_onboarding",
    profileStatus: "pending_hr_completion",
    profileCompleteness: 48,
    note: "Hồ sơ tạm do giám sát tạo, chờ HR hoàn thiện.",
    createdBy: "acct-supervisor",
    createdAt: "2026-09-09T03:00:00.000Z",
    updatedAt: "2026-09-09T03:00:00.000Z",
    rowVersion: 1
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    employeeCode: "GS004",
    fullName: "Lê Quang Hưng",
    displayName: "Hưng Lê",
    dateOfBirth: "1988-11-04",
    gender: "male",
    personalPhone: "0987654321",
    normalizedPhone: "84987654321",
    companyEmail: "hung.le@chautuan.local",
    currentAddress: "Dĩ An, Bình Dương",
    province: "Bình Dương",
    country: "Việt Nam",
    departmentId: "10000000-0000-4000-8000-000000000004",
    positionId: "20000000-0000-4000-8000-000000000004",
    employmentTypeId: "30000000-0000-4000-8000-000000000003",
    joinDate: "2023-01-09",
    officialDate: "2023-03-09",
    employmentStatus: "active",
    profileStatus: "complete",
    profileCompleteness: 86,
    createdBy: "demo-admin",
    createdAt: "2026-09-09T02:30:00.000Z",
    updatedAt: "2026-09-09T02:30:00.000Z",
    rowVersion: 4
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    employeeCode: "HR002",
    fullName: "Phạm Mai Anh",
    displayName: "Mai Anh",
    dateOfBirth: "1990-02-18",
    gender: "female",
    personalPhone: "0934567890",
    normalizedPhone: "84934567890",
    personalEmail: "maianh.pham@example.com",
    companyEmail: "maianh.pham@chautuan.local",
    currentAddress: "Quận Bình Thạnh, TP. Hồ Chí Minh",
    permanentAddress: "Nha Trang, Khánh Hòa",
    province: "TP. Hồ Chí Minh",
    country: "Việt Nam",
    departmentId: "10000000-0000-4000-8000-000000000002",
    positionId: "20000000-0000-4000-8000-000000000002",
    employmentTypeId: "30000000-0000-4000-8000-000000000001",
    joinDate: "2022-06-01",
    officialDate: "2022-08-01",
    employmentStatus: "active",
    profileStatus: "complete",
    profileCompleteness: 94,
    createdBy: "demo-admin",
    createdAt: "2026-09-09T01:30:00.000Z",
    updatedAt: "2026-09-09T01:30:00.000Z",
    rowVersion: 5
  }
];

export const sensitiveProfiles: EmployeeSensitiveProfile[] = [
  {
    employeeId: "40000000-0000-4000-8000-000000000001",
    nationalIdNumber: "079092000001",
    nationalIdIssuedDate: "2021-08-01",
    nationalIdIssuedPlace: "Cục CSQLHC về TTXH",
    nationalIdExpiryDate: "2036-08-01",
    nationalIdFrontFileId: "50000000-0000-4000-8000-000000000001",
    nationalIdBackFileId: "50000000-0000-4000-8000-000000000002",
    bankName: "Vietcombank",
    bankAccountNumber: "102345678901",
    bankAccountHolder: "NGUYEN VAN AN",
    bankBranch: "Nam Sài Gòn",
    personalTaxCode: "0312345678",
    socialInsuranceCode: "BH1234567890",
    updatedBy: "demo-admin",
    updatedAt: "2026-09-09T02:00:00.000Z"
  },
  {
    employeeId: "40000000-0000-4000-8000-000000000004",
    nationalIdNumber: "079090000002",
    nationalIdIssuedDate: "2020-04-14",
    nationalIdIssuedPlace: "Cục CSQLHC về TTXH",
    bankName: "ACB",
    bankAccountNumber: "998877665544",
    bankAccountHolder: "PHAM MAI ANH",
    personalTaxCode: "0319988776",
    socialInsuranceCode: "BH0099887766",
    updatedBy: "demo-admin",
    updatedAt: "2026-09-09T01:30:00.000Z"
  }
];

export const emergencyContacts: EmployeeEmergencyContact[] = [
  {
    id: "60000000-0000-4000-8000-000000000001",
    employeeId: "40000000-0000-4000-8000-000000000001",
    fullName: "Nguyễn Thị Lan",
    relation: "Vợ/chồng",
    phone: "0909000001",
    isPrimary: true
  },
  {
    id: "60000000-0000-4000-8000-000000000002",
    employeeId: "40000000-0000-4000-8000-000000000003",
    fullName: "Lê Minh Khang",
    relation: "Anh/chị/em",
    phone: "0909000003",
    isPrimary: true
  },
  {
    id: "60000000-0000-4000-8000-000000000003",
    employeeId: "40000000-0000-4000-8000-000000000004",
    fullName: "Phạm Quốc Việt",
    relation: "Cha/mẹ",
    phone: "0909000004",
    isPrimary: true
  }
];

export const employeeContracts: EmployeeContract[] = [
  {
    id: "70000000-0000-4000-8000-000000000001",
    employeeId: "40000000-0000-4000-8000-000000000001",
    contractNumber: "HDLD-2024-001",
    contractType: "Xác định thời hạn",
    startDate: "2024-05-15",
    endDate: "2026-05-14",
    status: "active",
    attachmentFileId: "50000000-0000-4000-8000-000000000003"
  },
  {
    id: "70000000-0000-4000-8000-000000000002",
    employeeId: "40000000-0000-4000-8000-000000000003",
    contractNumber: "HDLD-2023-014",
    contractType: "Không xác định thời hạn",
    startDate: "2023-03-09",
    status: "active",
    attachmentFileId: "50000000-0000-4000-8000-000000000004"
  }
];

export const employeeDocuments: EmployeeDocument[] = [
  {
    id: "80000000-0000-4000-8000-000000000001",
    employeeId: "40000000-0000-4000-8000-000000000001",
    documentType: "national_id",
    title: "CCCD hai mặt",
    fileId: "50000000-0000-4000-8000-000000000001",
    issuedDate: "2021-08-01",
    expiryDate: "2036-08-01",
    sensitive: true,
    uploadedBy: "demo-admin",
    uploadedAt: "2026-09-09T02:05:00.000Z"
  },
  {
    id: "80000000-0000-4000-8000-000000000002",
    employeeId: "40000000-0000-4000-8000-000000000001",
    documentType: "contract",
    title: "Hợp đồng lao động 2024",
    fileId: "50000000-0000-4000-8000-000000000003",
    sensitive: true,
    uploadedBy: "demo-admin",
    uploadedAt: "2026-09-09T02:06:00.000Z"
  },
  {
    id: "80000000-0000-4000-8000-000000000003",
    employeeId: "40000000-0000-4000-8000-000000000003",
    documentType: "certificate",
    title: "Chứng chỉ an toàn lao động",
    fileId: "50000000-0000-4000-8000-000000000005",
    issuedDate: "2025-02-01",
    expiryDate: "2027-02-01",
    sensitive: false,
    uploadedBy: "demo-admin",
    uploadedAt: "2026-09-09T02:35:00.000Z"
  }
];

export const employeeHistoryEvents: EmployeeHistoryEvent[] = [
  {
    id: "90000000-0000-4000-8000-000000000001",
    employeeId: "40000000-0000-4000-8000-000000000001",
    eventType: "joined",
    eventDate: "2024-03-15",
    actorAccountId: "demo-admin",
    after: {
      departmentName: "Kỹ thuật",
      positionName: "Kỹ sư",
      employmentStatus: "probation"
    },
    reason: "Tạo hồ sơ nhân sự",
    createdAt: "2026-09-09T02:00:00.000Z"
  },
  {
    id: "90000000-0000-4000-8000-000000000002",
    employeeId: "40000000-0000-4000-8000-000000000001",
    eventType: "probation_confirmed",
    eventDate: "2024-05-15",
    actorAccountId: "demo-admin",
    before: {
      employmentStatus: "probation"
    },
    after: {
      employmentStatus: "active",
      officialDate: "2024-05-15"
    },
    reason: "Hoàn tất thử việc",
    createdAt: "2026-09-09T02:10:00.000Z"
  },
  {
    id: "90000000-0000-4000-8000-000000000003",
    employeeId: "40000000-0000-4000-8000-000000000002",
    eventType: "joined",
    eventDate: "2026-08-20",
    actorAccountId: "acct-supervisor",
    after: {
      profileStatus: "pending_hr_completion",
      employmentTypeName: "Nhân sự nhà thầu phụ"
    },
    reason: "Tạo hồ sơ tạm tại công trường",
    createdAt: "2026-09-09T03:00:00.000Z"
  }
];

export const employeeAccounts: AppAccountRecord[] = [
  {
    id: "demo-admin",
    employeeId: "40000000-0000-4000-8000-000000000004",
    displayName: "Phạm Mai Anh",
    loginEmail: "admin@chautuan.local",
    loginPhone: "0934567890",
    employeeCodeIdentifier: "HR002",
    status: "active",
    roleIds: ["role-admin"],
    activatedAt: "2026-09-09T01:30:00.000Z",
    lastLoginAt: "2026-09-10T01:00:00.000Z",
    createdAt: "2026-09-09T01:30:00.000Z",
    updatedAt: "2026-09-09T01:30:00.000Z"
  },
  {
    id: "acct-an",
    employeeId: "40000000-0000-4000-8000-000000000001",
    displayName: "Nguyễn Văn An",
    loginEmail: "an.nguyen@chautuan.local",
    loginPhone: "0901234567",
    employeeCodeIdentifier: "NV001",
    status: "active",
    roleIds: ["role-employee"],
    activatedAt: "2024-05-16T02:00:00.000Z",
    lastLoginAt: "2026-09-08T10:30:00.000Z",
    createdAt: "2024-05-16T02:00:00.000Z",
    updatedAt: "2026-09-08T10:30:00.000Z"
  },
  {
    id: "acct-supervisor",
    employeeId: "40000000-0000-4000-8000-000000000003",
    displayName: "Lê Quang Hưng",
    loginEmail: "hung.le@chautuan.local",
    loginPhone: "0987654321",
    employeeCodeIdentifier: "GS004",
    status: "active",
    roleIds: ["role-supervisor", "role-employee"],
    activatedAt: "2023-03-10T02:00:00.000Z",
    lastLoginAt: "2026-09-09T12:00:00.000Z",
    createdAt: "2023-03-10T02:00:00.000Z",
    updatedAt: "2026-09-09T12:00:00.000Z"
  }
];
