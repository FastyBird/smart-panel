// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_display.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigDisplay _$ConfigDisplayFromJson(Map<String, dynamic> json) {
  return _ConfigDisplay.fromJson(json);
}

/// @nodoc
mixin _$ConfigDisplay {
  /// Configuration section type
  ConfigDisplayType get type => throw _privateConstructorUsedError;

  /// Enables dark mode for the display.
  @JsonKey(name: 'dark_mode')
  bool get darkMode => throw _privateConstructorUsedError;

  /// Sets the brightness level of the display (0-100).
  int get brightness => throw _privateConstructorUsedError;

  /// Time in seconds before the screen automatically locks.
  @JsonKey(name: 'screen_lock_duration')
  int get screenLockDuration => throw _privateConstructorUsedError;

  /// Enables the screen saver when the device is idle. Value is in seconds.
  @JsonKey(name: 'screen_saver')
  bool get screenSaver => throw _privateConstructorUsedError;

  /// Serializes this ConfigDisplay to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigDisplay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigDisplayCopyWith<ConfigDisplay> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigDisplayCopyWith<$Res> {
  factory $ConfigDisplayCopyWith(
          ConfigDisplay value, $Res Function(ConfigDisplay) then) =
      _$ConfigDisplayCopyWithImpl<$Res, ConfigDisplay>;
  @useResult
  $Res call(
      {ConfigDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class _$ConfigDisplayCopyWithImpl<$Res, $Val extends ConfigDisplay>
    implements $ConfigDisplayCopyWith<$Res> {
  _$ConfigDisplayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigDisplay
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? darkMode = null,
    Object? brightness = null,
    Object? screenLockDuration = null,
    Object? screenSaver = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigDisplayType,
      darkMode: null == darkMode
          ? _value.darkMode
          : darkMode // ignore: cast_nullable_to_non_nullable
              as bool,
      brightness: null == brightness
          ? _value.brightness
          : brightness // ignore: cast_nullable_to_non_nullable
              as int,
      screenLockDuration: null == screenLockDuration
          ? _value.screenLockDuration
          : screenLockDuration // ignore: cast_nullable_to_non_nullable
              as int,
      screenSaver: null == screenSaver
          ? _value.screenSaver
          : screenSaver // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigDisplayImplCopyWith<$Res>
    implements $ConfigDisplayCopyWith<$Res> {
  factory _$$ConfigDisplayImplCopyWith(
          _$ConfigDisplayImpl value, $Res Function(_$ConfigDisplayImpl) then) =
      __$$ConfigDisplayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class __$$ConfigDisplayImplCopyWithImpl<$Res>
    extends _$ConfigDisplayCopyWithImpl<$Res, _$ConfigDisplayImpl>
    implements _$$ConfigDisplayImplCopyWith<$Res> {
  __$$ConfigDisplayImplCopyWithImpl(
      _$ConfigDisplayImpl _value, $Res Function(_$ConfigDisplayImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigDisplay
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? darkMode = null,
    Object? brightness = null,
    Object? screenLockDuration = null,
    Object? screenSaver = null,
  }) {
    return _then(_$ConfigDisplayImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigDisplayType,
      darkMode: null == darkMode
          ? _value.darkMode
          : darkMode // ignore: cast_nullable_to_non_nullable
              as bool,
      brightness: null == brightness
          ? _value.brightness
          : brightness // ignore: cast_nullable_to_non_nullable
              as int,
      screenLockDuration: null == screenLockDuration
          ? _value.screenLockDuration
          : screenLockDuration // ignore: cast_nullable_to_non_nullable
              as int,
      screenSaver: null == screenSaver
          ? _value.screenSaver
          : screenSaver // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigDisplayImpl implements _ConfigDisplay {
  const _$ConfigDisplayImpl(
      {this.type = ConfigDisplayType.display,
      @JsonKey(name: 'dark_mode') this.darkMode = false,
      this.brightness = 0,
      @JsonKey(name: 'screen_lock_duration') this.screenLockDuration = 30,
      @JsonKey(name: 'screen_saver') this.screenSaver = true});

  factory _$ConfigDisplayImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigDisplayImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigDisplayType type;

  /// Enables dark mode for the display.
  @override
  @JsonKey(name: 'dark_mode')
  final bool darkMode;

  /// Sets the brightness level of the display (0-100).
  @override
  @JsonKey()
  final int brightness;

  /// Time in seconds before the screen automatically locks.
  @override
  @JsonKey(name: 'screen_lock_duration')
  final int screenLockDuration;

  /// Enables the screen saver when the device is idle. Value is in seconds.
  @override
  @JsonKey(name: 'screen_saver')
  final bool screenSaver;

  @override
  String toString() {
    return 'ConfigDisplay(type: $type, darkMode: $darkMode, brightness: $brightness, screenLockDuration: $screenLockDuration, screenSaver: $screenSaver)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigDisplayImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.darkMode, darkMode) ||
                other.darkMode == darkMode) &&
            (identical(other.brightness, brightness) ||
                other.brightness == brightness) &&
            (identical(other.screenLockDuration, screenLockDuration) ||
                other.screenLockDuration == screenLockDuration) &&
            (identical(other.screenSaver, screenSaver) ||
                other.screenSaver == screenSaver));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, type, darkMode, brightness, screenLockDuration, screenSaver);

  /// Create a copy of ConfigDisplay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigDisplayImplCopyWith<_$ConfigDisplayImpl> get copyWith =>
      __$$ConfigDisplayImplCopyWithImpl<_$ConfigDisplayImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigDisplayImplToJson(
      this,
    );
  }
}

abstract class _ConfigDisplay implements ConfigDisplay {
  const factory _ConfigDisplay(
          {final ConfigDisplayType type,
          @JsonKey(name: 'dark_mode') final bool darkMode,
          final int brightness,
          @JsonKey(name: 'screen_lock_duration') final int screenLockDuration,
          @JsonKey(name: 'screen_saver') final bool screenSaver}) =
      _$ConfigDisplayImpl;

  factory _ConfigDisplay.fromJson(Map<String, dynamic> json) =
      _$ConfigDisplayImpl.fromJson;

  /// Configuration section type
  @override
  ConfigDisplayType get type;

  /// Enables dark mode for the display.
  @override
  @JsonKey(name: 'dark_mode')
  bool get darkMode;

  /// Sets the brightness level of the display (0-100).
  @override
  int get brightness;

  /// Time in seconds before the screen automatically locks.
  @override
  @JsonKey(name: 'screen_lock_duration')
  int get screenLockDuration;

  /// Enables the screen saver when the device is idle. Value is in seconds.
  @override
  @JsonKey(name: 'screen_saver')
  bool get screenSaver;

  /// Create a copy of ConfigDisplay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigDisplayImplCopyWith<_$ConfigDisplayImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
