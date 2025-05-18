const config = {
    testEnvironment: 'node',
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/out/', '<rootDir>/test-results/', '<rootDir>/coverage/', '<rootDir>/uploads/', '<rootDir>/templates/'],
    verbose: true,
    clearMocks: true,
    detectOpenHandles: true,
};

module.exports = config;