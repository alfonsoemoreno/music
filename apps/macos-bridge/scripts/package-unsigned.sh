#!/bin/zsh
set -euo pipefail

# Creates a local unsigned .app and .dmg. Gatekeeper will ask the recipient to
# right-click the app and choose "Open" once; no Apple Developer account is used.
script_dir=${0:A:h}
project_dir=${script_dir:h}
release_dir=${project_dir}/.build/release
output_dir=${project_dir}/dist
app_dir=${output_dir}/Music\ Bridge.app

cd "$project_dir"
swift build -c release
rm -rf "$app_dir"
mkdir -p "$app_dir/Contents/MacOS" "$app_dir/Contents/Resources"
cp "$release_dir/MusicBridge" "$app_dir/Contents/MacOS/Music Bridge"
iconutil -c icns "$project_dir/Resources/MusicBridge.iconset" -o "$app_dir/Contents/Resources/MusicBridge.icns"
cat > "$app_dir/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDisplayName</key><string>Music Bridge</string>
  <key>CFBundleExecutable</key><string>Music Bridge</string>
  <key>CFBundleIdentifier</key><string>app.digitalalbum.musicbridge</string>
  <key>CFBundleIconFile</key><string>MusicBridge.icns</string>
  <key>CFBundleName</key><string>Music Bridge</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
</dict></plist>
PLIST
chmod +x "$app_dir/Contents/MacOS/Music Bridge"
rm -f "$output_dir/Music-Bridge-unsigned.dmg"
hdiutil create -volname "Music Bridge" -srcfolder "$app_dir" -ov -format UDZO "$output_dir/Music-Bridge-unsigned.dmg"
print "Created: $output_dir/Music-Bridge-unsigned.dmg"
