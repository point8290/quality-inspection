import { request } from './client';
import type { DefectType, Severity } from './types';

export function getSeverities() {
  return request<Severity[]>('/severities');
}

export function getDefectTypes() {
  return request<DefectType[]>('/defect-types');
}
