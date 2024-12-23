import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum DataTypeType {
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

  const DataTypeType(this.value);

  static final utils = StringEnumUtils(
    DataTypeType.values,
    (DataTypeType payload) => payload.value,
  );

  static DataTypeType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
