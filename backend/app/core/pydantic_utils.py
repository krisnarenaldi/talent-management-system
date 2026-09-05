"""
Common Pydantic utilities for TMS.
Menyediakan helper untuk convert UUID model fields ke string agar
respons API konsisten dan tidak error saat Serialisasi SQLAlchemy → Pydantic.
"""
from uuid import UUID

from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


class AutoStrUUID:
    """Pydantic type yang otomatis coerce UUID → string."""

    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: type, _handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        return core_schema.with_info_after_validator_function(
            lambda v, info: str(v) if isinstance(v, UUID) else v,
            core_schema.union_schema([
                core_schema.uuid_schema(),
                core_schema.str_schema(),
            ]),
        )
