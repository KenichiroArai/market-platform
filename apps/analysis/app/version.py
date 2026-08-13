"""
製品バージョンの読み取り。

正本はモノレポルートの package.json（name: market-platform）。
ローカルではリポジトリルート、Docker では /app/package.json を想定する。
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT_PACKAGE_NAME = "market-platform"


def read_app_version(start: Path | None = None) -> str:
    """親ディレクトリを辿り、ルート package.json の version を返す。"""
    current = (start or Path(__file__).resolve()).parent

    while True:
        candidate = current / "package.json"
        if candidate.is_file():
            try:
                pkg = json.loads(candidate.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                pkg = None
            if (
                isinstance(pkg, dict)
                and pkg.get("name") == ROOT_PACKAGE_NAME
                and isinstance(pkg.get("version"), str)
            ):
                return pkg["version"]

        parent = current.parent
        if parent == current:
            raise FileNotFoundError(
                f"Root package.json (name: {ROOT_PACKAGE_NAME}) with version was not found"
            )
        current = parent
