# Modules Structure Convention

Each module in the `modules/` folder should follow this standardized structure:

```
modules/<module_name>/
  mappers/           # Converters and builders for transforming types
  models/            # Data classes from API/WebSocket responses
  presentation/      # Visual components (pages, widgets)
  repositories/      # Data management, API calls, storage
  services/          # Business logic, specific jobs for the module
  types/             # Enums, type definitions, value types
  utils/             # Small helpers (converters, validators, formatters)
  views/             # Model representations used by services (optional)
  constants.dart     # Module constants (names, fixed values, timeouts)
  export.dart        # Re-exports for external module consumption
  module.dart        # Module entrypoint for core registration
  service.dart       # Proxy service - single source of truth for other modules
```

## Folder Descriptions

### `mappers/`
Helpers for building view objects, icons, widgets. Converters from one type to another.
```dart
// Example: device_icon_mapper.dart
IconData mapDeviceToIcon(DeviceCategory category) { ... }
Widget buildDeviceWidget(DeviceView device) { ... }
```

### `models/`
Classes defining objects received via API calls or WebSocket exchange. Pure data classes.
```dart
// Example: device_model.dart
class DeviceModel {
  final String id;
  final String name;
  // ... fields matching API response
}
```

### `presentation/`
Visual parts - pages and widgets. Organized by feature or component type.
```dart
presentation/
  pages/              # Full-screen pages
  widgets/            # Reusable widget components
  device_detail.dart  # Or flat structure for smaller modules
```

### `repositories/`
Classes responsible for managing models - storing data received from API, calling API endpoints, caching.
```dart
// Example: device_repository.dart
class DeviceRepository {
  Future<List<DeviceModel>> fetchDevices();
  void storeDevice(DeviceModel device);
  DeviceModel? getDevice(String id);
}
```

### `services/`
Classes for doing specific jobs for the module - business logic, orchestration.
```dart
// Example: device_control_service.dart
class DeviceControlService {
  Future<void> turnOn(String deviceId);
  Future<void> setBrightness(String deviceId, int value);
}
```

### `types/`
Enums and other type definitions for values.
```dart
// Example: device_category.dart
enum DeviceCategory { lighting, climate, media, sensor }
```

### `utils/`
Small helper functions - value converters, rounders, validators, formatters.
```dart
// Example: value_utils.dart
double roundBrightness(double value) { ... }
String formatTemperature(double celsius) { ... }
bool isValidDeviceId(String id) { ... }
```

### `views/` (Optional)
Classes that represent a model, used by services. Consider if these duplicate models.
```dart
// Example: device_view.dart
class DeviceView {
  final DeviceModel _model;
  String get displayName => _model.name ?? 'Unknown';
  bool get isOnline => _model.state == 'online';
}
```

## Root Files

### `constants.dart`
Module-level constants - module name, fixed values, timeouts, default values.
```dart
const String kModuleName = 'devices';
const Duration kControlTimeout = Duration(seconds: 5);
const int kMaxRetries = 3;
```

### `export.dart`
Re-exports public API for other modules. Only export what's needed externally.
```dart
export 'models/device_model.dart';
export 'services/device_service.dart';
export 'types/device_category.dart';
// Don't export internal implementation details
```

### `module.dart`
Module entrypoint for registration in core. Handles dependency injection setup.
```dart
class DevicesModule {
  static void register(GetIt locator) {
    locator.registerSingleton<DeviceRepository>(...);
    locator.registerSingleton<DeviceService>(...);
  }
}
```

### `service.dart`
Proxy service acting as single source of truth for other modules.
```dart
class DevicesService {
  DeviceView? getDevice(String id);
  List<DeviceView> get devicesList;
  Stream<DeviceView> watchDevice(String id);
}
```

## Guidelines

1. **Keep modules self-contained** - minimize cross-module dependencies
2. **Use export.dart** - other modules should only import from export.dart
3. **Presentation stays in presentation/** - no UI code in services or repositories
4. **Models are immutable** - use final fields, create new instances for updates
5. **Services are stateless when possible** - state lives in repositories
6. **Utils are pure functions** - no side effects, easy to test
