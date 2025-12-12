# Task: Multi-Location Weather Support with Provider Plugins

ID: FEATURE-MULTI-LOCATION-WEATHER
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: in-progress

## Implementation Progress

### Completed
- [x] Phase 1: Backend - Weather Module Foundation (100%)
- [x] Phase 2: Backend - OpenWeatherMap Plugin (100%)
- [x] Phase 3: Backend - Multi-Location Weather Service (100%)

### In Progress
- [ ] Phase 4: Admin - Location Management (0%)
- [ ] Phase 5: Panel (Flutter) - Multi-Location Support (0%)

## 1. Business goal

In order to view weather information for multiple locations (home, work, family)
As a smart panel user
I want to configure and display weather data for several locations simultaneously

## 2. Context

### Current State
- Weather module supports only **one location** stored in module configuration
- OpenWeatherMap is **hardcoded** as the only weather provider
- Location configuration includes: `locationType`, `latitude`, `longitude`, `cityName`, `cityId`, `zipCode`
- Weather data is cached in memory with 1-hour TTL using `cache-manager`
- Module configuration contains both location data AND provider settings (API key, units)

### Reference Implementations
- **Plugin System**: See `apps/backend/src/plugins/devices-shelly-ng/` for plugin architecture
- **Entity Inheritance**: See `DeviceEntity` → `ShellyNgDeviceEntity` pattern
- **Type Mappers**: See `DevicesTypeMapperService` for runtime type-to-class mapping
- **Discriminator Registry**: See `ExtendedDiscriminatorService` for OpenAPI polymorphism

### Design Decision: Provider-Specific Location Entities
Following the device plugin pattern, **query types are provider-specific**:
- Base `WeatherLocationEntity` has common fields (`id`, `name`, `type`, timestamps)
- Each weather provider plugin extends the location entity with its own query fields
- When adding a location, user first selects provider, then provider-specific fields appear
- This allows different providers to support different location query methods

### Constraints
- **Breaking changes allowed** - no migrations, aliases, or legacy code needed
- **Clean code priority** - prefer simplicity over backward compatibility
- Follow existing NestJS module and plugin patterns
- Follow `.ai-rules/GUIDELINES.md` and `.ai-rules/API_CONVENTIONS.md`

## 3. Scope

**In scope**

- Base `WeatherLocationEntity` with single-table inheritance
- Location CRUD API endpoints (list, get, create, update, delete)
- Weather provider abstraction via plugin architecture
- `LocationsTypeMapperService` for runtime type mapping
- Extract OpenWeatherMap to `weather-openweathermap` plugin
- OpenWeatherMap location entity with provider-specific query fields
- Multi-location weather data fetching with per-location caching
- Primary location selection in module configuration
- Admin UI for location management (provider selection → dynamic fields)
- Panel support for displaying weather from multiple locations

**Out of scope**

- Additional weather providers (WeatherAPI, DarkSky) - future plugins
- Historical weather data storage in InfluxDB
- Location-based automation rules
- Weather alerts/notifications
- Geofencing or automatic location detection

## 4. Acceptance criteria

### Backend - Base Location Entity
- [x] `WeatherLocationEntity` with `@TableInheritance` on `type` column
- [x] Common fields: `id`, `name`, `type` (discriminator), `createdAt`, `updatedAt`
- [x] Entity stored in `weather_module_locations` table

### Backend - Location Type Mapper
- [x] `LocationsTypeMapperService` manages type-to-class mappings
- [x] Interface: `registerMapping()`, `getMapping()`, `listTypes()`
- [x] Exported from weather module for plugin use

### Backend - Location API
- [x] `GET /weather-module/locations` - list all locations
- [x] `GET /weather-module/locations/:id` - get single location
- [x] `POST /weather-module/locations` - create location (type determines entity)
- [x] `PATCH /weather-module/locations/:id` - update location
- [x] `DELETE /weather-module/locations/:id` - delete location
- [x] OpenAPI with polymorphic schemas via discriminator
- [x] Proper error handling (404, 422 validation errors)

### Backend - Weather Provider Interface
- [x] `IWeatherProvider` interface: `getType()`, `getCurrentWeather()`, `getForecastWeather()`
- [x] `WeatherProviderRegistryService` manages provider registration
- [x] Provider returns standardized `CurrentDayModel` and `ForecastDayModel[]`

### Backend - OpenWeatherMap Plugin
- [x] Plugin at `apps/backend/src/plugins/weather-openweathermap/`
- [x] `OpenWeatherMapLocationEntity` extends `WeatherLocationEntity` with:
  - `locationType`: enum (`lat_lon`, `city_name`, `city_id`, `zip_code`)
  - `latitude`, `longitude` (for lat_lon)
  - `cityName`, `countryCode` (for city_name)
  - `cityId` (for city_id)
  - `zipCode` (for zip_code)
- [x] Plugin configuration model with `apiKey` and `unit` (celsius/fahrenheit)
- [x] Implements `IWeatherProvider` interface
- [x] Registers location type mapping in `onModuleInit`
- [x] Registers discriminator for OpenAPI
- [x] Existing OpenWeatherMap logic extracted from weather module

