# Worker attendance flow review — 15 October 2026

## Corrected interactions

1. The roster previously sorted every status change with unconfirmed workers first. Marking a worker moved their row below the others. Status updates now retain the current roster order and focused button. Server session reads use a deterministic employee-code order; an in-place save preserves the visible roster order even when the response order differs.
2. The package attendance toolbar was hidden on phones, including the attendance action, search, filters, and spreadsheet export. Its responsive grid is now visible. The attendance action is labelled **Điểm danh công nhân**. Permission checks distinguish opening a roster from adjusting a submitted session.
3. A draft detail page had no action to resume attendance, while a submitted session only exposed **Chốt ngày**. Drafts now offer **Tiếp tục điểm danh**; **Lưu điểm danh** saves an unfinished roster without submitting or moving pages. **Chốt công cuối ngày** is available only after morning attendance is submitted. Its drawer records end-of-day exceptions rather than starting another attendance session.
4. Adjustments and end-of-day forms appeared below the roster and reset some fields after a failed React form action. They now use drawers, selected workers start at their actual status, and adjustment values survive failures for retry. Read-only users cannot edit. Locked sessions do not offer draft editing or another day close; the existing audited administrator adjustment permission remains available.

## Additional source corrections

- Task lists deduplicate the same project, worksite and shift when several supervisors are assigned.
- New session rosters include workers assigned to the selected shift.
- Date changes in the package workspace ignore stale fetch results and reload today's current data.
- Worker location displays use the shared readable-address component. A configured worksite address is passed only after verifying recorded GPS within its radius. Recapturing GPS clears an old known address.
- PDF and spreadsheet actions use a shared client download path that checks HTTP status, MIME and initial file signature. Error responses remain visible rather than being downloaded as files. These checks do not establish spreadsheet business correctness or replace native file-reader verification.

## Verification

- Focused component and repository tests cover stable ordering/focus, unfinished saves, offline saves, reversed server responses, draft/close-day state permissions, editable selected status, retained values on failure and verified worksite addresses.
- Shared download tests cover correct signatures, server filenames, HTTP errors, JSON/HTML responses, mislabeled content, duplicate clicks and accessible inline errors.
- TypeScript and scoped ESLint completed without errors.
- No live attendance, payroll or employee data was changed by these checks.
