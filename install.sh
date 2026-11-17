#!/usr/bin/env bash
#
# devChat installer for Linux and macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/jrnoorbaloch/devChat/main/install.sh | bash
#
# Pass setup options after "bash -s --", for example:
#   curl -fsSL .../install.sh | bash -s -- --messenger both
#
# What it does (and nothing else):
#   1. checks git, Node.js >= 26 and npm (offers to install Node.js with nvm)
#   2. downloads devChat into ./devChat (or updates an existing copy)
#   3. installs dependencies
#   4. runs the setup wizard, which asks: WeChat, WhatsApp or both
#
# Environment overrides: DEVCHAT_DIR (target folder), DEVCHAT_REPO_URL,
# DEVCHAT_BRANCH, DEVCHAT_MESSENGERS (answer the wizard non-interactively).
#
set -euo pipefail

REPO_URL="${DEVCHAT_REPO_URL:-https://github.com/jrnoorbaloch/devChat.git}"
BRANCH="${DEVCHAT_BRANCH:-main}"
TARGET_DIR="${DEVCHAT_DIR:-devChat}"
MIN_NODE_MAJOR=26

if [ -t 1 ]; then
  GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; BOLD=''; RESET=''
fi
ok()   { printf '%s✔%s %s\n' "$GREEN" "$RESET" "$*"; }
info() { printf '%s…%s %s\n' "$YELLOW" "$RESET" "$*"; }
fail() { printf '%s✖ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

# When piped into bash, stdin is this script; questions must read the terminal.
HAS_TTY=0
if [ -r /dev/tty ] && [ -w /dev/tty ] && { : < /dev/tty; } 2>/dev/null; then HAS_TTY=1; fi

ask_yes() {  # ask_yes "Question?" -> returns 0 for yes (default yes)
  [ "$HAS_TTY" = 1 ] || return 1
  local reply
  printf '%s [Y/n] ' "$1" > /dev/tty
  read -r reply < /dev/tty || reply=''
  case "$reply" in [nN]*) return 1 ;; *) return 0 ;; esac
}

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

printf '\n%sdevChat installer%s\n\n' "$BOLD" "$RESET"

# 1. git
command -v git >/dev/null 2>&1 || fail "git is not installed. Install it first: https://git-scm.com/downloads (macOS: xcode-select --install, Ubuntu/Debian: sudo apt install git)"
ok "git $(git --version | awk '{print $3}')"

# 2. Node.js (offer nvm when missing or too old)
if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt "$MIN_NODE_MAJOR" ]; then
  current="$(command -v node >/dev/null 2>&1 && node --version || echo 'not installed')"
  info "devChat needs Node.js ${MIN_NODE_MAJOR}+ (you have: ${current})."
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ] && ask_yes "Install nvm (Node Version Manager) in your home folder?"; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash >/dev/null
  fi
  if [ -s "$NVM_DIR/nvm.sh" ] && ask_yes "Install Node.js ${MIN_NODE_MAJOR} with nvm now?"; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm install "$MIN_NODE_MAJOR" >/dev/null
    nvm use "$MIN_NODE_MAJOR" >/dev/null
  fi
  if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt "$MIN_NODE_MAJOR" ]; then
    fail "Please install Node.js ${MIN_NODE_MAJOR} or newer from https://nodejs.org (or: nvm install ${MIN_NODE_MAJOR}), then run this installer again."
  fi
fi
ok "Node.js $(node --version)"
command -v npm >/dev/null 2>&1 || fail "npm was not found. Reinstall Node.js from https://nodejs.org (npm comes with it)."
ok "npm $(npm --version)"

# 3. Download or update devChat
if [ -d "$TARGET_DIR/.git" ]; then
  info "Updating existing $TARGET_DIR"
  # npm may rewrite the lockfile locally; it is regenerated below anyway.
  git -C "$TARGET_DIR" checkout --quiet -- package-lock.json 2>/dev/null || true
  git -C "$TARGET_DIR" pull --ff-only --quiet || fail "Could not update $TARGET_DIR (local changes?). Run: git -C $TARGET_DIR status"
elif [ -e "$TARGET_DIR" ] && [ -n "$(ls -A "$TARGET_DIR" 2>/dev/null)" ]; then
  fail "Folder '$TARGET_DIR' already exists and is not a devChat checkout. Remove it or set DEVCHAT_DIR=other-folder."
else
  info "Downloading devChat into ./$TARGET_DIR"
  git clone --quiet --depth 1 --branch "$BRANCH" "$REPO_URL" "$TARGET_DIR" || fail "Download failed. Check your internet connection and try again."
fi
ok "devChat source ready"
cd "$TARGET_DIR"

# 4. Dependencies: `npm ci` installs exactly the tested versions from the
#    lockfile; fall back to `npm install` once (flaky network, lock mismatch).
info "Installing dependencies (first time takes a minute)"
if ! npm ci --no-audit --no-fund --loglevel=error; then
  info "Retrying with npm install"
  npm install --no-audit --no-fund --loglevel=error || fail "npm install failed. Check your internet connection / proxy, then run: cd $TARGET_DIR && npm install"
fi
ok "Dependencies installed"

# 5. Setup wizard: WeChat, WhatsApp or both
if [ "$HAS_TTY" = 1 ] && [ -z "${DEVCHAT_MESSENGERS:-}" ]; then
  node bin/init.ts "$@" < /dev/tty
else
  node bin/init.ts --yes "$@"
fi

printf '\n%sNext:%s  cd %s && npm start\n\n' "$BOLD" "$RESET" "$TARGET_DIR"
