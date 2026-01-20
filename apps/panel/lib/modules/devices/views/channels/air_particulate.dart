import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/density.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class AirParticulateChannelView extends ChannelView
    with
        ChannelDetectedMixin,
        ChannelDensityMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  AirParticulateChannelView({
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
  DetectedChannelPropertyView? get detectedProp =>
      properties.whereType<DetectedChannelPropertyView>().firstOrNull;

  @override
  DensityChannelPropertyView? get densityProp =>
      properties.whereType<DensityChannelPropertyView>().firstOrNull;

  ModeChannelPropertyView? get modeProp =>
      properties.whereType<ModeChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;

  bool get hasMode => modeProp != null;

  AirParticulateModeValue get mode {
    final ModeChannelPropertyView? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        AirParticulateModeValue.contains(value.value)) {
      AirParticulateModeValue? converted =
          AirParticulateModeValue.fromValue(value.value);

      if (converted != null) {
        return converted;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        AirParticulateModeValue.contains(defaultValue.value)) {
      AirParticulateModeValue? converted =
          AirParticulateModeValue.fromValue(defaultValue.value);

      if (converted != null) {
        return converted;
      }
    }

    return AirParticulateModeValue.pm25;
  }

  List<AirParticulateModeValue> get availableModes {
    final ModeChannelPropertyView? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => AirParticulateModeValue.fromValue(item))
          .whereType<AirParticulateModeValue>()
          .toList();
    }

    return [];
  }
}
