# Refactoring Plan: Unified Displays Module

## Executive Summary

Create a new `displays` module with a **single unified entity** that combines display instance info and configuration. The module will handle display registration and use **long-lived access tokens** (already supported by auth module) for backend service access.

---

## Current State Analysis

### Existing Entities

**DisplayInstanceEntity (users module)**
- `uid`: Device unique identifier
- `mac`: MAC address
- `version`: App version
- `build`: Build identifier
- `user`: Associated user (for auth)
- `displayProfile`: Link to configuration

**DisplayProfileEntity (system module)**
- `uid`: Profile unique identifier
- `screenWidth`, `screenHeight`: Screen dimensions
- `pixelRatio`: Display pixel ratio
- `unitSize`: Grid unit size
- `rows`, `cols`: Grid configuration
- `primary`: Primary display flag

### Current Registration Flow
1. Display calls `/auth/register-display` with User-Agent header
2. Auth creates a "display user" (username = UID, generated password)
3. Creates DisplayInstance linked to user
4. Returns password to display
5. Display uses password to login and get short-lived tokens

### Problems with Current Approach
- Two separate entities requiring synchronization
- Subscriber needed to link instances to profiles
- Display needs to login after registration to get tokens
- Complex flow with user entity acting as auth intermediary

---

## Target Architecture

### Unified DisplayEntity

Merge both entities into a single `DisplayEntity`:

```typescript
@Entity('displays_module_displays')
export class DisplayEntity extends BaseEntity {
  // === Instance Info ===
  @Column({ type: 'uuid', unique: true })
  uid: string;                    // Device unique identifier

  @Column()
  mac: string;                    // MAC address

  @Column()
  version: string;                // App version

  @Column()
  build: string;                  // Build identifier

  // === Configuration ===
  @Column({ type: 'int', nullable: true })
  screenWidth: number | null;     // Screen width in pixels

  @Column({ type: 'int', nullable: true })
  screenHeight: number | null;    // Screen height in pixels

  @Column({ type: 'float', nullable: true })
  pixelRatio: number | null;      // Pixel ratio

  @Column({ type: 'float', nullable: true })
  unitSize: number | null;        // Grid unit size

  @Column({ type: 'int', nullable: true })
  rows: number | null;            // Grid rows

  @Column({ type: 'int', nullable: true })
  cols: number | null;            // Grid columns

  @Column({ type: 'boolean', default: false })
  primary: boolean;               // Primary display flag

  // === Authentication ===
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  owner: UserEntity;              // Owner user (for token ownership)

  @Column({ type: 'datetime', nullable: true })
  lastSeenAt: Date | null;        // Last activity timestamp
}
```

### New Registration Flow

```
┌─────────────────┐     POST /displays-module/register      ┌──────────────────┐
│   Panel App     │ ───────────────────────────────────────▶│  Displays Module │
│  (Flutter)      │   User-Agent: FlutterApp/...           │                  │
│                 │   Body: { uid, mac, version, build,    │                  │
│                 │          screen_width, screen_height,   │                  │
│                 │          pixel_ratio, unit_size,        │                  │
│                 │          rows, cols }                   │                  │
└─────────────────┘                                         └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  1. Validate     │
                                                            │     User-Agent   │
                                                            └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  2. Find/Create  │
                                                            │     Display by   │
                                                            │     UID          │
                                                            └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  3. Update info  │
                                                            │     & config     │
                                                            └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  4. Generate     │
                                                            │     Long-Live    │
                                                            │     Token        │
                                                            └────────┬─────────┘
                                                                     │
                                                                     ▼
┌─────────────────┐     Response: { access_token,           ┌──────────────────┐
│   Panel App     │ ◀───────────────────────────────────────│  Displays Module │
│  (Flutter)      │              display }                  │                  │
└─────────────────┘                                         └──────────────────┘
```

### Authentication Flow (Post-Registration)

```
┌─────────────────┐     Any API Request                     ┌──────────────────┐
│   Panel App     │ ───────────────────────────────────────▶│  Backend API     │
│  (Flutter)      │   Authorization: Bearer <long-live-tkn> │                  │
└─────────────────┘                                         └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  Auth Guard      │
                                                            │  validates token │
                                                            │  (existing flow) │
                                                            └──────────────────┘
```

---

## Module Structure

```
apps/backend/src/modules/displays/
├── controllers/
│   ├── displays.controller.ts          # CRUD operations
│   ├── displays.controller.spec.ts
│   ├── registration.controller.ts      # Registration endpoint
│   └── registration.controller.spec.ts
├── dto/
│   ├── register-display.dto.ts         # Registration input
│   ├── create-display.dto.ts           # Admin create (optional)
│   └── update-display.dto.ts           # Update display config
├── entities/
│   └── displays.entity.ts              # Unified DisplayEntity
├── models/
│   └── displays-response.model.ts      # Response wrappers
├── services/
│   ├── displays.service.ts             # Core business logic
│   ├── displays.service.spec.ts
│   ├── registration.service.ts         # Registration logic
│   ├── registration.service.spec.ts
│   └── module-reset.service.ts
├── validators/
│   └── display-exists-constraint.validator.ts
├── displays.constants.ts
├── displays.exceptions.ts
├── displays.module.ts
└── displays.openapi.ts
```

