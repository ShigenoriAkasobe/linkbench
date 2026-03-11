import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsMessage, LinkerResult, CpuSnapshot } from './types';

interface UseWebSocketReturn {
  connected: boolean;
  running: boolean;
  currentLinker: string | null;
  statusMessages: string[];
  results: LinkerResult[];
  liveCpu: CpuSnapshot | null;
  numCores: number;
  startBenchmark: (numModules?: number) => void;
  reset: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentLinker, setCurrentLinker] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [results, setResults] = useState<LinkerResult[]>([]);
  const [liveCpu, setLiveCpu] = useState<CpuSnapshot | null>(null);
  const [numCores, setNumCores] = useState(0);

  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // 既存の接続があれば閉じる
    if (wsRef.current && wsRef.current.readyState < 2) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
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
          if (msg.results) setResults(msg.results);
          if (msg.num_cores) setNumCores(msg.num_cores);
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
          if (msg.data) {
            setResults((prev) => [...prev, msg.data!]);
          }
          break;

        case 'complete':
          setRunning(false);
          setCurrentLinker(null);
          if (msg.results) setResults(msg.results);
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

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const startBenchmark = useCallback(async (numModules = 500) => {
    setResults([]);
    setStatusMessages([]);
    setLiveCpu(null);
    setRunning(true);

    await fetch(`/api/benchmark/start?num_modules=${numModules}`, {
      method: 'POST',
    });
  }, []);

  const reset = useCallback(() => {
    setResults([]);
    setStatusMessages([]);
    setLiveCpu(null);
    setCurrentLinker(null);
  }, []);

  return {
    connected,
    running,
    currentLinker,
    statusMessages,
    results,
    liveCpu,
    numCores,
    startBenchmark,
    reset,
  };
}
