export interface CapitalOverview {
  totalInvestments: number;
  totalInvested: number;
  maxInvestmentLimit: number | null;
  availableCapital: number | null;
  pendingAmount: number;
  completedInvestments: number;
}