---

## Detailed Implementation

### Phase 1: Create Module Foundation

#### 1.1 Constants (`displays.constants.ts`)

```typescript
export const DISPLAYS_MODULE_PREFIX = 'displays-module';
export const DISPLAYS_MODULE_NAME = 'displays-module';
export const DISPLAYS_MODULE_API_TAG_NAME = 'Displays module';
export const DISPLAYS_MODULE_API_TAG_DESCRIPTION = 
  'Endpoints for managing display devices, their configuration, and registration.';

// Allowed User-Agent patterns for registration
export const ALLOWED_USER_AGENTS = ['FlutterApp'];

export enum EventType {
  DISPLAY_CREATED = 'DisplaysModule.Display.Created',
  DISPLAY_UPDATED = 'DisplaysModule.Display.Updated',
  DISPLAY_DELETED = 'DisplaysModule.Display.Deleted',
  DISPLAY_REGISTERED = 'DisplaysModule.Display.Registered',
  DISPLAY_RESET = 'DisplaysModule.Display.Reset',
  MODULE_RESET = 'DisplaysModule.All.Reset',
}
```

#### 1.2 Exceptions (`displays.exceptions.ts`)

```typescript
export class DisplaysException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisplaysException';
  }
}

export class DisplaysNotFoundException extends DisplaysException {
  constructor(message: string) {
    super(message);
    this.name = 'DisplaysNotFoundException';
  }
}

export class DisplaysValidationException extends DisplaysException {
  constructor(message: string) {
    super(message);
    this.name = 'DisplaysValidationException';
  }
}

export class DisplaysRegistrationException extends DisplaysException {
  constructor(message: string) {
    super(message);
    this.name = 'DisplaysRegistrationException';
  }
}
```

#### 1.3 Entity (`entities/displays.entity.ts`)

```typescript
import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsString, IsUUID } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from '../../users/entities/users.entity';

@ApiSchema({ name: 'DisplaysModuleDataDisplay' })
@Entity('displays_module_displays')
export class DisplayEntity extends BaseEntity {
  // === Instance Info ===
  
  @ApiProperty({
    description: 'Unique identifier for the display device',
    type: 'string',
    format: 'uuid',
    example: 'fcab917a-f889-47cf-9ace-ef085774864e',
  })
  @Expose()
  @IsString()
  @IsUUID()
  @Column({ type: 'uuid', unique: true })
  uid: string;

  @ApiProperty({
    description: 'MAC address of the device network interface',
    type: 'string',
    example: '00:1A:2B:3C:4D:5E',
  })
  @Expose()
  @IsString()
  @Column({ nullable: false })
  mac: string;

  @ApiProperty({
    description: 'Application version running on the display',
    type: 'string',
    example: '1.0.0',
  })
  @Expose()
  @IsString()
  @Column({ nullable: false })
  version: string;

  @ApiProperty({
    description: 'Build number or identifier of the app',
    type: 'string',
    example: '42',
  })
  @Expose()
  @IsString()
  @Column({ nullable: false })
  build: string;

  // === Configuration ===

  @ApiPropertyOptional({
    name: 'screen_width',
    description: 'Display screen width in pixels',
    type: 'integer',
    nullable: true,
    example: 1920,
  })
  @Expose({ name: 'screen_width' })
  @IsInt()
  @Column({ type: 'int', nullable: true })
  screenWidth: number | null;

  @ApiPropertyOptional({
    name: 'screen_height',
    description: 'Display screen height in pixels',
    type: 'integer',
    nullable: true,
    example: 1080,
  })
  @Expose({ name: 'screen_height' })
  @IsInt()
  @Column({ type: 'int', nullable: true })
  screenHeight: number | null;

  @ApiPropertyOptional({
    name: 'pixel_ratio',
    description: 'Display pixel ratio',
    type: 'number',
    nullable: true,
    example: 1.5,
  })
  @Expose({ name: 'pixel_ratio' })
  @IsNumber()
  @Column({ type: 'float', nullable: true })
  pixelRatio: number | null;

  @ApiPropertyOptional({
    name: 'unit_size',
    description: 'Display unit size for grid calculations',
    type: 'number',
    nullable: true,
    example: 8,
  })
  @Expose({ name: 'unit_size' })
  @IsNumber()
  @Column({ type: 'float', nullable: true })
  unitSize: number | null;

  @ApiPropertyOptional({
    description: 'Number of rows in the grid layout',
    type: 'integer',
    nullable: true,
    example: 12,
  })
  @Expose()
  @IsInt()
  @Column({ type: 'int', nullable: true })
  rows: number | null;

  @ApiPropertyOptional({
    description: 'Number of columns in the grid layout',
    type: 'integer',
    nullable: true,
    example: 24,
  })
  @Expose()
  @IsInt()
  @Column({ type: 'int', nullable: true })
  cols: number | null;

  @ApiProperty({
    description: 'Whether this is the primary display',
    type: 'boolean',
    default: false,
    example: true,
  })
  @Expose()
  @IsBoolean()
  @Column({ type: 'boolean', default: false })
  primary: boolean;

  // === Authentication & Ownership ===

  @ApiProperty({
    description: 'Owner user ID (used for token ownership)',
    type: 'string',
    format: 'uuid',
    example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
  })
  @Expose()
  @Transform(({ value }: { value: UserEntity }) => value?.id, { toPlainOnly: true })
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: UserEntity | string;

  @ApiPropertyOptional({
    name: 'last_seen_at',
    description: 'Timestamp of last display activity',
    type: 'string',
    format: 'date-time',
    nullable: true,
    example: '2025-01-18T12:00:00Z',
  })
  @Expose({ name: 'last_seen_at' })
  @Transform(({ value }: { value: Date | null }) => value?.toISOString() ?? null, { toPlainOnly: true })
  @Column({ type: 'datetime', nullable: true })
  lastSeenAt: Date | null;
}
```

