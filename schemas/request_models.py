from pydantic import BaseModel, Field
from typing import Optional, List


class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Session ID for memory")
    provider: Optional[str] = None
    model: Optional[str] = None
    agent_mode: Optional[bool] = False
    api_key: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    agent_used: str
    session_id: Optional[str] = None


class ChunkResponse(BaseModel):
    content: str
    score: Optional[float] = None
    source: Optional[str] = None


class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="Query to search in documents")
    top_k: int = Field(default=4, description="Number of chunks to retrieve")
    source: Optional[str] = Field(default=None, description="Optional document source/filename to scope search")
    session_id: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


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
    version: str = "1.0.0"


class GmailResponse(BaseModel):
    summary: str


class GmailSummarizeRequest(BaseModel):
    email_ids: Optional[List[str]] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


class CodeGenerateRequest(BaseModel):
    query: str = Field(..., description="Coding task request prompt")
    project_context: Optional[str] = Field(None, description="Existing source code or project context")
    feedback: Optional[str] = Field(None, description="Critic reviewer suggestions feedback")
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


class CodeGenerateResponse(BaseModel):
    code: str
    message: Optional[str] = None


class CodeCriticRequest(BaseModel):
    user_request: str = Field(..., description="What was requested by the user")
    generated_code: str = Field(..., description="The code output to analyze")
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


class CodeCriticResponse(BaseModel):
    approved: bool
    code: str
    feedback: str


class UserSignUpRequest(BaseModel):
    email: str
    password: str
    name: str


class UserLoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None
