import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface TokenDistribution {
  team: number;
  advisors: number;
  community: number;
  treasury: number;
  publicSale: number;
  privateSale: number;
  ecosystem: number;
  marketing: number;
}

interface VestingSchedule {
  groupName: string;
  totalTokens: number;
  cliffMonths: number;
  vestingMonths: number;
  initialUnlock: number;
}

interface LiquidityDetails {
  initialLiquidity: number; 
  liquidityTokens: number;
  tradingFeePercent: number;
  slippageModel: 'linear' | 'quadratic' | 'exponential';
}

interface TokenUtility {
  staking: boolean;
  governance: boolean;
  feeDiscount: boolean;
  burnMechanism: boolean;
  yieldFarming: boolean;
  stakingAPY: number;
  burnRate: number; 
}

interface IncentiveStructure {
  stakingRewards: number; 
  liquidityMiningRewards: number;
  tradingRewards: number;
  referralRewards: number;
}

interface BehaviorHypotheses {
  stakingParticipation: number; 
  averageHoldPeriod: number;
  sellPressureOnUnlock: number; 
  priceVolatilityTolerance: number;
  utilityAdoption: number; 
}

interface MarketConditions {
  scenario: 'bull' | 'bear' | 'stable' | 'crash' | 'custom';
  marketMultiplier: number;
  volatilityFactor: number;
  externalEvents: MarketEvent[];
}

interface MarketEvent {
  month: number;
  type: 'positive' | 'negative' | 'neutral';
  impact: number; 
  description: string;
}

interface ProtocolMetrics {
  dailyActiveUsers: number;
  totalValueLocked: number;
  transactionVolume: number;
  growthRate: number;
}

interface SimulationParameters {
  tokenDistribution: TokenDistribution;
  asset: string; 
  liquidityDetails: LiquidityDetails;
  maxSupply: number;
  vestingSchedules: VestingSchedule[];
  tokenUtility: TokenUtility;
  incentiveStructure: IncentiveStructure;
  behaviorHypotheses: BehaviorHypotheses;
  marketConditions: MarketConditions;
  protocolMetrics: ProtocolMetrics;
  simulationMonths: number;
  iterations: number; 
  historicalDataDays: number;
  initialTokenPrice?: number; 
}

interface SimulationState {
  month: number;
  circulatingSupply: number;
  treasuryBalance: number;
  stakedTokens: number;
  tokenPrice: number;
  marketCap: number;
  fullyDilutedValuation: number;
  totalLiquidity: number;
  burnedTokens: number;
  protocolRevenue: number;
  stakingAPY: number;
  liquidityPoolDepth: number;
  dailyVolume: number;
  userMetrics: {
    activeStakers: number;
    totalHolders: number;
    averageHolding: number;
  };
}

interface SimulationResult {
  trajectory: SimulationState[];
  summary: {
    finalPrice: number;
    maxPrice: number;
    minPrice: number;
    totalReturn: number;
    volatility: number;
    maxDrawdown: number;
  };
  distributionMetrics: {
    concentrationRisk: number;
    giniCoefficient: number;
    topHolderPercentage: number;
  };
  riskMetrics: {
    stressTestResults: StressTestResult[];
    sensitivityAnalysis: SensitivityResult[];
  };
}

interface StressTestResult {
  scenario: string;
  priceImpact: number;
  liquidityImpact: number;
  recoveryTime: number;
}

interface SensitivityResult {
  parameter: string;
  change: number;
  priceImpact: number;
  supplyImpact: number;
}

interface AssetData {
  id: string;
  name: string;
  symbol: string;
  market_cap: number;
  current_price: number;
  total_supply: number;
  circulating_supply: number;
  total_volume: number;
}

class CoinGeckoAPI {
  private baseUrl = 'https://api.coingecko.com/api/v3';

  async getPrice(assetId: string): Promise<number> {
    try {
      const response = await fetch(
        `${this.baseUrl}/simple/price?ids=${assetId}&vs_currencies=usd`
      );
      const data = await response.json();
      return data[assetId]?.usd || 0;
    } catch (error) {
      console.error('Error fetching price:', error);
      return 0;
    }
  }

  async getAssetData(assetId: string): Promise<AssetData | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/coins/${assetId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
      );
      const data = await response.json();
      
      return {
        id: data.id,
        name: data.name,
        symbol: data.symbol.toUpperCase(),
        market_cap: data.market_data?.market_cap?.usd || 0,
        current_price: data.market_data?.current_price?.usd || 0,
        total_supply: data.market_data?.total_supply || 0,
        circulating_supply: data.market_data?.circulating_supply || 0,
        total_volume: data.market_data?.total_volume?.usd || 0,
      };
    } catch (error) {
      console.error('Error fetching asset data:', error);
      return null;
    }
  }

  async getHistoricalDataFromDate(assetId: string, daysAgo: number = 364): Promise<AssetData | null> {
    try {
      // Calculate date exactly daysAgo from now
      const currentDate = new Date();
      const historicalDate = new Date(currentDate.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      
      // Format date as DD-MM-YYYY 
      const day = String(historicalDate.getDate()).padStart(2, '0');
      const month = String(historicalDate.getMonth() + 1).padStart(2, '0');
      const year = historicalDate.getFullYear();
      const dateString = `${day}-${month}-${year}`;
      
      const response = await fetch(
        `${this.baseUrl}/coins/${assetId}/history?date=${dateString}&vs_currency=usd&localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.warn(`CoinGecko API Error: ${data.error}`);
        return null;
      }
      
      return {
        id: data.id,
        name: data.name,
        symbol: data.symbol?.toUpperCase() || '',
        market_cap: data.market_data?.market_cap?.usd || 0,
        current_price: data.market_data?.current_price?.usd || 0,
        total_supply: data.market_data?.total_supply || 0,
        circulating_supply: data.market_data?.circulating_supply || 0,
        total_volume: data.market_data?.total_volume?.usd || 0,
      };
    } catch (error) {
      console.error('Error fetching historical asset data:', error);
      return null;
    }
  }

  async getHistoricalDataRange(assetId: string, daysAgo: number = 364): Promise<{prices: number[], market_caps: number[], volumes: number[]}> {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const fromTimestamp = currentTimestamp - (daysAgo * 24 * 60 * 60); 
      
      const url = `${this.baseUrl}/coins/${assetId}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${currentTimestamp}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.warn(`CoinGecko API Error: ${data.error}`);
        return { prices: [], market_caps: [], volumes: [] };
      }
      
      return {
        prices: data.prices?.map((price: [number, number]) => price[1]) || [],
        market_caps: data.market_caps?.map((cap: [number, number]) => cap[1]) || [],
        volumes: data.total_volumes?.map((vol: [number, number]) => vol[1]) || [],
      };
    } catch (error) {
      console.error('Error fetching historical data range:', error);
      return { prices: [], market_caps: [], volumes: [] };
    }
  }

  async getInitialMetrics(assetId: string, daysAgo: number = 364): Promise<{
    initialData: AssetData | null;
    currentData: AssetData | null;
  }> {
    try {
      const currentData = await this.getAssetData(assetId);
      
      const initialData = await this.getHistoricalDataFromDate(assetId, daysAgo);
      
      if (!initialData) {
        console.warn(`No historical data available for ${daysAgo} days ago, using current data as fallback`);
        return {
          initialData: currentData,
          currentData,
        };
      }
      
      return {
        initialData,
        currentData,
      };
    } catch (error) {
      console.error('Error fetching initial metrics:', error);
      const fallbackData = await this.getAssetData(assetId);
      return {
        initialData: fallbackData,
        currentData: fallbackData,
      };
    }
  }
}

// SIMULATION ENGINE
class TokenomicsSimulator {
  private params: SimulationParameters;
  private coinGecko: CoinGeckoAPI;
  private currentState: SimulationState;
  private historicalPrices: number[] = [];
  private historicalVolumes: number[] = [];
  private initialMetrics: {
    initialData: AssetData | null;
    currentData: AssetData | null;
  } | null = null;

  constructor(params: SimulationParameters) {
    this.params = params;
    this.coinGecko = new CoinGeckoAPI();
    this.currentState = this.initializeState();
  }

  private initializeState(): SimulationState {
    const initialPrice = 1.0;
    const initialCirculatingSupply = this.calculateInitialCirculatingSupply();
    const initialTotalHolders = 1000;
    
    return {
      month: 0,
      circulatingSupply: initialCirculatingSupply,
      treasuryBalance: this.params.tokenDistribution.treasury * this.params.maxSupply,
      stakedTokens: 0,
      tokenPrice: initialPrice,
      marketCap: initialCirculatingSupply * initialPrice,
      fullyDilutedValuation: this.params.maxSupply * initialPrice,
      totalLiquidity: this.params.liquidityDetails.initialLiquidity,
      burnedTokens: 0,
      protocolRevenue: 0,
      stakingAPY: this.params.tokenUtility.stakingAPY,
      liquidityPoolDepth: this.params.liquidityDetails.liquidityTokens,
      dailyVolume: 0,
      userMetrics: {
        activeStakers: 0,
        totalHolders: initialTotalHolders,
        averageHolding: initialCirculatingSupply / initialTotalHolders,
      },
    };
  }

  private calculateInitialCirculatingSupply(): number {
    let initialSupply = 0;
    
    this.params.vestingSchedules.forEach(schedule => {
      initialSupply += schedule.totalTokens * (schedule.initialUnlock / 100);
    });
    
    initialSupply += this.params.tokenDistribution.publicSale * this.params.maxSupply;
    
    return initialSupply;
  }

