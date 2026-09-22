import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

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

export const Back15Icon = (p: P) => (
  <svg {...base} {...p}>
    <path {...stroke} d="M4.6 12.5A7.5 7.5 0 1 0 8 5.9" />
    <path {...stroke} d="M8.4 2.6 7.6 6.2l3.6.9" />
    <text x="12.6" y="16" fontSize="7.4" fontWeight="700" textAnchor="middle" fill="currentColor" fontFamily="system-ui, sans-serif">15</text>
  </svg>
);

export const Fwd15Icon = (p: P) => (
  <svg {...base} {...p}>
    <path {...stroke} d="M19.4 12.5A7.5 7.5 0 1 1 16 5.9" />
    <path {...stroke} d="M15.6 2.6l.8 3.6-3.6.9" />
    <text x="11.4" y="16" fontSize="7.4" fontWeight="700" textAnchor="middle" fill="currentColor" fontFamily="system-ui, sans-serif">15</text>
  </svg>
);

export const StarIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p}>
    <path
      {...stroke}
      strokeWidth={1.8}
      fill={filled ? 'currentColor' : 'none'}
      d="M12 3.4l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.7l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"
    />
  </svg>
);

export const TrashIcon = (p: P) => (
  <svg {...base} {...p}>
    <path {...stroke} strokeWidth={1.8} d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2l.9-12.5M10.2 11v5M13.8 11v5" />
  </svg>
);

export const NoteIcon = (p: P) => (
  <svg {...base} {...p}>
    <path {...stroke} strokeWidth={1.8} d="M9 17.5V6.2l10-2v11.3" />
    <circle {...stroke} strokeWidth={1.8} cx="6.6" cy="17.6" r="2.4" />
    <circle {...stroke} strokeWidth={1.8} cx="16.6" cy="15.6" r="2.4" />
  </svg>
);

export const FolderIcon = (p: P) => (
  <svg {...base} {...p}>
    <path {...stroke} strokeWidth={1.8} d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base} {...p}>
    <path {...stroke} d="M12 5v14M5 12h14" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle {...stroke} cx="11" cy="11" r="6.5" />
    <path {...stroke} d="M16 16l4.2 4.2" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path {...stroke} d="M6 6l12 12M18 6 6 18" />
  </svg>
);
