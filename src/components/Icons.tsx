import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const;
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const Line = ({ d, ...p }: P & { d: string }) => (
  <svg {...base} {...p}>
    <path {...line} d={d} />
  </svg>
);

export const PlayIcon = (p: P) => (
  <svg {...base} {...p}>
    <path fill="currentColor" d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
  </svg>
);

export const PauseIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect fill="currentColor" x="6.5" y="5" width="4" height="14" rx="1.2" />
    <rect fill="currentColor" x="13.5" y="5" width="4" height="14" rx="1.2" />
  </svg>
);

export const PrevIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect fill="currentColor" x="5" y="5" width="2.4" height="14" rx="1" />
    <path fill="currentColor" d="M19 6.1v11.8a1 1 0 0 1-1.54.84l-8.9-5.9a1 1 0 0 1 0-1.68l8.9-5.9A1 1 0 0 1 19 6.1z" />
  </svg>
);

export const NextIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect fill="currentColor" x="16.6" y="5" width="2.4" height="14" rx="1" />
    <path fill="currentColor" d="M5 6.1v11.8a1 1 0 0 0 1.54.84l8.9-5.9a1 1 0 0 0 0-1.68l-8.9-5.9A1 1 0 0 0 5 6.1z" />
  </svg>
);

/** Circular arrow with the skip interval written inside. */
export const SkipIcon = ({ seconds, dir, ...p }: P & { seconds: number; dir: 'back' | 'forward' }) => (
  <svg {...base} {...p}>
    {dir === 'back' ? (
      <>
        <path {...line} d="M4.6 12.5A7.5 7.5 0 1 0 8 5.9" />
        <path {...line} d="M8.4 2.6 7.6 6.2l3.6.9" />
      </>
    ) : (
      <>
        <path {...line} d="M19.4 12.5A7.5 7.5 0 1 1 16 5.9" />
        <path {...line} d="M15.6 2.6l.8 3.6-3.6.9" />
      </>
    )}
    <text x={dir === 'back' ? 12.6 : 11.4} y="16" fontSize="7.2" fontWeight="700" textAnchor="middle" fill="currentColor" fontFamily="system-ui, sans-serif">
      {seconds}
    </text>
  </svg>
);

export const StarIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p}>
    <path {...line} fill={filled ? 'currentColor' : 'none'} d="M12 3.4l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.7l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z" />
  </svg>
);

export const BookmarkIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p}>
    <path {...line} fill={filled ? 'currentColor' : 'none'} d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4.2L5.5 20V5a1 1 0 0 1 1-1z" />
  </svg>
);

