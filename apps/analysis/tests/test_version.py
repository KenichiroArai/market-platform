"""製品バージョン読み取りの単体テスト。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.main import app
from app.version import read_app_version


def test_read_app_version_from_fixture(tmp_path: Path) -> None:
    """ネストした階層からルート package.json の version を読むこと。"""
    nested = tmp_path / "apps" / "analysis" / "app"
    nested.mkdir(parents=True)
    (tmp_path / "package.json").write_text(
        json.dumps({"name": "market-platform", "version": "9.9.9"}),
        encoding="utf-8",
    )
    (tmp_path / "apps" / "analysis" / "package.json").write_text(
        json.dumps({"name": "@market/analysis", "version": "0.0.0"}),
        encoding="utf-8",
    )

    assert read_app_version(nested / "dummy.py") == "9.9.9"


def test_read_app_version_skips_unrelated_and_broken(tmp_path: Path) -> None:
    """無関係・壊れた package.json をスキップしてルートを見つけること。"""
    nested = tmp_path / "nested"
    nested.mkdir()
    (nested / "package.json").write_text("{not-json", encoding="utf-8")
    (tmp_path / "package.json").write_text(
        json.dumps({"name": "market-platform", "version": "1.2.3"}),
        encoding="utf-8",
    )

    assert read_app_version(nested / "x.py") == "1.2.3"


def test_read_app_version_missing_raises(tmp_path: Path) -> None:
    """ルートが見つからない場合は FileNotFoundError になること。"""
    with pytest.raises(FileNotFoundError, match="market-platform"):
        read_app_version(tmp_path / "x.py")


def test_fastapi_app_uses_root_package_version() -> None:
    """FastAPI の version がルート package.json と一致すること。"""
    assert app.version == read_app_version()
