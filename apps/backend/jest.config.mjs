export default {
	moduleFileExtensions: ['js', 'json', 'ts'],
	rootDir: 'src',
	testRegex: '.*\\.spec\\.ts$',
	reporters: ['default', '<rootDir>/../test/reporters/failure-details.reporter.js'],
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
	// A worker keeps what every suite it ran has loaded. Without a limit the heap of one worker grows past
	// Node's default limit of about 4 GB over a full run and the worker crashes; with it, a worker that has
	// grown this large is replaced by a fresh one between two suites.
	workerIdleMemoryLimit: '2GB',
	testEnvironmentOptions: {
		globalsCleanup: 'off',
	},
	transformIgnorePatterns: ['node_modules/(?!(.pnpm|uuid)/)'],
	moduleNameMapper: {
		'^inquirer$': '<rootDir>/../test/__mocks__/inquirer.ts',
	},
	setupFilesAfterEnv: ['<rootDir>/../test/jest.setup.ts'],
};
