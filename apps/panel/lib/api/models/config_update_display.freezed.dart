// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_update_display.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigUpdateDisplay _$ConfigUpdateDisplayFromJson(Map<String, dynamic> json) {
  return _ConfigUpdateDisplay.fromJson(json);
}

/// @nodoc
mixin _$ConfigUpdateDisplay {
  /// Configuration section type
  ConfigUpdateDisplayType get type => throw _privateConstructorUsedError;

  /// Enables or disables dark mode.
  @JsonKey(name: 'dark_mode')
  bool get darkMode => throw _privateConstructorUsedError;

  /// Sets the brightness level (0-100).
  int get brightness => throw _privateConstructorUsedError;

  /// Time in seconds before the screen automatically locks.
  @JsonKey(name: 'screen_lock_duration')
  int get screenLockDuration => throw _privateConstructorUsedError;

  /// Enables or disables the screen saver.
  @JsonKey(name: 'screen_saver')
  bool get screenSaver => throw _privateConstructorUsedError;

  /// Serializes this ConfigUpdateDisplay to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigUpdateDisplay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigUpdateDisplayCopyWith<ConfigUpdateDisplay> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigUpdateDisplayCopyWith<$Res> {
  factory $ConfigUpdateDisplayCopyWith(
          ConfigUpdateDisplay value, $Res Function(ConfigUpdateDisplay) then) =
      _$ConfigUpdateDisplayCopyWithImpl<$Res, ConfigUpdateDisplay>;
  @useResult
  $Res call(
      {ConfigUpdateDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class _$ConfigUpdateDisplayCopyWithImpl<$Res, $Val extends ConfigUpdateDisplay>
    implements $ConfigUpdateDisplayCopyWith<$Res> {
  _$ConfigUpdateDisplayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigUpdateDisplay
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
              as ConfigUpdateDisplayType,
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
abstract class _$$ConfigUpdateDisplayImplCopyWith<$Res>
    implements $ConfigUpdateDisplayCopyWith<$Res> {
  factory _$$ConfigUpdateDisplayImplCopyWith(_$ConfigUpdateDisplayImpl value,
          $Res Function(_$ConfigUpdateDisplayImpl) then) =
      __$$ConfigUpdateDisplayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigUpdateDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class __$$ConfigUpdateDisplayImplCopyWithImpl<$Res>
    extends _$ConfigUpdateDisplayCopyWithImpl<$Res, _$ConfigUpdateDisplayImpl>
    implements _$$ConfigUpdateDisplayImplCopyWith<$Res> {
  __$$ConfigUpdateDisplayImplCopyWithImpl(_$ConfigUpdateDisplayImpl _value,
      $Res Function(_$ConfigUpdateDisplayImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigUpdateDisplay
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
    return _then(_$ConfigUpdateDisplayImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigUpdateDisplayType,
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
class _$ConfigUpdateDisplayImpl implements _ConfigUpdateDisplay {
  const _$ConfigUpdateDisplayImpl(
      {required this.type,
      @JsonKey(name: 'dark_mode') required this.darkMode,
      required this.brightness,
      @JsonKey(name: 'screen_lock_duration') required this.screenLockDuration,
      @JsonKey(name: 'screen_saver') required this.screenSaver});

  factory _$ConfigUpdateDisplayImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigUpdateDisplayImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigUpdateDisplayType type;

  /// Enables or disables dark mode.
  @override
  @JsonKey(name: 'dark_mode')
  final bool darkMode;

  /// Sets the brightness level (0-100).
  @override
  final int brightness;

  /// Time in seconds before the screen automatically locks.
  @override
  @JsonKey(name: 'screen_lock_duration')
  final int screenLockDuration;

  /// Enables or disables the screen saver.
  @override
  @JsonKey(name: 'screen_saver')
  final bool screenSaver;

  @override
  String toString() {
    return 'ConfigUpdateDisplay(type: $type, darkMode: $darkMode, brightness: $brightness, screenLockDuration: $screenLockDuration, screenSaver: $screenSaver)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigUpdateDisplayImpl &&
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

  /// Create a copy of ConfigUpdateDisplay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigUpdateDisplayImplCopyWith<_$ConfigUpdateDisplayImpl> get copyWith =>
      __$$ConfigUpdateDisplayImplCopyWithImpl<_$ConfigUpdateDisplayImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigUpdateDisplayImplToJson(
      this,
    );
  }
}

abstract class _ConfigUpdateDisplay implements ConfigUpdateDisplay {
  const factory _ConfigUpdateDisplay(
          {required final ConfigUpdateDisplayType type,
          @JsonKey(name: 'dark_mode') required final bool darkMode,
          required final int brightness,
          @JsonKey(name: 'screen_lock_duration')
          required final int screenLockDuration,
          @JsonKey(name: 'screen_saver') required final bool screenSaver}) =
      _$ConfigUpdateDisplayImpl;

  factory _ConfigUpdateDisplay.fromJson(Map<String, dynamic> json) =
      _$ConfigUpdateDisplayImpl.fromJson;

  /// Configuration section type
  @override
  ConfigUpdateDisplayType get type;

  /// Enables or disables dark mode.
  @override
  @JsonKey(name: 'dark_mode')
  bool get darkMode;

  /// Sets the brightness level (0-100).
  @override
  int get brightness;

  /// Time in seconds before the screen automatically locks.
  @override
  @JsonKey(name: 'screen_lock_duration')
  int get screenLockDuration;

  /// Enables or disables the screen saver.
  @override
  @JsonKey(name: 'screen_saver')
  bool get screenSaver;

  /// Create a copy of ConfigUpdateDisplay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigUpdateDisplayImplCopyWith<_$ConfigUpdateDisplayImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
