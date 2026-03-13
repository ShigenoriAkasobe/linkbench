#!/usr/bin/env bash
# MySQL ソースのダウンロードとオブジェクトファイルのビルド
# 使い方: ./scripts/prepare_mysql.sh [mysql_dir]
#
# cmake + ninja で mysqld のオブジェクトファイルのみをコンパイルし、
# リンクコマンドを抽出・保存する。

set -euo pipefail

MYSQL_VERSION="8.0.42"
MYSQL_TAG="mysql-${MYSQL_VERSION}"
MYSQL_REPO="https://github.com/mysql/mysql-server.git"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MYSQL_DIR="${1:-${PROJECT_ROOT}/mysql_bench}"
SRC_DIR="${MYSQL_DIR}/src"
BUILD_DIR="${MYSQL_DIR}/build"
STAMP_FILE="${MYSQL_DIR}/.prepared"

NUM_JOBS="$(nproc)"

echo "=== MySQL ベンチマーク準備 ==="
echo "MySQL version: ${MYSQL_VERSION}"
echo "Directory:     ${MYSQL_DIR}"
echo "Parallel jobs: ${NUM_JOBS}"
echo ""

# 既に準備済みならスキップ
if [[ -f "${STAMP_FILE}" ]]; then
    echo "既に準備済みです (${STAMP_FILE} が存在)。"
    echo "再ビルドするには ${MYSQL_DIR} を削除してください。"
    exit 0
fi

mkdir -p "${MYSQL_DIR}"

# --- 1. ソースのダウンロード ---
if [[ ! -d "${SRC_DIR}/.git" ]]; then
    echo "[1/4] MySQL ソースをクローン中 (shallow, tag=${MYSQL_TAG})..."
    git clone --depth 1 --branch "${MYSQL_TAG}" "${MYSQL_REPO}" "${SRC_DIR}"
else
    echo "[1/4] ソースは既にクローン済み。スキップ。"
fi

# --- 2. cmake 設定 ---
echo "[2/4] cmake 設定中..."
mkdir -p "${BUILD_DIR}"
cmake -S "${SRC_DIR}" -B "${BUILD_DIR}" -G Ninja \
    -DCMAKE_BUILD_TYPE=RelWithDebInfo \
    -DWITH_UNIT_TESTS=OFF \
    -DWITH_BOOST="${MYSQL_DIR}/boost" \
    -DDOWNLOAD_BOOST=1 \
    -DCMAKE_CXX_FLAGS="-w" \
    -DCMAKE_C_FLAGS="-w" \
    2>&1

# --- 3. コンパイル (リンクなしで全オブジェクトを生成) ---
echo "[3/4] オブジェクトファイルをコンパイル中 (ninja -j${NUM_JOBS})..."
echo "       (これには時間がかかります...)"

# まずリンク以外の全てをビルドする
# ninja で mysqld のコンパイルのみ（リンクは後で手動で行う）
# -k0: エラーがあっても続行
cd "${BUILD_DIR}"
ninja -j"${NUM_JOBS}" -k0 2>&1 || true

# --- 4. リンクコマンドを抽出 ---
echo "[4/4] mysqld リンクコマンドを抽出中..."

LINK_CMD_FILE="${MYSQL_DIR}/link_command.txt"

# ninja -t commands で mysqld のリンクコマンドを取得
ninja -t commands runtime_output_directory/mysqld 2>/dev/null \
    | grep -F -- '-o runtime_output_directory/mysqld' \
    | tail -1 > "${LINK_CMD_FILE}" || true

# 取得できなかった場合
if [[ ! -s "${LINK_CMD_FILE}" ]]; then
    echo "ERROR: mysqld のリンクコマンドを取得できませんでした"
    echo "  ninja -t commands runtime_output_directory/mysqld を手動で確認してください"
    exit 1
fi

if [[ -s "${LINK_CMD_FILE}" ]]; then
    echo ""
    echo "=== 準備完了 ==="
    echo "リンクコマンド: ${LINK_CMD_FILE}"
    head -c 200 "${LINK_CMD_FILE}"
    echo "..."
    touch "${STAMP_FILE}"
else
    echo "ERROR: リンクコマンドの抽出に失敗しました"
    exit 1
fi
