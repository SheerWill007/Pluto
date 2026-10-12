import logging
import os
import tempfile
from datetime import datetime, timezone

from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".log"}


def load_document(file_path: str, original_filename: str = ""):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        docs = PyPDFLoader(file_path=file_path).load()
    elif ext == ".docx":
        docs = Docx2txtLoader(file_path=file_path).load()
    elif ext in TEXT_EXTENSIONS:
        try:
            docs = TextLoader(file_path=file_path, encoding="utf-8").load()
        except Exception:
            docs = TextLoader(file_path=file_path, encoding="latin-1").load()
    else:
        raise ValueError(f"Unsupported file format '{ext}'.")

    display_name = original_filename or os.path.basename(file_path)
    for doc in docs:
        doc.metadata["source"] = display_name
        doc.metadata["filename"] = display_name
    return docs


def chunking(docs):
    splitter = RecursiveCharacterTextSplitter(
        chunk_overlap=200,
        chunk_size=1000,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(docs)
    ingested_at = datetime.now(timezone.utc).isoformat()
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = i
        chunk.metadata["ingested_at"] = ingested_at
    return chunks


def process_document(contents: bytes, filename: str):
    """Parses raw upload bytes into chunks. Blocking -- call from a worker thread."""
    suffix = os.path.splitext(filename)[1].lower()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        temp.write(contents)
        temp_path = temp.name
    try:
        return chunking(load_document(temp_path, original_filename=filename))
    finally:
        os.unlink(temp_path)
