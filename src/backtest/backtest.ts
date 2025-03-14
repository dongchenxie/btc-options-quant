import type { BTCPriceData, BacktestResults } from '../types/priceData';
import { OptionStrategy } from '../strategy/optionStrategy';
import { parseISO, isAfter, isBefore } from 'date-fns';

/**
 * Run a backtest of the options strategy using historical price data
 * @param priceData Array of BTC price data points
 * @param strategy Initialized option strategy
 * @param startDate Optional start date for backtest (ISO string)
 * @param endDate Optional end date for backtest (ISO string)
 * @returns Backtest results
 */
export function backtestStrategy(
  priceData: BTCPriceData[],
  strategy: OptionStrategy,
  startDate?: string,
  endDate?: string
): BacktestResults {
  if (priceData.length === 0) {
    throw new Error('Price data cannot be empty');
  }

  // Sort price data by timestamp (ascending)
  const sortedData = [...priceData].sort((a, b) => 
    new Date(a.t).getTime() - new Date(b.t).getTime()
  );

  // Filter data by date range if specified
  const filteredData = sortedData.filter(data => {
    const dataDate = parseISO(data.t);
    if (startDate && isBefore(dataDate, parseISO(startDate))) {
      return false;
    }
    if (endDate && isAfter(dataDate, parseISO(endDate))) {
      return false;
    }
    return true;
  });

  if (filteredData.length === 0) {
    throw new Error('No data points found in the specified date range');
  }

  // Record initial values
  const startingBTC = strategy.getBTCBalance();
  const startingUSD = strategy.getUSDBalance();

  // Process each price data point
  for (const dataPoint of filteredData) {
    strategy.processPriceData(dataPoint);
  }

  // Get final values
  const finalBTC = strategy.getBTCBalance();
  const finalUSD = strategy.getUSDBalance();
  const trades = strategy.getTrades();
  const totalPremiumCollected = strategy.getTotalPremiumCollected();
  const assignedPuts = strategy.getAssignedPuts();

  return {
    startingBTC,
    finalBTC,
    startingUSD,
    finalUSD,
    totalTrades: trades.length,
    assignedPuts,
    totalPremiumCollected,
    trades,
    startDate: filteredData[0].t,
    endDate: filteredData[filteredData.length - 1].t
  };
}

/**
 * Calculate strategy performance metrics
 * @param results Backtest results
 * @param finalBTCPrice Final BTC price for portfolio valuation
 */
export function calculatePerformanceMetrics(
  results: BacktestResults,
  finalBTCPrice: number
): {
  btcGrowthPercent: number;
  usdValueGrowthPercent: number;
  finalPortfolioValueUSD: number;
} {
  const initialPortfolioValueUSD = results.startingBTC * finalBTCPrice + results.startingUSD;
  const finalPortfolioValueUSD = results.finalBTC * finalBTCPrice + results.finalUSD;
  
  const btcGrowthPercent = ((results.finalBTC - results.startingBTC) / results.startingBTC) * 100;
  const usdValueGrowthPercent = ((finalPortfolioValueUSD - initialPortfolioValueUSD) / initialPortfolioValueUSD) * 100;
  
  return {
    btcGrowthPercent,
    usdValueGrowthPercent,
    finalPortfolioValueUSD
  };
} 