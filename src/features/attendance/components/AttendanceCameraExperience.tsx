"use client";

import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";

import {
  ArrowUpRight,
  CalendarDays,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock3,
  History,
  LogIn,
  LogOut,
  MapPin,
  RefreshCcw,
  RotateCcw,
  SwitchCamera,
  Cloud,
  CloudOff,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button, IconButton } from "@/components/shared/Button";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { captureAttendancePhoto, type ProcessedAttendancePhoto } from "@/features/attendance/client/imageProcessing";
import { countPendingAttendance, listPendingAttendance, savePendingAttendance } from "@/features/attendance/client/attendanceQueue";
import { AttendanceSyncError, syncAttendanceItem } from "@/features/attendance/client/attendanceSync";
import { AttendanceLocationError, captureAttendanceLocation } from "@/features/attendance/client/locationCapture";
import { getAttendanceLateMinutes } from "@/features/attendance/services/attendanceRules";
import { pendingAttendanceEvent, withPendingAttendance } from "@/features/attendance/client/pendingDashboard";
import { canSubmitPersonalAttendance } from "@/lib/auth/applicationAccess";
import type { AttendanceCoordinates, AttendanceDashboard, AttendanceEvent, AttendanceType, PendingAttendanceItem } from "@/features/attendance/types/attendanceTypes";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import styles from "./AttendanceCameraExperience.module.css";
import { AttendanceLocationAddress } from "./AttendanceLocationAddress";

type CaptureStep = "home" | "camera" | "preview" | "saving" | "success";
type PermissionState = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "insecure";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); };
}

function formatTime(value: string | Date | null, includeSeconds = false) {
  if (!value) return includeSeconds ? "--:--:--" : "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: false
  }).format(typeof value === "string" ? new Date(value) : value);
}

function formatClockDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric"
  }).format(value) : "—";
}

