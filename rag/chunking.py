import os
import tempfile
import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader

logger = logging.getLogger(__name__)


async def save_upload_file(upload_file):
    suffix = os.path.splitext(upload_file.filename or "")[1].lower()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        contents = await upload_file.read()
        temp.write(contents)
        temp_path = temp.name
    return temp_path


def load_document(file_path: str, original_filename: str = ""):
    ext = os.path.splitext(file_path)[1].lower()
    docs = []
    try:
        if ext == ".pdf":
            loader = PyPDFLoader(file_path=file_path)
            docs = loader.load()
        elif ext in [".txt", ".md", ".csv", ".json", ".log"]:
            try:
                loader = TextLoader(file_path=file_path, encoding="utf-8")
                docs = loader.load()
            except UnicodeDecodeError:
                loader = TextLoader(file_path=file_path, encoding="latin-1")
                docs = loader.load()
        elif ext == ".docx":
            loader = Docx2txtLoader(file_path=file_path)
            docs = loader.load()
        else:
            try:
                loader = TextLoader(file_path=file_path, encoding="utf-8")
                docs = loader.load()
            except Exception:
                raise ValueError(
                    f"Unsupported file format '{ext}'. Supported formats are: PDF, TXT, MD, DOCX, CSV, JSON."
                )

        # Set clean user-facing document filename in metadata
        display_name = original_filename or os.path.basename(file_path)
        for doc in docs:
            doc.metadata["source"] = display_name
            doc.metadata["filename"] = display_name

        return docs
    except Exception as e:
        logger.error(f"Error loading document '{file_path}': {e}", exc_info=True)
        raise


def chunking(docs):
    splitter = RecursiveCharacterTextSplitter(
        chunk_overlap=200,
        chunk_size=1000,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    return splitter.split_documents(docs)


async def process_document(upload_file):
    temp_path = await save_upload_file(upload_file)
    try:
        docs = load_document(temp_path, original_filename=upload_file.filename)
        chunks = chunking(docs)
        return chunks
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)