/**
 * Inline SVG icons (24x24, stroke based, drawn for this project).
 * Usage: `icon('select')` returns an SVG string.
 */
const paths: Record<string, string> = {
  select: '<path d="M5 3l14 8-6 1.5L10 19z"/>',
  pan: '<path d="M8 12V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7c0 4-2.5 7-6 7-2.5 0-4-1.2-5.3-3.2L4 14a1.5 1.5 0 012.5-1.6L8 14"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8M8 10.5h5M10.5 8v5"/>',
  container: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  button: '<rect x="2.5" y="7" width="19" height="10" rx="3"/><path d="M8 12h8"/>',
  input: '<rect x="2.5" y="7" width="19" height="10" rx="1.5"/><path d="M7 9.5v5M6 9.5h2M6 14.5h2"/>',
  textarea: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M6.5 8.5h11M6.5 12h11M6.5 15.5h7"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l3 3 5-6"/>',
  radio: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  toggle: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="16.5" cy="12" r="3" fill="currentColor"/>',
  select_: '<rect x="2.5" y="7" width="19" height="10" rx="1.5"/><path d="M14.5 10.5l2 2 2-2"/>',
  list: '<circle cx="5" cy="7" r="1.2" fill="currentColor"/><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="17" r="1.2" fill="currentColor"/><path d="M9 7h11M9 12h11M9 17h11"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M3.5 18l5.5-5.5 4 4 2.5-2.5 5 4.5"/>',
  progress: '<rect x="2.5" y="9" width="19" height="6" rx="3"/><path d="M5 12h8" stroke-width="3"/>',
  slider: '<path d="M3 12h18"/><circle cx="14" cy="12" r="3.2" fill="var(--icon-bg, #2a2c33)"/>',
  divider: '<path d="M3 12h18"/><path d="M8 7h8M8 17h8" opacity=".45"/>',
  new: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>',
  open: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v1H7l-4 9z"/><path d="M3 19l3.5-9H22l-3.5 9z"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  export: '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M4 13v6a2 2 0 002 2h12a2 2 0 002-2v-6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="1"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>',
  magnet: '<path d="M6 4v8a6 6 0 0012 0V4"/><path d="M6 4h3v8a3 3 0 006 0V4h3"/><path d="M6 8h3M15 8h3"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8M8 10.5h5M10.5 8v5"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8M8 10.5h5"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  alignLeft: '<path d="M4 3v18"/><rect x="7" y="6" width="10" height="4" rx="1"/><rect x="7" y="14" width="14" height="4" rx="1"/>',
  alignHCenter: '<path d="M12 3v18"/><rect x="6" y="6" width="12" height="4" rx="1"/><rect x="4" y="14" width="16" height="4" rx="1"/>',
  alignRight: '<path d="M20 3v18"/><rect x="7" y="6" width="10" height="4" rx="1"/><rect x="3" y="14" width="14" height="4" rx="1"/>',
  alignTop: '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="10" rx="1"/><rect x="14" y="7" width="4" height="14" rx="1"/>',
  alignVCenter: '<path d="M3 12h18"/><rect x="6" y="6" width="4" height="12" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  alignBottom: '<path d="M3 20h18"/><rect x="6" y="7" width="4" height="10" rx="1"/><rect x="14" y="3" width="4" height="14" rx="1"/>',
  distributeH: '<path d="M4 3v18M20 3v18"/><rect x="9.5" y="7" width="5" height="10" rx="1"/>',
  distributeV: '<path d="M3 4h18M3 20h18"/><rect x="7" y="9.5" width="10" height="5" rx="1"/>',
  group: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2"/><rect x="6.5" y="6.5" width="6" height="5" rx="1"/><rect x="11.5" y="12.5" width="6" height="5" rx="1"/>',
  ungroup: '<rect x="3.5" y="4" width="8" height="7" rx="1"/><rect x="12.5" y="13" width="8" height="7" rx="1"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3 3.8M6.6 6.6A17 17 0 002 12s3.6 7 10 7a10 10 0 005.4-1.6"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  front: '<rect x="8" y="8" width="12" height="12" rx="1.5" fill="currentColor" fill-opacity=".35"/><path d="M16 5V4H4v12h1"/>',
  back: '<rect x="4" y="4" width="12" height="12" rx="1.5" fill="currentColor" fill-opacity=".35"/><path d="M19 9h1v11H9v-1"/>',
  design: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 7l3 3"/>',
  preview: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  folder: '<path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
};

export function icon(name: string, size = 18): string {
  const body = paths[name] ?? paths['container']!;
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Icon name of a tool or element type (the dropdown element "select" uses "select_", the pointer tool "select"). */
export function typeIcon(type: string): string {
  if (type === 'pointer') return 'select';
  return type === 'select' ? 'select_' : type;
}
