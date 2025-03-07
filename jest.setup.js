require('@testing-library/jest-dom')

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock the date to ensure consistent test results
const mockDate = new Date('2024-03-19T12:00:00Z')
global.Date = class extends Date {
  constructor(date) {
    if (date) {
      return super(date)
    }
    return mockDate
  }
}

// Suppress console.error and console.warn in tests
global.console.error = jest.fn()
global.console.warn = jest.fn()

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks()
}) 