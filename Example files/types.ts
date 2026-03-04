export interface AuditRequest {
  topic: string;
  sources: string;
}

export enum ReliabilityStatus {
  APPROVED = 'APPROVED',
  CAUTION = 'CAUTION',
  REJECTED = 'REJECTED',
  UNKNOWN = 'UNKNOWN'
}

export interface AuditRow {
  source: string;
  status: ReliabilityStatus;
  tier: string;
  flags: string;
  action: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface AuditResult {
  markdownTable: string;
  rawText: string;
  groundingChunks: GroundingChunk[];
}

export interface ProcessingState {
  status: 'idle' | 'analyzing' | 'complete' | 'error';
  error?: string;
}
