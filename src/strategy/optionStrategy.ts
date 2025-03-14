import { addDays, parseISO, isAfter, isBefore, differenceInDays } from 'date-fns';
import Decimal from 'decimal.js';
import type { BTCPriceData, OptionContract, StrategyConfig, TradeRecord } from '../types/priceData';
import { calculateHistoricalVolatility, calculateImpliedVolatility } from '../utils/volatility';

export class OptionStrategy {
  private btcBalance: Decimal;
  private usdBalance: Decimal;
  private config: StrategyConfig;
  private activeOptions: OptionContract[] = [];
  private trades: TradeRecord[] = [];
  private totalPremiumCollected: Decimal = new Decimal(0);
  private assignedPuts: number = 0;
  private priceHistory: BTCPriceData[] = [];
  private readonly maxPriceHistory: number = 100; // Keep last 100 price points
  private readonly minPriceHistory: number = 31; // Minimum required for volatility calculation
  private currentDate: string = '';

  constructor(config: StrategyConfig) {
    this.btcBalance = new Decimal(config.initialBTC);
    this.usdBalance = new Decimal(config.initialUSD);
    this.config = config;
  }

  // Process a new price data point
  public processPriceData(priceData: BTCPriceData): void {
    const currentPrice = new Decimal(priceData.p);
    const currentTime = priceData.t;
    
    // Update current date for time-aware decisions
    this.currentDate = currentTime;

    // Update price history chronologically
    this.updatePriceHistory(priceData);

    // First, check if any active options are expired
    this.checkExpirations(currentTime, currentPrice);

    // Then, consider selling a new put option if we have enough cash and data
    if (this.hasEnoughPriceHistory()) {
      this.considerSellingPut(priceData);
    }
  }

  private hasEnoughPriceHistory(): boolean {
    return this.priceHistory.length >= this.minPriceHistory;
  }

  private updatePriceHistory(priceData: BTCPriceData): void {
    // Ensure price history is chronologically ordered
    const shouldAdd = this.priceHistory.length === 0 || 
                     (this.priceHistory.length > 0 && 
                      isAfter(parseISO(priceData.t), parseISO(this.priceHistory[this.priceHistory.length - 1]?.t || '')));
    
    if (shouldAdd) {
      this.priceHistory.push(priceData);
      if (this.priceHistory.length > this.maxPriceHistory) {
        this.priceHistory.shift();
      }
    }
  }

  // Check if any options have expired and handle accordingly
  private checkExpirations(currentTime: string, currentPrice: Decimal): void {
    // Filter options that are still active
    const stillActiveOptions: OptionContract[] = [];

    for (const option of this.activeOptions) {
      if (!option.isActive) continue;

      const expiryTime = parseISO(option.expiresAt);
      
      // Check if option has expired
      if (isAfter(parseISO(currentTime), expiryTime)) {
        option.isActive = false;
        
        // Check if put option is assigned (current price < strike price)
        const strikePrice = new Decimal(option.strikePrice);
        
        if (currentPrice.lessThan(strikePrice)) {
          // PUT is assigned - we buy BTC at strike price
          option.wasAssigned = true;
          this.assignedPuts++;
          
          // Calculate how much BTC we buy with the strike price
          const btcAmount = this.usdBalance.div(strikePrice);
          this.btcBalance = this.btcBalance.plus(btcAmount);
          this.usdBalance = new Decimal(0); // All USD used to buy BTC

          // Record the trade
          this.trades.push({
            timestamp: currentTime,
            action: 'PUT_ASSIGNED',
            btcPrice: currentPrice.toNumber(),
            strikePrice: strikePrice.toNumber(),
            btcBalance: this.btcBalance.toNumber(),
            usdBalance: this.usdBalance.toNumber()
          });
        } else {
          // PUT expired worthless, we keep the premium
          this.trades.push({
            timestamp: currentTime,
            action: 'PUT_EXPIRED',
            btcPrice: currentPrice.toNumber(),
            strikePrice: option.strikePrice,
            btcBalance: this.btcBalance.toNumber(),
            usdBalance: this.usdBalance.toNumber()
          });
        }
      } else {
        // Option is still active
        stillActiveOptions.push(option);
      }
    }

    // Update active options
    this.activeOptions = stillActiveOptions;
  }

