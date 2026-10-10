"""Code generation and automated code review."""

from fastapi import APIRouter, Depends

from agents.code_critic import run_code_critic
from agents.code_generator import run_code_generator
from api.deps import call_llm, llm_selection
from core.security import CurrentUser, get_current_user
from schemas.request_models import CodeCriticRequest, CodeCriticResponse, CodeGenerateRequest, CodeGenerateResponse

router = APIRouter(prefix="/code", tags=["code"])


@router.post("/generate", response_model=CodeGenerateResponse)
def code_generate(request: CodeGenerateRequest, user: CurrentUser = Depends(get_current_user)):
    llm = llm_selection(request)
    code = call_llm(
        run_code_generator,
        query=request.query,
        project_context=request.project_context,
        feedback=request.feedback,
        provider=llm.provider,
        model_name=llm.model,
        api_key=llm.api_key,
    )
    return CodeGenerateResponse(code=code)


@router.post("/critic", response_model=CodeCriticResponse)
def code_critic(request: CodeCriticRequest, user: CurrentUser = Depends(get_current_user)):
    llm = llm_selection(request)
    result = call_llm(
        run_code_critic,
        user_request=request.user_request,
        generated_code=request.generated_code,
        provider=llm.provider,
        model_name=llm.model,
        api_key=llm.api_key,
    )
    return CodeCriticResponse(**result)
