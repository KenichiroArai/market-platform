/**
 * Jest 用 lightweight-charts モック。
 * 実パッケージは ESM 主体のため、テストではここに差し替える。
 */
export const ColorType = { Solid: 'solid' };
export const CandlestickSeries = 'CandlestickSeries';
export const LineSeries = 'LineSeries';
export const HistogramSeries = 'HistogramSeries';

const mockSetData = jest.fn();
const mockRemove = jest.fn();
const mockApplyOptions = jest.fn();
const mockFitContent = jest.fn();
const mockSetHeight = jest.fn();
const mockAttachPrimitive = jest.fn();
const mockSubscribeClick = jest.fn();
const mockUnsubscribeClick = jest.fn();

export const createChart = jest.fn(() => ({
  addSeries: jest.fn(() => ({ setData: mockSetData, attachPrimitive: mockAttachPrimitive })),
  panes: jest.fn(() => [
    { setHeight: mockSetHeight },
    { setHeight: mockSetHeight },
    { setHeight: mockSetHeight },
  ]),
  timeScale: jest.fn(() => ({ fitContent: mockFitContent })),
  applyOptions: mockApplyOptions,
  remove: mockRemove,
  subscribeClick: mockSubscribeClick,
  unsubscribeClick: mockUnsubscribeClick,
}));

/** テストから呼び出し検証用に公開する内部モック */
export const __mocks = {
  mockSetData,
  mockRemove,
  mockApplyOptions,
  mockFitContent,
  mockSetHeight,
  mockAttachPrimitive,
  mockSubscribeClick,
  mockUnsubscribeClick,
};
