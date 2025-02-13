// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_req_create_channel_property.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesReqCreateChannelProperty _$DevicesReqCreateChannelPropertyFromJson(
    Map<String, dynamic> json) {
  return _DevicesReqCreateChannelProperty.fromJson(json);
}

/// @nodoc
mixin _$DevicesReqCreateChannelProperty {
  DevicesCreateChannelProperty get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesReqCreateChannelProperty to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesReqCreateChannelPropertyCopyWith<DevicesReqCreateChannelProperty>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesReqCreateChannelPropertyCopyWith<$Res> {
  factory $DevicesReqCreateChannelPropertyCopyWith(
          DevicesReqCreateChannelProperty value,
          $Res Function(DevicesReqCreateChannelProperty) then) =
      _$DevicesReqCreateChannelPropertyCopyWithImpl<$Res,
          DevicesReqCreateChannelProperty>;
  @useResult
  $Res call({DevicesCreateChannelProperty data});

  $DevicesCreateChannelPropertyCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesReqCreateChannelPropertyCopyWithImpl<$Res,
        $Val extends DevicesReqCreateChannelProperty>
    implements $DevicesReqCreateChannelPropertyCopyWith<$Res> {
  _$DevicesReqCreateChannelPropertyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesReqCreateChannelProperty
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
              as DevicesCreateChannelProperty,
    ) as $Val);
  }

  /// Create a copy of DevicesReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesCreateChannelPropertyCopyWith<$Res> get data {
    return $DevicesCreateChannelPropertyCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesReqCreateChannelPropertyImplCopyWith<$Res>
    implements $DevicesReqCreateChannelPropertyCopyWith<$Res> {
  factory _$$DevicesReqCreateChannelPropertyImplCopyWith(
          _$DevicesReqCreateChannelPropertyImpl value,
          $Res Function(_$DevicesReqCreateChannelPropertyImpl) then) =
      __$$DevicesReqCreateChannelPropertyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesCreateChannelProperty data});

  @override
  $DevicesCreateChannelPropertyCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesReqCreateChannelPropertyImplCopyWithImpl<$Res>
    extends _$DevicesReqCreateChannelPropertyCopyWithImpl<$Res,
        _$DevicesReqCreateChannelPropertyImpl>
    implements _$$DevicesReqCreateChannelPropertyImplCopyWith<$Res> {
  __$$DevicesReqCreateChannelPropertyImplCopyWithImpl(
      _$DevicesReqCreateChannelPropertyImpl _value,
      $Res Function(_$DevicesReqCreateChannelPropertyImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesReqCreateChannelPropertyImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesCreateChannelProperty,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesReqCreateChannelPropertyImpl
    implements _DevicesReqCreateChannelProperty {
  const _$DevicesReqCreateChannelPropertyImpl({required this.data});

  factory _$DevicesReqCreateChannelPropertyImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesReqCreateChannelPropertyImplFromJson(json);

  @override
  final DevicesCreateChannelProperty data;

  @override
  String toString() {
    return 'DevicesReqCreateChannelProperty(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesReqCreateChannelPropertyImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesReqCreateChannelPropertyImplCopyWith<
          _$DevicesReqCreateChannelPropertyImpl>
      get copyWith => __$$DevicesReqCreateChannelPropertyImplCopyWithImpl<
          _$DevicesReqCreateChannelPropertyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesReqCreateChannelPropertyImplToJson(
      this,
    );
  }
}

abstract class _DevicesReqCreateChannelProperty
    implements DevicesReqCreateChannelProperty {
  const factory _DevicesReqCreateChannelProperty(
          {required final DevicesCreateChannelProperty data}) =
      _$DevicesReqCreateChannelPropertyImpl;

  factory _DevicesReqCreateChannelProperty.fromJson(Map<String, dynamic> json) =
      _$DevicesReqCreateChannelPropertyImpl.fromJson;

  @override
  DevicesCreateChannelProperty get data;

  /// Create a copy of DevicesReqCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesReqCreateChannelPropertyImplCopyWith<
          _$DevicesReqCreateChannelPropertyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
