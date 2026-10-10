from fastapi import APIRouter, Depends

from core.rate_limit import default_rate_limit

from . import auth, chat, code, gmail, rag, system

router = APIRouter()
router.include_router(system.router)
router.include_router(auth.router)
router.include_router(chat.router, dependencies=[Depends(default_rate_limit)])
router.include_router(rag.router, dependencies=[Depends(default_rate_limit)])
router.include_router(code.router, dependencies=[Depends(default_rate_limit)])
router.include_router(gmail.router, dependencies=[Depends(default_rate_limit)])
