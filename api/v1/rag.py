"""Document ingestion and retrieval-augmented question answering."""

import logging
import os
import re

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.concurrency import run_in_threadpool

from agents.rag_agent import answer_from_documents
from api.deps import audit, call_llm, llm_selection
from config.settings import settings
from core.errors import AppError, PayloadTooLargeError
from core.metrics import DOCUMENTS_INGESTED
from core.security import CurrentUser, get_current_user
from rag.chunking import process_document
from rag.vector_store import add_documents, clear_collection, delete_documents_by_source, list_documents, search
from schemas.request_models import ChunkResponse, RAGQueryRequest, RAGQueryResponse, UploadResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["rag"])

_READ_CHUNK = 1024 * 1024


def safe_filename(name: str) -> str:
    """Strip any client-supplied path and control characters; keep the name human readable."""
    name = os.path.basename((name or "").replace("\\", "/"))
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()
    return name[:200] or "document"


async def _read_limited(file: UploadFile, limit_bytes: int) -> bytes:
    """Reads the upload in chunks, aborting as soon as it exceeds the limit."""
    data = bytearray()
    while chunk := await file.read(_READ_CHUNK):
        data.extend(chunk)
        if len(data) > limit_bytes:
            raise PayloadTooLargeError(f"File exceeds the {settings.MAX_UPLOAD_MB} MB upload limit.")
    return bytes(data)


@router.post("/rag/ingest", response_model=UploadResponse)
@router.post("/upload", response_model=UploadResponse, include_in_schema=False)
async def upload_document(request: Request, file: UploadFile = File(...),
                          user: CurrentUser = Depends(get_current_user)):
    filename = safe_filename(file.filename)
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.allowed_upload_extensions:
        allowed = ", ".join(e.lstrip(".").upper() for e in settings.allowed_upload_extensions)
        raise AppError(f"Unsupported file format '{ext or filename}'. Supported formats: {allowed}.",
                       code="unsupported_file_type", status_code=415)

    contents = await _read_limited(file, settings.MAX_UPLOAD_MB * 1024 * 1024)
    if not contents:
        raise AppError("The uploaded file is empty.", code="empty_file")

    try:
        chunks = await run_in_threadpool(process_document, contents, filename)
    except Exception as e:
        logger.warning("Failed to parse upload %s: %s", filename, e)
        raise AppError(f"Could not read '{filename}'. Is the file valid and not password protected?",
                       code="unreadable_file") from e
    if not chunks:
        raise AppError(f"No readable content could be extracted from '{filename}'.", code="no_content")

    # Re-uploading a file replaces its previous version rather than duplicating it
    deleted = await run_in_threadpool(delete_documents_by_source, filename, user.id)
    await run_in_threadpool(add_documents, chunks, user.id)
    DOCUMENTS_INGESTED.inc()
    audit(request, "rag.ingest", user.id, filename=filename, chunks=len(chunks), replaced=deleted)

    message = (f"Document updated successfully ({deleted} previous chunks replaced)"
               if deleted else "Document uploaded successfully")
    return UploadResponse(message=message, filename=filename, chunks_stored=len(chunks))


@router.get("/rag/documents")
def get_rag_documents(user: CurrentUser = Depends(get_current_user)):
    docs = list_documents(user.id)
    return {"documents": docs, "count": len(docs)}


@router.delete("/rag/documents")
def clear_rag_documents(request: Request, user: CurrentUser = Depends(get_current_user)):
    removed = clear_collection(user.id)
    audit(request, "rag.clear", user.id, chunks=removed)
    return {"message": "Knowledge base cleared successfully", "success": True, "chunks_removed": removed}


@router.delete("/rag/documents/{source}")
def delete_rag_document(source: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    removed = delete_documents_by_source(source, user.id)
    audit(request, "rag.delete", user.id, filename=source, chunks=removed)
    return {"message": f"Removed '{source}'", "chunks_removed": removed}


@router.post("/rag/query", response_model=RAGQueryResponse)
def rag_query(request: RAGQueryRequest, user: CurrentUser = Depends(get_current_user)):
    # Retrieve once and reuse the same chunks for both the answer and the citations
    results = search(user.id, request.query, top_k=request.top_k, source=request.source)
    docs = [doc for doc, _ in results]
    llm = llm_selection(request)
    answer = call_llm(answer_from_documents, request.query, docs,
                      provider=llm.provider, model_name=llm.model, api_key=llm.api_key)

    chunks = [
        ChunkResponse(content=doc.page_content,
                      score=round(score, 4) if score is not None else None,
                      source=doc.metadata.get("source", "unknown"))
        for doc, score in results
    ]
    sources = list(dict.fromkeys(c.source for c in chunks))
    return RAGQueryResponse(answer=answer, sources=sources, chunks=chunks)
