import { Test, TestingModule } from '@nestjs/testing';

import { AuthException } from '../auth.exceptions';
import { CreateTokenDto } from '../dto/create-token.dto';
import { UpdateTokenDto } from '../dto/update-token.dto';
import { TokenEntity } from '../entities/auth.entity';

import { TokensTypeMapperService } from './tokens-type-mapper.service';

class MockToken extends TokenEntity {}
class MockCreateTokenDto extends CreateTokenDto {}
class MockUpdateTokenDto extends UpdateTokenDto {}

describe('TokensTypeMapperService', () => {
	let service: TokensTypeMapperService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TokensTypeMapperService],
		}).compile();

		service = module.get<TokensTypeMapperService>(TokensTypeMapperService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerMapping', () => {
		it('should register a token type mapping', () => {
			const mockMapping = {
				type: 'mock',
				class: MockToken,
				createDto: MockCreateTokenDto,
				updateDto: MockUpdateTokenDto,
			};

			service.registerMapping(mockMapping);

			const registeredMapping = service.getMapping('mock');
			expect(registeredMapping).toEqual(mockMapping);
		});
	});

	describe('getMapping', () => {
		it('should return the correct mapping for a registered type', () => {
			const mockMapping = {
				type: 'mock',
				class: MockToken,
				createDto: MockCreateTokenDto,
				updateDto: MockUpdateTokenDto,
			};

			service.registerMapping(mockMapping);

			const result = service.getMapping('mock');
			expect(result).toEqual(mockMapping);
		});

		it('should throw a AuthException for an unregistered type', () => {
			expect(() => service.getMapping('unregistered')).toThrow(
				new AuthException('Unsupported token type: unregistered'),
			);
		});
	});
});