### Backend - Multi-Location Weather Service
- [x] Weather service fetches data for ALL configured locations
- [x] Cache key includes location ID: `weather-{current|forecast}:{locationId}`
- [x] Cron job refreshes weather for all locations
- [x] WebSocket event includes location ID in payload
- [ ] Rate limiting respects provider limits across all locations

### Backend - Module Configuration
- [ ] Module config updated: only `primaryLocationId` remains
- [ ] `primaryLocationId` references a `WeatherLocationEntity` or null
- [ ] Validation prevents deleting location that is set as primary

### Admin - Location Management UI
- [ ] New "Locations" section in weather module settings
- [ ] List view showing all configured locations
- [ ] Add location: **first select provider type**, then dynamic form appears
- [ ] Provider-specific form fields (map picker for coordinates, city search, etc.)
- [ ] Edit and delete location functionality
- [ ] Set/unset primary location toggle

### Admin - Provider Configuration
- [ ] Plugin configuration moved to plugin settings page
- [ ] API key input in plugin configuration
- [ ] Unit selection (celsius/fahrenheit) in plugin configuration

### Admin - Weather Display
- [ ] Weather display shows primary location by default
- [ ] Location selector dropdown to switch displayed location
- [ ] Pinia stores updated for multi-location support

### Panel (Flutter) - Multi-Location Support
- [ ] Location model and repository added
- [ ] Weather service supports fetching by location ID
- [ ] Dashboard tile shows primary location weather
- [ ] Weather detail view allows location switching
- [ ] Socket events handled per location

## 5. Example scenarios

### Scenario: User adds a new OpenWeatherMap location

Given the user has the admin panel open
When they navigate to Weather → Locations → Add
And they select "OpenWeatherMap" as provider
Then provider-specific form appears with location type selector
When they select "Coordinates" and click on the map
And they enter "Office" as name
And they click Save
Then a new `OpenWeatherMapLocationEntity` is created
And weather data is fetched for this location

### Scenario: Different providers have different location options

Given OpenWeatherMap plugin is registered
And a hypothetical "SimpleWeather" plugin only supports coordinates
When user adds an OpenWeatherMap location
Then they see options: Coordinates, City Name, City ID, Zip Code
When user adds a SimpleWeather location
Then they only see Coordinates option

### Scenario: Weather refresh for multiple locations

Given three locations are configured (2 OpenWeatherMap, 1 other provider)
When the weather refresh cron job runs
Then each location is fetched via its respective provider
And each location's data is cached separately
And WebSocket events are emitted for each location

## 6. Technical constraints

- Follow device plugin entity inheritance pattern exactly
- Use `@TableInheritance` and `@ChildEntity()` decorators
- Use `LocationsTypeMapperService` pattern from `DevicesTypeMapperService`
- Register discriminators via `ExtendedDiscriminatorService`
- Follow API conventions from `.ai-rules/API_CONVENTIONS.md`
- Schema names: `WeatherModuleData*`, `WeatherModuleRes*`, `WeatherModuleReq*`
- Plugin schema names: `WeatherOpenweathermapPluginData*`
- Use tabs for indentation, 120 char line width, single quotes
- Tests expected for new services and controllers

## 7. Implementation hints

### Backend - Directory Structure

```
apps/backend/src/modules/weather/
├── entities/
│   └── locations.entity.ts              # Base WeatherLocationEntity
├── dto/
│   ├── create-location.dto.ts           # Base CreateLocationDto
│   ├── update-location.dto.ts           # Base UpdateLocationDto
│   └── location-response.dto.ts
├── models/
│   └── location.model.ts                # Response model
├── controllers/
│   └── locations.controller.ts          # Location CRUD
├── services/
│   ├── locations.service.ts             # Location repository operations
│   ├── locations-type-mapper.service.ts # Type-to-class mapping
│   └── weather-provider-registry.service.ts
├── platforms/
│   └── weather-provider.platform.ts     # IWeatherProvider interface

apps/backend/src/plugins/weather-openweathermap/
├── weather-openweathermap.plugin.ts
├── weather-openweathermap.constants.ts
├── entities/
│   └── locations-openweathermap.entity.ts  # OpenWeatherMapLocationEntity
├── dto/
│   ├── create-location-openweathermap.dto.ts
│   └── update-location-openweathermap.dto.ts
├── platforms/
│   └── openweathermap.provider.ts       # Implements IWeatherProvider
├── services/
│   └── openweathermap-http.service.ts   # HTTP client for OpenWeatherMap
└── models/
    └── config.model.ts                  # Plugin config (apiKey, unit)
```

### Base Location Entity Pattern

```typescript
// apps/backend/src/modules/weather/entities/locations.entity.ts

@Entity('weather_module_locations')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class WeatherLocationEntity extends BaseEntity {
	@Expose()
	@Column()
	name: string;

	@Expose()
	get type(): string {
		return (this.constructor as { name: string }).name.toLowerCase();
	}
}
```

