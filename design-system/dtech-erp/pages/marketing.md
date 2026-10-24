# DTech public product pages

Public product identity is separate from customer branding in the authenticated ERP. The existing workspace keeps company configuration and module authorization.

## Direction

Keep the original two-column landing layout: headline and trial action on the left, an ERP product preview on the right. Use Inter already bundled in the project, a warm white canvas and forest green actions. Marketing semantic colors are scoped to `Marketing.module.css`; operational surfaces use shared tokens.

The signature visual is the ERP interface itself: a responsive working preview tilted in CSS perspective, with a background window, floating analytics panel and approval card. `ProductShowcase.tsx` owns this composition; `FeatureIllustration.tsx` supplies smaller interface illustrations. Use depth, restrained shadows and readable interface geometry. Do not substitute mascots, abstract sculptures, industrial campuses, warehouses or construction-site renders. No generated raster asset is used in the final landing. The tabs remain pointer/keyboard operable; focus straightens the main screen, motion can be paused and reduced motion disables animations.

The ui-ux-pro-max design-system search for `ERP construction professional landing` supported the minimal enterprise grid and hero-led primary CTA. Its orange industrial palette and editorial font pairing were not adopted because the existing DTech identity and Vietnamese typography take precedence. Targeted UX results supported stable loading geometry; installed Next 16.3.8 documentation governs prefetch behavior.

## Journey and content

`/` introduces the product → solution scope → clearly labeled construction scenario → deployment steps → FAQ → trial request. Every trial CTA leads to `/dang-ky-dung-thu`; the separate login CTA leads to `/login`. Successful intake confirms only a received request. DTech reviews it and manually provisions the agreed environment/account; no account is automatically created.

Industry scenarios are illustrative and use the same product-interface artwork. Extended scope is disclosed on demand. Publish actual customer case studies only after approval and verification of names, assets and results. Do not turn placeholder numbers, testimonials or hypothetical outcomes into public proof. Product-preview content is explicitly labeled as a UI sample. The before/after comparison uses editable scenario inputs, discloses its formula, handles a zero baseline and has an accessible data table; it does not represent measured customer results.

## Interaction

One h1, native details for FAQ/scenario disclosure, labeled inputs, visible focus, 44px touch targets and keyboard tabs in the preview. Responsive acceptance at 390/768/1440px with reduced motion. Operational and public intake tests must intercept synthetic submissions before reaching cloud data.
