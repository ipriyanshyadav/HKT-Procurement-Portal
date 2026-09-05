from fastapi import APIRouter

router = APIRouter(tags=["Award"])

@router.get("/health")
async def health():
    return {"status": "ok", "module": "award"}
