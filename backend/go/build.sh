#!/bin/bash
#
# Builds item+: the web client, embedded into the server binary.
# Everything ends up in build/.
#
#   ./build.sh                 ask what to build (in a terminal)
#   ./build.sh local           this machine only
#   ./build.sh all             every platform
#   ./build.sh mac linux       several groups at once
#   ./build.sh linux-arm64     one platform
#
# Run with --help for all options.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
WEBCLIENT_DIR="$ROOT_DIR/clients/web"
BUILD_DIR="$SCRIPT_DIR/build"
WEBAPP_DIR="$BUILD_DIR/webapp"
GOCACHE_DIR="${GOCACHE:-$BUILD_DIR/.gocache}"
DEFAULT_CONFIG_SOURCE="$ROOT_DIR/config/itemplus.conf"
APP_VERSION="1.4.0"
APP_BUILD="dev"
SERVER_BASENAME="itemplus-server"
# The separate updater is gone; its name is kept so --clean still removes
# the binaries earlier builds left behind.
OLD_UPDATER_BASENAME="itemplus-update"

# os:arch:suffix of every platform item+ is released for.
PLATFORMS=(
  "darwin:amd64:macos-amd64"
  "darwin:arm64:macos-arm64"
  "linux:amd64:linux-amd64"
  "linux:arm64:linux-arm64"
  "windows:amd64:windows-amd64.exe"
)

if [ -f "$ROOT_DIR/VERSION" ]; then
  # shellcheck disable=SC1090
  source "$ROOT_DIR/VERSION"
fi

if [ "$APP_BUILD" = "dev" ] && git -C "$ROOT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  APP_BUILD="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
fi

GO_VERSION_LDFLAGS="-X github.com/itemplus/backend/internal/config.defaultAppVersion=${APP_VERSION} -X github.com/itemplus/backend/internal/config.defaultAppBuild=${APP_BUILD}"

# ── Appearance ──

INTERACTIVE=false
if [ -t 0 ] && [ -t 1 ]; then INTERACTIVE=true; fi

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != "dumb" ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
  RED=$'\033[38;5;203m'; GREEN=$'\033[38;5;78m'; BLUE=$'\033[38;5;75m'; GRAY=$'\033[38;5;245m'
else
  BOLD=""; DIM=""; RESET=""; RED=""; GREEN=""; BLUE=""; GRAY=""
fi

BAR_WIDTH=24
STEP_TOTAL=0
STEP_DONE=0
STEP_LOG=""
STEP_PID=""

banner() {
  echo ""
  echo "  ${BOLD}item${RED}+${RESET}  ${GRAY}build${RESET} ${BOLD}${APP_VERSION}${RESET} ${GRAY}·${RESET} ${BLUE}${APP_BUILD}${RESET}"
  echo "  ${GRAY}────────────────────────────────────────${RESET}"
}

section() {
  echo ""
  echo "  ${BOLD}$1${RESET}"
}

progress_bar() {
  local filled=0 done_part="" open_part="" i
  if [ "$STEP_TOTAL" -gt 0 ]; then filled=$((STEP_DONE * BAR_WIDTH / STEP_TOTAL)); fi
  for ((i = 0; i < BAR_WIDTH; i++)); do
    if [ "$i" -lt "$filled" ]; then done_part="${done_part}█"; else open_part="${open_part}░"; fi
  done
  printf '%s' "${RED}${done_part}${GRAY}${open_part}${RESET}"
}

human_size() {
  du -sh "$1" 2>/dev/null | cut -f1 | tr -d ' '
}

fail() {
  echo ""
  echo "  ${RED}✗${RESET} $*" >&2
  exit 1
}

cleanup() {
  if [ -n "$STEP_PID" ]; then kill "$STEP_PID" 2>/dev/null || true; fi
  if [ -n "$STEP_LOG" ]; then rm -f "$STEP_LOG"; fi
  if [ -t 1 ]; then printf '\033[?25h'; fi
}
trap cleanup EXIT
trap 'echo ""; echo "  ${RED}✗${RESET} Cancelled."; exit 130' INT

