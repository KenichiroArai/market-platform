/** Jest 用 next/navigation モック。 */
export const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
}));

const emptySearchParams = new URLSearchParams();

/** クエリ未指定時は空。各テストで mockReturnValue を差し替え可能。 */
export const useSearchParams = jest.fn(() => emptySearchParams);
