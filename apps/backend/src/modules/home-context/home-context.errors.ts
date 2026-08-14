export class HomeContextSpaceNotFoundError extends Error {
	readonly code = 'space_not_found';

	constructor(readonly spaceId: string) {
		super(`Home context space ${spaceId} does not exist`);
		this.name = HomeContextSpaceNotFoundError.name;
	}
}
