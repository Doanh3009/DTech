"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarDays, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { Input, Select, Textarea } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatBusinessDate, formatBusinessDateTime, getBusinessDateKey } from "@/lib/time/timezone";
import type { InsuranceContribution, InsuranceContributionInput, InsurancePaymentStatus, InsuranceRecord } from "./sharedtypes";
import { insuranceChangeLabels, insuranceMoney, insuranceMonth, insuranceParticipationLabels, insurancePaymentLabels, latestInsuranceContribution } from "./insurancePresentation";
import styles from "./InsuranceDetails.module.css";

type Props = {
  record: InsuranceRecord;
  canEdit: boolean;
  canViewHistory: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onUpdated: () => Promise<void>;
};

function PaymentBadge({ status, recorded = true }: { status?: InsurancePaymentStatus; recorded?: boolean }) {
  return <StatusBadge tone={recorded && status === "paid" ? "success" : recorded && status === "overdue" ? "warning" : "neutral"}>{recorded && status ? insurancePaymentLabels[status] : "Chưa ghi nhận kỳ đóng"}</StatusBadge>;
}

function ContributionForm({ record, contribution, onCancel, onSaved, onSaving }: { record: InsuranceRecord; contribution?: InsuranceContribution; onCancel: () => void; onSaved: () => Promise<void>; onSaving: (saving: boolean) => void }) {
  const [month, setMonth] = useState(contribution?.contributionMonth ?? getBusinessDateKey().slice(0, 7));
  const [base, setBase] = useState(String((contribution ? contribution.contributionBase : record.contributionBase) ?? ""));
  const [rate, setRate] = useState(String((contribution ? contribution.contributionRatePercent : record.contributionRatePercent) ?? ""));
  const [amount, setAmount] = useState(String(contribution?.paidAmount ?? ""));
  const [status, setStatus] = useState<InsurancePaymentStatus>(contribution?.paymentStatus ?? "pending");
  const [paidDate, setPaidDate] = useState(contribution?.paidDate ?? "");
  const [note, setNote] = useState(contribution?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const mutation = useRef(false);
  const expectedAmount = base !== "" && rate !== "" ? Math.round(Number(base) * Number(rate) / 100) : undefined;
  const existing = !contribution && (record.contributions ?? []).some((item) => item.contributionMonth === month);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.current || existing || saved) return;
    mutation.current = true;
    setSaving(true); onSaving(true); setError("");
    const payload: InsuranceContributionInput = {
      employeeId: record.employeeId, contributionMonth: month,
      contributionBase: base === "" ? undefined : Number(base),
      contributionRatePercent: rate === "" ? undefined : Number(rate),
      paidAmount: amount === "" ? undefined : Number(amount),
      paymentStatus: status, paidDate: paidDate || undefined, note: note.trim() || undefined,
      expectedUpdatedAt: contribution?.updatedAt
    };
    let persisted = false;
    try {
      const response = await fetch("/api/v1/insurance/contributions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu kỳ đóng.");
      persisted = true; setSaved(true);
      await onSaved();
    } catch (reason) {
      setError(persisted ? "Đã lưu kỳ đóng. Không thể tải lại dữ liệu." : reason instanceof Error ? reason.message : "Không thể lưu kỳ đóng.");
    } finally {
      mutation.current = false; setSaving(false); onSaving(false);
    }
  }

  return <form className={styles.contributionForm} onSubmit={submit}>
    <Button className={styles.back} disabled={saving} leftIcon={<ArrowLeft aria-hidden="true" size={16} />} onClick={onCancel} variant="ghost">Quay lại hồ sơ</Button>
    <div className={styles.formIdentity}><strong>{record.employeeName}</strong><span>{record.employeeCode} · {record.socialInsuranceNumber}</span></div>
    <div className={styles.formGrid}>
      <Input label="Kỳ đóng" name="contributionMonth" type="month" required readOnly={Boolean(contribution)} value={month} onChange={(event) => setMonth(event.target.value)} error={existing ? "Kỳ đóng đã có trong quá trình đóng." : undefined} />
      <Select label="Tình trạng đóng" name="paymentStatus" value={status} onChange={(event) => { const nextStatus = event.target.value as InsurancePaymentStatus; setStatus(nextStatus); if (nextStatus !== "paid") { setAmount(""); setPaidDate(""); } }} options={Object.entries(insurancePaymentLabels).map(([value, label]) => ({ value, label }))} />
      <Input label="Mức lương đóng" name="contributionBase" min="0" max="1000000000000" type="number" value={base} onChange={(event) => setBase(event.target.value)} />
      <Input label="Tỷ lệ đóng (%)" name="contributionRatePercent" min="0" max="100" step="0.01" type="number" value={rate} onChange={(event) => setRate(event.target.value)} />
      <div className={styles.formAmount}><span>Tạm tính</span><strong>{insuranceMoney(expectedAmount)}</strong></div>
      {status === "paid" ? <><Input label="Số tiền đã đóng" name="paidAmount" min="0" max="1000000000000" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Input label="Ngày đóng" name="paidDate" type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} /></> : null}
      <div className={styles.fullWidth}><Textarea label="Ghi chú" maxLength={500} name="note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></div>
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <footer className={styles.formFooter}><Button disabled={saving} onClick={onCancel}>Hủy</Button>{saved ? <Button disabled={saving} onClick={() => { setSaving(true); onSaving(true); void onSaved().catch(() => setError("Đã lưu kỳ đóng. Không thể tải lại dữ liệu.")).finally(() => { setSaving(false); onSaving(false); }); }} variant="primary">Tải lại</Button> : <Button busy={saving} disabled={existing} type="submit" variant="primary">Lưu kỳ đóng</Button>}</footer>
  </form>;
}

