from app.deeplinks import (
    JoinDeepLink,
    ShiftOfferDeepLink,
    build_join_payload,
    build_shift_offer_payload,
    parse_deep_link,
)


def test_parse_join_link():
    assert parse_deep_link("join_ABC123") == JoinDeepLink(code="ABC123")


def test_parse_shift_offer_link():
    offer_id = "4952b71d-5882-4d52-a197-791c3ca91081"
    assert parse_deep_link(f"off_{offer_id}") == ShiftOfferDeepLink(offer_id=offer_id)


def test_parse_unknown_payload_is_none():
    assert parse_deep_link("source=button&promo=welcome") is None


def test_parse_empty_or_missing_payload_is_none():
    assert parse_deep_link(None) is None
    assert parse_deep_link("") is None


def test_parse_prefix_with_no_code_is_none():
    assert parse_deep_link("join_") is None
    assert parse_deep_link("off_") is None


def test_build_helpers_roundtrip():
    assert parse_deep_link(build_join_payload("XYZ")) == JoinDeepLink(code="XYZ")
    assert parse_deep_link(build_shift_offer_payload("offer-1")) == ShiftOfferDeepLink(offer_id="offer-1")