### Phase 2: DTOs

#### 2.1 Registration DTO (`dto/register-display.dto.ts`)

```typescript
import { Expose, Type } from 'class-transformer';
import { 
  IsMACAddress, IsInt, IsNotEmpty, IsNumber, IsOptional, 
  IsString, IsUUID, Matches, Min, ValidateNested 
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DisplaysModuleRegisterDisplay' })
export class RegisterDisplayDto {
  @ApiProperty({
    description: 'Unique identifier for the display device',
    type: 'string',
    format: 'uuid',
    example: 'fcab917a-f889-47cf-9ace-ef085774864e',
  })
  @Expose()
  @IsNotEmpty()
  @IsUUID('4', { message: '[{"field":"uid","reason":"UID must be a valid UUID (version 4)."}]' })
  uid: string;

  @ApiProperty({
    description: 'MAC address of the device network interface',
    type: 'string',
    example: '00:1A:2B:3C:4D:5E',
  })
  @Expose()
  @IsNotEmpty()
  @IsMACAddress({ message: '[{"field":"mac","reason":"Mac address must be a valid MAC string."}]' })
  mac: string;

  @ApiProperty({
    description: 'Application version running on the display',
    type: 'string',
    example: '1.0.0',
  })
  @Expose()
  @IsNotEmpty({ message: '[{"field":"version","reason":"Version must be a non-empty string."}]' })
  @Matches(
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/i,
    { message: '[{"field":"version","reason":"Version must follow semantic versioning."}]' },
  )
  version: string;

  @ApiProperty({
    description: 'Build number or identifier',
    type: 'string',
    example: '42',
  })
  @Expose()
  @IsNotEmpty({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
  @IsString()
  build: string;

  // === Optional Configuration (can be provided during registration) ===

  @ApiPropertyOptional({
    name: 'screen_width',
    description: 'Display screen width in pixels',
    type: 'integer',
    example: 1920,
  })
  @Expose()
  @IsOptional()
  @IsInt({ message: '[{"field":"screen_width","reason":"Screen width must be a valid integer."}]' })
  screen_width?: number;

  @ApiPropertyOptional({
    name: 'screen_height',
    description: 'Display screen height in pixels',
    type: 'integer',
    example: 1080,
  })
  @Expose()
  @IsOptional()
  @IsInt({ message: '[{"field":"screen_height","reason":"Screen height must be a valid integer."}]' })
  screen_height?: number;

  @ApiPropertyOptional({
    name: 'pixel_ratio',
    description: 'Display pixel ratio',
    type: 'number',
    example: 1.5,
  })
  @Expose()
  @IsOptional()
  @IsNumber({}, { message: '[{"field":"pixel_ratio","reason":"Pixel ratio must be a valid number."}]' })
  pixel_ratio?: number;

  @ApiPropertyOptional({
    name: 'unit_size',
    description: 'Display unit size',
    type: 'number',
    example: 8,
  })
  @Expose()
  @IsOptional()
  @IsNumber({}, { message: '[{"field":"unit_size","reason":"Unit size must be a valid number."}]' })
  unit_size?: number;

  @ApiPropertyOptional({
    description: 'Number of rows',
    type: 'integer',
    minimum: 1,
    example: 12,
  })
  @Expose()
  @IsOptional()
  @IsInt({ message: '[{"field":"rows","reason":"Rows must be a valid integer."}]' })
  @Min(1, { message: '[{"field":"rows","reason":"Rows must be at least 1."}]' })
  rows?: number;

  @ApiPropertyOptional({
    description: 'Number of columns',
    type: 'integer',
    minimum: 1,
    example: 24,
  })
  @Expose()
  @IsOptional()
  @IsInt({ message: '[{"field":"cols","reason":"Cols must be a valid integer."}]' })
  @Min(1, { message: '[{"field":"cols","reason":"Cols must be at least 1."}]' })
  cols?: number;
}

@ApiSchema({ name: 'DisplaysModuleReqRegisterDisplay' })
export class ReqRegisterDisplayDto {
  @ApiProperty({
    description: 'Display registration data',
    type: () => RegisterDisplayDto,
  })
  @Expose()
  @ValidateNested()
  @Type(() => RegisterDisplayDto)
  data: RegisterDisplayDto;
}
```

