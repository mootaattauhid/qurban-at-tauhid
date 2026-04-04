import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Beef, Users, Ticket, Wallet, Clock } from "lucide-react";
import { formatRupiah } from "@/lib/qurban-utils";
import { useEffect, useState } from "react";

function CountdownCard() {
  const targetDate = new Date("2026-06-06T06:00:00+07:00"); // 10 Dzulhijjah 1447H
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="col-span-full bg-primary text-primary-foreground border-0">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">Menuju Hari Raya Qurban</p>
            <h3 className="text-xl font-bold">10 Dzulhijjah 1447H / 6 Juni 2026</h3>
          </div>
          <div className="flex gap-3">
            {[
              { label: "Hari", value: timeLeft.days },
              { label: "Jam", value: timeLeft.hours },
              { label: "Menit", value: timeLeft.minutes },
              { label: "Detik", value: timeLeft.seconds },
            ].map((item) => (
              <div key={item.label} className="text-center bg-primary-foreground/10 rounded-lg px-3 py-2 min-w-[60px]">
                <div className="text-2xl font-bold">{String(item.value).padStart(2, "0")}</div>
                <div className="text-xs opacity-70">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  loading?: boolean;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, loading, subtitle }: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="stat-card animate-fade-in">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 animate-count-up">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Dashboard = () => {
  const { data: hewanCount, isLoading: loadingHewan } = useQuery({
    queryKey: ["hewan-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("hewan_qurban")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: shohibulCount, isLoading: loadingShohibul } = useQuery({
    queryKey: ["shohibul-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("shohibul_qurban")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: mustahiqCount, isLoading: loadingMustahiq } = useQuery({
    queryKey: ["mustahiq-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("mustahiq")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: saldoKas, isLoading: loadingKas } = useQuery({
    queryKey: ["saldo-kas"],
    queryFn: async () => {
      const { data } = await supabase.from("kas").select("jenis, jumlah");
      if (!data) return 0;
      return data.reduce((acc, row) => {
        return row.jenis === "masuk" ? acc + Number(row.jumlah) : acc - Number(row.jumlah);
      }, 0);
    },
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Ringkasan pengelolaan qurban 1447H</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CountdownCard />
        <StatCard title="Total Hewan" value={hewanCount ?? 0} icon={Beef} loading={loadingHewan} />
        <StatCard title="Shohibul Qurban" value={shohibulCount ?? 0} icon={Users} loading={loadingShohibul} />
        <StatCard title="Mustahiq" value={mustahiqCount ?? 0} icon={Ticket} loading={loadingMustahiq} />
        <StatCard
          title="Saldo Kas"
          value={formatRupiah(saldoKas ?? 0)}
          icon={Wallet}
          loading={loadingKas}
        />
      </div>
    </div>
  );
};

export default Dashboard;
