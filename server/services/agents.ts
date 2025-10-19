import { invokeLLM } from "../_core/llm";
import { TechnicalIndicators } from "./marketData";
import { AgentDecision } from "../../drizzle/schema";

/**
 * Trading Agent System
 * Multi-agent architecture with specialized agents for different analysis types
 */

export type AgentType =
  | "fundamental"
  | "sentiment"
  | "technical"
  | "bull_researcher"
  | "bear_researcher"
  | "trader"
  | "risk_manager";

export type Recommendation = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

export interface AgentReport {
  agentType: AgentType;
  recommendation: Recommendation;
  confidence: number; // 0-100
  reasoning: string;
  metrics: Record<string, any>;
}

export interface MarketContext {
  symbol: string;
  currentPrice: number;
  indicators: TechnicalIndicators;
  recentNews?: string[];
  fundamentals?: Record<string, any>;
}

export interface TradeSignal {
  action: "buy" | "sell" | "hold";
  symbol: string;
  confidence: number;
  reasoning: string;
  suggestedQuantity?: number;
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
}

/**
 * Base Agent Class
 */
export abstract class BaseAgent {
  protected agentType: AgentType;

  constructor(agentType: AgentType) {
    this.agentType = agentType;
  }

  abstract analyze(context: MarketContext, additionalData?: any): Promise<AgentReport>;

  protected async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === "string") {
        return content;
      }
      return "";
    } catch (error) {
      console.error(`[${this.agentType}] LLM call failed:`, error);
      throw error;
    }
  }

  protected async callStructuredLLM<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: any
  ): Promise<T> {
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "agent_response",
            strict: true,
            schema,
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      const contentStr = typeof content === "string" ? content : "{}";
      return JSON.parse(contentStr);
    } catch (error) {
      console.error(`[${this.agentType}] Structured LLM call failed:`, error);
      throw error;
    }
  }
}

/**
 * Technical Analysis Agent
 * Analyzes charts, indicators, and price patterns
 */
export class TechnicalAnalystAgent extends BaseAgent {
  constructor() {
    super("technical");
  }

  async analyze(context: MarketContext): Promise<AgentReport> {
    const { symbol, currentPrice, indicators } = context;

    const systemPrompt = `You are a technical analysis expert specializing in cryptocurrency and stock trading. 
Analyze technical indicators and provide trading recommendations based on price action, momentum, and trend analysis.
Focus on RSI, MACD, Bollinger Bands, and moving averages.`;

    const userPrompt = `Analyze the following technical indicators for ${symbol}:

Current Price: $${currentPrice.toFixed(2)}
RSI: ${indicators.rsi.toFixed(2)}
MACD: ${indicators.macd.macd.toFixed(2)} (Signal: ${indicators.macd.signal.toFixed(2)}, Histogram: ${indicators.macd.histogram.toFixed(2)})
Bollinger Bands: Upper $${indicators.bollingerBands.upper.toFixed(2)}, Middle $${indicators.bollingerBands.middle.toFixed(2)}, Lower $${indicators.bollingerBands.lower.toFixed(2)}
SMA20: $${indicators.sma20.toFixed(2)}
SMA50: $${indicators.sma50.toFixed(2)}
EMA12: $${indicators.ema12.toFixed(2)}
EMA26: $${indicators.ema26.toFixed(2)}
ATR: ${indicators.atr.toFixed(2)}

Provide your analysis in JSON format with: recommendation (strong_buy/buy/hold/sell/strong_sell), confidence (0-100), reasoning (detailed explanation), and key_signals (array of important technical signals).`;

    const schema = {
      type: "object",
      properties: {
        recommendation: {
          type: "string",
          enum: ["strong_buy", "buy", "hold", "sell", "strong_sell"],
        },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        reasoning: { type: "string" },
        key_signals: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["recommendation", "confidence", "reasoning", "key_signals"],
      additionalProperties: false,
    };

    const result = await this.callStructuredLLM<{
      recommendation: Recommendation;
      confidence: number;
      reasoning: string;
      key_signals: string[];
    }>(systemPrompt, userPrompt, schema);

    return {
      agentType: this.agentType,
      recommendation: result.recommendation,
      confidence: result.confidence,
      reasoning: result.reasoning,
      metrics: {
        rsi: indicators.rsi,
        macd: indicators.macd,
        key_signals: result.key_signals,
      },
    };
  }
}

/**
 * Fundamental Analysis Agent
 * Evaluates company fundamentals, market conditions, and economic factors
 */
export class FundamentalAnalystAgent extends BaseAgent {
  constructor() {
    super("fundamental");
  }