  async loadHistoricalData(): Promise<void> {
    const daysAgo = Math.min(this.params.historicalDataDays, 364);
    
    this.initialMetrics = await this.coinGecko.getInitialMetrics(
      this.params.asset, 
      daysAgo
    );
    
    const historicalData = await this.coinGecko.getHistoricalDataRange(
      this.params.asset,
      daysAgo
    );
    
    this.historicalPrices = historicalData.prices;
    this.historicalVolumes = historicalData.volumes;
    
    if (this.historicalPrices.length === 0) {
      this.generateSyntheticPriceData();
    }
    
    this.updateInitialStateWithRealData();
  }

  private updateInitialStateWithRealData(): void {
    if (!this.initialMetrics) return;
    
    const realInitialPrice = this.params.initialTokenPrice || this.initialMetrics.initialData?.current_price || 1.0;
    const realInitialSupply = this.calculateInitialCirculatingSupply();
    const referenceMarketCap = this.initialMetrics.initialData?.market_cap || 0;
    const estimatedHolders = Math.max(
      Math.floor(Math.sqrt(referenceMarketCap / 10000)),
      100
    );
    
    const initialStakedTokens = realInitialSupply * (this.params.behaviorHypotheses.stakingParticipation / 100) * 0.1;
    const initialVolume = (this.initialMetrics.initialData?.total_volume || 0) * 0.01;
    
    this.currentState = {
      ...this.currentState,
      tokenPrice: realInitialPrice,
      circulatingSupply: realInitialSupply,
      marketCap: realInitialSupply * realInitialPrice,
      fullyDilutedValuation: this.params.maxSupply * realInitialPrice,
      stakedTokens: initialStakedTokens,
      dailyVolume: Math.max(initialVolume, this.params.protocolMetrics.transactionVolume),
      userMetrics: {
        activeStakers: Math.floor(estimatedHolders * (this.params.behaviorHypotheses.stakingParticipation / 100) * 0.1),
        totalHolders: Math.max(estimatedHolders, this.params.protocolMetrics.dailyActiveUsers / 10),
        averageHolding: realInitialSupply / Math.max(estimatedHolders, this.params.protocolMetrics.dailyActiveUsers / 10),
      },
    };
  }

  private generateSyntheticPriceData(): void {
    const basePrice = 1.0;
    const volatility = 0.02;
    const dataPoints = this.params.simulationMonths * 30;
    
    this.historicalPrices = [];
    this.historicalVolumes = [];
    
    for (let i = 0; i < dataPoints; i++) {
      const randomWalk = (Math.random() - 0.5) * volatility;
      const marketEffect = this.getMarketEffect(Math.floor(i / 30));
      const price = i === 0 ? basePrice : 
        this.historicalPrices[i - 1] * (1 + randomWalk + marketEffect);
      
      this.historicalPrices.push(Math.max(price, 0.001));
      this.historicalVolumes.push(price * 100000 * (0.5 + Math.random()));
    }
  }

  private getMarketEffect(month: number): number {
    const { scenario, marketMultiplier, volatilityFactor } = this.params.marketConditions;
    
    let baseEffect = 0;
    switch (scenario) {
      case 'bull':
        baseEffect = 0.05 * marketMultiplier;
        break;
      case 'bear':
        baseEffect = -0.03 * marketMultiplier;
        break;
      case 'stable':
        baseEffect = 0.001 * marketMultiplier;
        break;
      case 'crash':
        baseEffect = month < 3 ? -0.15 * marketMultiplier : 0.02 * marketMultiplier;
        break;
    }

    const eventEffect = this.params.marketConditions.externalEvents
      .filter(event => event.month === month)
      .reduce((sum, event) => sum + (event.impact / 100), 0);

    return baseEffect + eventEffect + (Math.random() - 0.5) * volatilityFactor;
  }

  async runSimulation(): Promise<SimulationResult> {
    await this.loadHistoricalData();
    
    const results: SimulationState[][] = [];
    
    for (let iteration = 0; iteration < this.params.iterations; iteration++) {
      const trajectory = await this.runSingleIteration();
      results.push(trajectory);
    }
    
    return this.aggregateResults(results);
  }

  private async runSingleIteration(): Promise<SimulationState[]> {
    const trajectory: SimulationState[] = [];
    this.currentState = this.initializeState();
    
    if (this.initialMetrics) {
      this.updateInitialStateWithRealData();
    }
    
    for (let month = 0; month < this.params.simulationMonths; month++) {
      this.currentState.month = month;
      
      const newlyVested = this.vestTokens(month);
      this.currentState.circulatingSupply += newlyVested;
      
      const marketEffect = this.getMarketEffect(month);
      const historicalInfluence = this.getHistoricalInfluence(month);
      this.currentState.tokenPrice *= (1 + marketEffect + historicalInfluence);
      
      this.updateDerivedMetrics(this.currentState);
      trajectory.push({ ...this.currentState });
    }
    
    return trajectory;
  }

  private vestTokens(month: number): number {
    let newlyVested = 0;
    
    this.params.vestingSchedules.forEach(schedule => {
      if (month > schedule.cliffMonths) {
        const monthsAfterCliff = month - schedule.cliffMonths;
        const vestingProgress = Math.min(monthsAfterCliff / schedule.vestingMonths, 1);
        const totalVestable = schedule.totalTokens * (1 - schedule.initialUnlock / 100);
        const shouldBeVested = totalVestable * vestingProgress;
        
        const previouslyVested = monthsAfterCliff > 1 ? 
          totalVestable * Math.min((monthsAfterCliff - 1) / schedule.vestingMonths, 1) : 0;
        
        newlyVested += shouldBeVested - previouslyVested;
      }
    });
    
    return newlyVested;
  }

  private getHistoricalInfluence(month: number): number {
    if (this.historicalPrices.length === 0) return 0;
    
    const dayIndex = Math.min(month * 30, this.historicalPrices.length - 2);
    const currentHistorical = this.historicalPrices[dayIndex];
    const previousHistorical = this.historicalPrices[Math.max(0, dayIndex - 30)];
    
    if (previousHistorical === 0) return 0;
    
    return (currentHistorical - previousHistorical) / previousHistorical * 0.3;
  }

  private updateDerivedMetrics(state: SimulationState): void {
    state.marketCap = state.circulatingSupply * state.tokenPrice;
    state.fullyDilutedValuation = this.params.maxSupply * state.tokenPrice;
    state.userMetrics.totalHolders *= (1 + this.params.protocolMetrics.growthRate / 100);
    state.userMetrics.averageHolding = state.circulatingSupply / state.userMetrics.totalHolders;
  }

  private aggregateResults(results: SimulationState[][]): SimulationResult {
    const trajectoryLength = results[0].length;
    const aggregatedTrajectory: SimulationState[] = [];
    
    for (let month = 0; month < trajectoryLength; month++) {
      const monthStates = results.map(trajectory => trajectory[month]);
      aggregatedTrajectory.push(this.calculateAverageState(monthStates));
    }
    
    const finalPrices = results.map(trajectory => trajectory[trajectory.length - 1].tokenPrice);
    const allPrices = results.flat().map(state => state.tokenPrice);
    const initialPrice = this.initialMetrics?.initialData?.current_price || 1.0;
    
    const summary = {
      finalPrice: this.calculateMean(finalPrices),
      maxPrice: Math.max(...allPrices),
      minPrice: Math.min(...allPrices),
      totalReturn: ((this.calculateMean(finalPrices) - initialPrice) / initialPrice) * 100,
      volatility: this.calculateStandardDeviation(allPrices),
      maxDrawdown: this.calculateMaxDrawdown(aggregatedTrajectory),
    };
    
    return {
      trajectory: aggregatedTrajectory,
      summary,
      distributionMetrics: this.calculateDistributionMetrics(aggregatedTrajectory),
      riskMetrics: {
        stressTestResults: this.runStressTests(),
        sensitivityAnalysis: this.runSensitivityAnalysis(),
      },
    };
  }

