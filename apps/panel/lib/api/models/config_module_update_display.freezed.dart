// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_update_display.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleUpdateDisplay _$ConfigModuleUpdateDisplayFromJson(
    Map<String, dynamic> json) {
  return _ConfigModuleUpdateDisplay.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleUpdateDisplay {
  /// Configuration section type
  ConfigModuleUpdateDisplayType get type => throw _privateConstructorUsedError;

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

  /// Serializes this ConfigModuleUpdateDisplay to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleUpdateDisplay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleUpdateDisplayCopyWith<ConfigModuleUpdateDisplay> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleUpdateDisplayCopyWith<$Res> {
  factory $ConfigModuleUpdateDisplayCopyWith(ConfigModuleUpdateDisplay value,
          $Res Function(ConfigModuleUpdateDisplay) then) =
      _$ConfigModuleUpdateDisplayCopyWithImpl<$Res, ConfigModuleUpdateDisplay>;
  @useResult
  $Res call(
      {ConfigModuleUpdateDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class _$ConfigModuleUpdateDisplayCopyWithImpl<$Res,
        $Val extends ConfigModuleUpdateDisplay>
    implements $ConfigModuleUpdateDisplayCopyWith<$Res> {
  _$ConfigModuleUpdateDisplayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleUpdateDisplay
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
              as ConfigModuleUpdateDisplayType,
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
abstract class _$$ConfigModuleUpdateDisplayImplCopyWith<$Res>
    implements $ConfigModuleUpdateDisplayCopyWith<$Res> {
  factory _$$ConfigModuleUpdateDisplayImplCopyWith(
          _$ConfigModuleUpdateDisplayImpl value,
          $Res Function(_$ConfigModuleUpdateDisplayImpl) then) =
      __$$ConfigModuleUpdateDisplayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigModuleUpdateDisplayType type,
      @JsonKey(name: 'dark_mode') bool darkMode,
      int brightness,
      @JsonKey(name: 'screen_lock_duration') int screenLockDuration,
      @JsonKey(name: 'screen_saver') bool screenSaver});
}

/// @nodoc
class __$$ConfigModuleUpdateDisplayImplCopyWithImpl<$Res>
    extends _$ConfigModuleUpdateDisplayCopyWithImpl<$Res,
        _$ConfigModuleUpdateDisplayImpl>
    implements _$$ConfigModuleUpdateDisplayImplCopyWith<$Res> {
  __$$ConfigModuleUpdateDisplayImplCopyWithImpl(
      _$ConfigModuleUpdateDisplayImpl _value,
      $Res Function(_$ConfigModuleUpdateDisplayImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleUpdateDisplay
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
    return _then(_$ConfigModuleUpdateDisplayImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateDisplayType,
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
class _$ConfigModuleUpdateDisplayImpl implements _ConfigModuleUpdateDisplay {
  const _$ConfigModuleUpdateDisplayImpl(
      {required this.type,
      @JsonKey(name: 'dark_mode') required this.darkMode,
      required this.brightness,
      @JsonKey(name: 'screen_lock_duration') required this.screenLockDuration,
      @JsonKey(name: 'screen_saver') required this.screenSaver});

  factory _$ConfigModuleUpdateDisplayImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigModuleUpdateDisplayImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigModuleUpdateDisplayType type;

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
    return 'ConfigModuleUpdateDisplay(type: $type, darkMode: $darkMode, brightness: $brightness, screenLockDuration: $screenLockDuration, screenSaver: $screenSaver)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleUpdateDisplayImpl &&
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

  /// Create a copy of ConfigModuleUpdateDisplay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleUpdateDisplayImplCopyWith<_$ConfigModuleUpdateDisplayImpl>
      get copyWith => __$$ConfigModuleUpdateDisplayImplCopyWithImpl<
          _$ConfigModuleUpdateDisplayImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleUpdateDisplayImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleUpdateDisplay implements ConfigModuleUpdateDisplay {
  const factory _ConfigModuleUpdateDisplay(
          {required final ConfigModuleUpdateDisplayType type,
          @JsonKey(name: 'dark_mode') required final bool darkMode,
          required final int brightness,
          @JsonKey(name: 'screen_lock_duration')
          required final int screenLockDuration,
          @JsonKey(name: 'screen_saver') required final bool screenSaver}) =
      _$ConfigModuleUpdateDisplayImpl;

  factory _ConfigModuleUpdateDisplay.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleUpdateDisplayImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleUpdateDisplayType get type;

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

  /// Create a copy of ConfigModuleUpdateDisplay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleUpdateDisplayImplCopyWith<_$ConfigModuleUpdateDisplayImpl>
      get copyWith => throw _privateConstructorUsedError;
}
