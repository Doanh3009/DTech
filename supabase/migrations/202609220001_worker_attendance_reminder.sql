insert into public.notification_templates(
  event_key, title_template, message_template, allowed_placeholders, mandatory
) values (
  'worker_attendance.reminder',
  'Nhắc chấm công công trường',
  '{{project_name}} chưa có điểm danh ngày {{attendance_date}}.',
  array['project_name', 'attendance_date'],
  false
)
on conflict(event_key) do nothing;
