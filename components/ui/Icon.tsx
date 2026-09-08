/** Small line icons (24-box, 1.8 stroke). Keep the set tiny and consistent. */
const PATHS: Record<string, string> = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  project: "M4 5h16v14H4zM4 10h16M9 10v9",
  layout: "M4 4h16v16H4zM4 12h16M12 4v8M8 12v8",
  building: "M3 20h18M4 20V9l8-5 8 5v11M9 20v-6h6v6",
  outside: "M4 20V8l8-5 8 5v12M4 12h16M10 20v-5h4v5M8 12V9m8 3V9",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
  check: "M9 12l2 2 4-4m-3 10a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  plans: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6",
  help: "M12 17h.01M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4m0 7a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  undo: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  fit: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  select: "M5 3l14 8-6 2-2 6z",
  stall: "M3 20V6h18v14M3 13h18M8 6v14",
  room: "M4 4h16v16H4zM14 4v16M14 12h2",
  aisle: "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4",
  door: "M6 3h12v18H6zM14 12h.01",
  window: "M4 5h16v14H4zM12 5v14M4 12h16",
  leanto: "M3 20h18M4 20V9h9l7 4v7M13 9l7 4",
  erase: "M3 16l9-9 6 6-6 6H8zM14 19h7",
  light: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.5 1 2.5h6c0-1 .3-1.9 1-2.5A6 6 0 0 0 12 3z",
  outlet: "M5 4h14v16H5zM9.5 9v3M14.5 9v3M12 15h.01",
  switch: "M6 4h12v16H6zM12 8v8",
  panel: "M5 3h14v18H5zM8 7h8M8 11h8M8 15h5",
  fan: "M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 10c0-4 2-6 4-6-1 3-2 5-4 6M14 12c4 0 6 2 6 4-3-1-5-2-6-4M12 14c0 4-2 6-4 6 1-3 2-5 4-6M10 12c-4 0-6-2-6-4 3 1 5 2 6 4",
  waterer: "M7 21h10M9 21V9h6v12M6 9h12M12 3v6",
  heater: "M4 6h16v9H4zM8 15v4M16 15v4M8 9v3M12 9v3M16 9v3",
  chevron: "M6 9l6 6 6-6",
  back: "M15 18l-6-6 6-6",
  spark: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1",
  print: "M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z",
  cube: "M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2zm0 0v9m8-4.5L12 11 4 6.5",
  plan: "M4 4h16v16H4zM4 12h8m0 0v8m0-8V4",
  split: "M4 5h16v14H4zM12 5v14",
  colors: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 1-2 1-3a9 9 0 0 0-7-9zM7.5 12h.01M10 8h.01M15 8h.01",
};

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={PATHS[name] ?? PATHS.help} />
    </svg>
  );
}
