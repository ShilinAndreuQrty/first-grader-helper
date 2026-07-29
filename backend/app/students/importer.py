from __future__ import annotations

import argparse
import asyncio
import csv
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel, HttpUrl, ValidationError
from sqlalchemy import select

from app.db import SessionFactory
from app.models import GroupTutor, StudentGroup, Tutor
from app.students.service import require_valid_group_code


class TutorCsvRow(BaseModel):
    group_code: str
    academic_year: str = ""
    tutor_name: str
    tutor_vk_url: HttpUrl
    description: str = ""


@dataclass
class CsvImportResult:
    rows: list[TutorCsvRow]
    errors: list[str]


def parse_tutors_csv(path: Path) -> CsvImportResult:
    rows: list[TutorCsvRow] = []
    errors: list[str] = []
    with path.open(encoding="utf-8-sig", newline="") as source:
        for number, raw in enumerate(csv.DictReader(source), start=2):
            try:
                row = TutorCsvRow.model_validate(raw)
                row.group_code = require_valid_group_code(row.group_code)
                rows.append(row)
            except (ValidationError, ValueError) as error:
                message = (
                    error.errors()[0]["msg"]
                    if isinstance(error, ValidationError)
                    else str(error)
                )
                errors.append(f"row {number}: {message}")
    return CsvImportResult(rows=rows, errors=errors)


async def import_tutors_csv(path: Path) -> dict[str, int]:
    result = parse_tutors_csv(path)
    if result.errors:
        raise ValueError("\n".join(result.errors))

    counters = {"groups_created": 0, "tutors_created": 0, "links_created": 0}
    async with SessionFactory() as db:
        for row in result.rows:
            group = await db.scalar(
                select(StudentGroup).where(
                    StudentGroup.normalized_code == row.group_code
                )
            )
            if group is None:
                group = StudentGroup(
                    code=row.group_code,
                    normalized_code=row.group_code,
                    academic_year=row.academic_year,
                )
                db.add(group)
                await db.flush()
                counters["groups_created"] += 1

            vk_url = str(row.tutor_vk_url)
            tutor = await db.scalar(select(Tutor).where(Tutor.vk_url == vk_url))
            if tutor is None:
                tutor = Tutor(
                    full_name=row.tutor_name.strip(),
                    vk_url=vk_url,
                    description=row.description.strip(),
                    status="needs_review",
                )
                db.add(tutor)
                await db.flush()
                counters["tutors_created"] += 1

            association = await db.get(
                GroupTutor,
                {"group_id": group.id, "tutor_id": tutor.id},
            )
            if association is None:
                db.add(GroupTutor(group_id=group.id, tutor_id=tutor.id))
                counters["links_created"] += 1
        await db.commit()
    return counters


def main() -> None:
    parser = argparse.ArgumentParser(description="Import group-to-tutor CSV")
    parser.add_argument("source", type=Path)
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Check the file without changing the database",
    )
    args = parser.parse_args()
    result = parse_tutors_csv(args.source)
    if args.validate_only or result.errors:
        print(f"valid={len(result.rows)} errors={len(result.errors)}")
        for error in result.errors:
            print(error)
    if result.errors:
        raise SystemExit(1)
    if not args.validate_only:
        print(asyncio.run(import_tutors_csv(args.source)))


if __name__ == "__main__":
    main()
