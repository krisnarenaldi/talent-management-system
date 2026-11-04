from sqlalchemy.orm import Session
from sqlalchemy import update, func
from app.models.application import Application


def bulk_reject_applications(
    db: Session,
    position_ids: list[str],
    reason: str,
) -> int:
    """
    Set all Application rows with status='active' for the given position_ids
    to status='rejected' with the provided reason.
    Returns the number of rows updated.
    """
    if not position_ids:
        return 0
    stmt = (
        update(Application)
        .where(
            Application.position_id.in_(position_ids),
            Application.status == "active",
        )
        .values(
            status="rejected",
            reject_reason=reason,
            updated_at=func.now(),
        )
        .execution_options(synchronize_session="fetch")
    )
    result = db.execute(stmt)
    return result.rowcount
