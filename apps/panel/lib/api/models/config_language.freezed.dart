// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_language.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigLanguage _$ConfigLanguageFromJson(Map<String, dynamic> json) {
  return _ConfigLanguage.fromJson(json);
}

/// @nodoc
mixin _$ConfigLanguage {
  /// Configuration section type
  ConfigLanguageType get type => throw _privateConstructorUsedError;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  ConfigLanguageLanguage get language => throw _privateConstructorUsedError;

  /// Sets the time format for displaying time on the panel.
  String get timezone => throw _privateConstructorUsedError;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @JsonKey(name: 'time_format')
  ConfigLanguageTimeFormat get timeFormat => throw _privateConstructorUsedError;

  /// Serializes this ConfigLanguage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigLanguage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigLanguageCopyWith<ConfigLanguage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigLanguageCopyWith<$Res> {
  factory $ConfigLanguageCopyWith(
          ConfigLanguage value, $Res Function(ConfigLanguage) then) =
      _$ConfigLanguageCopyWithImpl<$Res, ConfigLanguage>;
  @useResult
  $Res call(
      {ConfigLanguageType type,
      ConfigLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat});
}

/// @nodoc
class _$ConfigLanguageCopyWithImpl<$Res, $Val extends ConfigLanguage>
    implements $ConfigLanguageCopyWith<$Res> {
  _$ConfigLanguageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigLanguage
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
              as ConfigLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigLanguageTimeFormat,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigLanguageImplCopyWith<$Res>
    implements $ConfigLanguageCopyWith<$Res> {
  factory _$$ConfigLanguageImplCopyWith(_$ConfigLanguageImpl value,
          $Res Function(_$ConfigLanguageImpl) then) =
      __$$ConfigLanguageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigLanguageType type,
      ConfigLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format') ConfigLanguageTimeFormat timeFormat});
}

/// @nodoc
class __$$ConfigLanguageImplCopyWithImpl<$Res>
    extends _$ConfigLanguageCopyWithImpl<$Res, _$ConfigLanguageImpl>
    implements _$$ConfigLanguageImplCopyWith<$Res> {
  __$$ConfigLanguageImplCopyWithImpl(
      _$ConfigLanguageImpl _value, $Res Function(_$ConfigLanguageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigLanguage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_$ConfigLanguageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigLanguageTimeFormat,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigLanguageImpl implements _ConfigLanguage {
  const _$ConfigLanguageImpl(
      {this.type = ConfigLanguageType.language,
      this.language = ConfigLanguageLanguage.enUS,
      this.timezone = 'Europe/Prague',
      @JsonKey(name: 'time_format')
      this.timeFormat = ConfigLanguageTimeFormat.value24h});

  factory _$ConfigLanguageImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigLanguageImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigLanguageType type;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  @override
  @JsonKey()
  final ConfigLanguageLanguage language;

  /// Sets the time format for displaying time on the panel.
  @override
  @JsonKey()
  final String timezone;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @override
  @JsonKey(name: 'time_format')
  final ConfigLanguageTimeFormat timeFormat;

  @override
  String toString() {
    return 'ConfigLanguage(type: $type, language: $language, timezone: $timezone, timeFormat: $timeFormat)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigLanguageImpl &&
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

  /// Create a copy of ConfigLanguage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigLanguageImplCopyWith<_$ConfigLanguageImpl> get copyWith =>
      __$$ConfigLanguageImplCopyWithImpl<_$ConfigLanguageImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigLanguageImplToJson(
      this,
    );
  }
}

abstract class _ConfigLanguage implements ConfigLanguage {
  const factory _ConfigLanguage(
      {final ConfigLanguageType type,
      final ConfigLanguageLanguage language,
      final String timezone,
      @JsonKey(name: 'time_format')
      final ConfigLanguageTimeFormat timeFormat}) = _$ConfigLanguageImpl;

  factory _ConfigLanguage.fromJson(Map<String, dynamic> json) =
      _$ConfigLanguageImpl.fromJson;

  /// Configuration section type
  @override
  ConfigLanguageType get type;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  @override
  ConfigLanguageLanguage get language;

  /// Sets the time format for displaying time on the panel.
  @override
  String get timezone;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @override
  @JsonKey(name: 'time_format')
  ConfigLanguageTimeFormat get timeFormat;

  /// Create a copy of ConfigLanguage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigLanguageImplCopyWith<_$ConfigLanguageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
