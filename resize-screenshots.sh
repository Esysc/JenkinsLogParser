#!/bin/bash

# Resize screenshots for Chrome Web Store (1280x800)

SCREENSHOTS_DIR="screenshots"
OUTPUT_DIR="$SCREENSHOTS_DIR/resized"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Resizing screenshots to 1280x800 for Chrome Web Store..."

for img in "$SCREENSHOTS_DIR"/*.jpg; do
    if [ -f "$img" ]; then
        filename=$(basename "$img")
        output_file="$OUTPUT_DIR/$filename"

        # Resize with padding to maintain aspect ratio (letterboxing if needed)
        convert "$img" \
            -background white \
            -gravity center \
            -extent 1280x800 \
            -quality 85 \
            "$output_file"

        echo "✓ Resized $(basename "$img") → $output_file"
    fi
done

echo ""
echo "Done! Resized screenshots are in: $OUTPUT_DIR"
echo ""
echo "Next: Upload these to Chrome Web Store:"
echo "  https://chrome.google.com/webstore/devconsole"
