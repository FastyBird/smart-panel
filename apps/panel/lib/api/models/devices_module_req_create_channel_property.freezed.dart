// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_req_create_channel_property.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleReqCreateChannelProperty
    _$DevicesModuleReqCreateChannelPropertyFromJson(Map<String, dynamic> json) {
  return _DevicesModuleReqCreateChannelProperty.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleReqCreateChannelProperty {
  DevicesModuleCreateChannelProperty get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleReqCreateChannelProperty to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleReqCreateChannelPropertyCopyWith<
          DevicesModuleReqCreateChannelProperty>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleReqCreateChannelPropertyCopyWith<$Res> {
  factory $DevicesModuleReqCreateChannelPropertyCopyWith(
          DevicesModuleReqCreateChannelProperty value,
          $Res Function(DevicesModuleReqCreateChannelProperty) then) =
      _$DevicesModuleReqCreateChannelPropertyCopyWithImpl<$Res,
          DevicesModuleReqCreateChannelProperty>;
  @useResult
  $Res call({DevicesModuleCreateChannelProperty data});

  $DevicesModuleCreateChannelPropertyCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesModuleReqCreateChannelPropertyCopyWithImpl<$Res,
        $Val extends DevicesModuleReqCreateChannelProperty>
    implements $DevicesModuleReqCreateChannelPropertyCopyWith<$Res> {
  _$DevicesModuleReqCreateChannelPropertyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateChannelProperty,
    ) as $Val);
  }

  /// Create a copy of DevicesModuleReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesModuleCreateChannelPropertyCopyWith<$Res> get data {
    return $DevicesModuleCreateChannelPropertyCopyWith<$Res>(_value.data,
        (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesModuleReqCreateChannelPropertyImplCopyWith<$Res>
    implements $DevicesModuleReqCreateChannelPropertyCopyWith<$Res> {
  factory _$$DevicesModuleReqCreateChannelPropertyImplCopyWith(
          _$DevicesModuleReqCreateChannelPropertyImpl value,
          $Res Function(_$DevicesModuleReqCreateChannelPropertyImpl) then) =
      __$$DevicesModuleReqCreateChannelPropertyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesModuleCreateChannelProperty data});

  @override
  $DevicesModuleCreateChannelPropertyCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesModuleReqCreateChannelPropertyImplCopyWithImpl<$Res>
    extends _$DevicesModuleReqCreateChannelPropertyCopyWithImpl<$Res,
        _$DevicesModuleReqCreateChannelPropertyImpl>
    implements _$$DevicesModuleReqCreateChannelPropertyImplCopyWith<$Res> {
  __$$DevicesModuleReqCreateChannelPropertyImplCopyWithImpl(
      _$DevicesModuleReqCreateChannelPropertyImpl _value,
      $Res Function(_$DevicesModuleReqCreateChannelPropertyImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesModuleReqCreateChannelPropertyImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateChannelProperty,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleReqCreateChannelPropertyImpl
    implements _DevicesModuleReqCreateChannelProperty {
  const _$DevicesModuleReqCreateChannelPropertyImpl({required this.data});

  factory _$DevicesModuleReqCreateChannelPropertyImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleReqCreateChannelPropertyImplFromJson(json);

  @override
  final DevicesModuleCreateChannelProperty data;

  @override
  String toString() {
    return 'DevicesModuleReqCreateChannelProperty(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleReqCreateChannelPropertyImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesModuleReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleReqCreateChannelPropertyImplCopyWith<
          _$DevicesModuleReqCreateChannelPropertyImpl>
      get copyWith => __$$DevicesModuleReqCreateChannelPropertyImplCopyWithImpl<
          _$DevicesModuleReqCreateChannelPropertyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleReqCreateChannelPropertyImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleReqCreateChannelProperty
    implements DevicesModuleReqCreateChannelProperty {
  const factory _DevicesModuleReqCreateChannelProperty(
          {required final DevicesModuleCreateChannelProperty data}) =
      _$DevicesModuleReqCreateChannelPropertyImpl;

  factory _DevicesModuleReqCreateChannelProperty.fromJson(
          Map<String, dynamic> json) =
      _$DevicesModuleReqCreateChannelPropertyImpl.fromJson;

  @override
  DevicesModuleCreateChannelProperty get data;

  /// Create a copy of DevicesModuleReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleReqCreateChannelPropertyImplCopyWith<
          _$DevicesModuleReqCreateChannelPropertyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
