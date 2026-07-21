#!/usr/bin/env bash
# pages-roundtrip-template.sh
#
# Open a DOCX in Apple Pages, optionally export back to DOCX (round-trip reference),
# then export to PDF, and render a Quick Look thumbnail.
#
# Usage:
#   ./pages-roundtrip-template.sh INPUT_DOCX OUTPUT_PDF
#
# Environment variables (all optional):
#   EXPORT_DOCX     – if set, Pages also exports a DOCX to this path (round-trip reference)
#   PAGES_CLOSE_AFTER  – set to 0 to leave Pages open (default: 1 = close)
#   THUMBNAIL_SIZE     – qlmanage -s size (default: 1600)
#
# Example — acceptance gate only (PDF + thumbnail, no round-trip DOCX):
#   ./pages-roundtrip-template.sh /tmp/artifact.docx /tmp/artifact.pdf
#
# Example — generate round-trip reference:
#   EXPORT_DOCX=/tmp/reference.docx ./pages-roundtrip-template.sh /tmp/probe.docx /tmp/probe.pdf

set -euo pipefail

INPUT_DOCX="${1:?Usage: $0 INPUT_DOCX OUTPUT_PDF}"
OUTPUT_PDF="${2:?Usage: $0 INPUT_DOCX OUTPUT_PDF}"
CLOSE_AFTER="${PAGES_CLOSE_AFTER:-1}"
THUMB_SIZE="${THUMBNAIL_SIZE:-1600}"

# Resolve to absolute paths so AppleScript can consume them reliably.
INPUT_DOCX="$(cd "$(dirname "$INPUT_DOCX")" && pwd)/$(basename "$INPUT_DOCX")"
OUTPUT_PDF="$(cd "$(dirname "$OUTPUT_PDF")" && pwd)/$(basename "$OUTPUT_PDF")"

if [[ ! -f "$INPUT_DOCX" ]]; then
  echo "ERROR: Input file not found: $INPUT_DOCX" >&2
  exit 1
fi

echo "Opening in Pages: $INPUT_DOCX"

# Build the optional round-trip export block.
EXPORT_DOCX_BLOCK=""
if [[ -n "${EXPORT_DOCX:-}" ]]; then
  EXPORT_DOCX_ABS="$(cd "$(dirname "$EXPORT_DOCX")" && pwd)/$(basename "$EXPORT_DOCX")"
  echo "Round-trip DOCX will be written to: $EXPORT_DOCX_ABS"
  EXPORT_DOCX_BLOCK="$(cat <<HEREDOC
    -- Round-trip: export back to DOCX so the caller can diff styles.xml
    export docRef to POSIX file "$EXPORT_DOCX_ABS" as Microsoft Word
    delay 1
HEREDOC
)"
fi

# Build the close block.
CLOSE_BLOCK=""
if [[ "$CLOSE_AFTER" == "1" ]]; then
  CLOSE_BLOCK="close docRef saving no"
fi

osascript <<APPLESCRIPT
tell application "Pages"
  activate
  set docRef to open POSIX file "$INPUT_DOCX"
  -- Give Pages a moment to fully import and lay out the document.
  delay 2
  $EXPORT_DOCX_BLOCK
  -- Export to PDF for the acceptance thumbnail.
  export docRef to POSIX file "$OUTPUT_PDF" as PDF
  delay 1
  $CLOSE_BLOCK
end tell
APPLESCRIPT

echo "PDF written: $OUTPUT_PDF"

# Render a Quick Look thumbnail for quick visual inspection.
# NOTE: Quick Look is for rapid iteration only — not for final acceptance sign-off.
# The PDF above is the authoritative Pages output. Open it in Preview to verify layout.
THUMB_DIR="$(dirname "$OUTPUT_PDF")"
qlmanage -t -s "$THUMB_SIZE" -o "$THUMB_DIR" "$OUTPUT_PDF" 2>/dev/null || true
THUMB_FILE="${OUTPUT_PDF}.png"
if [[ -f "$THUMB_FILE" ]]; then
  echo "Thumbnail: $THUMB_FILE"
  echo "(Open the PDF itself in Preview for authoritative layout inspection.)"
else
  echo "qlmanage thumbnail not generated — open the PDF directly in Preview."
fi
