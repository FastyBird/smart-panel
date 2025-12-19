import { ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from './config.dto';

@ApiSchema({ name: 'ConfigModuleUpdateConfigModule' })
export class UpdateConfigModuleConfigDto extends UpdateModuleConfigDto {}
