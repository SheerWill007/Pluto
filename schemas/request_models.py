import re
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from config.settings import APP_VERSION

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Upper bounds stop accidental (or malicious) multi-megabyte prompts from reaching paid LLM APIs
MAX_MESSAGE_CHARS = 32_000
MAX_CONTEXT_CHARS = 100_000


class LLMOptions(BaseModel):
    provider: Optional[str] = Field(None, max_length=32)
    model: Optional[str] = Field(None, max_length=128)
    api_key: Optional[str] = Field(None, max_length=512)


class ChatRequest(LLMOptions):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS, description="User message")
    session_id: Optional[str] = Field(None, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$",
                                      description="Conversation ID for memory")
    agent_mode: Optional[bool] = False
    system_prompt: Optional[str] = Field(None, max_length=8_000)


class ChatResponse(BaseModel):
    response: str
    agent_used: str
    session_id: Optional[str] = None


class ChunkResponse(BaseModel):
    content: str
    score: Optional[float] = None
    source: Optional[str] = None


class RAGQueryRequest(LLMOptions):
    query: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS, description="Query to search in documents")
    top_k: int = Field(default=4, ge=1, le=20, description="Number of chunks to retrieve")
    source: Optional[str] = Field(default=None, max_length=255, description="Optional document filename to scope search")
    session_id: Optional[str] = Field(None, max_length=128)


class RAGQueryResponse(BaseModel):
    answer: str
    sources: List[str] = []
    chunks: List[ChunkResponse] = []


class UploadResponse(BaseModel):
    message: str
    filename: str
    chunks_stored: int


class HealthResponse(BaseModel):
    status: str
    version: str = APP_VERSION


class GmailResponse(BaseModel):
    summary: str


class GmailSummarizeRequest(LLMOptions):
    email_ids: Optional[List[str]] = Field(None, max_length=25)


class CodeGenerateRequest(LLMOptions):
    query: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS, description="Coding task request prompt")
    project_context: Optional[str] = Field(None, max_length=MAX_CONTEXT_CHARS, description="Existing source code or project context")
    feedback: Optional[str] = Field(None, max_length=MAX_MESSAGE_CHARS, description="Critic reviewer suggestions feedback")


class CodeGenerateResponse(BaseModel):
    code: str
    message: Optional[str] = None


class CodeCriticRequest(LLMOptions):
    user_request: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS, description="What was requested by the user")
    generated_code: str = Field(..., min_length=1, max_length=MAX_CONTEXT_CHARS, description="The code output to analyze")


class CodeCriticResponse(BaseModel):
    approved: bool
    code: str
    feedback: str


def _normalize_email(value: str) -> str:
    value = value.strip().lower()
    if len(value) > 254 or not _EMAIL_RE.match(value):
        raise ValueError("must be a valid email address")
    return value


class UserSignUpRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=100)

    _email = field_validator("email")(lambda cls, v: _normalize_email(v))

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("must contain at least one letter and one number")
        return v

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class UserLoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1, max_length=128)

    _email = field_validator("email")(lambda cls, v: _normalize_email(v))


class GoogleAuthRequest(BaseModel):
    """
    The client sends the OAuth token it received from Google; the server verifies it with
    Google and derives the identity from it. Self-asserted emails are never trusted.
    """
    access_token: Optional[str] = Field(None, max_length=4096)
    id_token: Optional[str] = Field(None, max_length=8192)
    # Authorization-code + PKCE flow: the server performs the exchange so the client
    # secret never has to live in the browser
    code: Optional[str] = Field(None, max_length=2048)
    code_verifier: Optional[str] = Field(None, max_length=256)
    redirect_uri: Optional[str] = Field(None, max_length=2048)

    @model_validator(mode="after")
    def require_token(self):
        if not (self.access_token or self.id_token or (self.code and self.code_verifier and self.redirect_uri)):
            raise ValueError("access_token, id_token, or code + code_verifier + redirect_uri is required")
        return self


class AuthUserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: str
    token: str
    expires_in: int
