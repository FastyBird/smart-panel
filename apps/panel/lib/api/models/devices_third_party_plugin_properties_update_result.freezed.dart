// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_third_party_plugin_properties_update_result.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesThirdPartyPluginPropertiesUpdateResult
    _$DevicesThirdPartyPluginPropertiesUpdateResultFromJson(
        Map<String, dynamic> json) {
  return _DevicesThirdPartyPluginPropertiesUpdateResult.fromJson(json);
}

/// @nodoc
mixin _$DevicesThirdPartyPluginPropertiesUpdateResult {
  /// List of processed properties and their update results.
  List<DevicesThirdPartyPluginPropertyUpdateResult> get properties =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesThirdPartyPluginPropertiesUpdateResult to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesThirdPartyPluginPropertiesUpdateResultCopyWith<
          DevicesThirdPartyPluginPropertiesUpdateResult>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesThirdPartyPluginPropertiesUpdateResultCopyWith<$Res> {
  factory $DevicesThirdPartyPluginPropertiesUpdateResultCopyWith(
          DevicesThirdPartyPluginPropertiesUpdateResult value,
          $Res Function(DevicesThirdPartyPluginPropertiesUpdateResult) then) =
      _$DevicesThirdPartyPluginPropertiesUpdateResultCopyWithImpl<$Res,
          DevicesThirdPartyPluginPropertiesUpdateResult>;
  @useResult
  $Res call({List<DevicesThirdPartyPluginPropertyUpdateResult> properties});
}

/// @nodoc
class _$DevicesThirdPartyPluginPropertiesUpdateResultCopyWithImpl<$Res,
        $Val extends DevicesThirdPartyPluginPropertiesUpdateResult>
    implements $DevicesThirdPartyPluginPropertiesUpdateResultCopyWith<$Res> {
  _$DevicesThirdPartyPluginPropertiesUpdateResultCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateResult
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
              as List<DevicesThirdPartyPluginPropertyUpdateResult>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesThirdPartyPluginPropertiesUpdateResultImplCopyWith<
        $Res>
    implements $DevicesThirdPartyPluginPropertiesUpdateResultCopyWith<$Res> {
  factory _$$DevicesThirdPartyPluginPropertiesUpdateResultImplCopyWith(
          _$DevicesThirdPartyPluginPropertiesUpdateResultImpl value,
          $Res Function(_$DevicesThirdPartyPluginPropertiesUpdateResultImpl)
              then) =
      __$$DevicesThirdPartyPluginPropertiesUpdateResultImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<DevicesThirdPartyPluginPropertyUpdateResult> properties});
}

/// @nodoc
class __$$DevicesThirdPartyPluginPropertiesUpdateResultImplCopyWithImpl<$Res>
    extends _$DevicesThirdPartyPluginPropertiesUpdateResultCopyWithImpl<$Res,
        _$DevicesThirdPartyPluginPropertiesUpdateResultImpl>
    implements
        _$$DevicesThirdPartyPluginPropertiesUpdateResultImplCopyWith<$Res> {
  __$$DevicesThirdPartyPluginPropertiesUpdateResultImplCopyWithImpl(
      _$DevicesThirdPartyPluginPropertiesUpdateResultImpl _value,
      $Res Function(_$DevicesThirdPartyPluginPropertiesUpdateResultImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? properties = null,
  }) {
    return _then(_$DevicesThirdPartyPluginPropertiesUpdateResultImpl(
      properties: null == properties
          ? _value._properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesThirdPartyPluginPropertyUpdateResult>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesThirdPartyPluginPropertiesUpdateResultImpl
    implements _DevicesThirdPartyPluginPropertiesUpdateResult {
  const _$DevicesThirdPartyPluginPropertiesUpdateResultImpl(
      {required final List<DevicesThirdPartyPluginPropertyUpdateResult>
          properties})
      : _properties = properties;

  factory _$DevicesThirdPartyPluginPropertiesUpdateResultImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesThirdPartyPluginPropertiesUpdateResultImplFromJson(json);

  /// List of processed properties and their update results.
  final List<DevicesThirdPartyPluginPropertyUpdateResult> _properties;

  /// List of processed properties and their update results.
  @override
  List<DevicesThirdPartyPluginPropertyUpdateResult> get properties {
    if (_properties is EqualUnmodifiableListView) return _properties;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_properties);
  }

  @override
  String toString() {
    return 'DevicesThirdPartyPluginPropertiesUpdateResult(properties: $properties)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesThirdPartyPluginPropertiesUpdateResultImpl &&
            const DeepCollectionEquality()
                .equals(other._properties, _properties));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, const DeepCollectionEquality().hash(_properties));

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesThirdPartyPluginPropertiesUpdateResultImplCopyWith<
          _$DevicesThirdPartyPluginPropertiesUpdateResultImpl>
      get copyWith =>
          __$$DevicesThirdPartyPluginPropertiesUpdateResultImplCopyWithImpl<
                  _$DevicesThirdPartyPluginPropertiesUpdateResultImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesThirdPartyPluginPropertiesUpdateResultImplToJson(
      this,
    );
  }
}

abstract class _DevicesThirdPartyPluginPropertiesUpdateResult
    implements DevicesThirdPartyPluginPropertiesUpdateResult {
  const factory _DevicesThirdPartyPluginPropertiesUpdateResult(
      {required final List<DevicesThirdPartyPluginPropertyUpdateResult>
          properties}) = _$DevicesThirdPartyPluginPropertiesUpdateResultImpl;

  factory _DevicesThirdPartyPluginPropertiesUpdateResult.fromJson(
          Map<String, dynamic> json) =
      _$DevicesThirdPartyPluginPropertiesUpdateResultImpl.fromJson;

  /// List of processed properties and their update results.
  @override
  List<DevicesThirdPartyPluginPropertyUpdateResult> get properties;

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesThirdPartyPluginPropertiesUpdateResultImplCopyWith<
          _$DevicesThirdPartyPluginPropertiesUpdateResultImpl>
      get copyWith => throw _privateConstructorUsedError;
}