function errorMessage(error: unknown): string {
  if (error instanceof AttendanceSyncError) return error.message;
  if (error instanceof DOMException && error.name === "NotAllowedError") return "Hãy cho phép trình duyệt sử dụng camera để chấm công.";
  return error instanceof Error ? error.message : "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

interface CaptureIdentity { clientEventId: string; capturedAtClient: string; intendedType: AttendanceType }
interface AttendanceCameraProps {
  initialCapture?: boolean;
  initialDashboard?: AttendanceDashboard;
  returnHref?: string;
  onClose?: () => void;
  onRecorded?: (dashboard: AttendanceDashboard) => void;
}

export function AttendanceCameraExperience({ initialCapture = false, initialDashboard, returnHref, onClose, onRecorded }: AttendanceCameraProps = {}) {
  const router = useRouter();
  const user = useCurrentUser();
  const canSubmit = canSubmitPersonalAttendance(user.permissions);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureStartedRef = useRef(false);
  const locationRequestRef = useRef(0);
  const locationAbortRef = useRef<AbortController | undefined>(undefined);
  const locationPromiseRef = useRef<Promise<AttendanceCoordinates | undefined> | undefined>(undefined);
  const coordinatesRef = useRef<AttendanceCoordinates | undefined>(undefined);
  const captureIdentityRef = useRef<CaptureIdentity | undefined>(undefined);
  const successEventRef = useRef<AttendanceEvent | undefined>(undefined);
  const dashboardRef = useRef(initialDashboard);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => { onRecordedRef.current = onRecorded; }, [onRecorded]);
  const cameraRequestRef = useRef(0);
  const photoBusyRef = useRef(false);
  const submitBusyRef = useRef(false);
  const syncBusyRef = useRef(false);
  const dashboardRequestRef = useRef<{ promise: Promise<void>; controller: AbortController } | undefined>(undefined);
  const [dashboard, setDashboard] = useState<AttendanceDashboard | undefined>(initialDashboard);
  const locationAccuracyTarget = Math.min(30, dashboard?.policy.allowedAccuracyThresholdMeters ?? 30);
  const [loadError, setLoadError] = useState<string>();
  const [step, setStep] = useState<CaptureStep>("home");
  const [cameraState, setCameraState] = useState<PermissionState>("idle");
  const [cameraError, setCameraError] = useState<string>();
  const [mobileHttpsUrl, setMobileHttpsUrl] = useState<string>();
  useLoadingActivity(cameraState === "requesting");
  const [locationState, setLocationState] = useState<PermissionState>("idle");
  const [locationError, setLocationError] = useState<string>();
  const [coordinates, setCoordinates] = useState<AttendanceCoordinates>();
  const [photo, setPhoto] = useState<ProcessedAttendancePhoto>();
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [now, setNow] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [notice, setNotice] = useState<string>();
  const [successSynced, setSuccessSynced] = useState(false);
  const [successEvent, setSuccessEvent] = useState<AttendanceEvent>();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  const loadDashboard = useCallback(() => {
    if (dashboardRequestRef.current && !dashboardRequestRef.current.controller.signal.aborted) return dashboardRequestRef.current.promise;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    const promise = (async () => { try {
      const response = await fetch("/api/v1/attendance/dashboard", { cache: "no-store", signal });
      const body = await response.json() as { ok: boolean; data?: AttendanceDashboard; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải trạng thái chấm công.");
      if (controller.signal.aborted) return;
      const updated = await withPendingAttendance(body.data).catch(() => body.data!);
      if (controller.signal.aborted) return;
      dashboardRef.current = updated;
      setDashboard(updated);
      setLoadError(undefined);
      const count = await countPendingAttendance(body.data.accountId);
      if (!controller.signal.aborted) setPendingCount(count);
    } catch (error) {
      if (!controller.signal.aborted) {
        if (dashboardRef.current) {
          const updated = await withPendingAttendance(dashboardRef.current).catch(() => dashboardRef.current!);
          if (!controller.signal.aborted) { dashboardRef.current = updated; setDashboard(updated); }
        } else setLoadError(signal.aborted ? "Tải chấm công quá lâu. Vui lòng thử lại." : errorMessage(error));
      }
    } finally { if (dashboardRequestRef.current?.controller === controller) dashboardRequestRef.current = undefined; } })();
    dashboardRequestRef.current = { promise, controller };
    return promise;
  }, []);
  useDomainReconciliation("attendance", loadDashboard);

  const syncPending = useCallback(async (manual = false) => {
    const currentDashboard = dashboardRef.current;
    if (!currentDashboard || !navigator.onLine || syncBusyRef.current || submitBusyRef.current) return;
    syncBusyRef.current = true;
    try {
      const items = await listPendingAttendance(currentDashboard.accountId);
      let attempted = false;
      for (const item of items) {
        if (!manual && item.nextRetryAt && new Date(item.nextRetryAt).getTime() > Date.now()) continue;
        attempted = true;
        try {
          const result = await syncAttendanceItem(item);
          if (successEventRef.current?.clientEventId === result.event.clientEventId) {
            successEventRef.current = result.event;
            setSuccessEvent(result.event);
            setSuccessSynced(true);
            setNotice(undefined);
          }
        } catch (error) {
          if (error instanceof AttendanceSyncError && !["NETWORK", "PHOTO_UPLOAD"].includes(error.category)) setNotice(errorMessage(error));
        }
      }
      setPendingCount(await countPendingAttendance(currentDashboard.accountId));
      if (attempted) await loadDashboard();
    } catch (error) {
      if (manual) setNotice(errorMessage(error));
    } finally { syncBusyRef.current = false; }
  }, [loadDashboard]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void loadDashboard(); });
    return () => { active = false; captureIdentityRef.current = undefined; dashboardRequestRef.current?.controller.abort(); };
  }, [loadDashboard]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setNow(new Date()); });
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  useEffect(() => {
    if (online) queueMicrotask(() => void syncPending());
    if (!online) return;
    const timer = window.setInterval(() => void syncPending(), 15_000);
    return () => window.clearInterval(timer);
  }, [online, dashboard?.accountId, syncPending]);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => () => { if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl); }, [photo?.previewUrl]);
  useEffect(() => {
    if (window.isSecureContext) return;
    const controller = new AbortController();
    void fetch("/api/v1/attendance/mobile-link", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]) })
      .then(response => response.json()).then(body => { if (!controller.signal.aborted && body.ok && typeof body.data?.url === "string") setMobileHttpsUrl(body.data.url); }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const requestLocation = useCallback(() => {
    locationAbortRef.current?.abort();
    const controller = new AbortController();
    locationAbortRef.current = controller;
    const requestId = ++locationRequestRef.current;
    coordinatesRef.current = undefined;
    setCoordinates(undefined);
    setLocationError(undefined);
    setLocationState("requesting");
    const pending = captureAttendanceLocation(navigator.geolocation, window.isSecureContext, {
      signal: controller.signal,
      targetAccuracyMeters: locationAccuracyTarget,
      onPosition: (position) => {
        if (locationRequestRef.current !== requestId || controller.signal.aborted) return;
        coordinatesRef.current = position;
        setCoordinates(position);
      }
    }).then((location) => {
      if (locationRequestRef.current !== requestId || controller.signal.aborted) return undefined;
      coordinatesRef.current = location;
      setCoordinates(location);
      setLocationState("ready");
      return location;
    }).catch((error: unknown) => {
      if (locationRequestRef.current !== requestId || controller.signal.aborted) return undefined;
      setLocationState(error instanceof AttendanceLocationError && error.code === "insecure" ? "insecure" : error instanceof AttendanceLocationError && error.code === "denied" ? "denied" : "unavailable");
      setLocationError(errorMessage(error));
      return undefined;
    });
    locationPromiseRef.current = pending;
    return pending;
  }, [locationAccuracyTarget]);

  useEffect(() => () => { locationRequestRef.current++; locationAbortRef.current?.abort(); }, []);

  const startCamera = useCallback(async (nextFacingMode = facingMode) => {
    stopCamera();
    const requestId = ++cameraRequestRef.current;
    setCameraError(undefined);
    if (!window.isSecureContext) { setCameraState("insecure"); setCameraError("Mở ứng dụng bằng HTTPS để dùng camera và GPS."); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState("unavailable"); setCameraError("Trình duyệt này chưa hỗ trợ camera. Mở bằng Safari hoặc Chrome."); return; }
    setCameraState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacingMode }, width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false });
      if (requestId !== cameraRequestRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (requestId === cameraRequestRef.current) setCameraState("ready");
    } catch (error) {
      if (requestId !== cameraRequestRef.current) return;
      stopCamera();
      setCameraState(error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "unavailable");
      setCameraError(error instanceof DOMException && error.name === "NotAllowedError" ? "Chưa có quyền camera. Cho phép camera trong cài đặt trang web rồi thử lại." : error instanceof DOMException && error.name === "NotReadableError" ? "Camera đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại." : "Chưa mở được camera. Kiểm tra quyền camera rồi thử lại.");
    }
  }, [facingMode, stopCamera]);

  const openCapture = useCallback(() => {
    setNotice(undefined);
    setStep("camera");
    setCoordinates(undefined);
    void requestLocation();
    void startCamera();
  }, [requestLocation, startCamera]);

  useEffect(() => {
    if (!initialCapture || !dashboard || autoCaptureStartedRef.current || !canSubmit || !dashboard.policy.attendanceEnabled || dashboard.nextAction === "completed") return;
    autoCaptureStartedRef.current = true;
    queueMicrotask(openCapture);
  }, [initialCapture, dashboard, canSubmit, openCapture]);

  useEffect(() => {
    if (step !== "camera" || cameraState !== "ready" || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => undefined);
  }, [step, cameraState]);

  const closeCapture = () => {
    captureIdentityRef.current = undefined;
    locationRequestRef.current++;
    locationAbortRef.current?.abort();
    stopCamera();
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(undefined);
    setStep("home");
    if (onClose) onClose();
    else if (returnHref) router.replace(returnHref);
  };

  const takePhoto = async () => {
    if (!videoRef.current || photoBusyRef.current || submitBusyRef.current || cameraState !== "ready" || !dashboard || dashboard.nextAction === "completed") return;
    photoBusyRef.current = true;
    const requestId = cameraRequestRef.current;
    const capture: CaptureIdentity = { clientEventId: crypto.randomUUID(), capturedAtClient: new Date().toISOString(), intendedType: dashboard.nextAction };
    captureIdentityRef.current = capture;
    try {
      if (videoRef.current.readyState < 2 || !videoRef.current.videoWidth) throw new Error("Camera chưa sẵn sàng. Vui lòng thử chụp lại.");
      const processed = await captureAttendancePhoto(videoRef.current);
      if (requestId !== cameraRequestRef.current) { URL.revokeObjectURL(processed.previewUrl); return; }
      setPhoto(processed);
      stopCamera();
      await submitPhoto(processed, capture);
    } catch (error) {
      if (requestId === cameraRequestRef.current) setNotice(errorMessage(error));
    } finally { photoBusyRef.current = false; }
  };

  const retake = () => {
    captureIdentityRef.current = undefined;
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(undefined);
    setStep("camera");
    if (!coordinatesRef.current && locationState !== "requesting") void requestLocation();
    void startCamera();
  };

  async function submitPhoto(processed = photo, capture = captureIdentityRef.current) {
    if (!dashboard || !processed || !capture || submitBusyRef.current) return;
    submitBusyRef.current = true;
    setStep("saving");
    // Freeze capture time and event ID before image processing, GPS, or uploads.
    let location = coordinatesRef.current;
    if ((!location || location.accuracy > locationAccuracyTarget) && locationPromiseRef.current) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        location = await Promise.race([
          locationPromiseRef.current,
          new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), location ? 6_000 : 10_000); })
        ]);
      } finally { clearTimeout(timer); }
    }
    if (captureIdentityRef.current !== capture) { submitBusyRef.current = false; return; }
    location = coordinatesRef.current ?? location;
    if (location && Math.abs(Date.parse(location.capturedAt) - Date.parse(capture.capturedAtClient)) > 60_000) location = undefined;
    locationAbortRef.current?.abort();
    const item: PendingAttendanceItem = {
      clientEventId: capture.clientEventId,
      ownerAccountId: dashboard.accountId,
      intendedType: capture.intendedType,
      capturedAtClient: capture.capturedAtClient,
      capturedOffline: !navigator.onLine,
      location,
      deviceMetadata: { platform: navigator.platform, browser: navigator.userAgent, appVersion: "0.1.0" },
      photo: processed.photo,
      thumbnail: processed.thumbnail,
      photoWidth: processed.width,
      photoHeight: processed.height,
      createdAt: capture.capturedAtClient,
      retryCount: 0,
      syncState: "local_pending"
    };
    try {
      await savePendingAttendance(item);
      const event = pendingAttendanceEvent(item, dashboard.employeeId);
      successEventRef.current = event;
      setSuccessEvent(event);
      setStep("success");
      setSuccessSynced(false);
      setNotice(undefined);
      const updated = await withPendingAttendance(dashboard).catch(() => ({ ...dashboard, todayEvents: [...dashboard.todayEvents, event], nextAction: capture.intendedType === "check_in" ? "check_out" as const : "completed" as const }));
      dashboardRef.current = updated;
      setDashboard(updated);
      onRecordedRef.current?.(updated);
      setPendingCount(await countPendingAttendance(dashboard.accountId).catch(() => 1));
      if (navigator.onLine) {
        try {
          const result = await syncAttendanceItem(item);
          successEventRef.current = result.event;
          setSuccessEvent(result.event);
          setSuccessSynced(true);
          setPendingCount(await countPendingAttendance(dashboard.accountId).catch(() => 0));
          await loadDashboard();
        } catch (error) {
          if (error instanceof AttendanceSyncError && !["NETWORK", "PHOTO_UPLOAD"].includes(error.category)) setNotice(errorMessage(error));
        }
      }
    } catch {
      setNotice("Thiết bị không thể lưu dữ liệu chấm công. Chưa có lượt chấm nào được ghi nhận.");
      setStep("preview");
    } finally { submitBusyRef.current = false; }
  }

  if (!dashboard && !loadError) return (
    <div className={styles.page}>
      <section aria-live="polite" className={`${styles.clockCard} ${styles.loadingCard}`}>
        <span className={styles.date}><CalendarDays aria-hidden="true" size={16} />{formatClockDate(now)}</span>
        <strong className={styles.clock}>{formatTime(now)}</strong>
        <StatusBadge tone="neutral">Đang tải trạng thái hôm nay</StatusBadge>
      </section>
    </div>
  );
  if (!dashboard) return loadError?.includes("chưa liên kết")
    ? <ErrorState title="Tài khoản này chưa được liên kết với hồ sơ nhân viên" description="Chức năng chấm công cá nhân chưa khả dụng." />
    : <ErrorState title="Không thể mở chấm công" description={loadError} action={<Button onClick={() => void loadDashboard()}>Thử lại</Button>} />;

  const locationLabel = coordinates
    ? <AttendanceLocationAddress accuracyMeters={coordinates.accuracy} latitude={coordinates.latitude} longitude={coordinates.longitude} />
    : locationState === "requesting" ? "Đang xác định vị trí..." : locationError ?? "Chưa có GPS";
  const lateMinutes = successEvent?.eventType === "check_in" ? getAttendanceLateMinutes(successEvent.effectiveAt, dashboard.policy) : 0;
  const nextLabel = dashboard.nextAction === "check_in" ? "Chấm vào" : dashboard.nextAction === "check_out" ? "Chấm ra" : "Đã hoàn tất";
  const attendanceStatus = !dashboard.policy.attendanceEnabled ? "Tạm ngừng" : dashboard.nextAction === "check_in" ? "Chưa chấm vào" : dashboard.nextAction === "check_out" ? "Đã chấm vào" : "Đã hoàn tất";

  if (initialCapture && step === "home" && (!dashboard.policy.attendanceEnabled || dashboard.nextAction === "completed")) {
    return <section className={styles.emptyCapture}><CheckCircle2 aria-hidden="true" size={36} /><strong>{dashboard.policy.attendanceEnabled ? "Hôm nay đã hoàn tất chấm công" : "Chấm công đang tạm ngừng"}</strong><Link href={returnHref ?? "/personal"}>Về Cá nhân<ArrowUpRight aria-hidden="true" size={16} /></Link></section>;
  }
  if (initialCapture && step === "home") return <LoadingState title="Đang mở camera" />;

  return (
    <div className={styles.page}>
      {notice ? <div className={styles.notice} role="alert"><span>{notice}</span><IconButton label="Đóng thông báo" onClick={() => setNotice(undefined)}><X size={16} /></IconButton></div> : null}
      {pendingCount > 0 ? (
        <div className={styles.pendingBar}>
          <span><RefreshCcw aria-hidden="true" size={18} />{pendingCount} lượt chờ đồng bộ</span>
          <Button disabled={!online} leftIcon={<RefreshCcw size={16} />} onClick={() => void syncPending(true)} size="sm">Thử lại</Button>
        </div>
      ) : null}

      {step === "home" ? (
        <div className={styles.homeGrid}>
          <section className={styles.clockCard} aria-label="Thời gian và ca làm hôm nay">
            <div className={styles.clockHeading}><span className={styles.eyebrow}><Clock3 aria-hidden="true" size={18} />Ca làm hôm nay</span><StatusBadge tone={dashboard.nextAction === "check_in" || !dashboard.policy.attendanceEnabled ? "neutral" : "success"}>{attendanceStatus}</StatusBadge></div>
            <span className={styles.date}><CalendarDays aria-hidden="true" size={16} />{formatClockDate(now)}</span>
            <strong className={styles.clock}>{formatTime(now, true)}</strong>
            <div className={styles.shift}><span>{dashboard.policy.shiftName}</span><b>{dashboard.policy.shiftStart} – {dashboard.policy.shiftEnd}</b></div>
            {canSubmit ? <Button className={styles.primaryAction} disabled={dashboard.nextAction === "completed" || !dashboard.policy.attendanceEnabled} leftIcon={<Camera aria-hidden="true" size={20} />} onClick={openCapture} rightIcon={<ArrowUpRight aria-hidden="true" size={18} />} size="lg" variant="primary">{nextLabel}</Button> : null}
          </section>
          <section className={styles.statusCard} aria-label="Trạng thái sẵn sàng và dòng thời gian hôm nay">
            <div className={styles.facts}>
              <div className={styles.fact}><span className={styles.factIcon}>{online ? <Cloud aria-hidden="true" size={19} /> : <CloudOff aria-hidden="true" size={19} />}</span><div><span>Kết nối</span><strong>{online ? "Trực tuyến" : "Ngoại tuyến"}</strong></div><span className={styles.connectionDot} data-online={online} /></div>
            </div>
            <div className={styles.timelineHeading}><h2>Lượt chấm hôm nay</h2><span>{dashboard.todayEvents.length} lượt</span></div>
            <ol className={styles.todayEvents}>
              {dashboard.todayEvents.length ? dashboard.todayEvents.map((event) => (
                <li key={event.id}><span className={styles.eventIcon}>{event.eventType === "check_in" ? <LogIn aria-hidden="true" size={18} /> : <LogOut aria-hidden="true" size={18} />}</span><div className={styles.eventData}><span>{event.eventType === "check_in" ? "Chấm vào" : "Chấm ra"}</span><strong>{formatTime(event.effectiveAt)}</strong></div><StatusBadge tone={event.syncStatus === "synced" ? "success" : "warning"}>{event.syncStatus === "synced" ? "Đã đồng bộ" : "Chờ đồng bộ"}</StatusBadge></li>
              )) : <li className={styles.noEvents}><Clock3 aria-hidden="true" size={24} /><span>Chưa có lượt chấm hôm nay</span></li>}
            </ol>
            {dashboard.lastEvent ? <Link className={styles.lastLink} href={`/attendance/history/${dashboard.lastEvent.attendanceDate}`}><History aria-hidden="true" size={16} /><span>Lần gần nhất: {formatTime(dashboard.lastEvent.effectiveAt)} · {dashboard.lastEvent.eventType === "check_in" ? "Chấm vào" : "Chấm ra"}</span><ArrowUpRight aria-hidden="true" size={16} /></Link> : null}
          </section>
        </div>
      ) : null}

      {step === "camera" ? (
        <section className={styles.capture} aria-label="Chụp ảnh chấm công" data-camera-state={cameraState} data-facing={facingMode}>
          <div className={styles.cameraToolbar}><div><span className={styles.toolbarIcon}><Camera aria-hidden="true" size={21} /></span><strong>{nextLabel}</strong></div><IconButton label="Đóng camera" onClick={closeCapture}><X size={20} /></IconButton></div>
          <div className={styles.livePreview}>
            <video aria-label="Camera chấm công" muted playsInline ref={videoRef} />
            {cameraState === "ready" ? <><div className={styles.cameraOverlay}><span><i />Camera sẵn sàng</span><time>{formatTime(now)}</time></div><div aria-hidden="true" className={styles.viewfinder}><i /><i /><i /><i /></div></> : null}
            {cameraState !== "ready" ? <div className={styles.cameraState}><span className={styles.cameraStateIcon}>{cameraState === "requesting" ? <Camera aria-hidden="true" size={30} /> : <CameraOff aria-hidden="true" size={30} />}</span><strong>{cameraState === "insecure" ? "Cần kết nối HTTPS" : cameraState === "requesting" ? "Đang mở camera" : "Chưa mở được camera"}</strong>{cameraError ? <span>{cameraError}</span> : null}{cameraState === "insecure" && mobileHttpsUrl ? <a className="button button--primary" href={`${mobileHttpsUrl}/attendance/quick`}>Mở bản HTTPS</a> : cameraState !== "requesting" && cameraState !== "insecure" ? <Button onClick={() => void startCamera()} variant="primary">Thử lại camera</Button> : null}</div> : null}
          </div>
          <div className={styles.captureStatus}>
            <div className={styles.locationStatus} role="status"><MapPin aria-hidden="true" size={18} /><div><span>Vị trí GPS</span><strong>{locationLabel}</strong></div></div>
            <span className={styles.networkStatus} data-online={online}>{online ? <Cloud aria-hidden="true" size={16} /> : <CloudOff aria-hidden="true" size={16} />}{online ? "Trực tuyến" : "Ngoại tuyến"}</span>
          </div>
          <div className={styles.captureActions}>
            <Button className={styles.cameraUtility} disabled={cameraState !== "ready"} leftIcon={<SwitchCamera aria-hidden="true" size={20} />} onClick={() => { const next = facingMode === "user" ? "environment" : "user"; setFacingMode(next); void startCamera(next); }} variant="ghost">Đổi camera</Button>
            <button aria-label={`Chụp và ${nextLabel.toLowerCase()}`} className={styles.shutter} disabled={cameraState !== "ready"} onClick={() => void takePhoto()} type="button"><span /><b>{nextLabel}</b></button>
            <Button className={styles.cameraUtility} disabled={locationState === "requesting" || locationState === "insecure"} leftIcon={<RefreshCcw aria-hidden="true" size={20} />} onClick={() => void requestLocation()} variant="ghost">Lấy lại GPS</Button>
          </div>
        </section>
      ) : null}

      {step === "preview" && photo ? (
        <section className={styles.photoReview} aria-label="Kiểm tra ảnh chấm công">
          <div className={styles.cameraToolbar}><div><span className={styles.toolbarIcon}><Camera aria-hidden="true" size={21} /></span><strong>Chưa lưu được lượt chấm</strong></div><IconButton label="Đóng ảnh chấm công" onClick={closeCapture}><X size={20} /></IconButton></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Ảnh chấm công vừa chụp" src={photo.previewUrl} />
          <div className={styles.captureStatus}><div className={styles.locationStatus} role="status"><MapPin aria-hidden="true" size={18} /><div><span>Vị trí GPS</span><strong>{locationLabel}</strong></div></div><span className={styles.networkStatus} data-online={online}>{online ? <Cloud aria-hidden="true" size={16} /> : <CloudOff aria-hidden="true" size={16} />}{online ? "Trực tuyến" : "Lưu trên thiết bị"}</span></div>
          <div className={styles.reviewActions}><Button leftIcon={<RotateCcw aria-hidden="true" size={16} />} onClick={retake}>Chụp lại</Button><Button className={styles.confirmAction} leftIcon={<CheckCircle2 aria-hidden="true" size={18} />} onClick={() => void submitPhoto()} size="lg" variant="primary">Lưu lại lượt chấm</Button></div>
        </section>
      ) : null}

      {step === "saving" ? <LoadingState title={locationState === "requesting" && !coordinates ? "Đang lấy GPS và ghi nhận…" : "Đang ghi nhận…"} /> : null}
      {step === "success" ? (
        <section className={styles.successCard} aria-live="polite"><span className={styles.successIcon}><CheckCircle2 aria-hidden="true" size={42} /></span><h2>{successSynced ? "Chấm công thành công" : "Đã lưu lượt chấm trên thiết bị"}</h2><span>{successEvent?.eventType === "check_in" ? "Chấm vào" : "Chấm ra"}</span><strong>{formatTime(successEvent?.effectiveAt ?? null)}</strong>{lateMinutes > 0 ? <StatusBadge tone="warning">Đi trễ {lateMinutes} phút</StatusBadge> : null}{successEvent?.latitude !== undefined && successEvent.longitude !== undefined ? <AttendanceLocationAddress accuracyMeters={successEvent.accuracyMeters} latitude={successEvent.latitude} longitude={successEvent.longitude} /> : null}<StatusBadge tone={successSynced ? "success" : "info"}>{successSynced ? "Đã đồng bộ" : "Chờ đồng bộ"}</StatusBadge><Button onClick={closeCapture} size="lg" variant="primary">{onClose || returnHref ? "Xong" : "Về màn hình hôm nay"}</Button></section>
      ) : null}
    </div>
  );
}
