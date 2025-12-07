# Refactoring Plan: Unified Displays Module (v3)

## Executive Summary

Create a new `displays` module with a **single unified entity** that is completely independent from users. The auth module will be extended to support different token owner types (users, displays, third-party), with displays using long-lived tokens that can be revoked by users if leaked.

---

## Key Architecture Changes

### 1. Complete Separation of Users and Displays
- Remove `UserRole.DISPLAY` from users module
- `DisplayEntity` has **no relation to `UserEntity`**
- Displays are first-class entities with their own authentication

### 2. Auth Module Handles Multiple Entity Types
- Users: Access + Refresh tokens (existing flow)
- Displays: Long-lived tokens (new)
- Third-party: Long-lived tokens (future)

### 3. Token Revocation
- Users (owners/admins) can view and revoke display tokens
- Provides security control if token is leaked

### 4. Display Configuration Embedded
- Move `DisplayConfigModel` from config module into `DisplayEntity`
- Each display has its own settings (dark mode, brightness, etc.)

---

## Current State Analysis

### What Needs to Change

| Component | Current | Target |
|-----------|---------|--------|
| `UserRole.DISPLAY` | Exists in users module | **Remove entirely** |
| `DisplayInstanceEntity` | Linked to `UserEntity` | **Standalone** |
| `DisplayProfileEntity` | Separate entity | **Merged into DisplayEntity** |
| Display auth | User password + tokens | **Long-lived token** |
| Display config | In config.yaml | **In DisplayEntity** |
| Token ownership | Always `UserEntity` | **Multiple owner types** |

### Files Using `UserRole.DISPLAY` (to update)
- `users/users.constants.ts` - Remove DISPLAY role
- `users/entities/users.entity.ts` - Update role enum
- `auth/guards/auth.guard.ts` - Support display token auth
- `auth/services/auth.service.ts` - Remove display registration
- `auth/controllers/auth.controller.ts` - Remove register-display
- `websocket/services/ws-auth.service.ts` - Support display auth
- `websocket/gateway/websocket.gateway.ts` - Handle display connections
- `devices/services/property-command.service.ts` - Check display access
- Various controllers with `@Roles(UserRole.DISPLAY)`

---

## Target Architecture

### DisplayEntity (Unified)

```typescript
@Entity('displays_module_displays')
export class DisplayEntity extends BaseEntity {
  // === Identity ===
  @Column({ type: 'uuid', unique: true })
  uid: string;                      // Device unique identifier

  @Column()
  mac: string;                      // MAC address

  // === Software Info ===
  @Column()
  version: string;                  // App version

  @Column()
  build: string;                    // Build identifier

  // === Screen Configuration ===
  @Column({ type: 'int', nullable: true })
  screenWidth: number | null;

  @Column({ type: 'int', nullable: true })
  screenHeight: number | null;

  @Column({ type: 'float', nullable: true })
  pixelRatio: number | null;

  // === Grid Configuration ===
  @Column({ type: 'float', nullable: true })
  unitSize: number | null;

  @Column({ type: 'int', nullable: true })
  rows: number | null;

  @Column({ type: 'int', nullable: true })
  cols: number | null;

  @Column({ type: 'boolean', default: false })
  primary: boolean;

  // === Display Settings (moved from config module) ===
  @Column({ type: 'boolean', default: false })
  darkMode: boolean;

  @Column({ type: 'int', default: 100 })
  brightness: number;               // 0-100

  @Column({ type: 'int', default: 30 })
  screenLockDuration: number;       // seconds, 0-3600

  @Column({ type: 'boolean', default: true })
  screenSaver: boolean;

  // === Activity Tracking ===
  @Column({ type: 'datetime', nullable: true })
  lastSeenAt: Date | null;
}
```

### Auth Module Token Architecture

