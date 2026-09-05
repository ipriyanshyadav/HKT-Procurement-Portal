# IMPLEMENTATION PLAN — SPEC_21: Infrastructure & Deployment
**Module:** 21 | **Phase:** Foundation | **Squad:** A (DevOps)
**Spec File:** SPEC_21_INFRASTRUCTURE.md | **Plan Date:** 2026-08-04

---
## SPEC COVERAGE MAP
| Req# | Section | Target | Status |
|---|---|---|---|
| S21-01 | K3s cluster: 1 control plane + 3 worker nodes | k8s/base/ manifests | DONE |
| S21-02 | Namespaces: procurement, monitoring, logging, infra | k8s/base/namespaces.yaml | DONE |
| S21-03 | PostgreSQL 16 HA (Bitnami chart, primary+replica) | k8s/base/postgresql/ | DONE |
| S21-04 | PgBouncer sidecar | k8s/base/pgbouncer/ | DONE |
| S21-05 | Redis Sentinel (3 nodes) | k8s/base/redis/ | DONE |
| S21-06 | RabbitMQ cluster (3 nodes) | k8s/base/rabbitmq/ | DONE |
| S21-07 | MinIO distributed (4 nodes) | k8s/base/minio/ | DONE |
| S21-08 | Elasticsearch 8 cluster | k8s/base/elasticsearch/ | DONE |
| S21-09 | FastAPI HPA (3-15 replicas, CPU 70% + RPS) | k8s/base/api-deployment.yaml | DONE |
| S21-10 | Celery HPA (worker: 2-10, beat: 1) | k8s/base/celery-deployment.yaml | DONE |
| S21-11 | Kong Ingress | k8s/base/kong/ | DONE |
| S21-12 | cert-manager (Let's Encrypt) | k8s/base/cert-manager/ | DONE |
| S21-13 | Kustomize overlays (dev/staging/prod/dr) | k8s/overlays/ | DONE |
| S21-14 | DR: WAL shipping, 4h RTO, 1h RPO | k8s/overlays/dr/ + pg config | DONE |
| S21-15 | Secrets management (K3s Secrets + Sealed Secrets) | k8s/base/sealed-secrets/ | DONE |
| S21-16 | Backup: Velero daily snapshots | k8s/base/velero/ | DONE |
| S21-17 | Resource limits: CPU/memory per pod | All deployments | DONE |
| S21-18 | Liveness + readiness probes on all pods | All deployments | DONE |
| S21-19 | Pod disruption budgets | k8s/base/pdbs.yaml | DONE |
| S21-20 | Network policies (deny all + selective allow) | k8s/base/netpolicies.yaml | DONE |

---
## ASSUMPTIONS LOG
| ID | Assumption | Why | Risk | Owner |
|---|---|---|---|---|
| A-21-1 | K3s v1.29+ used; Flannel CNI (default); Traefik replaced by Kong Ingress | SPEC specifies Kong as API gateway | MEDIUM | DevOps |
| A-21-2 | PostgreSQL WAL archiving to MinIO (same cluster); DR site replicates from WAL archive | Cost-effective DR for single-tenant initial deployment | MEDIUM | DevOps |
| A-21-3 | Sealed Secrets controller encrypts K8s secrets at rest in Git; kubeseal used for encryption | GitOps-compatible secret management | LOW | DevOps |
| A-21-4 | HPA custom metric: `requests_per_second_per_pod` via Prometheus adapter; CPU 70% trigger for initial baseline | SPEC requires RPS-based scaling | MEDIUM | DevOps |
| A-21-5 | `procurement` namespace: network policy denies ALL ingress by default; only Kong→API and API→DB/Redis/RabbitMQ allowed | SPEC_04 network isolation | HIGH | DevOps |
| A-21-6 | Frontend portals (Buyer, Supplier, Admin) run Next.js standalone server on ports 3000, 3001, 3002 exposed via ClusterIP services | Standard Next.js production packaging | LOW | Frontend/DevOps |
| A-21-7 | Kong Ingress & routes proxy `apps.procurement.com`, `supplier.procurement.com`, `admin.procurement.com` to frontend services, and `/api/v1`, `/ws` to API | Unified gateway ingress routing | MEDIUM | DevOps |
| A-21-8 | Dev overlay scales replicas to 1 for statefulsets and deployments with reduced resource constraints for local cluster feasibility | Developer workstation resource efficiency | LOW | DevOps |

---
## STEP 2 — IMPLEMENT

### 2.1 `k8s/base/namespaces.yaml`
```yaml
apiVersion: v1; kind: Namespace; metadata: {name: procurement}
---
apiVersion: v1; kind: Namespace; metadata: {name: monitoring}
---
apiVersion: v1; kind: Namespace; metadata: {name: logging}
---
apiVersion: v1; kind: Namespace; metadata: {name: infra}
```

### 2.2 `k8s/base/api-deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: procurement-api
  namespace: procurement
spec:
  replicas: 3
  selector:
    matchLabels: {app: procurement-api}
  template:
    metadata:
      labels: {app: procurement-api}
    spec:
      containers:
      - name: api
        image: procurement-api:latest  # Replaced by overlay
        ports: [{containerPort: 8000}]
        resources:
          requests: {cpu: "500m", memory: "512Mi"}
          limits: {cpu: "2000m", memory: "2Gi"}
        envFrom:
        - secretRef: {name: procurement-secrets}
        - configMapRef: {name: procurement-config}
        livenessProbe:
          httpGet: {path: /health/live, port: 8000}
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet: {path: /health/ready, port: 8000}
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 3
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]  # Graceful shutdown
      terminationGracePeriodSeconds: 30
