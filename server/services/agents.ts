/**
 * Trading Agents - Real LLM-Powered Multi-Agent System
 * Implements 7 specialized agents with structured outputs
 */

import { AgentLLM } from './llm/openrouter';
import { TechnicalIndicators } from './marketData';

// ==================== Agent Response Schemas ====================

export interface TechnicalAnalysisReport {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-1
  signals: {
    rsi: { value: number; signal: 'overbought' | 'oversold' | 'neutral' };
    macd: { signal: 'bullish' | 'bearish' | 'neutral' };
    bollingerBands: { position: 'above' | 'below' | 'within'; signal: string };
    movingAverages: { trend: 'bullish' | 'bearish' | 'neutral' };
  };
  reasoning: string;
  keyPoints: string[];
}

export interface FundamentalAnalysisReport {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  valuation: 'undervalued' | 'fairly_valued' | 'overvalued';
  factors: {
    marketConditions: string;
    sectorOutlook: string;
    economicIndicators: string;
  };
  reasoning: string;
  keyPoints: string[];
}

export interface SentimentAnalysisReport {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number; // -1 to 1
  sources: {
    news: string;
    social: string;
    market: string;
  };
  reasoning: string;
  keyPoints: string[];
}

export interface ResearchReport {
  position: 'bull' | 'bear';
  strength: number; // 0-1
  arguments: string[];
  evidence: string[];
  counterarguments: string[];
  conclusion: string;
}

export interface TradeDecision {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  synthesis: string;
  riskAssessment: string;
  targetPrice?: number;
  stopLoss?: number;
  positionSize?: number;
}

export interface RiskAssessment {
  approved: boolean;
  riskScore: number; // 0-1
  violations: string[];
  warnings: string[];
  recommendations: string[];
  reasoning: string;
}

// ==================== Agent Context ====================

export interface AgentContext {
  symbol: string;
  currentPrice: number;
  indicators: TechnicalIndicators;
  historicalPrices?: number[];
  strategy: {
    riskLevel: string;
    maxPositionSize: number;
    stopLossPercent: number;
  };
  portfolio?: {
    totalValue: number;
    availableCash: number;
    currentPositions: number;
  };
}

// ==================== Individual Agents ====================

/**
 * Technical Analyst Agent
 * Analyzes price charts and technical indicators
 */
export async function runTechnicalAnalyst(context: AgentContext): Promise<TechnicalAnalysisReport> {
  const { symbol, currentPrice, indicators } = context;

  const prompt = `Analyze the following technical indicators for ${symbol} at current price $${currentPrice}:

RSI: ${indicators.rsi}
MACD: ${indicators.macd.macd} (Signal: ${indicators.macd.signal}, Histogram: ${indicators.macd.histogram})
Bollinger Bands: Upper ${indicators.bollingerBands.upper}, Middle ${indicators.bollingerBands.middle}, Lower ${indicators.bollingerBands.lower}
SMA 20: ${indicators.sma20}, SMA 50: ${indicators.sma50}
EMA 12: ${indicators.ema12}, EMA 26: ${indicators.ema26}
ATR: ${indicators.atr}

Provide a technical analysis with:
1. Buy/Sell/Hold recommendation
2. Confidence level (0-1)
3. Analysis of each indicator
4. Overall reasoning
5. Key technical points`;

  const schema = {
    type: 'object',
    properties: {
      recommendation: { type: 'string', enum: ['buy', 'sell', 'hold'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      signals: {
        type: 'object',
        properties: {
          rsi: {
            type: 'object',
            properties: {
              value: { type: 'number' },
              signal: { type: 'string', enum: ['overbought', 'oversold', 'neutral'] }
            }
          },
          macd: {
            type: 'object',
            properties: {
              signal: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] }
            }
          },
          bollingerBands: {
            type: 'object',
            properties: {
              position: { type: 'string', enum: ['above', 'below', 'within'] },
              signal: { type: 'string' }
            }
          },
          movingAverages: {
            type: 'object',
            properties: {
              trend: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] }
            }
          }
        }
      },
      reasoning: { type: 'string' },
      keyPoints: { type: 'array', items: { type: 'string' } }
    },
    required: ['recommendation', 'confidence', 'signals', 'reasoning', 'keyPoints']
  };

  try {
    const response = await AgentLLM.technicalAnalyst(prompt, schema);
    return response.data;
  } catch (error: any) {
    console.error('[TechnicalAnalyst] Error:', error.message);
    // Fallback to rule-based analysis
    return fallbackTechnicalAnalysis(indicators, currentPrice);
  }
}

