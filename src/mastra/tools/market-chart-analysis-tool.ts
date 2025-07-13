import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface MarketChartResponse {
	prices: [number, number][];
	market_caps: [number, number][];
	total_volumes: [number, number][];
}

interface AnalysisData {
	prices: { timestamp: number; value: number }[];
	marketCaps: { timestamp: number; value: number }[];
	volumes: { timestamp: number; value: number }[];
}

interface CalculatedMetrics {
	priceMetrics: {
		current: number;
		highest: number;
		lowest: number;
		average: number;
		volatility: number;
		totalReturn: number;
		totalReturnPercentage: number;
		dailyReturns: number[];
		averageDailyReturn: number;
		maxDrawdown: number;
	};
	volumeMetrics: {
		current: number;
		highest: number;
		lowest: number;
		average: number;
		totalVolume: number;
	};
	marketCapMetrics: {
		current: number;
		highest: number;
		lowest: number;
		average: number;
		change: number;
		changePercentage: number;
	};
	trend: {
		direction: "bullish" | "bearish" | "sideways";
		strength: "strong" | "moderate" | "weak";
		momentum: number;
	};
}

// Helper functions for calculations
function calculateVolatility(prices: number[]): number {
	if (prices.length < 2) return 0;

	const returns = [];
	for (let i = 1; i < prices.length; i++) {
		returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
	}

	const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
	const variance =
		returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;

	return Math.sqrt(variance) * Math.sqrt(365); // Annualized volatility
}

function calculateMaxDrawdown(prices: number[]): number {
	let maxDrawdown = 0;
	let peak = prices[0];

	for (const price of prices) {
		if (price > peak) {
			peak = price;
		}

		const drawdown = (peak - price) / peak;
		if (drawdown > maxDrawdown) {
			maxDrawdown = drawdown;
		}
	}

	return maxDrawdown;
}

function calculateTrend(prices: number[]): {
	direction: "bullish" | "bearish" | "sideways";
	strength: "strong" | "moderate" | "weak";
	momentum: number;
} {
	if (prices.length < 2)
		return { direction: "sideways", strength: "weak", momentum: 0 };

	const firstPrice = prices[0];
	const lastPrice = prices[prices.length - 1];
	const momentum = (lastPrice - firstPrice) / firstPrice;

	let direction: "bullish" | "bearish" | "sideways";
	let strength: "strong" | "moderate" | "weak";

	if (Math.abs(momentum) < 0.02) {
		direction = "sideways";
	} else if (momentum > 0) {
		direction = "bullish";
	} else {
		direction = "bearish";
	}

	const absChange = Math.abs(momentum);
	if (absChange > 0.1) {
		strength = "strong";
	} else if (absChange > 0.05) {
		strength = "moderate";
	} else {
		strength = "weak";
	}

	return { direction, strength, momentum };
}

function performAnalysis(data: AnalysisData): CalculatedMetrics {
	const prices = data.prices.map((p) => p.value);
	const volumes = data.volumes.map((v) => v.value);
	const marketCaps = data.marketCaps.map((m) => m.value);

	const current = prices[prices.length - 1];
	const highest = Math.max(...prices);
	const lowest = Math.min(...prices);
	const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
	const volatility = calculateVolatility(prices);
	const totalReturn = current - prices[0];
	const totalReturnPercentage = (totalReturn / prices[0]) * 100;
	const maxDrawdown = calculateMaxDrawdown(prices);

	// Calculate daily returns
	const dailyReturns = [];
	for (let i = 1; i < prices.length; i++) {
		dailyReturns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
	}
	const averageDailyReturn =
		dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

	const currentVolume = volumes[volumes.length - 1];
	const highestVolume = Math.max(...volumes);
	const lowestVolume = Math.min(...volumes);
	const averageVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
	const totalVolume = volumes.reduce((sum, v) => sum + v, 0);

	const currentMarketCap = marketCaps[marketCaps.length - 1];
	const highestMarketCap = Math.max(...marketCaps);
	const lowestMarketCap = Math.min(...marketCaps);
	const averageMarketCap =
		marketCaps.reduce((sum, m) => sum + m, 0) / marketCaps.length;
	const marketCapChange = currentMarketCap - marketCaps[0];
	const marketCapChangePercentage = (marketCapChange / marketCaps[0]) * 100;

	// Trend analysis
	const trend = calculateTrend(prices);

	return {
		priceMetrics: {
			current,
			highest,
			lowest,
			average,
			volatility,
			totalReturn,
			totalReturnPercentage,
			dailyReturns,
			averageDailyReturn,
			maxDrawdown,
		},
		volumeMetrics: {
			current: currentVolume,
			highest: highestVolume,
			lowest: lowestVolume,
			average: averageVolume,
			totalVolume,
		},
		marketCapMetrics: {
			current: currentMarketCap,
			highest: highestMarketCap,
			lowest: lowestMarketCap,
			average: averageMarketCap,
			change: marketCapChange,
			changePercentage: marketCapChangePercentage,
		},
		trend,
	};
}

