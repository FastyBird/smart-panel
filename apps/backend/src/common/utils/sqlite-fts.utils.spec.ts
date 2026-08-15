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
		expect(result.sql).toContain("exact_term.col = 'name'");
		expect(result.sql).toContain('exact_term.offset = 1 AND exact_term.term = ?');
		expect(result.sql).toContain('prefix_term.offset = 1 AND prefix_term.term LIKE ?');
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
});
