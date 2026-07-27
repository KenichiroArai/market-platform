"""
分析 API（FastAPI）のエントリ。

Phase 4 ではヘルスに加え、テクニカル指標（SMA/EMA/RSI/MACD）の計算エンドポイントを提供する。
NestJS（api）からは内部 HTTP（ANALYSIS_URL）経由で呼ばれる想定（認証なし）。
永続化は持たず、受け取った OHLC に対してオンデマンド計算するだけ。
"""

from __future__ import annotations

import time

from fastapi import FastAPI

from app import indicators as indicator_calc
from app.errors import register_exception_handlers
from app.logging_middleware import RequestLoggingMiddleware
from app.schemas import (
    ComputeIndicatorsRequest,
    ComputeIndicatorsResponse,
    HealthResponse,
    IndicatorSeriesPoint,
    IndicatorSpec,
)

# プロセス起動時刻。uptimeSeconds 算出用。
_STARTED_AT = time.time()

app = FastAPI(
    title="market-analysis",
    version="0.1.0",
    description="market-platform 分析 API（FastAPI）。NestJS から内部 HTTP で呼ばれる。",
)

# 共通エラーとリクエストログを配線
register_exception_handlers(app)
app.add_middleware(RequestLoggingMiddleware)


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """プロセス生存確認用。依存 DB は持たない（永続化は NestJS 側の責務）。"""
    return HealthResponse(
        status="ok",
        service="analysis",
        details={"uptimeSeconds": int(time.time() - _STARTED_AT)},
    )


@app.post(
    "/indicators",
    response_model=ComputeIndicatorsResponse,
    tags=["indicators"],
)
def compute_indicators(body: ComputeIndicatorsRequest) -> ComputeIndicatorsResponse:
    """
    OHLC 配列に対して要求されたテクニカル指標を計算する。

    bars は日付昇順であること（Nest 側でソート済みを渡す）。
    ウォームアップ不足の値は null。空の bars でも 200 + 空 points を返す。
    """
    closes = [bar.close for bar in body.bars]
    dates = [bar.date for bar in body.bars]

    # 日付ごとにマージする箱を用意（要求キーだけ後で埋める）
    points: list[IndicatorSeriesPoint] = [
        IndicatorSeriesPoint(date=date) for date in dates
    ]

    for spec in body.indicators:
        _apply_indicator(spec, closes, points)

    return ComputeIndicatorsResponse(indicators=body.indicators, points=points)


def _apply_indicator(
    spec: IndicatorSpec,
    closes: list[float],
    points: list[IndicatorSeriesPoint],
) -> None:
    """1 指標の計算結果を points に書き込む。"""
    if spec.type == "sma":
        assert spec.period is not None
        values = indicator_calc.sma(closes, spec.period)
        for point, value in zip(points, values, strict=True):
            point.sma = value
    elif spec.type == "ema":
        assert spec.period is not None
        values = indicator_calc.ema(closes, spec.period)
        for point, value in zip(points, values, strict=True):
            point.ema = value
    elif spec.type == "rsi":
        assert spec.period is not None
        values = indicator_calc.rsi(closes, spec.period)
        for point, value in zip(points, values, strict=True):
            point.rsi = value
    elif spec.type == "macd":
        assert spec.fast is not None and spec.slow is not None and spec.signal is not None
        macd_line, signal_line, histogram = indicator_calc.macd(
            closes,
            fast=spec.fast,
            slow=spec.slow,
            signal=spec.signal,
        )
        for point, m, s, h in zip(points, macd_line, signal_line, histogram, strict=True):
            point.macd = m
            point.macdSignal = s
            point.macdHistogram = h
