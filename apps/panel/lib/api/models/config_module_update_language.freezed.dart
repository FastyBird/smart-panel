// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_update_language.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleUpdateLanguage _$ConfigModuleUpdateLanguageFromJson(
    Map<String, dynamic> json) {
  return _ConfigModuleUpdateLanguage.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleUpdateLanguage {
  /// Configuration section type
  ConfigModuleUpdateLanguageType get type => throw _privateConstructorUsedError;

  /// Defines the language and region format.
  ConfigModuleUpdateLanguageLanguage get language =>
      throw _privateConstructorUsedError;

  /// Defines the time zone using the IANA time zone format.
  String get timezone => throw _privateConstructorUsedError;

  /// Sets the time format (12-hour or 24-hour).
  @JsonKey(name: 'time_format')
  ConfigModuleUpdateLanguageTimeFormat get timeFormat =>
      throw _privateConstructorUsedError;

  /// Serializes this ConfigModuleUpdateLanguage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleUpdateLanguageCopyWith<ConfigModuleUpdateLanguage>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleUpdateLanguageCopyWith<$Res> {
  factory $ConfigModuleUpdateLanguageCopyWith(ConfigModuleUpdateLanguage value,
          $Res Function(ConfigModuleUpdateLanguage) then) =
      _$ConfigModuleUpdateLanguageCopyWithImpl<$Res,
          ConfigModuleUpdateLanguage>;
  @useResult
  $Res call(
      {ConfigModuleUpdateLanguageType type,
      ConfigModuleUpdateLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format')
      ConfigModuleUpdateLanguageTimeFormat timeFormat});
}

/// @nodoc
class _$ConfigModuleUpdateLanguageCopyWithImpl<$Res,
        $Val extends ConfigModuleUpdateLanguage>
    implements $ConfigModuleUpdateLanguageCopyWith<$Res> {
  _$ConfigModuleUpdateLanguageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateLanguageTimeFormat,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigModuleUpdateLanguageImplCopyWith<$Res>
    implements $ConfigModuleUpdateLanguageCopyWith<$Res> {
  factory _$$ConfigModuleUpdateLanguageImplCopyWith(
          _$ConfigModuleUpdateLanguageImpl value,
          $Res Function(_$ConfigModuleUpdateLanguageImpl) then) =
      __$$ConfigModuleUpdateLanguageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigModuleUpdateLanguageType type,
      ConfigModuleUpdateLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format')
      ConfigModuleUpdateLanguageTimeFormat timeFormat});
}

/// @nodoc
class __$$ConfigModuleUpdateLanguageImplCopyWithImpl<$Res>
    extends _$ConfigModuleUpdateLanguageCopyWithImpl<$Res,
        _$ConfigModuleUpdateLanguageImpl>
    implements _$$ConfigModuleUpdateLanguageImplCopyWith<$Res> {
  __$$ConfigModuleUpdateLanguageImplCopyWithImpl(
      _$ConfigModuleUpdateLanguageImpl _value,
      $Res Function(_$ConfigModuleUpdateLanguageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_$ConfigModuleUpdateLanguageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigModuleUpdateLanguageTimeFormat,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleUpdateLanguageImpl implements _ConfigModuleUpdateLanguage {
  const _$ConfigModuleUpdateLanguageImpl(
      {required this.type,
      required this.language,
      required this.timezone,
      @JsonKey(name: 'time_format') required this.timeFormat});

  factory _$ConfigModuleUpdateLanguageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleUpdateLanguageImplFromJson(json);

  /// Configuration section type
  @override
  final ConfigModuleUpdateLanguageType type;

  /// Defines the language and region format.
  @override
  final ConfigModuleUpdateLanguageLanguage language;

  /// Defines the time zone using the IANA time zone format.
  @override
  final String timezone;

  /// Sets the time format (12-hour or 24-hour).
  @override
  @JsonKey(name: 'time_format')
  final ConfigModuleUpdateLanguageTimeFormat timeFormat;

  @override
  String toString() {
    return 'ConfigModuleUpdateLanguage(type: $type, language: $language, timezone: $timezone, timeFormat: $timeFormat)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleUpdateLanguageImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.language, language) ||
                other.language == language) &&
            (identical(other.timezone, timezone) ||
                other.timezone == timezone) &&
            (identical(other.timeFormat, timeFormat) ||
                other.timeFormat == timeFormat));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, language, timezone, timeFormat);

  /// Create a copy of ConfigModuleUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleUpdateLanguageImplCopyWith<_$ConfigModuleUpdateLanguageImpl>
      get copyWith => __$$ConfigModuleUpdateLanguageImplCopyWithImpl<
          _$ConfigModuleUpdateLanguageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleUpdateLanguageImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleUpdateLanguage
    implements ConfigModuleUpdateLanguage {
  const factory _ConfigModuleUpdateLanguage(
          {required final ConfigModuleUpdateLanguageType type,
          required final ConfigModuleUpdateLanguageLanguage language,
          required final String timezone,
          @JsonKey(name: 'time_format')
          required final ConfigModuleUpdateLanguageTimeFormat timeFormat}) =
      _$ConfigModuleUpdateLanguageImpl;

  factory _ConfigModuleUpdateLanguage.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleUpdateLanguageImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleUpdateLanguageType get type;

  /// Defines the language and region format.
  @override
  ConfigModuleUpdateLanguageLanguage get language;

  /// Defines the time zone using the IANA time zone format.
  @override
  String get timezone;

  /// Sets the time format (12-hour or 24-hour).
  @override
  @JsonKey(name: 'time_format')
  ConfigModuleUpdateLanguageTimeFormat get timeFormat;

  /// Create a copy of ConfigModuleUpdateLanguage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleUpdateLanguageImplCopyWith<_$ConfigModuleUpdateLanguageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
