#!/usr/bin/env bash
# LinkBench — systemd サービスのインストール / アンインストール
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="linkbench"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
TEMPLATE="$SCRIPT_DIR/linkbench.service"

usage() {
    echo "Usage: $0 {install|uninstall|status}"
    exit 1
}

do_install() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "Error: install requires root. Re-run with sudo."
        exit 1
    fi

    local current_user="${SUDO_USER:-$(whoami)}"

    echo "[linkbench] Installing systemd service..."
    echo "  Project : $PROJECT_ROOT"
    echo "  User    : $current_user"

    # テンプレートからサービスファイルを生成
    sed \
        -e "s|__USER__|${current_user}|g" \
        -e "s|__PROJECT_ROOT__|${PROJECT_ROOT}|g" \
        "$TEMPLATE" > "$SERVICE_FILE"

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"

    echo "[linkbench] Service installed and started."
    echo "  http://$(hostname -I | awk '{print $1}'):28000"
    echo ""
    echo "Useful commands:"
    echo "  sudo systemctl status  $SERVICE_NAME"
    echo "  sudo systemctl restart $SERVICE_NAME"
    echo "  sudo journalctl -u $SERVICE_NAME -f"
}

do_uninstall() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "Error: uninstall requires root. Re-run with sudo."
        exit 1
    fi

    echo "[linkbench] Removing systemd service..."
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload

    echo "[linkbench] Service removed."
}

do_status() {
    systemctl status "$SERVICE_NAME" --no-pager || true
}

case "${1:-}" in
    install)   do_install   ;;
    uninstall) do_uninstall ;;
    status)    do_status    ;;
    *)         usage        ;;
esac
