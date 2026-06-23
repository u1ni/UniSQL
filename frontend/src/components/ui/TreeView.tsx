"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, LucideIcon } from "lucide-react";

export interface TreeNode {
  id: string;
  label: string;
  type: string;
  icon?: LucideIcon;
  children?: TreeNode[];
  hasChildren?: boolean;
  data?: any;
}

interface TreeViewProps {
  nodes: TreeNode[];
  level?: number;
  onExpand?: (node: TreeNode) => void;
  onSelect?: (node: TreeNode) => void;
  selectedId?: string;
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
}

export function TreeView({ 
  nodes, 
  level = 0, 
  onExpand, 
  onSelect, 
  selectedId,
  onContextMenu 
}: TreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (e: React.MouseEvent, node: TreeNode) => {
    e.stopPropagation();
    
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(node.id)) {
      newExpanded.delete(node.id);
    } else {
      newExpanded.add(node.id);
      if (onExpand && (!node.children || node.children.length === 0)) {
        onExpand(node);
      }
    }
    setExpandedIds(newExpanded);
  };

  const handleSelect = (e: React.MouseEvent, node: TreeNode) => {
    e.stopPropagation();
    if (onSelect) onSelect(node);
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSelect) onSelect(node);
    if (onContextMenu) onContextMenu(e, node);
  };

  return (
    <div className="select-none font-mono text-sm">
      {nodes.map(node => {
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedId === node.id;
        const Icon = node.icon;
        
        return (
          <div key={node.id}>
            <div 
              className={`
                flex items-center py-1 px-1 cursor-pointer
                ${isSelected ? "bg-accent/20 text-accent" : "text-text/80 hover:bg-surface hover:text-text"}
                transition-colors
              `}
              style={{ paddingLeft: `${level * 12 + 4}px` }}
              onClick={(e) => handleSelect(e, node)}
              onContextMenu={(e) => handleContextMenu(e, node)}
            >
              <div 
                className="w-4 h-4 flex items-center justify-center mr-1"
                onClick={(e) => (node.children || node.hasChildren) ? toggleExpand(e, node) : handleSelect(e, node)}
              >
                {(node.children || node.hasChildren) ? (
                  isExpanded ? <ChevronDown className="w-3 h-3 text-text/50" /> : <ChevronRight className="w-3 h-3 text-text/50" />
                ) : <span className="w-3 h-3" />}
              </div>
              
              {Icon && <Icon className={`w-3.5 h-3.5 mr-1.5 ${isSelected ? "text-accent" : "text-text/60"}`} />}
              
              <span className="truncate">{node.label}</span>
            </div>
            
            {isExpanded && node.children && node.children.length > 0 && (
              <TreeView 
                nodes={node.children} 
                level={level + 1} 
                onExpand={onExpand}
                onSelect={onSelect}
                selectedId={selectedId}
                onContextMenu={onContextMenu}
              />
            )}
            
            {isExpanded && node.hasChildren && (!node.children || node.children.length === 0) && (
              <div 
                className="flex items-center py-1 px-1 text-text/40 italic"
                style={{ paddingLeft: `${(level + 1) * 12 + 4 + 16}px` }}
              >
                Loading...
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
