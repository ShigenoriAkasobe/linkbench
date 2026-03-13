import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsMessage, LinkerResult, CpuSnapshot, BenchMotif } from './types';

interface UseWebSocketReturn {
  connected: boolean;
  running: boolean;
  currentLinker: string | null;
  statusMessages: string[];
  resultsByMotif: Partial<Record<BenchMotif, LinkerResult[]>>;
  liveCpu: CpuSnapshot | null;
  numCores: number;
  mysqlPrepared: boolean;
  clangPrepared: boolean;
  startBenchmark: (linkerName?: string, motif?: BenchMotif) => void;
  reset: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentLinker, setCurrentLinker] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [resultsByMotif, setResultsByMotif] = useState<Partial<Record<BenchMotif, LinkerResult[]>>>({});
  const [liveCpu, setLiveCpu] = useState<CpuSnapshot | null>(null);
  const [numCores, setNumCores] = useState(0);
  const [mysqlPrepared, setMysqlPrepared] = useState(true);
  const [clangPrepared, setClangPrepared] = useState(false);

  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // 既存の接続があれば閉じる
    if (wsRef.current && wsRef.current.readyState < 2) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      // 古いインスタンスのイベントは無視
      if (wsRef.current !== ws) return;
      setConnected(true);
    };
    ws.onclose = () => {
      // 古いインスタンスのイベントは無視（StrictMode対策）
      if (wsRef.current !== ws) return;
      setConnected(false);
      // 再接続を試行（タイマー重複防止）
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      // oncloseが呼ばれるので何もしない
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);

      switch (msg.type) {
        case 'init':
          setRunning(msg.running ?? false);
          setCurrentLinker(msg.current_linker ?? null);
          if (msg.results_by_motif) setResultsByMotif(msg.results_by_motif);
          if (msg.num_cores) setNumCores(msg.num_cores);
          if (msg.mysql_prepared !== undefined) setMysqlPrepared(msg.mysql_prepared);
          if (msg.clang_prepared !== undefined) setClangPrepared(msg.clang_prepared);
          break;

        case 'status':
          setStatusMessages((prev) => [...prev.slice(-49), msg.message!]);
          if (msg.message?.includes('ベンチマーク完了')) {
            setRunning(false);
            setCurrentLinker(null);
          }
          break;

        case 'cpu':
          setLiveCpu({ timestamp: msg.timestamp!, cores: msg.cores! });
          setCurrentLinker(msg.linker ?? null);
          break;

        case 'result':
          if (msg.data && msg.motif) {
            const motif = msg.motif;
            setResultsByMotif((prev) => {
              const motifResults = prev[motif] ?? [];
              const filtered = motifResults.filter(r => r.linker_name !== msg.data!.linker_name);
              const next = [...filtered, msg.data!];
              const order = ['gnu_ld', 'lld', 'mold'];
              return {
                ...prev,
                [motif]: next.sort((a, b) => order.indexOf(a.linker_name) - order.indexOf(b.linker_name)),
              };
            });
          }
          break;

        case 'complete':
          setRunning(false);
          setCurrentLinker(null);
          if (msg.results && msg.motif) {
            const motif = msg.motif;
            setResultsByMotif(prev => ({ ...prev, [motif]: msg.results! }));
          }
          break;

        case 'error':
          setStatusMessages((prev) => [...prev.slice(-49), `エラー: ${msg.message}`]);
          setRunning(false);
          break;
      }
      } catch (err) {
        console.error('WebSocket message handling error:', err);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const startBenchmark = useCallback(async (linkerName?: string, motif: BenchMotif = 'mysql') => {
    setStatusMessages([]);
    setLiveCpu(null);
    setRunning(true);
    if (!linkerName) {
      setResultsByMotif(prev => ({ ...prev, [motif]: [] }));
    }

    const params = new URLSearchParams();
    if (linkerName) params.set('linker', linkerName);
    params.set('motif', motif);
    await fetch(`/api/benchmark/start?${params}`, { method: 'POST' });
  }, []);

  const reset = useCallback(async () => {
    setResultsByMotif({});
    setStatusMessages([]);
    setLiveCpu(null);
    setCurrentLinker(null);
    await fetch('/api/benchmark/reset', { method: 'POST' });
  }, []);

  return {
    connected,
    running,
    currentLinker,
    statusMessages,
    resultsByMotif,
    liveCpu,
    numCores,
    mysqlPrepared,
    clangPrepared,
    startBenchmark,
    reset,
  };
}
