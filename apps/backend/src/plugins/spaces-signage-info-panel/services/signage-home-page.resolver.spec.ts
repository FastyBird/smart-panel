import { Test, TestingModule } from '@nestjs/testing';

import { SignageHomePageResolver } from './signage-home-page.resolver';

describe('SignageHomePageResolver', () => {
	let module: TestingModule | undefined;
	let resolver: SignageHomePageResolver;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [SignageHomePageResolver],
		}).compile();

		resolver = module.get(SignageHomePageResolver);
	});

	it('always resolves to null', () => {
		expect(resolver.resolve()).toBeNull();
	});

	afterEach(async () => {
		const moduleToClose = module;
		module = undefined;
		await moduleToClose?.close();
	});
});
