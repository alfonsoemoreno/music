#!/bin/zsh
set -eu
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.digitalalbum.agent.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.digitalalbum.agent</string>
  <key>WorkingDirectory</key><string>$ROOT_DIR/apps/wiim-agent</string>
  <key>ProgramArguments</key><array><string>$(command -v pnpm)</string><string>start</string></array>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$ROOT_DIR/apps/wiim-agent/agent.log</string>
  <key>StandardErrorPath</key><string>$ROOT_DIR/apps/wiim-agent/agent.error.log</string>
</dict></plist>
EOF
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed and started com.digitalalbum.agent"
