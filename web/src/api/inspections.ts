import { request } from './client';
import type { CreateInspectionPayload, Inspection, PageMeta } from './types';

export function listInspections(page: number) {
  return request<Inspection[], PageMeta>(`/inspections?page=${page}`);
}

export function createInspection(payload: CreateInspectionPayload) {
  return request<Inspection>('/inspections', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
