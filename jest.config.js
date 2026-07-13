/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@models/(.*)$": "<rootDir>/src/models/$1",
    "^@context/(.*)$": "<rootDir>/src/context/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
};
