#!/bin/bash

echo "🚀 Starting AIHealthcareChatBot Android Build Process..."

# Step 1: Ensure Web Assets are Built
echo "📦 Building the web application..."
npm run build

# Step 2: Sync latest Capacitor assets to the Android folder
echo "🔄 Syncing Capacitor to Android..."
npx cap sync android

# Step 3: Automatically run the Android app via Capacitor CLI
echo "🤖 Booting Android Application..."
echo "Note: If no emulator starts, ensure you have set up a Virtual Device in Android Studio."
echo "--------------------------------------------------------"

npx cap run android

if [ $? -ne 0 ]; then
    echo "--------------------------------------------------------"
    echo "❌ Error: Failed to run the Android application natively."
    echo ""
    echo "💡 TROUBLESHOOTING TIPS:"
    echo "1. Android Studio must be installed: https://developer.android.com/studio"
    echo "2. Check your ANDROID_HOME environment variable."
    echo "   (Add: export ANDROID_HOME=\$HOME/Library/Android/sdk to your ~/.zshrc file)"
    echo "3. Run 'npx cap open android' to launch Android Studio and run it using the visual 'Play' button instead."
    exit 1
else
    echo "✅ Android app successfully launched!"
fi
