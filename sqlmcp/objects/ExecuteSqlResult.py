from typing import Any, TypedDict

class ExecuteSqlResult(TypedDict):
    columns: list[str]
    rows: list[list[Any]]
    count: int