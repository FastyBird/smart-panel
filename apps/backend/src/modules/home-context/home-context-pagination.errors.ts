export class HomeContextInvalidCursorError extends Error {
	readonly code = 'invalid_cursor';

	constructor(readonly cursor: string) {
		super(`Home context space cursor ${cursor} is invalid`);
		this.name = HomeContextInvalidCursorError.name;
	}
}
