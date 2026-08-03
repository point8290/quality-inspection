/**
 * Shared sizing for interactive controls. Two rules drive every value here:
 *
 * 1. `text-base` (16px) on anything focusable. iOS Safari zooms the whole page when a
 *    focused input's font-size is under 16px — the most common mobile-web bug there is.
 * 2. `min-h-11` (44px), the minimum comfortable tap target.
 */
export const CONTROL_CLASS =
  'w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base';

export const BUTTON_PRIMARY_CLASS =
  'min-h-11 rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white disabled:opacity-40';

export const BUTTON_SECONDARY_CLASS =
  'min-h-11 rounded-lg border border-slate-300 px-4 py-3 text-base font-medium disabled:opacity-40';
