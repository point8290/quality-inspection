import type { RootState } from '../../app/store';

export const selectInspections = (state: RootState) => state.inspections.items;
export const selectListStatus = (state: RootState) => state.inspections.listStatus;
export const selectListError = (state: RootState) => state.inspections.listError;
export const selectPageMeta = (state: RootState) => state.inspections.meta;
export const selectCreateStatus = (state: RootState) => state.inspections.createStatus;
export const selectCreateError = (state: RootState) => state.inspections.createError;

export const selectResolveStatus = (state: RootState) => state.inspections.resolveStatus;
export const selectResolveError = (state: RootState) => state.inspections.resolveError;

/** The detail sheet reads from the store by id, so it re-renders after a resolve or refetch. */
export const selectInspectionById = (id: string | null) => (state: RootState) =>
  id === null ? null : (state.inspections.items.find((item) => item.id === id) ?? null);

/** Looks up the server's message for one field, so the form can show it inline. */
export const selectFieldError = (path: string) => (state: RootState) =>
  state.inspections.createFieldErrors.find((detail) => detail.path === path)?.message ?? null;
