import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ParentDto {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"parent.type","reason":"Parent type is required."}]' })
	@IsString({ message: '[{"field":"parent.type","reason":"Parent type must be a string."}]' })
	type: string;

	@Expose()
	@IsUUID('4', { message: '[{"field":"parent.id","reason":"Parent ID must be a valid UUID (version 4)."}]' })
	id: string;
}
