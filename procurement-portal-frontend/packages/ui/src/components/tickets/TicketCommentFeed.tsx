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
      <div className="text-center py-8 text-slate-400 text-sm">
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
            className={`rounded-lg border p-4 transition-all ${
              comment.is_internal
                ? "bg-amber-50/50 border-amber-200"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-medium text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 mr-2">
                    {comment.author_id.slice(0, 8)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                  {Boolean(comment.edited_at) && (
                    <span className="text-[10px] text-slate-400 ml-1 italic">(edited)</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {comment.is_internal && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" />
                    <span>INTERNAL NOTE</span>
                  </span>
                )}

                {canEdit && !isEditing && (
                  <button
                    onClick={() => handleStartEdit(comment)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                    title="Edit comment (available for 15 minutes after posting)"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {canDelete && !isEditing && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
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
                  className="w-full min-h-[80px] p-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={() => handleSaveEdit(comment.id)}
                    disabled={editMutation.isPending || !editContent.trim()}
                    className="flex items-center gap-1 px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-800 prose prose-sm max-w-none leading-relaxed break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {comment.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
