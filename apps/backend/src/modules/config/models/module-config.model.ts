import { ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from './config.model';

@ApiSchema({ name: 'ConfigModuleDataConfigModule' })
export class ConfigModuleConfigModel extends ModuleConfigModel {}
