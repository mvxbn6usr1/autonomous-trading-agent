import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, Bot, Plus, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    riskLevel: "medium" as "low" | "medium" | "high",
    maxPositionSize: 2,
    dailyLossLimit: 10,
  });

  const { data: strategies, isLoading, refetch } = trpc.strategies.list.useQuery();
  const { data: positions } = trpc.trading.positions.useQuery();
  const { data: alerts } = trpc.risk.alerts.useQuery();

  const createStrategy = trpc.strategies.create.useMutation({
    onSuccess: () => {
      toast.success("Strategy created successfully");
      refetch();
      setDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        riskLevel: "medium",
        maxPositionSize: 2,
        dailyLossLimit: 10,
      });
    },
    onError: (error) => {
      toast.error(`Failed to create strategy: ${error.message}`);
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    setLocation("/");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createStrategy.mutate(formData);
  };

  const totalUnrealizedPnL = positions?.reduce((sum, pos) => sum + pos.unrealizedPnL, 0) || 0;
  const openPositionsCount = positions?.filter((p) => p.status === "open").length || 0;
  const unacknowledgedAlertsCount = alerts?.length || 0;

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
                <a className="text-sm font-medium text-foreground">Strategies</a>
              </Link>
              <Link href="/positions">
                <a className="text-sm font-medium text-muted-foreground hover:text-foreground">Positions</a>
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
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Strategies</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{strategies?.filter((s) => s.isActive).length || 0}</div>
              <p className="text-xs text-muted-foreground">of {strategies?.length || 0} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openPositionsCount}</div>
              <p className={`text-xs ${totalUnrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalUnrealizedPnL >= 0 ? "+" : ""}${totalUnrealizedPnL.toFixed(2)} unrealized
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risk Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unacknowledgedAlertsCount}</div>
              <p className="text-xs text-muted-foreground">unacknowledged</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Trading Strategies</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Strategy
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Create New Strategy</DialogTitle>
                    <DialogDescription>Configure your autonomous trading strategy parameters.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Strategy Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My Trading Strategy"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Strategy description..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="riskLevel">Risk Level</Label>
                      <Select
                        value={formData.riskLevel}
                        onValueChange={(value: "low" | "medium" | "high") =>
                          setFormData({ ...formData, riskLevel: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="maxPositionSize">Max Position Size (%)</Label>
                      <Input
                        id="maxPositionSize"
                        type="number"
                        min="1"
                        max="10"
                        value={formData.maxPositionSize}
                        onChange={(e) => setFormData({ ...formData, maxPositionSize: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Maximum % of portfolio per position (1-10%)</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dailyLossLimit">Daily Loss Limit (%)</Label>
                      <Input
                        id="dailyLossLimit"
                        type="number"
                        min="5"
                        max="50"
                        value={formData.dailyLossLimit}
                        onChange={(e) => setFormData({ ...formData, dailyLossLimit: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Trading halts at this loss % (5-50%)</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createStrategy.isPending}>
                      {createStrategy.isPending ? "Creating..." : "Create Strategy"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {strategies && strategies.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {strategies.map((strategy) => (
                <Link key={strategy.id} href={`/strategy/${strategy.id}`}>
                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{strategy.name}</CardTitle>
                          <CardDescription className="mt-2">{strategy.description || "No description"}</CardDescription>
                        </div>
                        {strategy.isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                            <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
                            Active
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Risk Level</p>
                          <p className="font-medium capitalize">{strategy.riskLevel}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Max Position</p>
                          <p className="font-medium">{strategy.maxPositionSize}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Loss Limit</p>
                          <p className="font-medium">{strategy.dailyLossLimit}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Created</p>
                          <p className="font-medium">{new Date(strategy.createdAt!).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Strategies Yet</h3>
                <p className="text-muted-foreground mb-4">Create your first trading strategy to get started.</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Strategy
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
