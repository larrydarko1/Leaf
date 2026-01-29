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
# Web Icons (PWA)
# ============================================
echo "📱 Generating web icons..."
sips -z 72 72 "$SOURCE_ICON" --out public/icon-72x72.png > /dev/null
sips -z 96 96 "$SOURCE_ICON" --out public/icon-96x96.png > /dev/null
sips -z 128 128 "$SOURCE_ICON" --out public/icon-128x128.png > /dev/null
sips -z 144 144 "$SOURCE_ICON" --out public/icon-144x144.png > /dev/null
sips -z 152 152 "$SOURCE_ICON" --out public/icon-152x152.png > /dev/null
sips -z 192 192 "$SOURCE_ICON" --out public/icon-192x192.png > /dev/null
sips -z 384 384 "$SOURCE_ICON" --out public/icon-384x384.png > /dev/null

echo "✓ Web icons generated"

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

# ============================================
# iOS Icons
# ============================================
echo "📱 Generating iOS icons..."

# iOS AppIcon - 1024x1024 for App Store
sips -z 1024 1024 "$SOURCE_ICON" --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png > /dev/null

echo "✓ iOS icons generated"

# ============================================
# Android Icons
# ============================================
echo "🤖 Generating Android icons..."

# mdpi (48x48)
sips -z 48 48 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-mdpi/ic_launcher.png > /dev/null
sips -z 48 48 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png > /dev/null
sips -z 48 48 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png > /dev/null

# hdpi (72x72)
sips -z 72 72 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-hdpi/ic_launcher.png > /dev/null
sips -z 72 72 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png > /dev/null
sips -z 72 72 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png > /dev/null

# xhdpi (96x96)
sips -z 96 96 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-xhdpi/ic_launcher.png > /dev/null
sips -z 96 96 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png > /dev/null
sips -z 96 96 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png > /dev/null

# xxhdpi (144x144)
sips -z 144 144 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png > /dev/null
sips -z 144 144 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png > /dev/null
sips -z 144 144 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png > /dev/null

# xxxhdpi (192x192)
sips -z 192 192 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png > /dev/null
sips -z 192 192 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png > /dev/null
sips -z 192 192 "$SOURCE_ICON" --out android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png > /dev/null

echo "✓ Android icons generated"

echo ""
echo "✅ All icons generated successfully!"
echo ""
echo "Generated icons for:"
echo "  • Web (PWA) - 7 sizes"
echo "  • Electron (macOS) - icon.icns"
echo "  • iOS - AppIcon 1024x1024"
echo "  • Android - 5 density variants (mdpi to xxxhdpi)"
echo ""
echo "Note: Windows Electron icons (.ico) require additional tools."
echo "Consider using electron-builder's icon generation or online converters."
