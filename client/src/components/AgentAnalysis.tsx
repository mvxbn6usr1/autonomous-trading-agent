/**
 * Agent Analysis Display Component
 * Shows the detailed analysis from all 7 AI agents
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Smile, 
  Shield, 
  Brain 
} from "lucide-react";

interface AgentReport {
  technical?: {
    recommendation: string;
    confidence: number;
    reasoning: string;
    keyPoints: string[];
  };
  fundamental?: {
    recommendation: string;
    confidence: number;
    valuation: string;
    reasoning: string;
    keyPoints?: string[];
  };
  sentiment?: {
    recommendation: string;
    confidence: number;
    sentiment: string;
    score: number;
    reasoning: string;
  };
  bull?: {
    strength: number;
    arguments: string[];
    conclusion: string;
  };
  bear?: {
    strength: number;
    arguments: string[];
    conclusion: string;
  };
  trader?: {
    action: string;
    confidence: number;
    synthesis: string;
    riskAssessment: string;
    targetPrice?: number;
    stopLoss?: number;
    positionSize?: number;
  };
  riskManager?: {
    approved: boolean;
    riskScore: number;
    reasoning: string;
    violations: string[];
    warnings: string[];
    recommendations?: string[];
  };
}

interface AgentAnalysisProps {
  reports: AgentReport;
  finalDecision: {
    action: string;
    confidence: number;
    reasoning: string;
  };
}

export function AgentAnalysis({ reports, finalDecision }: AgentAnalysisProps) {
  const getRecommendationColor = (rec: string) => {
    switch (rec.toLowerCase()) {
      case 'buy':
      case 'bullish':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'sell':
      case 'bearish':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-400';
    if (confidence >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Final Decision */}
      <Card className="border-2 border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Final Trading Decision
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Badge className={`text-lg px-4 py-1 ${getRecommendationColor(finalDecision.action)}`}>
                {finalDecision.action.toUpperCase()}
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Confidence</div>
              <div className={`text-2xl font-bold ${getConfidenceColor(finalDecision.confidence)}`}>
                {(finalDecision.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <Progress value={finalDecision.confidence * 100} className="h-2" />
          <p className="text-sm text-muted-foreground">{finalDecision.reasoning}</p>
        </CardContent>
      </Card>

      {/* Technical Analyst */}
      {reports.technical && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Technical Analyst
            </CardTitle>
            <CardDescription>Chart patterns and technical indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge className={getRecommendationColor(reports.technical.recommendation)}>
                {reports.technical.recommendation.toUpperCase()}
              </Badge>
              <span className={`text-sm font-medium ${getConfidenceColor(reports.technical.confidence)}`}>
                {(reports.technical.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{reports.technical.reasoning}</p>
            {reports.technical.keyPoints && reports.technical.keyPoints.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium">Key Points:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {reports.technical.keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fundamental Analyst */}
      {reports.fundamental && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              Fundamental Analyst
            </CardTitle>
            <CardDescription>Company fundamentals and valuation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Badge className={getRecommendationColor(reports.fundamental.recommendation)}>
                  {reports.fundamental.recommendation.toUpperCase()}
                </Badge>
                <Badge variant="outline">{reports.fundamental.valuation}</Badge>
              </div>
              <span className={`text-sm font-medium ${getConfidenceColor(reports.fundamental.confidence)}`}>
                {(reports.fundamental.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{reports.fundamental.reasoning}</p>
            {reports.fundamental.keyPoints && reports.fundamental.keyPoints.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium">Key Points:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {reports.fundamental.keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sentiment Analyst */}
      {reports.sentiment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smile className="h-5 w-5 text-purple-400" />
              Sentiment Analyst
            </CardTitle>
            <CardDescription>Market sentiment and news analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Badge className={getRecommendationColor(reports.sentiment.recommendation)}>
                  {reports.sentiment.recommendation.toUpperCase()}
                </Badge>
                <Badge variant="outline">{reports.sentiment.sentiment}</Badge>
              </div>
              <span className={`text-sm font-medium ${getConfidenceColor(reports.sentiment.confidence)}`}>
                {(reports.sentiment.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sentiment Score:</span>
              <Progress value={(reports.sentiment.score + 1) * 50} className="h-2 flex-1" />
              <span className="text-sm font-medium">{reports.sentiment.score.toFixed(2)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{reports.sentiment.reasoning}</p>
          </CardContent>
        </Card>
      )}

      {/* Bull vs Bear Research */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bull Case */}
        {reports.bull && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Bull Case
              </CardTitle>
              <CardDescription>Reasons to buy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Strength</span>
                  <span className="text-sm font-medium text-green-400">
                    {(reports.bull.strength * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={reports.bull.strength * 100} className="h-2" />
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {reports.bull.arguments.map((arg, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-green-400">+</span>
                    <span>{arg}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground italic">{reports.bull.conclusion}</p>
            </CardContent>
          </Card>
        )}

        {/* Bear Case */}
        {reports.bear && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-400" />
                Bear Case
              </CardTitle>
              <CardDescription>Reasons to sell</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Strength</span>
                  <span className="text-sm font-medium text-red-400">
                    {(reports.bear.strength * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={reports.bear.strength * 100} className="h-2" />
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {reports.bear.arguments.map((arg, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-red-400">-</span>
                    <span>{arg}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground italic">{reports.bear.conclusion}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Trader Synthesis */}
      {reports.trader && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-cyan-400" />
              Trader Agent
            </CardTitle>
            <CardDescription>Synthesis and execution plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge className={getRecommendationColor(reports.trader.action)}>
                {reports.trader.action.toUpperCase()}
              </Badge>
              <span className={`text-sm font-medium ${getConfidenceColor(reports.trader.confidence)}`}>
                {(reports.trader.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {reports.trader.targetPrice && (
                <div>
                  <div className="text-muted-foreground">Target Price</div>
                  <div className="font-medium text-green-400">${reports.trader.targetPrice.toFixed(2)}</div>
                </div>
              )}
              {reports.trader.stopLoss && (
                <div>
                  <div className="text-muted-foreground">Stop Loss</div>
                  <div className="font-medium text-red-400">${reports.trader.stopLoss.toFixed(2)}</div>
                </div>
              )}
              {reports.trader.positionSize && (
                <div>
                  <div className="text-muted-foreground">Position Size</div>
                  <div className="font-medium">{reports.trader.positionSize}%</div>
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Synthesis:</div>
              <p className="text-sm text-muted-foreground">{reports.trader.synthesis}</p>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Risk Assessment:</div>
              <p className="text-sm text-muted-foreground">{reports.trader.riskAssessment}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Manager */}
      {reports.riskManager && (
        <Card className={reports.riskManager.approved ? 'border-green-500/50' : 'border-red-500/50'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-400" />
              Risk Manager
            </CardTitle>
            <CardDescription>Risk assessment and approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge className={reports.riskManager.approved ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}>
                {reports.riskManager.approved ? '✓ APPROVED' : '✗ VETOED'}
              </Badge>
              <span className="text-sm font-medium">
                Risk Score: <span className={getConfidenceColor(1 - reports.riskManager.riskScore)}>
                  {(reports.riskManager.riskScore * 100).toFixed(0)}%
                </span>
              </span>
            </div>
            <Progress value={reports.riskManager.riskScore * 100} className="h-2" />
            <p className="text-sm text-muted-foreground">{reports.riskManager.reasoning}</p>
            
            {reports.riskManager.violations.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-red-400">Violations:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {reports.riskManager.violations.map((violation, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-red-400">✗</span>
                      <span>{violation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {reports.riskManager.warnings.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-yellow-400">Warnings:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {reports.riskManager.warnings.map((warning, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-yellow-400">⚠</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