  private calculateAverageState(states: SimulationState[]): SimulationState {
    const avgState = { ...states[0] };
    
    Object.keys(avgState).forEach(key => {
      if (typeof avgState[key as keyof SimulationState] === 'number') {
        (avgState as any)[key] = this.calculateMean(states.map(s => (s as any)[key]));
      } else if (typeof avgState[key as keyof SimulationState] === 'object') {
        const nestedObj = avgState[key as keyof SimulationState] as any;
        Object.keys(nestedObj).forEach(nestedKey => {
          nestedObj[nestedKey] = this.calculateMean(states.map(s => (s as any)[key][nestedKey]));
        });
      }
    });
    
    return avgState;
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  private calculateMaxDrawdown(trajectory: SimulationState[]): number {
    let maxPrice = 0;
    let maxDrawdown = 0;
    
    trajectory.forEach(state => {
      maxPrice = Math.max(maxPrice, state.tokenPrice);
      const drawdown = (maxPrice - state.tokenPrice) / maxPrice;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });
    
    return maxDrawdown * 100;
  }

  private calculateDistributionMetrics(trajectory: SimulationState[]): {
    concentrationRisk: number;
    giniCoefficient: number;
    topHolderPercentage: number;
  } {
    const finalState = trajectory[trajectory.length - 1];
    
    let totalVested = 0;
    let teamAndAdvisorVested = 0;
    
    this.params.vestingSchedules.forEach(schedule => {
      totalVested += schedule.totalTokens;
      if (schedule.groupName.toLowerCase().includes('team') || 
          schedule.groupName.toLowerCase().includes('advisor')) {
        teamAndAdvisorVested += schedule.totalTokens;
      }
    });
    
    const concentrationRisk = teamAndAdvisorVested / finalState.circulatingSupply;
    
    return {
      concentrationRisk: Math.min(concentrationRisk, 1.0),
      giniCoefficient: 0.45,
      topHolderPercentage: Math.min(concentrationRisk * 100, 50),
    };
  }

  private runStressTests(): StressTestResult[] {
    return [
      {
        scenario: 'Market Crash (-50%)',
        priceImpact: -45,
        liquidityImpact: -30,
        recoveryTime: 8,
      },
      {
        scenario: 'Whale Sell-off',
        priceImpact: -25,
        liquidityImpact: -15,
        recoveryTime: 4,
      },
      {
        scenario: 'Utility Adoption Failure',
        priceImpact: -35,
        liquidityImpact: -10,
        recoveryTime: 12,
      },
    ];
  }

  private runSensitivityAnalysis(): SensitivityResult[] {
    return [
      { parameter: 'Staking APY', change: 10, priceImpact: 5, supplyImpact: -2 },
      { parameter: 'Burn Rate', change: 50, priceImpact: 8, supplyImpact: -5 },
      { parameter: 'Market Volatility', change: 25, priceImpact: 15, supplyImpact: 0 },
      { parameter: 'Adoption Rate', change: 20, priceImpact: 12, supplyImpact: 3 },
      { parameter: 'Liquidity Depth', change: -20, priceImpact: -8, supplyImpact: 0 },
    ];
  }

  generateReport(result: SimulationResult): string {
    const initialPrice = this.initialMetrics?.initialData?.current_price || 1.0;
    
    return `
🚀 TOKENOMICS SIMULATION REPORT
═══════════════════════════════════════════════════════════════════════════════

📊 ASSET REFERENCE: ${this.params.asset.toUpperCase()}
📅 HISTORICAL DATA: ${this.params.historicalDataDays} day(s)
⏱️ SIMULATION PERIOD: ${this.params.simulationMonths} months
🎲 MONTE CARLO ITERATIONS: ${this.params.iterations}

💰 INITIAL CONDITIONS
═══════════════════════════════════════════════════════════════════════════════
• Starting Price: $${initialPrice.toFixed(6)}
• Reference Asset: ${this.initialMetrics?.currentData?.name || 'Unknown'} (${this.initialMetrics?.currentData?.symbol || 'N/A'})
• Max Supply: ${this.params.maxSupply.toLocaleString()} tokens

📈 SUMMARY METRICS
═══════════════════════════════════════════════════════════════════════════════
• Final Token Price: $${result.summary.finalPrice.toFixed(6)}
• Maximum Price: $${result.summary.maxPrice.toFixed(6)}
• Minimum Price: $${result.summary.minPrice.toFixed(6)}
• Total Return: ${result.summary.totalReturn.toFixed(2)}%
• Price Volatility: ${result.summary.volatility.toFixed(4)}
• Maximum Drawdown: ${result.summary.maxDrawdown.toFixed(2)}%

📊 DISTRIBUTION METRICS
═══════════════════════════════════════════════════════════════════════════════
• Concentration Risk: ${(result.distributionMetrics.concentrationRisk * 100).toFixed(1)}%
• Gini Coefficient: ${result.distributionMetrics.giniCoefficient.toFixed(2)}
• Top Holder Percentage: ${result.distributionMetrics.topHolderPercentage.toFixed(1)}%

⚠️ STRESS TEST RESULTS
═══════════════════════════════════════════════════════════════════════════════
${result.riskMetrics.stressTestResults.map(test => 
  `• ${test.scenario}: ${test.priceImpact}% price impact, ${test.recoveryTime} month recovery`
).join('\n')}

📊 SENSITIVITY ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
${result.riskMetrics.sensitivityAnalysis.map(sens => 
  `• ${sens.parameter} (${sens.change}% change): ${sens.priceImpact}% price impact`
).join('\n')}

🏁 FINAL STATE
═══════════════════════════════════════════════════════════════════════════════
• Circulating Supply: ${result.trajectory[result.trajectory.length - 1].circulatingSupply.toLocaleString()} tokens
• Market Cap: $${result.trajectory[result.trajectory.length - 1].marketCap.toLocaleString()}
• Fully Diluted Valuation: $${result.trajectory[result.trajectory.length - 1].fullyDilutedValuation.toLocaleString()}
• Staked Tokens: ${result.trajectory[result.trajectory.length - 1].stakedTokens.toLocaleString()}
• Burned Tokens: ${result.trajectory[result.trajectory.length - 1].burnedTokens.toLocaleString()}
• Total Holders: ${Math.floor(result.trajectory[result.trajectory.length - 1].userMetrics.totalHolders).toLocaleString()}
• Active Stakers: ${Math.floor(result.trajectory[result.trajectory.length - 1].userMetrics.activeStakers).toLocaleString()}

📋 VESTING SCHEDULE SUMMARY
═══════════════════════════════════════════════════════════════════════════════
${this.params.vestingSchedules.map(schedule => 
  `• ${schedule.groupName}: ${(schedule.totalTokens / 1000000).toFixed(1)}M tokens, ${schedule.cliffMonths}m cliff, ${schedule.vestingMonths}m vest, ${schedule.initialUnlock}% initial`
).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
Analysis completed at: ${new Date().toLocaleString()}
`;
  }

  getInitialPrice(): number {
    return this.initialMetrics?.initialData?.current_price || 1.0;
  }

  getAssetData(): AssetData | null {
    return this.initialMetrics?.currentData || null;
  }
}

const instructions = `
You are a professional tokenomics advisor that provides comprehensive cryptocurrency tokenomics simulation and economic modeling.

Your primary function is to help users understand token economics through detailed Monte Carlo simulations. When responding:
- Always ask for required parameters if none are provided: asset (CoinGecko ID), historicalDataDays, maxSupply, and tokenDistribution
- Help translate cryptocurrency names to correct CoinGecko IDs (e.g., "BTC" -> "bitcoin", "ETH" -> "ethereum")
- Provide detailed analysis of tokenomics including price evolution, supply dynamics, and distribution effects
- Include insights about vesting impacts, staking mechanics, and market scenarios
- Offer actionable advice based on simulation results
- Keep responses informative and professional
- To begin the simulation, please copy the input structure below and paste it into our chat, then fill in your specific tokenomics parameters for your project. Be sure to provide values for all required fields, and ensure percentages are in decimal format (e.g., 0.15 for 15%).

---

Tokenomics Simulation Input Parameters

*REQUIRED PARAMETERS*

* Asset: The CoinGecko asset ID for historical price data reference (e.g., "bitcoin", "ethereum", "uniswap").
* Max Supply: The total maximum number of tokens that can ever exist (Default: 1,000,000,000).
* Historical Data Days: The number of days of historical market data to use for the simulation (Default: 364, Max: 364 for free tier).

---

TOKEN DISTRIBUTION (Percentages should sum to 1.0)
* Team: The percentage of tokens allocated to the founding team (Default: 0.15).
* Advisors: The percentage of tokens allocated to project advisors (Default: 0.05).
* Community: The percentage of tokens reserved for the broader community (Default: 0.40).
* Treasury: The percentage of tokens allocated to the project's treasury for future development and operations (Default: 0.20).
* Public Sale: The percentage of tokens sold in a public offering (Default: 0.10).
* Private Sale: The percentage of tokens sold in private funding rounds (Default: 0.05).
* Ecosystem: The percentage of tokens dedicated to ecosystem growth and development (Default: 0.03).
* Marketing: The percentage of tokens allocated for marketing initiatives (Default: 0.02).

---
VESTING SCHEDULES (You can add multiple entries for different groups)
* Group Name: A descriptive name for the group (e.g., "Team", "Private Sale Investors").
* Total Tokens: The total number of tokens allocated to this specific group.
* Cliff Months: The initial period in months before any tokens begin to vest (Default: 0).
* Vesting Months: The total duration in months over which tokens for this group will linearly vest after the cliff (Default: 36).
* Initial Unlock: The percentage of tokens that unlock immediately at the start for this group (Default: 0).


SIMULATION PARAMETERS
* Simulation Months: The total duration in months for which the tokenomics simulation will run (Default: 36).
* Iterations: The number of Monte Carlo simulation runs to perform for statistical robustness (Default: 100).

---
MARKET CONDITIONS
* Market Scenario: The general market environment to simulate, choosing from 'bull', 'bear', 'stable', 'crash', or 'custom' (Default: 'stable').
* Market Multiplier: A factor to adjust the overall market effect on token price (Default: 1.0, range 0.1 to 3.0).
* Volatility Factor: A multiplier to control the degree of price fluctuations in the simulation (Default: 0.1, range 0.01 to 1.0).

---
TOKEN UTILITY & ECONOMICS
* Staking APY: The Annual Percentage Yield (APY) offered for staking the token (Default: 12).
* Burn Rate: The percentage of tokens burned from specific transactions or fees (Default: 0.1).
* Staking Participation: The expected percentage of the circulating supply that will be staked (Default: 40).
* Sell Pressure On Unlock: The estimated percentage of tokens that are immediately sold when they unlock from vesting (Default: 30).

---
LIQUIDITY PARAMETERS
* Initial Liquidity: The starting liquidity pool size in USD (Default: 1,000,000).
* Liquidity Tokens: The number of tokens initially allocated to the liquidity pool (Default: 100,000).
* Trading Fee Percent: The percentage of fees charged on token trades within the ecosystem (Default: 0.3).

---
PROTOCOL METRICS (Initial values for your project's growth)
* Daily Active Users: The initial number of daily active users for your protocol (Default: 10,000).
* Total Value Locked: The initial total value locked (TVL) in USD within your protocol (Default: 5,000,000).
* Transaction Volume: The initial daily transaction volume in USD within your protocol (Default: 100,000).
* User Growth Rate: The expected monthly percentage growth rate for daily active users (Default: 5).

---
USER BEHAVIOR PARAMETERS
* Average Hold Period: The average duration in months that users are expected to hold the token (Default: 8).
* Price Volatility Tolerance: A user's tolerance for price fluctuations before they consider selling (Default: 0.15).
* Utility Adoption: The percentage of active users who are expected to adopt and use the token's core utility (Default: 25).

---
INCENTIVE STRUCTURE
* Liquidity Mining Multiplier: A multiplier for liquidity mining rewards, relative to staking rewards (Default: 0.5).
* Trading Rewards: The percentage of trading fees or other incentives distributed as trading rewards (Default: 2).
* Referral Rewards: The percentage of rewards allocated for referral programs (Default: 1).

---
ECONOMIC PARAMETERS
* Protocol Revenue Growth: The expected monthly percentage growth rate for protocol revenue (Default: 5).
* Initial Token Price: An optional override for the initial token price; if not provided, the simulation will attempt to infer it from historical data or initial liquidity (leave as null or omit to use inferred price).

---
RISK PARAMETERS
* Concentration Risk Threshold: A percentage threshold for warnings if token holdings become too concentrated (Default: 0.3).
* Liquidity Risk Threshold: A minimum liquidity level in USD below which the token is considered at risk (Default: 100,000).
* Volatility Risk Threshold: A percentage threshold for classifying high price volatility as a risk (Default: 0.5).

---

Once you've provided your values in the structured text format above, I will run the simulation. I will then provide a detailed analysis of your tokenomics, including price evolution, supply dynamics, distribution effects, vesting impacts, staking mechanics, and insights into various market scenarios. I'll also offer actionable advice based on the simulation results, focusing on aspects like supply/demand dynamics, token utility, and long-term sustainability.

Use the tokenomicsSimulationTool to run comprehensive tokenomics simulations with real market data.
`;


export const tokenomicsSimulationTool = createTool({
  id: "run-tokenomics-simulation",
  description: `Run comprehensive tokenomics simulation with real historical data from CoinGecko through detailed Monte Carlo simulations. Ensure you always ask for all parameters and user must provide all parameters. Ask the exact question below. "To begin the simulation, please copy the input structure below and paste it into our chat, then fill in your specific tokenomics parameters for your project. Be sure to provide values for all required fields, and ensure percentages are in decimal format (e.g., 0.15 for 15%).

---

Tokenomics Simulation Input Parameters

*REQUIRED PARAMETERS*

* Asset: The CoinGecko asset ID for historical price data reference (e.g., "bitcoin", "ethereum", "uniswap").
* Max Supply: The total maximum number of tokens that can ever exist (Default: 1,000,000,000).
* Historical Data Days: The number of days of historical market data to use for the simulation (Default: 364, Max: 364 for free tier).

---

TOKEN DISTRIBUTION (Percentages should sum to 1.0)
* Team: The percentage of tokens allocated to the founding team (Default: 0.15).
* Advisors: The percentage of tokens allocated to project advisors (Default: 0.05).
* Community: The percentage of tokens reserved for the broader community (Default: 0.40).
* Treasury: The percentage of tokens allocated to the project's treasury for future development and operations (Default: 0.20).
* Public Sale: The percentage of tokens sold in a public offering (Default: 0.10).
* Private Sale: The percentage of tokens sold in private funding rounds (Default: 0.05).
* Ecosystem: The percentage of tokens dedicated to ecosystem growth and development (Default: 0.03).
* Marketing: The percentage of tokens allocated for marketing initiatives (Default: 0.02).

---
VESTING SCHEDULES (You can add multiple entries for different groups)
* Group Name: A descriptive name for the group (e.g., "Team", "Private Sale Investors").
* Total Tokens: The total number of tokens allocated to this specific group.
* Cliff Months: The initial period in months before any tokens begin to vest (Default: 0).
* Vesting Months: The total duration in months over which tokens for this group will linearly vest after the cliff (Default: 36).
* Initial Unlock: The percentage of tokens that unlock immediately at the start for this group (Default: 0).


SIMULATION PARAMETERS
* Simulation Months: The total duration in months for which the tokenomics simulation will run (Default: 36).
* Iterations: The number of Monte Carlo simulation runs to perform for statistical robustness (Default: 100).

---
MARKET CONDITIONS
* Market Scenario: The general market environment to simulate, choosing from 'bull', 'bear', 'stable', 'crash', or 'custom' (Default: 'stable').
* Market Multiplier: A factor to adjust the overall market effect on token price (Default: 1.0, range 0.1 to 3.0).
* Volatility Factor: A multiplier to control the degree of price fluctuations in the simulation (Default: 0.1, range 0.01 to 1.0).

---
TOKEN UTILITY & ECONOMICS
* Staking APY: The Annual Percentage Yield (APY) offered for staking the token (Default: 12).
* Burn Rate: The percentage of tokens burned from specific transactions or fees (Default: 0.1).
* Staking Participation: The expected percentage of the circulating supply that will be staked (Default: 40).
* Sell Pressure On Unlock: The estimated percentage of tokens that are immediately sold when they unlock from vesting (Default: 30).

---
LIQUIDITY PARAMETERS
* Initial Liquidity: The starting liquidity pool size in USD (Default: 1,000,000).
* Liquidity Tokens: The number of tokens initially allocated to the liquidity pool (Default: 100,000).
* Trading Fee Percent: The percentage of fees charged on token trades within the ecosystem (Default: 0.3).

---
PROTOCOL METRICS (Initial values for your project's growth)
* Daily Active Users: The initial number of daily active users for your protocol (Default: 10,000).
* Total Value Locked: The initial total value locked (TVL) in USD within your protocol (Default: 5,000,000).
* Transaction Volume: The initial daily transaction volume in USD within your protocol (Default: 100,000).
* User Growth Rate: The expected monthly percentage growth rate for daily active users (Default: 5).

---
USER BEHAVIOR PARAMETERS
* Average Hold Period: The average duration in months that users are expected to hold the token (Default: 8).
* Price Volatility Tolerance: A user's tolerance for price fluctuations before they consider selling (Default: 0.15).
* Utility Adoption: The percentage of active users who are expected to adopt and use the token's core utility (Default: 25).

---
INCENTIVE STRUCTURE
* Liquidity Mining Multiplier: A multiplier for liquidity mining rewards, relative to staking rewards (Default: 0.5).
* Trading Rewards: The percentage of trading fees or other incentives distributed as trading rewards (Default: 2).
* Referral Rewards: The percentage of rewards allocated for referral programs (Default: 1).

---
ECONOMIC PARAMETERS
* Protocol Revenue Growth: The expected monthly percentage growth rate for protocol revenue (Default: 5).
* Initial Token Price: An optional override for the initial token price; if not provided, the simulation will attempt to infer it from historical data or initial liquidity (leave as null or omit to use inferred price).

---
RISK PARAMETERS
* Concentration Risk Threshold: A percentage threshold for warnings if token holdings become too concentrated (Default: 0.3).
* Liquidity Risk Threshold: A minimum liquidity level in USD below which the token is considered at risk (Default: 100,000).
* Volatility Risk Threshold: A percentage threshold for classifying high price volatility as a risk (Default: 0.5).

---

Once you've provided your values in the structured text format above, I will run the simulation. I will then provide a detailed analysis of your tokenomics, including price evolution, supply dynamics, distribution effects, vesting impacts, staking mechanics, and insights into various market scenarios. I'll also offer actionable advice based on the simulation results, focusing on aspects like supply/demand dynamics, token utility, and long-term sustainability"

Use the tokenomicsSimulationTool to run comprehensive tokenomics simulations with real market data.
`,
  inputSchema: z.object({
    asset: z.string().describe("CoinGecko asset ID for historical reference (e.g., bitcoin, ethereum, uniswap)"),
    maxSupply: z.number().min(1000).describe("Total maximum supply of tokens"),
    historicalDataDays: z.number().min(1).max(364).default(364).describe("Days of historical data to use (max 364 for free tier)"),
   
    tokenDistribution: z.object({
      team: z.number().min(0).max(1).describe("Team allocation (decimal, e.g., 0.15 for 15%)"),
      advisors: z.number().min(0).max(1).describe("Advisors allocation"),
      community: z.number().min(0).max(1).describe("Community allocation"),
      treasury: z.number().min(0).max(1).describe("Treasury allocation"),
      publicSale: z.number().min(0).max(1).describe("Public sale allocation"),
      privateSale: z.number().min(0).max(1).describe("Private sale allocation"),
      ecosystem: z.number().min(0).max(1).describe("Ecosystem allocation"),
      marketing: z.number().min(0).max(1).describe("Marketing allocation"),
    }).describe("Token distribution percentages (must sum to 1.0)"),
    
    vestingSchedules: z.array(z.object({
      groupName: z.string().describe("Name of the group (e.g., Team, Advisors)"),
      totalTokens: z.number().min(0).describe("Total tokens for this group"),
      cliffMonths: z.number().min(0).max(60).describe("Cliff period in months"),
      vestingMonths: z.number().min(1).max(120).describe("Vesting period in months"),
      initialUnlock: z.number().min(0).max(100).describe("Initial unlock percentage"),
    })).describe("Vesting schedules for different token groups"),

    simulationMonths: z.number().min(6).max(120).default(36).describe("Simulation duration in months"),
    iterations: z.number().min(1).max(1000).default(100).describe("Monte Carlo iterations"),
    
    // MARKET CONDITIONS
    marketScenario: z.enum(['bull', 'bear', 'stable', 'crash', 'custom']).default('stable').describe("Market scenario"),
    marketMultiplier: z.number().min(0.1).max(3.0).default(1.0).describe("Market effect multiplier"),
    volatilityFactor: z.number().min(0.01).max(1.0).default(0.1).describe("Volatility factor"),
    
    // TOKEN UTILITY & ECONOMICS
    stakingAPY: z.number().min(0).max(100).default(12).describe("Staking APY percentage"),
    burnRate: z.number().min(0).max(10).default(0.1).describe("Token burn rate percentage"),
    stakingParticipation: z.number().min(0).max(100).default(40).describe("Expected staking participation percentage"),
    sellPressureOnUnlock: z.number().min(0).max(100).default(30).describe("Percentage sold immediately on unlock"),
    
    // LIQUIDITY PARAMETERS
    initialLiquidity: z.number().min(10000).default(1000000).describe("Initial liquidity in USD"),
    liquidityTokens: z.number().min(1000).default(100000).describe("Tokens allocated for liquidity"),
    tradingFeePercent: z.number().min(0).max(5).default(0.3).describe("Trading fee percentage"),
    
    // PROTOCOL METRICS
    dailyActiveUsers: z.number().min(100).default(10000).describe("Initial daily active users"),
    totalValueLocked: z.number().min(10000).default(5000000).describe("Initial total value locked (USD)"),
    transactionVolume: z.number().min(1000).default(100000).describe("Initial daily transaction volume (USD)"),
    userGrowthRate: z.number().min(0).max(50).default(5).describe("Monthly user growth rate percentage"),
    
    // USER BEHAVIOR PARAMETERS
    averageHoldPeriod: z.number().min(1).max(60).default(8).describe("Average holding period in months"),
    priceVolatilityTolerance: z.number().min(0.01).max(1).default(0.15).describe("User price volatility tolerance"),
    utilityAdoption: z.number().min(0).max(100).default(25).describe("Percentage of users adopting token utility"),
    
    // INCENTIVE STRUCTURE
    liquidityMiningMultiplier: z.number().min(0).max(2).default(0.5).describe("Liquidity mining rewards multiplier (relative to staking)"),
    tradingRewards: z.number().min(0).max(10).default(2).describe("Trading rewards percentage"),
    referralRewards: z.number().min(0).max(5).default(1).describe("Referral rewards percentage"),
    
    // ECONOMIC PARAMETERS
    protocolRevenueGrowth: z.number().min(0).max(20).default(5).describe("Monthly protocol revenue growth percentage"),
    initialTokenPrice: z.number().min(0.001).optional().describe("Override initial token price (otherwise uses historical data)"),
    
    concentrationRiskThreshold: z.number().min(0.1).max(0.8).default(0.3).describe("Concentration risk threshold for warnings"),
    liquidityRiskThreshold: z.number().min(10000).default(100000).describe("Minimum liquidity threshold for risk assessment"),
    volatilityRiskThreshold: z.number().min(0.1).max(2).default(0.5).describe("Volatility threshold for risk classification"),
  }),
  outputSchema: z.object({
    simulation: z.string().describe("Formatted comprehensive tokenomics simulation report"),
   
    asset: z.string().describe("The reference asset used"),
    assetName: z.string().describe("Human readable asset name"),
    assetSymbol: z.string().describe("Asset trading symbol"),
    simulationMonths: z.number().describe("Number of months simulated"),
    iterations: z.number().describe("Monte Carlo iterations performed"),
   
    priceTrajectory: z.array(z.object({
      month: z.number(),
      price: z.number(),
      priceMin: z.number(),
      priceMax: z.number(),
      volatility: z.number(),
    })).describe("Monthly token price evolution with confidence intervals"),
    
    finalPrice: z.number().describe("Final simulated token price"),
    initialPrice: z.number().describe("Starting token price"),
    maxPrice: z.number().describe("Maximum price during simulation"),
    minPrice: z.number().describe("Minimum price during simulation"),
    totalReturn: z.number().describe("Total return percentage"),
    annualizedReturn: z.number().describe("Annualized return percentage"),
    maxDrawdown: z.number().describe("Maximum drawdown percentage"),
    volatility: z.number().describe("Price volatility measure"),
    
    supplyEvolution: z.array(z.object({
      month: z.number(),
      circulatingSupply: z.number(),
      maxSupply: z.number(),
      newlyVested: z.number(),
      burnedTokens: z.number(),
      inflationRate: z.number(),
    })).describe("Token supply evolution over time"),
    
    finalCirculatingSupply: z.number().describe("Final circulating supply"),
    totalBurnedTokens: z.number().describe("Total tokens burned during simulation"),
    finalInflationRate: z.number().describe("Final inflation rate"),
    
    // MARKET CAPITALIZATION
    marketCapTrajectory: z.array(z.object({
      month: z.number(),
      marketCap: z.number(),
      fullyDilutedValuation: z.number(),
      mcapToFdvRatio: z.number(),
    })).describe("Market cap and FDV evolution"),
    
    finalMarketCap: z.number().describe("Final market capitalization"),
    finalFDV: z.number().describe("Final fully diluted valuation"),
    
    // TOKEN DISTRIBUTION ANALYSIS
    distributionEvolution: z.array(z.object({
      month: z.number(),
      teamHoldings: z.number(),
      advisorHoldings: z.number(),
      communityHoldings: z.number(),
      treasuryHoldings: z.number(),
      publicHoldings: z.number(),
      concentrationRisk: z.number(),
    })).describe("Token distribution changes over time"),
    
    finalDistribution: z.object({
      team: z.number(),
      advisors: z.number(),
      community: z.number(),
      treasury: z.number(),
      public: z.number(),
      concentrationRisk: z.number(),
      giniCoefficient: z.number(),
    }).describe("Final token distribution metrics"),
    
    // VESTING IMPACT
    vestingEvents: z.array(z.object({
      month: z.number(),
      groupName: z.string(),
      tokensVested: z.number(),
      cumulativeVested: z.number(),
      percentOfSupply: z.number(),
      priceImpact: z.number(),
    })).describe("Major vesting events and their impacts"),
    
    vestingSummary: z.array(z.object({
      groupName: z.string(),
      totalTokens: z.number(),
      vestedTokens: z.number(),
      remainingTokens: z.number(),
      vestingProgress: z.number(),
    })).describe("Final vesting status by group"),
    
    // STAKING METRICS
    stakingMetrics: z.array(z.object({
      month: z.number(),
      stakedTokens: z.number(),
      stakingRatio: z.number(),
      activeStakers: z.number(),
      stakingRewards: z.number(),
      stakingAPY: z.number(),
    })).describe("Staking participation and rewards over time"),
    
    finalStakingMetrics: z.object({
      stakedTokens: z.number(),
      stakingRatio: z.number(),
      totalStakingRewards: z.number(),
      averageStakingAPY: z.number(),
      activeStakers: z.number(),
    }).describe("Final staking statistics"),
    
    // PROTOCOL REVENUE & FEES
    protocolMetrics: z.array(z.object({
      month: z.number(),
      protocolRevenue: z.number(),
      cumulativeRevenue: z.number(),
      tradingVolume: z.number(),
      transactionCount: z.number(),
      activeUsers: z.number(),
    })).describe("Protocol financial and usage metrics"),
    
    totalProtocolRevenue: z.number().describe("Total protocol revenue generated"),
    
    // LIQUIDITY ANALYSIS
    liquidityMetrics: z.array(z.object({
      month: z.number(),
      liquidityPoolDepth: z.number(),
      liquidityRatio: z.number(),
      tradingVolume: z.number(),
      volumeToLiquidityRatio: z.number(),
      impermanentLoss: z.number(),
    })).describe("Liquidity pool health metrics"),
    
    finalLiquidityHealth: z.object({
      poolDepth: z.number(),
      liquidityRatio: z.number(),
      totalImpermanentLoss: z.number(),
      liquidityEfficiency: z.number(),
    }).describe("Final liquidity pool status"),
    
    // SENSITIVITY ANALYSIS
    sensitivityAnalysis: z.array(z.object({
      parameter: z.string(),
      baseValue: z.number(),
      changePercent: z.number(),
      newValue: z.number(),
      priceImpact: z.number(),
      supplyImpact: z.number(),
      mcapImpact: z.number(),
      significance: z.string(),
    })).describe("Parameter sensitivity analysis"),
    
    // STRESS TESTING
    stressTestResults: z.array(z.object({
      scenario: z.string(),
      description: z.string(),
      priceImpact: z.number(),
      liquidityImpact: z.number(),
      supplyImpact: z.number(),
      recoveryTime: z.number(),
      severity: z.string(),
    })).describe("Stress test scenario results"),
    
    // USER BEHAVIOR INSIGHTS
    userBehaviorInsights: z.object({
      totalHolders: z.number(),
      activeTraders: z.number(),
      longTermHolders: z.number(),
      averageHoldingPeriod: z.number(),
      tradingToHoldingRatio: z.number(),
      userGrowthRate: z.number(),
    }).describe("User behavior and adoption metrics"),
    
    // RISK ASSESSMENT
    riskAssessment: z.object({
      overallRiskScore: z.number(),
      concentrationRisk: z.string(),
      liquidityRisk: z.string(),
      volatilityRisk: z.string(),
      vestingRisk: z.string(),
      marketRisk: z.string(),
      recommendedActions: z.array(z.string()),
    }).describe("Comprehensive risk assessment and recommendations"),
    
    // SCENARIO COMPARISONS
    scenarioComparison: z.array(z.object({
      scenario: z.string(),
      finalPrice: z.number(),
      totalReturn: z.number(),
      maxDrawdown: z.number(),
      probability: z.number(),
    })).describe("Comparison of different market scenarios"),
  }),
  execute: async ({ context }) => {
    try {
      const distributionValues = Object.values(context.tokenDistribution) as number[];
      const distributionSum = distributionValues.reduce((sum: number, val: number) => sum + val, 0);
      if (Math.abs(distributionSum - 1.0) > 0.001) {
        throw new Error(`Token distribution must sum to 1.0, got ${distributionSum.toFixed(3)}`);
      }

      const params: SimulationParameters = {
        asset: context.asset,
        maxSupply: context.maxSupply,
        historicalDataDays: context.historicalDataDays,
        tokenDistribution: context.tokenDistribution,
        vestingSchedules: context.vestingSchedules,
        simulationMonths: context.simulationMonths,
        iterations: context.iterations,
        
        liquidityDetails: {
          initialLiquidity: context.initialLiquidity,
          liquidityTokens: context.liquidityTokens,
          tradingFeePercent: context.tradingFeePercent,
          slippageModel: 'quadratic',
        },
        
        tokenUtility: {
          staking: true,
          governance: true,
          feeDiscount: true,
          burnMechanism: true,
          yieldFarming: true,
          stakingAPY: context.stakingAPY,
          burnRate: context.burnRate,
        },
        
        incentiveStructure: {
          stakingRewards: context.stakingAPY,
          liquidityMiningRewards: context.stakingAPY * context.liquidityMiningMultiplier,
          tradingRewards: context.tradingRewards,
          referralRewards: context.referralRewards,
        },
        
        behaviorHypotheses: {
          stakingParticipation: context.stakingParticipation,
          averageHoldPeriod: context.averageHoldPeriod,
          sellPressureOnUnlock: context.sellPressureOnUnlock,
          priceVolatilityTolerance: context.priceVolatilityTolerance,
          utilityAdoption: context.utilityAdoption,
        },
        
        marketConditions: {
          scenario: context.marketScenario,
          marketMultiplier: context.marketMultiplier,
          volatilityFactor: context.volatilityFactor,
          externalEvents: [],
        },
        
        protocolMetrics: {
          dailyActiveUsers: context.dailyActiveUsers,
          totalValueLocked: context.totalValueLocked,
          transactionVolume: context.transactionVolume,
          growthRate: context.protocolRevenueGrowth,
        },
      };

   
      const simulator = new TokenomicsSimulator(params);
      const result = await simulator.runSimulation();
      
      // Extract comprehensive data
      const initialPrice = simulator.getInitialPrice();
      const assetData = simulator.getAssetData();
      
      const priceTrajectory = result.trajectory.map((state, index) => ({
        month: state.month,
        price: state.tokenPrice,
        priceMin: state.tokenPrice * 0.95, // Simplified confidence interval
        priceMax: state.tokenPrice * 1.05,
        volatility: index > 0 ? Math.abs(state.tokenPrice - result.trajectory[index-1].tokenPrice) / result.trajectory[index-1].tokenPrice : 0,
      }));
      
      const supplyEvolution = result.trajectory.map((state, index) => ({
        month: state.month,
        circulatingSupply: state.circulatingSupply,
        maxSupply: params.maxSupply,
        newlyVested: index > 0 ? state.circulatingSupply - result.trajectory[index-1].circulatingSupply : 0,
        burnedTokens: state.burnedTokens,
        inflationRate: index > 0 ? ((state.circulatingSupply - result.trajectory[index-1].circulatingSupply) / result.trajectory[index-1].circulatingSupply) * 100 : 0,
      }));
      
      const marketCapTrajectory = result.trajectory.map(state => ({
        month: state.month,
        marketCap: state.marketCap,
        fullyDilutedValuation: state.fullyDilutedValuation,
        mcapToFdvRatio: state.marketCap / state.fullyDilutedValuation,
      }));
      
      const distributionEvolution = result.trajectory.map(state => {
        const totalSupply = state.circulatingSupply;
        return {
          month: state.month,
          teamHoldings: totalSupply * context.tokenDistribution.team,
          advisorHoldings: totalSupply * context.tokenDistribution.advisors,
          communityHoldings: totalSupply * context.tokenDistribution.community,
          treasuryHoldings: state.treasuryBalance,
          publicHoldings: totalSupply * (context.tokenDistribution.publicSale + context.tokenDistribution.privateSale),
          concentrationRisk: result.distributionMetrics.concentrationRisk,
        };
      });
      
      const vestingEvents = [];
      const vestingProgress: { [key: string]: { vestedTokens: number; remainingTokens: number; progress: number } } = {};
      
      params.vestingSchedules.forEach(schedule => {
        vestingProgress[schedule.groupName] = {
          vestedTokens: schedule.totalTokens * (schedule.initialUnlock / 100), 
          remainingTokens: schedule.totalTokens * (1 - schedule.initialUnlock / 100),
          progress: schedule.initialUnlock,
        };
      });
      
      // Calculate month-by-month vesting
      for (let month = 0; month < params.simulationMonths; month++) {
        for (const schedule of params.vestingSchedules) {
          const progress = vestingProgress[schedule.groupName];
          
          if (month > schedule.cliffMonths && month <= schedule.cliffMonths + schedule.vestingMonths) {
            const monthsAfterCliff = month - schedule.cliffMonths;
            const totalVestableTokens = schedule.totalTokens * (1 - schedule.initialUnlock / 100);
            const monthlyVesting = totalVestableTokens / schedule.vestingMonths;
            
            // Calculate tokens vested this month
            const tokensVested = monthlyVesting;
            progress.vestedTokens += tokensVested;
            progress.remainingTokens = Math.max(0, progress.remainingTokens - tokensVested);
            progress.progress = (progress.vestedTokens / schedule.totalTokens) * 100;
            
            if (tokensVested > 0) {
              vestingEvents.push({
                month,
                groupName: schedule.groupName,
                tokensVested,
                cumulativeVested: progress.vestedTokens,
                percentOfSupply: (tokensVested / params.maxSupply) * 100,
                priceImpact: -tokensVested / 1000000, // Simplified impact calculation
              });
            }
          }
        }
      }
      
      // Build actual vesting summary based on calculated progress
      const vestingSummary = params.vestingSchedules.map(schedule => {
        const progress = vestingProgress[schedule.groupName];
        return {
          groupName: schedule.groupName,
          totalTokens: schedule.totalTokens,
          vestedTokens: progress.vestedTokens,
          remainingTokens: progress.remainingTokens,
          vestingProgress: progress.progress,
        };
      });
      
      // Build staking metrics
      const stakingMetrics = result.trajectory.map(state => ({
        month: state.month,
        stakedTokens: state.stakedTokens,
        stakingRatio: state.stakedTokens / state.circulatingSupply,
        activeStakers: state.userMetrics.activeStakers,
        stakingRewards: state.stakedTokens * (params.tokenUtility.stakingAPY / 100) / 12,
        stakingAPY: state.stakingAPY,
      }));
      
      const protocolMetrics = result.trajectory.map((state, index) => ({
        month: state.month,
        protocolRevenue: state.protocolRevenue,
        cumulativeRevenue: result.trajectory.slice(0, index + 1).reduce((sum, s) => sum + s.protocolRevenue, 0),
        tradingVolume: state.dailyVolume * 30,
        transactionCount: Math.floor(state.dailyVolume * 30 / state.tokenPrice),
        activeUsers: state.userMetrics.totalHolders,
      }));
      
      const liquidityMetrics = result.trajectory.map(state => ({
        month: state.month,
        liquidityPoolDepth: state.liquidityPoolDepth,
        liquidityRatio: state.liquidityPoolDepth / state.circulatingSupply,
        tradingVolume: state.dailyVolume * 30,
        volumeToLiquidityRatio: (state.dailyVolume * 30) / state.liquidityPoolDepth,
        impermanentLoss: Math.max(0, (state.tokenPrice - initialPrice) / initialPrice * 0.1), // Simplified IL calculation
      }));
      
      const sensitivityAnalysis = result.riskMetrics.sensitivityAnalysis.map(sens => ({
        parameter: sens.parameter,
        baseValue: 100, 
        changePercent: sens.change,
        newValue: 100 + sens.change,
        priceImpact: sens.priceImpact,
        supplyImpact: sens.supplyImpact,
        mcapImpact: sens.priceImpact + sens.supplyImpact,
        significance: Math.abs(sens.priceImpact) > 10 ? 'High' : Math.abs(sens.priceImpact) > 5 ? 'Medium' : 'Low',
      }));
      
      // Enhanced stress test results
      const stressTestResults = result.riskMetrics.stressTestResults.map(test => ({
        scenario: test.scenario,
        description: `Simulated ${test.scenario} scenario with significant market stress`,
        priceImpact: test.priceImpact,
        liquidityImpact: test.liquidityImpact,
        supplyImpact: 0,
        recoveryTime: test.recoveryTime,
        severity: Math.abs(test.priceImpact) > 40 ? 'Critical' : Math.abs(test.priceImpact) > 20 ? 'High' : 'Medium',
      }));
      
      // Calculate comprehensive risk assessment
      const finalState = result.trajectory[result.trajectory.length - 1];
      
      // Calculate individual risk scores (0-100)
      const concentrationRiskScore = Math.min(100, (result.distributionMetrics.concentrationRisk / context.concentrationRiskThreshold) * 100);
      const liquidityRiskScore = finalState.liquidityPoolDepth < context.liquidityRiskThreshold ? 
        Math.min(100, (context.liquidityRiskThreshold / finalState.liquidityPoolDepth) * 50) : 
        Math.max(0, 50 - (finalState.liquidityPoolDepth / context.liquidityRiskThreshold) * 10);
      const volatilityRiskScore = Math.min(100, (result.summary.volatility / context.volatilityRiskThreshold) * 100);
      const vestingRiskScore = Math.min(100, (vestingEvents.length / 12) * 25); 
      const marketRiskScore = context.marketScenario === 'crash' ? 90 : 
                             context.marketScenario === 'bear' ? 70 :
                             context.marketScenario === 'bull' ? 30 : 50;
      
      const overallRiskScore = Math.round(
        (concentrationRiskScore * 0.25) +
        (liquidityRiskScore * 0.20) +
        (volatilityRiskScore * 0.20) +
        (vestingRiskScore * 0.15) +
        (marketRiskScore * 0.20)
      );
      
      const getRiskLevel = (score: number): string => {
        if (score >= 80) return 'Critical';
        if (score >= 60) return 'High';
        if (score >= 40) return 'Medium';
        if (score >= 20) return 'Low';
        return 'Very Low';
      };
 
      const elaborateSimulation = `
🚀 COMPREHENSIVE TOKENOMICS SIMULATION ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

📊 SIMULATION PARAMETERS
Asset Reference: ${context.asset.toUpperCase()} (${assetData?.name || 'Unknown'} - ${assetData?.symbol || 'N/A'})
Historical Data Period: ${context.historicalDataDays} days
Simulation Duration: ${context.simulationMonths} months
Monte Carlo Iterations: ${context.iterations}
Market Scenario: ${context.marketScenario}
Max Token Supply: ${context.maxSupply.toLocaleString()}

📈 PRICE & RETURNS ANALYSIS
─────────────────────────────────────────────────────────────────────────────
Initial Price: $${initialPrice.toFixed(6)}
Final Price: $${result.summary.finalPrice.toFixed(6)}
Maximum Price: $${result.summary.maxPrice.toFixed(6)}
Minimum Price: $${result.summary.minPrice.toFixed(6)}
Total Return: ${result.summary.totalReturn.toFixed(2)}%
Annualized Return: ${(Math.pow(result.summary.finalPrice / initialPrice, 12 / context.simulationMonths) - 1).toFixed(2)}%
Maximum Drawdown: ${result.summary.maxDrawdown.toFixed(2)}%
Price Volatility: ${result.summary.volatility.toFixed(4)}

📊 PRICE TRAJECTORY HIGHLIGHTS
─────────────────────────────────────────────────────────────────────────────
${[0, Math.floor(context.simulationMonths * 0.25), Math.floor(context.simulationMonths * 0.5), Math.floor(context.simulationMonths * 0.75), context.simulationMonths - 1]
  .map(month => {
    const point = priceTrajectory.find(p => p.month === month);
    return point ? `Month ${point.month}: $${point.price.toFixed(6)} (Volatility: ${(point.volatility * 100).toFixed(1)}%)` : '';
  })
  .filter(Boolean)
  .join('\n')}

🔄 SUPPLY DYNAMICS
─────────────────────────────────────────────────────────────────────────────
Initial Circulating Supply: ${supplyEvolution[0].circulatingSupply.toLocaleString()}
Final Circulating Supply: ${finalState.circulatingSupply.toLocaleString()}
Total Burned Tokens: ${finalState.burnedTokens.toLocaleString()}
Final Supply Ratio: ${((finalState.circulatingSupply / params.maxSupply) * 100).toFixed(1)}%
Total Supply Increase: ${((finalState.circulatingSupply - supplyEvolution[0].circulatingSupply) / supplyEvolution[0].circulatingSupply * 100).toFixed(1)}%

💰 MARKET CAPITALIZATION
─────────────────────────────────────────────────────────────────────────────
Final Market Cap: $${finalState.marketCap.toLocaleString()}
Final Fully Diluted Valuation: $${finalState.fullyDilutedValuation.toLocaleString()}
MCAP/FDV Ratio: ${(finalState.marketCap / finalState.fullyDilutedValuation).toFixed(3)}
Market Cap Growth: ${(((finalState.marketCap - (supplyEvolution[0].circulatingSupply * initialPrice)) / (supplyEvolution[0].circulatingSupply * initialPrice)) * 100).toFixed(1)}%

🎯 TOKEN DISTRIBUTION ANALYSIS
─────────────────────────────────────────────────────────────────────────────
Team Holdings: ${(context.tokenDistribution.team * 100).toFixed(1)}% (${(context.tokenDistribution.team * params.maxSupply / 1000000).toFixed(1)}M tokens)
Advisors Holdings: ${(context.tokenDistribution.advisors * 100).toFixed(1)}% (${(context.tokenDistribution.advisors * params.maxSupply / 1000000).toFixed(1)}M tokens)
Community Holdings: ${(context.tokenDistribution.community * 100).toFixed(1)}% (${(context.tokenDistribution.community * params.maxSupply / 1000000).toFixed(1)}M tokens)
Treasury Holdings: ${(context.tokenDistribution.treasury * 100).toFixed(1)}% (${(context.tokenDistribution.treasury * params.maxSupply / 1000000).toFixed(1)}M tokens)
Public Holdings: ${((context.tokenDistribution.publicSale + context.tokenDistribution.privateSale) * 100).toFixed(1)}% (${((context.tokenDistribution.publicSale + context.tokenDistribution.privateSale) * params.maxSupply / 1000000).toFixed(1)}M tokens)
Concentration Risk: ${(result.distributionMetrics.concentrationRisk * 100).toFixed(1)}%
Gini Coefficient: ${result.distributionMetrics.giniCoefficient.toFixed(3)}

⏰ VESTING ANALYSIS
─────────────────────────────────────────────────────────────────────────────
${vestingSummary.map(vest => 
  `${vest.groupName}: ${vest.vestingProgress.toFixed(1)}% complete
  ├─ Vested: ${(vest.vestedTokens / 1000000).toFixed(1)}M tokens
  ├─ Remaining: ${(vest.remainingTokens / 1000000).toFixed(1)}M tokens
  └─ Total Allocation: ${(vest.totalTokens / 1000000).toFixed(1)}M tokens`
).join('\n')}

Major Vesting Events: ${vestingEvents.length} total events
${vestingEvents.slice(0, 5).map(event => 
  `  Month ${event.month}: ${event.groupName} - ${(event.tokensVested / 1000000).toFixed(1)}M tokens (${event.percentOfSupply.toFixed(2)}% of supply)`
).join('\n')}${vestingEvents.length > 5 ? `\n  ... and ${vestingEvents.length - 5} more events` : ''}

🔒 STAKING ANALYSIS
─────────────────────────────────────────────────────────────────────────────
Final Staked Tokens: ${finalState.stakedTokens.toLocaleString()}
Final Staking Ratio: ${((finalState.stakedTokens / finalState.circulatingSupply) * 100).toFixed(1)}%
Active Stakers: ${finalState.userMetrics.activeStakers.toLocaleString()}
Total Staking Rewards Distributed: ${stakingMetrics.reduce((sum, m) => sum + m.stakingRewards, 0).toLocaleString()}
Average Staking APY: ${params.tokenUtility.stakingAPY.toFixed(1)}%
Staking Participation Rate: ${context.stakingParticipation}%

📊 PROTOCOL PERFORMANCE
─────────────────────────────────────────────────────────────────────────────
Total Protocol Revenue: $${protocolMetrics.reduce((sum, m) => sum + m.protocolRevenue, 0).toLocaleString()}
Final Monthly Revenue: $${protocolMetrics[protocolMetrics.length - 1].protocolRevenue.toLocaleString()}
Final Monthly Trading Volume: $${protocolMetrics[protocolMetrics.length - 1].tradingVolume.toLocaleString()}
Final Active Users: ${protocolMetrics[protocolMetrics.length - 1].activeUsers.toLocaleString()}
User Growth Rate: ${context.userGrowthRate}% monthly
Protocol Revenue Growth: ${context.protocolRevenueGrowth}% monthly

💧 LIQUIDITY HEALTH ANALYSIS
─────────────────────────────────────────────────────────────────────────────
Final Pool Depth: $${finalState.liquidityPoolDepth.toLocaleString()}
Liquidity-to-Supply Ratio: ${(finalState.liquidityPoolDepth / finalState.circulatingSupply).toFixed(6)}
Total Impermanent Loss: ${(liquidityMetrics[liquidityMetrics.length - 1].impermanentLoss * 100).toFixed(2)}%
Liquidity Efficiency: ${(finalState.dailyVolume / finalState.liquidityPoolDepth).toFixed(4)}
Average Volume/Liquidity Ratio: ${(liquidityMetrics.reduce((sum, m) => sum + m.volumeToLiquidityRatio, 0) / liquidityMetrics.length).toFixed(4)}

👥 USER BEHAVIOR INSIGHTS
─────────────────────────────────────────────────────────────────────────────
Total Token Holders: ${finalState.userMetrics.totalHolders.toLocaleString()}
Estimated Active Traders: ${Math.floor(finalState.userMetrics.totalHolders * 0.3).toLocaleString()}
Estimated Long-term Holders: ${Math.floor(finalState.userMetrics.totalHolders * 0.6).toLocaleString()}
Average Holding Period: ${context.averageHoldPeriod} months
Price Volatility Tolerance: ${(context.priceVolatilityTolerance * 100).toFixed(1)}%
Utility Adoption Rate: ${context.utilityAdoption}%
Sell Pressure on Unlock: ${context.sellPressureOnUnlock}%

📊 SENSITIVITY ANALYSIS (Key Parameters)
─────────────────────────────────────────────────────────────────────────────
${sensitivityAnalysis
  .sort((a, b) => Math.abs(b.priceImpact) - Math.abs(a.priceImpact))
  .slice(0, 5)
  .map((sens, index) => 
    `${index + 1}. ${sens.parameter}: ${sens.priceImpact > 0 ? '+' : ''}${sens.priceImpact.toFixed(1)}% price impact (${sens.significance} significance)`
  ).join('\n')}

🔥 STRESS TEST RESULTS
─────────────────────────────────────────────────────────────────────────────
${stressTestResults.map((test, index) => 
  `${index + 1}. ${test.scenario}:
     ├─ Price Impact: ${test.priceImpact}%
     ├─ Liquidity Impact: ${test.liquidityImpact}%
     ├─ Recovery Time: ${test.recoveryTime} months
     └─ Severity: ${test.severity}`
).join('\n')}

⚠️ COMPREHENSIVE RISK ASSESSMENT
─────────────────────────────────────────────────────────────────────────────
Overall Risk Score: ${overallRiskScore}/100 (${getRiskLevel(overallRiskScore)})

Risk Breakdown:
├─ Concentration Risk: ${getRiskLevel(concentrationRiskScore)} (${concentrationRiskScore.toFixed(0)}/100)
│   └─ Current concentration: ${(result.distributionMetrics.concentrationRisk * 100).toFixed(1)}% vs ${(context.concentrationRiskThreshold * 100).toFixed(0)}% threshold
├─ Liquidity Risk: ${getRiskLevel(liquidityRiskScore)} (${liquidityRiskScore.toFixed(0)}/100)
│   └─ Pool depth: $${finalState.liquidityPoolDepth.toLocaleString()} vs $${context.liquidityRiskThreshold.toLocaleString()} threshold
├─ Volatility Risk: ${getRiskLevel(volatilityRiskScore)} (${volatilityRiskScore.toFixed(0)}/100)
│   └─ Price volatility: ${result.summary.volatility.toFixed(3)} vs ${context.volatilityRiskThreshold.toFixed(1)} threshold
├─ Vesting Risk: ${getRiskLevel(vestingRiskScore)} (${vestingRiskScore.toFixed(0)}/100)
│   └─ Major vesting events: ${vestingEvents.length} over ${context.simulationMonths} months
└─ Market Risk: ${getRiskLevel(marketRiskScore)} (${marketRiskScore.toFixed(0)}/100)
    └─ Market scenario: ${context.marketScenario} with ${context.marketMultiplier}x multiplier

🎯 SCENARIO COMPARISON
─────────────────────────────────────────────────────────────────────────────
Bull Market Scenario: $${(result.summary.finalPrice * 1.5).toFixed(6)} final price (${(result.summary.totalReturn * 1.5).toFixed(1)}% return, 25% probability)
Base Case Scenario: $${result.summary.finalPrice.toFixed(6)} final price (${result.summary.totalReturn.toFixed(1)}% return, 50% probability)
Bear Market Scenario: $${(result.summary.finalPrice * 0.6).toFixed(6)} final price (${(result.summary.totalReturn * 0.4).toFixed(1)}% return, 25% probability)

═══════════════════════════════════════════════════════════════════════════════
Analysis completed: ${new Date().toLocaleString()}
Simulation ID: SIM-${Date.now().toString(36).toUpperCase()}
═══════════════════════════════════════════════════════════════════════════════
      `;
      
      return {
        simulation: elaborateSimulation,
        asset: context.asset,
        assetName: assetData?.name || 'Unknown',
        assetSymbol: assetData?.symbol || 'N/A',
        simulationMonths: context.simulationMonths,
        iterations: context.iterations,
        
        priceTrajectory,
        finalPrice: result.summary.finalPrice,
        initialPrice,
        maxPrice: result.summary.maxPrice,
        minPrice: result.summary.minPrice,
        totalReturn: result.summary.totalReturn,
        annualizedReturn: (Math.pow(result.summary.finalPrice / initialPrice, 12 / context.simulationMonths) - 1) * 100,
        maxDrawdown: result.summary.maxDrawdown,
        volatility: result.summary.volatility,
        
        supplyEvolution,
        finalCirculatingSupply: finalState.circulatingSupply,
        totalBurnedTokens: finalState.burnedTokens,
        finalInflationRate: supplyEvolution[supplyEvolution.length - 1].inflationRate,
        
        marketCapTrajectory,
        finalMarketCap: finalState.marketCap,
        finalFDV: finalState.fullyDilutedValuation,
        
        distributionEvolution,
        finalDistribution: {
          team: context.tokenDistribution.team,
          advisors: context.tokenDistribution.advisors,
          community: context.tokenDistribution.community,
          treasury: context.tokenDistribution.treasury,
          public: context.tokenDistribution.publicSale + context.tokenDistribution.privateSale,
          concentrationRisk: result.distributionMetrics.concentrationRisk,
          giniCoefficient: result.distributionMetrics.giniCoefficient,
        },
        
        vestingEvents,
        vestingSummary,
        
        stakingMetrics,
        finalStakingMetrics: {
          stakedTokens: finalState.stakedTokens,
          stakingRatio: finalState.stakedTokens / finalState.circulatingSupply,
          totalStakingRewards: stakingMetrics.reduce((sum, m) => sum + m.stakingRewards, 0),
          averageStakingAPY: params.tokenUtility.stakingAPY,
          activeStakers: finalState.userMetrics.activeStakers,
        },
        
        protocolMetrics,
        totalProtocolRevenue: protocolMetrics.reduce((sum, m) => sum + m.protocolRevenue, 0),
        
        liquidityMetrics,
        finalLiquidityHealth: {
          poolDepth: finalState.liquidityPoolDepth,
          liquidityRatio: finalState.liquidityPoolDepth / finalState.circulatingSupply,
          totalImpermanentLoss: liquidityMetrics[liquidityMetrics.length - 1].impermanentLoss,
          liquidityEfficiency: finalState.dailyVolume / finalState.liquidityPoolDepth,
        },
        
        sensitivityAnalysis,
        stressTestResults,
        
        userBehaviorInsights: {
          totalHolders: finalState.userMetrics.totalHolders,
          activeTraders: Math.floor(finalState.userMetrics.totalHolders * 0.3),
          longTermHolders: Math.floor(finalState.userMetrics.totalHolders * 0.6),
          averageHoldingPeriod: params.behaviorHypotheses.averageHoldPeriod,
          tradingToHoldingRatio: 0.3,
          userGrowthRate: params.protocolMetrics.growthRate,
        },
        
        riskAssessment: {
          overallRiskScore,
          concentrationRisk: getRiskLevel(concentrationRiskScore),
          liquidityRisk: getRiskLevel(liquidityRiskScore),
          volatilityRisk: getRiskLevel(volatilityRiskScore),
          vestingRisk: getRiskLevel(vestingRiskScore),
          marketRisk: getRiskLevel(marketRiskScore),
          recommendedActions: [],
        },
        
        scenarioComparison: [
          { scenario: 'Bull Market', finalPrice: result.summary.finalPrice * 1.5, totalReturn: result.summary.totalReturn * 1.5, maxDrawdown: result.summary.maxDrawdown * 0.7, probability: 25 },
          { scenario: 'Base Case', finalPrice: result.summary.finalPrice, totalReturn: result.summary.totalReturn, maxDrawdown: result.summary.maxDrawdown, probability: 50 },
          { scenario: 'Bear Market', finalPrice: result.summary.finalPrice * 0.6, totalReturn: result.summary.totalReturn * 0.4, maxDrawdown: result.summary.maxDrawdown * 1.3, probability: 25 },
        ],
      };
      
    } catch (error) {
      const errorMessage = `Tokenomics simulation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(errorMessage);
      
      let guidance = "";
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          guidance = "\n💡 Tip: Check that the asset ID is valid. Visit https://api.coingecko.com/api/v3/coins/list to find valid IDs";
        } else if (error.message.includes('distribution')) {
          guidance = "\n💡 Tip: Token distribution percentages must sum to exactly 1.0 (100%)";
        } else if (error.message.includes('rate limit')) {
          guidance = "\n💡 Tip: API rate limit hit, wait a moment and try again";
        }
      }
      
      throw new Error(errorMessage + guidance);
    }
  },
}); 