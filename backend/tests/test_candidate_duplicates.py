import unittest
from types import SimpleNamespace
from uuid import UUID

from app.services import candidate_service


class FakeColumn:
    def __init__(self, name):
        self.name = name

    def __eq__(self, other):
        return ("eq", self.name, other)


class FakeQuery:
    def __init__(self, record):
        self.record = record

    def filter(self, condition):
        if not isinstance(condition, tuple):
            return self

        op, field_name, value = condition
        if self.record is None:
            return self

        actual_value = getattr(self.record, field_name)
        if op == "eq" and actual_value == value:
            return self
        return FakeQuery(None)

    def first(self):
        return self.record


class FakeDB:
    def __init__(self, record):
        self.record = record

    def query(self, _model):
        return FakeQuery(self.record)


class CandidateDuplicateCheckTest(unittest.TestCase):
    def test_check_duplicate_ignores_same_candidate_id(self):
        same_id = "fbdd1213-d927-4b53-9500-fa59a6015b9b"
        record = SimpleNamespace(
            id=UUID(same_id),
            email="same@example.com",
            phone="081234567890",
            identity_no="1234567890123",
        )

        candidate_service.Candidate = SimpleNamespace(
            email=FakeColumn("email"),
            phone=FakeColumn("phone"),
            identity_no=FakeColumn("identity_no"),
            id=FakeColumn("id"),
        )

        result = candidate_service.check_duplicate(
            FakeDB(record),
            "same@example.com",
            "081234567890",
            "1234567890123",
            exclude_candidate_id=same_id,
        )

        self.assertEqual(result, {"is_duplicate": False, "existing_id": None})


if __name__ == "__main__":
    unittest.main()
