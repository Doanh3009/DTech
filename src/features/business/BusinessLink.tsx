"use client";
import Link from "next/link";
import {useState,type ComponentProps} from "react";

/** Warm a full dynamic route only after hover, keyboard focus, or touch. */
export function BusinessLink(props:ComponentProps<typeof Link>){
 const [intent,setIntent]=useState(false);
 return <Link {...props} prefetch={intent?true:false}
  onMouseEnter={e=>{props.onMouseEnter?.(e);if(!e.defaultPrevented)setIntent(true);}}
  onFocus={e=>{props.onFocus?.(e);if(!e.defaultPrevented)setIntent(true);}}
  onTouchStart={e=>{props.onTouchStart?.(e);if(!e.defaultPrevented)setIntent(true);}}/>;
}
