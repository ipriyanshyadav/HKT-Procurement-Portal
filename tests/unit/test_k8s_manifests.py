"""Unit tests for SPEC_21 Infrastructure & Deployment Kubernetes manifests."""

import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
K8S_DIR = ROOT_DIR / "k8s"


def test_base_kustomize_build():
    """Verify that k8s/base builds cleanly with kubectl kustomize."""
    cmd = ["kubectl", "kustomize", str(K8S_DIR / "base")]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    assert res.returncode == 0
    content = res.stdout
    assert "kind: Namespace" in content
    assert "kind: Deployment" in content
    assert "kind: StatefulSet" in content
    assert "kind: Service" in content
    assert "kind: HorizontalPodAutoscaler" in content
    assert "kind: PodDisruptionBudget" in content
    assert "kind: NetworkPolicy" in content


def test_overlays_kustomize_build():
    """Verify that all overlays build cleanly."""
    for overlay in ["dev", "staging", "production", "dr"]:
        overlay_path = K8S_DIR / "overlays" / overlay
        cmd = ["kubectl", "kustomize", str(overlay_path)]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        assert res.returncode == 0, f"Overlay {overlay} failed to build: {res.stderr}"
        assert len(res.stdout) > 1000


def test_frontend_deployments_and_services():
    """Verify buyer, supplier, and admin portal manifests exist and configure ports."""
    cmd = ["kubectl", "kustomize", str(K8S_DIR / "base")]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    manifests = res.stdout

    # Deployments
    assert "name: buyer-portal" in manifests
    assert "name: supplier-portal" in manifests
    assert "name: admin-portal" in manifests

    # Services
    assert "port: 3000" in manifests
    assert "port: 3001" in manifests
    assert "port: 3002" in manifests


def test_hpa_and_pdb_configurations():
    """Verify HPA and PDB specs for API and Celery."""
    cmd = ["kubectl", "kustomize", str(K8S_DIR / "base")]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    manifests = res.stdout

    # API HPA: min 3, max 15
    assert "name: procurement-api-hpa" in manifests
    assert "minReplicas: 3" in manifests
    assert "maxReplicas: 15" in manifests

    # Celery HPA: min 2, max 10
    assert "name: celery-worker-hpa" in manifests
    assert "minReplicas: 2" in manifests
    assert "maxReplicas: 10" in manifests

    # PDBs: minAvailable 2 for API, 1 for Celery
    assert "name: procurement-api-pdb" in manifests
    assert "minAvailable: 2" in manifests
    assert "name: celery-worker-pdb" in manifests
    assert "minAvailable: 1" in manifests


def test_kong_declarative_routes():
    """Verify Kong declarative configuration includes frontend routes and API routes."""
    kong_config_path = K8S_DIR / "base" / "kong" / "configmap.yaml"
    assert kong_config_path.exists()
    content = kong_config_path.read_text()

    assert "apps.procurement.com" in content
    assert "supplier.procurement.com" in content
    assert "admin.procurement.com" in content
    assert "/api/v1" in content
    assert "/ws" in content


def test_network_policies_present():
    """Verify network policies enforce zero-trust and selective allow."""
    cmd = ["kubectl", "kustomize", str(K8S_DIR / "base")]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    manifests = res.stdout

    assert "name: default-deny-all" in manifests
    assert "name: allow-kong-to-api" in manifests
    assert "name: allow-kong-to-frontends" in manifests
    assert "name: allow-frontend-to-api" in manifests
    assert "name: allow-api-celery-egress" in manifests
    assert "name: allow-pgbouncer" in manifests
    assert "name: allow-postgresql" in manifests
    assert "name: allow-redis" in manifests
    assert "name: allow-rabbitmq" in manifests
    assert "name: allow-minio" in manifests
    assert "name: allow-elasticsearch" in manifests


def test_stateful_services():
    """Verify all required stateful services exist in base."""
    cmd = ["kubectl", "kustomize", str(K8S_DIR / "base")]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    manifests = res.stdout

    # Postgres
    assert "name: postgresql" in manifests
    assert "name: postgresql-primary" in manifests
    assert "name: postgresql-read" in manifests
    # PgBouncer
    assert "name: pgbouncer" in manifests
    # Redis
    assert "name: redis-master" in manifests
    assert "name: redis-sentinel" in manifests
    # RabbitMQ
    assert "name: rabbitmq" in manifests
    # MinIO
    assert "name: minio" in manifests
    assert "name: minio-console" in manifests
    # Elasticsearch
    assert "name: elasticsearch" in manifests


def test_production_sealed_secrets():
    """Verify production overlay includes SealedSecrets."""
    cmd = ["kubectl", "kustomize", str(K8S_DIR / "overlays" / "production")]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    manifests = res.stdout

    assert "kind: SealedSecret" in manifests
    assert "name: procurement-secrets" in manifests
    assert "name: postgresql-secrets" in manifests
    assert "name: redis-secrets" in manifests
    assert "name: rabbitmq-secrets" in manifests
    assert "name: minio-secrets" in manifests


def test_velero_and_cert_manager():
    """Verify Velero backup schedule and cert-manager ClusterIssuers."""
    cmd = ["kubectl", "kustomize", str(K8S_DIR / "base")]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    manifests = res.stdout

    assert "kind: Schedule" in manifests
    assert "procurement-daily-backup" in manifests
    assert "ttl: 720h0m0s" in manifests

    assert "kind: ClusterIssuer" in manifests
    assert "letsencrypt-staging" in manifests
    assert "letsencrypt-prod" in manifests
