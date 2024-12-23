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
  enumerated('enum'),
  date('date'),
  time('time'),
  datetime('datetime'),
  color('color'),
  button('button'),
  switcher('switcher'),
  cover('cover'),
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

enum ShortDataTypeType {
  char('i8'),
  uchar('u8'),
  short('i16'),
  ushort('u16'),
  int('i32'),
  uint('u32'),
  float('f'),
  boolean('b'),
  string('s'),
  enumerated('e'),
  date('d'),
  time('t'),
  datetime('dt'),
  color('clr'),
  button('btn'),
  switcher('sw'),
  cover('cvr'),
  unknown('unk');

  final String value;

  const ShortDataTypeType(this.value);

  static final utils = StringEnumUtils(
    ShortDataTypeType.values,
    (ShortDataTypeType payload) => payload.value,
  );

  static ShortDataTypeType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
