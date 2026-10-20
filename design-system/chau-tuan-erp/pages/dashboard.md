# Dashboard composition — 2026-10-03

This page-specific contract follows the current reference redesign and the [master system](../MASTER.md).

- Render one visible main title, Tổng quan, with compact update time and refresh action.
- Use the existing scoped server read model and permission-filtered module registry. Never expose organization payroll to a self-payslip user or add UI-only permissions.
- Show up to five real metrics in horizontal cards with decorative colored rings, bold values and labels below. Text values use a smaller section scale.
- Place at most two meaningful charts first in a 2:1 desktop grid, followed by the deduplicated operational queue and recent activity. Show empty/error states; never invent data to fill the reference layout.
- Use smooth lines for real trends, soft capsule bars for comparisons, donuts for mutually exclusive categories and a semicircle gauge for one real percentage. Progress uses 0–100%. Include accessible chart data and protected CSV export. A companion category chart can count the complete deduplicated work collection when the only supplied chart is a percentage.
- Use translucent pearl surfaces, white edges, shared paired shadows and the reference accent tokens. Do not add an oversized greeting or explanatory subtitles.
- Application links appear first at the top of the dashboard, above its title and analytics. Use a compact horizontal application bar on desktop, a stacked heading and grid on tablet/phone, and keep permission filtering and pinned order.
- Preserve account-scoped personal tasks and notes through their existing workspace APIs, below the launcher.
- Desktop uses up to five metric columns; phone uses two and stacks the working surfaces. Prevent page overflow and keep controls usable by touch and keyboard.
- Preserve reduced motion, retry, loading, empty and actual zero states. A chart with no meaningful data must not appear as a fabricated trend.
