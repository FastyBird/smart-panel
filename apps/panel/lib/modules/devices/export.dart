// Mappers
export 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart' show buildChannelIcon;

// Repositories
export 'package:fastybird_smart_panel/modules/devices/repositories/channel_controls.dart';
export 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
export 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
export 'package:fastybird_smart_panel/modules/devices/repositories/device_controls.dart';
export 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
export 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';

// Types (now using generated API enums)
export 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
export 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
export 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
export 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
export 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';

// Views
export 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
export 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
export 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

// Service
export 'package:fastybird_smart_panel/modules/devices/service.dart';

// Intent overlay
export 'package:fastybird_smart_panel/modules/devices/models/intent_overlay.dart';
export 'package:fastybird_smart_panel/modules/devices/services/intent_overlay_service.dart';

// Role control state cache
export 'package:fastybird_smart_panel/modules/devices/services/role_control_state_repository.dart';

// Time series
export 'package:fastybird_smart_panel/modules/devices/services/property_timeseries.dart';

// Device control state (optimistic UI)
export 'package:fastybird_smart_panel/modules/devices/types/control_ui_state.dart';
export 'package:fastybird_smart_panel/modules/devices/models/control_state.dart';
export 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';

// Controllers (optimistic UI wrappers)
export 'package:fastybird_smart_panel/modules/devices/controllers/export.dart';

// Device details
export 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_dehumidifier.dart';
export 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_humidifier.dart';
export 'package:fastybird_smart_panel/modules/devices/presentation/device_details/air_purifier.dart';
export 'package:fastybird_smart_panel/modules/devices/presentation/device_details/fan.dart';

// Widgets
export 'package:fastybird_smart_panel/modules/devices/presentation/widgets/export.dart';
