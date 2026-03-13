#!/usr/bin/env bash
# Clang 19 ソースのダウンロードとオブジェクトファイルのビルド
# 使い方: ./scripts/prepare_clang.sh [clang_dir]
#
# cmake + ninja で clang のオブジェクトファイルのみをコンパイルし、
# リンクコマンドを抽出・保存する。

set -euo pipefail

LLVM_VERSION="19.1.0"
LLVM_TAG="llvmorg-${LLVM_VERSION}"
LLVM_REPO="https://github.com/llvm/llvm-project.git"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLANG_DIR="${1:-${PROJECT_ROOT}/clang_bench}"
SRC_DIR="${CLANG_DIR}/src"
BUILD_DIR="${CLANG_DIR}/build"
STAMP_FILE="${CLANG_DIR}/.prepared"

NUM_JOBS="$(nproc)"

echo "=== Clang ベンチマーク準備 ==="
echo "LLVM version:  ${LLVM_VERSION}"
echo "Directory:     ${CLANG_DIR}"
echo "Parallel jobs: ${NUM_JOBS}"
echo ""

# 既に準備済みならスキップ
if [[ -f "${STAMP_FILE}" ]]; then
    echo "既に準備済みです (${STAMP_FILE} が存在)。"
    echo "再ビルドするには ${CLANG_DIR} を削除してください。"
    exit 0
fi

mkdir -p "${CLANG_DIR}"

# --- 1. ソースのダウンロード ---
if [[ ! -d "${SRC_DIR}/.git" ]]; then
    echo "[1/4] LLVM/Clang ソースをクローン中 (shallow, tag=${LLVM_TAG})..."
    echo "       (llvm-project は大規模です。--filter=blob:none で軽量クローンします)"
    git clone \
        --depth 1 \
        --filter=blob:none \
        --branch "${LLVM_TAG}" \
        "${LLVM_REPO}" \
        "${SRC_DIR}"
else
    echo "[1/4] ソースは既にクローン済み。スキップ。"
fi

# --- 2. cmake 設定 ---
echo "[2/4] cmake 設定中..."
mkdir -p "${BUILD_DIR}"
cmake -S "${SRC_DIR}/llvm" -B "${BUILD_DIR}" -G Ninja \
    -DCMAKE_BUILD_TYPE=RelWithDebInfo \
    -DLLVM_ENABLE_PROJECTS="clang" \
    -DLLVM_TARGETS_TO_BUILD="X86" \
    -DLLVM_INCLUDE_TESTS=OFF \
    -DLLVM_INCLUDE_EXAMPLES=OFF \
    -DLLVM_INCLUDE_BENCHMARKS=OFF \
    -DCLANG_BUILD_TOOLS=ON \
    -DCMAKE_CXX_FLAGS="-w" \
    -DCMAKE_C_FLAGS="-w" \
    2>&1

# --- 3. コンパイル (リンクなしで全オブジェクトを生成) ---
echo "[3/4] オブジェクトファイルをコンパイル中 (ninja -j${NUM_JOBS})..."
echo "       (これには時間がかかります — llvm-project は大規模なため数十分かかる場合があります)"

cd "${BUILD_DIR}"
# -k0: エラーがあっても続行
ninja -j"${NUM_JOBS}" -k0 2>&1 || true

# --- 4. リンクコマンドを抽出 ---
echo "[4/4] clang リンクコマンドを抽出中..."

LINK_CMD_FILE="${CLANG_DIR}/link_command.txt"

# Clang バイナリ名を動的に検索 (clang-19 など)
CLANG_BIN_TARGET=""
if [[ -d "${BUILD_DIR}/bin" ]]; then
    # bin/ 以下の clang-X ファイルを探す (clang-cpp 等を除く)
    for f in "${BUILD_DIR}/bin"/clang-[0-9]*; do
        if [[ -f "$f" ]]; then
            CLANG_BIN_TARGET="bin/$(basename "$f")"
            break
        fi
    done
fi

if [[ -z "${CLANG_BIN_TARGET}" ]]; then
    # フォールバック: バージョンから推測
    MAJOR_VERSION="${LLVM_VERSION%%.*}"
    CLANG_BIN_TARGET="bin/clang-${MAJOR_VERSION}"
fi

echo "       ターゲット: ${CLANG_BIN_TARGET}"

# ninja -t commands で clang のリンクコマンドを取得
ninja -t commands "${CLANG_BIN_TARGET}" 2>/dev/null \
    | grep -F -- "-o ${CLANG_BIN_TARGET}" \
    | tail -1 > "${LINK_CMD_FILE}" || true

# 取得できなかった場合
if [[ ! -s "${LINK_CMD_FILE}" ]]; then
    echo "ERROR: clang のリンクコマンドを取得できませんでした"
    echo "  ninja -t commands ${CLANG_BIN_TARGET} を手動で確認してください"
    exit 1
fi

echo ""
echo "=== 準備完了 ==="
echo "リンクコマンド: ${LINK_CMD_FILE}"
echo "ターゲット: ${CLANG_BIN_TARGET}"
echo "${CLANG_BIN_TARGET}" > "${CLANG_DIR}/.clang_target"
head -c 200 "${LINK_CMD_FILE}"
echo "..."
touch "${STAMP_FILE}"
