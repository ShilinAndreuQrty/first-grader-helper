from pathlib import Path

from app.students.importer import parse_tutors_csv
from app.students.service import normalize_group_code


def test_group_normalization_handles_spaces_case_and_dashes() -> None:
    assert normalize_group_code("  ивт – 101 ") == "ИВТ-101"
    assert normalize_group_code("ивт‑101") == "ИВТ-101"


def test_csv_import_validates_and_normalizes(tmp_path: Path) -> None:
    source = tmp_path / "tutors.csv"
    source.write_text(
        "group_code,academic_year,tutor_name,tutor_vk_url,description\n"
        "ивт – 101,2026/27,Анна Иванова,https://vk.ru/id1,Тьютор\n"
        "ИВТ-102,2026/27,Иван Иванов,not-a-url,\n",
        encoding="utf-8",
    )

    result = parse_tutors_csv(source)

    assert len(result.rows) == 1
    assert result.rows[0].group_code == "ИВТ-101"
    assert len(result.errors) == 1
