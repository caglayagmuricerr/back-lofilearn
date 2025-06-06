const config = {
    testEnvironment: 'node',
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/out/', '<rootDir>/test-results/', '<rootDir>/coverage/', '<rootDir>/uploads/', '<rootDir>/templates/'],
    verbose: true,
    clearMocks: true,
    detectOpenHandles: true,
    testTimeout: 20000, // 20 seconds
};

module.exports = config;