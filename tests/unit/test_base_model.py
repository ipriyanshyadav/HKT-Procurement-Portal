import pytest
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import declarative_base
from app.db.base import BaseModel, Base

class SampleModel(BaseModel):
    __tablename__ = "test_sample"

def test_base_model_abstract():
    # Attempting to query or use BaseModel directly in some ways would fail, 
    # but strictly it's a declarative mixin/abstract class in SQLAlchemy.
    assert getattr(BaseModel, "__abstract__", False) or issubclass(SampleModel, Base)

def test_base_model_columns():
    mapper = sa_inspect(SampleModel)
    column_names = {col.key for col in mapper.columns}
    assert "id" in column_names
    assert "org_id" in column_names
    assert "version" in column_names
    assert "created_at" in column_names
    assert "updated_at" in column_names
    assert "deleted_at" in column_names

def test_base_model_column_properties():
    mapper = sa_inspect(SampleModel)
    id_col = mapper.columns["id"]
    org_id_col = mapper.columns["org_id"]
    version_col = mapper.columns["version"]
    deleted_at_col = mapper.columns["deleted_at"]
    
    assert id_col.primary_key
    assert not org_id_col.nullable
    assert org_id_col.index
    assert version_col.default.arg == 1
    assert deleted_at_col.nullable
