import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { MDNS_DEFAULT_SERVICE_NAME, MDNS_DEFAULT_SERVICE_TYPE, MDNS_MODULE_NAME } from '../mdns.constants';

@ApiSchema({ name: 'ConfigModuleDataMdns' })
export class MdnsConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'mdns',
	})
	@Expose()
	@IsString()
	type: string = MDNS_MODULE_NAME;

	@ApiProperty({
		name: 'service_name',
		description: 'mDNS service name to advertise',
		type: 'string',
		example: 'FastyBird Smart Panel',
	})
	@Expose({ name: 'service_name' })
	@IsString()
	serviceName: string = MDNS_DEFAULT_SERVICE_NAME;

	@ApiProperty({
		name: 'service_type',
		description: 'mDNS service type identifier',
		type: 'string',
		example: 'fastybird-panel',
	})
	@Expose({ name: 'service_type' })
	@IsString()
	serviceType: string = MDNS_DEFAULT_SERVICE_TYPE;
}
