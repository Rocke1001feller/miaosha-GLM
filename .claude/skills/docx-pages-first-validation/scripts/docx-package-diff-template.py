#!/usr/bin/env python3
"""
docx-package-diff-template.py

Unzip two DOCX files and produce unified diffs for selected XML parts.

Usage:
    python3 docx-package-diff-template.py DOCX_A DOCX_B [--parts PART ...] [--swap-only PART ...] [--swap-output OUTPUT_DOCX]

Positional arguments:
    DOCX_A          Path to the first (typically broken) DOCX file.
    DOCX_B          Path to the second (typically Pages-round-tripped reference) DOCX file.

Optional arguments:
    --parts PART    One or more internal DOCX paths to diff.
                    Defaults to: word/document.xml word/styles.xml word/settings.xml
    --swap-only PART
                    Swap these parts from DOCX_B into DOCX_A and write a new DOCX
                    to --swap-output. Useful for causal bisection (swap one part at
                    a time and test in Pages).
    --swap-output OUTPUT_DOCX
                    Required when --swap-only is given. Path to write the swapped DOCX.
    --no-color      Suppress ANSI color codes in diff output.

Examples:
    # Default diff (document.xml, styles.xml, settings.xml)
    python3 docx-package-diff-template.py broken.docx reference.docx

    # Diff specific parts only
    python3 docx-package-diff-template.py broken.docx reference.docx \\
        --parts word/styles.xml word/settings.xml

    # Swap only styles.xml from reference into broken, write swapped DOCX
    python3 docx-package-diff-template.py broken.docx reference.docx \\
        --swap-only word/styles.xml --swap-output /tmp/swapped-styles-only.docx
"""

import argparse
import difflib
import shutil
import sys
import zipfile
from pathlib import Path

DEFAULT_PARTS = [
    "word/document.xml",
    "word/styles.xml",
    "word/settings.xml",
]

ANSI_RED = "\033[31m"
ANSI_GREEN = "\033[32m"
ANSI_CYAN = "\033[36m"
ANSI_RESET = "\033[0m"


def read_part(zf: zipfile.ZipFile, part: str) -> str | None:
    """Read a named part from an open ZipFile. Returns None if not present."""
    try:
        return zf.read(part).decode("utf-8", errors="replace")
    except KeyError:
        return None


def colorize_diff(lines: list[str], use_color: bool) -> str:
    result = []
    for line in lines:
        if not use_color:
            result.append(line)
            continue
        if line.startswith("---") or line.startswith("+++"):
            result.append(f"{ANSI_CYAN}{line}{ANSI_RESET}")
        elif line.startswith("-"):
            result.append(f"{ANSI_RED}{line}{ANSI_RESET}")
        elif line.startswith("+"):
            result.append(f"{ANSI_GREEN}{line}{ANSI_RESET}")
        else:
            result.append(line)
    return "".join(result)


def diff_parts(
    path_a: Path,
    path_b: Path,
    parts: list[str],
    use_color: bool,
) -> dict[str, list[str]]:
    """Return a mapping of part_name -> unified diff lines (empty list = identical)."""
    results: dict[str, list[str]] = {}
    with zipfile.ZipFile(path_a) as za, zipfile.ZipFile(path_b) as zb:
        for part in parts:
            text_a = read_part(za, part)
            text_b = read_part(zb, part)

            if text_a is None and text_b is None:
                results[part] = []
                continue
            if text_a is None:
                results[part] = [f"<< {part} not present in DOCX_A >>\n"]
                continue
            if text_b is None:
                results[part] = [f"<< {part} not present in DOCX_B >>\n"]
                continue

            lines_a = text_a.splitlines(keepends=True)
            lines_b = text_b.splitlines(keepends=True)
            diff = list(
                difflib.unified_diff(
                    lines_a,
                    lines_b,
                    fromfile=f"DOCX_A:{part}",
                    tofile=f"DOCX_B:{part}",
                )
            )
            results[part] = diff
    return results


