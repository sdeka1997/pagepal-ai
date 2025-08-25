#!/bin/bash

# Sync PageWise Extension to Safari Extension Directory
echo "Syncing PageWise Extension to Safari..."

# Essential files for the extension
files=(
    "manifest.json"
    "popup.html"
    "popup.js"
    "background.js"
    "content-enhanced.js"
    "content-visual.js"
    "constants.js"
    "utils.js"
    "api-key-manager.js"
    "icon16.png"
    "icon48.png"
    "icon128.png"
)

# Copy each file
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "/Users/swapnav/Documents/Github/pagepal-ai-safari-simple/"
        echo "✓ Copied $file"
    else
        echo "⚠ Warning: $file not found"
    fi
done

echo "✅ Sync complete! Extension ready for Safari testing."