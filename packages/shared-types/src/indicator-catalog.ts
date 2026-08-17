/**
 * テクニカル指標カタログ（ADR 006）。
 *
 * UI の分類・説明、Nest の許可リスト、既定パラメータ、lookback の正本。
 * 計算そのものは FastAPI 側。ここは「何を・どの既定で・どこに描くか」だけを持つ。
 */

/** 分類 ID。UI のアコーディオン見出しに対応する。 */
export type IndicatorCategoryId =
  | 'trend'
  | 'momentum'
  | 'oscillator'
  | 'volatility'
  | 'volume'
  | 'cycle';

/** チャート上の置き場。 */
export type IndicatorPaneKind =
  | 'overlay'
  | 'oscillator'
  | 'volume'
  | 'volumeProfile'
  | 'drawing'
  | 'none';

/** カタログ上のトグル ID（GET `indicators=` のトークン）。 */
export type IndicatorCatalogId =
  | 'sma25'
  | 'sma75'
  | 'sma200'
  | 'ema50'
  | 'macd'
  | 'ichimoku'
  | 'psar'
  | 'momentum'
  | 'roc'
  | 'rsi'
  | 'cci'
  | 'stoch'
  | 'willr'
  | 'psy'
  | 'bb'
  | 'atr'
  | 'stdev'
  | 'keltner'
  | 'volume'
  | 'obv'
  | 'vwap'
  | 'mfi'
  | 'volumeProfile'
  | 'fibonacci'
  | 'elliott';

/**
 * analysis が計算する種類。
 * `volume` / `elliott` は計算しないため含めない。
 */
export type IndicatorComputeType =
  | 'sma'
  | 'ema'
  | 'macd'
  | 'ichimoku'
  | 'psar'
  | 'momentum'
  | 'roc'
  | 'rsi'
  | 'cci'
  | 'stoch'
  | 'willr'
  | 'psy'
  | 'bb'
  | 'atr'
  | 'stdev'
  | 'keltner'
  | 'obv'
  | 'vwap'
  | 'mfi'
  | 'volumeProfile'
  | 'fibonacci';

/** 1 本の描画系列（`values` のキーと対応）。 */
export interface IndicatorSeriesStyle {
  key: string;
  label: string;
  color: string;
  style: 'line' | 'histogram' | 'dots';
}

/** 分類の見出しと目的文。 */
export interface IndicatorCategory {
  id: IndicatorCategoryId;
  nameJa: string;
  purpose: string;
}

/** カタログ 1 件。 */
export interface IndicatorDefinition {
  id: IndicatorCatalogId;
  /** analysis に送る種類。計算しない指標は null。 */
  computeType: IndicatorComputeType | null;
  categories: IndicatorCategoryId[];
  /**
   * トレンドスコア用のグループ。1 指標 1 グループ（ADR 007）。
   * UI の categories とは独立。採点しない指標は null。
   */
  scoreGroup: IndicatorCategoryId | null;
  nameJa: string;
  shortPurpose: string;
  description: string;
  pane: IndicatorPaneKind;
  /** おすすめ構成として初期 ON にするか（生出来高は別フラグ）。 */
  recommended: boolean;
  /** チャートを開いたとき ON か。おすすめ + 生出来高。 */
  defaultEnabled: boolean;
  /** チェック不可（説明のみ）。 */
  disabled: boolean;
  params: Record<string, number>;
  /** ウォームアップに必要な本数。表示期間アンカー系は 0。 */
  lookbackBars: number;
  /** 一目の先行スパンなど、最終バーより先に出す本数。 */
  futureBars: number;
  series: IndicatorSeriesStyle[];
}

export const INDICATOR_CATEGORIES: IndicatorCategory[] = [
  {
    id: 'trend',
    nameJa: 'トレンド系',
    purpose: '相場の方向性を判断する',
  },
  {
    id: 'momentum',
    nameJa: 'モメンタム系',
    purpose: '値動きの勢いを測る',
  },
  {
    id: 'oscillator',
    nameJa: 'オシレーター系',
    purpose: '買われすぎ・売られすぎを判断する',
  },
  {
    id: 'volatility',
    nameJa: 'ボラティリティ系',
    purpose: '値動きの大きさを測る',
  },
  {
    id: 'volume',
    nameJa: '出来高系',
    purpose: '売買の強さや資金の流れを分析する',
  },
  {
    id: 'cycle',
    nameJa: 'サイクル系',
    purpose: '相場の周期や転換点を分析する',
  },
];

