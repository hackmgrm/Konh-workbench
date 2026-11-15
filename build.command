#!/bin/bash
# 一键构建脚本（macOS 双击运行）
set -e
cd "$(dirname "$0")"

echo "== 空核工作台 · 构建 =="
echo ""

if ! command -v node >/dev/null 2>&1; then
    echo "未检测到 Node.js。"
    echo "请先安装：https://nodejs.org  （选 LTS 版本，一路下一步即可）"
    echo ""
    read -n 1 -s -r -p "按任意键退出..."
    exit 1
fi

echo "Node 版本：$(node -v)"

if [ ! -d node_modules ]; then
    echo ""
    echo "首次构建，安装依赖（大约 1-2 分钟）..."
    npm install
fi

echo ""
echo "编译中..."
npm run build

echo ""
echo "✓ 构建完成，产物在 dist/ 目录"
echo ""
echo "接下来：把 dist/ 整个文件夹复制到"
echo "  <你的思源工作空间>/data/plugins/Konh-workbench/"
echo "然后重启思源。"
echo ""
read -n 1 -s -r -p "按任意键关闭..."
