from decimal import Decimal
from app.core.salary_parser import parse_salary_range


def test_parse_single_number():
    min_sal, max_sal = parse_salary_range(10000000)
    assert min_sal == Decimal("10000000")
    assert max_sal is None


def test_parse_single_string():
    min_sal, max_sal = parse_salary_range("10000000")
    assert min_sal == Decimal("10000000")
    assert max_sal is None


def test_parse_range_hyphen():
    min_sal, max_sal = parse_salary_range("9400000 - 10000000")
    assert min_sal == Decimal("9400000")
    assert max_sal == Decimal("10000000")


def test_parse_range_formatted():
    min_sal, max_sal = parse_salary_range("Rp 9.400.000 - 10.000.000")
    assert min_sal == Decimal("9400000")
    assert max_sal == Decimal("10000000")


def test_parse_range_inverted():
    min_sal, max_sal = parse_salary_range("12000000 - 10000000")
    assert min_sal == Decimal("10000000")
    assert max_sal == Decimal("12000000")


def test_parse_none():
    min_sal, max_sal = parse_salary_range(None)
    assert min_sal is None
    assert max_sal is None
