import { Expose, Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'PagesCardsPluginUpdateCard' })
export class UpdateCardDto {
	@ApiPropertyOptional({
		description: 'Card title',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	title?: string;

	@ApiPropertyOptional({
		description: 'Card icon name',
		type: 'string',
		nullable: true,
		example: 'mdi-home',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({
		description: 'Card order position',
		type: 'integer',
		example: 1,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"order","reason":"Order must be a positive number."}]' },
	)
	order?: number;

	@ApiPropertyOptional({
		description: 'Number of rows',
		type: 'integer',
		nullable: true,
		example: 4,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"rows","reason":"Rows must be an integer."}]' })
	@Min(1, { message: '[{"field":"rows","reason":"Rows must be at least 1."}]' })
	@ValidateIf((_, value) => value !== null)
	rows?: number | null;

	@ApiPropertyOptional({
		description: 'Number of columns',
		type: 'integer',
		nullable: true,
		example: 6,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"cols","reason":"Cols must be an integer."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Cols must be at least 1."}]' })
	@ValidateIf((_, value) => value !== null)
	cols?: number | null;
}

@ApiSchema({ name: 'PagesCardsPluginReqUpdateCard' })
export class ReqUpdateCardDto {
	@ApiProperty({
		description: 'Card update data',
		type: UpdateCardDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateCardDto)
	data: UpdateCardDto;
}
