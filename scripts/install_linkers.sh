#!/usr/bin/env bash
set -euo pipefail

echo "=== LinkBench: リンカインストールスクリプト ==="
echo ""

# 色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

check_command() {
    if command -v "$1" &>/dev/null; then
        echo -e "${GREEN}✓${NC} $1 が見つかりました: $(command -v "$1")"
        return 0
    else
        echo -e "${RED}✗${NC} $1 が見つかりません"
        return 1
    fi
}

echo "--- 現在のリンカ状況 ---"
check_command ld || true
check_command ld.lld || true
check_command mold || true
echo ""

# GNU ld (binutils) の確認
echo "--- 1. GNU ld (binutils) ---"
if check_command ld; then
    echo "  GNU ld は既にインストールされています"
else
    echo "  GNU ld をインストールします..."
    sudo apt-get update
    sudo apt-get install -y binutils
fi
echo ""

# LLVM lld のインストール
echo "--- 2. LLVM lld ---"
if check_command ld.lld; then
    echo "  LLVM lld は既にインストールされています"
else
    echo "  LLVM lld をインストールします..."
    sudo apt-get update
    sudo apt-get install -y lld
fi
echo ""

# mold のインストール
echo "--- 3. mold ---"
if check_command mold; then
    echo "  mold は既にインストールされています"
else
    echo "  mold をインストールします..."
    sudo apt-get update
    sudo apt-get install -y mold
fi
echo ""

# 最終確認
echo "=== インストール結果 ==="
echo -n "GNU ld:   "; ld --version 2>&1 | head -1 || echo "未インストール"
echo -n "LLVM lld: "; ld.lld --version 2>&1 | head -1 || echo "未インストール"
echo -n "mold:     "; mold --version 2>&1 | head -1 || echo "未インストール"
echo ""
echo -e "${GREEN}インストール完了！${NC}"
