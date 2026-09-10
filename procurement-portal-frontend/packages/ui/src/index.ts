// Shared UI Components & Utilities
export { cn } from "./utils";
export { ErrorBoundary } from "./ErrorBoundary";
export type { ErrorBoundaryProps } from "./ErrorBoundary";
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

export { IncotermSelect } from "./IncotermSelect";
export type { IncotermSelectProps, IncotermOption } from "./IncotermSelect";

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

export { CaptchaChallenge } from "./CaptchaChallenge";
export type { CaptchaChallengeProps } from "./CaptchaChallenge";


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

export {
  RadixSelect,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/Select";

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/Dialog";

export { Toggle } from "./components/Toggle";
export type { ToggleProps } from "./components/Toggle";

export { Modal } from "./components/Modal";
export type { ModalProps } from "./components/Modal";

export { Toast } from "./components/Toast";
export type { ToastProps, ToastType } from "./components/Toast";

export { Table } from "./components/Table";
export type { TableProps, TableColumn } from "./components/Table";

export { KPIItem, HeroKPIStrip, KPICard } from "./components/KPICard";
export type { KPIItemProps, HeroKPIStripProps, KPICardProps } from "./components/KPICard";

export { SpendChart } from "./components/SpendChart";
export type { SpendChartProps, SpendItem, BreakdownType } from "./components/SpendChart";

export { Tabs, SubTabs, UnderlineTabs, RadixTabs, TabsList, TabsTrigger, TabsContent } from "./components/Tabs";
export type { TabsProps, TabOption, TabsVariant, TabsSize } from "./components/Tabs";

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

export { PageTransition } from "./components/PageTransition";
export type { PageTransitionProps } from "./components/PageTransition";

export { VirtualTable } from "./components/VirtualTable";
export type { VirtualTableProps, VirtualTableColumn } from "./components/VirtualTable";

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

// Evaluation & Comparative Statement Components (SPEC_12)
export { ComparativeStatementTable } from "./ComparativeStatementTable";
export type { ComparativeStatementTableProps } from "./ComparativeStatementTable";
export { NegotiationPriceInput } from "./NegotiationPriceInput";
export type { NegotiationPriceInputProps } from "./NegotiationPriceInput";

// Contract Management Components (SPEC_13)
export { ContractExpiryCountdown } from "./ContractExpiryCountdown";
export type { ContractExpiryCountdownProps } from "./ContractExpiryCountdown";
export { MilestoneTracker } from "./MilestoneTracker";
export type { MilestoneTrackerProps, MilestoneItem } from "./MilestoneTracker";
export { RateCardTable } from "./RateCardTable";
export type { RateCardTableProps, RateCardLineItem } from "./RateCardTable";
export { ContractAmendmentHistory } from "./ContractAmendmentHistory";
export type { ContractAmendmentHistoryProps, AmendmentItem } from "./ContractAmendmentHistory";

// Purchase Order & GRN Components (SPEC_14)
export { DeliveryScheduleTable } from "./DeliveryScheduleTable";
export type { DeliveryScheduleTableProps } from "./DeliveryScheduleTable";

// Invoice & Payment Components (SPEC_15)
export { ThreeWayMatchResult } from "./ThreeWayMatchResult";
export type { ThreeWayMatchResultProps } from "./ThreeWayMatchResult";
export { PaymentSchedule } from "./PaymentSchedule";
export type { PaymentScheduleProps } from "./PaymentSchedule";

// Document Management Components (SPEC_17)
export { DocumentUpload } from "./DocumentUpload";
export type { DocumentUploadProps } from "./DocumentUpload";
export { DocumentList } from "./DocumentList";
export type { DocumentListProps } from "./DocumentList";

// Internationalization & Locale (SPEC_19)
export { LocaleSwitcher, SUPPORTED_LOCALES } from "./components/LocaleSwitcher";
export type { LocaleOption } from "./components/LocaleSwitcher";
export { I18nProvider, useTranslation, enMessages } from "./i18n";
export type { I18nProviderProps } from "./i18n";

// Notification Components (SPEC_16)
export { NotificationBell } from "./components/NotificationBell";
export { NotificationCenter } from "./components/NotificationCenter";
export { NotificationToast, NotificationToastContainer, NotificationToaster } from "./components/NotificationToast";
export type { NotificationToastItem, NotificationToastProps, NotificationToastContainerProps, NotificationToastType } from "./components/NotificationToast";

// Enterprise Nuances & Real-World Modules
export { ItemCatalogModal } from "./ItemCatalogModal";
export type { ItemCatalogModalProps, SelectedCatalogItem } from "./ItemCatalogModal";
export { PunchOutModal } from "./PunchOutModal";
export type { PunchOutModalProps } from "./PunchOutModal";
export { SplitScreenViewer } from "./SplitScreenViewer";
export type { SplitScreenViewerProps, DocumentItem } from "./SplitScreenViewer";

// Ticket & Query Management Components (SPEC_26)
export * from "./components/tickets";

// Analytics & Spend Cube Components (SPEC_25)
export { SpendCubeVisualizer } from "./components/SpendCubeVisualizer";
export type { SpendCubeVisualizerProps, SpendCubeTab } from "./components/SpendCubeVisualizer";
export { MaverickSpendTable } from "./components/MaverickSpendTable";
export type { MaverickSpendTableProps } from "./components/MaverickSpendTable";
export { CustomReportBuilder } from "./components/CustomReportBuilder";
export type { CustomReportBuilderProps } from "./components/CustomReportBuilder";
export { ComplianceReportsView } from "./components/ComplianceReportsView";
export type { ComplianceReportsViewProps, ComplianceTab } from "./components/ComplianceReportsView";

// Multi-Tenant Company Switcher
export { CompanySwitcher } from "./components/CompanySwitcher";
export type { CompanySwitcherProps } from "./components/CompanySwitcher";

// Developer Platform & API Key Management
export { DeveloperPlatformDashboard } from "./components/DeveloperPlatformDashboard";

// Enterprise Compliance & Security Posture Dashboard
export { CompliancePostureDashboard } from "./components/CompliancePostureDashboard";

// Catalog & PunchOut Marketplace (SPEC_14)
export { CatalogMarketplace } from "./components/CatalogMarketplace";

// AI-Powered Autonomous Sourcing & Negotiation Copilot
export { AISourcingCopilot } from "./components/AISourcingCopilot";

// Government E-Invoicing & E-Way Bill Integration (India GST & Global Peppol)
export { EInvoiceComplianceViewer } from "./components/EInvoiceComplianceViewer";

// Dynamic Live Auction Engine (SPEC_11B)
export { LiveAuctionRoom } from "./components/LiveAuctionRoom";
export { LiveAuctionList } from "./components/LiveAuctionList";

// Automated 3-Way & 4-Way Invoice Reconciliation (SPEC_15)
export { InvoiceReconciliationWorkbench } from "./components/InvoiceReconciliationWorkbench";

// Contract Lifecycle Redlining & Collaborative Clause Editor (SPEC_13)
export { ContractRedlineStudio } from "./components/ContractRedlineStudio";
export type { ContractRedlineStudioProps } from "./components/ContractRedlineStudio";

// Automated Disaster Recovery Orchestrator & PITR Backup Drills (SPEC_21/SPEC_22)
export { DisasterRecoveryConsole } from "./components/DisasterRecoveryConsole";

// External Supplier Self-Onboarding & KYC Compliance Workbench (SPEC_07)
export { VendorOnboardingWorkbench } from "./components/VendorOnboardingWorkbench";

// Real-Time Spend Cube & Maverick Spend AI Intelligence (SPEC_25)
export { MaverickIntelligenceWorkbench } from "./components/MaverickIntelligenceWorkbench";
export type { MaverickIntelligenceWorkbenchProps } from "./components/MaverickIntelligenceWorkbench";

// Multi-ERP Bi-Directional Sync Gateway (SPEC_20)
export { ERPGatewayReconciliationConsole } from "./components/ERPGatewayReconciliationConsole";
export type { ERPGatewayReconciliationConsoleProps } from "./components/ERPGatewayReconciliationConsole";

// Automated Carbon & ESG Scope 1, 2, 3 Footprint Calculator (SPEC_25 / SPEC_07)
export { CarbonESGDashboard } from "./analytics/CarbonESGDashboard";

// Advanced Multi-Tier Approval Delegation Matrix & SoD Workbench (SPEC_06)
export { ApprovalDelegationWorkbench } from "./workflow/ApprovalDelegationWorkbench";
