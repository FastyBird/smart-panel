abstract class InvalidValueType {
  factory InvalidValueType.fromJson(dynamic json) {
    if (json is num) {
      return NumberInvalidValueType(json);
    } else if (json is bool) {
      return BooleanInvalidValueType(json);
    } else if (json is String) {
      // Try to parse string as number first (API sometimes returns numeric values as strings)
      final numValue = num.tryParse(json);
      if (numValue != null) {
        return NumberInvalidValueType(numValue);
      }
      // Try to parse as boolean
      if (json.toLowerCase() == 'true') {
        return BooleanInvalidValueType(true);
      }
      if (json.toLowerCase() == 'false') {
        return BooleanInvalidValueType(false);
      }
      return StringInvalidValueType(json);
    }

    throw Exception('Invalid invalid value type: ${json.runtimeType}');
  }

  dynamic get value;
}

class StringInvalidValueType implements InvalidValueType {
  @override
  final String value;

  StringInvalidValueType(this.value);
}

class NumberInvalidValueType implements InvalidValueType {
  @override
  final num value;

  NumberInvalidValueType(this.value);
}

class BooleanInvalidValueType implements InvalidValueType {
  @override
  final bool value;

  BooleanInvalidValueType(this.value);
}

abstract class ValueType {
  factory ValueType.fromJson(dynamic json) {
    if (json is num) {
      return NumberValueType(json);
    } else if (json is bool) {
      return BooleanValueType(json);
    } else if (json is String) {
      // Try to parse string as number first (API sometimes returns numeric values as strings)
      final numValue = num.tryParse(json);
      if (numValue != null) {
        return NumberValueType(numValue);
      }
      // Try to parse as boolean
      if (json.toLowerCase() == 'true') {
        return BooleanValueType(true);
      }
      if (json.toLowerCase() == 'false') {
        return BooleanValueType(false);
      }
      return StringValueType(json);
    }

    throw Exception('Default invalid value type: ${json.runtimeType}');
  }

  dynamic get value;
}

class StringValueType implements ValueType {
  @override
  final String value;

  StringValueType(this.value);
}

class NumberValueType implements ValueType {
  @override
  final num value;

  NumberValueType(this.value);
}

class BooleanValueType implements ValueType {
  @override
  final bool value;

  BooleanValueType(this.value);
}
