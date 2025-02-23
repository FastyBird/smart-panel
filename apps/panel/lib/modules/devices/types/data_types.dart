import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum DataType {
  char('char'),
  uchar('uchar'),
  short('short'),
  ushort('ushort'),
  int('int'),
  uint('uint'),
  float('float'),
  boolean('bool'),
  string('string'),
  enumerate('enum'),
  unknown('unknown');

  final String value;

  const DataType(this.value);

  static final utils = StringEnumUtils(
    DataType.values,
    (DataType payload) => payload.value,
  );

  static DataType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
