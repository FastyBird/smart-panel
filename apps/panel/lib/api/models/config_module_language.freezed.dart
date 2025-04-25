// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_language.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleLanguage _$ConfigModuleLanguageFromJson(Map<String, dynamic> json) {
  return _ConfigModuleLanguage.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleLanguage {
  /// Configuration section type
  ConfigModuleLanguageType get type => throw _privateConstructorUsedError;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  ConfigModuleLanguageLanguage get language =>
      throw _privateConstructorUsedError;

  /// Sets the time format for displaying time on the panel.
  String get timezone => throw _privateConstructorUsedError;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @JsonKey(name: 'time_format')
  ConfigModuleLanguageTimeFormat get timeFormat =>
      throw _privateConstructorUsedError;

  /// Serializes this ConfigModuleLanguage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleLanguage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleLanguageCopyWith<ConfigModuleLanguage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleLanguageCopyWith<$Res> {
  factory $ConfigModuleLanguageCopyWith(ConfigModuleLanguage value,
          $Res Function(ConfigModuleLanguage) then) =
      _$ConfigModuleLanguageCopyWithImpl<$Res, ConfigModuleLanguage>;
  @useResult
  $Res call(
      {ConfigModuleLanguageType type,
      ConfigModuleLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format') ConfigModuleLanguageTimeFormat timeFormat});
}

/// @nodoc
class _$ConfigModuleLanguageCopyWithImpl<$Res,
        $Val extends ConfigModuleLanguage>
    implements $ConfigModuleLanguageCopyWith<$Res> {
  _$ConfigModuleLanguageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleLanguage
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
              as ConfigModuleLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguageTimeFormat,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ConfigModuleLanguageImplCopyWith<$Res>
    implements $ConfigModuleLanguageCopyWith<$Res> {
  factory _$$ConfigModuleLanguageImplCopyWith(_$ConfigModuleLanguageImpl value,
          $Res Function(_$ConfigModuleLanguageImpl) then) =
      __$$ConfigModuleLanguageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ConfigModuleLanguageType type,
      ConfigModuleLanguageLanguage language,
      String timezone,
      @JsonKey(name: 'time_format') ConfigModuleLanguageTimeFormat timeFormat});
}

/// @nodoc
class __$$ConfigModuleLanguageImplCopyWithImpl<$Res>
    extends _$ConfigModuleLanguageCopyWithImpl<$Res, _$ConfigModuleLanguageImpl>
    implements _$$ConfigModuleLanguageImplCopyWith<$Res> {
  __$$ConfigModuleLanguageImplCopyWithImpl(_$ConfigModuleLanguageImpl _value,
      $Res Function(_$ConfigModuleLanguageImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleLanguage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? language = null,
    Object? timezone = null,
    Object? timeFormat = null,
  }) {
    return _then(_$ConfigModuleLanguageImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguageType,
      language: null == language
          ? _value.language
          : language // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguageLanguage,
      timezone: null == timezone
          ? _value.timezone
          : timezone // ignore: cast_nullable_to_non_nullable
              as String,
      timeFormat: null == timeFormat
          ? _value.timeFormat
          : timeFormat // ignore: cast_nullable_to_non_nullable
              as ConfigModuleLanguageTimeFormat,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleLanguageImpl implements _ConfigModuleLanguage {
  const _$ConfigModuleLanguageImpl(
      {this.type = ConfigModuleLanguageType.language,
      this.language = ConfigModuleLanguageLanguage.enUS,
      this.timezone = 'Europe/Prague',
      @JsonKey(name: 'time_format')
      this.timeFormat = ConfigModuleLanguageTimeFormat.value24h});

  factory _$ConfigModuleLanguageImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigModuleLanguageImplFromJson(json);

  /// Configuration section type
  @override
  @JsonKey()
  final ConfigModuleLanguageType type;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  @override
  @JsonKey()
  final ConfigModuleLanguageLanguage language;

  /// Sets the time format for displaying time on the panel.
  @override
  @JsonKey()
  final String timezone;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @override
  @JsonKey(name: 'time_format')
  final ConfigModuleLanguageTimeFormat timeFormat;

  @override
  String toString() {
    return 'ConfigModuleLanguage(type: $type, language: $language, timezone: $timezone, timeFormat: $timeFormat)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleLanguageImpl &&
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

  /// Create a copy of ConfigModuleLanguage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleLanguageImplCopyWith<_$ConfigModuleLanguageImpl>
      get copyWith =>
          __$$ConfigModuleLanguageImplCopyWithImpl<_$ConfigModuleLanguageImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleLanguageImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleLanguage implements ConfigModuleLanguage {
  const factory _ConfigModuleLanguage(
          {final ConfigModuleLanguageType type,
          final ConfigModuleLanguageLanguage language,
          final String timezone,
          @JsonKey(name: 'time_format')
          final ConfigModuleLanguageTimeFormat timeFormat}) =
      _$ConfigModuleLanguageImpl;

  factory _ConfigModuleLanguage.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleLanguageImpl.fromJson;

  /// Configuration section type
  @override
  ConfigModuleLanguageType get type;

  /// Defines the language and region format. Uses standard locale codes (ISO 639-1).
  @override
  ConfigModuleLanguageLanguage get language;

  /// Sets the time format for displaying time on the panel.
  @override
  String get timezone;

  /// Defines the time zone of the smart panel. Uses the IANA time zone format.
  @override
  @JsonKey(name: 'time_format')
  ConfigModuleLanguageTimeFormat get timeFormat;

  /// Create a copy of ConfigModuleLanguage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleLanguageImplCopyWith<_$ConfigModuleLanguageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
