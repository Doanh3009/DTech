# ERP form and function-detail override

This file specializes the master for create, edit, filter and record-detail interfaces without changing module workflow, route structure or business field order.

- Use `FormSection` to group fields already related by the business workflow; do not invent new steps or tabs.
- Use a two-column field grid on desktop and one column below 700px.
- Keep field labels visible. Compact filter controls may visually hide labels only when the accessible label remains present.
- Apply all field states from the shared component contract: default, hover, focus, required, invalid, read-only and disabled.
- Place specific validation under its field. For multiple errors, add `FormErrorSummary` before the first form section and link each item to the field id.
- Use checkbox/radio for explicit choices and switch only for immediate binary settings.
- Keep action labels concise. The sticky footer orders cancel/secondary actions before the primary save action.
- On mobile, filters stack full-width and the action bar stays above the bottom navigation and safe area.
- Do not place business descriptions under actions, permissions or navigation items.
