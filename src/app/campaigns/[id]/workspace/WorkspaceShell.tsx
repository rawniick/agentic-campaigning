"use client";

import type React from "react";

// WorkspaceShell — reines Layout-Primitive: Stepper oben (volle Breite),
// darunter zwei Spalten. Links die Konsole (~40%, scrollbar), rechts der
// Canvas (~60%). Unter md: stapeln die beiden Spalten untereinander.
export function WorkspaceShell(props: {
  stepper: React.ReactNode;
  console: React.ReactNode;
  canvas: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      {/* Stepper: volle Breite, oben */}
      <div className="w-full shrink-0">{props.stepper}</div>

      {/* Zwei-Spalten-Bereich; stapelt unter md: */}
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 md:flex-row">
        {/* Konsole ~40% — eigener Scroll-Container */}
        <div className="flex min-h-0 w-full min-w-[20rem] flex-col overflow-y-auto rounded-md border bg-card p-4 shadow-sm md:w-2/5">
          {props.console}
        </div>

        {/* Canvas ~60% — eigener Scroll-Container */}
        <div className="flex min-h-0 w-full min-w-0 flex-col overflow-y-auto rounded-md border bg-background p-4 shadow-sm md:w-3/5">
          {props.canvas}
        </div>
      </div>
    </div>
  );
}