def swap_parts_and_write(
    path_a: Path,
    path_b: Path,
    parts_to_swap: list[str],
    output_path: Path,
) -> None:
    """
    Copy DOCX_A to output_path, then replace the specified parts with content
    from DOCX_B. All other parts from DOCX_A are preserved.
    """
    shutil.copy2(path_a, output_path)

    # Read the parts to swap from DOCX_B.
    swap_data: dict[str, bytes] = {}
    with zipfile.ZipFile(path_b) as zb:
        for part in parts_to_swap:
            try:
                swap_data[part] = zb.read(part)
            except KeyError:
                print(
                    f"WARNING: Part '{part}' not found in DOCX_B — skipping swap for this part.",
                    file=sys.stderr,
                )

    if not swap_data:
        print("ERROR: No parts could be swapped. Output file is unchanged.", file=sys.stderr)
        return

    # Repack the output file with the swapped parts.
    # zipfile does not support in-place edit, so we build a temp file then replace.
    tmp_output = output_path.with_suffix(".tmp.docx")
    with zipfile.ZipFile(output_path, "r") as src_zip, zipfile.ZipFile(
        tmp_output, "w", compression=zipfile.ZIP_DEFLATED
    ) as dst_zip:
        for item in src_zip.infolist():
            if item.filename in swap_data:
                dst_zip.writestr(item, swap_data[item.filename])
            else:
                dst_zip.writestr(item, src_zip.read(item.filename))

    tmp_output.replace(output_path)
    print(f"Swapped DOCX written: {output_path}")
    print(f"  Parts replaced from DOCX_B: {', '.join(swap_data.keys())}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Diff or swap XML parts between two DOCX files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("docx_a", help="Path to DOCX A (typically broken)")
    parser.add_argument("docx_b", help="Path to DOCX B (typically Pages reference)")
    parser.add_argument(
        "--parts",
        nargs="+",
        default=DEFAULT_PARTS,
        metavar="PART",
        help="Internal DOCX paths to diff (default: word/document.xml word/styles.xml word/settings.xml)",
    )
    parser.add_argument(
        "--swap-only",
        nargs="+",
        metavar="PART",
        help="Swap these parts from DOCX_B into DOCX_A and write to --swap-output",
    )
    parser.add_argument(
        "--swap-output",
        metavar="OUTPUT_DOCX",
        help="Output path for the swapped DOCX (required when --swap-only is given)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Suppress ANSI color codes",
    )
    args = parser.parse_args()

    path_a = Path(args.docx_a)
    path_b = Path(args.docx_b)

    if not path_a.exists():
        print(f"ERROR: DOCX_A not found: {path_a}", file=sys.stderr)
        sys.exit(1)
    if not path_b.exists():
        print(f"ERROR: DOCX_B not found: {path_b}", file=sys.stderr)
        sys.exit(1)

    use_color = not args.no_color and sys.stdout.isatty()

    # --- Diff mode ---
    diffs = diff_parts(path_a, path_b, args.parts, use_color)
    identical_parts = []
    changed_parts = []

    for part, diff_lines in diffs.items():
        if not diff_lines:
            identical_parts.append(part)
        else:
            changed_parts.append(part)
            header = f"\n{'='*60}\nDIFF: {part}\n{'='*60}\n"
            print(header)
            print(colorize_diff(diff_lines, use_color), end="")

    if identical_parts:
        print(f"\nIdentical (no diff): {', '.join(identical_parts)}")
    if not changed_parts:
        print("\nAll diffed parts are identical.")
    else:
        print(f"\nChanged parts: {', '.join(changed_parts)}")

    # --- Swap mode ---
    if args.swap_only:
        if not args.swap_output:
            print(
                "ERROR: --swap-only requires --swap-output to specify the output DOCX path.",
                file=sys.stderr,
            )
            sys.exit(1)
        output_path = Path(args.swap_output)
        swap_parts_and_write(path_a, path_b, args.swap_only, output_path)


if __name__ == "__main__":
    main()
