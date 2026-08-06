#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# CLT 机器：xcode-select 指向 CommandLineTools 时，xcodebuild 需要完整 Xcode
if [[ "$(xcode-select -p)" == "/Library/Developer/CommandLineTools" ]] && [[ -d /Applications/Xcode.app ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

xcodegen generate
xcodebuild -scheme CodingPlanAssistant -configuration Debug -derivedDataPath .build build
echo "built: .build/Build/Products/Debug/CodingPlanAssistant.app"
if [[ "${1:-}" == "run" ]]; then
  if [[ -n "${CODINGPLANASSISTANT_MOCK:-}" ]]; then
    # open(1) 不传环境变量；mock 模式直接前台执行二进制以继承 CODINGPLANASSISTANT_MOCK（Ctrl+C 退出）
    exec .build/Build/Products/Debug/CodingPlanAssistant.app/Contents/MacOS/CodingPlanAssistant
  fi
  open .build/Build/Products/Debug/CodingPlanAssistant.app
fi
