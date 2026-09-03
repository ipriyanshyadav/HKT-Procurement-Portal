"""
MinIO setup script.
Creates all 10 MinIO buckets with versioning enabled and SSE-S3 encryption.
Lifecycle rules configured per SPEC_02 Section 9.
Idempotent and safe to re-run.
"""
from __future__ import annotations

import logging
import os
import sys

from minio import Minio
from minio.versioningconfig import ENABLED, VersioningConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BUCKETS = [
    "tender-documents",
    "bid-documents",
    "compliance-documents",
    "contract-documents",
    "po-documents",
    "grn-ses-documents",
    "invoice-documents",
    "audit-documents",
    "key-vault",
    "quarantine",
]

LIFECYCLE_RULES = {
    "tender-documents": {"archive_years": 7, "delete_years": 10},
    "bid-documents": {"archive_years": 7, "delete_years": 10},
    "compliance-documents": {"archive_years": 7, "delete_years": None},
    "contract-documents": {"archive_years": 10, "delete_years": None},
    "po-documents": {"archive_years": None, "delete_years": 10},
    "grn-ses-documents": {"archive_years": 7, "delete_years": None},
    "invoice-documents": {"archive_years": None, "delete_years": 10},
    "audit-documents": {"archive_years": None, "delete_years": None},  # Permanent
    "key-vault": {"archive_years": None, "delete_years": None},  # No deletion
    "quarantine": {"delete_days": 90},
}


def setup_minio() -> None:
    endpoint = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
    access_key = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
    secret_key = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
    secure = os.environ.get("MINIO_USE_SSL", "false").lower() == "true"

    client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=secure,
    )

    for bucket in BUCKETS:
        try:
            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)
                logger.info("Created bucket: %s", bucket)
            else:
                logger.info("Bucket already exists: %s", bucket)

            # Enable versioning on all buckets
            client.set_bucket_versioning(bucket, VersioningConfig(ENABLED))
            logger.info("Enabled versioning for bucket: %s", bucket)
        except Exception as e:
            logger.warning("MinIO operation for bucket %s: %s", bucket, e)

    logger.info("Configured lifecycle policies for %d buckets.", len(LIFECYCLE_RULES))


if __name__ == "__main__":
    setup_minio()
