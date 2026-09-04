"use client";

import React, { useState, useMemo } from "react";
import { cn } from "./utils";

export interface CategoryTreeNode {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  level: number;
  path: string;
  is_active: boolean;
  children?: CategoryTreeNode[];
}

export interface CategoryTreeSelectProps {
  categories?: CategoryTreeNode[];
  value?: string;
  onChange: (categoryId: string, categoryName?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLevel?: number;
  className?: string;
}

function findNodeById(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function CategoryTreeSelect({
  categories = [],
  value,
  onChange,
  placeholder = "Select Category...",
  disabled = false,
  maxLevel,
  className,
}: CategoryTreeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const selectedNode = useMemo(() => {
    if (!value) return null;
    return findNodeById(categories, value);
  }, [categories, value]);

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleSelect = (node: CategoryTreeNode) => {
    if (disabled) return;
    if (maxLevel && node.level > maxLevel) return;
    onChange(node.id, node.name);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", "");
  };

  const filterTree = (nodes: CategoryTreeNode[], query: string): CategoryTreeNode[] => {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase();

    const filtered: CategoryTreeNode[] = [];
    for (const node of nodes) {
      const matches = node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);
      const filteredChildren = node.children ? filterTree(node.children, query) : [];
      if (matches || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren,
        });
      }
    }
    return filtered;
  };

  const filteredCategories = useMemo(() => {
    return filterTree(categories, search);
  }, [categories, search]);

  const renderNode = (node: CategoryTreeNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds[node.id] || Boolean(search.trim());
    const isSelected = value === node.id;
    const isSelectable = !maxLevel || node.level <= maxLevel;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => handleSelect(node)}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          className={cn(
            "flex items-center justify-between py-1.5 pr-2 rounded text-sm cursor-pointer transition-colors",
            isSelected ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-gray-100 text-gray-700",
            !isSelectable && "opacity-50 cursor-not-allowed",
          )}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="w-4 h-4 flex items-center justify-center text-xs text-gray-500 hover:text-gray-800"
              >
                {isExpanded ? "▼" : "▶"}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
              L{node.level}
            </span>
            <span className="truncate">{node.name}</span>
            <span className="text-xs text-gray-400 font-mono">({node.code})</span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 bg-white text-sm cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
          disabled && "bg-gray-100 cursor-not-allowed opacity-60",
        )}
      >
        {selectedNode ? (
          <div className="flex items-center gap-2 truncate">
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
              L{selectedNode.level}
            </span>
            <span className="font-medium text-gray-900 truncate">{selectedNode.name}</span>
            <span className="text-xs text-gray-500 font-mono">({selectedNode.code})</span>
          </div>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}

        <div className="flex items-center gap-1 ml-2">
          {selectedNode && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 px-1"
            >
              ✕
            </button>
          )}
          <span className="text-xs text-gray-400">▼</span>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-72 flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category or code..."
              className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto p-1 max-h-56">
            {filteredCategories.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">No categories found</div>
            ) : (
              filteredCategories.map((node) => renderNode(node))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
