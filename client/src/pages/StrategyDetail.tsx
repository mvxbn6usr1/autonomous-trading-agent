import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentAnalysis } from "@/components/AgentAnalysis";
import { trpc } from "@/lib/trpc";
import { Bot, Play, Square, TrendingUp, Activity, AlertTriangle, History, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";

export default function StrategyDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/strategy/:id");
  const [, setLocation] = useLocation();
  const strategyId = params?.id || "";

  const [symbol, setSymbol] = useState("AAPL");
  const [accountValue, setAccountValue] = useState(100000);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null);

  const { data: strategy, isLoading, refetch } = trpc.strategies.get.useQuery({ id: strategyId });
  const { data: positions } = trpc.trading.strategyPositions.useQuery({ strategyId });
  const { data: decisions } = trpc.agents.decisions.useQuery({ strategyId, limit: 10 });
  const { data: alerts } = trpc.risk.strategyAlerts.useQuery({ strategyId });
  // const { data: performance } = trpc.strategies.performance.useQuery({ strategyId });

  const startStrategy = trpc.strategies.start.useMutation({
    onSuccess: () => {
      toast.success("Strategy started");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to start: ${error.message}`);
    },
  });

  const stopStrategy = trpc.strategies.stop.useMutation({
    onSuccess: () => {
      toast.success("Strategy stopped");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to stop: ${error.message}`);
    },
  });

  const runAnalysis = trpc.analysis.run.useMutation({
    onSuccess: (data) => {
      setIsAnalyzing(false);
      if (data.success) {
        toast.success("Analysis complete!");
        setLatestAnalysis(data);
        refetch();
      }
    },
    onError: (error) => {
      setIsAnalyzing(false);
      toast.error(`Analysis failed: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Strategy Not Found</h2>
          <Button onClick={() => setLocation("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const handleStart = () => {
    startStrategy.mutate({ id: strategyId, symbol, accountValue });
  };

  const handleStop = () => {
    stopStrategy.mutate({ id: strategyId });
  };

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    runAnalysis.mutate({ strategyId, symbol });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Bot className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold">Trading Dashboard</span>
              </a>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={() => setLocation("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Strategy Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{strategy.name}</h1>
              <p className="text-muted-foreground">{strategy.description}</p>
            </div>
            <Badge variant={strategy.isActive ? "default" : "secondary"} className="text-lg px-4 py-1">
              {strategy.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Risk Level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{strategy.riskLevel}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Max Position</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{strategy.maxPositionSize}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Daily Loss Limit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{strategy.dailyLossLimit}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Created</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-lg">
                  {strategy.createdAt ? new Date(strategy.createdAt).toLocaleDateString() : "N/A"}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Control Panel */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Strategy Controls</CardTitle>
            <CardDescription>Configure and control your trading strategy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="symbol">Trading Symbol</Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AAPL, TSLA, BTC, etc."
                />
              </div>
              <div>
                <Label htmlFor="accountValue">Account Value ($)</Label>
                <Input
                  id="accountValue"
                  type="number"
                  value={accountValue}
                  onChange={(e) => setAccountValue(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex gap-2">
              {!strategy.isActive ? (
                <Button onClick={handleStart} disabled={startStrategy.isPending} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  {startStrategy.isPending ? "Starting..." : "Start Strategy"}
                </Button>
              ) : (
                <Button onClick={handleStop} disabled={stopStrategy.isPending} variant="destructive" className="flex-1">
                  <Square className="h-4 w-4 mr-2" />
                  {stopStrategy.isPending ? "Stopping..." : "Stop Strategy"}
                </Button>
              )}
              
              <Button 
                onClick={handleRunAnalysis} 
                disabled={isAnalyzing || !symbol} 
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
                {isAnalyzing ? "Analyzing..." : "Run Analysis"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different views */}
        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="analysis">
              <Activity className="h-4 w-4 mr-2" />
              AI Analysis
            </TabsTrigger>
            <TabsTrigger value="positions">
              <TrendingUp className="h-4 w-4 mr-2" />
              Positions ({positions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts ({alerts?.filter(a => !a.acknowledged).length || 0})
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              Decision History
            </TabsTrigger>
          </TabsList>

          {/* AI Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4">
            {latestAnalysis ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Latest Analysis for {symbol}</CardTitle>
                    <CardDescription>
                      Current Price: ${latestAnalysis.marketData.price.toFixed(2)}
                    </CardDescription>
                  </CardHeader>
                </Card>
                <AgentAnalysis 
                  reports={latestAnalysis.decision.agentReports}
                  finalDecision={{
                    action: latestAnalysis.decision.action,
                    confidence: latestAnalysis.decision.confidence,
                    reasoning: latestAnalysis.decision.reasoning,
                  }}
                />
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Run an analysis to see AI agent recommendations for {symbol}
                  </p>
                  <Button onClick={handleRunAnalysis} disabled={isAnalyzing || !symbol}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    {isAnalyzing ? "Analyzing..." : "Run Analysis Now"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions" className="space-y-4">
            {positions && positions.length > 0 ? (
              <div className="grid gap-4">
                {positions.map((position) => (
                  <Card key={position.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{position.symbol}</CardTitle>
                        <Badge variant="default">
                          Open
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Side</div>
                          <div className="font-medium capitalize">{position.side}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Quantity</div>
                          <div className="font-medium">{position.quantity}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Entry Price</div>
                          <div className="font-medium">${position.entryPrice.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Unrealized P&L</div>
                          <div className={`font-medium ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${position.unrealizedPnL.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Open Positions</h3>
                  <p className="text-muted-foreground">
                    Start the strategy to begin trading
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            {alerts && alerts.length > 0 ? (
              <div className="grid gap-4">
                {alerts.map((alert) => (
                  <Card key={alert.id} className={!alert.acknowledged ? "border-yellow-500/50" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg capitalize">{alert.alertType.replace('_', ' ')}</CardTitle>
                        <Badge variant={alert.severity === "critical" ? "destructive" : "default"}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                      <div className="text-xs text-muted-foreground">
                        {new Date(alert.createdAt!).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Alerts</h3>
                  <p className="text-muted-foreground">
                    All systems operating normally
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Decision History Tab */}
          <TabsContent value="history" className="space-y-4">
            {decisions && decisions.length > 0 ? (
              <div className="grid gap-4">
                {decisions.map((decision) => {
                  const metrics = decision.metrics ? (typeof decision.metrics === 'string' ? JSON.parse(decision.metrics) : decision.metrics) : null;
                  return (
                    <Card key={decision.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{decision.symbol}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {decision.recommendation.replace('_', ' ')}
                            </Badge>
                            <Badge variant="secondary">
                              {decision.confidence}% confidence
                            </Badge>
                          </div>
                        </div>
                        <CardDescription>
                          {new Date(decision.createdAt!).toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">{decision.reasoning}</p>
                        {metrics && metrics.marketData && (
                          <div className="text-xs text-muted-foreground">
                            Price: ${metrics.marketData.price.toFixed(2)}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Decision History</h3>
                  <p className="text-muted-foreground">
                    Run an analysis to start building decision history
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Performance Metrics */}
        {false && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Strategy performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {[].map((metric: any) => (
                  <div key={metric.id} className="space-y-1">
                    <div className="text-sm text-muted-foreground">
                      {new Date(metric.date).toLocaleDateString()}
                    </div>
                    <div className="text-lg font-bold">
                      ${(metric.totalValue / 100).toFixed(2)}
                    </div>
                    <div className={`text-sm ${metric.dailyReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(metric.dailyReturn / 100).toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