```typescript
// Token owner types
export enum TokenOwnerType {
  USER = 'user',
  DISPLAY = 'display',
  THIRD_PARTY = 'third_party',
}

// Extended LongLiveTokenEntity
@Entity()
export class LongLiveTokenEntity extends TokenEntity {
  @Column({ type: 'varchar' })
  ownerType: TokenOwnerType;        // NEW: Type of owner

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;            // Owner if type=USER (for revocation)

  @Column({ type: 'uuid', nullable: true })
  displayId: string | null;         // Owner if type=DISPLAY

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string | null;
}
```

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AUTH GUARD                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Check Authorization header                                           │
│     ├── Bearer token? → Validate JWT                                    │
│     │   ├── Access token (short-lived) → User auth                      │
│     │   └── Long-lived token → Check owner type                         │
│     │       ├── DISPLAY → Display auth                                  │
│     │       └── THIRD_PARTY → Third-party auth                          │
│     └── No token? → Check display-specific headers (legacy support)     │
│                                                                          │
│  2. Set request context                                                  │
│     ├── User: { type: 'user', id: userId, role: UserRole }              │
│     └── Display: { type: 'display', id: displayId }                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Registration Flow

```
┌─────────────┐   POST /displays-module/register    ┌──────────────────┐
│ Panel App   │ ──────────────────────────────────▶ │ Displays Module  │
│             │   User-Agent: FlutterApp/...        │                  │
│             │   Body: { uid, mac, version,        │  1. Validate UA  │
│             │          build, screen_width, ... } │  2. Create/Update│
└─────────────┘                                     │     Display      │
       ▲                                            │  3. Gen Token    │
       │                                            └────────┬─────────┘
       │                                                     │
       │        { display, access_token }                    │
       └─────────────────────────────────────────────────────┘

Token stored in auth_module_tokens:
  - ownerType: 'display'
  - displayId: <display.id>
  - userId: null
  - name: 'Display <uid>'
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
├── guards/
│   └── display-access.guard.ts         # Display-specific auth checks
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

### Phase 1: Update Auth Module

#### 1.1 Add Token Owner Type (`auth.constants.ts`)

```typescript
export enum TokenOwnerType {
  USER = 'user',
  DISPLAY = 'display',
  THIRD_PARTY = 'third_party',
}
```

#### 1.2 Update LongLiveTokenEntity (`entities/auth.entity.ts`)

```typescript
@ApiSchema({ name: 'AuthModuleDataLongLiveToken' })
@ChildEntity()
export class LongLiveTokenEntity extends TokenEntity {
  @ApiProperty({
    name: 'owner_type',
    description: 'Type of token owner',
    enum: TokenOwnerType,
    example: TokenOwnerType.USER,
  })
  @Expose({ name: 'owner_type' })
  @IsEnum(TokenOwnerType)
  @Column({ type: 'varchar', default: TokenOwnerType.USER })
  ownerType: TokenOwnerType;

