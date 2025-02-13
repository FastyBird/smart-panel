// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_third_party_device_properties_update_result.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesThirdPartyDevicePropertiesUpdateResult
    _$DevicesThirdPartyDevicePropertiesUpdateResultFromJson(
        Map<String, dynamic> json) {
  return _DevicesThirdPartyDevicePropertiesUpdateResult.fromJson(json);
}

/// @nodoc
mixin _$DevicesThirdPartyDevicePropertiesUpdateResult {
  /// List of processed properties and their update results.
  List<DevicesThirdPartyDevicePropertyUpdateResult> get properties =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesThirdPartyDevicePropertiesUpdateResult to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesThirdPartyDevicePropertiesUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesThirdPartyDevicePropertiesUpdateResultCopyWith<
          DevicesThirdPartyDevicePropertiesUpdateResult>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesThirdPartyDevicePropertiesUpdateResultCopyWith<$Res> {
  factory $DevicesThirdPartyDevicePropertiesUpdateResultCopyWith(
          DevicesThirdPartyDevicePropertiesUpdateResult value,
          $Res Function(DevicesThirdPartyDevicePropertiesUpdateResult) then) =
      _$DevicesThirdPartyDevicePropertiesUpdateResultCopyWithImpl<$Res,
          DevicesThirdPartyDevicePropertiesUpdateResult>;
  @useResult
  $Res call({List<DevicesThirdPartyDevicePropertyUpdateResult> properties});
}

/// @nodoc
class _$DevicesThirdPartyDevicePropertiesUpdateResultCopyWithImpl<$Res,
        $Val extends DevicesThirdPartyDevicePropertiesUpdateResult>
    implements $DevicesThirdPartyDevicePropertiesUpdateResultCopyWith<$Res> {
  _$DevicesThirdPartyDevicePropertiesUpdateResultCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesThirdPartyDevicePropertiesUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? properties = null,
  }) {
    return _then(_value.copyWith(
      properties: null == properties
          ? _value.properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesThirdPartyDevicePropertyUpdateResult>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesThirdPartyDevicePropertiesUpdateResultImplCopyWith<
        $Res>
    implements $DevicesThirdPartyDevicePropertiesUpdateResultCopyWith<$Res> {
  factory _$$DevicesThirdPartyDevicePropertiesUpdateResultImplCopyWith(
          _$DevicesThirdPartyDevicePropertiesUpdateResultImpl value,
          $Res Function(_$DevicesThirdPartyDevicePropertiesUpdateResultImpl)
              then) =
      __$$DevicesThirdPartyDevicePropertiesUpdateResultImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<DevicesThirdPartyDevicePropertyUpdateResult> properties});
}

/// @nodoc
class __$$DevicesThirdPartyDevicePropertiesUpdateResultImplCopyWithImpl<$Res>
    extends _$DevicesThirdPartyDevicePropertiesUpdateResultCopyWithImpl<$Res,
        _$DevicesThirdPartyDevicePropertiesUpdateResultImpl>
    implements
        _$$DevicesThirdPartyDevicePropertiesUpdateResultImplCopyWith<$Res> {
  __$$DevicesThirdPartyDevicePropertiesUpdateResultImplCopyWithImpl(
      _$DevicesThirdPartyDevicePropertiesUpdateResultImpl _value,
      $Res Function(_$DevicesThirdPartyDevicePropertiesUpdateResultImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesThirdPartyDevicePropertiesUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? properties = null,
  }) {
    return _then(_$DevicesThirdPartyDevicePropertiesUpdateResultImpl(
      properties: null == properties
          ? _value._properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesThirdPartyDevicePropertyUpdateResult>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesThirdPartyDevicePropertiesUpdateResultImpl
    implements _DevicesThirdPartyDevicePropertiesUpdateResult {
  const _$DevicesThirdPartyDevicePropertiesUpdateResultImpl(
      {required final List<DevicesThirdPartyDevicePropertyUpdateResult>
          properties})
      : _properties = properties;

  factory _$DevicesThirdPartyDevicePropertiesUpdateResultImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesThirdPartyDevicePropertiesUpdateResultImplFromJson(json);

  /// List of processed properties and their update results.
  final List<DevicesThirdPartyDevicePropertyUpdateResult> _properties;

  /// List of processed properties and their update results.
  @override
  List<DevicesThirdPartyDevicePropertyUpdateResult> get properties {
    if (_properties is EqualUnmodifiableListView) return _properties;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_properties);
  }

  @override
  String toString() {
    return 'DevicesThirdPartyDevicePropertiesUpdateResult(properties: $properties)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesThirdPartyDevicePropertiesUpdateResultImpl &&
            const DeepCollectionEquality()
                .equals(other._properties, _properties));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, const DeepCollectionEquality().hash(_properties));

  /// Create a copy of DevicesThirdPartyDevicePropertiesUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesThirdPartyDevicePropertiesUpdateResultImplCopyWith<
          _$DevicesThirdPartyDevicePropertiesUpdateResultImpl>
      get copyWith =>
          __$$DevicesThirdPartyDevicePropertiesUpdateResultImplCopyWithImpl<
                  _$DevicesThirdPartyDevicePropertiesUpdateResultImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesThirdPartyDevicePropertiesUpdateResultImplToJson(
      this,
    );
  }
}

abstract class _DevicesThirdPartyDevicePropertiesUpdateResult
    implements DevicesThirdPartyDevicePropertiesUpdateResult {
  const factory _DevicesThirdPartyDevicePropertiesUpdateResult(
      {required final List<DevicesThirdPartyDevicePropertyUpdateResult>
          properties}) = _$DevicesThirdPartyDevicePropertiesUpdateResultImpl;

  factory _DevicesThirdPartyDevicePropertiesUpdateResult.fromJson(
          Map<String, dynamic> json) =
      _$DevicesThirdPartyDevicePropertiesUpdateResultImpl.fromJson;

  /// List of processed properties and their update results.
  @override
  List<DevicesThirdPartyDevicePropertyUpdateResult> get properties;

  /// Create a copy of DevicesThirdPartyDevicePropertiesUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesThirdPartyDevicePropertiesUpdateResultImplCopyWith<
          _$DevicesThirdPartyDevicePropertiesUpdateResultImpl>
      get copyWith => throw _privateConstructorUsedError;
}
