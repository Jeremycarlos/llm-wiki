"use client";

import { useEffect, useRef, type RefObject } from "react";

export function useDialogFocus(
  open: boolean,
  root: RefObject<HTMLElement>,
  onClose: () => void,
  disabled = false,
) {
  const latest = useRef({ onClose, disabled });
  latest.current = { onClose, disabled };
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
        ) ?? [],
      ).filter((item) => item.getClientRects().length);
    controls()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !latest.current.disabled) {
        event.preventDefault();
        latest.current.onClose();
      }
      if (event.key !== "Tab") return;
      const list = controls();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, root]);
}
