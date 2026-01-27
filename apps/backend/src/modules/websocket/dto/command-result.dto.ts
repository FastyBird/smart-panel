import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

export class HandlerResultDto {
	@Expose()
	@IsString()
	handler: string;

	@Expose()
	@IsBoolean()
	success: boolean;

	@Expose()
	@IsOptional()
	@IsString()
	@ValidateIf((o: { success: boolean }) => !o.success)
	reason?: string;

	@Expose()
	@IsOptional()
	data?: Record<string, unknown>;
}

export class CommandResultDto {
	@Expose()
	@IsString()
	@IsIn(['ok', 'error'])
	status: 'ok' | 'error';

	@Expose()
	@IsString()
	message: string;

	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HandlerResultDto)
	results?: HandlerResultDto[];
}
