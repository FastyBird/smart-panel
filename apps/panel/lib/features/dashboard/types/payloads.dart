import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum ButtonPayloadType {
  pressed('btn_pressed'),
  released('btn_released'),
  clicked('btn_clicked'),
  doubleClicked('btn_double_clicked'),
  tripleClicked('btn_triple_clicked'),
  longClicked('btn_long_clicked'),
  extraLongClicked('btn_extra_long_clicked');

  final String value;

  const ButtonPayloadType(this.value);

  static final utils = StringEnumUtils(
    ButtonPayloadType.values,
    (ButtonPayloadType payload) => payload.value,
  );

  static ButtonPayloadType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum CoverPayloadType {
  open('cover_open'),
  opening('cover_opening'),
  opened('cover_opened'),
  close('cover_close'),
  closing('cover_closing'),
  closed('cover_closed'),
  stop('cover_stop'),
  stopped('cover_stopped'),
  calibrate('cover_calibrate'),
  calibrating('cover_calibrating'),
  lock('cover_lock');

  final String value;

  const CoverPayloadType(this.value);

  static final utils = StringEnumUtils(
    CoverPayloadType.values,
    (CoverPayloadType payload) => payload.value,
  );

  static CoverPayloadType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum SwitcherPayloadType {
  on('switch_on'),
  off('switch_off'),
  toggle('switch_toggle');

  final String value;

  const SwitcherPayloadType(this.value);

  static final utils = StringEnumUtils(
    SwitcherPayloadType.values,
    (SwitcherPayloadType payload) => payload.value,
  );

  static SwitcherPayloadType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
