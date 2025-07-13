import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface MobulaMetadataResponse {
	data: {
		id: number;
		name: string;
		symbol: string;
		price?: number;
		market_cap?: number;
		total_supply?: number;
		circulating_supply?: number;
		max_supply?: number;
		description?: string;
		website?: string;
		twitter?: string;
		discord?: string;
		telegram?: string;
		distribution?: Array<{
			percentage: number;
			name: string;
		}>;
		release_schedule?: Array<{
			allocation_details: Record<string, number>;
			tokens_to_unlock: number;
			unlock_date: number;
		}>;
		tags?: string[];
		investors?: Array<{
			name: string;
			percentage?: number;
		}>;
		cexs?: Array<{
			name: string;
			id: string;
		}>;
		listed_at?: string;
	};
}

interface TokenAnalysisData {
	basicInfo: {
		name: string;
		symbol: string;
		price?: number;
		marketCap?: number;
		totalSupply?: number;
		circulatingSupply?: number;
		maxSupply?: number;
	};
	distribution: Array<{
		percentage: number;
		name: string;
	}>;
	releaseSchedule: Array<{
		allocation_details: Record<string, number>;
		tokens_to_unlock: number;
		unlock_date: number;
	}>;
	socialLinks: {
		website?: string;
		twitter?: string;
		discord?: string;
		telegram?: string;
	};
	tags: string[];
	exchanges: Array<{
		name: string;
		id: string;
	}>;
	listedAt?: string;
}

interface CalculatedMetrics {
	supplyMetrics: {
		circulationRate: number;
		maxSupplyReached: boolean;
		remainingSupply: number;
		remainingSupplyPercentage: number;
		inflationRate: number;
	};
	unlockAnalysis: {
		totalUnlockingTokens: number;
		totalUnlockingValue: number;
		nextUnlockDate: Date | null;
		nextUnlockAmount: number;
		nextUnlockValue: number;
		unlockPressure: "high" | "moderate" | "low" | "none";
		monthlyUnlockAverage: number;
		unlocksByCategory: Record<string, number>;
		upcomingUnlocks: Array<{
			date: Date;
			amount: number;
			value: number;
			categories: Record<string, number>;
		}>;
	};
	distributionAnalysis: {
		concentrationRisk: "high" | "moderate" | "low";
		communityOwnership: number;
		institutionalOwnership: number;
		teamOwnership: number;
		treasuryOwnership: number;
		diversificationScore: number;
	};
	marketMetrics: {
		fullyDilutedValuation: number;
		marketCapToFDV: number;
		priceSupport: "strong" | "moderate" | "weak";
		liquidityRisk: "high" | "moderate" | "low";
	};
}

// Helper functions for calculations
function calculateSupplyMetrics(
	data: TokenAnalysisData,
): CalculatedMetrics["supplyMetrics"] {
	const { totalSupply, circulatingSupply, maxSupply } = data.basicInfo;

	if (!totalSupply || !circulatingSupply) {
		return {
			circulationRate: 0,
			maxSupplyReached: false,
			remainingSupply: 0,
			remainingSupplyPercentage: 0,
			inflationRate: 0,
		};
	}

	const circulationRate = (circulatingSupply / totalSupply) * 100;
	const maxSupplyReached = maxSupply ? totalSupply >= maxSupply : false;
	const remainingSupply = maxSupply ? maxSupply - totalSupply : 0;
	const remainingSupplyPercentage = maxSupply
		? (remainingSupply / maxSupply) * 100
		: 0;
	const inflationRate = maxSupply
		? ((totalSupply - circulatingSupply) / circulatingSupply) * 100
		: 0;

	return {
		circulationRate,
		maxSupplyReached,
		remainingSupply,
		remainingSupplyPercentage,
		inflationRate,
	};
}

