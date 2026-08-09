#!/usr/bin/env bash
# 清理微信小游戏构建产物里的 macOS AppleDouble（._*）文件，避免开发者工具编译报错
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$ROOT/build/wechatgame}"

if [[ ! -d "$TARGET" ]]; then
  echo "目录不存在: $TARGET"
  echo "请先在 Cocos 构建微信小游戏，或传入路径: $0 /path/to/wechatgame"
  exit 1
fi

count=$(find "$TARGET" \( -name '._*' -o -name '.DS_Store' \) 2>/dev/null | wc -l | tr -d ' ')
find "$TARGET" \( -name '._*' -o -name '.DS_Store' \) -delete 2>/dev/null || true
echo "已清理 $count 个 macOS 垃圾文件 → $TARGET"
echo "请用微信开发者工具重新打开该目录并编译预览。"
