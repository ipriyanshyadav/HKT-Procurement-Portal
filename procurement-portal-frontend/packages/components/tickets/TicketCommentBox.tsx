"use client";

import React, { useState, useRef } from "react";
import { Send, Lock, Eye, Paperclip, Loader2 } from "lucide-react";
import { useAddTicketComment, useUploadTicketAttachment } from "@procurement/hooks";

interface TicketCommentBoxProps {
  ticketId: string;
  allowInternalNotes?: boolean;
  onCommentAdded?: () => void;
}

export function TicketCommentBox({
  ticketId,
  allowInternalNotes = true,
  onCommentAdded,
}: TicketCommentBoxProps) {
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addCommentMutation = useAddTicketComment();
  const uploadAttachmentMutation = useUploadTicketAttachment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || addCommentMutation.isPending) return;

    try {
      await addCommentMutation.mutateAsync({
        ticketId,
        data: {
          content: content.trim(),
          is_internal: allowInternalNotes ? isInternal : false,
        },
      });
      setContent("");
      setIsInternal(false);
      onCommentAdded?.();
    } catch (err) {
      // Error handled by query client
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadAttachmentMutation.mutateAsync({
        ticketId,
        formData,
      });
    } catch (err) {
      // Handled
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-lg border transition-all ${
        isInternal && allowInternalNotes
          ? "border-amber-300 bg-amber-50/40"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-xs w-48 sm:w-56 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setPreviewMode(false)}
              className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all text-center justify-center flex items-center ${
                !previewMode
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(true)}
              className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all text-center justify-center flex items-center ${
                previewMode
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Preview
            </button>
          </div>

          {allowInternalNotes && (
            <button
              type="button"
              onClick={() => setIsInternal(!isInternal)}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                isInternal
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "text-slate-600 hover:bg-slate-100 border border-transparent"
              }`}
              title="Internal notes are invisible to suppliers"
            >
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>Internal Note</span>
            </button>
          )}
        </div>

        {isInternal && allowInternalNotes && (
          <div className="mb-2 text-[11px] text-amber-800 bg-amber-100/70 border border-amber-200 px-2.5 py-1 rounded flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span>Visible to buyer internal team only. Suppliers will not see this comment.</span>
          </div>
        )}

        {previewMode ? (
          <div className="min-h-[96px] p-2 text-sm text-slate-800 prose prose-sm max-w-none bg-slate-50 rounded border border-slate-200">
            {content ? content : <span className="text-slate-400 italic">Nothing to preview</span>}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              isInternal
                ? "Add an internal note... (Markdown and @mentions supported)"
                : "Add a response... (Markdown and @mentions supported)"
            }
            className="w-full min-h-[96px] text-sm bg-transparent border-0 focus:ring-0 focus:outline-none resize-y placeholder:text-slate-400"
          />
        )}
      </div>

      <div className="px-3 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between rounded-b-lg">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            id="ticket-file-upload"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded transition-colors disabled:opacity-50"
            title="Attach a file"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Supports GitHub-flavored Markdown and @mentions
          </span>
        </div>

        <button
          type="submit"
          disabled={!content.trim() || addCommentMutation.isPending}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isInternal
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {addCommentMutation.isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Posting...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>{isInternal ? "Post Internal Note" : "Send Response"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
