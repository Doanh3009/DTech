# Châu Tuấn ERP — Master Design System

Revised 2026-10-03 using the supplied dashboard references and the existing ERP. Detailed component ownership lives in [UI design system](../../docs/ui-design-system.md).

## Direction

Pearl enterprise workspace matching the supplied reference: gray with pink/peach/lilac haze, translucent cards with white edges, paired light/dark soft shadows, colored ring KPIs and floating header controls. Keep the configured Châu Tuấn identity. Maintain visible control boundaries and readable contrast.

## System rules

- Semantic tokens in `src/styles/tokens.css` are the single source for color, spacing, type, radius, depth and shell geometry. Final shared skins live in `src/styles/enterprise.css`.
- Use Inter at 400/500/600 and tabular figures. Page headings use 22–28px; text metrics remain smaller than numeric metrics.
- Use pearl cards, white edges, shared reference shadows and consistent radii. Semantic badges retain readable text; charts use the reference orange/cyan/yellow/green/violet palette.
- Desktop navigation opens at 232px with names beside icons and a visible `Thu gọn` control. It collapses to an 84px icon rail with tooltips and can expand again; preserve subsequent explicit layout choices and permission filtering. The transparent top bar is 56px high. Creation actions belong to the owning page header.
- Show one visible main title per working page at every viewport. No repeated greeting, eyebrow or descriptive subtitle beneath functions, actions, permissions or navigation.
- Lists occupy available width with filters, reset, sorting, pagination, selection and row menus. Standard tables use horizontal separators; mobile records preserve their primary identity.
- Custom selects support keyboard navigation, long-list search, disabled/empty/required states and native form data. Portal menus remain in the viewport above table clipping.
- Forms preserve workflow and field order. Show labels, inline errors and clear primary/secondary actions; use sticky actions where appropriate.
- Dialogs trap and restore focus. Escape dismisses a nested dropdown before its parent. Phone dialogs retain safe areas and internal scrolling.
- Mobile exposes all authorized modules; viewport width is not a permission boundary. Preserve personal home, camera workflows and module-aware bottom navigation.
- Dashboard metrics, work queues and charts use real scoped data. Never invent series or KPIs to imitate reference images.
- Motion respects reduced motion. Icon-only controls need accessible names; status needs visible text.

## Verification

Reference widths: 390, 768, 1366, 1440 and 1920px, plus 320/360/430px personal and camera checks. Require no page overflow, normal touch targets at least 44px, visible focus and stable loading/empty/error states. Preview routes return 404 in production. See the production review for measured coverage and outstanding UAT/deployment conditions.
