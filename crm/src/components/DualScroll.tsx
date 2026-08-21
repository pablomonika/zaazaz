import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps content in a scroll container that shows a horizontal scrollbar
 * BOTH at the top and the bottom, synced together (like a spreadsheet).
 */
export default function DualScroll({ children }: { children: ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const top = topRef.current, bottom = bottomRef.current, inner = innerRef.current, spacer = spacerRef.current;
    if (!top || !bottom || !inner || !spacer) return;

    const syncWidth = () => {
      spacer.style.width = inner.scrollWidth + "px";
    };
    syncWidth();
    const ro = new ResizeObserver(syncWidth);
    ro.observe(inner);

    let lock = false;
    const onTop = () => { if (lock) return; lock = true; bottom.scrollLeft = top.scrollLeft; lock = false; };
    const onBottom = () => { if (lock) return; lock = true; top.scrollLeft = bottom.scrollLeft; lock = false; };
    top.addEventListener("scroll", onTop);
    bottom.addEventListener("scroll", onBottom);

    return () => {
      ro.disconnect();
      top.removeEventListener("scroll", onTop);
      bottom.removeEventListener("scroll", onBottom);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* top scrollbar */}
      <div ref={topRef} className="overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: "thin" }}>
        <div ref={spacerRef} style={{ height: 1 }} />
      </div>
      {/* main scroll area (vertical + horizontal) */}
      <div ref={bottomRef} className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin" }}>
        <div ref={innerRef} className="inline-block min-w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
