"use client";

import { Progress } from "@heroui/progress";
import clsx from "clsx";
import { useLegendItem } from "./legend-context";

export interface LegendProgressProps {
  /** Track class name */
  trackClassName?: string;
  /** Indicator class name */
  indicatorClassName?: string;
  /** Track height. Default: "h-1.5" */
  height?: string;
}

export function LegendProgress({
  trackClassName = "",
  indicatorClassName = "",
  height = "h-1.5",
}: LegendProgressProps) {
  const { item } = useLegendItem();

  if (!item.maxValue) {
    return null;
  }

  return (
    // Pasamos el color dinámico como una variable CSS nativa al contenedor
    <div 
      className="w-full" 
      style={{ "--legend-item-color": item.color } as React.CSSProperties}
    >
      <Progress
        aria-label={item.label || "Legend progress"}
        maxValue={item.maxValue}
        value={item.value}
        radius="full"
        classNames={{
          // Track es el fondo de la barra
          track: clsx(
            "bg-legend-track overflow-hidden",
            height,
            trackClassName
          ),
          // Indicator es la barra de progreso en sí.
          indicator: clsx(
            "bg-[var(--legend-item-color)] transition-all duration-500",
            indicatorClassName
          ),
        }}
      />
    </div>
  );
}

LegendProgress.displayName = "LegendProgress";