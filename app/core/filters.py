from __future__ import annotations
from typing import Any, Dict, Optional
from sqlalchemy import and_, or_, between


class FilterBuilder:
    """Builds SQLAlchemy filter conditions from query parameters and dictionary specs."""

    def apply(self, query: Any, model: Any, filters: Dict[str, Any]) -> Any:
        conditions = []
        for field, value in filters.items():
            if not hasattr(model, field):
                continue
            col = getattr(model, field)
            if isinstance(value, list):
                conditions.append(col.in_(value))
            elif isinstance(value, dict):
                if "gte" in value:
                    conditions.append(col >= value["gte"])
                if "lte" in value:
                    conditions.append(col <= value["lte"])
                if "gt" in value:
                    conditions.append(col > value["gt"])
                if "lt" in value:
                    conditions.append(col < value["lt"])
                if "in" in value:
                    conditions.append(col.in_(value["in"]))
                if "ilike" in value and hasattr(col, "ilike"):
                    conditions.append(col.ilike(f"%{value['ilike']}%"))
            elif value is None:
                conditions.append(col.is_(None))
            else:
                conditions.append(col == value)
        return query.where(and_(*conditions)) if conditions else query


filter_builder = FilterBuilder()
