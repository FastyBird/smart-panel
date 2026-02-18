# Smart Panel Extensions

This document describes the extensions system in Smart Panel, including how extensions work, how to develop new ones, and how to integrate them into the system.

## Overview

Smart Panel uses an extensions architecture to provide modularity and extensibility. Extensions come in two types:

- **Modules** - Core functionality units (devices, dashboard, users, etc.)
- **Plugins** - Add-on functionality that extends modules (device integrations, data sources, etc.)

## Extension Categories

| Category | Can Disable? | Can Remove? | Examples |
|----------|--------------|-------------|----------|
| Core Module | No | No | devices-module, dashboard-module, users-module |
| Core Plugin | Yes | No | weather-openweathermap-plugin, devices-shelly-ng-plugin |
| Third-Party Module | Yes | Yes (future) | Custom modules installed via npm |
| Third-Party Plugin | Yes | Yes (future) | Custom plugins installed via npm |

## Architecture

### Backend Structure

Extensions are located in:
- `apps/backend/src/modules/` - Core modules
- `apps/backend/src/plugins/` - Core plugins
- `packages/` - Third-party/external extensions

Each extension typically contains:
```
my-extension/
├── controllers/       # REST API endpoints
├── dto/              # Data Transfer Objects
├── entities/         # Database entities (TypeORM)
├── models/           # Response models
├── services/         # Business logic
├── my-extension.module.ts    # NestJS module definition
├── my-extension.constants.ts # Constants and enums
└── my-extension.openapi.ts   # Swagger extra models
```

### Admin Structure

Admin extensions mirror the backend structure:
```
apps/admin/src/modules/my-module/
├── components/       # Vue components
├── composables/      # Vue composables (hooks)
├── locales/          # i18n translations
├── router/           # Vue Router configuration
├── store/            # Pinia stores
├── views/            # Page components
└── index.ts          # Module exports
```

## Developing a New Extension

### 1. Create the Backend Module/Plugin

#### For a Module

```typescript
// my-module.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';

import { MY_MODULE_NAME } from './my-module.constants';
import { MyModuleConfigModel } from './models/config.model';
import { UpdateMyModuleConfigDto } from './dto/update-config.dto';

@Module({
  imports: [
    forwardRef(() => ConfigModule),
    forwardRef(() => ExtensionsModule),
  ],
  // ... providers, controllers, exports
})
export class MyModule implements OnModuleInit {
  constructor(
    private readonly modulesMapperService: ModulesTypeMapperService,
    private readonly extensionsService: ExtensionsService,
  ) {}

  onModuleInit() {
    // Register with config mapper (required for extensions list)
    this.modulesMapperService.registerMapping<MyModuleConfigModel, UpdateMyModuleConfigDto>({
      type: MY_MODULE_NAME,
      class: MyModuleConfigModel,
      configDto: UpdateMyModuleConfigDto,
    });

    // Register metadata (for display in admin)
    this.extensionsService.registerModuleMetadata({
      type: MY_MODULE_NAME,
      name: 'My Module',
      description: 'Description of what this module does',
      author: 'Your Name',
      readme: `# My Module\n\nDocumentation here...`,
      links: {
        documentation: 'https://docs.example.com',
        repository: 'https://github.com/example/my-module',
      },
    });
  }
}
```

#### For a Plugin

```typescript
// my-plugin.plugin.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';

import { MY_PLUGIN_NAME } from './my-plugin.constants';
import { MyPluginConfigModel } from './models/config.model';
import { UpdateMyPluginConfigDto } from './dto/update-config.dto';

@Module({
  imports: [
    forwardRef(() => ConfigModule),
    forwardRef(() => ExtensionsModule),
  ],
  // ... providers, exports
})
export class MyPlugin implements OnModuleInit {
  constructor(
    private readonly pluginsMapperService: PluginsTypeMapperService,
    private readonly extensionsService: ExtensionsService,
  ) {}

  onModuleInit() {
    // Register with config mapper
    this.pluginsMapperService.registerMapping<MyPluginConfigModel, UpdateMyPluginConfigDto>({
      type: MY_PLUGIN_NAME,
      class: MyPluginConfigModel,
      configDto: UpdateMyPluginConfigDto,
    });

    // Register metadata
    this.extensionsService.registerPluginMetadata({
      type: MY_PLUGIN_NAME,
      name: 'My Plugin',
      description: 'Description of what this plugin does',
      author: 'Your Name',
      readme: `# My Plugin\n\nDocumentation here...`,
      links: {
        documentation: 'https://docs.example.com',
        repository: 'https://github.com/example/my-plugin',
      },
    });
  }
}
```

### 2. Create Config Model and DTO

Every extension needs a config model and update DTO:

```typescript
// models/config.model.ts
import { ApiSchema } from '@nestjs/swagger';
import { ModuleConfigModel } from '../../config/models/config.model';
// or for plugins:
// import { PluginConfigModel } from '../../config/models/config.model';

