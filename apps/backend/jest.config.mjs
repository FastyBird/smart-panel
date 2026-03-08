export default {
	moduleFileExtensions: ['js', 'json', 'ts'],
	rootDir: 'src',
	testRegex: '.*\\.spec\\.ts$',
	transform: {
		'^.+\\.(t|j)s$': 'ts-jest',
	},
	collectCoverageFrom: ['**/*.(t|j)s'],
	coverageDirectory: '../coverage',
	testEnvironment: 'node',
	moduleNameMapper: {
		'^inquirer$': '<rootDir>/../test/__mocks__/inquirer.ts',
	},
	setupFilesAfterEnv: ['<rootDir>/../test/jest.setup.ts'],
};
