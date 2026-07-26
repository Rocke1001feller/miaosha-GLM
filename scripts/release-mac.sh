#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:-0.1.0}"

# CLT 机器：xcode-select 指向 CommandLineTools 时，xcodebuild 需要完整 Xcode
if [[ "$(xcode-select -p)" == "/Library/Developer/CommandLineTools" ]] && [[ -d /Applications/Xcode.app ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

xcodegen generate
xcodebuild -scheme CodingPlanAssistant -configuration Release -derivedDataPath .build \
  MARKETING_VERSION="$VERSION" clean build
APP=.build/Build/Products/Release/CodingPlanAssistant.app
# v1 不签名：ad-hoc
codesign --force --deep --sign - "$APP" 2>/dev/null || true
ditto -c -k --sequesterRsrc --keepParent "$APP" ".build/CodingPlanAssistant-$VERSION.zip"
echo "zip: .build/CodingPlanAssistant-$VERSION.zip"
echo "安装后执行: xattr -dr com.apple.quarantine /Applications/CodingPlanAssistant.app"
# 签名/公证 hook：DEVELOPER_ID 存在时走 codesign+notarytool（v1 不实现）
