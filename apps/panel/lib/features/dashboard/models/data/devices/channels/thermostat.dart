import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class ThermostatChannelDataModel extends ChannelDataModel
    with ChannelActiveMixin {
  ThermostatChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.thermostat,
        );

  @override
  ChannelPropertyDataModel get activeProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.active,
      );

  ChannelPropertyDataModel get modeProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.mode,
      );

  ChannelPropertyDataModel? get lockedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.locked,
      );

  ChannelPropertyDataModel? get unitsProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.units,
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
    final ChannelPropertyDataModel? prop = lockedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }

  factory ThermostatChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return ThermostatChannelDataModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      device: json['device'],
      properties: properties,
      controls: controls,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}
