import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/density.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/level.dart';

class IlluminanceChannelView extends ChannelView
    with ChannelDensityMixin, ChannelActiveMixin, ChannelFaultMixin {
  IlluminanceChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  @override
  DensityChannelPropertyView? get densityProp =>
      properties.whereType<DensityChannelPropertyView>().firstOrNull;

  LevelChannelPropertyView? get levelProp =>
      properties.whereType<LevelChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  bool get hasLevel => levelProp != null;

  IlluminanceLevelValue? get level {
    final LevelChannelPropertyView? prop = levelProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        IlluminanceLevelValue.contains(value.value)) {
      return IlluminanceLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        IlluminanceLevelValue.contains(defaultValue.value)) {
      return IlluminanceLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<IlluminanceLevelValue> get availableLevels {
    final LevelChannelPropertyView? prop = levelProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => IlluminanceLevelValue.fromValue(item))
          .whereType<IlluminanceLevelValue>()
          .toList();
    }

    return [];
  }
}