function calculateUnlockAnalysis(
	data: TokenAnalysisData,
): CalculatedMetrics["unlockAnalysis"] {
	const { releaseSchedule, basicInfo } = data;
	const currentTime = Date.now();
	const price = basicInfo.price || 0;

	if (!releaseSchedule || releaseSchedule.length === 0) {
		return {
			totalUnlockingTokens: 0,
			totalUnlockingValue: 0,
			nextUnlockDate: null,
			nextUnlockAmount: 0,
			nextUnlockValue: 0,
			unlockPressure: "none",
			monthlyUnlockAverage: 0,
			unlocksByCategory: {},
			upcomingUnlocks: [],
		};
	}

	// Filter future unlocks
	const futureUnlocks = releaseSchedule.filter(
		(unlock) => unlock.unlock_date > currentTime,
	);

	// Sort by date
	futureUnlocks.sort((a, b) => a.unlock_date - b.unlock_date);

	const totalUnlockingTokens = futureUnlocks.reduce(
		(sum, unlock) => sum + unlock.tokens_to_unlock,
		0,
	);
	const totalUnlockingValue = totalUnlockingTokens * price;

	const nextUnlock = futureUnlocks[0];
	const nextUnlockDate = nextUnlock ? new Date(nextUnlock.unlock_date) : null;
	const nextUnlockAmount = nextUnlock ? nextUnlock.tokens_to_unlock : 0;
	const nextUnlockValue = nextUnlockAmount * price;

	// Calculate monthly average (next 12 months)
	const oneYearFromNow = currentTime + 365 * 24 * 60 * 60 * 1000;
	const nextYearUnlocks = futureUnlocks.filter(
		(unlock) => unlock.unlock_date <= oneYearFromNow,
	);
	const monthlyUnlockAverage =
		nextYearUnlocks.reduce((sum, unlock) => sum + unlock.tokens_to_unlock, 0) /
		12;

	// Calculate unlocks by category
	const unlocksByCategory: Record<string, number> = {};
	futureUnlocks.forEach((unlock) => {
		Object.entries(unlock.allocation_details).forEach(([category, amount]) => {
			unlocksByCategory[category] = (unlocksByCategory[category] || 0) + amount;
		});
	});

	// Determine unlock pressure
	const circulatingSupply = basicInfo.circulatingSupply || 1;
	const unlockPressureRatio = (monthlyUnlockAverage * 12) / circulatingSupply;
	let unlockPressure: "high" | "moderate" | "low" | "none" = "none";

	if (unlockPressureRatio > 0.2) unlockPressure = "high";
	else if (unlockPressureRatio > 0.1) unlockPressure = "moderate";
	else if (unlockPressureRatio > 0.05) unlockPressure = "low";

	// Upcoming unlocks (next 6 months)
	const sixMonthsFromNow = currentTime + 180 * 24 * 60 * 60 * 1000;
	const upcomingUnlocks = futureUnlocks
		.filter((unlock) => unlock.unlock_date <= sixMonthsFromNow)
		.map((unlock) => ({
			date: new Date(unlock.unlock_date),
			amount: unlock.tokens_to_unlock,
			value: unlock.tokens_to_unlock * price,
			categories: unlock.allocation_details,
		}));

	return {
		totalUnlockingTokens,
		totalUnlockingValue,
		nextUnlockDate,
		nextUnlockAmount,
		nextUnlockValue,
		unlockPressure,
		monthlyUnlockAverage,
		unlocksByCategory,
		upcomingUnlocks,
	};
}

function calculateDistributionAnalysis(
	data: TokenAnalysisData,
): CalculatedMetrics["distributionAnalysis"] {
	const { distribution } = data;

	if (!distribution || distribution.length === 0) {
		return {
			concentrationRisk: "low",
			communityOwnership: 0,
			institutionalOwnership: 0,
			teamOwnership: 0,
			treasuryOwnership: 0,
			diversificationScore: 0,
		};
	}

	let communityOwnership = 0;
	let institutionalOwnership = 0;
	let teamOwnership = 0;
	let treasuryOwnership = 0;

	distribution.forEach((item) => {
		const name = item.name.toLowerCase();
		if (
			name.includes("user") ||
			name.includes("airdrop") ||
			name.includes("community")
		) {
			communityOwnership += item.percentage;
		} else if (
			name.includes("investor") ||
			name.includes("vc") ||
			name.includes("fund")
		) {
			institutionalOwnership += item.percentage;
		} else if (
			name.includes("team") ||
			name.includes("advisor") ||
			name.includes("founder")
		) {
			teamOwnership += item.percentage;
		} else if (
			name.includes("treasury") ||
			name.includes("dao") ||
			name.includes("foundation")
		) {
			treasuryOwnership += item.percentage;
		}
	});

	// Calculate concentration risk
	const maxSingleAllocation = Math.max(
		...distribution.map((item) => item.percentage),
	);
	let concentrationRisk: "high" | "moderate" | "low" = "low";

	if (maxSingleAllocation > 40) concentrationRisk = "high";
	else if (maxSingleAllocation > 25) concentrationRisk = "moderate";

	// Calculate diversification score (0-100)
	const numCategories = distribution.length;
	const variance =
		distribution.reduce((sum, item) => {
			const avgPercentage = 100 / numCategories;
			return sum + (item.percentage - avgPercentage) ** 2;
		}, 0) / numCategories;

	const diversificationScore = Math.max(0, 100 - Math.sqrt(variance));

	return {
		concentrationRisk,
		communityOwnership,
		institutionalOwnership,
		teamOwnership,
		treasuryOwnership,
		diversificationScore,
	};
}