#### 2.2 Update DTO (`dto/update-display.dto.ts`)

```typescript
import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DisplaysModuleUpdateDisplay' })
export class UpdateDisplayDto {
  @ApiPropertyOptional({
    description: 'Application version',
    type: 'string',
    example: '1.0.0',
  })
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @Matches(
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/i,
    { message: '[{"field":"version","reason":"Version must follow semantic versioning."}]' },
  )
  version?: string;

  @ApiPropertyOptional({
    description: 'Build identifier',
    type: 'string',
    example: '42',
  })
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  build?: string;

  @ApiPropertyOptional({
    name: 'unit_size',
    description: 'Display unit size',
    type: 'number',
    example: 8,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  unit_size?: number;

  @ApiPropertyOptional({
    description: 'Number of rows',
    type: 'integer',
    minimum: 1,
    example: 12,
  })
  @Expose()
  @IsOptional()
  @IsInt()
  @Min(1)
  rows?: number;

  @ApiPropertyOptional({
    description: 'Number of columns',
    type: 'integer',
    minimum: 1,
    example: 24,
  })
  @Expose()
  @IsOptional()
  @IsInt()
  @Min(1)
  cols?: number;

  @ApiPropertyOptional({
    description: 'Whether this is the primary display',
    type: 'boolean',
    example: true,
  })
  @Expose()
  @IsOptional()
  @IsBoolean()
  primary?: boolean;
}

@ApiSchema({ name: 'DisplaysModuleReqUpdateDisplay' })
export class ReqUpdateDisplayDto {
  @ApiProperty({
    description: 'Display update data',
    type: () => UpdateDisplayDto,
  })
  @Expose()
  @ValidateNested()
  @Type(() => UpdateDisplayDto)
  data: UpdateDisplayDto;
}
```

### Phase 3: Services

#### 3.1 Registration Service (`services/registration.service.ts`)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { TokensService } from '../../auth/services/tokens.service';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { TokenType } from '../../auth/auth.constants';
import { CreateLongLiveTokenDto } from '../../auth/dto/create-token.dto';
import { LongLiveTokenEntity } from '../../auth/entities/auth.entity';

import { DisplayEntity } from '../entities/displays.entity';
import { RegisterDisplayDto } from '../dto/register-display.dto';
import { EventType, ALLOWED_USER_AGENTS } from '../displays.constants';
import { DisplaysRegistrationException } from '../displays.exceptions';
import { DisplaysService } from './displays.service';

export interface RegistrationResult {
  display: DisplayEntity;
  accessToken: string;
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly displaysService: DisplaysService,
    private readonly usersService: UsersService,
    private readonly tokensService: TokensService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  validateUserAgent(userAgent: string | undefined): boolean {
    if (!userAgent) return false;
    return ALLOWED_USER_AGENTS.some(agent => userAgent.includes(agent));
  }

  async register(dto: RegisterDisplayDto): Promise<RegistrationResult> {
    this.logger.debug(`[REGISTER] Registering display uid=${dto.uid}`);

    // 1. Find or create display owner user
    let ownerUser = await this.usersService.findByUsername(`display_${dto.uid}`);

    if (!ownerUser) {
      this.logger.debug(`[REGISTER] Creating owner user for display uid=${dto.uid}`);
      
      ownerUser = await this.usersService.create({
        username: `display_${dto.uid}`,
        role: UserRole.DISPLAY,
        isHidden: true,
      });
    }

    // 2. Find or create display
    let display = await this.displaysService.findByUid(dto.uid);
    let isNewDisplay = false;

    if (display) {
      this.logger.debug(`[REGISTER] Updating existing display uid=${dto.uid}`);
      
      display = await this.displaysService.update(display.id, {
        mac: dto.mac,
        version: dto.version,
        build: dto.build,
        screenWidth: dto.screen_width ?? display.screenWidth,
        screenHeight: dto.screen_height ?? display.screenHeight,
        pixelRatio: dto.pixel_ratio ?? display.pixelRatio,
        unitSize: dto.unit_size ?? display.unitSize,
        rows: dto.rows ?? display.rows,
        cols: dto.cols ?? display.cols,
        lastSeenAt: new Date(),
      });
    } else {
      this.logger.debug(`[REGISTER] Creating new display uid=${dto.uid}`);
      isNewDisplay = true;

      // Check if this should be primary (first display)
      const existingDisplays = await this.displaysService.findAll();
      const isPrimary = existingDisplays.length === 0;

      display = await this.displaysService.create({
        uid: dto.uid,
        mac: dto.mac,
        version: dto.version,
        build: dto.build,
        screenWidth: dto.screen_width ?? null,
        screenHeight: dto.screen_height ?? null,
        pixelRatio: dto.pixel_ratio ?? null,
        unitSize: dto.unit_size ?? null,
        rows: dto.rows ?? null,
        cols: dto.cols ?? null,
        primary: isPrimary,
        owner: ownerUser.id,
        lastSeenAt: new Date(),
      });
    }

    // 3. Generate long-lived access token
    const accessToken = await this.generateDisplayToken(ownerUser.id, display);

    this.logger.debug(`[REGISTER] Successfully registered display uid=${dto.uid}`);

    this.eventEmitter.emit(
      isNewDisplay ? EventType.DISPLAY_CREATED : EventType.DISPLAY_REGISTERED,
      display,
    );

    return { display, accessToken };
  }

