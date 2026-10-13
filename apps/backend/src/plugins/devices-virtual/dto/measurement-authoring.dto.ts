import { Expose, Type } from 'class-transformer';
import { IsDefined, IsNumber, IsOptional, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateVirtualDeviceDto } from './create-device.dto';
import { ConfigureVirtualAggregateDto } from './producer-config.dto';
import { ConfigureVirtualTransformDto } from './transform-config.dto';

@ApiSchema({ name: 'DevicesVirtualPluginPreviewTransform' })
export class PreviewVirtualTransformDto extends ConfigureVirtualTransformDto {
	@ApiPropertyOptional({
		name: 'preview_input',
		description: 'Hypothetical input in the declared source unit; never a live sample',
	})
	@Expose({ name: 'preview_input' })
	@IsOptional()
	@IsNumber({ allowInfinity: false, allowNaN: false })
	previewInput?: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginCreateAggregateProducer' })
export class CreateVirtualAggregateProducerDto {
	@ApiProperty({
		description: 'Proposed virtual sensor device with explicit nested output UUID',
		type: CreateVirtualDeviceDto,
	})
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => CreateVirtualDeviceDto)
	device: CreateVirtualDeviceDto;

	@ApiProperty({
		name: 'output_property',
		description: 'Readonly derived property UUID within the proposed device',
		format: 'uuid',
	})
	@Expose({ name: 'output_property' })
	@IsUUID('4')
	outputPropertyId: string;

	@ApiProperty({ description: 'Versioned aggregate configuration', type: ConfigureVirtualAggregateDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ConfigureVirtualAggregateDto)
	configuration: ConfigureVirtualAggregateDto;
}

@ApiSchema({ name: 'DevicesVirtualPluginCreateTransformProducer' })
export class CreateVirtualTransformProducerDto {
	@ApiProperty({
		description: 'Proposed virtual sensor device with explicit nested output UUID',
		type: CreateVirtualDeviceDto,
	})
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => CreateVirtualDeviceDto)
	device: CreateVirtualDeviceDto;

	@ApiProperty({
		name: 'output_property',
		description: 'Readonly derived property UUID within the proposed device',
		format: 'uuid',
	})
	@Expose({ name: 'output_property' })
	@IsUUID('4')
	outputPropertyId: string;

	@ApiProperty({ description: 'Versioned transform configuration', type: ConfigureVirtualTransformDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ConfigureVirtualTransformDto)
	configuration: ConfigureVirtualTransformDto;
}

@ApiSchema({ name: 'DevicesVirtualPluginPreviewTransformProducer' })
export class PreviewVirtualTransformProducerDto extends CreateVirtualTransformProducerDto {
	@ApiPropertyOptional({
		name: 'preview_input',
		description: 'Hypothetical conversion input; never stored or qualified',
	})
	@Expose({ name: 'preview_input' })
	@IsOptional()
	@IsNumber({ allowInfinity: false, allowNaN: false })
	previewInput?: number;
}
