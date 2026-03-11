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
  timestamp?: number;
  cores?: number[];
  data?: LinkerResult;
  results?: LinkerResult[];
  running?: boolean;
  current_linker?: string;
  num_cores?: number;
}

export interface LinkerInfo {
  name: string;
  display_name: string;
  available: boolean;
}
