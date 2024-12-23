class StringEnumUtils<T extends Enum> {
  final List<T> values;
  final String Function(T) valueExtractor;

  StringEnumUtils(this.values, this.valueExtractor);

  /// Parse a string value into an enum
  T? fromValue(String value) {
    try {
      return values.firstWhere((e) => valueExtractor(e) == value);
    } catch (e) {
      return null;
    }
  }

  /// Check if a value exists in the enum
  bool contains(String value) {
    return values.any((e) => valueExtractor(e) == value);
  }
}

class NumberEnumUtils<T extends Enum> {
  final List<T> values;
  final num Function(T) valueExtractor;

  NumberEnumUtils(this.values, this.valueExtractor);

  /// Parse a string value into an enum
  T? fromValue(num value) {
    try {
      return values.firstWhere((e) => valueExtractor(e) == value);
    } catch (e) {
      return null;
    }
  }

  /// Check if a value exists in the enum
  bool contains(num value) {
    return values.any((e) => valueExtractor(e) == value);
  }
}
