export interface SqliteFtsNameRankOptions {
	ftsTable: string;
	vocabularyTable: string;
	entityIdExpression: string;
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
	const exactTerms = tokens
		.map(
			(_token, offset) =>
				`EXISTS (SELECT 1 FROM ${options.vocabularyTable} exact_term ` +
				`WHERE exact_term.doc = ${options.ftsTable}.rowid AND exact_term.col = 'name' ` +
				`AND exact_term.offset = ${offset} AND exact_term.term = ?)`,
		)
		.join(' AND ');
	const prefixTerms = tokens
		.map((_token, offset) => {
			const comparison = offset === tokens.length - 1 ? `prefix_term.term LIKE ? ESCAPE '\\'` : 'prefix_term.term = ?';

			return (
				`EXISTS (SELECT 1 FROM ${options.vocabularyTable} prefix_term ` +
				`WHERE prefix_term.doc = ${options.ftsTable}.rowid AND prefix_term.col = 'name' ` +
				`AND prefix_term.offset = ${offset} AND ${comparison})`
			);
		})
		.join(' AND ');
	const exactNamePredicate =
		tokens.length === 0
			? '0'
			: `(SELECT COUNT(*) FROM ${options.vocabularyTable} exact_count ` +
				`WHERE exact_count.doc = ${options.ftsTable}.rowid AND exact_count.col = 'name') = ? AND ${exactTerms}`;
	const prefixNamePredicate =
		tokens.length === 0
			? '0'
			: `(SELECT COUNT(*) FROM ${options.vocabularyTable} prefix_count ` +
				`WHERE prefix_count.doc = ${options.ftsTable}.rowid AND prefix_count.col = 'name') >= ? AND ${prefixTerms}`;
	const escapedPrefix = tokens.length === 0 ? null : `${escapeSqlLike(tokens[tokens.length - 1])}%`;

	return {
		sql: `CASE
		WHEN ${options.entityIdExpression} = ? COLLATE NOCASE THEN 0
		WHEN ${exactNamePredicate} THEN 1
		WHEN ${prefixNamePredicate} THEN 2
		ELSE 3
	END`,
		parameters: [
			options.rawQuery?.trim() ?? null,
			...(tokens.length > 0 ? [tokens.length, ...tokens] : []),
			...(tokens.length > 0 ? [tokens.length, ...tokens.slice(0, -1), escapedPrefix] : []),
		],
	};
}

function escapeSqlLike(value: string): string {
	return value.replace(/[\\%_]/g, '\\$&');
}
