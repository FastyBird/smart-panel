import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"token","reason":"Token must be a non-empty string."}]' })
	token: string;
}
