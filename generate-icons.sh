#!/bin/bash

# Icon generation script for ZenGarden app
# Generates icons for Web, Electron, iOS, and Android platforms

SOURCE_ICON="public/icon-512x512.png"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Source icon not found at $SOURCE_ICON"
    exit 1
fi

echo "🎨 Starting icon generation from $SOURCE_ICON"

# ============================================
# Electron Icons (macOS .icns)
# ============================================
echo "🖥️  Generating Electron icons..."

# Create iconset directory
mkdir -p build/icon.iconset

# Generate all required macOS icon sizes
sips -z 16 16 "$SOURCE_ICON" --out build/icon.iconset/icon_16x16.png > /dev/null
sips -z 32 32 "$SOURCE_ICON" --out build/icon.iconset/icon_16x16@2x.png > /dev/null
sips -z 32 32 "$SOURCE_ICON" --out build/icon.iconset/icon_32x32.png > /dev/null
sips -z 64 64 "$SOURCE_ICON" --out build/icon.iconset/icon_32x32@2x.png > /dev/null
sips -z 128 128 "$SOURCE_ICON" --out build/icon.iconset/icon_128x128.png > /dev/null
sips -z 256 256 "$SOURCE_ICON" --out build/icon.iconset/icon_128x128@2x.png > /dev/null
sips -z 256 256 "$SOURCE_ICON" --out build/icon.iconset/icon_256x256.png > /dev/null
sips -z 512 512 "$SOURCE_ICON" --out build/icon.iconset/icon_256x256@2x.png > /dev/null
sips -z 512 512 "$SOURCE_ICON" --out build/icon.iconset/icon_512x512.png > /dev/null
sips -z 1024 1024 "$SOURCE_ICON" --out build/icon.iconset/icon_512x512@2x.png > /dev/null

# Convert iconset to .icns file
iconutil -c icns build/icon.iconset -o build/icon.icns

echo "✓ Electron macOS icons generated (icon.icns)"

echo ""
echo "✅ All icons generated successfully!"
echo ""
echo "Generated icons for:"
echo "  • Electron (macOS) - icon.icns"
echo ""
echo "Note: Windows Electron icons (.ico) require additional tools."
echo "Consider using electron-builder's icon generation or online converters."
