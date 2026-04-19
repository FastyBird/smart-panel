import { Test, TestingModule } from '@nestjs/testing';

import { SignageHomePageResolver } from './signage-home-page.resolver';

describe('SignageHomePageResolver', () => {
	let resolver: SignageHomePageResolver;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [SignageHomePageResolver],
		}).compile();

		resolver = module.get(SignageHomePageResolver);
	});

	it('always resolves to null', () => {
		expect(resolver.resolve()).toBeNull();
	});
});
