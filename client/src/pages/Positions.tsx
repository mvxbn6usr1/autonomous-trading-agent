import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bot } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Positions() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: positions, isLoading } = trpc.trading.positions.useQuery();

  if (!user) {
    setLocation("/");
    return null;
  }

  const openPositions = positions?.filter((p) => p.status === "open") || [];
  const closedPositions = positions?.filter((p) => p.status === "closed") || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/dashboard">
              <a className="flex items-center gap-2">
                <Bot className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold">Trading Dashboard</h1>
              </a>
            </Link>
            <nav className="flex gap-4">
              <Link href="/dashboard">
                <a className="text-sm font-medium text-muted-foreground hover:text-foreground">Strategies</a>
              </Link>
              <Link href="/positions">
                <a className="text-sm font-medium text-foreground">Positions</a>
              </Link>
              <Link href="/alerts">
                <a className="text-sm font-medium text-muted-foreground hover:text-foreground">Alerts</a>
              </Link>
              <Link href="/audit">
                <a className="text-sm font-medium text-muted-foreground hover:text-foreground">Audit Log</a>
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Open Positions ({openPositions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8">Loading...</p>
            ) : openPositions.length > 0 ? (
              <div className="space-y-3">
                {openPositions.map((pos) => (
                  <div key={pos.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{pos.symbol}</h3>
                        <p className="text-sm text-muted-foreground">
                          {pos.side === "long" ? "Long" : "Short"} {pos.quantity} shares
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Entry: ${pos.entryPrice.toFixed(2)} | Current: ${pos.currentPrice.toFixed(2)}
                        </p>
                        {pos.stopLoss && (
                          <p className="text-sm text-muted-foreground">Stop Loss: ${pos.stopLoss.toFixed(2)}</p>
                        )}
                        {pos.takeProfit && (
                          <p className="text-sm text-muted-foreground">Take Profit: ${pos.takeProfit.toFixed(2)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${pos.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {pos.unrealizedPnL >= 0 ? "+" : ""}${pos.unrealizedPnL.toFixed(2)}
                        </p>
                        <p className={`text-sm ${pos.unrealizedPnLPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {pos.unrealizedPnLPercent >= 0 ? "+" : ""}
                          {pos.unrealizedPnLPercent.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Opened {new Date(pos.openedAt!).toLocaleString()}
                        </p>
                      </div>
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
            <CardTitle>Closed Positions ({closedPositions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {closedPositions.length > 0 ? (
              <div className="space-y-3">
                {closedPositions.slice(0, 20).map((pos) => (
                  <div key={pos.id} className="p-4 border rounded-lg opacity-75">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{pos.symbol}</h3>
                        <p className="text-sm text-muted-foreground">
                          {pos.side === "long" ? "Long" : "Short"} {pos.quantity} shares
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Entry: ${pos.entryPrice.toFixed(2)} | Exit: ${pos.currentPrice.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${pos.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {pos.unrealizedPnL >= 0 ? "+" : ""}${pos.unrealizedPnL.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Closed {pos.closedAt ? new Date(pos.closedAt).toLocaleString() : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No closed positions</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
