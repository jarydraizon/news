module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**/*.js',
    '!**/node_modules/**'
  ],
  verbose: true,
  testTimeout: 30000,
  // Add this line to use the setup file
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js']
};