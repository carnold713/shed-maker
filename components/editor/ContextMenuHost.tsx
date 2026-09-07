"use client";

import { useCallback } from "react";
import { useViewStore } from "@/lib/store/useViewStore";
import { ContextMenu } from "@/components/menus/ContextMenu";
import { buildMenu } from "@/components/menus/buildMenu";

/** Renders whichever context menu the plan or the 3D view requested. */
export function ContextMenuHost() {
  const target = useViewStore((s) => s.contextMenu);
  const close = useViewStore((s) => s.closeContextMenu);
  const screenshot = useCallback(() => (window as unknown as { __barnScreenshot?: () => void }).__barnScreenshot?.(), []);
  if (!target) return null;
  const items = buildMenu(target, { screenshot });
  if (items.length === 0) return null;
  return <ContextMenu x={target.x} y={target.y} items={items} onClose={close} />;
}
