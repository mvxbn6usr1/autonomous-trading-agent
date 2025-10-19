import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Bot, Play, Square, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";

export default function StrategyDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/strategy/:id");
  const [, setLocation] = useLocation();
  const strategyId = params?.id || "";

  const [symbol, setSymbol] = useState("BTC");
  const [accountValue, setAccountValue] = useState(100000);

  const { data: strategy, isLoading, refetch } = trpc.strategies.get.useQuery({ id: strategyId });
  const { data: positions } = trpc.trading.strategyPositions.useQuery({ strategyId });
  const { data: decisions } = trpc.agents.decisions.useQuery({ strategyId, limit: 10 });
  const { data: alerts } = trpc.risk.strategyAlerts.useQuery({ strategyId });

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

  const manualTrade = trpc.trading.manualTrade.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        refetch();
      } else {
        toast.error(data.message);
      }
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

  const handleManualBuy = () => {
    manualTrade.mutate({ strategyId, symbol, action: "buy", accountValue });
  };

  const handleManualSell = () => {
    manualTrade.mutate({ strategyId, symbol, action: "sell", accountValue });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <a className="flex items-center gap-2">
                <Bot className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold">Trading Dashboard</span>
              </a>
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-xl font-semibold">{strategy.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {strategy.isActive ? (
              <Button variant="destructive" onClick={handleStop} disabled={stopStrategy.isPending}>
                <Square className="h-4 w-4 mr-2" />
                Stop Strategy
              </Button>
            ) : (
              <Button onClick={handleStart} disabled={startStrategy.isPending}>
                <Play className="h-4 w-4 mr-2" />
                Start Strategy
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container py-8 space-y-8">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                  <p className="font-medium capitalize">{strategy.riskLevel}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">{strategy.isActive ? "Active" : "Inactive"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Position Size</p>
                  <p className="font-medium">{strategy.maxPositionSize}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Daily Loss Limit</p>
                  <p className="font-medium">{strategy.dailyLossLimit}%</p>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="symbol">Trading Symbol</Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="BTC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountValue">Account Value ($)</Label>
                <Input
                  id="accountValue"
                  type="number"
                  value={accountValue}
                  onChange={(e) => setAccountValue(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual Trading</CardTitle>
              <CardDescription>Execute manual trades for testing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleManualBuy} disabled={manualTrade.isPending}>
                  Buy {symbol}
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={handleManualSell}
                  disabled={manualTrade.isPending}
                >
                  Sell {symbol}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Manual trades are subject to the same risk checks as automated trades.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            {positions && positions.length > 0 ? (
              <div className="space-y-2">
                {positions.map((pos) => (
                  <div key={pos.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{pos.symbol}</p>
                      <p className="text-sm text-muted-foreground">
                        {pos.side === "long" ? "Long" : "Short"} {pos.quantity} @ ${pos.entryPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${pos.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {pos.unrealizedPnL >= 0 ? "+" : ""}${pos.unrealizedPnL.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {pos.unrealizedPnLPercent >= 0 ? "+" : ""}
                        {pos.unrealizedPnLPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No open positions</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Agent Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            {decisions && decisions.length > 0 ? (
              <div className="space-y-3">
                {decisions.map((decision) => (
                  <div key={decision.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium capitalize">{decision.agentType.replace("_", " ")}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(decision.createdAt!).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold uppercase">{decision.recommendation}</span>
                      <span className="text-xs text-muted-foreground">Confidence: {decision.confidence}%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{decision.reasoning}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No decisions yet</p>
            )}
          </CardContent>
        </Card>

        {alerts && alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Risk Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="p-3 border rounded-lg border-yellow-500/50 bg-yellow-500/5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium capitalize">{alert.alertType.replace("_", " ")}</p>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        alert.severity === "critical"
                          ? "bg-red-500/20 text-red-600"
                          : alert.severity === "high"
                          ? "bg-orange-500/20 text-orange-600"
                          : "bg-yellow-500/20 text-yellow-600"
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