function calculateMarketMetrics(
	data: TokenAnalysisData,
): CalculatedMetrics["marketMetrics"] {
	const { basicInfo } = data;
	const { price, marketCap, totalSupply, maxSupply } = basicInfo;

	if (!price || !marketCap || !totalSupply) {
		return {
			fullyDilutedValuation: 0,
			marketCapToFDV: 0,
			priceSupport: "weak",
			liquidityRisk: "high",
		};
	}

	const fullyDilutedValuation = price * (maxSupply || totalSupply);
	const marketCapToFDV = (marketCap / fullyDilutedValuation) * 100;

	// Determine price support based on market cap to FDV ratio
	let priceSupport: "strong" | "moderate" | "weak" = "weak";
	if (marketCapToFDV > 80) priceSupport = "strong";
	else if (marketCapToFDV > 60) priceSupport = "moderate";

	// Determine liquidity risk
	let liquidityRisk: "high" | "moderate" | "low" = "high";
	if (marketCap > 1000000000) liquidityRisk = "low";
	else if (marketCap > 100000000) liquidityRisk = "moderate";

	return {
		fullyDilutedValuation,
		marketCapToFDV,
		priceSupport,
		liquidityRisk,
	};
}

function performAnalysis(data: TokenAnalysisData): CalculatedMetrics {
	return {
		supplyMetrics: calculateSupplyMetrics(data),
		unlockAnalysis: calculateUnlockAnalysis(data),
		distributionAnalysis: calculateDistributionAnalysis(data),
		marketMetrics: calculateMarketMetrics(data),
	};
}

