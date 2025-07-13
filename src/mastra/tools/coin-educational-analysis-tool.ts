import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface CoinGeckoResponse {
	id: string;
	name: string;
	symbol: string;
	description: {
		en: string;
	};
	links: {
		homepage: string[];
		whitepaper: string;
		blockchain_site: string[];
		official_forum_url: string[];
		chat_url: string[];
		announcement_url: string[];
		twitter_screen_name: string;
		facebook_username: string;
		telegram_channel_identifier: string;
		subreddit_url: string;
		repos_url: {
			github: string[];
			bitbucket: string[];
		};
	};
	market_data: {
		current_price: { usd: number };
		market_cap: { usd: number };
		total_volume: { usd: number };
		ath: { usd: number };
		atl: { usd: number };
		ath_date: { usd: string };
		atl_date: { usd: string };
		circulating_supply: number;
		total_supply: number;
		max_supply: number;
		price_change_percentage_24h: number;
		price_change_percentage_7d: number;
		price_change_percentage_30d: number;
		market_cap_rank: number;
	};
	community_data: {
		facebook_likes: number;
		reddit_average_posts_48h: number;
		reddit_average_comments_48h: number;
		reddit_subscribers: number;
		reddit_accounts_active_48h: number;
		telegram_channel_user_count: number;
	};
	developer_data: {
		forks: number;
		stars: number;
		subscribers: number;
		total_issues: number;
		closed_issues: number;
		pull_requests_merged: number;
		pull_request_contributors: number;
		code_additions_deletions_4_weeks: {
			additions: number;
			deletions: number;
		};
		commit_count_4_weeks: number;
	};
	public_interest_stats: {
		alexa_rank: number;
		bing_matches: number;
	};
}

interface EducationalAnalysisData {
	basicInfo: {
		name: string;
		symbol: string;
		description: string;
		rank: number;
	};
	projectLinks: {
		homepage: string[];
		whitepaper: string;
		blockchainExplorers: string[];
		socialMedia: {
			twitter: string;
			reddit: string;
			telegram: string;
			facebook: string;
		};
		github: string[];
	};
	marketEducation: {
		currentPrice: number;
		marketCap: number;
		volume: number;
		allTimeHigh: number;
		allTimeLow: number;
		athDate: string;
		atlDate: string;
		supply: {
			circulating: number;
			total: number;
			max: number;
		};
		priceChanges: {
			day: number;
			week: number;
			month: number;
		};
	};
	communityEngagement: {
		reddit: {
			subscribers: number;
			postsPerDay: number;
			commentsPerDay: number;
			activeUsers: number;
		};
		telegram: number;
		facebook: number;
	};
	developmentActivity: {
		github: {
			stars: number;
			forks: number;
			subscribers: number;
			issues: {
				total: number;
				closed: number;
				openPercentage: number;
			};
			pullRequests: {
				merged: number;
				contributors: number;
			};
			recentActivity: {
				commits: number;
				additions: number;
				deletions: number;
			};
		};
	};
	publicInterest: {
		alexaRank: number;
		bingMatches: number;
	};
}

interface CalculatedMetrics {
	projectHealth: {
		score: number;
		level: "excellent" | "good" | "fair" | "poor";
		factors: string[];
	};
	communityStrength: {
		score: number;
		level: "very active" | "active" | "moderate" | "low";
		engagement: string;
	};
	developmentHealth: {
		score: number;
		level: "very active" | "active" | "moderate" | "stagnant";
		activity: string;
	};
	marketPosition: {
		maturity: "established" | "growing" | "emerging" | "speculative";
		volatility: "low" | "moderate" | "high" | "extreme";
		liquidityLevel: "high" | "moderate" | "low";
	};
	educationalInsights: {
		strengths: string[];
		concerns: string[];
		recommendations: string[];
	};
}

