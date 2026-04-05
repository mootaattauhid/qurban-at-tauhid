import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/qurban-utils";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type BagianHewan = Database["public"]["Enums"]["bagian_hewan"];

const BAGIAN_LIST: { bagian: BagianHewan; label: string }[] = [
  { bagian: "jeroan", label: "Jeroan" },
  { bagian: "kepala", label: "Kepala" },
  { bagian: "kulit", label: "Kulit" },
  { bagian: "ekor", label: "Ekor" },
  { bagian: "kaki", label: "Kaki" },
  { bagian: "tulang", label: "Tulang" },
];

interface HewanOption {
  id: string;
  nomor_urut: string;
  jenis_hewan: string;
  tipe_kepemilikan: string;
  harga: number;
  iuran_per_orang: number;
  kuota: number;
  sisa_kuota: number;
}

const ShohibulDaftar = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Form state
  const [hewanId, setHewanId] = useState("");
  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [noWa, setNoWa] = useState("");
  const [statusPenyembelihan, setStatusPenyembelihan] = useState<"sendiri" | "diwakilkan">("diwakilkan");
  const [sumberPendaftaran, setSumberPendaftaran] = useState<"online" | "manual">("online");
  const [panitiaPendaftar, setPanitiaPendaftar] = useState("");
  const [akadAgreed, setAkadAgreed] = useState(false);
  const [requestBagian, setRequestBagian] = useState<BagianHewan[]>([]);

  // Fetch hewan with sisa kuota
  const { data: hewanList, isLoading: loadingHewan } = useQuery({
    queryKey: ["hewan-for-registration"],
    queryFn: async () => {
      const { data: hewanData, error: hewanError } = await supabase
        .from("hewan_qurban")
        .select("*")
        .in("status", ["booking", "lunas"])
        .order("nomor_urut");
      if (hewanError) throw hewanError;

      const { data: shohibulData, error: shohibulError } = await supabase
        .from("shohibul_qurban")
        .select("hewan_id");
      if (shohibulError) throw shohibulError;

      const countMap: Record<string, number> = {};
      shohibulData?.forEach((s) => {
        if (s.hewan_id) countMap[s.hewan_id] = (countMap[s.hewan_id] || 0) + 1;
      });

      return hewanData.map((h) => ({
        id: h.id,
        nomor_urut: h.nomor_urut,
        jenis_hewan: h.jenis_hewan,
        tipe_kepemilikan: h.tipe_kepemilikan,
        harga: Number(h.harga),
        iuran_per_orang: Number(h.iuran_per_orang),
        kuota: h.kuota,
        sisa_kuota: h.kuota - (countMap[h.id] || 0),
      })) as HewanOption[];
    },
  });

  const selectedHewan = hewanList?.find((h) => h.id === hewanId);
  const isKambing = selectedHewan?.jenis_hewan === "kambing";
  const isSapi = selectedHewan?.jenis_hewan === "sapi";

  // For kambing, skip step 4
  const totalSteps = isSapi ? 5 : 4;
  const getActualStep = (s: number) => {
    if (isKambing && s >= 4) return s + 1; // skip request bagian
    return s;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await supabase
        .from("shohibul_qurban")
        .insert({
          nama,
          alamat,
          no_wa: noWa,
          hewan_id: hewanId,
          tipe_kepemilikan: selectedHewan!.tipe_kepemilikan as "kolektif" | "individu",
          status_penyembelihan: statusPenyembelihan,
          sumber_pendaftaran: sumberPendaftaran,
          panitia_pendaftar: sumberPendaftaran === "manual" ? panitiaPendaftar : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (isSapi && requestBagian.length > 0) {
        const requests = requestBagian.map((bagian) => ({
          bagian,
          hewan_id: hewanId,
          shohibul_qurban_id: inserted.id,
        }));
        const { error: reqError } = await supabase.from("request_bagian").insert(requests);
        if (reqError) throw reqError;
      }

      return inserted.id;
    },
    onSuccess: (id) => {
      toast.success("Pendaftaran berhasil!");
      navigate(`/shohibul/${id}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const canNext = () => {
    const actual = getActualStep(step);
    if (actual === 1) return !!hewanId;
    if (actual === 2) return !!nama.trim() && !!alamat.trim() && !!noWa.trim() && (sumberPendaftaran === "online" || !!panitiaPendaftar.trim());
    if (actual === 3) return akadAgreed;
    if (actual === 4) return true; // optional
    if (actual === 5) return true;
    return false;
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const renderStepIndicator = () => {
    const labels = isKambing
      ? ["Pilih Hewan", "Data Diri", "Akad", "Ringkasan"]
      : ["Pilih Hewan", "Data Diri", "Akad", "Request Bagian", "Ringkasan"];
    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {labels.map((label, idx) => {
          const isActive = idx + 1 === step;
          const isDone = idx + 1 < step;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {isDone ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
              {idx < labels.length - 1 && <div className="w-8 h-px bg-border" />}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pilih Hewan Qurban</h2>
      {loadingHewan ? (
        <p className="text-muted-foreground">Memuat data hewan...</p>
      ) : (
        <div className="space-y-2">
          {hewanList?.map((h) => {
            const disabled = h.sisa_kuota <= 0;
            const selected = hewanId === h.id;
            return (
              <div
                key={h.id}
                onClick={() => !disabled && setHewanId(h.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  disabled ? "opacity-50 cursor-not-allowed bg-muted" :
                  selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" :
                  "hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{h.nomor_urut}</span>
                    <span className="text-muted-foreground ml-2 capitalize">{h.jenis_hewan} · {h.tipe_kepemilikan}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={h.sisa_kuota > 0 ? "default" : "destructive"} className={h.sisa_kuota > 0 ? "bg-success/10 text-success border-success/20" : ""}>
                      Sisa: {h.sisa_kuota}/{h.kuota}
                    </Badge>
                    <span className="font-semibold text-sm">{formatRupiah(h.harga)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {(!hewanList || hewanList.length === 0) && (
            <p className="text-muted-foreground text-center py-8">Tidak ada hewan yang tersedia untuk pendaftaran.</p>
          )}
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Data Diri</h2>
      <div className="space-y-3">
        <div>
          <Label>Nama Lengkap *</Label>
          <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama shohibul qurban" />
        </div>
        <div>
          <Label>Alamat *</Label>
          <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Alamat lengkap" />
        </div>
        <div>
          <Label>No. WhatsApp *</Label>
          <Input value={noWa} onChange={(e) => setNoWa(e.target.value)} placeholder="08xxxxxxxxxx" />
        </div>
        <div>
          <Label>Tipe Kepemilikan</Label>
          <Input value={selectedHewan?.tipe_kepemilikan ?? ""} disabled className="capitalize bg-muted" />
        </div>
        <div>
          <Label>Status Penyembelihan</Label>
          <RadioGroup value={statusPenyembelihan} onValueChange={(v) => setStatusPenyembelihan(v as any)} className="flex gap-4 mt-1">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sendiri" id="sendiri" />
              <Label htmlFor="sendiri">Sendiri</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="diwakilkan" id="diwakilkan" />
              <Label htmlFor="diwakilkan">Diwakilkan Panitia</Label>
            </div>
          </RadioGroup>
        </div>
        <div>
          <Label>Sumber Pendaftaran</Label>
          <RadioGroup value={sumberPendaftaran} onValueChange={(v) => setSumberPendaftaran(v as any)} className="flex gap-4 mt-1">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="online" id="online" />
              <Label htmlFor="online">Online</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="manual" />
              <Label htmlFor="manual">Manual</Label>
            </div>
          </RadioGroup>
        </div>
        {sumberPendaftaran === "manual" && (
          <div>
            <Label>Panitia Pendaftar *</Label>
            <Input value={panitiaPendaftar} onChange={(e) => setPanitiaPendaftar(e.target.value)} placeholder="Nama panitia" />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3Akad = () => {
    const isKambing = selectedHewan?.jenis_hewan === "kambing";
    const isSapiKolektif = selectedHewan?.jenis_hewan === "sapi" && selectedHewan?.tipe_kepemilikan === "kolektif";

    const getTitle = () => {
      if (isKambing) return "Akad Shohibul Qurban Kambing";
      if (isSapiKolektif) return "Akad Shohibul Qurban Sapi (Kolektif 7 Orang)";
      return "Akad Shohibul Qurban Sapi (Individu)";
    };

    const poinRingkas = isKambing
      ? [
          "Panitia bertindak sebagai wakil Shohibul Qurban.",
          "Shohibul Qurban mewakilkan penyembelihan dan proses lanjutannya.",
          "Shohibul Qurban membawa separuh badan, hati, jantung, paru-paru, ginjal, limpa, lambung, kepala, kaki, dan lainnya.",
          "Sisa daging dan tulang dibagikan ke mustahiq.",
        ]
      : isSapiKolektif
      ? [
          "Panitia bertindak sebagai wakil Shohibul Qurban.",
          "Shohibul Qurban mendapatkan 1/7 bagian daging bersih.",
          "Bagian lainnya (jeroan, kepala, kulit, ekor, kaki, tulang) dibagi sesuai request.",
          "Bagian yang tidak di-request menjadi hak mustahiq.",
        ]
      : [
          "Panitia bertindak sebagai wakil Shohibul Qurban.",
          "Shohibul Qurban membawa keseluruhan daging dan bagian hewan.",
          "Bagian yang disedekahkan dibagikan ke mustahiq.",
        ];

    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{getTitle()}</h2>
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          {poinRingkas.map((p, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="font-bold text-primary">{i + 1}.</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
        <div className="bg-info/10 text-info p-3 rounded-lg text-sm">
          ℹ️ Link akad penuh akan dikirim via WhatsApp setelah pendaftaran.
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={akadAgreed} onCheckedChange={(v) => setAkadAgreed(!!v)} className="mt-0.5" />
          <span className="text-sm">Saya telah membaca dan memahami kesepakatan ini</span>
        </label>
      </div>
    );
  };

  const renderStep4Request = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Request Bagian Hewan (Opsional)</h2>
      <p className="text-sm text-muted-foreground">Pilih bagian hewan yang ingin Anda request. Ini bersifat opsional.</p>
      <div className="grid grid-cols-3 gap-3">
        {BAGIAN_LIST.map(({ bagian, label }) => {
          const checked = requestBagian.includes(bagian);
          return (
            <label
              key={bagian}
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                checked ? "border-primary bg-primary/5" : "hover:border-primary/50"
              }`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => {
                  if (v) setRequestBagian([...requestBagian, bagian]);
                  else setRequestBagian(requestBagian.filter((b) => b !== bagian));
                }}
              />
              <span className="text-sm font-medium capitalize">{label}</span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground italic">Request dapat diubah setelah pendaftaran di halaman detail hewan.</p>
    </div>
  );

  const renderStep5Summary = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Ringkasan Pendaftaran</h2>
      <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Nama</span><span className="font-medium">{nama}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Alamat</span><span className="font-medium">{alamat}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">No. WA</span><span className="font-medium">{noWa}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Hewan</span><span className="font-medium">{selectedHewan?.nomor_urut} ({selectedHewan?.jenis_hewan})</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Tipe</span><span className="font-medium capitalize">{selectedHewan?.tipe_kepemilikan}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Penyembelihan</span><span className="font-medium capitalize">{statusPenyembelihan}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Sumber</span><span className="font-medium capitalize">{sumberPendaftaran}</span></div>
        {sumberPendaftaran === "manual" && (
          <div className="flex justify-between"><span className="text-muted-foreground">Panitia</span><span className="font-medium">{panitiaPendaftar}</span></div>
        )}
        {isSapi && requestBagian.length > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">Request Bagian</span><span className="font-medium capitalize">{requestBagian.join(", ")}</span></div>
        )}
      </div>
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Iuran yang harus dibayar</p>
          <p className="text-2xl font-bold text-primary">{formatRupiah(selectedHewan?.iuran_per_orang ?? 0)}</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderCurrentStep = () => {
    const actual = getActualStep(step);
    switch (actual) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3Akad();
      case 4: return renderStep4Request();
      case 5: return renderStep5Summary();
      default: return null;
    }
  };

  const isLastStep = step === totalSteps;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Pendaftaran Shohibul Qurban</h1>
        <p className="page-subtitle">Isi data lengkap untuk mendaftar qurban 1447H</p>
      </div>

      {renderStepIndicator()}

      <Card>
        <CardContent className="p-6">
          {renderCurrentStep()}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={step === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        {isLastStep ? (
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "Menyimpan..." : "Daftarkan Sekarang"}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canNext()}>
            Lanjut <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ShohibulDaftar;
