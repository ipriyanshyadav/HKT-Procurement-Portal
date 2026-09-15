"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSupportKBArticles, useAppToast } from "@procurement/hooks";
import {
  BookOpen,
  Search,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  LifeBuoy,
  FileQuestion,
  Tag,
  ArrowRight,
} from "lucide-react";

const CATEGORIES = [
  { label: "All Categories", value: "" },
  { label: "Invoicing & Matching", value: "INVOICING" },
  { label: "Goods Receipt & Dispatch", value: "DISPATCH" },
  { label: "Sourcing & Bidding", value: "SOURCING" },
  { label: "User Access & Roles", value: "ACCESS" },
  { label: "General Help", value: "GENERAL" },
];

export default function KnowledgeBasePage() {
  const { toast } = useAppToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const [votedArticles, setVotedArticles] = useState<Record<string, "UP" | "DOWN">>({});

  const { data: articles, isLoading } = useSupportKBArticles(
    selectedCategory ? selectedCategory : undefined
  );

  const filteredArticles = (articles || []).filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.content.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleVote = (articleId: string, type: "UP" | "DOWN") => {
    if (votedArticles[articleId]) {
      toast.info("Already Voted", "You have already provided feedback on this documentation article.");
      return;
    }
    setVotedArticles((prev) => ({ ...prev, [articleId]: type }));
    toast.success(
      "Feedback Received",
      type === "UP"
        ? "Glad this article resolved your question!"
        : "Thank you. Our technical writing team will update this article."
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedArticleId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-600 to-blue-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-sky-600/10 space-y-4">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold">
          <BookOpen className="w-3.5 h-3.5" />
          <span>ProcureOS Official Knowledge Base</span>
        </div>
        <h1 className="text-xl sm:text-3xl font-black tracking-tight">
          How can we help your procurement workflow?
        </h1>
        <p className="text-xs sm:text-sm text-sky-100 max-w-2xl leading-relaxed">
          Search standard operating procedures, 3-way matching tolerance guides, consignee receipt protocols, and sandbox developer walkthroughs.
        </p>

        {/* Search Bar */}
        <div className="relative max-w-xl pt-2">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search guides (e.g. 3-way match, CRAC acceptance, API webhook signature)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs rounded-2xl border border-transparent bg-white text-neutral-900 placeholder:text-neutral-400 pl-10 pr-4 py-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-3.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat.value
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Articles Grid / List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
            <p className="text-xs text-neutral-400">Loading articles...</p>
          </div>
        ) : filteredArticles.length > 0 ? (
          <div className="space-y-3">
            {filteredArticles.map((article) => {
              const isExpanded = expandedArticleId === article.id;
              const vote = votedArticles[article.id];

              return (
                <div
                  key={article.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm transition-all"
                >
                  <div
                    className="flex items-start justify-between gap-4 cursor-pointer"
                    onClick={() => toggleExpand(article.id)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded uppercase border border-sky-300 dark:border-sky-800">
                          {article.category}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          Updated {new Date(article.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white hover:text-sky-600 transition-colors">
                        {article.title}
                      </h3>
                      {!isExpanded && (
                        <p className="text-xs text-neutral-500 line-clamp-2">
                          {article.content}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      aria-label="Expand article"
                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Content View */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
                      <div className="prose dark:prose-invert max-w-none text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                        {article.content}
                      </div>

                      {/* Helpful voting bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500">
                        <span>Was this article helpful to your workflow?</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleVote(article.id, "UP")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                              vote === "UP"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800"
                                : "hover:bg-neutral-100 dark:hover:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                            }`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Yes ({article.helpful_votes + (vote === "UP" ? 1 : 0)})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVote(article.id, "DOWN")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                              vote === "DOWN"
                                ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:border-red-800"
                                : "hover:bg-neutral-100 dark:hover:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                            }`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
                            <span>No</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-12 text-center space-y-4">
            <FileQuestion className="w-12 h-12 text-neutral-300 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                No matching knowledge base articles found
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Could not find any guides matching &quot;{search}&quot;. Try searching different terms or raise a ticket directly with our support team.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              <LifeBuoy className="w-4 h-4" />
              <span>Raise a Support Ticket</span>
            </Link>
          </div>
        )}
      </div>

      {/* Bottom CTA card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
            Still experiencing procurement discrepancies?
          </h4>
          <p className="text-xs text-neutral-500">
            Our enterprise helpdesk team provides 24/7 resolution support for critical sourcing, delivery, and matching issues.
          </p>
        </div>

        <Link
          href="/"
          className="px-5 py-2.5 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold rounded-xl flex items-center gap-2 shrink-0 transition-colors shadow-sm"
        >
          <span>Open New Ticket</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
