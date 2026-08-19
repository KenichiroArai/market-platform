"""Pytest shared configuration for import path setup.

CI/runner differences can omit the package root from sys.path when tests are
invoked through turbo + uv. Ensure `from app ...` imports are always resolvable.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
