// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_module_throttle_status.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemModuleThrottleStatus _$SystemModuleThrottleStatusFromJson(
    Map<String, dynamic> json) {
  return _SystemModuleThrottleStatus.fromJson(json);
}

/// @nodoc
mixin _$SystemModuleThrottleStatus {
  /// Indicates if the system has detected undervoltage conditions.
  bool get undervoltage => throw _privateConstructorUsedError;

  /// Indicates if the system is reducing CPU frequency due to power constraints.
  @JsonKey(name: 'frequency_capping')
  bool get frequencyCapping => throw _privateConstructorUsedError;

  /// Indicates if the system has experienced CPU throttling due to high temperatures.
  bool get throttling => throw _privateConstructorUsedError;

  /// Indicates if the system has reached the soft temperature limit and is reducing performance.
  @JsonKey(name: 'soft_temp_limit')
  bool get softTempLimit => throw _privateConstructorUsedError;

  /// Serializes this SystemModuleThrottleStatus to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemModuleThrottleStatus
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemModuleThrottleStatusCopyWith<SystemModuleThrottleStatus>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemModuleThrottleStatusCopyWith<$Res> {
  factory $SystemModuleThrottleStatusCopyWith(SystemModuleThrottleStatus value,
          $Res Function(SystemModuleThrottleStatus) then) =
      _$SystemModuleThrottleStatusCopyWithImpl<$Res,
          SystemModuleThrottleStatus>;
  @useResult
  $Res call(
      {bool undervoltage,
      @JsonKey(name: 'frequency_capping') bool frequencyCapping,
      bool throttling,
      @JsonKey(name: 'soft_temp_limit') bool softTempLimit});
}

/// @nodoc
class _$SystemModuleThrottleStatusCopyWithImpl<$Res,
        $Val extends SystemModuleThrottleStatus>
    implements $SystemModuleThrottleStatusCopyWith<$Res> {
  _$SystemModuleThrottleStatusCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemModuleThrottleStatus
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? undervoltage = null,
    Object? frequencyCapping = null,
    Object? throttling = null,
    Object? softTempLimit = null,
  }) {
    return _then(_value.copyWith(
      undervoltage: null == undervoltage
          ? _value.undervoltage
          : undervoltage // ignore: cast_nullable_to_non_nullable
              as bool,
      frequencyCapping: null == frequencyCapping
          ? _value.frequencyCapping
          : frequencyCapping // ignore: cast_nullable_to_non_nullable
              as bool,
      throttling: null == throttling
          ? _value.throttling
          : throttling // ignore: cast_nullable_to_non_nullable
              as bool,
      softTempLimit: null == softTempLimit
          ? _value.softTempLimit
          : softTempLimit // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SystemModuleThrottleStatusImplCopyWith<$Res>
    implements $SystemModuleThrottleStatusCopyWith<$Res> {
  factory _$$SystemModuleThrottleStatusImplCopyWith(
          _$SystemModuleThrottleStatusImpl value,
          $Res Function(_$SystemModuleThrottleStatusImpl) then) =
      __$$SystemModuleThrottleStatusImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {bool undervoltage,
      @JsonKey(name: 'frequency_capping') bool frequencyCapping,
      bool throttling,
      @JsonKey(name: 'soft_temp_limit') bool softTempLimit});
}

/// @nodoc
class __$$SystemModuleThrottleStatusImplCopyWithImpl<$Res>
    extends _$SystemModuleThrottleStatusCopyWithImpl<$Res,
        _$SystemModuleThrottleStatusImpl>
    implements _$$SystemModuleThrottleStatusImplCopyWith<$Res> {
  __$$SystemModuleThrottleStatusImplCopyWithImpl(
      _$SystemModuleThrottleStatusImpl _value,
      $Res Function(_$SystemModuleThrottleStatusImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemModuleThrottleStatus
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? undervoltage = null,
    Object? frequencyCapping = null,
    Object? throttling = null,
    Object? softTempLimit = null,
  }) {
    return _then(_$SystemModuleThrottleStatusImpl(
      undervoltage: null == undervoltage
          ? _value.undervoltage
          : undervoltage // ignore: cast_nullable_to_non_nullable
              as bool,
      frequencyCapping: null == frequencyCapping
          ? _value.frequencyCapping
          : frequencyCapping // ignore: cast_nullable_to_non_nullable
              as bool,
      throttling: null == throttling
          ? _value.throttling
          : throttling // ignore: cast_nullable_to_non_nullable
              as bool,
      softTempLimit: null == softTempLimit
          ? _value.softTempLimit
          : softTempLimit // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemModuleThrottleStatusImpl implements _SystemModuleThrottleStatus {
  const _$SystemModuleThrottleStatusImpl(
      {this.undervoltage = false,
      @JsonKey(name: 'frequency_capping') this.frequencyCapping = false,
      this.throttling = false,
      @JsonKey(name: 'soft_temp_limit') this.softTempLimit = false});

  factory _$SystemModuleThrottleStatusImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$SystemModuleThrottleStatusImplFromJson(json);

  /// Indicates if the system has detected undervoltage conditions.
  @override
  @JsonKey()
  final bool undervoltage;

  /// Indicates if the system is reducing CPU frequency due to power constraints.
  @override
  @JsonKey(name: 'frequency_capping')
  final bool frequencyCapping;

  /// Indicates if the system has experienced CPU throttling due to high temperatures.
  @override
  @JsonKey()
  final bool throttling;

  /// Indicates if the system has reached the soft temperature limit and is reducing performance.
  @override
  @JsonKey(name: 'soft_temp_limit')
  final bool softTempLimit;

  @override
  String toString() {
    return 'SystemModuleThrottleStatus(undervoltage: $undervoltage, frequencyCapping: $frequencyCapping, throttling: $throttling, softTempLimit: $softTempLimit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemModuleThrottleStatusImpl &&
            (identical(other.undervoltage, undervoltage) ||
                other.undervoltage == undervoltage) &&
            (identical(other.frequencyCapping, frequencyCapping) ||
                other.frequencyCapping == frequencyCapping) &&
            (identical(other.throttling, throttling) ||
                other.throttling == throttling) &&
            (identical(other.softTempLimit, softTempLimit) ||
                other.softTempLimit == softTempLimit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, undervoltage, frequencyCapping, throttling, softTempLimit);

  /// Create a copy of SystemModuleThrottleStatus
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemModuleThrottleStatusImplCopyWith<_$SystemModuleThrottleStatusImpl>
      get copyWith => __$$SystemModuleThrottleStatusImplCopyWithImpl<
          _$SystemModuleThrottleStatusImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemModuleThrottleStatusImplToJson(
      this,
    );
  }
}

abstract class _SystemModuleThrottleStatus
    implements SystemModuleThrottleStatus {
  const factory _SystemModuleThrottleStatus(
          {final bool undervoltage,
          @JsonKey(name: 'frequency_capping') final bool frequencyCapping,
          final bool throttling,
          @JsonKey(name: 'soft_temp_limit') final bool softTempLimit}) =
      _$SystemModuleThrottleStatusImpl;

  factory _SystemModuleThrottleStatus.fromJson(Map<String, dynamic> json) =
      _$SystemModuleThrottleStatusImpl.fromJson;

  /// Indicates if the system has detected undervoltage conditions.
  @override
  bool get undervoltage;

  /// Indicates if the system is reducing CPU frequency due to power constraints.
  @override
  @JsonKey(name: 'frequency_capping')
  bool get frequencyCapping;

  /// Indicates if the system has experienced CPU throttling due to high temperatures.
  @override
  bool get throttling;

  /// Indicates if the system has reached the soft temperature limit and is reducing performance.
  @override
  @JsonKey(name: 'soft_temp_limit')
  bool get softTempLimit;

  /// Create a copy of SystemModuleThrottleStatus
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemModuleThrottleStatusImplCopyWith<_$SystemModuleThrottleStatusImpl>
      get copyWith => throw _privateConstructorUsedError;
}