export const INDICATOR_CATALOG: IndicatorDefinition[] = [
  {
    id: 'sma25',
    computeType: 'sma',
    categories: ['trend'],
    scoreGroup: 'trend',
    nameJa: '移動平均線 25',
    shortPurpose: '短期の方向性を確認する',
    description:
      '直近 25 本の終値平均です。価格が線の上にあれば短期は上向き、下にあれば下向きと見ます。75・200 と並べると短期・中期・長期の位置関係が分かります。',
    pane: 'overlay',
    recommended: true,
    defaultEnabled: true,
    disabled: false,
    params: { period: 25 },
    lookbackBars: 25,
    futureBars: 0,
    series: [{ key: 'sma25', label: 'SMA25', color: '#f5c542', style: 'line' }],
  },
  {
    id: 'sma75',
    computeType: 'sma',
    categories: ['trend'],
    scoreGroup: 'trend',
    nameJa: '移動平均線 75',
    shortPurpose: '中期の方向性を確認する',
    description:
      '直近 75 本の終値平均です。短期線が中期線を上抜け／下抜けすると、トレンド転換の手がかりになります。',
    pane: 'overlay',
    recommended: true,
    defaultEnabled: true,
    disabled: false,
    params: { period: 75 },
    lookbackBars: 75,
    futureBars: 0,
    series: [{ key: 'sma75', label: 'SMA75', color: '#ff9f43', style: 'line' }],
  },
  {
    id: 'sma200',
    computeType: 'sma',
    categories: ['trend'],
    scoreGroup: 'trend',
    nameJa: '移動平均線 200',
    shortPurpose: '長期の方向性を確認する',
    description:
      '直近 200 本の終値平均です。長期トレンドの目安で、価格が 200 日線の上にある相場は強気、下は弱気と読まれることが多いです。',
    pane: 'overlay',
    recommended: true,
    defaultEnabled: true,
    disabled: false,
    params: { period: 200 },
    lookbackBars: 200,
    futureBars: 0,
    series: [{ key: 'sma200', label: 'SMA200', color: '#e8eef5', style: 'line' }],
  },
  {
    id: 'ema50',
    computeType: 'ema',
    categories: ['trend'],
    scoreGroup: 'trend',
    nameJa: 'EMA 50',
    shortPurpose: '直近値を重視した中期トレンド',
    description:
      '指数平滑移動平均（期間 50）です。SMA より直近の値動きに敏感で、トレンドの追従が速くなります。',
    pane: 'overlay',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { period: 50 },
    lookbackBars: 50,
    futureBars: 0,
    series: [{ key: 'ema50', label: 'EMA50', color: '#7eb8ff', style: 'line' }],
  },
  {
    id: 'macd',
    computeType: 'macd',
    categories: ['trend', 'momentum'],
    scoreGroup: 'trend',
    nameJa: 'MACD',
    shortPurpose: 'トレンド転換や勢いを判断する',
    description:
      '短期 EMA と長期 EMA の差（12-26）と、そのシグナル EMA（9）です。ゴールデンクロスは買い、デッドクロスは売りの目安。ヒストグラムは勢いの強弱を表します。',
    pane: 'oscillator',
    recommended: true,
    defaultEnabled: true,
    disabled: false,
    params: { fast: 12, slow: 26, signal: 9 },
    lookbackBars: 35,
    futureBars: 0,
    series: [
      { key: 'macd', label: 'MACD', color: '#7eb8ff', style: 'line' },
      { key: 'macdSignal', label: 'Signal', color: '#f5c542', style: 'line' },
      { key: 'macdHistogram', label: 'Hist', color: '#26a69a', style: 'histogram' },
    ],
  },
  {
    id: 'ichimoku',
    computeType: 'ichimoku',
    categories: ['trend', 'cycle'],
    scoreGroup: 'trend',
    nameJa: '一目均衡表',
    shortPurpose: '支持・抵抗や長期的な相場転換を判断する',
    description:
      '転換線（9）・基準線（26）・先行スパン（26 本先）・遅行スパンで構成します。価格が雲の上なら強気、下なら弱気。時間論の 9・17・26 は線の期間そのもので、別計算はしません。',
    pane: 'overlay',
    recommended: true,
    defaultEnabled: true,
    disabled: false,
    params: { tenkan: 9, kijun: 26, senkouB: 52, displacement: 26 },
    lookbackBars: 78,
    futureBars: 26,
    series: [
      { key: 'ichimokuTenkan', label: '転換', color: '#ff8a80', style: 'line' },
      { key: 'ichimokuKijun', label: '基準', color: '#82b1ff', style: 'line' },
      { key: 'ichimokuSenkouA', label: '先行A', color: '#69f0ae', style: 'line' },
      { key: 'ichimokuSenkouB', label: '先行B', color: '#ff5252', style: 'line' },
      { key: 'ichimokuChikou', label: '遅行', color: '#ce93d8', style: 'line' },
    ],
  },
  {
    id: 'psar',
    computeType: 'psar',
    categories: ['trend'],
    scoreGroup: 'trend',
    nameJa: 'パラボリック SAR',
    shortPurpose: 'トレンドの停止と反転を点で示す',
    description:
      '価格の下に点があれば上昇トレンド、上にあれば下降トレンドです。点が反対側へ飛び移るとトレンド転換の合図とされます。AF は 0.02、上限 0.2 です。',
    pane: 'overlay',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { step: 0.02, maxStep: 0.2 },
    lookbackBars: 2,
    futureBars: 0,
    series: [{ key: 'psar', label: 'PSAR', color: '#ffd54f', style: 'dots' }],
  },
  {
    id: 'momentum',
    computeType: 'momentum',
    categories: ['momentum'],
    scoreGroup: 'momentum',
    nameJa: 'モメンタム',
    shortPurpose: 'N 本前からの値幅で勢いを測る',
    description:
      '終値 − N 本前の終値（既定 10）です。ゼロより上なら上昇の勢い、下なら下落の勢い。ゼロラインのクロスを転換の目安にします。',
    pane: 'oscillator',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { period: 10 },
    lookbackBars: 10,
    futureBars: 0,
    series: [{ key: 'momentum', label: 'MOM', color: '#80cbc4', style: 'line' }],
  },
  {
    id: 'roc',
    computeType: 'roc',
    categories: ['momentum'],
    scoreGroup: 'momentum',
    nameJa: 'ROC',
    shortPurpose: '変化率で勢いを測る',
    description:
      'Rate of Change。N 本前比の変化率（%）、既定 12 です。モメンタムを比率で見たもので、銘柄間の比較がしやすいです。',
    pane: 'oscillator',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { period: 12 },
    lookbackBars: 12,
    futureBars: 0,
    series: [{ key: 'roc', label: 'ROC', color: '#a5d6a7', style: 'line' }],
  },
  {
    id: 'rsi',
    computeType: 'rsi',
    categories: ['momentum', 'oscillator'],
    scoreGroup: 'oscillator',
    nameJa: 'RSI',
    shortPurpose: '買われすぎ・売られすぎを判断する',
    description:
      '相対力指数（期間 14、Wilder 平滑）です。70 以上は買われすぎ、30 以下は売られすぎの目安。トレンド相場では高値圏・安値圏に張り付くことがあります。',
    pane: 'oscillator',
    recommended: true,
    defaultEnabled: true,
    disabled: false,
    params: { period: 14 },
    lookbackBars: 14,
    futureBars: 0,
    series: [{ key: 'rsi', label: 'RSI', color: '#c79bff', style: 'line' }],
  },
  {
    id: 'cci',
    computeType: 'cci',
    categories: ['momentum', 'oscillator'],
    scoreGroup: 'oscillator',
    nameJa: 'CCI',
    shortPurpose: '平均からの乖離で過熱を見る',
    description:
      'Commodity Channel Index（期間 20）。Typical Price が移動平均からどれだけ離れたかを示します。+100 超は買われすぎ、-100 未満は売られすぎの目安です。',
    pane: 'oscillator',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { period: 20 },
    lookbackBars: 20,
    futureBars: 0,
    series: [{ key: 'cci', label: 'CCI', color: '#f48fb1', style: 'line' }],
  },
  {
    id: 'stoch',
    computeType: 'stoch',
    categories: ['oscillator'],
    scoreGroup: 'oscillator',
    nameJa: 'ストキャスティクス',
    shortPurpose: '高値安値レンジ内の位置で過熱を見る',
    description:
      '%K（14）と %D（3）です。80 以上は買われすぎ、20 以下は売られすぎ。%K が %D をクロスすると転換の手がかりになります。',
    pane: 'oscillator',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { kPeriod: 14, kSmoothing: 3, dPeriod: 3 },
    lookbackBars: 20,
    futureBars: 0,
    series: [
      { key: 'stochK', label: '%K', color: '#80deea', style: 'line' },
      { key: 'stochD', label: '%D', color: '#ffab91', style: 'line' },
    ],
  },
  {
    id: 'willr',
    computeType: 'willr',
    categories: ['oscillator'],
    scoreGroup: 'oscillator',
    nameJa: 'ウィリアムズ %R',
    shortPurpose: '高値からの位置で過熱を見る',
    description:
      'Williams %R（期間 14）。0 〜 -100 で、0 に近いほど買われすぎ、-100 に近いほど売られすぎです。ストキャスティクスと似た見方をします。',
    pane: 'oscillator',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { period: 14 },
    lookbackBars: 14,
    futureBars: 0,
    series: [{ key: 'willr', label: '%R', color: '#b39ddb', style: 'line' }],
  },
  {
    id: 'psy',
    computeType: 'psy',
    categories: ['oscillator'],
    scoreGroup: 'oscillator',
    nameJa: 'サイコロジカルライン',
    shortPurpose: '陽線比率で投資家心理を見る',
    description:
      '直近 12 本のうち終値が前日比プラスだった割合（%）です。75% 超は楽観の行き過ぎ、25% 未満は悲観の行き過ぎと読まれることがあります。',
    pane: 'oscillator',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { period: 12 },
    lookbackBars: 12,
    futureBars: 0,
    series: [{ key: 'psy', label: 'PSY', color: '#fff59d', style: 'line' }],
  },
  {
    id: 'bb',
    computeType: 'bb',
    categories: ['volatility'],
    scoreGroup: 'volatility',
    nameJa: 'ボリンジャーバンド',
    shortPurpose: '値動きの大きさやブレイクアウトを確認する',
    description:
      'SMA 20 を中心に ±2σ のバンドです。バンド幅が狭いと squooze、拡大しながらのバンド超えはブレイクアウトの手がかり。価格がバンドに沿って走る「バンドウォーク」にも注意します。',
    pane: 'overlay',
    recommended: true,
    defaultEnabled: true,
    disabled: false,
    params: { period: 20, stdDev: 2 },
    lookbackBars: 20,
    futureBars: 0,
    series: [
      { key: 'bbUpper', label: 'BB上', color: '#90caf9', style: 'line' },
      { key: 'bbMiddle', label: 'BB中', color: '#90caf9', style: 'line' },
      { key: 'bbLower', label: 'BB下', color: '#90caf9', style: 'line' },
    ],
  },
  {
    id: 'atr',
    computeType: 'atr',
    categories: ['volatility'],
    scoreGroup: 'volatility',
    nameJa: 'ATR',
    shortPurpose: '真の値幅で変動の大きさを測る',
    description:
      'Average True Range（期間 14、Wilder 平滑）。高値−安値だけでなく窓も考慮した値幅です。トレンドの強さや損切り幅の目安に使います。',
    pane: 'oscillator',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { period: 14 },
    lookbackBars: 14,
    futureBars: 0,
    series: [{ key: 'atr', label: 'ATR', color: '#ffcc80', style: 'line' }],
  },
  {
    id: 'stdev',
    computeType: 'stdev',
    categories: ['volatility'],
    scoreGroup: 'volatility',
    nameJa: '標準偏差',
    shortPurpose: '終値のばらつきを測る',
    description:
      '終値のローリング標準偏差（期間 20、母集団）。ボリンジャーのバンド幅の元になる量で、大きいほど値動きが荒いです。',
    pane: 'oscillator',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { period: 20 },
    lookbackBars: 20,
    futureBars: 0,
    series: [{ key: 'stdev', label: 'StdDev', color: '#b0bec5', style: 'line' }],
  },
  {
    id: 'keltner',
    computeType: 'keltner',
    categories: ['volatility'],
    scoreGroup: 'volatility',
    nameJa: 'ケルトナーチャネル',
    shortPurpose: 'EMA と ATR で値幅の通路を描く',
    description:
      'EMA 20 を中心に ATR(10)×2 のチャネルです。ボリンジャーより滑らかで、チャネル超えはトレンド発生の手がかりになります。',
    pane: 'overlay',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 },
    lookbackBars: 20,
    futureBars: 0,
    series: [
      { key: 'keltnerUpper', label: 'KC上', color: '#aed581', style: 'line' },
      { key: 'keltnerMiddle', label: 'KC中', color: '#aed581', style: 'line' },
      { key: 'keltnerLower', label: 'KC下', color: '#aed581', style: 'line' },
    ],
  },
  {
    id: 'volume',
    computeType: null,
    categories: ['volume'],
    scoreGroup: 'volume',
    nameJa: '出来高',
    shortPurpose: '売買の量そのものを確認する',
    description:
      '各足の出来高ヒストグラムです。価格上昇時の出来高増はトレンドの信頼性、細る出来高での上昇は持続性に疑問、といった読み方をします。計算 API は使いません。',
    pane: 'volume',
    recommended: false,
    defaultEnabled: true,
    disabled: false,
    params: {},
    lookbackBars: 0,
    futureBars: 0,
    series: [],
  },
  {
    id: 'obv',
    computeType: 'obv',
    categories: ['volume'],
    scoreGroup: 'volume',
    nameJa: 'OBV',
    shortPurpose: 'トレンドの信頼性や資金流入・流出を確認する',
    description:
      'On Balance Volume。終値が上がった日は出来高を足し、下がった日は引きます。価格と OBV の方向が揃えばトレンドは信頼しやすく、乖離は転換の警告になります。',
    pane: 'oscillator',
    recommended: true,
    defaultEnabled: true,
    disabled: false,
    params: {},
    lookbackBars: 1,
    futureBars: 0,
    series: [{ key: 'obv', label: 'OBV', color: '#4db6ac', style: 'line' }],
  },
  {
    id: 'vwap',
    computeType: 'vwap',
    categories: ['volume'],
    scoreGroup: 'volume',
    nameJa: 'VWAP',
    shortPurpose: '表示期間の出来高加重平均価格',
    description:
      '表示期間の始点から Typical Price × 出来高を累積した加重平均です。機関の執行目安とされることが多く、VWAP 上は買い優勢、下は売り優勢と読まれることがあります。',
    pane: 'overlay',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: {},
    lookbackBars: 0,
    futureBars: 0,
    series: [{ key: 'vwap', label: 'VWAP', color: '#ff7043', style: 'line' }],
  },
  {
    id: 'mfi',
    computeType: 'mfi',
    categories: ['volume'],
    scoreGroup: 'volume',
    nameJa: 'MFI',
    shortPurpose: '出来高を加味した RSI',
    description:
      'Money Flow Index（期間 14）。RSI に出来高を掛けた過熱指標です。80 以上は買われすぎ、20 以下は売られすぎの目安です。',
    pane: 'oscillator',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { period: 14 },
    lookbackBars: 14,
    futureBars: 0,
    series: [{ key: 'mfi', label: 'MFI', color: '#9575cd', style: 'line' }],
  },
  {
    id: 'volumeProfile',
    computeType: 'volumeProfile',
    categories: ['volume'],
    scoreGroup: 'volume',
    nameJa: 'Volume Profile',
    shortPurpose: '価格帯ごとの出来高の厚みを見る',
    description:
      '表示期間の出来高を高値〜安値の価格ビン（24）に分配します。厚い価格帯は支持・抵抗になりやすく、薄い帯は通過しやすい、という読み方をします。',
    pane: 'volumeProfile',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: { bins: 24 },
    lookbackBars: 0,
    futureBars: 0,
    series: [],
  },
  {
    id: 'fibonacci',
    computeType: 'fibonacci',
    categories: ['cycle'],
    scoreGroup: 'cycle',
    nameJa: 'フィボナッチ',
    shortPurpose: '高値安値からの押し目・戻りの水準',
    description:
      '表示期間の最高値〜最安値に 0 / 23.6 / 38.2 / 50 / 61.8 / 78.6 / 100% と 127.2 / 161.8% の水平線を引きます。押し目買いや戻り売りの目安です。自動の波動カウントはしません。',
    pane: 'drawing',
    recommended: false,
    defaultEnabled: false,
    disabled: false,
    params: {},
    lookbackBars: 0,
    futureBars: 0,
    series: [],
  },
  {
    id: 'elliott',
    computeType: null,
    categories: ['cycle'],
    scoreGroup: null,
    nameJa: 'エリオット波動',
    shortPurpose: '推進5波・修正3波のパターン（自動認識なし）',
    description:
      '上昇は 5 波の推進、下降は 3 波の修正という経験則です。波の数え方は主観が入り、再現可能な数式に落としにくいため、本フェーズでは自動カウントしません。説明のみ表示します。',
    pane: 'none',
    recommended: false,
    defaultEnabled: false,
    disabled: true,
    params: {},
    lookbackBars: 0,
    futureBars: 0,
    series: [],
  },
];

