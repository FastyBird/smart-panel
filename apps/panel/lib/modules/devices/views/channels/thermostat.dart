import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';

/// Thermostat channel view - simplified to only contain locked property.
/// Mode and active state are now derived from heater/cooler channels.
class ThermostatChannelView extends ChannelView {
  ThermostatChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    super.parent,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  LockedChannelPropertyView? get lockedProp =>
      properties.whereType<LockedChannelPropertyView>().firstOrNull;

  bool get isLocked {
    final LockedChannelPropertyView? prop = lockedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }
}