  async analyze(context: MarketContext): Promise<AgentReport> {
    const { symbol, currentPrice } = context;

    const systemPrompt = `You are a fundamental analysis expert. Analyze market conditions, economic factors, and asset fundamentals.
Provide insights on long-term value, market sentiment, and macroeconomic trends.`;

    const userPrompt = `Provide fundamental analysis for ${symbol} at current price $${currentPrice.toFixed(2)}.

Consider:
- Overall market conditions
- Sector trends
- Economic indicators
- Long-term value proposition

Provide your analysis in JSON format with: recommendation, confidence (0-100), reasoning, and fundamental_factors (array of key factors).`;

    const schema = {
      type: "object",
      properties: {
        recommendation: {
          type: "string",
          enum: ["strong_buy", "buy", "hold", "sell", "strong_sell"],
        },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        reasoning: { type: "string" },
        fundamental_factors: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["recommendation", "confidence", "reasoning", "fundamental_factors"],
      additionalProperties: false,
    };

    const result = await this.callStructuredLLM<{
      recommendation: Recommendation;
      confidence: number;
      reasoning: string;
      fundamental_factors: string[];
    }>(systemPrompt, userPrompt, schema);

    return {
      agentType: this.agentType,
      recommendation: result.recommendation,
      confidence: result.confidence,
      reasoning: result.reasoning,
      metrics: {
        fundamental_factors: result.fundamental_factors,
      },
    };
  }
}

/**
 * Sentiment Analysis Agent
 * Analyzes market sentiment from news and social media
 */
export class SentimentAnalystAgent extends BaseAgent {
  constructor() {
    super("sentiment");
  }

  async analyze(context: MarketContext): Promise<AgentReport> {
    const { symbol, currentPrice } = context;

    const systemPrompt = `You are a market sentiment analyst. Analyze market psychology, investor sentiment, and social trends.
Evaluate fear/greed levels, market momentum, and crowd behavior.`;

    const userPrompt = `Analyze market sentiment for ${symbol} at $${currentPrice.toFixed(2)}.

Consider:
- Current market psychology (fear vs greed)
- Trading volume trends
- Market momentum
- Investor behavior patterns

Provide your analysis in JSON format with: recommendation, confidence (0-100), reasoning, and sentiment_score (-100 to 100, where -100 is extreme fear and 100 is extreme greed).`;

    const schema = {
      type: "object",
      properties: {
        recommendation: {
          type: "string",
          enum: ["strong_buy", "buy", "hold", "sell", "strong_sell"],
        },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        reasoning: { type: "string" },
        sentiment_score: { type: "integer", minimum: -100, maximum: 100 },
      },
      required: ["recommendation", "confidence", "reasoning", "sentiment_score"],
      additionalProperties: false,
    };

    const result = await this.callStructuredLLM<{
      recommendation: Recommendation;
      confidence: number;
      reasoning: string;
      sentiment_score: number;
    }>(systemPrompt, userPrompt, schema);

    return {
      agentType: this.agentType,
      recommendation: result.recommendation,
      confidence: result.confidence,
      reasoning: result.reasoning,
      metrics: {
        sentiment_score: result.sentiment_score,
      },
    };
  }
}

/**
 * Bull Researcher Agent
 * Argues for bullish positions
 */
export class BullResearcherAgent extends BaseAgent {
  constructor() {
    super("bull_researcher");
  }

  async analyze(context: MarketContext): Promise<AgentReport> {
    const { symbol, currentPrice, indicators } = context;

    const systemPrompt = `You are a bull researcher. Your role is to find and argue for bullish scenarios and buying opportunities.
Look for positive signals, upside potential, and reasons to be optimistic about the asset.`;

    const userPrompt = `Make a bullish case for ${symbol} at $${currentPrice.toFixed(2)}.

Technical context:
- RSI: ${indicators.rsi.toFixed(2)}
- Price vs SMA20: ${((currentPrice / indicators.sma20 - 1) * 100).toFixed(2)}%
- MACD Histogram: ${indicators.macd.histogram.toFixed(2)}

Provide your bullish analysis in JSON format with: recommendation, confidence (0-100), reasoning (focus on bullish factors), and bullish_signals (array of positive indicators).`;

    const schema = {
      type: "object",
      properties: {
        recommendation: {
          type: "string",
          enum: ["strong_buy", "buy", "hold", "sell", "strong_sell"],
        },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        reasoning: { type: "string" },
        bullish_signals: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["recommendation", "confidence", "reasoning", "bullish_signals"],
      additionalProperties: false,
    };

    const result = await this.callStructuredLLM<{
      recommendation: Recommendation;
      confidence: number;
      reasoning: string;
      bullish_signals: string[];
    }>(systemPrompt, userPrompt, schema);

    return {
      agentType: this.agentType,
      recommendation: result.recommendation,
      confidence: result.confidence,
      reasoning: result.reasoning,
      metrics: {
        bullish_signals: result.bullish_signals,
      },
    };
  }
}

/**
 * Bear Researcher Agent
 * Argues for bearish positions
 */
export class BearResearcherAgent extends BaseAgent {
  constructor() {
    super("bear_researcher");
  }

