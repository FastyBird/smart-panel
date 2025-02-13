// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_req_update_channel_property.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesReqUpdateChannelProperty _$DevicesReqUpdateChannelPropertyFromJson(
    Map<String, dynamic> json) {
  return _DevicesReqUpdateChannelProperty.fromJson(json);
}

/// @nodoc
mixin _$DevicesReqUpdateChannelProperty {
  DevicesUpdateChannelProperty get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesReqUpdateChannelProperty to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesReqUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesReqUpdateChannelPropertyCopyWith<DevicesReqUpdateChannelProperty>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesReqUpdateChannelPropertyCopyWith<$Res> {
  factory $DevicesReqUpdateChannelPropertyCopyWith(
          DevicesReqUpdateChannelProperty value,
          $Res Function(DevicesReqUpdateChannelProperty) then) =
      _$DevicesReqUpdateChannelPropertyCopyWithImpl<$Res,
          DevicesReqUpdateChannelProperty>;
  @useResult
  $Res call({DevicesUpdateChannelProperty data});

  $DevicesUpdateChannelPropertyCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesReqUpdateChannelPropertyCopyWithImpl<$Res,
        $Val extends DevicesReqUpdateChannelProperty>
    implements $DevicesReqUpdateChannelPropertyCopyWith<$Res> {
  _$DevicesReqUpdateChannelPropertyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesReqUpdateChannelProperty
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
              as DevicesUpdateChannelProperty,
    ) as $Val);
  }

  /// Create a copy of DevicesReqUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesUpdateChannelPropertyCopyWith<$Res> get data {
    return $DevicesUpdateChannelPropertyCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesReqUpdateChannelPropertyImplCopyWith<$Res>
    implements $DevicesReqUpdateChannelPropertyCopyWith<$Res> {
  factory _$$DevicesReqUpdateChannelPropertyImplCopyWith(
          _$DevicesReqUpdateChannelPropertyImpl value,
          $Res Function(_$DevicesReqUpdateChannelPropertyImpl) then) =
      __$$DevicesReqUpdateChannelPropertyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesUpdateChannelProperty data});

  @override
  $DevicesUpdateChannelPropertyCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesReqUpdateChannelPropertyImplCopyWithImpl<$Res>
    extends _$DevicesReqUpdateChannelPropertyCopyWithImpl<$Res,
        _$DevicesReqUpdateChannelPropertyImpl>
    implements _$$DevicesReqUpdateChannelPropertyImplCopyWith<$Res> {
  __$$DevicesReqUpdateChannelPropertyImplCopyWithImpl(
      _$DevicesReqUpdateChannelPropertyImpl _value,
      $Res Function(_$DevicesReqUpdateChannelPropertyImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesReqUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesReqUpdateChannelPropertyImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesUpdateChannelProperty,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesReqUpdateChannelPropertyImpl
    implements _DevicesReqUpdateChannelProperty {
  const _$DevicesReqUpdateChannelPropertyImpl({required this.data});

  factory _$DevicesReqUpdateChannelPropertyImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesReqUpdateChannelPropertyImplFromJson(json);

  @override
  final DevicesUpdateChannelProperty data;

  @override
  String toString() {
    return 'DevicesReqUpdateChannelProperty(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesReqUpdateChannelPropertyImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesReqUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesReqUpdateChannelPropertyImplCopyWith<
          _$DevicesReqUpdateChannelPropertyImpl>
      get copyWith => __$$DevicesReqUpdateChannelPropertyImplCopyWithImpl<
          _$DevicesReqUpdateChannelPropertyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesReqUpdateChannelPropertyImplToJson(
      this,
    );
  }
}

abstract class _DevicesReqUpdateChannelProperty
    implements DevicesReqUpdateChannelProperty {
  const factory _DevicesReqUpdateChannelProperty(
          {required final DevicesUpdateChannelProperty data}) =
      _$DevicesReqUpdateChannelPropertyImpl;

  factory _DevicesReqUpdateChannelProperty.fromJson(Map<String, dynamic> json) =
      _$DevicesReqUpdateChannelPropertyImpl.fromJson;

  @override
  DevicesUpdateChannelProperty get data;

  /// Create a copy of DevicesReqUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesReqUpdateChannelPropertyImplCopyWith<
          _$DevicesReqUpdateChannelPropertyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