  @ApiProperty({
    name: 'user_id',
    description: 'Owner user ID (if owner_type is user or for revocation)',
    type: 'string',
    format: 'uuid',
    nullable: true,
  })
  @Expose({ name: 'user_id' })
  @IsOptional()
  @Type(() => UserEntity)
  @Transform(({ value }: { value: UserEntity | string | null }) => 
    typeof value === 'string' ? value : value?.id ?? null, { toPlainOnly: true })
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: true })
  owner: UserEntity | null;

  @ApiProperty({
    name: 'display_id',
    description: 'Display ID (if owner_type is display)',
    type: 'string',
    format: 'uuid',
    nullable: true,
  })
  @Expose({ name: 'display_id' })
  @IsOptional()
  @IsUUID('4')
  @Column({ type: 'uuid', nullable: true })
  displayId: string | null;

  @ApiProperty({
    description: 'Token name',
    type: 'string',
    example: 'My API Token',
  })
  @Expose()
  @IsNotEmpty()
  @IsString()
  @Column()
  name: string;

  @ApiProperty({
    description: 'Token description',
    type: 'string',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsString()
  @Column({ nullable: true })
  description: string | null;

  get type(): TokenType {
    return TokenType.LONG_LIVE;
  }
}
```

#### 1.3 Update Auth Guard (`guards/auth.guard.ts`)

```typescript
// Add new authenticated request types
export interface AuthenticatedUser {
  type: 'user';
  id: string;
  role: UserRole;
}

export interface AuthenticatedDisplay {
  type: 'display';
  id: string;
}

export type AuthenticatedEntity = AuthenticatedUser | AuthenticatedDisplay;

export interface AuthenticatedRequest extends Request {
  auth?: AuthenticatedEntity;
}

// In AuthGuard.canActivate():
private async validateLongLiveToken(token: string): Promise<AuthenticatedEntity | null> {
  const tokenEntity = await this.tokensService.findByToken<LongLiveTokenEntity>(
    token, 
    LongLiveTokenEntity
  );

  if (!tokenEntity || tokenEntity.revoked) {
    return null;
  }

  if (tokenEntity.ownerType === TokenOwnerType.DISPLAY && tokenEntity.displayId) {
    return {
      type: 'display',
      id: tokenEntity.displayId,
    };
  }

  if (tokenEntity.ownerType === TokenOwnerType.USER && tokenEntity.owner) {
    return {
      type: 'user',
      id: tokenEntity.owner.id,
      role: tokenEntity.owner.role,
    };
  }

  return null;
}
```

#### 1.4 Remove Display Registration from Auth

Remove from `auth.controller.ts`:
- `registerDisplay()` method
- Related imports and dependencies

### Phase 2: Update Users Module

#### 2.1 Remove DISPLAY Role (`users.constants.ts`)

```typescript
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  USER = 'user',
  // DISPLAY removed!
}
```

#### 2.2 Update User Entity Documentation

```typescript
@ApiProperty({
  description: "User role: 'owner' has full access, 'admin' can manage users, 'user' has limited access.",
  enum: UserRole,
  default: UserRole.USER,
})
```

#### 2.3 Remove Display-Related Code
- Remove `DisplayInstanceEntity` from `users.entity.ts`
- Remove `DisplaysInstancesService`
- Remove `DisplaysInstancesController`
- Remove display-related DTOs
- Remove `SystemDisplayEntitySubscriber`
- Update `ModuleResetService` to not reference displays

### Phase 3: Update System Module

- Remove `DisplayProfileEntity` from `system.entity.ts`
- Remove `DisplaysProfilesService`
- Remove `DisplaysProfilesController`
- Remove display-related DTOs and validators
- Update `ModuleResetService`

### Phase 4: Create Displays Module

#### 4.1 Constants (`displays.constants.ts`)

```typescript
export const DISPLAYS_MODULE_PREFIX = 'displays-module';
export const DISPLAYS_MODULE_NAME = 'displays-module';
export const DISPLAYS_MODULE_API_TAG_NAME = 'Displays module';
export const DISPLAYS_MODULE_API_TAG_DESCRIPTION = 
  'Endpoints for managing display devices, their configuration, and registration.';

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

#### 4.2 Entity (`entities/displays.entity.ts`)

