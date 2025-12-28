#!/bin/bash

# Build script for Log Parser for Jenkins Chrome Extension
# Creates a distributable zip file and prepares git tag

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Read version from manifest.json
VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')

if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Could not read version from manifest.json${NC}"
    exit 1
fi

echo -e "${GREEN}Building Log Parser for Jenkins v${VERSION}${NC}"
echo "================================================"

# Create dist directory
DIST_DIR="dist"
mkdir -p "$DIST_DIR"

# Zip filename
ZIP_FILE="$DIST_DIR/log-parser-jenkins-v${VERSION}.zip"

# Remove old zip if exists
if [ -f "$ZIP_FILE" ]; then
    echo -e "${YELLOW}Removing existing zip file...${NC}"
    rm "$ZIP_FILE"
fi

# Create zip with only essential extension files
echo "Creating distribution zip..."
zip -r "$ZIP_FILE" \
    manifest.json \
    magic.js \
    style.css \
    icons/ \
    LICENSE \
    README.md \
    -x "*.DS_Store" \
    -x "*.git*"

echo -e "${GREEN}✓ Created: ${ZIP_FILE}${NC}"

# Show zip contents
echo ""
echo "Zip contents:"
unzip -l "$ZIP_FILE"

# Git tag handling
echo ""
TAG_NAME="v${VERSION}"

# Check if tag already exists
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Git tag ${TAG_NAME} already exists${NC}"
    read -p "Do you want to delete and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "$TAG_NAME"
        echo -e "${YELLOW}Deleted existing tag ${TAG_NAME}${NC}"
    else
        echo "Skipping tag creation"
        echo ""
        echo -e "${GREEN}Build complete!${NC}"
        exit 0
    fi
fi

# Create annotated tag with changelog from README
echo "Creating git tag ${TAG_NAME}..."

# Extract changelog for current version from README.md
# Finds the section starting with "### vX.Y.Z" and captures until the next "### v"
CHANGELOG=$(sed -n "/^### ${TAG_NAME}$/,/^### v[0-9]/p" README.md | grep -v "^### v" | sed '/^$/d')

if [ -z "$CHANGELOG" ]; then
    # Fallback if no changelog found
    CHANGELOG="Release ${TAG_NAME}"
fi

git tag -a "$TAG_NAME" -m "Release ${TAG_NAME}

${CHANGELOG}"

echo -e "${GREEN}✓ Created git tag: ${TAG_NAME}${NC}"

echo ""
echo "================================================"
echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the zip file: $ZIP_FILE"
echo "  2. Push the tag: git push origin ${TAG_NAME}"
echo "  3. Upload to Chrome Web Store (if publishing)"
echo ""