// Helper functions for analysis
function calculateProjectHealth(
	data: EducationalAnalysisData,
): CalculatedMetrics["projectHealth"] {
	let score = 0;
	const factors: string[] = [];

	// Basic project factors
	if (data.basicInfo.description.length > 200) {
		score += 20;
		factors.push("Comprehensive project description");
	}

	if (data.projectLinks.homepage.length > 0) {
		score += 15;
		factors.push("Official website available");
	}

	if (data.projectLinks.whitepaper) {
		score += 20;
		factors.push("Whitepaper available");
	}

	if (data.projectLinks.github.length > 0) {
		score += 15;
		factors.push("Open source code available");
	}

	if (data.basicInfo.rank <= 100) {
		score += 20;
		factors.push("Top 100 market cap ranking");
	} else if (data.basicInfo.rank <= 500) {
		score += 10;
		factors.push("Top 500 market cap ranking");
	}

	if (data.marketEducation.supply.max > 0) {
		score += 10;
		factors.push("Defined maximum supply");
	}

	let level: "excellent" | "good" | "fair" | "poor" = "poor";
	if (score >= 80) level = "excellent";
	else if (score >= 60) level = "good";
	else if (score >= 40) level = "fair";

	return { score, level, factors };
}

function calculateCommunityStrength(
	data: EducationalAnalysisData,
): CalculatedMetrics["communityStrength"] {
	let score = 0;
	let engagement = "";

	const reddit = data.communityEngagement.reddit;
	const telegram = data.communityEngagement.telegram;

	// Reddit engagement
	if (reddit.subscribers > 100000) {
		score += 30;
		engagement += "Large Reddit community; ";
	} else if (reddit.subscribers > 10000) {
		score += 20;
		engagement += "Active Reddit community; ";
	} else if (reddit.subscribers > 1000) {
		score += 10;
		engagement += "Small Reddit community; ";
	}

	if (reddit.postsPerDay > 5) {
		score += 15;
		engagement += "High daily posting activity; ";
	} else if (reddit.postsPerDay > 1) {
		score += 10;
		engagement += "Regular posting activity; ";
	}

	// Telegram engagement
	if (telegram > 50000) {
		score += 25;
		engagement += "Large Telegram community; ";
	} else if (telegram > 10000) {
		score += 15;
		engagement += "Active Telegram community; ";
	} else if (telegram > 1000) {
		score += 10;
		engagement += "Small Telegram community; ";
	}

	// Social media presence
	if (data.projectLinks.socialMedia.twitter) {
		score += 10;
		engagement += "Active on Twitter; ";
	}

	if (data.projectLinks.socialMedia.reddit) {
		score += 10;
		engagement += "Official Reddit presence; ";
	}

	let level: "very active" | "active" | "moderate" | "low" = "low";
	if (score >= 70) level = "very active";
	else if (score >= 50) level = "active";
	else if (score >= 30) level = "moderate";

	return { score, level, engagement: engagement.trim() };
}

function calculateDevelopmentHealth(
	data: EducationalAnalysisData,
): CalculatedMetrics["developmentHealth"] {
	let score = 0;
	let activity = "";

	const github = data.developmentActivity.github;

	// GitHub metrics
	if (github.stars > 10000) {
		score += 25;
		activity += "High GitHub popularity; ";
	} else if (github.stars > 1000) {
		score += 15;
		activity += "Good GitHub popularity; ";
	} else if (github.stars > 100) {
		score += 10;
		activity += "Moderate GitHub popularity; ";
	}

	if (github.forks > 5000) {
		score += 20;
		activity += "Highly forked project; ";
	} else if (github.forks > 500) {
		score += 15;
		activity += "Well-forked project; ";
	} else if (github.forks > 50) {
		score += 10;
		activity += "Some community forks; ";
	}

	// Recent activity
	if (github.recentActivity.commits > 20) {
		score += 20;
		activity += "Very active recent development; ";
	} else if (github.recentActivity.commits > 5) {
		score += 15;
		activity += "Active recent development; ";
	} else if (github.recentActivity.commits > 0) {
		score += 10;
		activity += "Some recent development; ";
	}

	// Issue management
	if (github.issues.openPercentage < 20) {
		score += 15;
		activity += "Good issue management; ";
	} else if (github.issues.openPercentage < 40) {
		score += 10;
		activity += "Moderate issue management; ";
	}

	let level: "very active" | "active" | "moderate" | "stagnant" = "stagnant";
	if (score >= 70) level = "very active";
	else if (score >= 50) level = "active";
	else if (score >= 30) level = "moderate";

	return { score, level, activity: activity.trim() };
}