export function InsuranceDetails({ record, canEdit, canViewHistory, onClose, onEditProfile, onUpdated }: Props) {
  const [tab, setTab] = useState<"contributions" | "history">("contributions");
  const [year, setYear] = useState("");
  const [editor, setEditor] = useState<{ contribution?: InsuranceContribution }>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const tabsId = useId();
  const contributions = [...(record.contributions ?? [])].sort((left, right) => right.contributionMonth.localeCompare(left.contributionMonth));
  const current = latestInsuranceContribution(contributions);
  const years = [...new Set(contributions.map((item) => item.contributionMonth.slice(0, 4)))].sort().reverse();
  const visible = contributions.filter((item) => !year || item.contributionMonth.startsWith(`${year}-`));
  const currentStatus = current?.paymentStatus ?? record.paymentStatus;
  const currentMonth = current?.contributionMonth ?? record.contributionMonth;
  const currentBase = current ? current.contributionBase : record.contributionBase;
  const currentRate = current ? current.contributionRatePercent : record.contributionRatePercent;
  const currentExpected = current?.expectedAmount ?? (currentBase != null && currentRate != null ? Math.round(currentBase * currentRate / 100) : undefined);
  const activeTab = canViewHistory ? tab : "contributions";
  const close = () => { if (!saving) { if (editor) setEditor(undefined); else onClose(); } };

  return <Drawer className={styles.drawer} open onClose={close} title={editor ? editor.contribution ? "Cập nhật kỳ đóng BHXH" : "Ghi nhận kỳ đóng BHXH" : `BHXH · ${record.employeeName}`}>
    {editor ? <ContributionForm key={editor.contribution?.id ?? "new"} record={record} contribution={editor.contribution} onCancel={() => setEditor(undefined)} onSaving={setSaving} onSaved={async () => { await onUpdated(); setEditor(undefined); setNotice("Đã lưu kỳ đóng"); }} /> : <div className={styles.body}>
      <section className={styles.identity} aria-label="Hồ sơ BHXH">
        <div className={styles.identityIcon}><ShieldCheck aria-hidden="true" size={25} /></div>
        <div className={styles.identityName}><strong>{record.employeeName}</strong><span>{record.employeeCode}</span></div>
        <StatusBadge tone={record.participationStatus === "active" ? "success" : "neutral"}>{insuranceParticipationLabels[record.participationStatus] ?? "—"}</StatusBadge>
        <dl className={styles.profileFacts}><div><dt>Mã số BHXH</dt><dd>{record.socialInsuranceNumber}</dd></div><div><dt>Ngày bắt đầu</dt><dd>{record.startDate ? formatBusinessDate(record.startDate) : "—"}</dd></div><div><dt>Khoản tham gia</dt><dd>{[[record.socialInsuranceEnabled, "BHXH"], [record.healthInsuranceEnabled, "BHYT"], [record.unemploymentInsuranceEnabled, "BHTN"]].filter(([enabled]) => enabled).map(([, label]) => label).join(" · ") || "—"}</dd></div><div><dt>Mức lương đóng</dt><dd>{insuranceMoney(record.contributionBase)}</dd></div><div><dt>Tỷ lệ đóng</dt><dd>{record.contributionRatePercent == null ? "—" : `${record.contributionRatePercent}%`}</dd></div><div><dt>Cập nhật hồ sơ</dt><dd>{formatBusinessDateTime(record.updatedAt)}</dd></div></dl>
        {canEdit ? <Button className={styles.editProfile} onClick={onEditProfile} size="sm">Cập nhật hồ sơ</Button> : null}
      </section>
      <section className={styles.current} aria-label="Tình trạng kỳ đóng gần nhất">
        <header><div><span>Kỳ đóng gần nhất</span><strong>{insuranceMonth(currentMonth)}</strong></div><PaymentBadge recorded={Boolean(currentMonth)} status={currentStatus} /></header>
        <dl className={styles.currentFacts}><div><dt>Mức lương đóng</dt><dd>{insuranceMoney(currentBase)}</dd></div><div><dt>Tỷ lệ đóng</dt><dd>{currentRate == null ? "—" : `${currentRate}%`}</dd></div><div><dt>Tạm tính</dt><dd>{insuranceMoney(currentExpected)}</dd></div><div><dt>Đã đóng</dt><dd>{insuranceMoney(current?.paidAmount)}</dd></div></dl>
      </section>
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
      <div className={styles.tabs} role="tablist" aria-label="Thông tin bảo hiểm" onKeyDown={(event) => { if (!canViewHistory || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? "contributions" : event.key === "End" ? "history" : activeTab === "contributions" ? "history" : "contributions"; setTab(next); document.getElementById(`${tabsId}-${next}`)?.focus(); }}>
        <button id={`${tabsId}-contributions`} aria-controls={`${tabsId}-panel-contributions`} aria-selected={activeTab === "contributions"} onClick={() => setTab("contributions")} role="tab" tabIndex={activeTab === "contributions" ? 0 : -1} type="button">Quá trình đóng <span>{contributions.length}</span></button>
        {canViewHistory ? <button id={`${tabsId}-history`} aria-controls={`${tabsId}-panel-history`} aria-selected={activeTab === "history"} onClick={() => setTab("history")} role="tab" tabIndex={activeTab === "history" ? 0 : -1} type="button">Lịch sử điều chỉnh</button> : null}
      </div>
      {activeTab === "contributions" ? <section id={`${tabsId}-panel-contributions`} aria-labelledby={`${tabsId}-contributions`} role="tabpanel" tabIndex={0}>
        <div className={styles.ledgerToolbar}><Select label="Năm đóng" labelHidden value={year} onChange={(event) => setYear(event.target.value)} options={[{ value: "", label: "Tất cả năm" }, ...years.map((item) => ({ value: item, label: item }))]} />{canEdit ? <Button leftIcon={<Plus aria-hidden="true" size={16} />} onClick={() => { setNotice(""); setEditor({}); }} variant="primary">Ghi nhận kỳ đóng</Button> : null}</div>
        {visible.length ? <div className={styles.ledgerWrap}><table className={styles.ledgerTable} aria-label="Các kỳ đóng BHXH"><thead><tr><th scope="col">Kỳ đóng</th><th scope="col">Mức lương / Tỷ lệ</th><th scope="col">Tạm tính</th><th scope="col">Đã đóng</th><th scope="col">Tình trạng / Ngày đóng</th>{canEdit ? <th scope="col">Thao tác</th> : null}</tr></thead><tbody>{visible.map((item) => <tr key={item.id}>
          <td className={styles.monthCell} data-label="Kỳ đóng"><strong>{insuranceMonth(item.contributionMonth)}</strong>{item.source === "legacy_profile" ? <small>Từ hồ sơ BHXH</small> : null}{item.note ? <span className={styles.periodNote}>{item.note}</span> : null}</td>
          <td data-label="Mức lương / Tỷ lệ"><strong>{insuranceMoney(item.contributionBase)}</strong><small>{item.contributionRatePercent == null ? "—" : `${item.contributionRatePercent}%`}</small></td>
          <td data-label="Tạm tính"><strong>{insuranceMoney(item.expectedAmount)}</strong></td>
          <td data-label="Đã đóng"><strong>{insuranceMoney(item.paidAmount)}</strong></td>
          <td className={styles.statusCell} data-label="Tình trạng / Ngày đóng"><PaymentBadge status={item.paymentStatus} /><small>{item.paidDate ? formatBusinessDate(item.paidDate) : "—"}</small></td>
          {canEdit ? <td className={styles.periodAction} data-label="Thao tác"><Button aria-label={`Cập nhật kỳ ${insuranceMonth(item.contributionMonth)}`} onClick={() => { setNotice(""); setEditor({ contribution: item }); }} size="sm">Cập nhật</Button></td> : null}
        </tr>)}</tbody></table></div> : <div className={styles.empty}><CalendarDays aria-hidden="true" size={28} /><strong>{year ? `Chưa ghi nhận kỳ đóng năm ${year}` : "Chưa ghi nhận quá trình đóng"}</strong></div>}
      </section> : <section id={`${tabsId}-panel-history`} aria-labelledby={`${tabsId}-history`} role="tabpanel"><ol className={styles.history}>{(record.history ?? []).map((item) => <li key={item.id}><header><strong>{insuranceChangeLabels[item.changeType] ?? item.changeType}</strong><time dateTime={item.effectiveDate}>{formatBusinessDate(item.effectiveDate)}</time></header><dl className={styles.profileFacts}><div><dt>Kỳ đóng</dt><dd>{insuranceMonth(String(item.snapshot?.contributionMonth ?? ""))}</dd></div><div><dt>Tình trạng đóng</dt><dd>{insurancePaymentLabels[item.snapshot?.paymentStatus as InsurancePaymentStatus] ?? "Chưa ghi nhận"}</dd></div><div><dt>Mức lương đóng</dt><dd>{insuranceMoney(item.snapshot?.contributionBase == null ? undefined : Number(item.snapshot.contributionBase))}</dd></div></dl><p className={styles.note}>{item.reason}</p><footer><span>{item.changedByName} · {formatBusinessDateTime(item.changedAt)}</span>{item.fileId ? <a href={`/api/v1/files/${item.fileId}/signed-url`} rel="noreferrer" target="_blank">{item.fileName ?? "Tài liệu"}</a> : null}</footer></li>)}</ol>{!record.history?.length ? <div className={styles.empty}><strong>Chưa có lịch sử điều chỉnh</strong></div> : null}</section>}
    </div>}
  </Drawer>;
}
