"""
分析 API（FastAPI）のエントリ。

Phase 0 ではヘルスチェックのみを提供する。
テクニカル分析・バックテスト・AI は後続 Phase でここに拡張する。
NestJS（api）からは内部 HTTP（ANALYSIS_URL）経由で呼ばれる想定。
"""

from fastapi import FastAPI

# title/version は OpenAPI ドキュメント（/docs）に反映される
app = FastAPI(title="market-analysis", version="0.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    """プロセス生存確認用。依存 DB は持たない（永続化は NestJS 側の責務）。"""
    return {"status": "ok", "service": "analysis"}