function calculateMarketPosition(
	data: EducationalAnalysisData,
): CalculatedMetrics["marketPosition"] {
	const marketCap = data.marketEducation.marketCap;
	const volume = data.marketEducation.volume;
	const priceChanges = data.marketEducation.priceChanges;

	// Maturity assessment
	let maturity: "established" | "growing" | "emerging" | "speculative" =
		"speculative";
	if (marketCap > 10000000000) maturity = "established";
	else if (marketCap > 1000000000) maturity = "growing";
	else if (marketCap > 100000000) maturity = "emerging";

	// Volatility assessment
	const avgVolatility =
		(Math.abs(priceChanges.day) +
			Math.abs(priceChanges.week) +
			Math.abs(priceChanges.month)) /
		3;
	let volatility: "low" | "moderate" | "high" | "extreme" = "low";
	if (avgVolatility > 50) volatility = "extreme";
	else if (avgVolatility > 20) volatility = "high";
	else if (avgVolatility > 10) volatility = "moderate";

	// Liquidity assessment
	const volumeToMarketCap = volume / marketCap;
	let liquidityLevel: "high" | "moderate" | "low" = "low";
	if (volumeToMarketCap > 0.1) liquidityLevel = "high";
	else if (volumeToMarketCap > 0.05) liquidityLevel = "moderate";

	return { maturity, volatility, liquidityLevel };
}

function generateEducationalInsights(
	data: EducationalAnalysisData,
	metrics: Omit<CalculatedMetrics, "educationalInsights">,
): CalculatedMetrics["educationalInsights"] {
	const strengths: string[] = [];
	const concerns: string[] = [];
	const recommendations: string[] = [];

	// Analyze strengths
	if (
		metrics.projectHealth.level === "excellent" ||
		metrics.projectHealth.level === "good"
	) {
		strengths.push("Well-documented project with clear fundamentals");
	}

	if (
		metrics.developmentHealth.level === "very active" ||
		metrics.developmentHealth.level === "active"
	) {
		strengths.push("Active development and community contributions");
	}

	if (
		metrics.communityStrength.level === "very active" ||
		metrics.communityStrength.level === "active"
	) {
		strengths.push("Strong community engagement and support");
	}

	if (
		metrics.marketPosition.maturity === "established" ||
		metrics.marketPosition.maturity === "growing"
	) {
		strengths.push("Established market position with good liquidity");
	}

	// Analyze concerns
	if (
		metrics.projectHealth.level === "poor" ||
		metrics.projectHealth.level === "fair"
	) {
		concerns.push("Limited project documentation or transparency");
	}

	if (
		metrics.developmentHealth.level === "stagnant" ||
		metrics.developmentHealth.level === "moderate"
	) {
		concerns.push("Low development activity may indicate reduced innovation");
	}

	if (
		metrics.communityStrength.level === "low" ||
		metrics.communityStrength.level === "moderate"
	) {
		concerns.push("Limited community engagement may affect long-term adoption");
	}

	if (
		metrics.marketPosition.volatility === "extreme" ||
		metrics.marketPosition.volatility === "high"
	) {
		concerns.push("High price volatility increases investment risk");
	}

	// Generate recommendations
	if (data.projectLinks.whitepaper) {
		recommendations.push(
			"Read the whitepaper to understand the project's technical approach",
		);
	}

	if (data.projectLinks.github.length > 0) {
		recommendations.push(
			"Review the GitHub repository to assess code quality and development activity",
		);
	}

	if (
		data.projectLinks.socialMedia.reddit ||
		data.projectLinks.socialMedia.telegram
	) {
		recommendations.push(
			"Join community discussions to gauge sentiment and development updates",
		);
	}

	recommendations.push(
		"Monitor development milestones and partnership announcements",
	);
	recommendations.push(
		"Consider dollar-cost averaging to mitigate volatility risks",
	);

	return { strengths, concerns, recommendations };
}

function performAnalysis(data: EducationalAnalysisData): CalculatedMetrics {
	const projectHealth = calculateProjectHealth(data);
	const communityStrength = calculateCommunityStrength(data);
	const developmentHealth = calculateDevelopmentHealth(data);
	const marketPosition = calculateMarketPosition(data);
	const educationalInsights = generateEducationalInsights(data, {
		projectHealth,
		communityStrength,
		developmentHealth,
		marketPosition,
	});

	return {
		projectHealth,
		communityStrength,
		developmentHealth,
		marketPosition,
		educationalInsights,
	};
}

