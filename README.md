# 🔗 LinkBench — リンカ パフォーマンス ベンチマーク

GNU ld / LLVM lld / mold の3つのリンカのリンク速度と、リンク中の**論理プロセッサごとのCPU使用率**を計測・可視化するウェブアプリケーションです。

![Dark Theme](https://img.shields.io/badge/theme-dark-1e293b)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)
![React](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)

## 機能

- **リンク時間比較**: 3つのリンカのリンク時間を横棒グラフで比較、スピードアップ倍率も表示
- **リアルタイムCPUモニター**: リンク中の各論理プロセッサの使用率をタスクマネージャー風のグリッドで表示
- **CPUタイムライン**: リンカ別のCPU使用率推移を折れ線グラフで表示
- **ヒートマップ**: コア別×時間のCPU使用率をヒートマップで可視化（moldの並列性が一目瞭然）
- **実行ログ**: ベンチマークの進行状況をリアルタイムで表示

## アーキテクチャ

```
linkbench/
├── backend/           # FastAPI バックエンド
│   ├── main.py        # APIサーバー + WebSocket
│   ├── benchmark.py   # ベンチマーク実行エンジン
│   ├── cpu_monitor.py # CPU使用率モニター (psutil)
│   └── requirements.txt
├── frontend/          # React + Vite + TypeScript + Tailwind CSS
│   └── src/
│       ├── App.tsx
│       ├── useWebSocket.ts
│       └── components/
│           ├── LinkTimeChart.tsx  # リンク時間比較チャート
│           ├── CpuGrid.tsx        # リアルタイムCPUグリッド
│           ├── CpuTimeline.tsx    # CPU使用率タイムライン
│           ├── CpuHeatmap.tsx     # コア別ヒートマップ
│           └── StatusLog.tsx      # 実行ログ
├── scripts/
│   ├── install_linkers.sh        # リンカインストールスクリプト
│   └── generate_bench_src.py     # ベンチマーク用C++ソース生成
└── README.md
```

## セットアップ手順

### 1. 前提条件

以下がインストールされている必要があります:

- **Linux** (Ubuntu 22.04+ 推奨)
- **Python 3.10+**
- **Node.js 18+** & npm
- **GCC / G++**

### 2. リンカのインストール

3つのリンカをインストールします:

```bash
# インストールスクリプトを実行
chmod +x scripts/install_linkers.sh
./scripts/install_linkers.sh
```

手動でインストールする場合:

```bash
# GNU ld (通常はプリインストール済み)
sudo apt-get install -y binutils

# LLVM lld
sudo apt-get install -y lld

# mold
sudo apt-get install -y mold
```

インストールの確認:

```bash
ld --version        # GNU ld
ld.lld --version    # LLVM lld
mold --version      # mold
```

### 3. バックエンド (FastAPI) のセットアップ

```bash
# Python 仮想環境を作成・有効化
python3 -m venv venv
source venv/bin/activate

# 依存パッケージをインストール
pip install -r backend/requirements.txt
```

### 4. フロントエンドのビルド

```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. サーバー起動

```bash
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

ブラウザで **http://localhost:8000** を開きます。

### 開発モード

フロントエンドをホットリロード付きで開発する場合:

```bash
# ターミナル1: バックエンド
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# ターミナル2: フロントエンド (Vite dev server)
cd frontend
npm run dev
```

開発時は **http://localhost:5173** にアクセスします（APIは自動的にバックエンドにプロキシされます）。

## 使い方

1. ブラウザでアプリを開く
2. 画面上部の「モジュール数」を選択（デフォルト: 500）
   - モジュール数が多いほどリンク時間が長くなり、差が明確になります
3. **「▶ ベンチマーク開始」** ボタンをクリック
4. 以下の順序で自動実行されます:
   - C++ ベンチマーク用ソースコード生成（多数の翻訳単位）
   - 全ソースファイルのコンパイル（`g++ -O2`、全コア並列）
   - GNU ld でリンク → CPU使用率を記録
   - LLVM lld でリンク → CPU使用率を記録
   - mold でリンク → CPU使用率を記録
5. 結果がリアルタイムで画面に表示されます

## ベンチマークの仕組み

### ソースコード生成

`scripts/generate_bench_src.py` が指定数のC++モジュールを生成します:

- 各モジュールは関数定義、グローバル変数、他モジュールへの参照を含む
- テンプレートクラス、名前空間、STL利用でシンボルテーブルを大きくする
- 相互参照によりリンカに実際の解決作業を発生させる

### CPU使用率の計測

- `psutil` ライブラリで200ms間隔で全論理プロセッサの使用率をサンプリング
- WebSocket でリアルタイムにフロントエンドへ送信
- mold はマルチスレッドリンカのため、多くのコアが高使用率になるのが観察できます

## 比較対象リンカ

| リンカ | 開発元 | 特徴 |
|--------|--------|------|
| **GNU ld** (bfd) | GNU | 伝統的なリンカ。シングルスレッドで安定だが低速 |
| **LLVM lld** | LLVM Project | LLVM製の高速リンカ。部分的にマルチスレッド |
| **mold** | Rui Ueyama | 超高速リンカ。高度な並列処理で桁違いの速度 |

## ライセンス

MIT License
