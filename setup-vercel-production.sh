#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " UNIT-SUCKS Vercel Production Setup"
echo "======================================"

# Verify we are in a Node project
if [ ! -f "package.json" ]; then
  echo "ERROR: package.json not found."
  echo "Run this from the project root."
  exit 1
fi

echo "[1/7] Installing Vite..."

npm install --save-dev vite

echo "[2/7] Updating package.json scripts..."

node <<'EOF'
const fs = require("fs");

const file = "package.json";
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));

pkg.scripts = pkg.scripts || {};

if (!pkg.scripts.dev) {
  pkg.scripts.dev = "vite";
}

if (!pkg.scripts.build) {
  pkg.scripts.build = "vite build";
}

fs.writeFileSync(
  file,
  JSON.stringify(pkg, null, 2) + "\n"
);
EOF

echo "[3/7] Creating Vite config..."

cat > vite.config.js <<'EOF'
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext"
  },
  server: {
    port: 5173
  }
});
EOF

echo "[4/7] Creating Vercel configuration..."

cat > vercel.json <<'EOF'
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
EOF

echo "[5/7] Updating .gitignore..."

if [ ! -f ".gitignore" ]; then
cat > .gitignore <<'EOF'
node_modules
dist
.vercel
.env
.env.*
EOF
else
  grep -qxF "dist" .gitignore || echo "dist" >> .gitignore
  grep -qxF "node_modules" .gitignore || echo "node_modules" >> .gitignore
  grep -qxF ".vercel" .gitignore || echo ".vercel" >> .gitignore
fi

echo "[6/7] Installing dependencies..."

npm install

echo "[7/7] Testing production build..."

npm run build

echo ""
echo "======================================"
echo " SUCCESS"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Commit changes:"
echo "   git add ."
echo "   git commit -m 'Prepare UNIT-SUCKS for Vercel production'"
echo ""
echo "2. Push:"
echo "   git push"
echo ""
echo "Vercel should now detect:"
echo "  Build: npm run build"
echo "  Output: dist"
echo ""
