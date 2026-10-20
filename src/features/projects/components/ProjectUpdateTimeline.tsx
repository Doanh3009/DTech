import { AlertTriangle, CheckCircle2, FileText, ImageIcon } from "lucide-react";

import { Card } from "@/components/shared/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";

const timelineItems = [
  {
    id: "progress",
    type: "Tiến độ",
    author: "Kỹ sư hiện trường",
    timestamp: "09/09/2026 08:30",
    content: "Cập nhật ngắn, có cấu trúc và có thể gắn ảnh hoặc tài liệu.",
    severity: "Bình thường",
    icon: CheckCircle2
  },
  {
    id: "issue",
    type: "Vấn đề",
    author: "Giám sát",
    timestamp: "09/09/2026 10:15",
    content: "Vấn đề có severity, trạng thái xử lý và attachment riêng.",
    severity: "Cần chú ý",
    icon: AlertTriangle
  }
] as const;

export function ProjectUpdateTimeline() {
  return (
    <Card className="project-timeline-panel">
      <header className="panel-header">
        <div>
          <h2>Cập nhật dự án</h2>
          <p>Theo dòng thời gian, ưu tiên nội dung, attachment và mức độ xử lý.</p>
        </div>
      </header>
      <ol className="project-timeline">
        {timelineItems.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.id}>
              <span className="project-timeline__marker">
                <Icon aria-hidden="true" size={18} />
              </span>
              <article>
                <header>
                  <div>
                    <h3>{item.type}</h3>
                    <p>
                      {item.author} - {item.timestamp}
                    </p>
                  </div>
                  <StatusBadge tone={item.severity === "Cần chú ý" ? "warning" : "success"}>
                    {item.severity}
                  </StatusBadge>
                </header>
                <p>{item.content}</p>
                <div className="timeline-attachments">
                  <span>
                    <ImageIcon aria-hidden="true" size={15} />
                    Ảnh
                  </span>
                  <span>
                    <FileText aria-hidden="true" size={15} />
                    Tài liệu
                  </span>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