export const TrashIcon = (p: P) => <Line {...p} d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2l.9-12.5M10.2 11v5M13.8 11v5" />;
export const FolderIcon = (p: P) => <Line {...p} d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />;
export const PlusIcon = (p: P) => <Line {...p} d="M12 5v14M5 12h14" />;
export const CloseIcon = (p: P) => <Line {...p} d="M6 6l12 12M18 6 6 18" />;
export const CheckIcon = (p: P) => <Line {...p} d="M5 12.5l4.5 4.5L19 7.5" />;
export const ChevronDownIcon = (p: P) => <Line {...p} d="M6 9l6 6 6-6" />;
export const ChevronRightIcon = (p: P) => <Line {...p} d="M9 6l6 6-6 6" />;
export const ArrowUpIcon = (p: P) => <Line {...p} d="M12 19V5M6 11l6-6 6 6" />;
export const ArrowDownIcon = (p: P) => <Line {...p} d="M12 5v14M6 13l6 6 6-6" />;
export const MoreIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="5.5" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.7" fill="currentColor" />
  </svg>
);
export const SearchIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle {...line} cx="11" cy="11" r="6.5" />
    <path {...line} d="M16 16l4.2 4.2" />
  </svg>
);
export const HomeIcon = (p: P) => <Line {...p} d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />;
export const LibraryIcon = (p: P) => <Line {...p} d="M5 4v16M9.5 4v16M14 5.2l4.6 14.4M3.5 20h17" />;
export const GearIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle {...line} cx="12" cy="12" r="3" />
    <path
      {...line}
      d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4z"
    />
  </svg>
);
export const MoonIcon = (p: P) => <Line {...p} d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />;
export const GaugeIcon = (p: P) => <Line {...p} d="M4.5 17a8.5 8.5 0 1 1 15 0M12 13l4-4.5" />;
export const SlidersIcon = (p: P) => <Line {...p} d="M5 4v6M5 14v6M12 4v10M12 18v2M19 4v2M19 10v10M3 10h4M10 14h4M17 6h4" />;
export const QueueIcon = (p: P) => <Line {...p} d="M4 6h11M4 11h11M4 16h7M17 14v6l4-3z" />;
export const ChaptersIcon = (p: P) => <Line {...p} d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />;
export const LockIcon = (p: P) => <Line {...p} d="M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />;
export const CloudIcon = (p: P) => <Line {...p} d="M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.6 4.5 4.5 0 0 0 7 18.5z" />;
export const EditIcon = (p: P) => <Line {...p} d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16zM13.5 6.5l4 4" />;
export const DownloadIcon = (p: P) => <Line {...p} d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />;
export const UploadIcon = (p: P) => <Line {...p} d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />;
export const SortIcon = (p: P) => <Line {...p} d="M7 4v16M3.5 16.5 7 20l3.5-3.5M14 6h7M14 11h5M14 16h3" />;
export const RadioIcon = (p: P) => (
  <svg {...base} {...p}>
    <path {...line} d="M4 9h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM7 9l10-5" />
    <circle {...line} cx="8" cy="14.5" r="2.5" />
    <path {...line} d="M14 13h4M14 16h4" />
  </svg>
);
export const GoogleIcon = (p: P) => (
  <svg {...base} {...p}>
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
    <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" />
    <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" />
  </svg>
);

/* Genre marks */
export const MagnifierIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle {...line} cx="10" cy="10" r="6" />
    <path {...line} d="M14.5 14.5 20 20M7.5 10a2.5 2.5 0 0 1 2.5-2.5" />
  </svg>
);
export const KnifeIcon = (p: P) => <Line {...p} d="M20 4 8.5 15.5l-2-2L18 2zM8.5 15.5 5 19a1.4 1.4 0 0 1-2-2l3.5-3.5M11 13l2 2" />;
export const GhostIcon = (p: P) => (
  <svg {...base} {...p}>
    <path {...line} d="M5 20V10a7 7 0 0 1 14 0v10l-2.3-1.6L14.3 20 12 18.4 9.7 20l-2.4-1.6z" />
    <circle cx="9.5" cy="10.5" r="1.2" fill="currentColor" />
    <circle cx="14.5" cy="10.5" r="1.2" fill="currentColor" />
  </svg>
);
export const CompassIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle {...line} cx="12" cy="12" r="8.5" />
    <path {...line} d="m15.5 8.5-2 5-5 2 2-5z" />
  </svg>
);
export const AtomIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <ellipse {...line} cx="12" cy="12" rx="9" ry="3.6" />
    <ellipse {...line} cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
    <ellipse {...line} cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)" />
  </svg>
);
export const MasksIcon = (p: P) => <Line {...p} d="M4 4h9v6a4.5 4.5 0 0 1-9 0zM11 11.5h9v5a4.5 4.5 0 0 1-9 0zM6.5 7.5h1M9.5 7.5h1M13.5 14.5h1M16.5 14.5h1M7 11.5c.9.6 2.1.6 3 0M14 18.5c.9-.6 2.1-.6 3 0" />;
export const ChevronLeftIcon = (p: P) => <Line {...p} d="M15 6l-6 6 6 6" />;