/**
 * Fundamental Analyst Agent
 * Evaluates market conditions and fundamental factors
 */
export async function runFundamentalAnalyst(context: AgentContext): Promise<FundamentalAnalysisReport> {
  const { symbol, currentPrice } = context;

  const prompt = `Provide fundamental analysis for ${symbol} at current price $${currentPrice}.

Consider:
1. Current market conditions
2. Sector outlook
3. Economic indicators
4. Valuation assessment
5. Investment recommendation

Provide structured fundamental analysis with confidence level and key factors.`;

  const schema = {
    type: 'object',
    properties: {
      recommendation: { type: 'string', enum: ['buy', 'sell', 'hold'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      valuation: { type: 'string', enum: ['undervalued', 'fairly_valued', 'overvalued'] },
      factors: {
        type: 'object',
        properties: {
          marketConditions: { type: 'string' },
          sectorOutlook: { type: 'string' },
          economicIndicators: { type: 'string' }
        }
      },
      reasoning: { type: 'string' },
      keyPoints: { type: 'array', items: { type: 'string' } }
    },
    required: ['recommendation', 'confidence', 'valuation', 'factors', 'reasoning', 'keyPoints']
  };

  try {
    const response = await AgentLLM.fundamentalAnalyst(prompt, schema);
    return response.data;
  } catch (error: any) {
    console.error('[FundamentalAnalyst] Error:', error.message);
    return {
      recommendation: 'hold',
      confidence: 0.5,
      valuation: 'fairly_valued',
      factors: {
        marketConditions: 'Unable to assess - API error',
        sectorOutlook: 'Unable to assess - API error',
        economicIndicators: 'Unable to assess - API error'
      },
      reasoning: 'Fundamental analysis unavailable due to API error',
      keyPoints: ['Analysis failed - using neutral stance']
    };
  }
}

/**
 * Sentiment Analyst Agent
 * Analyzes market sentiment and investor psychology
 */
export async function runSentimentAnalyst(context: AgentContext): Promise<SentimentAnalysisReport> {
  const { symbol, currentPrice } = context;

  const prompt = `Analyze market sentiment for ${symbol} at current price $${currentPrice}.

Consider:
1. Recent news sentiment
2. Social media trends
3. Market momentum
4. Investor psychology
5. Fear/greed indicators

Provide sentiment analysis with bullish/bearish/neutral classification and confidence.`;

  const schema = {
    type: 'object',
    properties: {
      recommendation: { type: 'string', enum: ['buy', 'sell', 'hold'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      sentiment: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
      score: { type: 'number', minimum: -1, maximum: 1 },
      sources: {
        type: 'object',
        properties: {
          news: { type: 'string' },
          social: { type: 'string' },
          market: { type: 'string' }
        }
      },
      reasoning: { type: 'string' },
      keyPoints: { type: 'array', items: { type: 'string' } }
    },
    required: ['recommendation', 'confidence', 'sentiment', 'score', 'sources', 'reasoning', 'keyPoints']
  };

  try {
    const response = await AgentLLM.sentimentAnalyst(prompt, schema);
    return response.data;
  } catch (error: any) {
    console.error('[SentimentAnalyst] Error:', error.message);
    return {
      recommendation: 'hold',
      confidence: 0.5,
      sentiment: 'neutral',
      score: 0,
      sources: {
        news: 'Unable to assess',
        social: 'Unable to assess',
        market: 'Unable to assess'
      },
      reasoning: 'Sentiment analysis unavailable',
      keyPoints: ['Analysis failed - using neutral stance']
    };
  }
}

/**
 * Bull Researcher Agent
 * Finds and presents bullish arguments
 */
export async function runBullResearcher(context: AgentContext, analystReports: {
  technical: TechnicalAnalysisReport;
  fundamental: FundamentalAnalysisReport;
  sentiment: SentimentAnalysisReport;
}): Promise<ResearchReport> {
  const { symbol, currentPrice } = context;

  const prompt = `As a bull researcher, find the strongest bullish arguments for buying ${symbol} at $${currentPrice}.

Analyst Reports Summary:
- Technical: ${analystReports.technical.recommendation} (confidence: ${analystReports.technical.confidence})
- Fundamental: ${analystReports.fundamental.recommendation} (confidence: ${analystReports.fundamental.confidence})
- Sentiment: ${analystReports.sentiment.recommendation} (confidence: ${analystReports.sentiment.confidence})

Provide:
1. Strongest bullish arguments
2. Supporting evidence
3. Potential counterarguments
4. Overall bull case strength (0-1)`;

  const schema = {
    type: 'object',
    properties: {
      position: { type: 'string', enum: ['bull'] },
      strength: { type: 'number', minimum: 0, maximum: 1 },
      arguments: { type: 'array', items: { type: 'string' } },
      evidence: { type: 'array', items: { type: 'string' } },
      counterarguments: { type: 'array', items: { type: 'string' } },
      conclusion: { type: 'string' }
    },
    required: ['position', 'strength', 'arguments', 'evidence', 'counterarguments', 'conclusion']
  };

  try {
    const response = await AgentLLM.bullResearcher(prompt, schema);
    return { ...response.data, position: 'bull' };
  } catch (error: any) {
    console.error('[BullResearcher] Error:', error.message);
    return {
      position: 'bull',
      strength: 0.5,
      arguments: ['Technical indicators show potential'],
      evidence: ['Unable to gather detailed evidence'],
      counterarguments: ['Analysis incomplete'],
      conclusion: 'Moderate bull case due to limited data'
    };
  }
}

/**
 * Bear Researcher Agent
 * Finds and presents bearish arguments
 */
export async function runBearResearcher(context: AgentContext, analystReports: {
  technical: TechnicalAnalysisReport;
  fundamental: FundamentalAnalysisReport;
  sentiment: SentimentAnalysisReport;
}): Promise<ResearchReport> {
  const { symbol, currentPrice } = context;

  const prompt = `As a bear researcher, find the strongest bearish arguments against buying ${symbol} at $${currentPrice}.

Analyst Reports Summary:
- Technical: ${analystReports.technical.recommendation} (confidence: ${analystReports.technical.confidence})
- Fundamental: ${analystReports.fundamental.recommendation} (confidence: ${analystReports.fundamental.confidence})
- Sentiment: ${analystReports.sentiment.recommendation} (confidence: ${analystReports.sentiment.confidence})

Provide:
1. Strongest bearish arguments
2. Supporting evidence
3. Potential counterarguments
4. Overall bear case strength (0-1)`;

  const schema = {
    type: 'object',
    properties: {
      position: { type: 'string', enum: ['bear'] },
      strength: { type: 'number', minimum: 0, maximum: 1 },
      arguments: { type: 'array', items: { type: 'string' } },
      evidence: { type: 'array', items: { type: 'string' } },
      counterarguments: { type: 'array', items: { type: 'string' } },
      conclusion: { type: 'string' }
    },
    required: ['position', 'strength', 'arguments', 'evidence', 'counterarguments', 'conclusion']
  };

  try {
    const response = await AgentLLM.bearResearcher(prompt, schema);
    return { ...response.data, position: 'bear' };
  } catch (error: any) {
    console.error('[BearResearcher] Error:', error.message);
    return {
      position: 'bear',
      strength: 0.5,
      arguments: ['Market risks present'],
      evidence: ['Unable to gather detailed evidence'],
      counterarguments: ['Analysis incomplete'],
      conclusion: 'Moderate bear case due to limited data'
    };
  }
}

/**
 * Trader Agent
 * Synthesizes all reports and makes final trading decision
 */
export async function runTraderAgent(
  context: AgentContext,
  analystReports: {
    technical: TechnicalAnalysisReport;
    fundamental: FundamentalAnalysisReport;
    sentiment: SentimentAnalysisReport;
  },
  research: {
    bull: ResearchReport;
    bear: ResearchReport;
  }
): Promise<TradeDecision> {
  const { symbol, currentPrice, strategy } = context;

  const prompt = `As the lead trader, make a final trading decision for ${symbol} at $${currentPrice}.

ANALYST REPORTS:
Technical Analysis: ${analystReports.technical.recommendation} (${analystReports.technical.confidence} confidence)
- ${analystReports.technical.reasoning}

Fundamental Analysis: ${analystReports.fundamental.recommendation} (${analystReports.fundamental.confidence} confidence)
- ${analystReports.fundamental.reasoning}

Sentiment Analysis: ${analystReports.sentiment.recommendation} (${analystReports.sentiment.confidence} confidence)
- ${analystReports.sentiment.reasoning}

RESEARCH DEBATE:
Bull Case (strength: ${research.bull.strength}):
${research.bull.arguments.join(', ')}

Bear Case (strength: ${research.bear.strength}):
${research.bear.arguments.join(', ')}

STRATEGY PARAMETERS:
- Risk Level: ${strategy.riskLevel}
- Max Position Size: ${strategy.maxPositionSize}%
- Stop Loss: ${strategy.stopLossPercent}%

Make a final trading decision with:
1. Action (buy/sell/hold)
2. Confidence level
3. Synthesis of all inputs
4. Risk assessment
5. Target price and stop loss if buying`;

  const schema = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['buy', 'sell', 'hold'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      reasoning: { type: 'string' },
      synthesis: { type: 'string' },
      riskAssessment: { type: 'string' },
      targetPrice: { type: 'number' },
      stopLoss: { type: 'number' },
      positionSize: { type: 'number' }
    },
    required: ['action', 'confidence', 'reasoning', 'synthesis', 'riskAssessment']
  };

  try {
    const response = await AgentLLM.trader(prompt, schema);
    return response.data;
  } catch (error: any) {
    console.error('[TraderAgent] Error:', error.message);
    return {
      action: 'hold',
      confidence: 0.3,
      reasoning: 'Unable to make decision due to API error',
      synthesis: 'Insufficient data for trading decision',
      riskAssessment: 'High uncertainty - holding position'
    };
  }
}

/**
 * Risk Manager Agent
 * Validates trade against risk parameters with veto authority
 */
export async function runRiskManager(
  context: AgentContext,
  tradeDecision: TradeDecision
): Promise<RiskAssessment> {
  const { symbol, currentPrice, strategy, portfolio } = context;

  const prompt = `As risk manager with VETO AUTHORITY, evaluate this trade for ${symbol}:

PROPOSED TRADE:
- Action: ${tradeDecision.action}
- Confidence: ${tradeDecision.confidence}
- Position Size: ${tradeDecision.positionSize || 'Not specified'}%
- Stop Loss: ${tradeDecision.stopLoss || 'Not specified'}
- Reasoning: ${tradeDecision.reasoning}

RISK PARAMETERS:
- Risk Level: ${strategy.riskLevel}
- Max Position Size: ${strategy.maxPositionSize}%
- Stop Loss Required: ${strategy.stopLossPercent}%

PORTFOLIO STATUS:
- Total Value: $${portfolio?.totalValue || 'Unknown'}
- Available Cash: $${portfolio?.availableCash || 'Unknown'}
- Current Positions: ${portfolio?.currentPositions || 'Unknown'}

Evaluate:
1. Position size compliance
2. Stop loss adequacy
3. Portfolio concentration risk
4. Overall risk score (0-1)
5. APPROVE or VETO with reasoning`;

  const schema = {
    type: 'object',
    properties: {
      approved: { type: 'boolean' },
      riskScore: { type: 'number', minimum: 0, maximum: 1 },
      violations: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
      reasoning: { type: 'string' }
    },
    required: ['approved', 'riskScore', 'violations', 'warnings', 'recommendations', 'reasoning']
  };

  try {
    const response = await AgentLLM.riskManager(prompt, schema);
    return response.data;
  } catch (error: any) {
    console.error('[RiskManager] Error:', error.message);
    // Conservative fallback - reject on error
    return {
      approved: false,
      riskScore: 1.0,
      violations: ['Unable to assess risk due to API error'],
      warnings: ['Risk management system unavailable'],
      recommendations: ['Do not execute trade until risk system is operational'],
      reasoning: 'Vetoing trade due to risk management system failure'
    };
  }
}

// ==================== Orchestration ====================

export interface TradeSignal {
  action: "buy" | "sell" | "hold";
  symbol: string;
  confidence: number;
  reasoning: string;
  agentReports: {
    technical: TechnicalAnalysisReport;
    fundamental: FundamentalAnalysisReport;
    sentiment: SentimentAnalysisReport;
    bull: ResearchReport;
    bear: ResearchReport;
    trader: TradeDecision;
    riskManager: RiskAssessment;
  };
}

/**
 * Agent Orchestrator
 * Coordinates all agents in proper sequence
 */
export class AgentOrchestrator {
  async analyzeAndDecide(context: AgentContext): Promise<TradeSignal> {
    console.log(`[AgentOrchestrator] Starting analysis for ${context.symbol}`);

    // Phase 1: Parallel analyst execution
    console.log('[AgentOrchestrator] Phase 1: Running analysts in parallel...');
    const [technical, fundamental, sentiment] = await Promise.all([
      runTechnicalAnalyst(context),
      runFundamentalAnalyst(context),
      runSentimentAnalyst(context),
    ]);

    // Phase 2: Parallel research (bull/bear debate)
    console.log('[AgentOrchestrator] Phase 2: Running research debate...');
    const analystReports = { technical, fundamental, sentiment };
    const [bull, bear] = await Promise.all([
      runBullResearcher(context, analystReports),
      runBearResearcher(context, analystReports),
    ]);

    // Phase 3: Trader synthesis
    console.log('[AgentOrchestrator] Phase 3: Trader making final decision...');
    const trader = await runTraderAgent(context, analystReports, { bull, bear });

    // Phase 4: Risk manager veto check
    console.log('[AgentOrchestrator] Phase 4: Risk manager reviewing...');
    const riskManager = await runRiskManager(context, trader);

    // Final decision
    const finalAction = riskManager.approved ? trader.action : 'hold';
    const finalReasoning = riskManager.approved
      ? trader.reasoning
      : `Trade vetoed by risk manager: ${riskManager.reasoning}`;

    console.log(`[AgentOrchestrator] Final decision: ${finalAction} (approved: ${riskManager.approved})`);

    return {
      action: finalAction,
      symbol: context.symbol,
      confidence: riskManager.approved ? trader.confidence : 0,
      reasoning: finalReasoning,
      agentReports: {
        technical,
        fundamental,
        sentiment,
        bull,
        bear,
        trader,
        riskManager,
      },
    };
  }
}

// ==================== Fallback Analysis ====================

/**
 * Rule-based fallback when LLM is unavailable
 */
function fallbackTechnicalAnalysis(indicators: TechnicalIndicators, currentPrice: number): TechnicalAnalysisReport {
  let recommendation: 'buy' | 'sell' | 'hold' = 'hold';
  let confidence = 0.5;
  const keyPoints: string[] = [];

  // RSI analysis
  const rsiSignal = indicators.rsi < 30 ? 'oversold' : indicators.rsi > 70 ? 'overbought' : 'neutral';
  if (indicators.rsi < 30) {
    recommendation = 'buy';
    confidence += 0.1;
    keyPoints.push('RSI indicates oversold conditions');
  } else if (indicators.rsi > 70) {
    recommendation = 'sell';
    confidence += 0.1;
    keyPoints.push('RSI indicates overbought conditions');
  }

  // MACD analysis
  const macdSignal = indicators.macd.histogram > 0 ? 'bullish' : 'bearish';
  if (indicators.macd.histogram > 0 && recommendation !== 'sell') {
    recommendation = 'buy';
    confidence += 0.1;
    keyPoints.push('MACD shows bullish momentum');
  }

  // Bollinger Bands
  const bbPosition = currentPrice < indicators.bollingerBands.lower ? 'below' :
                     currentPrice > indicators.bollingerBands.upper ? 'above' : 'within';

  return {
    recommendation,
    confidence: Math.min(confidence, 1),
    signals: {
      rsi: { value: indicators.rsi, signal: rsiSignal },
      macd: { signal: macdSignal },
      bollingerBands: { position: bbPosition, signal: 'Fallback analysis' },
      movingAverages: { trend: indicators.ema12 > indicators.ema26 ? 'bullish' : 'bearish' }
    },
    reasoning: 'Using rule-based fallback analysis due to LLM unavailability',
    keyPoints
  };
}

