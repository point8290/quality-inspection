import type { RootState } from '../../app/store';

export const selectInspections = (state: RootState) => state.inspections.items;
export const selectListStatus = (state: RootState) => state.inspections.listStatus;
export const selectListError = (state: RootState) => state.inspections.listError;
export const selectPageMeta = (state: RootState) => state.inspections.meta;
export const selectCreateStatus = (state: RootState) => state.inspections.createStatus;
export const selectCreateError = (state: RootState) => state.inspections.createError;

/** Looks up the server's message for one field, so the form can show it inline. */
export const selectFieldError = (path: string) => (state: RootState) =>
  state.inspections.createFieldErrors.find((detail) => detail.path === path)?.message ?? null;
