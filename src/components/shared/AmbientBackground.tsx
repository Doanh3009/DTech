"use client";
import { useState } from "react";
import { Pause, Play } from "lucide-react";
import styles from "./AmbientBackground.module.css";
export function AmbientBackground(){const [paused,setPaused]=useState(false);return <><div className={styles.ambient} data-paused={paused} aria-hidden="true"><span/><i/></div><button className={styles.toggle} aria-label={paused?"Bật hiệu ứng nền":"Dừng hiệu ứng nền"} aria-pressed={paused} type="button" onClick={()=>setPaused(v=>!v)}>{paused?<Play size={14} aria-hidden="true"/>:<Pause size={14} aria-hidden="true"/>}</button></>;}
