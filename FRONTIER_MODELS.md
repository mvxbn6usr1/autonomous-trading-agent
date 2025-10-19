# Frontier Models for Autonomous Trading Agent

Based on OpenRouter research (October 2025), here are the current frontier models to use:

## Primary Models for Trading Agents

### 1. DeepSeek V3.1 (RECOMMENDED - Current Alpha Arena Leader)
- **Model ID**: `deepseek/deepseek-chat-v3.1`
- **Context**: 163,840 tokens
- **Pricing**: $0.20/M input, $0.80/M output
- **Capabilities**: 
  - Hybrid reasoning model (671B parameters, 37B active)
  - Supports thinking and non-thinking modes
  - Excellent for tool use, code generation, reasoning
  - Fast response times
  - Structured tool calling support
- **Use for**: Trader Agent (final decisions), Risk Manager Agent

### 2. Claude Sonnet 4.5
- **Model ID**: `anthropic/claude-sonnet-4.5`
- **Context**: 200K tokens
- **Pricing**: $3/M input, $15/M output
- **Capabilities**:
  - Most advanced Sonnet model
  - Optimized for real-world agents and coding
  - Extended thinking capability
  - Tool-assisted workflows
  - >73% on SWE-bench Verified
- **Use for**: Technical Analyst, Fundamental Analyst

### 3. Claude Haiku 4.5
- **Model ID**: `anthropic/claude-haiku-4.5`
- **Context**: 200K tokens
- **Pricing**: $1/M input, $5/M output
- **Capabilities**:
  - Fastest and most efficient
  - Near-frontier intelligence at low cost
  - Extended thinking support
  - Excellent for sub-agents and parallel execution
- **Use for**: Sentiment Analyst, Bull/Bear Researchers (fast parallel analysis)

### 4. Gemini 2.5 Flash Preview
- **Model ID**: `google/gemini-2.5-flash-preview`
- **Context**: Variable (check current)
- **Capabilities**:
  - State-of-the-art workhorse model
  - Advanced reasoning and coding
  - Fast response times
- **Use for**: Alternative for fast analysis tasks

### 5. GPT-5 Image (for multimodal)
- **Model ID**: `openai/gpt-5-image`
- **Context**: 400K tokens
- **Pricing**: $10/M input, $10/M output
- **Capabilities**:
  - Advanced language + image generation
  - Multimodal analysis
- **Use for**: Chart analysis (if implementing visual candlestick analysis)

## Agent Assignment Strategy

### Fast Parallel Analysis (Haiku 4.5)
- Sentiment Analyst
- Bull Researcher  
- Bear Researcher
- News Analyst

### Deep Reasoning (Sonnet 4.5)
- Technical Analyst
- Fundamental Analyst

### Final Decision Making (DeepSeek V3.1)
- Trader Agent (synthesizes all inputs)
- Risk Manager Agent (veto authority)

## Cost Optimization

For 100 trading decisions per day with ~5 agents per decision:

**Using DeepSeek V3.1 for all agents:**
- Input: ~2000 tokens/agent × 5 agents × 100 decisions = 1M tokens = $0.20
- Output: ~500 tokens/agent × 5 agents × 100 decisions = 250K tokens = $0.20
- **Daily cost: ~$0.40**

**Using Mixed Strategy (Haiku for 3 agents, Sonnet for 2, DeepSeek for trader):**
- Haiku (3 agents): ~$0.30/day
- Sonnet (2 agents): ~$0.90/day  
- DeepSeek (trader): ~$0.08/day
- **Daily cost: ~$1.28** (better quality)

## Implementation Notes

1. **Structured Outputs**: All models support JSON mode for structured responses
2. **Thinking Mode**: DeepSeek V3.1 and Claude 4.5 support extended thinking
3. **Tool Calling**: All models support function/tool calling
4. **Rate Limits**: OpenRouter handles routing and fallbacks automatically
5. **Context Windows**: All have sufficient context for trading analysis

## Model IDs for Implementation

```typescript
const MODELS = {
  TRADER: 'deepseek/deepseek-chat-v3.1',
  RISK_MANAGER: 'deepseek/deepseek-chat-v3.1',
  TECHNICAL_ANALYST: 'anthropic/claude-sonnet-4.5',
  FUNDAMENTAL_ANALYST: 'anthropic/claude-sonnet-4.5',
  SENTIMENT_ANALYST: 'anthropic/claude-haiku-4.5',
  BULL_RESEARCHER: 'anthropic/claude-haiku-4.5',
  BEAR_RESEARCHER: 'anthropic/claude-haiku-4.5',
};
```

## Testing Strategy

1. Start with DeepSeek V3.1 for all agents (cheapest)
2. Test agent coordination and consensus
3. Upgrade to mixed strategy for better quality
4. Monitor costs and adjust based on performance

