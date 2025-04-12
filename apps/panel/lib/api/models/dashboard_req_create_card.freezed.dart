// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_card.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreateCard _$DashboardReqCreateCardFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqCreateCard.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqCreateCard {
  DashboardCreateCard get data => throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreateCard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreateCardCopyWith<DashboardReqCreateCard> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreateCardCopyWith<$Res> {
  factory $DashboardReqCreateCardCopyWith(DashboardReqCreateCard value,
          $Res Function(DashboardReqCreateCard) then) =
      _$DashboardReqCreateCardCopyWithImpl<$Res, DashboardReqCreateCard>;
  @useResult
  $Res call({DashboardCreateCard data});

  $DashboardCreateCardCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqCreateCardCopyWithImpl<$Res,
        $Val extends DashboardReqCreateCard>
    implements $DashboardReqCreateCardCopyWith<$Res> {
  _$DashboardReqCreateCardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreateCard
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
              as DashboardCreateCard,
    ) as $Val);
  }

  /// Create a copy of DashboardReqCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardCreateCardCopyWith<$Res> get data {
    return $DashboardCreateCardCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqCreateCardImplCopyWith<$Res>
    implements $DashboardReqCreateCardCopyWith<$Res> {
  factory _$$DashboardReqCreateCardImplCopyWith(
          _$DashboardReqCreateCardImpl value,
          $Res Function(_$DashboardReqCreateCardImpl) then) =
      __$$DashboardReqCreateCardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardCreateCard data});

  @override
  $DashboardCreateCardCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqCreateCardImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateCardCopyWithImpl<$Res,
        _$DashboardReqCreateCardImpl>
    implements _$$DashboardReqCreateCardImplCopyWith<$Res> {
  __$$DashboardReqCreateCardImplCopyWithImpl(
      _$DashboardReqCreateCardImpl _value,
      $Res Function(_$DashboardReqCreateCardImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqCreateCardImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardCreateCard,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreateCardImpl implements _DashboardReqCreateCard {
  const _$DashboardReqCreateCardImpl({required this.data});

  factory _$DashboardReqCreateCardImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardImplFromJson(json);

  @override
  final DashboardCreateCard data;

  @override
  String toString() {
    return 'DashboardReqCreateCard(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardImplCopyWith<_$DashboardReqCreateCardImpl>
      get copyWith => __$$DashboardReqCreateCardImplCopyWithImpl<
          _$DashboardReqCreateCardImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreateCardImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqCreateCard implements DashboardReqCreateCard {
  const factory _DashboardReqCreateCard(
      {required final DashboardCreateCard data}) = _$DashboardReqCreateCardImpl;

  factory _DashboardReqCreateCard.fromJson(Map<String, dynamic> json) =
      _$DashboardReqCreateCardImpl.fromJson;

  @override
  DashboardCreateCard get data;

  /// Create a copy of DashboardReqCreateCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardImplCopyWith<_$DashboardReqCreateCardImpl>
      get copyWith => throw _privateConstructorUsedError;
}