```typescript
import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsString, IsUUID, Max, Min } from 'class-validator';
import { Column, Entity } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';

@ApiSchema({ name: 'DisplaysModuleDataDisplay' })
@Entity('displays_module_displays')
export class DisplayEntity extends BaseEntity {
  // === Identity ===
  
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
    description: 'MAC address of the device',
    type: 'string',
    example: '00:1A:2B:3C:4D:5E',
  })
  @Expose()
  @IsString()
  @Column({ nullable: false })
  mac: string;

  // === Software Info ===

  @ApiProperty({
    description: 'Application version',
    type: 'string',
    example: '1.0.0',
  })
  @Expose()
  @IsString()
  @Column({ nullable: false })
  version: string;

  @ApiProperty({
    description: 'Build identifier',
    type: 'string',
    example: '42',
  })
  @Expose()
  @IsString()
  @Column({ nullable: false })
  build: string;

  // === Screen Configuration ===

  @ApiPropertyOptional({
    name: 'screen_width',
    description: 'Screen width in pixels',
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
    description: 'Screen height in pixels',
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
    description: 'Pixel ratio',
    type: 'number',
    nullable: true,
    example: 1.5,
  })
  @Expose({ name: 'pixel_ratio' })
  @IsNumber()
  @Column({ type: 'float', nullable: true })
  pixelRatio: number | null;

  // === Grid Configuration ===

  @ApiPropertyOptional({
    name: 'unit_size',
    description: 'Grid unit size',
    type: 'number',
    nullable: true,
    example: 8,
  })
  @Expose({ name: 'unit_size' })
  @IsNumber()
  @Column({ type: 'float', nullable: true })
  unitSize: number | null;

  @ApiPropertyOptional({
    description: 'Number of rows',
    type: 'integer',
    nullable: true,
    example: 12,
  })
  @Expose()
  @IsInt()
  @Column({ type: 'int', nullable: true })
  rows: number | null;

  @ApiPropertyOptional({
    description: 'Number of columns',
    type: 'integer',
    nullable: true,
    example: 24,
  })
  @Expose()
  @IsInt()
  @Column({ type: 'int', nullable: true })
  cols: number | null;

  @ApiProperty({
    description: 'Primary display flag',
    type: 'boolean',
    default: false,
  })
  @Expose()
  @IsBoolean()
  @Column({ type: 'boolean', default: false })
  primary: boolean;

  // === Display Settings (from config module) ===

  @ApiProperty({
    name: 'dark_mode',
    description: 'Dark mode enabled',
    type: 'boolean',
    default: false,
  })
  @Expose({ name: 'dark_mode' })
  @IsBoolean()
  @Column({ type: 'boolean', default: false })
  darkMode: boolean;

  @ApiProperty({
    description: 'Display brightness (0-100)',
    type: 'integer',
    minimum: 0,
    maximum: 100,
    default: 100,
  })
  @Expose()
  @IsInt()
  @Min(0)
  @Max(100)
  @Column({ type: 'int', default: 100 })
  brightness: number;

  @ApiProperty({
    name: 'screen_lock_duration',
    description: 'Screen lock duration in seconds (0-3600)',
    type: 'integer',
    minimum: 0,
    maximum: 3600,
    default: 30,
  })
  @Expose({ name: 'screen_lock_duration' })
  @IsInt()
  @Min(0)
  @Max(3600)
  @Column({ type: 'int', default: 30 })
  screenLockDuration: number;

  @ApiProperty({
    name: 'screen_saver',
    description: 'Screen saver enabled',
    type: 'boolean',
    default: true,
  })
  @Expose({ name: 'screen_saver' })
  @IsBoolean()
  @Column({ type: 'boolean', default: true })
  screenSaver: boolean;

  // === Activity ===

  @ApiPropertyOptional({
    name: 'last_seen_at',
    description: 'Last activity timestamp',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  @Expose({ name: 'last_seen_at' })
  @Transform(({ value }: { value: Date | null }) => value?.toISOString() ?? null, { toPlainOnly: true })
  @Column({ type: 'datetime', nullable: true })
  lastSeenAt: Date | null;
}
```