# run_step LABEL COMMAND...
# Runs one build step. In a terminal its output is kept out of the way while
# a progress bar shows where the build stands; if the step fails, the output
# is printed. Sets STEP_NOTE beforehand to add a detail to the result line.
run_step() {
  local label="$1"; shift
  local started=$SECONDS rc=0 frame=0 elapsed
  local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

  if [ -t 1 ]; then
    STEP_LOG="$(mktemp "${TMPDIR:-/tmp}/itemplus-build.XXXXXX")"
    ( "$@" ) >"$STEP_LOG" 2>&1 &
    STEP_PID=$!
    printf '\033[?25l'
    while kill -0 "$STEP_PID" 2>/dev/null; do
      printf '\r  %s %s %s %s\033[K' "$(progress_bar)" "${GRAY}$((STEP_DONE + 1))/${STEP_TOTAL}${RESET}" "${BLUE}${frames[$frame]}${RESET}" "$label"
      frame=$(((frame + 1) % ${#frames[@]}))
      sleep 0.1
    done
    if wait "$STEP_PID"; then rc=0; else rc=$?; fi
    STEP_PID=""
    printf '\r\033[K\033[?25h'
  else
    echo "  [$((STEP_DONE + 1))/${STEP_TOTAL}] $label"
    if ( "$@" ); then rc=0; else rc=$?; fi
  fi

  elapsed=$((SECONDS - started))
  if [ "$rc" -ne 0 ]; then
    echo "  ${RED}✗${RESET} $label ${GRAY}(${elapsed}s)${RESET}"
    if [ -n "$STEP_LOG" ] && [ -s "$STEP_LOG" ]; then
      echo ""
      sed 's/^/    /' "$STEP_LOG" | tail -n 60
    fi
    exit "$rc"
  fi
  if [ -n "$STEP_LOG" ]; then rm -f "$STEP_LOG"; STEP_LOG=""; fi
  STEP_DONE=$((STEP_DONE + 1))
  echo "  ${GREEN}✓${RESET} $label ${GRAY}${elapsed}s${RESET}"
}

# ── What to build ──

usage() {
  cat <<EOF
Usage: ./build.sh [targets] [options]

Without arguments, in a terminal, the script asks what to build.

Targets (several can be combined):
  local         This machine: build/$SERVER_BASENAME
  all           Every platform below
  mac           macos-amd64, macos-arm64
  linux         linux-amd64, linux-arm64
  win           windows-amd64
  macos-amd64, macos-arm64, linux-amd64, linux-arm64, windows-amd64
                A single platform

Options:
  --skip-webapp Do not build or embed the web client (API-only binaries)
  --clean       Remove earlier build output first. Keeps build/itemplus.conf,
                build/data, build/logs and build/uploads.
  --all         Same as the target "all"
  --help, -h    Show this help text

Examples:
  ./build.sh local
  ./build.sh all
  ./build.sh mac win --skip-webapp
  ./build.sh --clean all
EOF
}

SELECTED=""   # suffixes of the chosen platforms
BUILD_LOCAL=false
SKIP_WEBAPP=false
CLEAN_BUILD=false
CLEAN_ONLY=false
HAS_ARGS=false

add_platforms() {
  local pattern="$1" platform suffix matched=false
  for platform in "${PLATFORMS[@]}"; do
    suffix="${platform##*:}"
    case "${suffix%.exe}" in
      $pattern)
        matched=true
        case " $SELECTED " in *" $suffix "*) ;; *) SELECTED="$SELECTED $suffix" ;; esac
        ;;
    esac
  done
  [ "$matched" = true ]
}

select_target() {
  case "$1" in
    local) BUILD_LOCAL=true ;;
    all) add_platforms "*" ;;
    mac|macos|darwin) add_platforms "macos-*" ;;
    linux) add_platforms "linux-*" ;;
    win|windows) add_platforms "windows-*" ;;
    *) add_platforms "$1" || return 1 ;;
  esac
}

for arg in "$@"; do
  HAS_ARGS=true
  case "$arg" in
    --all) select_target all ;;
    --skip-webapp) SKIP_WEBAPP=true ;;
    --delete|--clean) CLEAN_BUILD=true ;;
    --help|-h) usage; exit 0 ;;
    -*)
      echo "Unknown option: $arg" >&2
      echo "Run with --help for the options." >&2
      exit 2
      ;;
    *)
      if ! select_target "$arg"; then
        echo "Unknown target: $arg" >&2
        echo "Run with --help for the targets." >&2
        exit 2
      fi
      ;;
  esac
