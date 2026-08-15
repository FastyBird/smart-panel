import { buildSqliteFtsNameRankExpression } from './sqlite-fts.utils';

describe('buildSqliteFtsNameRankExpression', () => {
	it('builds bound exact-token and prefix-token rank predicates', () => {
		const result = buildSqliteFtsNameRankExpression({
			ftsTable: 'search_fts',
			vocabularyTable: 'search_vocab',
			entityIdExpression: 'entity.id',
			rawQuery: ' Kitchen Light ',
			normalizedTokens: ['kitchen', 'light'],
		});

		expect(result.sql).toContain('WHEN entity.id = ? COLLATE NOCASE THEN 0');
		expect(result.sql).toContain("exact_term_name.col = 'name'");
		expect(result.sql).toContain('exact_term_name.offset = 1 AND exact_term_name.term = ?');
		expect(result.sql).toContain('prefix_term_name.offset = 1 AND prefix_term_name.term LIKE ?');
		expect(result.parameters).toEqual(['Kitchen Light', 2, 'kitchen', 'light', 2, 'kitchen', 'light%']);
	});

	it('escapes LIKE metacharacters in a defensive direct-domain prefix', () => {
		const result = buildSqliteFtsNameRankExpression({
			ftsTable: 'search_fts',
			vocabularyTable: 'search_vocab',
			entityIdExpression: 'entity.id',
			normalizedQuery: 'light_%',
		});

		expect(result.parameters).toEqual([null, 1, 'light_%', 1, 'light\\_\\%%']);
	});

	it('ranks a fallback column as the display name only when the primary name is missing', () => {
		const result = buildSqliteFtsNameRankExpression({
			ftsTable: 'search_fts',
			vocabularyTable: 'search_vocab',
			entityIdExpression: 'property.id',
			fallbackName: {
				vocabularyColumn: 'identifier',
				whenPrimaryNameExpression: 'property.name',
			},
			rawQuery: 'target-identifier',
			normalizedTokens: ['target', 'identifier'],
		});

		expect(result.sql).toContain('property.name IS NULL');
		expect(result.sql).toContain("exact_term_fallback.col = 'identifier'");
		expect(result.sql).toContain("prefix_term_fallback.col = 'identifier'");
		expect(result.parameters).toEqual([
			'target-identifier',
			2,
			'target',
			'identifier',
			2,
			'target',
			'identifier',
			2,
			'target',
			'identifier%',
			2,
			'target',
			'identifier%',
		]);
	});
});