export const coinEducationalAnalysisTool = createTool({
	id: "get-coin-educational-analysis",
	description:
		"Get comprehensive educational analysis and insights for a cryptocurrency, covering project fundamentals, community engagement, and development activity. As a professional tokenomics advisor, I will help you understand cryptocurrency projects through educational analysis. I will always ask for a cryptocurrency or token if none is provided, and help translate non-standard token names to the correct format. I will provide detailed educational analysis of project fundamentals, community strength, and development health, including insights about project risks, strengths, and research recommendations, and offer actionable advice based on the analysis. Responses will be informative and professional, focusing on educational aspects like project health, community engagement, development activity, and market position.",
	inputSchema: z.object({
		coinId: z
			.string()
			.describe("CoinGecko coin ID (e.g., bitcoin, ethereum, cardano)"),
	}),
	outputSchema: z.object({
		analysis: z
			.string()
			.describe("Formatted comprehensive educational analysis"),
		coinName: z.string().describe("The cryptocurrency name analyzed"),
		coinSymbol: z.string().describe("The cryptocurrency symbol analyzed"),
		projectHealthScore: z.number().describe("Project health score (0-100)"),
		hasWhitepaper: z.boolean().describe("Whether the project has a whitepaper"),
	}),
	execute: async ({ context }) => {
		const { coinId } = context;

		try {
			const response = await fetch(
				`https://api.coingecko.com/api/v3/coins/${coinId}`,
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const apiData: CoinGeckoResponse = await response.json();

			// Transform data for analysis
			const analysisData: EducationalAnalysisData = {
				basicInfo: {
					name: apiData.name,
					symbol: apiData.symbol.toUpperCase(),
					description: apiData.description?.en || "",
					rank: apiData.market_data?.market_cap_rank || 999,
				},
				projectLinks: {
					homepage: apiData.links?.homepage || [],
					whitepaper: apiData.links?.whitepaper || "",
					blockchainExplorers: apiData.links?.blockchain_site || [],
					socialMedia: {
						twitter: apiData.links?.twitter_screen_name || "",
						reddit: apiData.links?.subreddit_url || "",
						telegram: apiData.links?.telegram_channel_identifier || "",
						facebook: apiData.links?.facebook_username || "",
					},
					github: apiData.links?.repos_url?.github || [],
				},
				marketEducation: {
					currentPrice: apiData.market_data?.current_price?.usd || 0,
					marketCap: apiData.market_data?.market_cap?.usd || 0,
					volume: apiData.market_data?.total_volume?.usd || 0,
					allTimeHigh: apiData.market_data?.ath?.usd || 0,
					allTimeLow: apiData.market_data?.atl?.usd || 0,
					athDate: apiData.market_data?.ath_date?.usd || "",
					atlDate: apiData.market_data?.atl_date?.usd || "",
					supply: {
						circulating: apiData.market_data?.circulating_supply || 0,
						total: apiData.market_data?.total_supply || 0,
						max: apiData.market_data?.max_supply || 0,
					},
					priceChanges: {
						day: apiData.market_data?.price_change_percentage_24h || 0,
						week: apiData.market_data?.price_change_percentage_7d || 0,
						month: apiData.market_data?.price_change_percentage_30d || 0,
					},
				},
				communityEngagement: {
					reddit: {
						subscribers: apiData.community_data?.reddit_subscribers || 0,
						postsPerDay: apiData.community_data?.reddit_average_posts_48h || 0,
						commentsPerDay:
							apiData.community_data?.reddit_average_comments_48h || 0,
						activeUsers:
							apiData.community_data?.reddit_accounts_active_48h || 0,
					},
					telegram: apiData.community_data?.telegram_channel_user_count || 0,
					facebook: apiData.community_data?.facebook_likes || 0,
				},
				developmentActivity: {
					github: {
						stars: apiData.developer_data?.stars || 0,
						forks: apiData.developer_data?.forks || 0,
						subscribers: apiData.developer_data?.subscribers || 0,
						issues: {
							total: apiData.developer_data?.total_issues || 0,
							closed: apiData.developer_data?.closed_issues || 0,
							openPercentage: apiData.developer_data?.total_issues
								? ((apiData.developer_data.total_issues -
										apiData.developer_data.closed_issues) /
										apiData.developer_data.total_issues) *
									100
								: 0,
						},
						pullRequests: {
							merged: apiData.developer_data?.pull_requests_merged || 0,
							contributors:
								apiData.developer_data?.pull_request_contributors || 0,
						},
						recentActivity: {
							commits: apiData.developer_data?.commit_count_4_weeks || 0,
							additions:
								apiData.developer_data?.code_additions_deletions_4_weeks
									?.additions || 0,
							deletions: Math.abs(
								apiData.developer_data?.code_additions_deletions_4_weeks
									?.deletions || 0,
							),
						},
					},
				},
				publicInterest: {
					alexaRank: apiData.public_interest_stats?.alexa_rank || 0,
					bingMatches: apiData.public_interest_stats?.bing_matches || 0,
				},
			};

			// Perform comprehensive analysis
			const metrics = performAnalysis(analysisData);

			// Format analysis for terminal display
			const hasWhitepaper = !!analysisData.projectLinks.whitepaper;
			const hasGithub = analysisData.projectLinks.github.length > 0;

			const analysis = `
📚 CRYPTOCURRENCY EDUCATIONAL ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

🪙 PROJECT OVERVIEW
═══════════════════════════════════════════════════════════════════════════════
• Name: ${analysisData.basicInfo.name}
• Symbol: ${analysisData.basicInfo.symbol}
• Market Cap Rank: #${analysisData.basicInfo.rank}
• Project Health: ${metrics.projectHealth.level.toUpperCase()} (${metrics.projectHealth.score}/100)

📖 PROJECT DESCRIPTION
═══════════════════════════════════════════════════════════════════════════════
${analysisData.basicInfo.description ? analysisData.basicInfo.description : "No description available"}

🔗 EDUCATIONAL RESOURCES
═══════════════════════════════════════════════════════════════════════════════
• Official Website: ${analysisData.projectLinks.homepage[0] || "N/A"}
• Whitepaper: ${hasWhitepaper ? "✅ Available" : "❌ Not Available"}
• GitHub Repository: ${hasGithub ? `✅ ${analysisData.projectLinks.github.length} repositories` : "❌ Not Available"}
• Blockchain Explorers: ${analysisData.projectLinks.blockchainExplorers.length} available

🌐 SOCIAL MEDIA & COMMUNITY
═══════════════════════════════════════════════════════════════════════════════
• Twitter: ${analysisData.projectLinks.socialMedia.twitter ? `@${analysisData.projectLinks.socialMedia.twitter}` : "N/A"}
• Reddit: ${analysisData.communityEngagement.reddit.subscribers.toLocaleString()} subscribers
• Telegram: ${analysisData.communityEngagement.telegram > 0 ? `${analysisData.communityEngagement.telegram.toLocaleString()} members` : "N/A"}
• Community Strength: ${metrics.communityStrength.level.toUpperCase()} (${metrics.communityStrength.score}/100)

💰 MARKET EDUCATION
═══════════════════════════════════════════════════════════════════════════════
• Current Price: $${analysisData.marketEducation.currentPrice.toLocaleString()}
• Market Cap: $${analysisData.marketEducation.marketCap.toLocaleString()}
• 24h Volume: $${analysisData.marketEducation.volume.toLocaleString()}
• All-Time High: $${analysisData.marketEducation.allTimeHigh.toLocaleString()} (${analysisData.marketEducation.athDate ? new Date(analysisData.marketEducation.athDate).toLocaleDateString() : "N/A"})
• All-Time Low: $${analysisData.marketEducation.allTimeLow.toLocaleString()} (${analysisData.marketEducation.atlDate ? new Date(analysisData.marketEducation.atlDate).toLocaleDateString() : "N/A"})

📊 SUPPLY DYNAMICS
═══════════════════════════════════════════════════════════════════════════════
• Circulating Supply: ${analysisData.marketEducation.supply.circulating.toLocaleString()} ${analysisData.basicInfo.symbol}
• Total Supply: ${analysisData.marketEducation.supply.total.toLocaleString()} ${analysisData.basicInfo.symbol}
• Max Supply: ${analysisData.marketEducation.supply.max > 0 ? `${analysisData.marketEducation.supply.max.toLocaleString()} ${analysisData.basicInfo.symbol}` : "Unlimited"}

📈 PRICE PERFORMANCE
═══════════════════════════════════════════════════════════════════════════════
• 24h Change: ${analysisData.marketEducation.priceChanges.day.toFixed(2)}%
• 7d Change: ${analysisData.marketEducation.priceChanges.week.toFixed(2)}%
• 30d Change: ${analysisData.marketEducation.priceChanges.month.toFixed(2)}%
• Market Position: ${metrics.marketPosition.maturity.toUpperCase()}
• Volatility Level: ${metrics.marketPosition.volatility.toUpperCase()}

👨‍💻 DEVELOPMENT ACTIVITY
═══════════════════════════════════════════════════════════════════════════════
• GitHub Stars: ${analysisData.developmentActivity.github.stars.toLocaleString()}
• GitHub Forks: ${analysisData.developmentActivity.github.forks.toLocaleString()}
• Recent Commits (4 weeks): ${analysisData.developmentActivity.github.recentActivity.commits}
• Pull Request Contributors: ${analysisData.developmentActivity.github.pullRequests.contributors}
• Open Issues: ${analysisData.developmentActivity.github.issues.openPercentage.toFixed(1)}%
• Development Health: ${metrics.developmentHealth.level.toUpperCase()} (${metrics.developmentHealth.score}/100)

📊 COMMUNITY ENGAGEMENT
═══════════════════════════════════════════════════════════════════════════════
• Reddit Activity: ${analysisData.communityEngagement.reddit.postsPerDay.toFixed(1)} posts/day, ${analysisData.communityEngagement.reddit.commentsPerDay.toFixed(1)} comments/day
• Active Reddit Users: ${analysisData.communityEngagement.reddit.activeUsers.toLocaleString()}
• Engagement Level: ${metrics.communityStrength.engagement || "Limited activity"}

💡 EDUCATIONAL INSIGHTS
═══════════════════════════════════════════════════════════════════════════════

✅ PROJECT STRENGTHS:
${metrics.educationalInsights.strengths.map((strength) => `• ${strength}`).join("\n")}

⚠️ AREAS OF CONCERN:
${metrics.educationalInsights.concerns.map((concern) => `• ${concern}`).join("\n")}

🎯 RESEARCH RECOMMENDATIONS:
${metrics.educationalInsights.recommendations.map((rec) => `• ${rec}`).join("\n")}

📚 LEARNING RESOURCES
═══════════════════════════════════════════════════════════════════════════════
${hasWhitepaper ? `• Read the whitepaper: ${analysisData.projectLinks.whitepaper}` : ""}
${analysisData.projectLinks.homepage[0] ? `• Visit official website: ${analysisData.projectLinks.homepage[0]}` : ""}
${hasGithub ? `• Explore source code: ${analysisData.projectLinks.github[0]}` : ""}
${analysisData.projectLinks.socialMedia.reddit ? `• Join Reddit community: ${analysisData.projectLinks.socialMedia.reddit}` : ""}
${analysisData.projectLinks.blockchainExplorers[0] ? `• View blockchain data: ${analysisData.projectLinks.blockchainExplorers[0]}` : ""}

🎓 EDUCATIONAL SUMMARY
═══════════════════════════════════════════════════════════════════════════════
${analysisData.basicInfo.name} is a ${metrics.marketPosition.maturity} cryptocurrency project with ${metrics.projectHealth.level} fundamentals. 
The project demonstrates ${metrics.developmentHealth.level} development activity and ${metrics.communityStrength.level} community engagement. 
With a market cap of $${(analysisData.marketEducation.marketCap / 1000000).toFixed(0)}M and ${metrics.marketPosition.volatility} volatility, 
it represents a ${metrics.marketPosition.maturity === "established" ? "stable" : metrics.marketPosition.maturity === "growing" ? "growth-oriented" : "speculative"} investment opportunity.

Key learning points:
• Understanding ${analysisData.basicInfo.symbol}'s technology and use case is crucial for informed decisions
• Monitor development activity and community growth as indicators of long-term viability
• Consider market position and volatility when assessing risk tolerance
• Use multiple sources for research including official documentation and community discussions

═══════════════════════════════════════════════════════════════════════════════
Educational analysis completed at: ${new Date().toLocaleString()}
Data source: CoinGecko API
`;

			return {
				analysis,
				coinName: analysisData.basicInfo.name,
				coinSymbol: analysisData.basicInfo.symbol,
				projectHealthScore: metrics.projectHealth.score,
				hasWhitepaper,
			};
		} catch (error) {
			const errorMessage = `Error fetching educational data for ${coinId}: ${error instanceof Error ? error.message : "Unknown error"}`;
			console.error(errorMessage);
			throw new Error(errorMessage);
		}
	},
});
