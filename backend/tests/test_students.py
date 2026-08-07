from pathlib import Path

from app.students.importer import parse_tutors_csv
from app.students.seed import RESOURCE_SEED
from app.students.service import (
    is_valid_group_code,
    normalize_bookmark_label,
    normalize_group_code,
    require_valid_group_code,
)


def test_group_normalization_handles_spaces_case_and_dashes() -> None:
    assert normalize_group_code(" 220031 – 22 ") == "220031-22"
    assert normalize_group_code(" 222 222 ") == "222222"
    assert is_valid_group_code("220031‑22")
    assert not is_valid_group_code("ИВТ-101")
    assert require_valid_group_code(" 220031 — 22 ") == "220031-22"


def test_bookmark_label_is_trimmed_without_changing_user_text() -> None:
    assert normalize_bookmark_label("  Группа   Ксюши 😈  ") == "Группа Ксюши 😈"


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


def test_resource_catalog_has_stable_contextual_metadata() -> None:
    resources = [
        resource
        for _, (_, category_resources) in RESOURCE_SEED.items()
        for resource in category_resources
    ]

    assert len({resource.slug for resource in resources}) == len(resources)
    assert len({resource.url for resource in resources}) == len(resources)
    assert all(resource.description for resource in resources)
    assert all(resource.source_kind in {"official", "student"} for resource in resources)
    assert any("events" in resource.contexts for resource in resources)
    assert any("about" in resource.contexts for resource in resources)
    assert any("meeting" in resource.contexts for resource in resources)
