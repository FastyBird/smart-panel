import { Injectable } from '@nestjs/common';

import { AuthException } from '../auth.exceptions';
import { CreateTokenDto } from '../dto/create-token.dto';
import { UpdateTokenDto } from '../dto/update-token.dto';
import { TokenEntity } from '../entities/auth.entity';

export interface TokenTypeMapping<
	TToken extends TokenEntity,
	TCreateDTO extends CreateTokenDto,
	TUpdateDTO extends UpdateTokenDto,
> {
	type: string; // e.g., 'access', 'refresh'
	class: new (...args: any[]) => TToken; // Constructor for the token class
	createDto: new (...args: any[]) => TCreateDTO; // Constructor for the Create DTO
	updateDto: new (...args: any[]) => TUpdateDTO; // Constructor for the Update DTO
}

@Injectable()
export class TokensTypeMapperService {
	private readonly mappings = new Map<string, TokenTypeMapping<any, any, any>>();

	registerMapping<TToken extends TokenEntity, TCreateDTO extends CreateTokenDto, TUpdateDTO extends UpdateTokenDto>(
		mapping: TokenTypeMapping<TToken, TCreateDTO, TUpdateDTO>,
	): void {
		this.mappings.set(mapping.type, mapping);
	}

	getMapping<TToken extends TokenEntity, TCreateDTO extends CreateTokenDto, TUpdateDTO extends UpdateTokenDto>(
		type: string,
	): TokenTypeMapping<TToken, TCreateDTO, TUpdateDTO> {
		const mapping = this.mappings.get(type);

		if (!mapping) {
			throw new AuthException(`Unsupported token type: ${type}`);
		}

		return mapping as TokenTypeMapping<TToken, TCreateDTO, TUpdateDTO>;
	}
}
