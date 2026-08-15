export class HomeSearchInvalidQueryError extends Error {
	readonly code = 'invalid_query';

	constructor(
		readonly reason: 'no_search_tokens' | 'too_many_tokens',
		readonly maxTokens?: number,
	) {
		super(
			reason === 'too_many_tokens' && maxTokens !== undefined
				? `Home search query may contain at most ${maxTokens} tokens`
				: 'Home search query must contain at least one searchable token',
		);
		this.name = 'HomeSearchInvalidQueryError';
	}
}