done

[ -d "$WEBCLIENT_DIR" ] || fail "Web client directory not found: $WEBCLIENT_DIR"

banner

ask() {
  local answer
  printf '  %s ' "$1" >&2
  read -r answer || answer=""
  printf '%s' "$answer"
}

if [ "$HAS_ARGS" = false ] && [ "$INTERACTIVE" = true ]; then
  host="$(go env GOOS 2>/dev/null || true)/$(go env GOARCH 2>/dev/null || true)"
  section "What do you want to build?"
  echo "    ${RED}1${RESET}  This machine ${GRAY}(${host})${RESET}"
  echo "    ${RED}2${RESET}  All platforms ${GRAY}(macOS, Linux, Windows)${RESET}"
  echo "    ${RED}3${RESET}  macOS ${GRAY}(amd64, arm64)${RESET}"
  echo "    ${RED}4${RESET}  Linux ${GRAY}(amd64, arm64)${RESET}"
  echo "    ${RED}5${RESET}  Windows ${GRAY}(amd64)${RESET}"
  echo "    ${RED}6${RESET}  Clean up only"
  echo ""
  while true; do
    choice="$(ask "Choice ${GRAY}[1]${RESET}:")"
    case "${choice:-1}" in
      1) select_target local; break ;;
      2) select_target all; break ;;
      3) select_target mac; break ;;
      4) select_target linux; break ;;
      5) select_target win; break ;;
      6) CLEAN_BUILD=true; CLEAN_ONLY=true; break ;;
      q|Q) exit 0 ;;
      *) echo "  ${RED}Enter a number from 1 to 6, or q to quit.${RESET}" ;;
    esac
  done

  if [ "$CLEAN_ONLY" = false ]; then
    case "$(ask "Build the web client too? ${GRAY}[Y/n]${RESET}:")" in
      n|N|no|No|nein|Nein) SKIP_WEBAPP=true ;;
    esac
    case "$(ask "Remove earlier build output first? ${GRAY}[y/N]${RESET}:")" in
      y|Y|yes|Yes|j|J|ja|Ja) CLEAN_BUILD=true ;;
    esac
  fi
elif [ "$BUILD_LOCAL" = false ] && [ -z "$SELECTED" ]; then
  if [ "$CLEAN_BUILD" = true ] && [ "$SKIP_WEBAPP" = false ]; then
    # --clean on its own only cleans up.
    CLEAN_ONLY=true
  else
    # Options without a target, or no terminal to ask in: this machine.
    BUILD_LOCAL=true
  fi
fi

# ── Steps ──

# Removes what a build produces and nothing else: the configuration, the
# database, logs and uploads that may live in build/ are not build output.
clean_build_output() {
  # The server embeds build/webapp at compile time, so the folder stays, empty.
  empty_webapp
  rm -rf "$BUILD_DIR/.gocache"
  rm -f "$BUILD_DIR/$SERVER_BASENAME" "$BUILD_DIR/$OLD_UPDATER_BASENAME"
  rm -f "$BUILD_DIR/$SERVER_BASENAME"-* "$BUILD_DIR/$OLD_UPDATER_BASENAME"-*
}

install_web_dependencies() {
  cd "$WEBCLIENT_DIR" && npm install
}

build_webapp() {
  cd "$WEBCLIENT_DIR" && npm run build
}

# The steps are chained with &&: a step runs inside a condition, where the
# shell would otherwise carry on after a failed command.
embed_webapp() {
  rm -rf "$WEBAPP_DIR" &&
    mkdir -p "$WEBAPP_DIR/.next/static" "$WEBAPP_DIR/public" &&
    rsync -a "$WEBCLIENT_DIR/.next/standalone/" "$WEBAPP_DIR/" &&
    rsync -a "$WEBCLIENT_DIR/.next/static/" "$WEBAPP_DIR/.next/static/" &&
    { cp -r "$WEBCLIENT_DIR/public/"* "$WEBAPP_DIR/public/" 2>/dev/null || true; } &&
    touch "$WEBAPP_DIR/.gitkeep"
}

empty_webapp() {
  rm -rf "$WEBAPP_DIR" && mkdir -p "$WEBAPP_DIR" && touch "$WEBAPP_DIR/.gitkeep"
}

