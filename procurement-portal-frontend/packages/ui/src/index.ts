// Shared UI Components & Utilities
export { cn } from "./utils";
export { SLAIndicator } from "./SLAIndicator";
export type { SLAIndicatorProps } from "./SLAIndicator";
export { WorkflowChainPreview } from "./WorkflowChainPreview";
export type { WorkflowChainPreviewProps, SimulateChainStep, SimulateApprover } from "./WorkflowChainPreview";

export { CategoryTreeSelect } from "./CategoryTreeSelect";
export type { CategoryTreeSelectProps, CategoryTreeNode } from "./CategoryTreeSelect";

export { UOMSelect } from "./UOMSelect";
export type { UOMSelectProps, UOMOption } from "./UOMSelect";

export { CurrencySelect } from "./CurrencySelect";
export type { CurrencySelectProps, CurrencyOption } from "./CurrencySelect";

export { PaymentTermsSelect } from "./PaymentTermsSelect";
export type { PaymentTermsSelectProps, PaymentTermOption } from "./PaymentTermsSelect";

export { VendorStatusBadge } from "./VendorStatusBadge";
export type { VendorStatus } from "./VendorStatusBadge";

export { ComplianceExpiryAlert } from "./ComplianceExpiryAlert";

export { PRLineItemTable } from "./PRLineItemTable";
export type { PRLineItemTableProps } from "./PRLineItemTable";

export { WorkflowTimeline } from "./WorkflowTimeline";
export type { WorkflowTimelineProps, WorkflowStep } from "./WorkflowTimeline";

export { BudgetIndicator } from "./BudgetIndicator";
export type { BudgetIndicatorProps } from "./BudgetIndicator";

export { PermissionGuard, useHasPermission } from "./PermissionGuard";
export type { PermissionGuardProps } from "./PermissionGuard";

export { BidSealedIndicator } from "./BidSealedIndicator";
export type { BidSealedIndicatorProps } from "./BidSealedIndicator";

export { ClarificationThread } from "./ClarificationThread";
export type { ClarificationThreadProps, ClarificationItem } from "./ClarificationThread";

// === Apple Design System Exports (Light & Dark) ===
// Theme
export { ThemeProvider, useTheme, ThemeContext } from "./theme/ThemeProvider";
export type { Theme, ThemeContextValue } from "./theme/ThemeProvider";
export { ThemeSwitcher } from "./theme/ThemeSwitcher";

// Core Apple UI Components
export { Button } from "./components/Button";
export type { ButtonProps } from "./components/Button";

export { Card } from "./components/Card";
export type { CardProps } from "./components/Card";

export { Badge } from "./components/Badge";
export type { BadgeProps, BadgeVariant } from "./components/Badge";

export { Input, SearchInput, Select, Textarea } from "./components/Input";
export type { InputProps, SearchInputProps, SelectProps, TextareaProps } from "./components/Input";

export { Toggle } from "./components/Toggle";
export type { ToggleProps } from "./components/Toggle";

export { Modal } from "./components/Modal";
export type { ModalProps } from "./components/Modal";

export { Toast } from "./components/Toast";
export type { ToastProps, ToastType } from "./components/Toast";

export { Table } from "./components/Table";
export type { TableProps, TableColumn } from "./components/Table";

export { KPIItem, HeroKPIStrip } from "./components/KPICard";
export type { KPIItemProps, HeroKPIStripProps } from "./components/KPICard";

export { Tabs } from "./components/Tabs";
export type { TabsProps, TabOption } from "./components/Tabs";

export { Skeleton } from "./components/Skeleton";
export type { SkeletonProps } from "./components/Skeleton";

// Layout Components
export { PageHeader } from "./components/PageHeader";
export type { PageHeaderProps, BreadcrumbItem } from "./components/PageHeader";

export { Navbar } from "./components/Navbar";
export type { NavbarProps, NavItem, UserProfile } from "./components/Navbar";

export { Sidebar } from "./components/Sidebar";
export type { SidebarProps, SidebarItemData, SidebarMode } from "./components/Sidebar";

export { AppShell } from "./components/AppShell";
export type { AppShellProps } from "./components/AppShell";

// Interaction Hooks
export { useAppleReveal } from "./hooks/useAppleReveal";
export { useCountUp } from "./hooks/useCountUp";
export { useParallaxTilt } from "./hooks/useParallaxTilt";

// Live Auction Components (SPEC_11B)
export { AuctionCountdownTimer } from "./AuctionCountdownTimer";
export type { AuctionCountdownTimerProps } from "./AuctionCountdownTimer";
export { BidEntryPanel } from "./BidEntryPanel";
export type { BidEntryPanelProps } from "./BidEntryPanel";
export { PriceLeaderboard } from "./PriceLeaderboard";
export type { PriceLeaderboardProps, RankEntry } from "./PriceLeaderboard";
