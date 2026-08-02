import { request } from './client';
import type { CreateInspectionPayload, Inspection, PageMeta, Summary } from './types';

export function listInspections(page: number) {
  return request<Inspection[], PageMeta>(`/inspections?page=${page}`);
}

export function createInspection(payload: CreateInspectionPayload) {
  return request<Inspection>('/inspections', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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
