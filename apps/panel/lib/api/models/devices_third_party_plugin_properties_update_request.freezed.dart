// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_third_party_plugin_properties_update_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesThirdPartyPluginPropertiesUpdateRequest
    _$DevicesThirdPartyPluginPropertiesUpdateRequestFromJson(
        Map<String, dynamic> json) {
  return _DevicesThirdPartyPluginPropertiesUpdateRequest.fromJson(json);
}

/// @nodoc
mixin _$DevicesThirdPartyPluginPropertiesUpdateRequest {
  /// Represents a single property update operation for a third-party device.
  List<DevicesThirdPartyPluginPropertyUpdateRequest> get properties =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesThirdPartyPluginPropertiesUpdateRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesThirdPartyPluginPropertiesUpdateRequestCopyWith<
          DevicesThirdPartyPluginPropertiesUpdateRequest>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesThirdPartyPluginPropertiesUpdateRequestCopyWith<$Res> {
  factory $DevicesThirdPartyPluginPropertiesUpdateRequestCopyWith(
          DevicesThirdPartyPluginPropertiesUpdateRequest value,
          $Res Function(DevicesThirdPartyPluginPropertiesUpdateRequest) then) =
      _$DevicesThirdPartyPluginPropertiesUpdateRequestCopyWithImpl<$Res,
          DevicesThirdPartyPluginPropertiesUpdateRequest>;
  @useResult
  $Res call({List<DevicesThirdPartyPluginPropertyUpdateRequest> properties});
}

/// @nodoc
class _$DevicesThirdPartyPluginPropertiesUpdateRequestCopyWithImpl<$Res,
        $Val extends DevicesThirdPartyPluginPropertiesUpdateRequest>
    implements $DevicesThirdPartyPluginPropertiesUpdateRequestCopyWith<$Res> {
  _$DevicesThirdPartyPluginPropertiesUpdateRequestCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateRequest
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
              as List<DevicesThirdPartyPluginPropertyUpdateRequest>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesThirdPartyPluginPropertiesUpdateRequestImplCopyWith<
        $Res>
    implements $DevicesThirdPartyPluginPropertiesUpdateRequestCopyWith<$Res> {
  factory _$$DevicesThirdPartyPluginPropertiesUpdateRequestImplCopyWith(
          _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl value,
          $Res Function(_$DevicesThirdPartyPluginPropertiesUpdateRequestImpl)
              then) =
      __$$DevicesThirdPartyPluginPropertiesUpdateRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<DevicesThirdPartyPluginPropertyUpdateRequest> properties});
}

/// @nodoc
class __$$DevicesThirdPartyPluginPropertiesUpdateRequestImplCopyWithImpl<$Res>
    extends _$DevicesThirdPartyPluginPropertiesUpdateRequestCopyWithImpl<$Res,
        _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl>
    implements
        _$$DevicesThirdPartyPluginPropertiesUpdateRequestImplCopyWith<$Res> {
  __$$DevicesThirdPartyPluginPropertiesUpdateRequestImplCopyWithImpl(
      _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl _value,
      $Res Function(_$DevicesThirdPartyPluginPropertiesUpdateRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? properties = null,
  }) {
    return _then(_$DevicesThirdPartyPluginPropertiesUpdateRequestImpl(
      properties: null == properties
          ? _value._properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesThirdPartyPluginPropertyUpdateRequest>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl
    implements _DevicesThirdPartyPluginPropertiesUpdateRequest {
  const _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl(
      {required final List<DevicesThirdPartyPluginPropertyUpdateRequest>
          properties})
      : _properties = properties;

  factory _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesThirdPartyPluginPropertiesUpdateRequestImplFromJson(json);

  /// Represents a single property update operation for a third-party device.
  final List<DevicesThirdPartyPluginPropertyUpdateRequest> _properties;

  /// Represents a single property update operation for a third-party device.
  @override
  List<DevicesThirdPartyPluginPropertyUpdateRequest> get properties {
    if (_properties is EqualUnmodifiableListView) return _properties;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_properties);
  }

  @override
  String toString() {
    return 'DevicesThirdPartyPluginPropertiesUpdateRequest(properties: $properties)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl &&
            const DeepCollectionEquality()
                .equals(other._properties, _properties));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, const DeepCollectionEquality().hash(_properties));

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesThirdPartyPluginPropertiesUpdateRequestImplCopyWith<
          _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl>
      get copyWith =>
          __$$DevicesThirdPartyPluginPropertiesUpdateRequestImplCopyWithImpl<
                  _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesThirdPartyPluginPropertiesUpdateRequestImplToJson(
      this,
    );
  }
}

abstract class _DevicesThirdPartyPluginPropertiesUpdateRequest
    implements DevicesThirdPartyPluginPropertiesUpdateRequest {
  const factory _DevicesThirdPartyPluginPropertiesUpdateRequest(
      {required final List<DevicesThirdPartyPluginPropertyUpdateRequest>
          properties}) = _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl;

  factory _DevicesThirdPartyPluginPropertiesUpdateRequest.fromJson(
          Map<String, dynamic> json) =
      _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl.fromJson;

  /// Represents a single property update operation for a third-party device.
  @override
  List<DevicesThirdPartyPluginPropertyUpdateRequest> get properties;

  /// Create a copy of DevicesThirdPartyPluginPropertiesUpdateRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesThirdPartyPluginPropertiesUpdateRequestImplCopyWith<
          _$DevicesThirdPartyPluginPropertiesUpdateRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}
