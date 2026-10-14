import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

/// Uses the exposed native contract, including decimal grids with a nonzero origin.
class LightGroupNumericContract {
  final double min;
  final double max;
  final double? step;
  final bool integer;
  const LightGroupNumericContract(this.min, this.max, this.step, this.integer);

  static LightGroupNumericContract? fromProperty(ChannelPropertyView property) {
    if (!property.permission.contains(DevicesModulePermissionType.rw)) {
      return null;
    }
    final format = property.format;
    if (format is! NumberListFormatType || format.value.length != 2) {
      return null;
    }
    final min = format.value[0];
    final max = format.value[1];
    final declaredStep = property.step;
    final datatype = property.dataType;
    final integer = [
      DevicesModuleDataType.char,
      DevicesModuleDataType.uchar,
      DevicesModuleDataType.short,
      DevicesModuleDataType.ushort,
      DevicesModuleDataType.valueInt,
      DevicesModuleDataType.uint,
    ].contains(datatype);
    if (!integer && datatype != DevicesModuleDataType.float) return null;
    final step = declaredStep ?? (integer ? 1.0 : null);
    if (min is! num ||
        max is! num ||
        !min.isFinite ||
        !max.isFinite ||
        min > max ||
        (step != null && (!step.isFinite || step <= 0)) ||
        (integer &&
            (min != min.roundToDouble() ||
                (step != null && step != step.roundToDouble())))) {
      return null;
    }
    if ([min.toDouble(), max.toDouble(), if (step != null) step].any(
      (value) => (value * 1000000 - (value * 1000000).round()).abs() > 0.000001,
    )) {
      return null;
    }
    return LightGroupNumericContract(
      min.toDouble(),
      max.toDouble(),
      step,
      integer,
    );
  }

  num? target(String text) {
    final value = double.tryParse(text);
    if (value == null || !value.isFinite || value < min || value > max) {
      return null;
    }
    final grid = step;
    final snapped = grid == null
        ? value
        : double.parse(
            (min + ((value - min) / grid).round() * grid).toStringAsFixed(6),
          );
    if (snapped < min || snapped > max) return null;
    return integer ? snapped.toInt() : snapped;
  }
}

/// A tuple is submitted together or refused before transport; missing fields never borrow feedback.
List<PropertyCommandItem>? lightGroupNumericTargets({
  required String deviceId,
  required String channelId,
  required List<ChannelPropertyView> properties,
  required Map<String, String> requested,
}) {
  final categories = properties
      .map((property) => property.category.json)
      .toSet();
  for (final tuple in [
    const {'color_red', 'color_green', 'color_blue'},
    const {'hue', 'saturation'},
  ]) {
    if (categories.intersection(tuple).isNotEmpty &&
        !categories.containsAll(tuple)) {
      return null;
    }
  }
  final targets = <PropertyCommandItem>[];
  for (final property in properties) {
    final value = LightGroupNumericContract.fromProperty(
      property,
    )?.target(requested[property.id] ?? '');
    if (value == null) return null;
    targets.add(
      PropertyCommandItem(
        deviceId: deviceId,
        channelId: channelId,
        propertyId: property.id,
        value: value,
      ),
    );
  }
  return targets.isEmpty ? null : targets;
}