@ApiSchema({ name: 'MyModuleDataConfig' })
export class MyModuleConfigModel extends ModuleConfigModel {
  // Add module-specific config properties here
}
```

```typescript
// dto/update-config.dto.ts
import { ApiSchema } from '@nestjs/swagger';
import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
// or for plugins:
// import { UpdatePluginConfigDto } from '../../config/dto/config.dto';

@ApiSchema({ name: 'MyModuleUpdateConfig' })
export class UpdateMyModuleConfigDto extends UpdateModuleConfigDto {
  // Add module-specific update properties here
}
```

### 3. Register in AppModule

Add your extension to the imports in `app.module.ts`:

```typescript
@Module({
  imports: [
    // ... other modules
    MyModule,
    // or for plugins:
    MyPlugin,
  ],
})
export class AppModule {}
```

### 4. Create Admin Extension (Optional)

If your extension has a UI, create the admin module:

```typescript
// apps/admin/src/modules/my-module/index.ts
import type { App } from 'vue';
import type { Router } from 'vue-router';

import { registerRoutes } from './router';
import { registerStore } from './store';

export function register(app: App, router: Router): void {
  registerStore(app);
  registerRoutes(router);
}

export * from './my-module.constants';
```

## Extension Metadata

Extensions can register rich metadata for display in the admin UI:

```typescript
interface ExtensionMetadata {
  type: string;           // Unique identifier (e.g., 'my-module')
  name: string;           // Display name
  description?: string;   // Short description
  version?: string;       // Semantic version
  author?: string;        // Author name
  readme?: string;        // Full markdown documentation
  docs?: string;          // Additional documentation (markdown)
  links?: {
    documentation?: string;    // Docs URL
    devDocumentation?: string; // Developer docs URL
    bugsTracking?: string;     // Issue tracker URL
    repository?: string;       // Source code URL
    homepage?: string;         // Project homepage
  };
}
```

## Third-Party Extensions

### Creating a Standalone Package

For extensions distributed via npm, create a package in `packages/`:

```
packages/my-extension/
├── src/
│   ├── index.ts              # Main exports
│   ├── my-extension.plugin.ts
│   ├── dto/
│   ├── models/
│   └── services/
├── package.json
├── tsconfig.json
└── README.md
```

Your `package.json` should include:
```json
{
  "name": "@fastybird/smart-panel-my-extension",
  "peerDependencies": {
    "@fastybird/smart-panel-backend": "^1.0.0"
  }
}
```

Import from the backend's public API:
```typescript
import {
  ExtensionsModule,
  ExtensionsService,
  ConfigModule,
  PluginsTypeMapperService,
  PluginConfigModel,
  UpdatePluginConfigDto,
} from '@fastybird/smart-panel-backend';
```

### Installing Third-Party Extensions

```bash
pnpm add @vendor/smart-panel-extension
```

Then register in `app.module.ts`:
```typescript
import { MyExtension } from '@vendor/smart-panel-extension';

@Module({
  imports: [
    // ... core modules
    MyExtension,
  ],
})
export class AppModule {}
```

## Core Modules Protection

Core modules listed in `NON_TOGGLEABLE_MODULES` cannot be disabled:

- auth-module
- config-module
- dashboard-module
- devices-module
- displays-module
- extensions-module
- mdns-module
- system-module
- users-module
- weather-module

These are essential for the application to function and are always enabled.

## Best Practices

1. **Naming Convention**: Use `{name}-module` for modules and `{name}-plugin` for plugins
2. **Always Register Metadata**: Register with both the mapper service and extensions service
3. **Use forwardRef**: When importing ConfigModule or ExtensionsModule to avoid circular dependencies
4. **Provide Documentation**: Include a meaningful README in your metadata
5. **Follow API Conventions**: See `.ai-rules/API_CONVENTIONS.md` for REST API guidelines
6. **Add Tests**: Include unit tests for services and controllers
7. **Regenerate OpenAPI**: Run `pnpm run generate:openapi` after adding new endpoints

## API Endpoints

Extensions are accessible via:

- `GET /api/modules/extensions/extensions` - List all extensions
- `GET /api/modules/extensions/extensions/modules` - List modules only
- `GET /api/modules/extensions/extensions/plugins` - List plugins only
- `GET /api/modules/extensions/extensions/{type}` - Get specific extension
- `PATCH /api/modules/extensions/extensions/{type}` - Update extension (enable/disable)

## See Also

- [API Conventions](../.ai-rules/API_CONVENTIONS.md)
- [Development Guidelines](../.ai-rules/GUIDELINES.md)
- [Example Extension](../packages/example-extension/)