# go_build OS ARCH OUTPUT PACKAGE; empty OS and ARCH mean this machine.
go_build() {
  cd "$SCRIPT_DIR" || return 1
  if [ -n "$1" ]; then
    CGO_ENABLED=0 GOOS="$1" GOARCH="$2" go build -ldflags="-s -w ${GO_VERSION_LDFLAGS}" -o "$3" "$4"
  else
    CGO_ENABLED=0 go build -ldflags="-s -w ${GO_VERSION_LDFLAGS}" -o "$3" "$4"
  fi
}

if [ "$CLEAN_BUILD" = true ]; then
  section "Cleaning up"
  clean_build_output
  echo "  ${GREEN}✓${RESET} Removed binaries, embedded web client and build cache"
  echo "    ${GRAY}Kept: itemplus.conf, data/, logs/, uploads/${RESET}"
  if [ "$CLEAN_ONLY" = true ]; then
    echo ""
    exit 0
  fi
fi

mkdir -p "$BUILD_DIR/data" "$GOCACHE_DIR"
export GOCACHE="$GOCACHE_DIR"

if [ -f "$DEFAULT_CONFIG_SOURCE" ]; then
  cp "$DEFAULT_CONFIG_SOURCE" "$SCRIPT_DIR/internal/config/templates/itemplus.conf"
fi

platform_count=0
for suffix in $SELECTED; do platform_count=$((platform_count + 1)); done
if [ "$BUILD_LOCAL" = true ]; then platform_count=$((platform_count + 1)); fi

NEEDS_NPM_INSTALL=false
if [ "$SKIP_WEBAPP" = false ] && [ ! -d "$WEBCLIENT_DIR/node_modules" ]; then NEEDS_NPM_INSTALL=true; fi

STEP_TOTAL=$platform_count
if [ "$SKIP_WEBAPP" = false ]; then STEP_TOTAL=$((STEP_TOTAL + 2)); fi
if [ "$NEEDS_NPM_INSTALL" = true ]; then STEP_TOTAL=$((STEP_TOTAL + 1)); fi

BUILD_STARTED=$SECONDS
BUILT_FILES=""

section "Web client"
if [ "$SKIP_WEBAPP" = false ]; then
  if [ "$NEEDS_NPM_INSTALL" = true ]; then run_step "Install dependencies" install_web_dependencies; fi
  run_step "Build web client" build_webapp
  run_step "Embed web client" embed_webapp
  echo "    ${GRAY}$(find "$WEBAPP_DIR" -type f | wc -l | tr -d ' ') files, $(human_size "$WEBAPP_DIR")${RESET}"
else
  empty_webapp
  echo "  ${GRAY}– Skipped: the binaries are built without a web client${RESET}"
fi

section "Binaries"
if [ "$BUILD_LOCAL" = true ]; then
  run_step "$SERVER_BASENAME ${GRAY}(this machine)${RESET}" go_build "" "" "$BUILD_DIR/$SERVER_BASENAME" .
  BUILT_FILES="$BUILT_FILES $SERVER_BASENAME"
fi
for platform in "${PLATFORMS[@]}"; do
  IFS=':' read -r os arch suffix <<< "$platform"
  case " $SELECTED " in *" $suffix "*) ;; *) continue ;; esac
  run_step "$SERVER_BASENAME-$suffix" go_build "$os" "$arch" "$BUILD_DIR/$SERVER_BASENAME-$suffix" .
  BUILT_FILES="$BUILT_FILES $SERVER_BASENAME-$suffix"
done

# ── Result ──

total=$((SECONDS - BUILD_STARTED))
echo ""
echo "  $(progress_bar) ${GREEN}${BOLD}Done${RESET} ${GRAY}in ${total}s${RESET}"
section "build/"
for file in $BUILT_FILES; do
  printf '    %-40s %s\n' "$file" "${GRAY}$(human_size "$BUILD_DIR/$file")${RESET}"
done
if [ "$BUILD_LOCAL" = true ]; then
  echo ""
  echo "  ${GRAY}Run:${RESET} ./build/$SERVER_BASENAME ${GRAY}[--bind 0.0.0.0] [--port 17117]${RESET}"
fi
echo ""
