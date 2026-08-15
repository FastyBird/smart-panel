export interface SqliteFtsNameRankOptions {
	ftsTable: string;
	vocabularyTable: string;
	entityIdExpression: string;
	fallbackVocabularyColumn?: 'identifier';
	rawQuery?: string;
	normalizedQuery?: string;
	normalizedTokens?: string[];
}

export interface SqliteFtsNameRankExpression {
	sql: string;
	parameters: Array<string | number | null>;
}

export function buildSqliteFtsNameRankExpression(options: SqliteFtsNameRankOptions): SqliteFtsNameRankExpression {
	const tokens = options.normalizedTokens ?? options.normalizedQuery?.split(' ').filter(Boolean) ?? [];
	const escapedPrefix = tokens.length === 0 ? null : `${escapeSqlLike(tokens[tokens.length - 1])}%`;
	const buildColumnPredicate = (column: string, prefix: boolean, aliasSuffix: string) => {
		const countAlias = `${prefix ? 'prefix' : 'exact'}_count_${aliasSuffix}`;
		const termAlias = `${prefix ? 'prefix' : 'exact'}_term_${aliasSuffix}`;
		const terms = tokens
			.map((_token, offset) => {
				const comparison =
					prefix && offset === tokens.length - 1 ? `${termAlias}.term LIKE ? ESCAPE '\\'` : `${termAlias}.term = ?`;

				return (
					`EXISTS (SELECT 1 FROM ${options.vocabularyTable} ${termAlias} ` +
					`WHERE ${termAlias}.doc = ${options.ftsTable}.rowid AND ${termAlias}.col = '${column}' ` +
					`AND ${termAlias}.offset = ${offset} AND ${comparison})`
				);
			})
			.join(' AND ');

		return {
			sql:
				`(SELECT COUNT(*) FROM ${options.vocabularyTable} ${countAlias} ` +
				`WHERE ${countAlias}.doc = ${options.ftsTable}.rowid AND ${countAlias}.col = '${column}') ` +
				`${prefix ? '>=' : '='} ? AND ${terms}`,
			parameters: [tokens.length, ...tokens.slice(0, -1), prefix ? escapedPrefix : tokens[tokens.length - 1]],
		};
	};
	const primaryExact = tokens.length > 0 ? buildColumnPredicate('name', false, 'name') : null;
	const primaryPrefix = tokens.length > 0 ? buildColumnPredicate('name', true, 'name') : null;
	const fallbackExact =
		tokens.length > 0 && options.fallbackVocabularyColumn
			? buildColumnPredicate(options.fallbackVocabularyColumn, false, 'fallback')
			: null;
	const fallbackPrefix =
		tokens.length > 0 && options.fallbackVocabularyColumn
			? buildColumnPredicate(options.fallbackVocabularyColumn, true, 'fallback')
			: null;
	const primaryNameMissing =
		`NOT EXISTS (SELECT 1 FROM ${options.vocabularyTable} primary_name_term ` +
		`WHERE primary_name_term.doc = ${options.ftsTable}.rowid AND primary_name_term.col = 'name')`;
	const exactNamePredicate = primaryExact
		? fallbackExact
			? `(${primaryExact.sql} OR (${primaryNameMissing} AND ${fallbackExact.sql}))`
			: primaryExact.sql
		: '0';
	const prefixNamePredicate = primaryPrefix
		? fallbackPrefix
			? `(${primaryPrefix.sql} OR (${primaryNameMissing} AND ${fallbackPrefix.sql}))`
			: primaryPrefix.sql
		: '0';

	return {
		sql: `CASE
		WHEN ${options.entityIdExpression} = ? COLLATE NOCASE THEN 0
		WHEN ${exactNamePredicate} THEN 1
		WHEN ${prefixNamePredicate} THEN 2
		ELSE 3
	END`,
		parameters: [
			options.rawQuery?.trim() ?? null,
			...(primaryExact?.parameters ?? []),
			...(fallbackExact?.parameters ?? []),
			...(primaryPrefix?.parameters ?? []),
			...(fallbackPrefix?.parameters ?? []),
		],
	};
}

function escapeSqlLike(value: string): string {
	return value.replace(/[\\%_]/g, '\\$&');
}