#### 4.3 Registration Service (`services/registration.service.ts`)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { TokensService } from '../../auth/services/tokens.service';
import { TokenOwnerType, TokenType } from '../../auth/auth.constants';
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

    // 1. Find or create display
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
        lastSeenAt: new Date(),
      });
    }

    // 2. Generate or retrieve long-lived token
    const accessToken = await this.getOrCreateDisplayToken(display);

    this.logger.debug(`[REGISTER] Successfully registered display uid=${dto.uid}`);

    this.eventEmitter.emit(
      isNewDisplay ? EventType.DISPLAY_CREATED : EventType.DISPLAY_REGISTERED,
      display,
    );

    return { display, accessToken };
  }

  private async getOrCreateDisplayToken(display: DisplayEntity): Promise<string> {
    // Check if display already has a valid token
    const existingToken = await this.tokensService.findByDisplayId(display.id);
    
    if (existingToken && !existingToken.revoked) {
      // Return existing token (re-registration scenario)
      // Note: We can't return the actual token value since it's hashed
      // So we generate a new one
      await this.tokensService.remove(existingToken.id);
    }

    // Generate new long-lived token
    const payload = {
      sub: display.id,
      type: 'display',
      iat: Math.floor(Date.now() / 1000),
    };

    // 10 years expiration (effectively permanent)
    const token = this.jwtService.sign(payload, { expiresIn: '3650d' });

    try {
      await this.tokensService.create<LongLiveTokenEntity, CreateLongLiveTokenDto>({
        token,
        type: TokenType.LONG_LIVE,
        ownerType: TokenOwnerType.DISPLAY,
        displayId: display.id,
        owner: null,  // No user owner
        name: `Display ${display.uid}`,
        description: `Auto-generated token for display ${display.uid}`,
        expiresAt: null,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error('[REGISTER] Failed to create display token', { 
        message: err.message, 
        stack: err.stack,
      });
      throw new DisplaysRegistrationException('Failed to generate access token');
    }

    return token;
  }
}
```

#### 4.4 Display Access Guard (`guards/display-access.guard.ts`)

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';

export const DISPLAY_ACCESS_KEY = 'displayAccess';

export const DisplayAccess = () => SetMetadata(DISPLAY_ACCESS_KEY, true);

@Injectable()
export class DisplayAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresDisplayAccess = this.reflector.getAllAndOverride<boolean>(
      DISPLAY_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresDisplayAccess) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;

    // Allow if authenticated as display
    if (auth?.type === 'display') {
      return true;
    }

    // Allow if authenticated as user with owner/admin role
    if (auth?.type === 'user' && ['owner', 'admin'].includes(auth.role)) {
      return true;
    }

    return false;
  }
}
```

### Phase 5: Token Management Endpoints

Add endpoints for users to manage display tokens:

```typescript
// In auth module: controllers/tokens.controller.ts

@ApiOperation({
  summary: 'List display tokens',
  description: 'List all tokens for display devices (owner/admin only)',
})
@Get('display-tokens')
@Roles(UserRole.OWNER, UserRole.ADMIN)
async listDisplayTokens(): Promise<DisplayTokensResponseModel> {
  const tokens = await this.tokensService.findAllByOwnerType(TokenOwnerType.DISPLAY);
  // Return tokens (without actual token values, just metadata)
}

@ApiOperation({
  summary: 'Revoke display token',
  description: 'Revoke a display token if compromised',
})
@Delete('display-tokens/:id')
@Roles(UserRole.OWNER, UserRole.ADMIN)
async revokeDisplayToken(@Param('id') id: string): Promise<void> {
  await this.tokensService.revoke(id);
}
```

### Phase 6: Update Config Module

Remove display section from config:

```typescript
// config.constants.ts
export enum SectionType {
  AUDIO = 'audio',
  // DISPLAY = 'display',  // REMOVED
  LANGUAGE = 'language',
  WEATHER = 'weather',
  SYSTEM = 'system',
}

// config.model.ts
// Remove DisplayConfigModel class
// Update AppConfigModel to remove display property
```

### Phase 7: Update WebSocket Module

```typescript
// websocket/services/ws-auth.service.ts
async authenticateClient(client: Socket): Promise<boolean> {
  const token = this.extractToken(client);
  
  if (!token) {
    return false;
  }

  // Try to validate as long-lived token (display)
  const displayAuth = await this.validateDisplayToken(token);
  if (displayAuth) {
    client.data.auth = { type: 'display', id: displayAuth.displayId };
    return true;
  }

  // Try to validate as access token (user)
  const userAuth = await this.validateAccessToken(token);
  if (userAuth) {
    client.data.auth = { type: 'user', id: userAuth.userId, role: userAuth.role };
    return true;
  }

  return false;
}
```

### Phase 8: Update Dependent Modules

#### Dashboard Module
- Update `display` foreign key to reference new `DisplayEntity`
- Update imports

#### Devices Module
- Update `property-command.service.ts` to check for display auth type instead of role

---

## API Endpoints Summary

### Displays Module

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/displays-module/register` | Register & get token | Public (UA validated) |
| GET | `/displays-module/displays` | List all displays | User (owner/admin) |
| GET | `/displays-module/displays/:id` | Get by ID | Any authenticated |
| GET | `/displays-module/displays/by-uid/:uid` | Get by UID | Any authenticated |
| PATCH | `/displays-module/displays/:id` | Update config | Display (self) or User (owner) |
| DELETE | `/displays-module/displays/:id` | Remove display | User (owner/admin) |

### Auth Module (New/Updated)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/auth-module/tokens/displays` | List display tokens | User (owner/admin) |
| DELETE | `/auth-module/tokens/displays/:id` | Revoke display token | User (owner/admin) |

### Deprecated Endpoints

| Method | Path | Status |
|--------|------|--------|
| POST | `/auth-module/auth/register-display` | REMOVED |
| * | `/users-module/displays-instances/*` | REMOVED |
| * | `/system-module/displays-profiles/*` | REMOVED |
| GET/PATCH | `/config-module/config/display` | REMOVED |

---

## Database Migration

```typescript
export class ConsolidateDisplaysModule implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create new displays table
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
        "darkMode" boolean DEFAULT false,
        "brightness" int DEFAULT 100,
        "screenLockDuration" int DEFAULT 30,
        "screenSaver" boolean DEFAULT true,
        "lastSeenAt" datetime,
        "createdAt" datetime DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" datetime
      )
    `);

    // 2. Add columns to auth_module_tokens for display ownership
    await queryRunner.query(`
      ALTER TABLE "auth_module_tokens" 
      ADD COLUMN "ownerType" varchar DEFAULT 'user',
      ADD COLUMN "displayId" uuid
    `);

    // 3. Migrate existing data (if any)
    // ... data migration logic

    // 4. Update foreign keys in dashboard_module_pages
    // ... update display references

    // 5. Remove DISPLAY from users role enum
    // ... update check constraint

    // 6. Drop old tables
    await queryRunner.query(`DROP TABLE IF EXISTS "users_module_displays_instances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_module_displays_profiles"`);
  }
}
```

---

## Success Criteria

1. ✅ `DisplayEntity` is standalone (no user relation)
2. ✅ `UserRole.DISPLAY` removed from users module
3. ✅ Auth module supports multiple token owner types
4. ✅ Display registration returns long-lived token
5. ✅ Users can view/revoke display tokens
6. ✅ Display settings in entity (not config file)
7. ✅ WebSocket auth works for displays
8. ✅ All tests passing
9. ✅ Database migration successful

---

## Estimated Effort

| Phase | Time |
|-------|------|
| Auth Module Updates | 3-4 hours |
| Users Module Cleanup | 2-3 hours |
| System Module Cleanup | 1-2 hours |
| Displays Module Creation | 4-5 hours |
| Token Management Endpoints | 2-3 hours |
| Config Module Updates | 1 hour |
| WebSocket Updates | 2-3 hours |
| Dependent Module Updates | 2-3 hours |
| Database Migration | 2-3 hours |
| Testing | 4-5 hours |
| **Total** | **24-32 hours** |
