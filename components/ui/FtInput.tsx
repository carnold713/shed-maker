"use client";

import { useEffect, useState } from "react";
import { formatFtIn, parseFtIn } from "@/lib/units";
import { inputClass } from "./Field";

/** Feet-inches input that commits on blur/Enter and says why a value was refused (UX audit §8). */
export function FtInput({ value, onCommit, min, max, testId, className = "", ariaLabel }: { value: number; onCommit: (ft: number) => void; min: number; max: number; testId?: string; className?: string; ariaLabel?: string }) {
  const [text, setText] = useState(formatFtIn(value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setText(formatFtIn(value));
    setError(null);
  }, [value]);
  const commit = () => {
    const parsed = parseFtIn(text);
    if (parsed === null) {
      setText(formatFtIn(value));
      setError(`Enter feet and inches, like 12' 6"`);
      return;
    }
    if (parsed < min || parsed > max) {
      setText(formatFtIn(value));
      setError(`Must be ${formatFtIn(min)}–${formatFtIn(max)}`);
      return;
    }
    setError(null);
    onCommit(parsed);
  };
  return (
    <span className="flex flex-col gap-0.5">
      <input
        className={`${inputClass} font-mono ${error ? "border-red-400" : ""} ${className}`}
        value={text}
        aria-label={ariaLabel}
        aria-invalid={!!error}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        data-testid={testId}
      />
      {error ? <span className="text-[11px] text-red-700">{error}</span> : null}
    </span>
  );
}
