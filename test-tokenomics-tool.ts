import { tokenomicsSimulationTool } from './src/mastra/tools/tokenomics-simulation-tool';

async function testTokenomicsSimulation() {
  console.log('🚀 Testing Enhanced Tokenomics Simulation Tool');
  console.log('═'.repeat(80));
  
  try {
    // Test parameters for a comprehensive DeFi project simulation
    const testParams = {
      // Core parameters
      asset: 'ethereum', // Using ETH as reference asset
      maxSupply: 1000000000, // 1B total supply
      historicalDataDays: 180, // 6 months of historical data
      simulationMonths: 24, // 2-year simulation
      iterations: 50, // Moderate iterations for testing
      
      // Token distribution (must sum to 1.0)
      tokenDistribution: {
        team: 0.20,      // 20% team
        advisors: 0.05,  // 5% advisors
        community: 0.30, // 30% community rewards
        treasury: 0.15,  // 15% treasury
        publicSale: 0.15, // 15% public sale
        privateSale: 0.10, // 10% private sale
        ecosystem: 0.05,  // 5% ecosystem development
        marketing: 0.00,  // 0% marketing (to keep sum = 1.0)
      },
      
      // Vesting schedules
      vestingSchedules: [
        {
          groupName: 'Team',
          totalTokens: 200000000, // 200M tokens
          cliffMonths: 12,
          vestingMonths: 24,
          initialUnlock: 0,
        },
        {
          groupName: 'Advisors',
          totalTokens: 50000000, // 50M tokens
          cliffMonths: 6,
          vestingMonths: 18,
          initialUnlock: 10,
        },
        {
          groupName: 'Community',
          totalTokens: 300000000, // 300M tokens
          cliffMonths: 0,
          vestingMonths: 36,
          initialUnlock: 5,
        },
      ],
      
      // Market and tokenomics parameters
      marketScenario: 'stable' as const,
      marketMultiplier: 1.2,
      volatilityFactor: 0.15,
      stakingAPY: 18, // 18% staking APY
      burnRate: 0.5, // 0.5% burn rate
      stakingParticipation: 45, // 45% staking participation
      sellPressureOnUnlock: 25, // 25% sell pressure
      initialLiquidity: 5000000, // $5M initial liquidity
      liquidityTokens: 50000000, // 50M tokens for liquidity
      
      // Additional configurable parameters (previously hardcoded)
      tradingFeePercent: 0.25, // 0.25% trading fees
      dailyActiveUsers: 15000, // 15k initial daily users
      totalValueLocked: 8000000, // $8M initial TVL
      transactionVolume: 150000, // $150k daily transaction volume
      userGrowthRate: 6, // 6% monthly user growth
      averageHoldPeriod: 10, // 10 months average holding
      priceVolatilityTolerance: 0.12, // 12% volatility tolerance
      utilityAdoption: 35, // 35% utility adoption rate
      liquidityMiningMultiplier: 0.6, // 60% of staking APY for liquidity mining
      tradingRewards: 1.5, // 1.5% trading rewards
      referralRewards: 0.8, // 0.8% referral rewards
      protocolRevenueGrowth: 7, // 7% monthly protocol revenue growth
      
      // Risk assessment thresholds
      concentrationRiskThreshold: 0.25, // 25% concentration risk threshold
      liquidityRiskThreshold: 2000000, // $2M minimum liquidity threshold
      volatilityRiskThreshold: 0.4, // 40% volatility risk threshold
    };
    
    console.log('📊 Running simulation with parameters:');
    console.log(`  Asset: ${testParams.asset}`);
    console.log(`  Max Supply: ${testParams.maxSupply.toLocaleString()}`);
    console.log(`  Simulation Period: ${testParams.simulationMonths} months`);
    console.log(`  Monte Carlo Iterations: ${testParams.iterations}`);
    console.log(`  Market Scenario: ${testParams.marketScenario}`);
    console.log('');
    
    // Execute the simulation
    const startTime = Date.now();
    const result = await tokenomicsSimulationTool.execute({ context: testParams } as any);
    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Simulation completed in ${executionTime}ms`);
    console.log('');
    
    // Display comprehensive results
    console.log('📈 PRICE & RETURNS ANALYSIS');
    console.log('─'.repeat(50));
    console.log(`Initial Price: $${result.initialPrice.toFixed(6)}`);
    console.log(`Final Price: $${result.finalPrice.toFixed(6)}`);
    console.log(`Max Price: $${result.maxPrice.toFixed(6)}`);
    console.log(`Min Price: $${result.minPrice.toFixed(6)}`);
    console.log(`Total Return: ${result.totalReturn.toFixed(2)}%`);
    console.log(`Annualized Return: ${result.annualizedReturn.toFixed(2)}%`);
    console.log(`Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
    console.log(`Volatility: ${result.volatility.toFixed(4)}`);
    console.log('');
    
    // Price trajectory highlights
    console.log('📊 PRICE TRAJECTORY HIGHLIGHTS');
    console.log('─'.repeat(50));
    const priceHighlights = [0, 6, 12, 18, 23].map(month => 
      result.priceTrajectory.find(p => p.month === month)
    ).filter(Boolean);
    
    priceHighlights.forEach(point => {
      if (point) {
        console.log(`Month ${point.month}: $${point.price.toFixed(6)} (Vol: ${(point.volatility * 100).toFixed(1)}%)`);
      }
    });
    console.log('');
    
    // Supply dynamics
    console.log('🔄 SUPPLY DYNAMICS');
    console.log('─'.repeat(50));
    console.log(`Initial Circulating: ${result.supplyEvolution[0].circulatingSupply.toLocaleString()}`);
    console.log(`Final Circulating: ${result.finalCirculatingSupply.toLocaleString()}`);
    console.log(`Total Burned: ${result.totalBurnedTokens.toLocaleString()}`);
    console.log(`Final Inflation Rate: ${result.finalInflationRate.toFixed(2)}%`);
    console.log('');
    
    // Market cap analysis
    console.log('💰 MARKET CAPITALIZATION');
    console.log('─'.repeat(50));
    console.log(`Final Market Cap: $${result.finalMarketCap.toLocaleString()}`);
    console.log(`Final FDV: $${result.finalFDV.toLocaleString()}`);
    console.log(`MCAP/FDV Ratio: ${(result.finalMarketCap / result.finalFDV).toFixed(2)}`);
    console.log('');
    
    // Token distribution
    console.log('🎯 TOKEN DISTRIBUTION');
    console.log('─'.repeat(50));
    console.log(`Team: ${(result.finalDistribution.team * 100).toFixed(1)}%`);
    console.log(`Advisors: ${(result.finalDistribution.advisors * 100).toFixed(1)}%`);
    console.log(`Community: ${(result.finalDistribution.community * 100).toFixed(1)}%`);
    console.log(`Treasury: ${(result.finalDistribution.treasury * 100).toFixed(1)}%`);
    console.log(`Public: ${(result.finalDistribution.public * 100).toFixed(1)}%`);
    console.log(`Concentration Risk: ${(result.finalDistribution.concentrationRisk * 100).toFixed(1)}%`);
    console.log(`Gini Coefficient: ${result.finalDistribution.giniCoefficient.toFixed(2)}`);
    console.log('');
    
    // Vesting analysis
    console.log('⏰ VESTING SUMMARY');
    console.log('─'.repeat(50));
    result.vestingSummary.forEach(vest => {
      console.log(`${vest.groupName}: ${vest.vestingProgress.toFixed(1)}% complete (${(vest.vestedTokens / 1000000).toFixed(1)}M vested)`);
    });
    console.log('');
    
    // Staking metrics
    console.log('🔒 STAKING ANALYSIS');
    console.log('─'.repeat(50));
    console.log(`Final Staked: ${result.finalStakingMetrics.stakedTokens.toLocaleString()} tokens`);
    console.log(`Staking Ratio: ${(result.finalStakingMetrics.stakingRatio * 100).toFixed(1)}%`);
    console.log(`Active Stakers: ${result.finalStakingMetrics.activeStakers.toLocaleString()}`);
    console.log(`Total Staking Rewards: ${result.finalStakingMetrics.totalStakingRewards.toLocaleString()}`);
    console.log(`Average Staking APY: ${result.finalStakingMetrics.averageStakingAPY.toFixed(1)}%`);
    console.log('');
    
    // Protocol metrics
    console.log('📊 PROTOCOL PERFORMANCE');
    console.log('─'.repeat(50));
    console.log(`Total Protocol Revenue: $${result.totalProtocolRevenue.toLocaleString()}`);
    const finalProtocol = result.protocolMetrics[result.protocolMetrics.length - 1];
    console.log(`Final Monthly Revenue: $${finalProtocol.protocolRevenue.toLocaleString()}`);
    console.log(`Final Trading Volume: $${finalProtocol.tradingVolume.toLocaleString()}`);
    console.log(`Active Users: ${finalProtocol.activeUsers.toLocaleString()}`);
    console.log('');
    
    // Liquidity analysis
    console.log('💧 LIQUIDITY HEALTH');
    console.log('─'.repeat(50));
    console.log(`Pool Depth: $${result.finalLiquidityHealth.poolDepth.toLocaleString()}`);
    console.log(`Liquidity Ratio: ${result.finalLiquidityHealth.liquidityRatio.toFixed(4)}`);
    console.log(`Total IL: ${(result.finalLiquidityHealth.totalImpermanentLoss * 100).toFixed(2)}%`);
    console.log(`Liquidity Efficiency: ${result.finalLiquidityHealth.liquidityEfficiency.toFixed(2)}`);
    console.log('');
    
    // Risk assessment
    console.log('⚠️ RISK ASSESSMENT');
    console.log('─'.repeat(50));
    console.log(`Overall Risk Score: ${result.riskAssessment.overallRiskScore}/100`);
    console.log(`Concentration Risk: ${result.riskAssessment.concentrationRisk}`);
    console.log(`Liquidity Risk: ${result.riskAssessment.liquidityRisk}`);
    console.log(`Volatility Risk: ${result.riskAssessment.volatilityRisk}`);
    console.log(`Vesting Risk: ${result.riskAssessment.vestingRisk}`);
    console.log(`Market Risk: ${result.riskAssessment.marketRisk}`);
    console.log('');
    
    // Recommended actions
    console.log('💡 RECOMMENDED ACTIONS');
    console.log('─'.repeat(50));
    result.riskAssessment.recommendedActions.forEach((action, index) => {
      console.log(`${index + 1}. ${action}`);
    });
    console.log('');
    
    // Sensitivity analysis highlights
    console.log('📊 SENSITIVITY ANALYSIS (Top 3)');
    console.log('─'.repeat(50));
    const topSensitivities = result.sensitivityAnalysis
      .sort((a, b) => Math.abs(b.priceImpact) - Math.abs(a.priceImpact))
      .slice(0, 3);
    
    topSensitivities.forEach((sens, index) => {
      console.log(`${index + 1}. ${sens.parameter}: ${sens.priceImpact.toFixed(1)}% price impact (${sens.significance})`);
    });
    console.log('');
    
    // Stress test results
    console.log('🔥 STRESS TEST RESULTS');
    console.log('─'.repeat(50));
    result.stressTestResults.forEach((test, index) => {
      console.log(`${index + 1}. ${test.scenario}: ${test.priceImpact}% impact, ${test.recoveryTime}m recovery (${test.severity})`);
    });
    console.log('');
    
    // Scenario comparison
    console.log('🎯 SCENARIO COMPARISON');
    console.log('─'.repeat(50));
    result.scenarioComparison.forEach(scenario => {
      console.log(`${scenario.scenario}: $${scenario.finalPrice.toFixed(6)} (${scenario.totalReturn.toFixed(1)}% return, ${scenario.probability}% probability)`);
    });
    console.log('');
    
    // User behavior insights
    console.log('👥 USER BEHAVIOR INSIGHTS');
    console.log('─'.repeat(50));
    console.log(`Total Holders: ${result.userBehaviorInsights.totalHolders.toLocaleString()}`);
    console.log(`Active Traders: ${result.userBehaviorInsights.activeTraders.toLocaleString()}`);
    console.log(`Long-term Holders: ${result.userBehaviorInsights.longTermHolders.toLocaleString()}`);
    console.log(`Avg Holding Period: ${result.userBehaviorInsights.averageHoldingPeriod} months`);
    console.log(`Trading/Holding Ratio: ${result.userBehaviorInsights.tradingToHoldingRatio.toFixed(2)}`);
    console.log(`User Growth Rate: ${result.userBehaviorInsights.userGrowthRate}%/month`);
    console.log('');
    
    console.log('✅ Comprehensive tokenomics simulation completed successfully!');
    console.log('═'.repeat(80));
    
    // Also display the formatted report
    console.log('\n📋 FORMATTED SIMULATION REPORT');
    console.log('═'.repeat(80));
    console.log(result.simulation);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTokenomicsSimulation(); 