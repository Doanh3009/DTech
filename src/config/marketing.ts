import { appConfig } from "./app";

/** Public product copy; keep customer deployment settings and records private. */
export const marketingConfig = {
  productName: appConfig.name,
  trialHref: "/dang-ky-dung-thu",
  navigation: [
    { href: "#giai-phap", label: "Giải pháp" },
    { href: "#hieu-qua", label: "Hiệu quả" },
    { href: "#thuc-te", label: "Theo ngành" },
    { href: "/trai-nghiem", label: "Trải nghiệm" },
    { href: "#trien-khai", label: "Triển khai" }
  ],
  constructionScenario: {
    label: "Tình huống minh họa",
    industry: "Xây dựng & thi công",
    title: "Từ văn phòng đến công trường. Cùng một nhịp vận hành.",
    challenge: "Hồ sơ nhân sự, công và vật tư được tổng hợp từ nhiều bảng tính; văn phòng phải chờ cập nhật từ từng công trường.",
    scope: ["Hồ sơ & phân quyền", "Chấm công công trường", "Dự án & tiến độ", "Kho & vật tư"],
    stages: [
      { title: "Khảo sát hiện trạng", value: "Cơ cấu đội thi công, quy trình công và luồng vật tư" },
      { title: "Cấu hình theo doanh nghiệp", value: "Vai trò, module, danh mục và quy trình duyệt" },
      { title: "Đối soát trước bàn giao", value: "Bảng công, nhập xuất tồn và phạm vi truy cập" }
    ]
  },
  faqs: [
    { question: "Doanh nghiệp có cần dùng tất cả module?", answer: "Bạn chọn các module phù hợp với nhu cầu và phân quyền theo vai trò. Phạm vi triển khai được xác nhận trước khi cấu hình môi trường." },
    { question: "Dùng thử được bắt đầu như thế nào?", answer: "Gửi thông tin doanh nghiệp và nhu cầu. DIMIXO tiếp nhận, thống nhất phạm vi và cấp môi trường cùng tài khoản dùng thử riêng. Bạn đăng nhập khi đã nhận tài khoản." },
    { question: "Dữ liệu các doanh nghiệp có dùng chung không?", answer: "DIMIXO dùng nền tảng chung, tách dữ liệu và tài khoản theo từng doanh nghiệp. Phạm vi truy cập được kiểm tra theo tài khoản; gói ngành không cấp quyền xem dữ liệu doanh nghiệp khác." },
    { question: "Có hỗ trợ doanh nghiệp xây dựng không?", answer: "Có. Gói xây dựng kết nối ngân sách, xuất vật tư, chi phí nhân công / thầu phụ và cập nhật tiến độ theo từng công trình. Kế toán tài chính và các quy trình mở rộng được xác nhận riêng trong phạm vi triển khai." }
  ]
} as const;
