import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import type { components } from '../../../openapi';

type ReqRefreshToken = components['schemas']['AuthModuleReqRefreshToken'];
type RefreshToken = components['schemas']['AuthModuleRefreshToken'];

@ApiSchema('AuthModuleRefreshToken')
export class RefreshTokenDto implements RefreshToken {
	@ApiProperty({
		description: 'JWT refresh access token',
		type: 'string',
		example:
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDMyfQ.ysGR_iIUp1O2wrUaKzIlr0eKufYUhdNFV156bA_FoFw',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	token: string;
}

@ApiSchema('AuthModuleReqRefreshToken')
export class ReqRefreshDto implements ReqRefreshToken {
	@ApiProperty({
		description: 'Refresh token data',
		type: () => RefreshTokenDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => RefreshTokenDto)
	data: RefreshTokenDto;
}
