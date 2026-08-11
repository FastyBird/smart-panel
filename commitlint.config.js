// Enforces conventional commits on every local commit (via the husky commit-msg hook).
// Shares the same type and scope vocabulary as .github/workflows/lint-pr.yml and
// CONTRIBUTING.md — keep all three in sync when a scope is added or removed.
module.exports = {
	extends: ['@commitlint/config-conventional'],
	plugins: [
		{
			rules: {
				// Mirrors lint-pr.yml's subjectPattern: ^(?![A-Z]).+$
				// — the first character of the subject must not be uppercase.
				// Acronyms later in the subject (MCP, OAuth, API, UI, JSON, ...) are fine.
				'subject-first-char-lowercase': ({ subject }) => {
					if (!subject) return [true];

					const first = subject[0];

					return [first === first.toLowerCase(), 'subject must start with a lowercase character'];
				},
			},
		},
	],
	rules: {
		'type-enum': [
			2,
			'always',
			['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'build', 'revert'],
		],
		'scope-enum': [
			2,
			'always',
			[
				'backend',
				'admin',
				'panel',
				'website',
				'testing',
				'sdk',
				'installer',
				'spec',
				'infra',
				'ci',
				'deps',
				'docs',
				'tasks',
				'cross',
			],
		],
		'scope-empty': [2, 'never'],
		// Disable the strict all-lowercase rule (it rejects legitimate acronyms
		// like MCP, API, UI, JSON) and use the custom rule above to mirror
		// lint-pr.yml's leading-lowercase check exactly.
		'subject-case': [0],
		'subject-first-char-lowercase': [2, 'always'],
		'subject-empty': [2, 'never'],
		'subject-full-stop': [2, 'never', '.'],
	},
};
