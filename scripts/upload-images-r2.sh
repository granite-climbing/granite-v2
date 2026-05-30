#!/usr/bin/env bash
#
# Convert staged entity images to webp and upload them to the R2 bucket.
#
# Source:  docs/data/images/{crags,boulders,topos,routes}/{slug}/{purpose}.{ext}
# Keys:    {entity}/{slug}/{purpose}.webp   (staging path minus the /images/ prefix)
# URLs:    ${CDN_BASE_URL}/{key}            (baked into migrations/0002 by the import script)
#
# Requires: cwebp, npx wrangler (authenticated). Excludes routes/unmapped and misc.
#
# Usage: scripts/upload-images-r2.sh [bucket]   (default bucket: granite-v2)
set -euo pipefail

BUCKET="${1:-granite-v2}"
SRC="docs/data/images"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

ok=0; fail=0; n=0
while IFS= read -r f; do
  rel="${f#"$SRC"/}"                 # boulders/gomul_boulder/cover.jpg
  key="${rel%.*}.webp"              # boulders/gomul_boulder/cover.webp
  dest="$OUT/$key"
  mkdir -p "$(dirname "$dest")"
  cwebp -quiet -q 80 "$f" -o "$dest"
  n=$((n + 1))
  if npx wrangler r2 object put "$BUCKET/$key" \
      --file "$dest" \
      --content-type image/webp \
      --cache-control "public, max-age=31536000, immutable" \
      --remote >/dev/null 2>&1; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1)); echo "FAIL: $key"
  fi
done < <(find "$SRC" \
  \( -path "$SRC/routes/unmapped" -o -path "$SRC/misc" \) -prune -o \
  -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print)

echo "uploaded: ok=$ok fail=$fail total=$n -> bucket=$BUCKET"