const CATALOG_IDS: IndicatorCatalogId[] = INDICATOR_CATALOG.map((item) => item.id);

const COMPUTE_TYPES: IndicatorComputeType[] = [
  'sma',
  'ema',
  'macd',
  'ichimoku',
  'psar',
  'momentum',
  'roc',
  'rsi',
  'cci',
  'stoch',
  'willr',
  'psy',
  'bb',
  'atr',
  'stdev',
  'keltner',
  'obv',
  'vwap',
  'mfi',
  'volumeProfile',
  'fibonacci',
];

/** ID → 定義。カタログは重複 ID を持たない。 */
export const INDICATOR_CATALOG_BY_ID: Record<IndicatorCatalogId, IndicatorDefinition> =
  Object.fromEntries(INDICATOR_CATALOG.map((item) => [item.id, item])) as Record<
    IndicatorCatalogId,
    IndicatorDefinition
  >;

export function isIndicatorCatalogId(value: unknown): value is IndicatorCatalogId {
  return typeof value === 'string' && CATALOG_IDS.includes(value as IndicatorCatalogId);
}

export function isIndicatorComputeType(value: unknown): value is IndicatorComputeType {
  return typeof value === 'string' && COMPUTE_TYPES.includes(value as IndicatorComputeType);
}

export function isIndicatorCategoryId(value: unknown): value is IndicatorCategoryId {
  return INDICATOR_CATEGORIES.some((category) => category.id === value);
}

