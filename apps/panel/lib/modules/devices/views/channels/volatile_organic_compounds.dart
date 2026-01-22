import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/concentration.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class VolatileOrganicCompoundsChannelView extends ChannelView
    with
        ChannelDetectedMixin,
        ChannelConcentrationMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  VolatileOrganicCompoundsChannelView({
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
  ConcentrationChannelPropertyView? get concentrationProp =>
      properties.whereType<ConcentrationChannelPropertyView>().firstOrNull;

  LevelChannelPropertyView? get levelProp =>
      properties.whereType<LevelChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;

  bool get hasLevel => levelProp != null;

  VolatileOrganicCompoundsLevelValue? get level {
    final LevelChannelPropertyView? prop = levelProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        VolatileOrganicCompoundsLevelValue.contains(value.value)) {
      return VolatileOrganicCompoundsLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        VolatileOrganicCompoundsLevelValue.contains(defaultValue.value)) {
      return VolatileOrganicCompoundsLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<VolatileOrganicCompoundsLevelValue> get availableLevels {
    final LevelChannelPropertyView? prop = levelProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => VolatileOrganicCompoundsLevelValue.fromValue(item))
          .whereType<VolatileOrganicCompoundsLevelValue>()
          .toList();
    }

    return [];
  }
}
