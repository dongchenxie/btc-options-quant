// Define the structure for BTC price data points
export interface BTCPriceData {
  t: string; // Timestamp in ISO format e.g. "2024-01-01T08:08:08"
  p: number; // Price in USD
}

// Strategy configuration
export interface StrategyConfig {
  initialBTC: number;       // Starting BTC balance
  initialUSD: number;       // Starting USD balance
  putOptionPremiumPercent: number; // Premium as % of strike price
  strikePercentage: number; // Strike price % below current price
  daysToExpiration: number; // Option expiry in days
}

// Option contract
export interface OptionContract {
  type: 'PUT';             // Only considering PUT options for now
  strikePrice: number;     // Strike price in USD
  premium: number;         // Premium in USD
  createdAt: string;       // ISO timestamp when created
  expiresAt: string;       // ISO timestamp when expires
  isActive: boolean;       // Whether option is still active
  wasAssigned: boolean;    // Whether option was assigned
}

// Backtest results
export interface BacktestResults {
  startingBTC: number;
  finalBTC: number;
  startingUSD: number;
  finalUSD: number;
  totalTrades: number;
  assignedPuts: number;
  totalPremiumCollected: number;
  trades: TradeRecord[];
}

// Record of individual trades
export interface TradeRecord {
  timestamp: string;
  action: 'SELL_PUT' | 'PUT_EXPIRED' | 'PUT_ASSIGNED';
  btcPrice: number;
  strikePrice?: number;
  premium?: number;
  btcBalance: number;
  usdBalance: number;
} 