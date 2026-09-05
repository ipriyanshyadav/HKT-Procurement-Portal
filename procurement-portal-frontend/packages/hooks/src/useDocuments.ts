import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface DocumentItem {
  id: string;
  entity_type: string;
  entity_id: string;
  category: string;
  original_filename: string;
  stored_filename?: string;
  content_type: string;
  file_size_bytes: number;
  scan_status: "PENDING" | "CLEAN" | "INFECTED" | "SKIPPED" | string;
  scan_result?: string | null;
  current_version?: number;
  compliance_expiry?: string | null;
  created_at: string;
}

export interface DocumentVersionItem {
  id: string;
  document_id: string;
  version_number: number;
  file_size_bytes: number;
  sha256_hash: string;
  uploaded_by: string;
  created_at: string;
}

export interface PresignedUrlData {
  url: string;
  expires_in: number;
}

export function useEntityDocuments(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["documents", entityType, entityId],
    queryFn: async () => {
      const res = await apiClient.get(`/documents/entity/${entityType}/${entityId}`);
      return (res.data.data ?? []) as DocumentItem[];
    },
    enabled: Boolean(entityType && entityId),
  });
}

export function useDocumentPresignedUrl(documentId?: string) {
  return useQuery({
    queryKey: ["document-presigned-url", documentId],
    queryFn: async () => {
      const res = await apiClient.get(`/documents/${documentId}/presigned-url`);
      return res.data.data as PresignedUrlData;
    },
    enabled: Boolean(documentId),
    staleTime: 14 * 60 * 1000, // 14 min cache (just below 15-min TTL)
  });
}

export function useDocumentVersions(documentId?: string) {
  return useQuery({
    queryKey: ["document-versions", documentId],
    queryFn: async () => {
      const res = await apiClient.get(`/documents/${documentId}/versions`);
      return (res.data.data ?? []) as DocumentVersionItem[];
    },
    enabled: Boolean(documentId),
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      entityType,
      entityId,
      documentType,
      category,
      complianceExpiry,
    }: {
      file: File;
      entityType: string;
      entityId: string;
      documentType?: string;
      category?: string;
      complianceExpiry?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity_type", entityType);
      formData.append("entity_id", entityId);
      if (documentType) formData.append("document_type", documentType);
      if (category) formData.append("category", category);
      if (complianceExpiry) formData.append("compliance_expiry", complianceExpiry);

      const res = await apiClient.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data.data as DocumentItem;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["documents", vars.entityType, vars.entityId] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentId,
      entityType,
      entityId,
    }: {
      documentId: string;
      entityType?: string;
      entityId?: string;
    }) => {
      const res = await apiClient.delete(`/documents/${documentId}`);
      return res.data.data;
    },
    onSuccess: (_, vars) => {
      if (vars.entityType && vars.entityId) {
        queryClient.invalidateQueries({ queryKey: ["documents", vars.entityType, vars.entityId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      }
    },
  });
}
