import 'dart:math';

import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/data_types.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class ValueUtils {
  static String? formatValue(ChannelPropertyDataModel property, [int? scale]) {
    final ValueType? value = property.value;
    final InvalidValueType? invalid = property.invalid;

    if (value is BooleanValueType) {
      return _formatBoolean(value);
    } else if (value is StringValueType) {
      return _formatString(value);
    } else if (value is NumberValueType) {
      return _formatNumber(
        value: value,
        dataType: property.dataType,
        format: property.format,
        invalid: invalid,
        scale: scale,
      );
    }

    return null;
  }

  static String _formatBoolean(BooleanValueType value) {
    return value.value ? 'true' : 'false';
  }

  static String _formatString(StringValueType value) {
    return value.value;
  }

  static String? _formatNumber({
    required NumberValueType value,
    required DataTypeType dataType,
    required FormatType? format,
    required InvalidValueType? invalid,
    int? scale,
  }) {
    final double numValue = value.value.toDouble();

    if (_isIntegerType(dataType)) {
      return _validateAndFormatInt(
        numValue: numValue,
        format: format,
        invalid: invalid,
      );
    }

    if (format is NumberListFormatType && !_isInRange(numValue, format)) {
      return _handleInvalidValue(invalid, scale);
    }

    return scale != null
        ? roundToScale(numValue, scale).toString()
        : numValue.toString();
  }

  static bool _isIntegerType(DataTypeType dataType) {
    return [
      DataTypeType.char,
      DataTypeType.uchar,
      DataTypeType.short,
      DataTypeType.ushort,
      DataTypeType.int,
      DataTypeType.uint
    ].contains(dataType);
  }

  static String? _validateAndFormatInt({
    required double numValue,
    required FormatType? format,
    required InvalidValueType? invalid,
  }) {
    if (format is NumberListFormatType && !_isInRange(numValue, format)) {
      return _handleInvalidValue(invalid);
    }
    return numValue.toInt().toString();
  }

  static bool _isInRange(double value, NumberListFormatType format) {
    final List<dynamic> range = format.value;

    return (range[0] == null || value >= range[0]!) &&
        (range[1] == null || value <= range[1]!);
  }

  static String? _handleInvalidValue(InvalidValueType? invalid, [int? scale]) {
    if (invalid is StringInvalidValueType) {
      return invalid.value;
    } else if (invalid is NumberInvalidValueType) {
      return scale != null
          ? roundToScale(invalid.value.toDouble(), scale).toString()
          : invalid.value.toDouble().toString();
    } else if (invalid is BooleanInvalidValueType) {
      return invalid.value ? 'true' : 'false';
    }

    return null;
  }

  static double roundToScale(double value, int scale) {
    final double factor = pow(10, scale).toDouble();
    return (value * factor).round() / factor;
  }
}