  async analyze(context: MarketContext): Promise<AgentReport> {
    const { symbol, currentPrice, indicators } = context;

    const systemPrompt = `You are a bear researcher. Your role is to find and argue for bearish scenarios and risks.
Look for negative signals, downside risks, and reasons to be cautious about the asset.`;

    const userPrompt = `Make a bearish case for ${symbol} at $${currentPrice.toFixed(2)}.

Technical context:
- RSI: ${indicators.rsi.toFixed(2)}
- Price vs SMA20: ${((currentPrice / indicators.sma20 - 1) * 100).toFixed(2)}%
- MACD Histogram: ${indicators.macd.histogram.toFixed(2)}

Provide your bearish analysis in JSON format with: recommendation, confidence (0-100), reasoning (focus on bearish factors), and bearish_signals (array of negative indicators).`;

    const schema = {
      type: "object",
      properties: {
        recommendation: {
          type: "string",
          enum: ["strong_buy", "buy", "hold", "sell", "strong_sell"],
        },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        reasoning: { type: "string" },
        bearish_signals: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["recommendation", "confidence", "reasoning", "bearish_signals"],
      additionalProperties: false,
    };

    const result = await this.callStructuredLLM<{
      recommendation: Recommendation;
      confidence: number;
      reasoning: string;
      bearish_signals: string[];
    }>(systemPrompt, userPrompt, schema);

    return {
      agentType: this.agentType,
      recommendation: result.recommendation,
      confidence: result.confidence,
      reasoning: result.reasoning,
      metrics: {
        bearish_signals: result.bearish_signals,
      },
    };
  }
}

/**
 * Trader Agent
 * Synthesizes all agent reports and makes final trading decisions
 */
export class TraderAgent extends BaseAgent {
  constructor() {
    super("trader");
  }

  async analyze(context: MarketContext, reports?: AgentReport[]): Promise<AgentReport> {
    if (!reports || reports.length === 0) {
      throw new Error("Trader agent requires reports from other agents");
    }
    const { symbol, currentPrice } = context;

    const reportsText = reports
      .map(
        (r) =>
          `${r.agentType.toUpperCase()}: ${r.recommendation} (confidence: ${r.confidence}%)\nReasoning: ${r.reasoning}`
      )
      .join("\n\n");

    const systemPrompt = `You are the lead trader making final trading decisions. 
Synthesize input from multiple specialized analysts (technical, fundamental, sentiment, bull/bear researchers).
Weight their recommendations by confidence levels and make a balanced final decision.
Consider risk/reward ratios and current market conditions.`;

    const userPrompt = `Make a final trading decision for ${symbol} at $${currentPrice.toFixed(2)}.

Agent Reports:
${reportsText}

Synthesize these reports and provide your final decision in JSON format with: recommendation, confidence (0-100), reasoning (explain how you weighted different inputs), and consensus_strength (0-100, how much agents agree).`;

    const schema = {
      type: "object",
      properties: {
        recommendation: {
          type: "string",
          enum: ["strong_buy", "buy", "hold", "sell", "strong_sell"],
        },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        reasoning: { type: "string" },
        consensus_strength: { type: "integer", minimum: 0, maximum: 100 },
      },
      required: ["recommendation", "confidence", "reasoning", "consensus_strength"],
      additionalProperties: false,
    };

    const result = await this.callStructuredLLM<{
      recommendation: Recommendation;
      confidence: number;
      reasoning: string;
      consensus_strength: number;
    }>(systemPrompt, userPrompt, schema);

    return {
      agentType: this.agentType,
      recommendation: result.recommendation,
      confidence: result.confidence,
      reasoning: result.reasoning,
      metrics: {
        consensus_strength: result.consensus_strength,
        agent_count: reports.length,
      },
    };
  }
}

/**
 * Risk Manager Agent
 * Has veto authority over trading decisions
 */
export class RiskManagerAgent extends BaseAgent {
  constructor() {
    super("risk_manager");
  }

  async analyze(context: MarketContext): Promise<AgentReport> {
    // Risk manager doesn't provide recommendations, only validates trades
    return {
      agentType: this.agentType,
      recommendation: "hold",
      confidence: 0,
      reasoning: "Risk manager validates trades but doesn't make recommendations",
      metrics: {},
    };
  }

