/** Canvas size presets (web pages, devices and Minecraft GUI sizes). */
export interface CanvasPreset {
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly transparent?: boolean;
}

export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  { label: 'Bureau 1280 × 720', width: 1280, height: 720 },
  { label: 'Full HD 1920 × 1080', width: 1920, height: 1080 },
  { label: 'Portable 1366 × 768', width: 1366, height: 768 },
  { label: 'Tablette 820 × 1180', width: 820, height: 1180 },
  { label: 'Mobile 390 × 844', width: 390, height: 844 },
  { label: 'Minecraft HUD, échelle GUI 2 (960 × 540)', width: 960, height: 540, transparent: true },
  { label: 'Minecraft HUD, échelle GUI 3 (640 × 360)', width: 640, height: 360, transparent: true },
  { label: 'Minecraft HUD, échelle GUI 4 (480 × 270)', width: 480, height: 270, transparent: true },
  { label: 'Minecraft fenêtre d’inventaire (176 × 166)', width: 176, height: 166 },
  { label: 'Minecraft grand coffre (176 × 222)', width: 176, height: 222 },
];

export const FONT_SUGGESTIONS: readonly string[] = [
  'Segoe UI, Roboto, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Verdana, sans-serif',
  'Tahoma, sans-serif',
  'Trebuchet MS, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Consolas, monospace',
  'Courier New, monospace',
  'Minecraft, monospace',
  'system-ui, sans-serif',
];
