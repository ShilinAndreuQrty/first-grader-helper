from pathlib import Path

from app.students.importer import parse_tutors_csv
from app.students.service import (
    is_valid_group_code,
    normalize_group_code,
    require_valid_group_code,
)


def test_group_normalization_handles_spaces_case_and_dashes() -> None:
    assert normalize_group_code(" 220031 – 22 ") == "220031-22"
    assert normalize_group_code(" 222 222 ") == "222222"
    assert is_valid_group_code("220031‑22")
    assert not is_valid_group_code("ИВТ-101")
    assert require_valid_group_code(" 220031 — 22 ") == "220031-22"


def test_csv_import_validates_and_normalizes(tmp_path: Path) -> None:
    source = tmp_path / "tutors.csv"
    source.write_text(
        "group_code,academic_year,tutor_name,tutor_vk_url,description\n"
        "220031 – 22,2026/27,Анна Иванова,https://vk.ru/id1,Тьютор\n"
        "ИВТ-102,2026/27,Иван Иванов,https://vk.ru/id2,\n",
        encoding="utf-8",
    )

    result = parse_tutors_csv(source)

    assert len(result.rows) == 1
    assert result.rows[0].group_code == "220031-22"
    assert len(result.errors) == 1
