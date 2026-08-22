/** Jest 用 next/navigation モック。 */
export const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
}));
