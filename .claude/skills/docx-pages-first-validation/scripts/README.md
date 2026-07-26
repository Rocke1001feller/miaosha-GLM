# Scripts Reference

These scripts support the Standard Operating Procedure in `../SKILL.md`. Each one is parameterized and machine-portable. Do not hardcode repo paths, macOS usernames, or case-specific temp paths into the scripts themselves — pass them as arguments.

---

## `pages-roundtrip-template.sh`

**Purpose:** Open a DOCX in Apple Pages, export it to PDF, and render a Quick Look thumbnail for visual inspection.

**When to use:**
- Step 5 of the SOP: generate a Pages-round-tripped reference DOCX.
- Step 9 of the SOP: real Pages acceptance gate after applying a fix.

**Usage:**

```bash
# Accept a DOCX, export to PDF, render thumbnail
./pages-roundtrip-template.sh /path/to/artifact.docx /tmp/output.pdf

# To also export back to DOCX (for the reference generation path):
EXPORT_DOCX=/tmp/reference.docx ./pages-roundtrip-template.sh /path/to/artifact.docx /tmp/output.pdf
```

**Environment variables (all optional):**

| Variable | Default | Description |
|---|---|---|
| `EXPORT_DOCX` | *(not set)* | If set, Pages also exports the document back to DOCX at this path, creating a "round-tripped" reference for package diffing |
| `PAGES_CLOSE_AFTER` | `1` | Set to `0` to leave Pages open for manual inspection |
| `THUMBNAIL_SIZE` | `1600` | `qlmanage -s` size for the rendered thumbnail |

**Output:**
- PDF at the path you specify.
- PNG thumbnail at `<OUTPUT_PDF>.png` (e.g., `/tmp/output.pdf.png`).
- If `EXPORT_DOCX` is set: also a DOCX at that path.

**Requirements:**
- macOS with Apple Pages installed.
- `qlmanage` available (pre-installed on macOS).
- The input DOCX must exist before the script runs.

---

## `docx-package-diff-template.py`

**Purpose:** Unzip two DOCX files and produce unified diffs for selected XML parts.

**When to use:**
- Step 6 of the SOP: compare the broken DOCX against the Pages-written reference to find the first changed structural part.
- Any time you want to see exactly what changed between two DOCX builds.

**Usage:**

```bash
# Diff the default parts (document.xml, styles.xml, settings.xml)
python3 docx-package-diff-template.py broken.docx reference.docx

# Diff specific parts only
python3 docx-package-diff-template.py broken.docx reference.docx --parts word/styles.xml word/settings.xml

# Swap one part from reference into broken, repack, and write to output
python3 docx-package-diff-template.py broken.docx reference.docx --swap-only word/styles.xml --swap-output /tmp/swapped.docx
```

**Output:**
- Unified diff for each requested part printed to stdout.
- If `--swap-output` is given: a new DOCX at that path with the swapped part(s).

**Requirements:**
- Python 3.8+ with only stdlib (`zipfile`, `difflib`, `argparse`, `pathlib`, `shutil`).
- No third-party packages needed.

---

## Combining The Two Scripts (Typical Bisection Workflow)

```bash
# 1. Generate a Pages round-tripped reference from a known-good source
EXPORT_DOCX=/tmp/reference.docx ./pages-roundtrip-template.sh /tmp/probe-good.docx /tmp/probe-good.pdf

# 2. Diff all parts to find candidates
python3 docx-package-diff-template.py /tmp/probe-broken.docx /tmp/reference.docx

# 3. Swap only styles.xml and test in Pages
python3 docx-package-diff-template.py /tmp/probe-broken.docx /tmp/reference.docx \
  --swap-only word/styles.xml --swap-output /tmp/swapped-styles-only.docx
./pages-roundtrip-template.sh /tmp/swapped-styles-only.docx /tmp/swapped-styles-only.pdf

# 4. Inspect: if this renders correctly, styles.xml is the causal part
open /tmp/swapped-styles-only.pdf.png
```