  async validateTrade(
    signal: TradeSignal,
    currentPositions: any[],
    accountValue: number,
    strategyConfig: any
  ): Promise<{ approved: boolean; reasoning: string; adjustments?: any }> {
    const totalExposure = currentPositions.reduce((sum, pos) => {
      return sum + Math.abs(pos.quantity * pos.currentPrice);
    }, 0);

    const exposurePercent = (totalExposure / accountValue) * 100;

    const systemPrompt = `You are the risk manager with veto authority over all trades.
Your primary responsibility is to prevent catastrophic losses and ensure compliance with risk limits.
You can approve, reject, or modify trade proposals based on risk assessment.`;

    const userPrompt = `Evaluate this trade proposal:

Trade: ${signal.action.toUpperCase()} ${signal.symbol}
Confidence: ${signal.confidence}%
Reasoning: ${signal.reasoning}

Current Risk Metrics:
- Account Value: $${accountValue.toFixed(2)}
- Total Exposure: $${totalExposure.toFixed(2)} (${exposurePercent.toFixed(2)}%)
- Open Positions: ${currentPositions.length}
- Max Position Size Limit: ${strategyConfig.maxPositionSize}%
- Daily Loss Limit: ${strategyConfig.dailyLossLimit}%

Provide your risk assessment in JSON format with: approved (boolean), reasoning (detailed risk analysis), and adjustments (if any modifications needed to approve).`;

    const schema = {
      type: "object",
      properties: {
        approved: { type: "boolean" },
        reasoning: { type: "string" },
        adjustments: {
          type: "object",
          properties: {
            reduce_size: { type: "boolean" },
            tighter_stop_loss: { type: "boolean" },
            suggested_size_percent: { type: "number" },
          },
          additionalProperties: false,
        },
      },
      required: ["approved", "reasoning"],
      additionalProperties: false,
    };

    const result = await this.callStructuredLLM<{
      approved: boolean;
      reasoning: string;
      adjustments?: any;
    }>(systemPrompt, userPrompt, schema);

    return result;
  }
}

/**
 * Agent Orchestrator
 * Coordinates all agents in the decision-making pipeline
 */
export class AgentOrchestrator {
  private technicalAgent: TechnicalAnalystAgent;
  private fundamentalAgent: FundamentalAnalystAgent;
  private sentimentAgent: SentimentAnalystAgent;
  private bullAgent: BullResearcherAgent;
  private bearAgent: BearResearcherAgent;
  private traderAgent: TraderAgent;
  private riskAgent: RiskManagerAgent;

  constructor() {
    this.technicalAgent = new TechnicalAnalystAgent();
    this.fundamentalAgent = new FundamentalAnalystAgent();
    this.sentimentAgent = new SentimentAnalystAgent();
    this.bullAgent = new BullResearcherAgent();
    this.bearAgent = new BearResearcherAgent();
    this.traderAgent = new TraderAgent();
    this.riskAgent = new RiskManagerAgent();
  }

  async generateTradeSignal(context: MarketContext): Promise<{ reports: AgentReport[]; signal: TradeSignal }> {
    // Run all analyst agents in parallel
    const [technicalReport, fundamentalReport, sentimentReport, bullReport, bearReport] = await Promise.all([
      this.technicalAgent.analyze(context),
      this.fundamentalAgent.analyze(context),
      this.sentimentAgent.analyze(context),
      this.bullAgent.analyze(context),
      this.bearAgent.analyze(context),
    ]);

    const reports = [technicalReport, fundamentalReport, sentimentReport, bullReport, bearReport];

    // Trader synthesizes all reports
    const traderReport = await this.traderAgent.analyze(context, reports);
    reports.push(traderReport);

    // Convert recommendation to action
    let action: "buy" | "sell" | "hold" = "hold";
    if (traderReport.recommendation === "strong_buy" || traderReport.recommendation === "buy") {
      action = "buy";
    } else if (traderReport.recommendation === "strong_sell" || traderReport.recommendation === "sell") {
      action = "sell";
    }

    const signal: TradeSignal = {
      action,
      symbol: context.symbol,
      confidence: traderReport.confidence,
      reasoning: traderReport.reasoning,
    };

    return { reports, signal };
  }

  async validateTradeWithRisk(
    signal: TradeSignal,
    currentPositions: any[],
    accountValue: number,
    strategyConfig: any
  ): Promise<{ approved: boolean; reasoning: string; adjustments?: any }> {
    return this.riskAgent.validateTrade(signal, currentPositions, accountValue, strategyConfig);
  }
}

