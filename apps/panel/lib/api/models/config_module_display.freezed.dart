// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_display.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleDisplay _$ConfigModuleDisplayFromJson(Map<String, dynamic> json) {
  return _ConfigModuleDisplay.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleDisplay {
  /// Configuration section type
  ConfigModuleDisplayType get type => throw _privateConstructorUsedError;

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

  /// Serializes this ConfigModuleDisplay to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleDisplay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleDisplayCopyWith<ConfigModuleDisplay> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleDisplayCopyWith<$Res> {
  factory $ConfigModuleDisplayCopyWith(
          ConfigModuleDisplay value, $Res Function(ConfigModuleDisplay) then) =
      _$ConfigModuleDisplayCopyWithImpl<$Res, ConfigModuleDisplay>;
  @useResult
  $Res call(
      {ConfigModuleDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class _$ConfigModuleDisplayCopyWithImpl<$Res, $Val extends ConfigModuleDisplay>
    implements $ConfigModuleDisplayCopyWith<$Res> {
  _$ConfigModuleDisplayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleDisplay
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
              as ConfigModuleDisplayType,
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
abstract class _$$ConfigModuleDisplayImplCopyWith<$Res>
    implements $ConfigModuleDisplayCopyWith<$Res> {
  factory _$$ConfigModuleDisplayImplCopyWith(_$ConfigModuleDisplayImpl value,
          $Res Function(_$ConfigModuleDisplayImpl) then) =
      __$$ConfigModuleDisplayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigModuleDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class __$$ConfigModuleDisplayImplCopyWithImpl<$Res>
    extends _$ConfigModuleDisplayCopyWithImpl<$Res, _$ConfigModuleDisplayImpl>
    implements _$$ConfigModuleDisplayImplCopyWith<$Res> {
  __$$ConfigModuleDisplayImplCopyWithImpl(_$ConfigModuleDisplayImpl _value,
      $Res Function(_$ConfigModuleDisplayImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleDisplay
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
    return _then(_$ConfigModuleDisplayImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleDisplayType,
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
class _$ConfigModuleDisplayImpl implements _ConfigModuleDisplay {
  const _$ConfigModuleDisplayImpl(
      {this.type = ConfigModuleDisplayType.display,
      @JsonKey(name: 'dark_mode') this.darkMode = false,
      this.brightness = 0,
      @JsonKey(name: 'screen_lock_duration') this.screenLockDuration = 30,
      @JsonKey(name: 'screen_saver') this.screenSaver = true});

  factory _$ConfigModuleDisplayImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigModuleDisplayImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigModuleDisplayType type;

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
    return 'ConfigModuleDisplay(type: $type, darkMode: $darkMode, brightness: $brightness, screenLockDuration: $screenLockDuration, screenSaver: $screenSaver)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleDisplayImpl &&
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

  /// Create a copy of ConfigModuleDisplay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleDisplayImplCopyWith<_$ConfigModuleDisplayImpl> get copyWith =>
      __$$ConfigModuleDisplayImplCopyWithImpl<_$ConfigModuleDisplayImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleDisplayImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleDisplay implements ConfigModuleDisplay {
  const factory _ConfigModuleDisplay(
          {final ConfigModuleDisplayType type,
          @JsonKey(name: 'dark_mode') final bool darkMode,
          final int brightness,
          @JsonKey(name: 'screen_lock_duration') final int screenLockDuration,
          @JsonKey(name: 'screen_saver') final bool screenSaver}) =
      _$ConfigModuleDisplayImpl;

  factory _ConfigModuleDisplay.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleDisplayImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleDisplayType get type;

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

  /// Create a copy of ConfigModuleDisplay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleDisplayImplCopyWith<_$ConfigModuleDisplayImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
