from app.payloads import (
    AcceptShiftOfferPayload,
    RejectLeaveRequestPayload,
    RejectLeaveRequestPromptPayload,
)


def test_reject_prompt_payload_roundtrip():
    packed = RejectLeaveRequestPromptPayload(request_id="abc-123").pack()
    unpacked = RejectLeaveRequestPromptPayload.unpack(packed)
    assert unpacked.request_id == "abc-123"


def test_reject_payload_roundtrip():
    packed = RejectLeaveRequestPayload(request_id="abc-123", reason_code="team_overlap").pack()
    unpacked = RejectLeaveRequestPayload.unpack(packed)
    assert unpacked.request_id == "abc-123"
    assert unpacked.reason_code == "team_overlap"


def test_accept_shift_offer_payload_roundtrip():
    packed = AcceptShiftOfferPayload(offer_id="offer-1").pack()
    unpacked = AcceptShiftOfferPayload.unpack(packed)
    assert unpacked.offer_id == "offer-1"


def test_payloads_have_distinct_prefixes():
    prefixes = {
        RejectLeaveRequestPromptPayload.prefix,
        RejectLeaveRequestPayload.prefix,
        AcceptShiftOfferPayload.prefix,
    }
    assert len(prefixes) == 3