```

### 2.3 `k8s/base/hpa.yaml`
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: procurement-api-hpa
  namespace: procurement
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: procurement-api
  minReplicas: 3
  maxReplicas: 15
  metrics:
  - type: Resource
    resource:
      name: cpu
      target: {type: Utilization, averageUtilization: 70}
  - type: Pods
    pods:
      metric: {name: http_requests_per_second}
      target: {type: AverageValue, averageValue: "100"}
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Pods; value: 2; periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
```

### 2.4 `k8s/base/netpolicies.yaml`
```yaml
# Deny all ingress to procurement namespace by default
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: procurement
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# Allow Kong → API
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-kong-to-api
  namespace: procurement
spec:
  podSelector:
    matchLabels: {app: procurement-api}
  ingress:
  - from:
    - namespaceSelector:
        matchLabels: {kubernetes.io/metadata.name: infra}
      podSelector:
        matchLabels: {app: kong}
    ports: [{port: 8000}]
---
# Allow API → PostgreSQL
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-postgres
  namespace: procurement
spec:
  podSelector:
    matchLabels: {app: postgresql}
  ingress:
  - from:
    - podSelector:
        matchLabels: {app: procurement-api}
    - podSelector:
        matchLabels: {app: celery-worker}
    ports: [{port: 5432}]
```

### 2.5 `k8s/base/pdbs.yaml`
```yaml
# Minimum 2 API pods always available during rolling updates
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: {name: api-pdb, namespace: procurement}
spec:
  minAvailable: 2
  selector:
    matchLabels: {app: procurement-api}
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: {name: celery-pdb, namespace: procurement}
spec:
  minAvailable: 1
  selector:
    matchLabels: {app: celery-worker}
```

### 2.6 Kustomize Overlay Structure
```
k8s/overlays/production/kustomization.yaml:
  resources: [../../base]
  images:
  - name: procurement-api; newTag: v1.2.3  # Set by CI/CD
  patches:
  - path: api-replicas.yaml    # replicas: 5
  - path: hpa-production.yaml  # maxReplicas: 30
  configMapGenerator:
  - name: procurement-config
    envs: [config.production.env]
  secretGenerator:
  - name: procurement-secrets
    files: [secrets.production.env]  # Sealed Secrets decrypted by controller
```

---
## STEP 3 — TEST
```bash
# Validate manifests
kubectl --dry-run=client apply -k k8s/overlays/dev/
kubeval k8s/base/*.yaml

# Integration
kubectl rollout status deployment/procurement-api -n procurement
kubectl get hpa procurement-api-hpa -n procurement
# Health check
curl https://api.procurement.dev/health/ready

# DR test
kubectl apply -k k8s/overlays/dr/
# Verify replica lag < 1h
psql -c "SELECT now() - pg_last_xact_replay_timestamp()" -U postgres -d procurement
```

---
## STEP 5 — GRAPHIFY UPDATE
```bash
graphify update
# Nodes: K3sCluster, APIDeployment, CeleryDeployment, HPA, PDB, NetworkPolicies,
#        PostgreSQLHA, RedisSentinel, RabbitMQCluster, MinIODistributed
```
