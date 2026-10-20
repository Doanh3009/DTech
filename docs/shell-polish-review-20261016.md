# Shared shell review — 16/10/2026

## Changes

- The desktop navigation now sits 12 px inside the viewport with four 22 px corners. The navigation still scrolls independently and remains sticky when the document scrolls.
- The workspace canvas is painted once on the document. Transparent shell/content layers expose the same canvas through the rail corners and scrollbar gutter. The login canvas is unaffected.
- The floating chat launcher follows the inset of both expanded and collapsed navigation. The rail shadow uses a dark translucent shadow rather than a white outer glow.
- A keyboard skip link leads directly to the existing main content. It appears only when focused and adds no layout space.
- The fallback page animation degrades safely when a browser exposes `Element.animate` but rejects the animation. Existing form DOM and values remain intact.

## Checks

- Six focused test files: **23 passed** (`AppShell`, `AppRail`, `AppHeader`, `BackLink`, page motion, overlay motion lifecycle).
- ESLint passed for the four changed TypeScript files.
- Baseline screenshots: `docs/ui-evidence/shell-polish-20261016/baseline/`.
- Candidate CSS on the existing TEST deployment: `docs/ui-evidence/shell-polish-20261016/candidate/`.
  - Viewports: 320, 390, 768 and 1440 px.
  - Eight captures include both desktop sizes scrolled to the bottom and both collapsed rails with keyboard tooltips open.
  - Desktop rail geometry: x/y 12 px, height 876 px at a 900 px viewport, all corners 22 px. Browser hit testing confirms corner clipping.
  - No document overflow or runtime errors observed. The blocked PUT calls listed as `writes` in the candidate report are attempted preference persistence during collapse/expand; the audit aborted them before network submission.
- Native route transitions: `docs/ui-evidence/shell-polish-20261016/motion/report.json`.
  - Real App Router navigation at 390 and 1440 px observed native workspace enter/exit animations.
  - The same two widths with reduced motion observed zero-duration page movement.
  - No rejected view-transition promises, stuck main-content transforms or document overflow.

## Evidence limits

The browser reports above use existing TEST deployment `dpl_A9T58R3ReyHr7iBT41yruSCYhfAn` with the candidate CSS applied in the browser. They are predeployment checks, not proof that a new release has been published. Injected CSS runs after the deployed mobile motion sheet, so timing recorded there is not an assertion about final CSS order. The final release should repeat route and layout checks without injected styles. The new keyboard skip link and animation failure fallback are covered by focused component/unit tests until that final live review.

No production environment, business record, salary calculation, payroll approval or stored navigation preference was changed during this review.