  // Consider selling a new put option
  private considerSellingPut(priceData: BTCPriceData): void {
    const currentPrice = new Decimal(priceData.p);
    
    // Only sell new options if we have USD and no active options
    if (this.usdBalance.greaterThan(0) && this.activeOptions.length === 0) {
      // Calculate strike price (e.g., 5% below current price)
      const strikePercentage = new Decimal(this.config.strikePercentage);
      const strikePrice = currentPrice.times(new Decimal(1).minus(strikePercentage));
      
      // Calculate time to expiry in years
      const daysToExpiry = this.config.daysToExpiration;
      const timeToExpiry = daysToExpiry / 365;
      
      // Calculate historical volatility using only data up to current date
      const pastPriceHistory = this.getPastPriceHistory(priceData.t);
      const volatility = calculateHistoricalVolatility(pastPriceHistory);
      
      // Calculate premium using Black-Scholes model
      const premium = this.calculateOptionPremium(
        currentPrice.toNumber(),
        strikePrice.toNumber(),
        timeToExpiry,
        volatility
      );
      
      // Calculate expiration date
      const expiresAt = addDays(parseISO(priceData.t), this.config.daysToExpiration).toISOString();
      
      // Create option contract
      const newOption: OptionContract = {
        type: 'PUT',
        strikePrice: strikePrice.toNumber(),
        premium: premium,
        createdAt: priceData.t,
        expiresAt: expiresAt,
        isActive: true,
        wasAssigned: false
      };
      
      // Add option to active options
      this.activeOptions.push(newOption);
      
      // Add premium to USD balance
      this.usdBalance = this.usdBalance.plus(premium);
      this.totalPremiumCollected = this.totalPremiumCollected.plus(premium);
      
      // Record the trade
      this.trades.push({
        timestamp: priceData.t,
        action: 'SELL_PUT',
        btcPrice: currentPrice.toNumber(),
        strikePrice: strikePrice.toNumber(),
        premium: premium,
        btcBalance: this.btcBalance.toNumber(),
        usdBalance: this.usdBalance.toNumber()
      });
    }
  }

  // Get only price history up to a specific date
  private getPastPriceHistory(currentDate: string): BTCPriceData[] {
    const currentDateTime = parseISO(currentDate);
    return this.priceHistory.filter(data => {
      return !isAfter(parseISO(data.t), currentDateTime);
    });
  }

  private calculateOptionPremium(
    currentPrice: number,
    strikePrice: number,
    timeToExpiry: number,
    volatility: number
  ): number {
    // For put options, we need to use put-call parity
    // Put price = Call price + Strike * e^(-r*t) - Current price
    const riskFreeRate = 0.05; // 5% annual rate
    const callPrice = this.calculateCallPrice(
      currentPrice,
      strikePrice,
      timeToExpiry,
      volatility,
      riskFreeRate
    );
    
    const putPrice = callPrice + 
                    strikePrice * Math.exp(-riskFreeRate * timeToExpiry) - 
                    currentPrice;
    
    return putPrice;
  }

  private calculateCallPrice(
    currentPrice: number,
    strikePrice: number,
    timeToExpiry: number,
    volatility: number,
    riskFreeRate: number
  ): number {
    const d1 = (Math.log(currentPrice / strikePrice) + 
                (riskFreeRate + volatility * volatility / 2) * timeToExpiry) / 
               (volatility * Math.sqrt(timeToExpiry));
    const d2 = d1 - volatility * Math.sqrt(timeToExpiry);
    
    const callPrice = currentPrice * this.normalCDF(d1) - 
                     strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * this.normalCDF(d2);
    
    return callPrice;
  }

  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
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

  // Get the current portfolio value in USD
  public getPortfolioValueInUSD(btcPrice: number): number {
    const btcValue = this.btcBalance.times(btcPrice);
    return btcValue.plus(this.usdBalance).toNumber();
  }

  // Getters for strategy results
  public getBTCBalance(): number {
    return this.btcBalance.toNumber();
  }

  public getUSDBalance(): number {
    return this.usdBalance.toNumber();
  }

  public getTrades(): TradeRecord[] {
    return this.trades;
  }

  public getTotalPremiumCollected(): number {
    return this.totalPremiumCollected.toNumber();
  }

  public getAssignedPuts(): number {
    return this.assignedPuts;
  }
} 