/** おすすめ構成の ID（生出来高は含めない）。 */
export function recommendedIndicatorIds(): IndicatorCatalogId[] {
  return INDICATOR_CATALOG.filter((item) => item.recommended).map((item) => item.id);
}

/** 画面初期 ON（おすすめ + 生出来高）。 */
export function defaultEnabledIndicatorIds(): IndicatorCatalogId[] {
  return INDICATOR_CATALOG.filter((item) => item.defaultEnabled).map((item) => item.id);
}

/**
 * GET `indicators` クエリをカタログ ID 配列にする。
 * 省略・空白のみはおすすめ構成。未知 ID や空トークン列はエラー理由を返す。
 */
export function parseIndicatorCatalogQuery(
  raw?: string,
): { ok: true; ids: IndicatorCatalogId[] } | { ok: false; reason: 'empty' | 'unknown' | 'disabled'; token?: string } {
  if (raw === undefined || raw.trim() === '') {
    return { ok: true, ids: recommendedIndicatorIds() };
  }

  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  const ids: IndicatorCatalogId[] = [];
  for (const part of parts) {
    if (!isIndicatorCatalogId(part)) {
      return { ok: false, reason: 'unknown', token: part };
    }
    const def = INDICATOR_CATALOG_BY_ID[part];
    if (def.disabled) {
      return { ok: false, reason: 'disabled', token: part };
    }
    if (!ids.includes(part)) {
      ids.push(part);
    }
  }
  return { ok: true, ids };
}

/** analysis に送る対象（volume / elliott を除く）。 */
export function computeCatalogIds(ids: IndicatorCatalogId[]): IndicatorCatalogId[] {
  return ids.filter((id) => INDICATOR_CATALOG_BY_ID[id].computeType !== null);
}

export function definitionsForCategory(categoryId: IndicatorCategoryId): IndicatorDefinition[] {
  return INDICATOR_CATALOG.filter((item) => item.categories.includes(categoryId));
}

/** トレンドスコアのグループ配点（合計 100）。 */
export const TREND_SCORE_GROUP_WEIGHTS: Record<IndicatorCategoryId, number> = {
  trend: 40,
  momentum: 20,
  oscillator: 10,
  volatility: 10,
  volume: 10,
  cycle: 10,
};

/** スコア対象のカタログ ID（elliott を除く）。 */
export function scoringCatalogIds(): IndicatorCatalogId[] {
  return INDICATOR_CATALOG.filter((item) => item.scoreGroup !== null).map((item) => item.id);
}
