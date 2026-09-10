"use client";

import React, { useState, useRef } from "react";
import { Send, Lock, Eye, Paperclip, Loader2, AtSign } from "lucide-react";
import { useAddTicketComment, useUploadTicketAttachment } from "@procurement/hooks";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TicketCommentBoxProps {
  ticketId: string;
  allowInternalNotes?: boolean;
  onCommentAdded?: () => void;
}

function formatMentionsForMarkdown(text: string): string {
  if (!text) return "";
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(/(^|[\s(])@([a-zA-Z0-9._-]+)/g, "$1[@$2](#mention-$2)");
    })
    .join("");
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleInsertMention = () => {
    if (previewMode) setPreviewMode(false);
    setContent((prev) => (prev ? `${prev} @` : "@"));
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
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
      className={`rounded-2xl border transition-all ${
        isInternal && allowInternalNotes
          ? "border-amber-400/80 bg-amber-50/40 dark:border-amber-700/60 dark:bg-amber-950/20"
          : "border-slate-200/80 bg-white dark:border-white/15 dark:bg-[#1C1C1F]"
      }`}
    >
      <div className="p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1 text-xs w-48 sm:w-56 p-1 bg-slate-100 dark:bg-[#252529] border border-slate-200/60 dark:border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setPreviewMode(false)}
              className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all text-center justify-center flex items-center ${
                !previewMode
                  ? "bg-white dark:bg-[#1C1C1F] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(true)}
              className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all text-center justify-center flex items-center ${
                previewMode
                  ? "bg-white dark:bg-[#1C1C1F] text-slate-900 dark:text-white shadow-xs"
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
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                isInternal
                  ? "bg-amber-100 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 border border-transparent"
              }`}
              title="Internal notes are invisible to suppliers"
            >
              <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span>Internal Note</span>
            </button>
          )}
        </div>

        {isInternal && allowInternalNotes && (
          <div className="mb-2.5 text-[11px] text-amber-900 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Visible to internal team only. Suppliers will not see this note.</span>
          </div>
        )}

        {previewMode ? (
          <div className="min-h-[100px] p-3 text-sm text-slate-800 dark:text-slate-200 prose prose-sm dark:prose-invert max-w-none bg-slate-50 dark:bg-[#252529] rounded-xl border border-slate-200 dark:border-white/10">
            {content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, href, children, ...props }) => {
                    if (href?.startsWith("#mention-")) {
                      return (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-semibold font-mono bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                          {children}
                        </span>
                      );
                    }
                    return (
                      <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" {...props}>
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {formatMentionsForMarkdown(content)}
              </ReactMarkdown>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 italic">Nothing to preview</span>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              isInternal
                ? "Add an internal note... (Markdown and @mentions supported)"
                : "Add a response... (Markdown and @mentions supported)"
            }
            className="w-full min-h-[100px] text-sm bg-transparent border-0 focus:ring-0 focus:outline-none resize-y text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        )}
      </div>

      <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-[#252529]/60 border-t border-slate-100 dark:border-white/10 flex items-center justify-between rounded-b-2xl">
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
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            title="Attach a file"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleInsertMention}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Mention a team member (@username)"
          >
            <AtSign className="w-4 h-4" />
          </button>

          <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
            Supports Markdown and @mentions
          </span>
        </div>

        <button
          type="submit"
          disabled={!content.trim() || addCommentMutation.isPending}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isInternal
              ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
              : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
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