  private async generateDisplayToken(ownerId: string, display: DisplayEntity): Promise<string> {
    // Generate JWT token with long expiration (or no expiration)
    const payload = {
      sub: ownerId,
      role: UserRole.DISPLAY,
      displayId: display.id,
      iat: Math.floor(Date.now() / 1000),
    };

    // Long-lived token - 10 years (effectively permanent)
    const token = this.jwtService.sign(payload, { expiresIn: '3650d' });

    // Store token in database
    try {
      await this.tokensService.create<LongLiveTokenEntity, CreateLongLiveTokenDto>({
        token,
        type: TokenType.LONG_LIVE,
        owner: ownerId,
        name: `Display ${display.uid}`,
        description: `Auto-generated token for display ${display.uid}`,
        expiresAt: null, // Long-live tokens can have no expiration
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error('[REGISTER] Failed to create display token', { 
        message: err.message, 
        stack: err.stack 
      });
      throw new DisplaysRegistrationException('Failed to generate access token');
    }

    return token;
  }
}
```

#### 3.2 Displays Service (`services/displays.service.ts`)

```typescript
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { DisplayEntity } from '../entities/displays.entity';
import { EventType } from '../displays.constants';
import { DisplaysNotFoundException, DisplaysValidationException } from '../displays.exceptions';

@Injectable()
export class DisplaysService {
  private readonly logger = new Logger(DisplaysService.name);

  constructor(
    @InjectRepository(DisplayEntity)
    private readonly repository: Repository<DisplayEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(): Promise<DisplayEntity[]> {
    this.logger.debug('[LOOKUP ALL] Fetching all displays');
    
    const displays = await this.repository.find({
      relations: ['owner'],
    });

    this.logger.debug(`[LOOKUP ALL] Found ${displays.length} displays`);
    return displays;
  }

  async findOne(id: string): Promise<DisplayEntity | null> {
    return this.findByField('id', id);
  }

  async findByUid(uid: string): Promise<DisplayEntity | null> {
    return this.findByField('uid', uid);
  }

  async findPrimary(): Promise<DisplayEntity | null> {
    return this.findByField('primary', true);
  }

  async create(data: Partial<DisplayEntity>): Promise<DisplayEntity> {
    this.logger.debug('[CREATE] Creating new display');

    const display = this.repository.create(toInstance(DisplayEntity, data));
    await this.repository.save(display);

    const savedDisplay = await this.getOneOrThrow(display.id);

    this.logger.debug(`[CREATE] Successfully created display id=${savedDisplay.id}`);
    this.eventEmitter.emit(EventType.DISPLAY_CREATED, savedDisplay);

    return savedDisplay;
  }

  async update(id: string, data: Partial<DisplayEntity>): Promise<DisplayEntity> {
    this.logger.debug(`[UPDATE] Updating display id=${id}`);

    const display = await this.getOneOrThrow(id);

    // Handle primary flag - only one can be primary
    if (data.primary === true) {
      const currentPrimary = await this.findPrimary();
      if (currentPrimary && currentPrimary.id !== id) {
        await this.repository.update(currentPrimary.id, { primary: false });
      }
    }

    Object.assign(display, omitBy(toInstance(DisplayEntity, data), isUndefined));
    await this.repository.save(display);

    const updatedDisplay = await this.getOneOrThrow(display.id);

    this.logger.debug(`[UPDATE] Successfully updated display id=${updatedDisplay.id}`);
    this.eventEmitter.emit(EventType.DISPLAY_UPDATED, updatedDisplay);

    return updatedDisplay;
  }

  async remove(id: string): Promise<void> {
    this.logger.debug(`[DELETE] Removing display id=${id}`);

    const display = await this.getOneOrThrow(id);
    await this.repository.delete(display.id);

    this.logger.log(`[DELETE] Successfully removed display id=${id}`);
    this.eventEmitter.emit(EventType.DISPLAY_DELETED, display);
  }

  async getOneOrThrow(id: string): Promise<DisplayEntity> {
    const display = await this.findOne(id);

    if (!display) {
      this.logger.error(`[ERROR] Display with id=${id} not found`);
      throw new DisplaysNotFoundException('Requested display does not exist');
    }

    return display;
  }

  private async findByField(
    field: keyof DisplayEntity,
    value: string | number | boolean,
  ): Promise<DisplayEntity | null> {
    this.logger.debug(`[LOOKUP] Fetching display with ${field}=${value}`);

    const display = await this.repository.findOne({
      where: { [field]: value },
      relations: ['owner'],
    });

    if (!display) {
      this.logger.debug(`[LOOKUP] Display with ${field}=${value} not found`);
      return null;
    }

    this.logger.debug(`[LOOKUP] Successfully fetched display with ${field}=${value}`);
    return display;
  }
}
```

### Phase 4: Controllers

#### 4.1 Registration Controller (`controllers/registration.controller.ts`)

```typescript
import { Body, Controller, ForbiddenException, Headers, Logger, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiBadRequestResponse,
  ApiCreatedSuccessResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Public } from '../../auth/guards/auth.guard';

import { ReqRegisterDisplayDto } from '../dto/register-display.dto';
import { RegisterDisplayResponseModel } from '../models/displays-response.model';
import { RegistrationService } from '../services/registration.service';
import { DISPLAYS_MODULE_API_TAG_NAME, DISPLAYS_MODULE_PREFIX } from '../displays.constants';

@ApiTags(DISPLAYS_MODULE_API_TAG_NAME)
@Controller('register')
export class RegistrationController {
  private readonly logger = new Logger(RegistrationController.name);

  constructor(private readonly registrationService: RegistrationService) {}

  @ApiOperation({
    tags: [DISPLAYS_MODULE_API_TAG_NAME],
    summary: 'Register a display device',
    description: 
      'Register a new display device or update existing registration. ' +
      'Returns a long-lived access token for API and WebSocket authentication. ' +
      'Requires valid User-Agent header.',
    operationId: 'create-displays-module-register',
  })
  @ApiBody({ type: ReqRegisterDisplayDto, description: 'Display registration data' })
  @ApiCreatedSuccessResponse(
    RegisterDisplayResponseModel,
    'Display successfully registered. Response includes display details and access token.',
    '/api/v1/displays-module/displays/{id}',
  )
  @ApiBadRequestResponse('Invalid registration data')
  @ApiForbiddenResponse('Invalid User-Agent or registration denied')
  @ApiInternalServerErrorResponse('Internal server error')
  @Public()
  @Post()
  async register(
    @Headers('User-Agent') userAgent: string,
    @Body() dto: ReqRegisterDisplayDto,
  ): Promise<RegisterDisplayResponseModel> {
    this.logger.debug(`[REGISTER] User-Agent: ${userAgent}`);

    if (!this.registrationService.validateUserAgent(userAgent)) {
      this.logger.warn('[REGISTER] Unauthorized User-Agent attempt');
      throw new ForbiddenException('Access Denied');
    }

    try {
      const result = await this.registrationService.register(dto.data);

      this.logger.debug(`[REGISTER] Successfully registered display uid=${dto.data.uid}`);

      const response = new RegisterDisplayResponseModel();
      response.data = {
        display: result.display,
        access_token: result.accessToken,
      };

      return response;
    } catch (error) {
      const err = error as Error;
      this.logger.error('[REGISTER] Failed to register display', {
        message: err.message,
        stack: err.stack,
      });
      throw new ForbiddenException('An error occurred while registering the display');
    }
  }
}
```

#### 4.2 Displays Controller (`controllers/displays.controller.ts`)

```typescript
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import {
  Body, Controller, Delete, Get, Logger, NotFoundException,
  Param, ParseUUIDPipe, Patch, Req, Res,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { setLocationHeader } from '../../api/utils/location-header.utils';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';

import { ReqUpdateDisplayDto } from '../dto/update-display.dto';
import { DisplayEntity } from '../entities/displays.entity';
import {
  DisplayByUidResponseModel,
  DisplayResponseModel,
  DisplaysResponseModel,
} from '../models/displays-response.model';
import { DisplaysService } from '../services/displays.service';
import { DISPLAYS_MODULE_API_TAG_NAME, DISPLAYS_MODULE_PREFIX } from '../displays.constants';

@ApiTags(DISPLAYS_MODULE_API_TAG_NAME)
@Controller('displays')
export class DisplaysController {
  private readonly logger = new Logger(DisplaysController.name);

  constructor(private readonly displaysService: DisplaysService) {}

  @ApiOperation({
    tags: [DISPLAYS_MODULE_API_TAG_NAME],
    summary: 'Retrieve all displays',
    description: 'Fetches a list of all registered display devices with their configuration.',
    operationId: 'get-displays-module-displays',
  })
  @ApiSuccessResponse(DisplaysResponseModel, 'List of displays successfully retrieved')
  @ApiBadRequestResponse('Invalid request parameters')
  @ApiInternalServerErrorResponse('Internal server error')
  @Get()
  async findAll(): Promise<DisplaysResponseModel> {
    this.logger.debug('[LOOKUP ALL] Fetching all displays');

    const displays = await this.displaysService.findAll();

    this.logger.debug(`[LOOKUP ALL] Retrieved ${displays.length} displays`);

    const response = new DisplaysResponseModel();
    response.data = displays;

    return response;
  }

  @ApiOperation({
    tags: [DISPLAYS_MODULE_API_TAG_NAME],
    summary: 'Retrieve a display by ID',
    description: 'Fetches details of a specific display device.',
    operationId: 'get-displays-module-display',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display ID' })
  @ApiSuccessResponse(DisplayResponseModel, 'Display successfully retrieved')
  @ApiBadRequestResponse('Invalid UUID format')
  @ApiNotFoundResponse('Display not found')
  @ApiInternalServerErrorResponse('Internal server error')
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DisplayResponseModel> {
    this.logger.debug(`[LOOKUP] Fetching display id=${id}`);

    const display = await this.getOneOrThrow(id);

    this.logger.debug(`[LOOKUP] Found display id=${display.id}`);

    const response = new DisplayResponseModel();
    response.data = display;

    return response;
  }

  @ApiOperation({
    tags: [DISPLAYS_MODULE_API_TAG_NAME],
    summary: 'Retrieve a display by UID',
    description: 'Fetches details of a specific display device by its unique identifier.',
    operationId: 'get-displays-module-display-by-uid',
  })
  @ApiParam({ name: 'uid', type: 'string', format: 'uuid', description: 'Display UID' })
  @ApiSuccessResponse(DisplayByUidResponseModel, 'Display successfully retrieved')
  @ApiBadRequestResponse('Invalid UID format')
  @ApiNotFoundResponse('Display not found')
  @ApiInternalServerErrorResponse('Internal server error')
  @Get('by-uid/:uid')
  async findByUid(
    @Param('uid', new ParseUUIDPipe({ version: '4' })) uid: string,
  ): Promise<DisplayByUidResponseModel> {
    this.logger.debug(`[LOOKUP] Fetching display uid=${uid}`);

    const display = await this.displaysService.findByUid(uid);

    if (!display) {
      this.logger.error(`[ERROR] Display with uid=${uid} not found`);
      throw new NotFoundException('Requested display does not exist');
    }

    this.logger.debug(`[LOOKUP] Found display id=${display.id}`);

    const response = new DisplayByUidResponseModel();
    response.data = display;

    return response;
  }

  @ApiOperation({
    tags: [DISPLAYS_MODULE_API_TAG_NAME],
    summary: 'Update a display',
    description: 'Updates configuration of an existing display device.',
    operationId: 'update-displays-module-display',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display ID' })
  @ApiSuccessResponse(DisplayResponseModel, 'Display successfully updated')
  @ApiBadRequestResponse('Invalid request data')
  @ApiNotFoundResponse('Display not found')
  @ApiInternalServerErrorResponse('Internal server error')
  @Patch(':id')
  @Roles(UserRole.DISPLAY, UserRole.OWNER)
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateDto: ReqUpdateDisplayDto,
  ): Promise<DisplayResponseModel> {
    this.logger.debug(`[UPDATE] Updating display id=${id}`);

    const display = await this.getOneOrThrow(id);
    const updatedDisplay = await this.displaysService.update(display.id, updateDto.data);

    this.logger.debug(`[UPDATE] Successfully updated display id=${updatedDisplay.id}`);

    const response = new DisplayResponseModel();
    response.data = updatedDisplay;

    return response;
  }

  @ApiOperation({
    tags: [DISPLAYS_MODULE_API_TAG_NAME],
    summary: 'Delete a display',
    description: 'Removes a display device from the system.',
    operationId: 'delete-displays-module-display',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display ID' })
  @ApiNoContentResponse({ description: 'Display deleted successfully' })
  @ApiBadRequestResponse('Invalid UUID format')
  @ApiNotFoundResponse('Display not found')
  @ApiInternalServerErrorResponse('Internal server error')
  @Delete(':id')
  @Roles(UserRole.DISPLAY, UserRole.OWNER)
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
    this.logger.debug(`[DELETE] Deleting display id=${id}`);

    const display = await this.getOneOrThrow(id);
    await this.displaysService.remove(display.id);

    this.logger.debug(`[DELETE] Successfully deleted display id=${id}`);
  }

  private async getOneOrThrow(id: string): Promise<DisplayEntity> {
    const display = await this.displaysService.findOne(id);

    if (!display) {
      this.logger.error(`[ERROR] Display with id=${id} not found`);
      throw new NotFoundException('Requested display does not exist');
    }

    return display;
  }
}
```

### Phase 5: Module Definition

```typescript
// displays.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';
import { UsersModule } from '../users/users.module';

import { DisplaysController } from './controllers/displays.controller';
import { RegistrationController } from './controllers/registration.controller';
import {
  DISPLAYS_MODULE_API_TAG_DESCRIPTION,
  DISPLAYS_MODULE_API_TAG_NAME,
  DISPLAYS_MODULE_NAME,
} from './displays.constants';
import { DISPLAYS_SWAGGER_EXTRA_MODELS } from './displays.openapi';
import { DisplayEntity } from './entities/displays.entity';
import { DisplaysService } from './services/displays.service';
import { ModuleResetService } from './services/module-reset.service';
import { RegistrationService } from './services/registration.service';
import { DisplayExistsConstraintValidator } from './validators/display-exists-constraint.validator';

@ApiTag({
  tagName: DISPLAYS_MODULE_NAME,
  displayName: DISPLAYS_MODULE_API_TAG_NAME,
  description: DISPLAYS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
  imports: [
    NestConfigModule,
    TypeOrmModule.forFeature([DisplayEntity]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    SystemModule,
  ],
  providers: [
    DisplaysService,
    RegistrationService,
    ModuleResetService,
    DisplayExistsConstraintValidator,
  ],
  controllers: [RegistrationController, DisplaysController],
  exports: [DisplaysService, DisplayExistsConstraintValidator],
})
export class DisplaysModule {
  constructor(
    private readonly moduleReset: ModuleResetService,
    private readonly factoryResetRegistry: FactoryResetRegistryService,
    private readonly swaggerRegistry: SwaggerModelsRegistryService,
  ) {}

  onModuleInit() {
    this.factoryResetRegistry.register(
      DISPLAYS_MODULE_NAME,
      async (): Promise<{ success: boolean; reason?: string }> => {
        return this.moduleReset.reset();
      },
      350, // Priority between users (300) and system (400)
    );

    for (const model of DISPLAYS_SWAGGER_EXTRA_MODELS) {
      this.swaggerRegistry.register(model);
    }
  }
}
```

---

## API Endpoints Summary

### New Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/displays-module/register` | Register display & get token | Public (User-Agent validated) |
| GET | `/api/v1/displays-module/displays` | List all displays | Bearer token |
| GET | `/api/v1/displays-module/displays/:id` | Get display by ID | Bearer token |
| GET | `/api/v1/displays-module/displays/by-uid/:uid` | Get display by UID | Bearer token |
| PATCH | `/api/v1/displays-module/displays/:id` | Update display | Bearer token (DISPLAY/OWNER) |
| DELETE | `/api/v1/displays-module/displays/:id` | Delete display | Bearer token (DISPLAY/OWNER) |

### Deprecated Endpoints (to remove)

| Method | Path | Status |
|--------|------|--------|
| POST | `/api/v1/auth-module/auth/register-display` | → REMOVED |
| * | `/api/v1/users-module/displays-instances/*` | → REMOVED |
| * | `/api/v1/system-module/displays-profiles/*` | → REMOVED |

---

## Migration Steps

### Database Migration

```typescript
// src/migrations/XXXXXX-CreateDisplaysTable.ts
export class CreateDisplaysTable implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create new unified table
    await queryRunner.query(`
      CREATE TABLE "displays_module_displays" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "uid" uuid UNIQUE NOT NULL,
        "mac" varchar NOT NULL,
        "version" varchar NOT NULL,
        "build" varchar NOT NULL,
        "screenWidth" int,
        "screenHeight" int,
        "pixelRatio" float,
        "unitSize" float,
        "rows" int,
        "cols" int,
        "primary" boolean DEFAULT false,
        "ownerId" uuid REFERENCES users_module_users(id) ON DELETE CASCADE,
        "lastSeenAt" datetime,
        "createdAt" datetime DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" datetime DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Migrate data from old tables (if needed)
    // ... data migration logic

    // 3. Update dashboard_module_pages foreign key
    // ... update display references

    // 4. Drop old tables
    await queryRunner.query(`DROP TABLE IF EXISTS "users_module_displays_instances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_module_displays_profiles"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse migration
  }
}
```

### Update Dependent Modules

1. **Dashboard Module**: Update `display` foreign key to reference `DisplayEntity`
2. **Auth Module**: Remove `register-display` endpoint
3. **Users Module**: Remove display-related code
4. **System Module**: Remove display profile code

---

## Success Criteria

1. ✅ Single unified `DisplayEntity` with all instance + config fields
2. ✅ Registration endpoint at `/displays-module/register`
3. ✅ Long-lived token returned on registration
4. ✅ Panel app can authenticate with long-lived token
5. ✅ Dashboard module works with new display entity
6. ✅ All tests passing
7. ✅ Database migration successful
8. ✅ Old endpoints removed

---

## Estimated Effort

| Phase | Time |
|-------|------|
| Module Foundation | 1-2 hours |
| Entity & DTOs | 2-3 hours |
| Services | 3-4 hours |
| Controllers | 2-3 hours |
| Module Definition | 1 hour |
| Database Migration | 2-3 hours |
| Update Dependencies | 2-3 hours |
| Testing | 3-4 hours |
| Cleanup | 1-2 hours |
| **Total** | **17-25 hours** |
