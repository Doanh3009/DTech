"use client";

import { ChevronDown, FlaskConical } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";

import { FloatingPanel } from "@/components/shared/FloatingPanel";
import { Drawer } from "@/components/shared/Overlays";
import { useIsPhone } from "@/lib/ui/useIsPhone";

const TestAccountPicker = dynamic(() => import("./TestAccountPicker").then((module) => module.TestAccountPicker), { ssr: false });

export function HeaderTestControl({ currentUsername, environment }: { currentUsername: string; environment: string }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const phone = useIsPhone();

  useEffect(() => {
    if (!open || phone) return;
    const frame = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open, phone]);

  const content = <div aria-label="Kiểm thử" className="app-header__test-panel" id={id} ref={panel} role={phone ? undefined : "dialog"} tabIndex={-1}>
    <TestAccountPicker compact currentUsername={currentUsername} environment={environment} />
  </div>;

  return <div className="app-header__testing">
    <button aria-controls={open ? id : undefined} aria-expanded={open} aria-haspopup="dialog" aria-label="Kiểm thử" className="app-header__test-button" onClick={() => setOpen((value) => !value)} ref={anchor} title="Kiểm thử" type="button">
      <FlaskConical aria-hidden="true" size={16} /><span className="app-header__test-label">Kiểm thử</span><ChevronDown aria-hidden="true" size={14} />
    </button>
    {phone ? <Drawer onClose={() => setOpen(false)} open={open} title="Kiểm thử">{content}</Drawer> : open ? <FloatingPanel anchor={anchor} className="app-header__test-popover" label="Kiểm thử" matchWidth={false} onClose={() => setOpen(false)} preferredWidth={340}>{content}</FloatingPanel> : null}
  </div>;
}
