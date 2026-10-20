import { Bell, CheckCheck, Clock3 } from "lucide-react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";

const notificationExamples = [
  {
    id: "pending-approvals",
    title: "Việc cần xử lý",
    description: "Có hồ sơ đang chờ người phụ trách xác nhận.",
    time: "Hôm nay",
    unread: true,
    type: "Công việc"
  },
  {
    id: "sync-status",
    title: "Trạng thái đồng bộ",
    description: "Một số thao tác từ mobile đang chờ đồng bộ nền.",
    time: "Gần đây",
    unread: false,
    type: "Hệ thống"
  }
];

export function NotificationPanel() {
  return (
    <Card className="notification-panel">
      <header className="panel-header">
        <div>
          <h2>Thông báo</h2>
          <p>Theo dõi trạng thái đọc, loại thông báo và thời điểm phát sinh.</p>
        </div>
        <Button leftIcon={<CheckCheck aria-hidden="true" size={16} />} variant="secondary">
          Đánh dấu đã đọc
        </Button>
      </header>
      <div className="notification-list">
        {notificationExamples.length > 0 ? (
          notificationExamples.map((item) => (
            <article className="notification-item" key={item.id}>
              <span className={item.unread ? "notification-item__dot is-unread" : "notification-item__dot"} />
              <div className="notification-item__icon">
                {item.id === "sync-status" ? (
                  <Clock3 aria-hidden="true" size={18} />
                ) : (
                  <Bell aria-hidden="true" size={18} />
                )}
              </div>
              <div className="notification-item__body">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <small>{item.time}</small>
              </div>
              <StatusBadge tone={item.unread ? "info" : "neutral"}>{item.type}</StatusBadge>
            </article>
          ))
        ) : (
          <EmptyState description="Thông báo sẽ xuất hiện khi hệ thống phát sinh sự kiện." title="Chưa có thông báo" />
        )}
      </div>
    </Card>
  );
}
