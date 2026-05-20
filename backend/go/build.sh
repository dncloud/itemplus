#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
WEBCLIENT_DIR=""
BUILD_DIR="$SCRIPT_DIR/build"
WEBAPP_DIR="$BUILD_DIR/webapp"
DIST_DIR="$BUILD_DIR"
GOCACHE_DIR="${GOCACHE:-$BUILD_DIR/.gocache}"
DEFAULT_CONFIG_SOURCE="$ROOT_DIR/config/itemplus.conf"
APP_VERSION="1.2"
APP_BUILD="dev"
SERVER_BASENAME="itemplus-server"
SERVER_LOCAL_NAME="itemplus-server"

if [ -f "$ROOT_DIR/VERSION" ]; then
  # shellcheck disable=SC1090
  source "$ROOT_DIR/VERSION"
fi

if [ "$APP_BUILD" = "dev" ] && git -C "$ROOT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  APP_BUILD="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
fi

VERSION_DISPLAY="${APP_VERSION} build ${APP_BUILD}"
GO_VERSION_LDFLAGS="-X github.com/itemplus/backend/internal/config.defaultAppVersion=${APP_VERSION} -X github.com/itemplus/backend/internal/config.defaultAppBuild=${APP_BUILD}"

mkdir -p "$GOCACHE_DIR"
export GOCACHE="$GOCACHE_DIR"

if [ -f "$DEFAULT_CONFIG_SOURCE" ]; then
  cp "$DEFAULT_CONFIG_SOURCE" "$SCRIPT_DIR/internal/config/templates/itemplus.conf"
fi

if [ -d "$SCRIPT_DIR/../../clients/web" ]; then
  WEBCLIENT_DIR="$SCRIPT_DIR/../../clients/web"
else
  echo "Web client directory not found." >&2
  echo "Expected: $SCRIPT_DIR/../../clients/web" >&2
  exit 1
fi

# Parse arguments
BUILD_ALL=false
SKIP_WEBAPP=false
CLEAN_BUILD=false
SHOW_HELP=false
for arg in "$@"; do
  case $arg in
    --all) BUILD_ALL=true ;;
    --skip-webapp) SKIP_WEBAPP=true ;;
    --delete|--clean) CLEAN_BUILD=true ;;
    --help|-h) SHOW_HELP=true ;;
    *)
      echo "Unknown argument: $arg" >&2
      SHOW_HELP=true
      ;;
  esac
done

if [ "$SHOW_HELP" = true ]; then
  cat <<EOF
Usage: ./build.sh [options]

Options:
  --all         Build server for all target platforms
  --skip-webapp Skip the web client build and embed step
  --clean       Remove the build directory before continuing
  --delete      Alias for --clean
  --help, -h    Show this help text

Examples:
  ./build.sh
  ./build.sh --all
  ./build.sh --clean
  ./build.sh --clean --all
  ./build.sh --all --skip-webapp
EOF
  exit 0
fi

echo "=== item+ Build ($VERSION_DISPLAY) ==="

if [ "$CLEAN_BUILD" = true ]; then
  echo ""
  echo "[0/3] Cleaning build directory..."
  rm -rf "$BUILD_DIR"
  echo "      Removed $BUILD_DIR"
  if [ "$#" -eq 1 ]; then
    echo ""
    echo "=== Done! ==="
    exit 0
  fi
fi

# Step 1: Build WebApp
if [ "$SKIP_WEBAPP" = false ]; then
  echo ""
  echo "[1/3] Building WebApp..."
  cd "$WEBCLIENT_DIR"
  if [ ! -d "node_modules" ]; then
    echo "      Installing WebApp dependencies..."
    npm install
  fi
  npm run build

  echo "      WebApp built successfully"

  # Step 2: Copy standalone into Go embed directory
  echo ""
  echo "[2/3] Embedding WebApp..."
  rm -rf "$WEBAPP_DIR"
  mkdir -p "$WEBAPP_DIR"
  rsync -a "$WEBCLIENT_DIR/.next/standalone/" "$WEBAPP_DIR/"
  mkdir -p "$WEBAPP_DIR/.next/static"
  rsync -a "$WEBCLIENT_DIR/.next/static/" "$WEBAPP_DIR/.next/static/"
  mkdir -p "$WEBAPP_DIR/public"
  cp -r "$WEBCLIENT_DIR/public/"* "$WEBAPP_DIR/public/" 2>/dev/null || true
  touch "$WEBAPP_DIR/.gitkeep"

  FILE_COUNT=$(find "$WEBAPP_DIR" -type f | wc -l | tr -d ' ')
  SIZE=$(du -sh "$WEBAPP_DIR" | cut -f1)
  echo "      $FILE_COUNT files ($SIZE) embedded"
else
  echo ""
  echo "[1/3] Skipping WebApp build (--skip-webapp)"
  echo "[2/3] Skipping WebApp embed"
  rm -rf "$WEBAPP_DIR"
  mkdir -p "$WEBAPP_DIR"
  touch "$WEBAPP_DIR/.gitkeep"
fi

# Step 3: Build Go binaries
echo ""
cd "$SCRIPT_DIR"

if [ "$BUILD_ALL" = true ]; then
  echo "[3/3] Building server for all platforms..."
  mkdir -p "$DIST_DIR"
  mkdir -p "$DIST_DIR/data"

  TARGETS=(
    "darwin:amd64:$SERVER_BASENAME-macos-amd64"
    "darwin:arm64:$SERVER_BASENAME-macos-arm64"
    "linux:amd64:$SERVER_BASENAME-linux-amd64"
    "linux:arm64:$SERVER_BASENAME-linux-arm64"
    "windows:amd64:$SERVER_BASENAME-windows-amd64.exe"
  )

  for target in "${TARGETS[@]}"; do
    IFS=':' read -r os arch name <<< "$target"
    platform_name="$os"
    if [ "$os" = "darwin" ]; then
      platform_name="macos"
    fi
    echo "      $os/$arch..."
    CGO_ENABLED=0 GOOS=$os GOARCH=$arch go build -ldflags="-s -w ${GO_VERSION_LDFLAGS}" -o "$DIST_DIR/$name" .
    SERVER_SIZE=$(du -sh "$DIST_DIR/$name" | cut -f1)
    echo "        $name ($SERVER_SIZE)"
  done

  echo ""
  echo "=== Done! ==="
  echo ""
  echo "Binaries in build/:"
  ls -lh "$DIST_DIR"/itemplus-* "$DIST_DIR"/itemplus-server* 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'
else
  echo "[3/3] Building Go binaries..."
  mkdir -p "$DIST_DIR"
  mkdir -p "$DIST_DIR/data"
  CGO_ENABLED=0 go build -ldflags="-s -w ${GO_VERSION_LDFLAGS}" -o "$DIST_DIR/$SERVER_LOCAL_NAME" .
  SERVER_SIZE=$(du -sh "$DIST_DIR/$SERVER_LOCAL_NAME" | cut -f1)
  echo "      Binary: $DIST_DIR/$SERVER_LOCAL_NAME ($SERVER_SIZE)"

  echo ""
  echo "=== Done! ==="
  echo ""
  echo "Run:  ./build/$SERVER_LOCAL_NAME"
  echo "  --bind 0.0.0.0    Bind address"
  echo "  --port 17117      API port"
  echo ""
  echo "Cross-compile all:  bash build.sh --all"
fi
