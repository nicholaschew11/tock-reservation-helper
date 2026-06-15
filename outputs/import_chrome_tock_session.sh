#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DEFAULT="$HOME/Library/Application Support/Google/Chrome/Default"
TARGET_DEFAULT="$SCRIPT_DIR/tock-profile/Default"
BACKUP_DIR="$SCRIPT_DIR/session-import-backups/$(date +%Y%m%d-%H%M%S)"
COOKIE_HOST_PATTERN="%exploretock.com%"

if [[ ! -f "$SOURCE_DEFAULT/Cookies" ]]; then
  echo "Could not find Chrome cookies at:"
  echo "  $SOURCE_DEFAULT/Cookies"
  exit 1
fi

if pgrep -f "$SCRIPT_DIR/tock-profile" >/dev/null 2>&1; then
  echo "The helper Chrome profile is still open. Close any helper/Tock automation Chrome windows first."
  exit 1
fi

if pgrep -x "Google Chrome" >/dev/null 2>&1; then
  echo "Close normal Google Chrome before importing, then rerun this command."
  echo "Chrome keeps cookie/local-storage databases locked while it is running."
  exit 1
fi

mkdir -p "$TARGET_DEFAULT" "$BACKUP_DIR"

echo "Backing up current helper session files to:"
echo "  $BACKUP_DIR"
for item in Cookies Cookies-journal "Local Storage" "Session Storage" IndexedDB; do
  if [[ -e "$TARGET_DEFAULT/$item" ]]; then
    ditto "$TARGET_DEFAULT/$item" "$BACKUP_DIR/$item"
  fi
done

SOURCE_COOKIES_TMP="$(mktemp "$SCRIPT_DIR/source-cookies.XXXXXX")"
TARGET_COOKIES_TMP="$(mktemp "$SCRIPT_DIR/target-cookies.XXXXXX")"
trap 'rm -f "$SOURCE_COOKIES_TMP" "$TARGET_COOKIES_TMP"' EXIT

cp "$SOURCE_DEFAULT/Cookies" "$SOURCE_COOKIES_TMP"
if [[ -f "$TARGET_DEFAULT/Cookies" ]]; then
  cp "$TARGET_DEFAULT/Cookies" "$TARGET_COOKIES_TMP"
else
  cp "$SOURCE_DEFAULT/Cookies" "$TARGET_COOKIES_TMP"
  sqlite3 "$TARGET_COOKIES_TMP" "DELETE FROM cookies;"
fi

sqlite3 "$TARGET_COOKIES_TMP" <<SQL
ATTACH DATABASE '$SOURCE_COOKIES_TMP' AS source_db;
DELETE FROM cookies
  WHERE host_key LIKE '$COOKIE_HOST_PATTERN'
     OR host_key LIKE '%tocktix.com%';
INSERT OR REPLACE INTO cookies
SELECT * FROM source_db.cookies
  WHERE host_key LIKE '$COOKIE_HOST_PATTERN'
     OR host_key LIKE '%tocktix.com%';
DETACH DATABASE source_db;
SQL

cp "$TARGET_COOKIES_TMP" "$TARGET_DEFAULT/Cookies"
rm -f "$TARGET_DEFAULT/Cookies-journal"

# Tock also uses browser storage for client state. Copy only Tock-origin storage
# where Chrome keeps it in a domain-specific directory name. Do not copy the
# whole Local Storage LevelDB because it can contain state for unrelated sites.
mkdir -p "$TARGET_DEFAULT/IndexedDB"

if [[ -d "$SOURCE_DEFAULT/IndexedDB/https_www.exploretock.com_0.indexeddb.leveldb" ]]; then
  rm -rf "$TARGET_DEFAULT/IndexedDB/https_www.exploretock.com_0.indexeddb.leveldb"
  ditto "$SOURCE_DEFAULT/IndexedDB/https_www.exploretock.com_0.indexeddb.leveldb" \
    "$TARGET_DEFAULT/IndexedDB/https_www.exploretock.com_0.indexeddb.leveldb"
fi

COUNT="$(sqlite3 "$TARGET_DEFAULT/Cookies" "SELECT count(*) FROM cookies WHERE host_key LIKE '$COOKIE_HOST_PATTERN' OR host_key LIKE '%tocktix.com%';")"
echo "Imported $COUNT Tock-related cookies into the helper profile."
echo
echo "Now test the helper profile:"
echo "  cd '$SCRIPT_DIR'"
echo "  npm run login"
echo
echo "If it opens already logged in, close the helper Chrome window afterward so Friday's scheduled run can use it."
