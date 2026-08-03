import { request } from './client';
import type { CreateInspectionPayload, Inspection, ListQuery, PageMeta, Summary } from './types';

export function listInspections(query: ListQuery) {
  const params = new URLSearchParams();

  // Unset filters are simply absent from the URL — the server treats "no param" as "no
  // filter", so there's no empty-string special case to handle on either side.
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  return request<Inspection[], PageMeta>(`/inspections?${params.toString()}`);
}

export function createInspection(payload: CreateInspectionPayload) {
  return request<Inspection>('/inspections', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * The delta pull is a distinct sync mode, so it has its own function: `updatedSince` can't
 * be combined with sortBy/sortDir (the API answers 400), because sync mode owns its own
 * ordering — updatedAt ascending, for stable forward paging.
 */
export function pullInspectionsSince(cursor: string, page: number) {
  const params = new URLSearchParams({
    updatedSince: cursor,
    page: String(page),
    pageSize: '100',
  });

  return request<Inspection[], PageMeta>(`/inspections?${params.toString()}`);
}

export function resolveInspection(id: string, resolutionNote: string) {
  return request<Inspection>(`/inspections/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolutionNote }),
  });
}

export function getSummary() {
  return request<Summary>('/inspections/summary');
}
