import Decimal from 'decimal.js';
import type { BTCPriceData } from '../types/priceData';

/**
 * Calculate historical volatility from price data
 * @param priceData Array of BTC price data points
 * @param windowSize Number of data points to use for calculation
 * @returns Annualized volatility
 */
export function calculateHistoricalVolatility(
  priceData: BTCPriceData[],
  windowSize: number = 30
): number {
  if (!priceData || priceData.length < windowSize + 1) {
    // Return a default volatility if not enough data
    return 0.5; // 50% annualized volatility as default
  }

  try {
    // Calculate log returns
    const logReturns: number[] = [];
    for (let i = 1; i <= windowSize; i++) {
      const currentPriceData = priceData[priceData.length - i];
      const previousPriceData = priceData[priceData.length - i - 1];
      
      if (!currentPriceData || !previousPriceData) {
        continue;
      }

      const currentPrice = new Decimal(currentPriceData.p);
      const previousPrice = new Decimal(previousPriceData.p);
      const logReturn = currentPrice.ln().minus(previousPrice.ln());
      logReturns.push(logReturn.toNumber());
    }

    // Calculate mean of log returns
    const mean = logReturns.reduce((sum, ret) => sum + ret, 0) / logReturns.length;

    // Calculate standard deviation
    const squaredDiffs = logReturns.map(ret => Math.pow(ret - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / (logReturns.length - 1);
    const stdDev = Math.sqrt(variance);

    // Annualize volatility (assuming daily data)
    const annualizedVolatility = stdDev * Math.sqrt(365);

    // Ensure volatility is within reasonable bounds
    return Math.min(Math.max(annualizedVolatility, 0.1), 2.0); // Between 10% and 200%
  } catch (error) {
    console.error('Error calculating historical volatility:', error);
    return 0.5; // Return default volatility on error
  }
}

/**
 * Calculate implied volatility using Newton-Raphson method
 * @param currentPrice Current BTC price
 * @param strikePrice Strike price of the option
 * @param timeToExpiry Time to expiry in years
 * @param optionPrice Option price (premium)
 * @param riskFreeRate Risk-free interest rate
 * @returns Implied volatility
 */
export function calculateImpliedVolatility(
  currentPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  optionPrice: number,
  riskFreeRate: number = 0.05 // Default 5% annual rate
): number {
  // Initial guess for volatility (30%)
  let volatility = 0.3;
  const tolerance = 0.0001;
  const maxIterations = 100;
  let iteration = 0;

  while (iteration < maxIterations) {
    const price = blackScholes(
      currentPrice,
      strikePrice,
      timeToExpiry,
      volatility,
      riskFreeRate
    );

    const diff = price - optionPrice;
    if (Math.abs(diff) < tolerance) {
      return volatility;
    }

    // Newton-Raphson update
    const vega = calculateVega(currentPrice, strikePrice, timeToExpiry, volatility, riskFreeRate);
    volatility = volatility - diff / vega;

    iteration++;
  }

  throw new Error('Implied volatility calculation did not converge');
}

/**
 * Calculate option price using Black-Scholes model
 */
function blackScholes(
  currentPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number
): number {
  const d1 = calculateD1(currentPrice, strikePrice, timeToExpiry, volatility, riskFreeRate);
  const d2 = calculateD2(d1, volatility, timeToExpiry);
  
  const price = currentPrice * normalCDF(d1) - 
                strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2);
  
  return price;
}

/**
 * Calculate vega (sensitivity to volatility)
 */
function calculateVega(
  currentPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number
): number {
  const d1 = calculateD1(currentPrice, strikePrice, timeToExpiry, volatility, riskFreeRate);
  return currentPrice * Math.sqrt(timeToExpiry) * normalPDF(d1);
}

function calculateD1(
  currentPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number
): number {
  return (Math.log(currentPrice / strikePrice) + 
          (riskFreeRate + volatility * volatility / 2) * timeToExpiry) / 
         (volatility * Math.sqrt(timeToExpiry));
}

function calculateD2(d1: number, volatility: number, timeToExpiry: number): number {
  return d1 - volatility * Math.sqrt(timeToExpiry);
}

// Standard normal cumulative distribution function
function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

// Standard normal probability density function
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Error function
function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
} 