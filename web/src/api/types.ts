// Mirrors the response envelope and payloads defined in DESIGN.md §4. Duplicated from the
// API on purpose — a shared types package is listed under "deliberately not doing" (§7.1).

export type ApiSuccess<TData, TMeta = undefined> = {
  data: TData;
  meta?: TMeta;
};

export type ApiErrorDetail = {
  path: string;
  message: string;
};

export type ApiFailure = {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
};

export type Severity = {
  code: string;
  label: string;
  rank: number;
};

export type DefectType = {
  code: string;
  label: string;
};

export type InspectionStatus = 'OPEN' | 'RESOLVED';

export type Inspection = {
  id: string;
  /** Calendar day, 'YYYY-MM-DD' — deliberately not a timestamp (DESIGN.md §2.3). */
  inspectionDate: string;
  machineId: string;
  defectType: DefectType;
  severity: Severity;
  remarks: string | null;
  status: InspectionStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type InspectionFilters = {
  status?: InspectionStatus;
  severityCode?: string;
  defectTypeCode?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type SortBy = 'createdAt' | 'inspectionDate' | 'severity';
export type SortDir = 'asc' | 'desc';

export type InspectionSort = {
  sortBy: SortBy;
  sortDir: SortDir;
};

export type ListQuery = InspectionFilters & InspectionSort & { page: number };

export type StatusCounts = {
  OPEN: number;
  RESOLVED: number;
};

export type Summary = {
  total: number;
  byStatus: StatusCounts;
  /** Keyed by severity code; labels and order come from the reference data we already hold. */
  bySeverity: Record<string, StatusCounts>;
};

export type CreateInspectionPayload = {
  /** Minted on the device, so replaying a queued create can't duplicate (DESIGN.md §5). */
  id: string;
  inspectionDate: string;
  machineId: string;
  defectTypeCode: string;
  severityCode: string;
  remarks?: string;
};
