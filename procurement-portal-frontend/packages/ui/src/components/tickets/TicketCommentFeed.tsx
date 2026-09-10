"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Lock, Edit2, Trash2, Check, X, User } from "lucide-react";
import type { TicketCommentResponse } from "@procurement/types";
import { useEditTicketComment, useDeleteTicketComment } from "@procurement/hooks";

interface TicketCommentFeedProps {
  ticketId: string;
  comments?: TicketCommentResponse[];
  currentUserId?: string;
  isBuyerOrAdmin?: boolean;
}

function formatMentionsForMarkdown(text: string): string {
  if (!text) return "";
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts
    .map((part, index) => {
      // Keep code blocks unchanged
      if (index % 2 === 1) return part;
      // Convert @username into a markdown link targeted at #mention-<username>
      return part.replace(/(^|[\s(])@([a-zA-Z0-9._-]+)/g, "$1[@$2](#mention-$2)");
    })
    .join("");
}

export function TicketCommentFeed({
  ticketId,
  comments = [],
  currentUserId,
  isBuyerOrAdmin = false,
}: TicketCommentFeedProps) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const editMutation = useEditTicketComment();
  const deleteMutation = useDeleteTicketComment();

  const handleStartEdit = (comment: TicketCommentResponse) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;
    await editMutation.mutateAsync({
      ticketId,
      commentId,
      data: { content: editContent.trim() },
    });
    setEditingCommentId(null);
    setEditContent("");
  };

  const handleDelete = async (commentId: string) => {
    if (confirm("Are you sure you want to delete this comment?")) {
      await deleteMutation.mutateAsync({
        ticketId,
        commentId,
      });
    }
  };

  // Check if comment was created less than 15 minutes ago (900 seconds)
  const isEditable = (comment: TicketCommentResponse): boolean => {
    if (!currentUserId || comment.author_id !== currentUserId) return false;
    const createdAt = new Date(comment.created_at).getTime();
    const now = Date.now();
    return now - createdAt < 15 * 60 * 1000;
  };

  if (!comments.length) {
    return (
      <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
        No comments yet. Start the conversation above.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const canEdit = isEditable(comment);
        const isEditing = editingCommentId === comment.id;
        const isAuthor = currentUserId && comment.author_id === currentUserId;
        const canDelete = isAuthor || isBuyerOrAdmin;

        return (
          <div
            key={comment.id}
            className={`rounded-xl border p-4 transition-all ${
              comment.is_internal
                ? "bg-amber-50/70 dark:bg-amber-950/25 border-amber-300/80 dark:border-amber-700/50 shadow-xs"
                : "bg-white dark:bg-[#1C1C1F] border-slate-200/80 dark:border-white/15 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#252529] border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center font-medium text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white mr-2">
                    {comment.author_id.slice(0, 8)}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                  {Boolean(comment.edited_at) && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5 italic">
                      (edited)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {comment.is_internal && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700/60 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                    <span>INTERNAL NOTE</span>
                  </span>
                )}

                {canEdit && !isEditing && (
                  <button
                    onClick={() => handleStartEdit(comment)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                    title="Edit comment (available for 15 minutes after posting)"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {canDelete && !isEditing && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Delete comment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[80px] p-2.5 text-sm bg-white dark:bg-[#252529] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={() => handleSaveEdit(comment.id)}
                    disabled={editMutation.isPending || !editContent.trim()}
                    className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-800 dark:text-slate-200 prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node, href, children, ...props }) => {
                      if (href?.startsWith("#mention-")) {
                        return (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-semibold font-mono bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 shadow-2xs">
                            {children}
                          </span>
                        );
                      }
                      return (
                        <a
                          href={href}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                          {...props}
                        >
                          {children}
                        </a>
                      );
                    },
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                    code: ({ node, inline, className, children, ...props }: any) => {
                      if (inline) {
                        return (
                          <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-[#252529] text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {formatMentionsForMarkdown(comment.content)}
                </ReactMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