export const marketChartAnalysisTool = createTool({
	id: "get-market-chart-analysis",
	description:
		"Get comprehensive market chart analysis for a specified cryptocurrency over a given period, empowering professional to deliver in-depth investment insights. It helps users understand cryptocurrency market dynamics and tokenomics by fetching and analyzing detailed market data.",
	inputSchema: z.object({
		coinId: z
			.string()
			.describe("Cryptocurrency ID (e.g., bitcoin, ethereum, cardano)"),
		days: z
			.number()
			.min(1)
			.max(365)
			.describe("Number of days to analyze (1-365)"),
	}),
	outputSchema: z.object({
		analysis: z.string().describe("Formatted comprehensive market analysis"),
		coinId: z.string().describe("The cryptocurrency analyzed"),
		days: z.number().describe("Number of days analyzed"),
		dataPoints: z.number().describe("Number of data points analyzed"),
	}),
	execute: async ({ context }) => {
		const { coinId, days } = context;

		try {
			const response = await fetch(
				`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data: MarketChartResponse = await response.json();

			if (!data.prices || data.prices.length === 0) {
				throw new Error(`No price data found for ${coinId} over ${days} days`);
			}

			// Transform data for analysis
			const analysisData: AnalysisData = {
				prices: data.prices.map(([timestamp, value]) => ({ timestamp, value })),
				marketCaps: data.market_caps.map(([timestamp, value]) => ({
					timestamp,
					value,
				})),
				volumes: data.total_volumes.map(([timestamp, value]) => ({
					timestamp,
					value,
				})),
			};

			// Perform comprehensive analysis
			const metrics = performAnalysis(analysisData);

			// Format analysis for terminal display
			const trendEmoji =
				metrics.trend.direction === "bullish"
					? "📈"
					: metrics.trend.direction === "bearish"
						? "📉"
						: "➡️";
			const strengthEmoji =
				metrics.trend.strength === "strong"
					? "💪"
					: metrics.trend.strength === "moderate"
						? "👍"
						: "🤏";

			const analysis = `
📊 COMPREHENSIVE MARKET CHART ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

🪙 CRYPTOCURRENCY: ${coinId.toUpperCase()}
📅 ANALYSIS PERIOD: ${days} days
📈 DATA POINTS: ${data.prices.length} price points

💰 PRICE ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
• Current Price: $${metrics.priceMetrics.current.toLocaleString()}
• Highest Price: $${metrics.priceMetrics.highest.toLocaleString()}
• Lowest Price: $${metrics.priceMetrics.lowest.toLocaleString()}
• Average Price: $${metrics.priceMetrics.average.toLocaleString()}

📊 PERFORMANCE METRICS
═══════════════════════════════════════════════════════════════════════════════
• Total Return: $${metrics.priceMetrics.totalReturn.toFixed(2)} (${metrics.priceMetrics.totalReturnPercentage.toFixed(2)}%)
• Average Daily Return: ${(metrics.priceMetrics.averageDailyReturn * 100).toFixed(3)}%
• Volatility (Annualized): ${(metrics.priceMetrics.volatility * 100).toFixed(2)}%
• Maximum Drawdown: ${(metrics.priceMetrics.maxDrawdown * 100).toFixed(2)}%

🔄 VOLUME ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
• Current Volume: $${metrics.volumeMetrics.current.toLocaleString()}
• Highest Volume: $${metrics.volumeMetrics.highest.toLocaleString()}
• Lowest Volume: $${metrics.volumeMetrics.lowest.toLocaleString()}
• Average Volume: $${metrics.volumeMetrics.average.toLocaleString()}
• Total Volume: $${metrics.volumeMetrics.totalVolume.toLocaleString()}

🏢 MARKET CAP ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
• Current Market Cap: $${metrics.marketCapMetrics.current.toLocaleString()}
• Highest Market Cap: $${metrics.marketCapMetrics.highest.toLocaleString()}
• Lowest Market Cap: $${metrics.marketCapMetrics.lowest.toLocaleString()}
• Average Market Cap: $${metrics.marketCapMetrics.average.toLocaleString()}
• Market Cap Change: $${metrics.marketCapMetrics.change.toLocaleString()} (${metrics.marketCapMetrics.changePercentage.toFixed(2)}%)

🎯 TREND ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
• Direction: ${trendEmoji} ${metrics.trend.direction.toUpperCase()}
• Strength: ${strengthEmoji} ${metrics.trend.strength.toUpperCase()}
• Momentum: ${(metrics.trend.momentum * 100).toFixed(2)}%

📋 SUMMARY & INSIGHTS
═══════════════════════════════════════════════════════════════════════════════
${
	metrics.trend.direction === "bullish"
		? `• ${coinId.toUpperCase()} shows bullish momentum with ${metrics.priceMetrics.totalReturnPercentage.toFixed(2)}% gains`
		: metrics.trend.direction === "bearish"
			? `• ${coinId.toUpperCase()} shows bearish momentum with ${metrics.priceMetrics.totalReturnPercentage.toFixed(2)}% decline`
			: `• ${coinId.toUpperCase()} shows sideways movement with minimal price change`
}
• Volatility is ${metrics.priceMetrics.volatility > 1 ? "HIGH" : metrics.priceMetrics.volatility > 0.5 ? "MODERATE" : "LOW"} at ${(metrics.priceMetrics.volatility * 100).toFixed(2)}%
• Maximum drawdown of ${(metrics.priceMetrics.maxDrawdown * 100).toFixed(2)}% indicates ${metrics.priceMetrics.maxDrawdown > 0.2 ? "HIGH" : metrics.priceMetrics.maxDrawdown > 0.1 ? "MODERATE" : "LOW"} risk
• Trading volume is ${metrics.volumeMetrics.current > metrics.volumeMetrics.average ? "ABOVE" : "BELOW"} average levels

⚠️ RISK ASSESSMENT from CoinGecko
═══════════════════════════════════════════════════════════════════════════════
Risk Level: ${
				metrics.priceMetrics.volatility > 1 &&
				metrics.priceMetrics.maxDrawdown > 0.2
					? "HIGH ⚠️"
					: metrics.priceMetrics.volatility > 0.5 ||
							metrics.priceMetrics.maxDrawdown > 0.1
						? "MODERATE ⚡"
						: "LOW ✅"
			}

═══════════════════════════════════════════════════════════════════════════════
Analysis completed at: ${new Date().toLocaleString()}
`;

			return {
				analysis,
				coinId,
				days,
				dataPoints: data.prices.length,
			};
		} catch (error) {
			const errorMessage = `Error fetching market chart data for ${coinId} (${days} days): ${error instanceof Error ? error.message : "Unknown error"}`;
			console.error(errorMessage);
			throw new Error(errorMessage);
		}
	},
});
