export type BenchMotif = 'mysql' | 'clang';

export interface CpuSnapshot {
  timestamp: number;
  cores: number[];
}

export interface LinkerResult {
  linker_name: string;
  display_name: string;
  link_time: number;
  success: boolean;
  error: string;
  cpu_history: CpuSnapshot[];
  num_cores: number;
}

export interface WsMessage {
  type: 'init' | 'status' | 'cpu' | 'result' | 'complete' | 'error';
  message?: string;
  linker?: string;
  motif?: BenchMotif;
  timestamp?: number;
  cores?: number[];
  data?: LinkerResult;
  results?: LinkerResult[];
  results_by_motif?: Partial<Record<BenchMotif, LinkerResult[]>>;
  running?: boolean;
  current_linker?: string;
  current_motif?: BenchMotif;
  num_cores?: number;
  mysql_prepared?: boolean;
  clang_prepared?: boolean;
}

export interface LinkerInfo {
  name: string;
  display_name: string;
  available: boolean;
}
