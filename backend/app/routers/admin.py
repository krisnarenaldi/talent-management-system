from fastapi import APIRouter

from app.routers.agreement_types import router as agreement_types_router
from app.routers.blacklist_status_types import router as blacklist_status_types_router

router = APIRouter()

# Redirect admin-level endpoints ke router terpisah
router.include_router(agreement_types_router, prefix="/agreement-types", tags=["Agreement Types"])
router.include_router(blacklist_status_types_router, prefix="/blacklist-status-types", tags=["Blacklist Status Types"])
