import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/units.dart';

class ThermostatChannelView extends ChannelView with ChannelActiveMixin {
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

  @override
  ActiveChannelPropertyView get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().first;

  ModeChannelPropertyView get modeProp =>
      properties.whereType<ModeChannelPropertyView>().first;

  LockedChannelPropertyView? get lockedProp =>
      properties.whereType<LockedChannelPropertyView>().firstOrNull;

  UnitsChannelPropertyView? get unitsProp =>
      properties.whereType<UnitsChannelPropertyView>().firstOrNull;

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
    final LockedChannelPropertyView? prop = lockedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }
}
