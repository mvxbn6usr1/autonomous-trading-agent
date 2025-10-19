/**
 * OpenRouter LLM Service
 * Provides access to frontier models with structured outputs
 */

import axios from 'axios';

const OPENROUTER_API_KEY = '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';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StructuredOutput<T> {
  data: T;
  raw: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Frontier model configurations
 */
export const MODELS = {
  // DeepSeek V3.1 - Best for final decisions and risk management
  TRADER: 'deepseek/deepseek-chat-v3.1',
  RISK_MANAGER: 'deepseek/deepseek-chat-v3.1',
  
  // Claude Sonnet 4.5 - Best for deep analysis
  TECHNICAL_ANALYST: 'anthropic/claude-sonnet-4.5',
  FUNDAMENTAL_ANALYST: 'anthropic/claude-sonnet-4.5',
  
  // Claude Haiku 4.5 - Best for fast parallel analysis
  SENTIMENT_ANALYST: 'anthropic/claude-haiku-4.5',
  BULL_RESEARCHER: 'anthropic/claude-haiku-4.5',
  BEAR_RESEARCHER: 'anthropic/claude-haiku-4.5',
};

/**
 * Call OpenRouter API with structured JSON output
 */
export async function callLLM(
  messages: Message[],
  model: string,
  temperature: number = 0.7
): Promise<LLMResponse> {
  try {
    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model,
        messages,
        temperature,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://autonomous-trading-agent.manus.app',
          'X-Title': 'Autonomous Trading Agent',
        },
      }
    );

    const choice = response.data.choices[0];
    const usage = response.data.usage;

    return {
      content: choice.message.content,
      model: response.data.model,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    };
  } catch (error: any) {
    console.error('[OpenRouter] API Error:', error.response?.data || error.message);
    throw new Error(`OpenRouter API failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Call LLM with structured output parsing
 */
export async function callLLMStructured<T>(
  messages: Message[],
  model: string,
  schema: any,
  temperature: number = 0.7
): Promise<StructuredOutput<T>> {
  // Add schema instruction to system message
  const enhancedMessages = [...messages];
  if (enhancedMessages[0]?.role === 'system') {
    enhancedMessages[0].content += `\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;
  } else {
    enhancedMessages.unshift({
      role: 'system',
      content: `You MUST respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`,
    });
  }

  const response = await callLLM(enhancedMessages, model, temperature);

  try {
    // Extract JSON from response, handling various formats
    let content = response.content.trim();
    
    // Try to extract JSON from markdown code blocks
    const markdownMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (markdownMatch) {
      content = markdownMatch[1].trim();
    } else {
      // Try to find JSON object boundaries
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0].trim();
      }
    }
    
    const data = JSON.parse(content);
    return {
      data,
      raw: response.content,
      model: response.model,
      usage: response.usage,
    };
  } catch (error) {
    console.error('[OpenRouter] JSON Parse Error:', response.content);
    throw new Error('Failed to parse LLM response as JSON');
  }
}

/**
 * Agent-specific LLM calls with optimized models
 */
export const AgentLLM = {
  /**
   * Technical Analyst - Uses Claude Sonnet 4.5 for deep analysis
   */
  async technicalAnalyst(prompt: string, schema: any): Promise<StructuredOutput<any>> {
    return callLLMStructured(
      [
        {
          role: 'system',
          content: 'You are an expert technical analyst. Analyze price charts, technical indicators, and market patterns to provide trading insights.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      MODELS.TECHNICAL_ANALYST,
      schema,
      0.3 // Lower temperature for more consistent analysis
    );
  },

  /**
   * Fundamental Analyst - Uses Claude Sonnet 4.5 for deep analysis
   */
  async fundamentalAnalyst(prompt: string, schema: any): Promise<StructuredOutput<any>> {
    return callLLMStructured(
      [
        {
          role: 'system',
          content: 'You are an expert fundamental analyst. Evaluate company financials, market conditions, and economic indicators to assess investment value.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      MODELS.FUNDAMENTAL_ANALYST,
      schema,
      0.3
    );
  },

  /**
   * Sentiment Analyst - Uses Claude Haiku 4.5 for fast analysis
   */
  async sentimentAnalyst(prompt: string, schema: any): Promise<StructuredOutput<any>> {
    return callLLMStructured(
      [
        {
          role: 'system',
          content: 'You are an expert sentiment analyst. Analyze market sentiment, news, and social media to gauge investor psychology and market mood.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      MODELS.SENTIMENT_ANALYST,
      schema,
      0.5
    );
  },

  /**
   * Bull Researcher - Uses Claude Haiku 4.5 for fast analysis
   */
  async bullResearcher(prompt: string, schema: any): Promise<StructuredOutput<any>> {
    return callLLMStructured(
      [
        {
          role: 'system',
          content: 'You are a bull researcher. Your job is to find and present the strongest bullish arguments for the trade. Be optimistic but evidence-based.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      MODELS.BULL_RESEARCHER,
      schema,
      0.6
    );
  },

  /**
   * Bear Researcher - Uses Claude Haiku 4.5 for fast analysis
   */
  async bearResearcher(prompt: string, schema: any): Promise<StructuredOutput<any>> {
    return callLLMStructured(
      [
        {
          role: 'system',
          content: 'You are a bear researcher. Your job is to find and present the strongest bearish arguments against the trade. Be skeptical but evidence-based.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      MODELS.BEAR_RESEARCHER,
      schema,
      0.6
    );
  },

  /**
   * Trader Agent - Uses DeepSeek V3.1 for final decisions
   */
  async trader(prompt: string, schema: any): Promise<StructuredOutput<any>> {
    return callLLMStructured(
      [
        {
          role: 'system',
          content: 'You are an expert trader. Synthesize all analyst reports and research to make final trading decisions. Consider risk, opportunity, and market conditions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      MODELS.TRADER,
      schema,
      0.4 // Balanced temperature for decision-making
    );
  },

  /**
   * Risk Manager - Uses DeepSeek V3.1 for risk assessment
   */
  async riskManager(prompt: string, schema: any): Promise<StructuredOutput<any>> {
    return callLLMStructured(
      [
        {
          role: 'system',
          content: 'You are a risk manager with veto authority. Evaluate trades for risk compliance, position limits, and portfolio safety. Reject trades that violate risk parameters.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      MODELS.RISK_MANAGER,
      schema,
      0.2 // Very low temperature for consistent risk assessment
    );
  },
};

