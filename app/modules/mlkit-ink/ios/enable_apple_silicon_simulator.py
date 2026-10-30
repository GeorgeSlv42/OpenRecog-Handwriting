#!/usr/bin/env python3
"""Allow Google ML Kit Digital Ink to link on Apple Silicon iOS Simulators.

Official GoogleMLKit pods ship arm64-iphoneos + x86_64-iphonesimulator only, and
set EXCLUDED_ARCHS[sdk=iphonesimulator*]=arm64. Modern Xcode simulators are
arm64-only, so the app has no valid simulator architecture.

This relabels the arm64 slice's LC_BUILD_VERSION platform to iossim (the same
trick as arm64-to-sim) and clears the exclusion. Device slices are restored
when PLATFORM is "ios".
"""

from __future__ import annotations

import argparse
import os
import struct
import subprocess
import sys
import tempfile
from pathlib import Path


FRAMEWORK_NAMES = (
    "MLKitDigitalInkRecognition",
    "MLKitMDD",
    "MLKitCommon",
)


def run(cmd: list[str], cwd: Path | None = None) -> None:
    subprocess.check_call(cmd, cwd=cwd)


def file_desc(path: Path) -> str:
    return subprocess.check_output(["file", str(path)], text=True)


def patch_macho_platform(path: Path, platform: str) -> bool:
    target_platform = 7 if platform == "iossim" else 2
    try:
        with open(path, "rb") as fp:
            data = bytearray(fp.read())
    except OSError:
        return False
    if len(data) < 32:
        return False

    magic = struct.unpack_from("<I", data, 0)[0]
    if magic == 0xfeedfacf:
        header_size = 32
    elif magic == 0xfeedface:
        header_size = 28
    else:
        return False

    ncmds = struct.unpack_from("<I", data, 16)[0]
    offset = header_size
    modified = False
    found_build_version = False
    for _ in range(ncmds):
        if offset + 8 > len(data):
            break
        cmd, cmdsize = struct.unpack_from("<II", data, offset)
        if cmd == 0x32:  # LC_BUILD_VERSION
            found_build_version = True
            current_platform = struct.unpack_from("<I", data, offset + 8)[0]
            if current_platform != target_platform:
                struct.pack_into("<I", data, offset + 8, target_platform)
                modified = True
        offset += cmdsize

    if modified:
        with open(path, "wb") as fp:
            fp.write(data)
        return True
    return found_build_version


def relabel_macho(path: Path, platform: str) -> None:
    if patch_macho_platform(path, platform):
        return
    run(
        [
            "vtool",
            "-arch",
            "arm64",
            "-set-build-version",
            platform,
            "12.0",
            "12.0",
            "-replace",
            "-output",
            str(path),
            str(path),
        ]
    )


def patch_macho_slice(data: bytearray, start: int, size: int, target_platform: int) -> bool:
    if size < 32 or start + 32 > len(data):
        return False
    magic = struct.unpack_from("<I", data, start)[0]
    if magic == 0xfeedfacf:
        header_size = 32
    elif magic == 0xfeedface:
        header_size = 28
    else:
        return False
    ncmds = struct.unpack_from("<I", data, start + 16)[0]
    offset = start + header_size
    modified = False
    for _ in range(ncmds):
        if offset + 8 > len(data):
            break
        cmd, cmdsize = struct.unpack_from("<II", data, offset)
        if cmd == 0x32:  # LC_BUILD_VERSION
            cur_plat = struct.unpack_from("<I", data, offset + 8)[0]
            if cur_plat != target_platform:
                struct.pack_into("<I", data, offset + 8, target_platform)
                modified = True
        offset += cmdsize
    return modified


def patch_ar_archive(data: bytearray, target_platform: int) -> int:
    if data[:8] != b"!<arch>\n":
        return 0
    offset = 8
    patched_count = 0
    while offset < len(data):
        if offset + 60 > len(data):
            break
        header = data[offset:offset+60]
        name = header[:16].strip()
        try:
            size = int(header[48:58].strip())
        except ValueError:
            break
        content_offset = offset + 60
        macho_offset = content_offset
        macho_size = size
        if name.startswith(b"#1/"):
            try:
                fn_len = int(name[3:])
                macho_offset += fn_len
                macho_size -= fn_len
            except ValueError:
                pass

        if patch_macho_slice(data, macho_offset, macho_size, target_platform):
            patched_count += 1

        offset = content_offset + size
        if offset % 2 == 1:
            offset += 1
    return patched_count


def relabel_archive(path: Path, platform: str) -> None:
    target_platform = 7 if platform == "iossim" else 2
    with tempfile.TemporaryDirectory() as raw:
        td = Path(raw)
        arm64_a = td / "arm64.a"
        x86_a = td / "x86_64.a"
        run(["lipo", str(path), "-thin", "arm64", "-output", str(arm64_a)])
        run(["lipo", str(path), "-thin", "x86_64", "-output", str(x86_a)])
        with open(arm64_a, "rb") as fp:
            data = bytearray(fp.read())
        patched_count = patch_ar_archive(data, target_platform)
        print(f"Patched {patched_count} archive members in {path.name}")
        patched_a = td / "arm64-patched.a"
        with open(patched_a, "wb") as fp:
            fp.write(data)
        run(["ranlib", str(patched_a)])
        run(["lipo", "-create", str(x86_a), str(patched_a), "-output", str(path)])


def patch_binary(path: Path, platform: str) -> None:
    desc = file_desc(path)
    if "ar archive" in desc:
        relabel_archive(path, platform)
    else:
        relabel_macho(path, platform)


def clear_excluded_archs(pods_root: Path) -> None:
    for xcconfig in pods_root.glob("Target Support Files/**/*.xcconfig"):
        text = xcconfig.read_text()
        updated = text.replace(
            "EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64",
            "EXCLUDED_ARCHS[sdk=iphonesimulator*] = ",
        )
        if updated != text:
            xcconfig.write_text(updated)


def find_framework_binary(pods_root: Path, name: str) -> Path | None:
    candidates = [
        pods_root / name / "Frameworks" / f"{name}.framework" / name,
        pods_root / "GoogleMLKit" / "Frameworks" / f"{name}.framework" / name,
    ]
    for path in candidates:
        if path.is_file():
            return path
    matches = list(pods_root.glob(f"**/{name}.framework/{name}"))
    return matches[0] if matches else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pods-root", required=True)
    parser.add_argument(
        "--platform",
        choices=("iossim", "ios"),
        default="iossim",
        help="LC_BUILD_VERSION platform for the arm64 slice",
    )
    args = parser.parse_args()
    pods_root = Path(args.pods_root).resolve()
    if not pods_root.is_dir():
        print(f"pods root not found: {pods_root}", file=sys.stderr)
        return 1

    clear_excluded_archs(pods_root)
    patched = 0
    for name in FRAMEWORK_NAMES:
        binary = find_framework_binary(pods_root, name)
        if binary is None:
            print(f"skip missing {name}")
            continue
        print(f"patch {binary} -> {args.platform}")
        patch_binary(binary, args.platform)
        patched += 1
    print(f"patched {patched} ML Kit binaries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
