"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface SidebarTooltipProps {
  label: string;
  description?: string;
  show: boolean;
  children: React.ReactNode;
}

export default function SidebarTooltip({
  label,
  description,
  show,
  children,
}: SidebarTooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseEnter = () => {
    if (!show || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top + rect.height / 2,
      left: rect.right + 12, // 12px gap from trigger to tooltip
    });
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  if (!show) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center w-full"
    >
      {children}

      {/* Render via Portal so it breaks free from overflow-hidden / stacking contexts */}
      {mounted &&
        isVisible &&
        coords &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: "translateY(-50%)",
            }}
            className="pointer-events-none z-[9999] whitespace-nowrap rounded-lg bg-surface-container-highest/95 backdrop-blur-md border border-outline-variant px-3 py-1.5 shadow-2xl text-left"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-body-sm font-semibold text-on-surface tracking-wide">
                {label}
              </span>
            </div>
            {description && (
              <span className="block text-[11px] text-on-surface-variant font-normal leading-tight mt-0.5">
                {description}
              </span>
            )}
            {/* Arrow pointer pointing left towards the icon */}
            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 rotate-45 bg-surface-container-highest border-l border-b border-outline-variant" />
          </div>,
          document.body
        )}
    </div>
  );
}
