/** Figma "Cursor theme" options: the default pointer, or a Malaysian kopitiam drink as the mouse cursor. */
export const CURSOR_THEMES = [
  { id: 'none', label: 'None', thumb: null },
  { id: 'kopi-o', label: 'KopiO', thumb: '/figma/cursors/kopi-o.png' },
  { id: 'teh-tiga-lapis', label: 'Teh tiga lapis', thumb: '/figma/cursors/teh-tiga-lapis.png' },
  { id: 'teh-tarik', label: 'Teh tarik', thumb: '/figma/cursors/teh-tarik.png' },
  { id: 'sirap-bandung', label: 'Sirap bandung', thumb: '/figma/cursors/sirap-bandung.png' },
] as const;

export type CursorThemeId = (typeof CURSOR_THEMES)[number]['id'];

export const CURSOR_STORAGE_KEY = 'vp-cursor';

export const isCursorTheme = (value: unknown): value is CursorThemeId => CURSOR_THEMES.some((t) => t.id === value);

/** Sets `data-cursor` on <html>; globals.css swaps the cursor image from it. */
export function applyCursorTheme(id: CursorThemeId) {
  if (typeof document === 'undefined') return;
  if (id === 'none') delete document.documentElement.dataset.cursor;
  else document.documentElement.dataset.cursor = id;
}
