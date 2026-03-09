export default {
	moduleFileExtensions: ['js', 'json', 'ts'],
	rootDir: 'src',
	testRegex: '.*\\.spec\\.ts$',
	transform: {
		'^.+\\.(t|j)s$': [
			'ts-jest',
			{
				tsconfig: {
					allowJs: true,
				},
			},
		],
	},
	collectCoverageFrom: ['**/*.(t|j)s'],
	coverageDirectory: '../coverage',
	testEnvironment: 'node',
	testEnvironmentOptions: {
		globalsCleanup: 'off',
	},
	transformIgnorePatterns: ['node_modules/(?!(.pnpm|uuid)/)'],
	moduleNameMapper: {
		'^inquirer$': '<rootDir>/../test/__mocks__/inquirer.ts',
	},
	setupFilesAfterEnv: ['<rootDir>/../test/jest.setup.ts'],
};
