import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Bot, CheckCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function RiskAlerts() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: alerts, isLoading, refetch } = trpc.risk.alerts.useQuery();

  const acknowledgeAlert = trpc.risk.acknowledgeAlert.useMutation({
    onSuccess: () => {
      toast.success("Alert acknowledged");
      refetch();
    },
  });

  if (!user) {
    setLocation("/");
    return null;
  }

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
                <a className="text-sm font-medium text-muted-foreground hover:text-foreground">Positions</a>
              </Link>
              <Link href="/alerts">
                <a className="text-sm font-medium text-foreground">Alerts</a>
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

      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Alerts ({alerts?.length || 0} unacknowledged)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8">Loading...</p>
            ) : alerts && alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg ${
                      alert.severity === "critical"
                        ? "border-red-500/50 bg-red-500/5"
                        : alert.severity === "high"
                        ? "border-orange-500/50 bg-orange-500/5"
                        : "border-yellow-500/50 bg-yellow-500/5"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold capitalize">{alert.alertType.replace(/_/g, " ")}</span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              alert.severity === "critical"
                                ? "bg-red-500/20 text-red-600"
                                : alert.severity === "high"
                                ? "bg-orange-500/20 text-orange-600"
                                : "bg-yellow-500/20 text-yellow-600"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(alert.createdAt!).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeAlert.mutate({ id: alert.id })}
                        disabled={acknowledgeAlert.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Alerts</h3>
                <p className="text-muted-foreground">All risk alerts have been acknowledged.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
