import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class ThermostatChannelCapability extends Capability
    with ChannelActiveMixin {
  ThermostatChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get activeProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.active,
      );

  ChannelPropertyModel get modeProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.mode,
      );

  ChannelPropertyModel? get lockedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.locked,
      );

  ChannelPropertyModel? get unitsProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.units,
      );

  ThermostatModeValue get mode {
    final ValueType? value = modeProp.value;

    if (value is StringValueType && ThermostatModeValue.contains(value.value)) {
      ThermostatModeValue? mode = ThermostatModeValue.fromValue(value.value);

      if (mode != null) {
        return mode;
      }
    }

    return ThermostatModeValue.auto;
  }

  List<ThermostatModeValue> get availableModes {
    final FormatType? format = modeProp.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => ThermostatModeValue.fromValue(item))
          .whereType<ThermostatModeValue>()
          .toList();
    }

    return [ThermostatModeValue.manual];
  }

  bool get showInCelsius {
    final ValueType? value = unitsProp?.value;

    if (value is StringValueType) {
      return value.value == ThermostatUnitsValue.celsius.value;
    }

    return false;
  }

  bool get showInFahrenheit {
    final ValueType? value = unitsProp?.value;

    if (value is StringValueType) {
      return value.value == ThermostatUnitsValue.fahrenheit.value;
    }

    return false;
  }

  bool get isLocked {
    final ChannelPropertyModel? prop = lockedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }
}