export const tokenMetadataAnalysisTool = createTool({
	id: "get-token-metadata-analysis",
	description:
		"GET comprehensive token metadata analysis, including unlock schedules, tokenomics insights, understand distribution patterns. I will always ask for a cryptocurrency or token if none is provided, and help translate non-standard token names to the correct name. Use the tokenMetadataAnalysisTool to fetch comprehensive tokenomics metadata and analysis.",
	inputSchema: z.object({
		asset: z
			.string()
			.describe(
				"Token name or symbol (e.g., bitcoin, ethereum, arbitrum, ARB)",
			),
	}),
	outputSchema: z.object({
		analysis: z
			.string()
			.describe("Formatted comprehensive token metadata analysis"),
		tokenName: z.string().describe("The token name analyzed"),
		tokenSymbol: z.string().describe("The token symbol analyzed"),
		hasUnlockSchedule: z
			.boolean()
			.describe("Whether the token has unlock schedule data"),
	}),
	execute: async ({ context }) => {
		const { asset } = context;

		try {
			const response = await fetch(
				`https://production-api.mobula.io/api/1/metadata?asset=${encodeURIComponent(asset)}`,
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const apiData: MobulaMetadataResponse = await response.json();

			if (!apiData.data) {
				throw new Error(`No metadata found for asset: ${asset}`);
			}

			const data = apiData.data;

			// Transform data for analysis
			const analysisData: TokenAnalysisData = {
				basicInfo: {
					name: data.name,
					symbol: data.symbol,
					price: data.price,
					marketCap: data.market_cap,
					totalSupply: data.total_supply,
					circulatingSupply: data.circulating_supply,
					maxSupply: data.max_supply,
				},
				distribution: data.distribution || [],
				releaseSchedule: data.release_schedule || [],
				socialLinks: {
					website: data.website,
					twitter: data.twitter,
					discord: data.discord,
					telegram: data.telegram,
				},
				tags: data.tags || [],
				exchanges:
					data.cexs?.map((cex) => ({ name: cex.name || cex.id, id: cex.id })) ||
					[],
				listedAt: data.listed_at,
			};

			// Perform comprehensive analysis
			const metrics = performAnalysis(analysisData);

			// Format analysis for terminal display
			const hasUnlockSchedule = analysisData.releaseSchedule.length > 0;
			const hasDistribution = analysisData.distribution.length > 0;

			const analysis = `
🪙 TOKEN METADATA & TOKENOMICS ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

📊 BASIC INFORMATION
═══════════════════════════════════════════════════════════════════════════════
• Token Name: ${data.name}
• Symbol: ${data.symbol}
• Current Price: ${data.price ? `$${data.price.toLocaleString()}` : "N/A"}
• Market Cap: ${data.market_cap ? `$${data.market_cap.toLocaleString()}` : "N/A"}
• Listed Since: ${data.listed_at ? new Date(data.listed_at).toLocaleDateString() : "N/A"}

📈 SUPPLY METRICS
═══════════════════════════════════════════════════════════════════════════════
• Total Supply: ${data.total_supply ? data.total_supply.toLocaleString() : "N/A"}
• Circulating Supply: ${data.circulating_supply ? data.circulating_supply.toLocaleString() : "N/A"}
• Max Supply: ${data.max_supply ? data.max_supply.toLocaleString() : "Unlimited"}
• Circulation Rate: ${metrics.supplyMetrics.circulationRate.toFixed(2)}%
• Remaining Supply: ${metrics.supplyMetrics.remainingSupply.toLocaleString()} (${metrics.supplyMetrics.remainingSupplyPercentage.toFixed(2)}%)
• Inflation Rate: ${metrics.supplyMetrics.inflationRate.toFixed(2)}%

💰 MARKET METRICS
═══════════════════════════════════════════════════════════════════════════════
• Fully Diluted Valuation: $${metrics.marketMetrics.fullyDilutedValuation.toLocaleString()}
• Market Cap to FDV: ${metrics.marketMetrics.marketCapToFDV.toFixed(2)}%
• Price Support: ${metrics.marketMetrics.priceSupport.toUpperCase()}
• Liquidity Risk: ${metrics.marketMetrics.liquidityRisk.toUpperCase()}

${
	hasDistribution
		? `🎯 TOKEN DISTRIBUTION ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
• Community Ownership: ${metrics.distributionAnalysis.communityOwnership.toFixed(2)}%
• Institutional Ownership: ${metrics.distributionAnalysis.institutionalOwnership.toFixed(2)}%
• Team Ownership: ${metrics.distributionAnalysis.teamOwnership.toFixed(2)}%
• Treasury/DAO Ownership: ${metrics.distributionAnalysis.treasuryOwnership.toFixed(2)}%
• Concentration Risk: ${metrics.distributionAnalysis.concentrationRisk.toUpperCase()}
• Diversification Score: ${metrics.distributionAnalysis.diversificationScore.toFixed(1)}/100

📋 DETAILED DISTRIBUTION:
${analysisData.distribution.map((item) => `• ${item.name}: ${item.percentage.toFixed(2)}%`).join("\n")}
`
		: ""
}

${
	hasUnlockSchedule
		? `🔓 TOKEN UNLOCK ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
• Total Unlocking Tokens: ${metrics.unlockAnalysis.totalUnlockingTokens.toLocaleString()}
• Total Unlocking Value: $${metrics.unlockAnalysis.totalUnlockingValue.toLocaleString()}
• Next Unlock Date: ${metrics.unlockAnalysis.nextUnlockDate ? metrics.unlockAnalysis.nextUnlockDate.toLocaleDateString() : "N/A"}
• Next Unlock Amount: ${metrics.unlockAnalysis.nextUnlockAmount.toLocaleString()}
• Next Unlock Value: $${metrics.unlockAnalysis.nextUnlockValue.toLocaleString()}
• Unlock Pressure: ${metrics.unlockAnalysis.unlockPressure.toUpperCase()}
• Monthly Unlock Average: ${metrics.unlockAnalysis.monthlyUnlockAverage.toLocaleString()}

🗓️ UPCOMING UNLOCKS (Next 6 Months):
${
	metrics.unlockAnalysis.upcomingUnlocks.length > 0
		? metrics.unlockAnalysis.upcomingUnlocks
				.map(
					(unlock) =>
						`• ${unlock.date.toLocaleDateString()}: ${unlock.amount.toLocaleString()} tokens ($${unlock.value.toLocaleString()})`,
				)
				.join("\n")
		: "• No upcoming unlocks in the next 6 months"
}

📊 UNLOCKS BY CATEGORY:
${Object.entries(metrics.unlockAnalysis.unlocksByCategory)
	.map(
		([category, amount]) => `• ${category}: ${amount.toLocaleString()} tokens`,
	)
	.join("\n")}
`
		: "🔓 TOKEN UNLOCK ANALYSIS\n═══════════════════════════════════════════════════════════════════════════════\n• No unlock schedule data available\n"
}

🌐 SOCIAL & EXCHANGE PRESENCE
═══════════════════════════════════════════════════════════════════════════════
• Website: ${analysisData.socialLinks.website || "N/A"}
• Twitter: ${analysisData.socialLinks.twitter || "N/A"}
• Discord: ${analysisData.socialLinks.discord || "N/A"}
• Telegram: ${analysisData.socialLinks.telegram || "N/A"}
• Listed on ${analysisData.exchanges.length} exchanges

🏷️ TAGS & CATEGORIES
═══════════════════════════════════════════════════════════════════════════════
${analysisData.tags.length > 0 ? analysisData.tags.map((tag) => `• ${tag}`).join("\n") : "• No tags available"}

📋 TOKENOMICS SUMMARY & INSIGHTS
═══════════════════════════════════════════════════════════════════════════════
${
	hasUnlockSchedule
		? `• ${data.name} has ${metrics.unlockAnalysis.unlockPressure} unlock pressure with ${metrics.unlockAnalysis.totalUnlockingTokens.toLocaleString()} tokens pending release`
		: `• ${data.name} has no visible unlock schedule, indicating potentially stable token supply`
}
• Market cap represents ${metrics.marketMetrics.marketCapToFDV.toFixed(1)}% of fully diluted valuation
• Token distribution shows ${metrics.distributionAnalysis.concentrationRisk} concentration risk
• Current circulation rate is ${metrics.supplyMetrics.circulationRate.toFixed(1)}% of total supply
${
	hasDistribution && metrics.distributionAnalysis.communityOwnership > 30
		? `• Strong community ownership at ${metrics.distributionAnalysis.communityOwnership.toFixed(1)}%`
		: hasDistribution
			? `• Limited community ownership at ${metrics.distributionAnalysis.communityOwnership.toFixed(1)}%`
			: ""
}

⚠️ RISK ASSESSMENT from Mobula
═══════════════════════════════════════════════════════════════════════════════
Tokenomics Risk Level: ${
				metrics.unlockAnalysis.unlockPressure === "high" ||
				metrics.distributionAnalysis.concentrationRisk === "high" ||
				metrics.marketMetrics.liquidityRisk === "high"
					? "HIGH ⚠️"
					: (
								metrics.unlockAnalysis.unlockPressure === "moderate" ||
									metrics.distributionAnalysis.concentrationRisk ===
										"moderate" ||
									metrics.marketMetrics.liquidityRisk === "moderate"
							)
						? "MODERATE ⚡"
						: "LOW ✅"
			}

═══════════════════════════════════════════════════════════════════════════════
Analysis completed at: ${new Date().toLocaleString()}
Data source: Mobula API
`;

			return {
				analysis,
				tokenName: data.name,
				tokenSymbol: data.symbol,
				hasUnlockSchedule,
			};
		} catch (error) {
			const errorMessage = `Error fetching token metadata for ${asset}: ${error instanceof Error ? error.message : "Unknown error"}`;
			console.error(errorMessage);
			throw new Error(errorMessage);
		}
	},
});
