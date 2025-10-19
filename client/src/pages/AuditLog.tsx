import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bot, FileText } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function AuditLog() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: logs, isLoading } = trpc.audit.logs.useQuery({ limit: 100 });

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
                <a className="text-sm font-medium text-muted-foreground hover:text-foreground">Alerts</a>
              </Link>
              <Link href="/audit">
                <a className="text-sm font-medium text-foreground">Audit Log</a>
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
              <FileText className="h-5 w-5" />
              Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8">Loading...</p>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium capitalize">{log.eventType.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt!).toLocaleString()}
                      </span>
                    </div>
                    {log.eventData && (
                      <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.eventData, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No audit logs</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
