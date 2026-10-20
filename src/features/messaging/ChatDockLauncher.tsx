"use client";

import { MessageCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

const LazyChatDock = dynamic(() => import("./ChatDock").then(module => module.ChatDock), {
  loading: () => <><button aria-label="Đang mở chat" className="chat-dock-launcher" disabled><MessageCircle aria-hidden="true" size={21} /></button><span aria-label="Đang mở chat" role="status"><LoadingSpinner /></span></>
});

/** Load the chat composer and attachment tools only when chat is first opened. */
export function ChatDockLauncher() {
  const [activated, setActivated] = useState(false);
  return activated ? <LazyChatDock initiallyOpen /> : <button aria-label="Mở chat" className="chat-dock-launcher" onClick={() => setActivated(true)}><MessageCircle aria-hidden="true" size={21} /></button>;
}