### Plugin Location Entity Pattern

```typescript
// apps/backend/src/plugins/weather-openweathermap/entities/locations-openweathermap.entity.ts

@ApiSchema({ name: 'WeatherOpenweathermapPluginDataLocation' })
@ChildEntity()
export class OpenWeatherMapLocationEntity extends WeatherLocationEntity {
	@Expose()
	get type(): string {
		return WEATHER_OPENWEATHERMAP_PLUGIN_TYPE;
	}

	@Expose()
	@Column({ type: 'text', enum: OpenWeatherMapLocationType })
	locationType: OpenWeatherMapLocationType;

	@Expose()
	@Column({ type: 'real', nullable: true })
	latitude: number | null;

	@Expose()
	@Column({ type: 'real', nullable: true })
	longitude: number | null;

	@Expose()
	@Column({ nullable: true })
	cityName: string | null;

	@Expose()
	@Column({ nullable: true })
	countryCode: string | null;

	@Expose()
	@Column({ type: 'integer', nullable: true })
	cityId: number | null;

	@Expose()
	@Column({ nullable: true })
	zipCode: string | null;
}
```

### Type Mapper Registration

```typescript
// In weather-openweathermap.plugin.ts onModuleInit()

this.locationsMapper.registerMapping({
	type: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
	class: OpenWeatherMapLocationEntity,
	createDto: CreateOpenWeatherMapLocationDto,
	updateDto: UpdateOpenWeatherMapLocationDto,
});

this.discriminatorRegistry.register({
	parentClass: WeatherLocationEntity,
	discriminatorProperty: 'type',
	discriminatorValue: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
	modelClass: OpenWeatherMapLocationEntity,
});
```

### Weather Provider Interface

```typescript
export interface IWeatherProvider {
	getType(): string;
	getCurrentWeather(location: WeatherLocationEntity): Promise<CurrentDayModel | null>;
	getForecastWeather(location: WeatherLocationEntity): Promise<ForecastDayModel[] | null>;
}
```

### Admin - Dynamic Form Pattern

```vue
<!-- Location form: first select provider, then show provider-specific fields -->
<template>
  <div>
    <!-- Step 1: Provider selection -->
    <select v-model="selectedProvider" @change="onProviderChange">
      <option v-for="type in availableTypes" :key="type" :value="type">
        {{ type }}
      </option>
    </select>

    <!-- Step 2: Provider-specific form (loaded dynamically) -->
    <component
      v-if="selectedProvider"
      :is="getFormComponent(selectedProvider)"
      v-model="locationData"
    />
  </div>
</template>
```

## 8. AI instructions

- Read this file and `.ai-rules/` guidelines before making code changes.
- Follow the device plugin pattern exactly for entity inheritance.
- Use existing type mapper and discriminator patterns from devices module.
- Schema naming must follow API conventions document.
- Breaking changes are allowed - do not create migrations or legacy aliases.
- Clean code is priority over backward compatibility.
- For admin dynamic forms, use component-based approach with provider selection.
- Run `pnpm run lint:js:fix` and `pnpm run pretty:write` after code changes.
- Run tests with `pnpm run test:unit` to ensure no regressions.

## 9. Implementation Plan

### Phase 1: Backend - Weather Module Foundation

1. Create `WeatherLocationEntity` base entity with `@TableInheritance`
2. Create `LocationsTypeMapperService` following `DevicesTypeMapperService` pattern
3. Create base `CreateLocationDto` and `UpdateLocationDto`
4. Create `LocationsService` with CRUD operations
5. Create `LocationsController` with REST endpoints
6. Create `IWeatherProvider` interface
7. Create `WeatherProviderRegistryService`
8. Export new services from weather module

### Phase 2: Backend - OpenWeatherMap Plugin

1. Create plugin directory structure
2. Create `OpenWeatherMapLocationEntity` with provider-specific columns
3. Create plugin-specific DTOs with validation
4. Create `OpenWeatherMapProvider` implementing `IWeatherProvider`
5. Extract HTTP client logic to `OpenWeatherMapHttpService`
6. Create plugin configuration model (`apiKey`, `unit`)
7. Register type mappings and discriminators in `onModuleInit`
8. Register plugin in `app.module.ts`

### Phase 3: Backend - Multi-Location Weather Service

1. Update `WeatherService` to iterate over all locations
2. Update cache keys to include location ID
3. Update cron job for multi-location refresh
4. Update WebSocket events with location context
5. Update module config to only have `primaryLocationId`
6. Add validation for primary location deletion

### Phase 4: Admin - Location Management

1. Create location Pinia store with type-aware schemas
2. Create locations list component
3. Create provider selector component
4. Create provider-specific form components (OpenWeatherMap with map)
5. Update weather config to remove location fields, add primary selector
6. Update weather display for multi-location support

### Phase 5: Panel (Flutter) - Multi-Location Support

1. Create base location model
2. Create provider-specific location models
3. Create location repository
4. Update weather service for multi-location
5. Update dashboard tile for primary location
6. Add location selector to weather detail view
