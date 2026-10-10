"""
One-off migration: assign RAG chunks ingested before per-user isolation to an owner.

Documents uploaded with Pluto < 2.0 have no `owner` metadata, so after upgrading they
are invisible to every user. Run this once to hand them to an account:

    python -m scripts.assign_legacy_documents --owner 1            # a user ID
    python -m scripts.assign_legacy_documents --owner 1 --dry-run  # preview only

Use the numeric ID from the `users` table (shown as `id` by GET /api/v1/auth/me).
"""

import argparse
import sys

from rag.vector_store import _vectorstore, get_collection_name

BATCH = 500


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--owner", required=True, help="User ID that should own the legacy documents")
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing")
    args = parser.parse_args()

    collection = _vectorstore()._collection
    data = collection.get(include=["metadatas"])
    legacy = [(i, m or {}) for i, m in zip(data["ids"], data["metadatas"], strict=True) if not (m or {}).get("owner")]

    sources = sorted({m.get("source", "unknown") for _, m in legacy})
    print(f"Collection '{get_collection_name()}': {len(data['ids'])} chunks, {len(legacy)} without an owner")
    for s in sources:
        print(f"  - {s}")
    if not legacy or args.dry_run:
        return 0

    for start in range(0, len(legacy), BATCH):
        batch = legacy[start:start + BATCH]
        collection.update(ids=[i for i, _ in batch], metadatas=[{**m, "owner": args.owner} for _, m in batch])
    print(f"Assigned {len(legacy)} chunks to owner {args.owner}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
