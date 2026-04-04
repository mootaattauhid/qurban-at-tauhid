export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function formatTanggal(date: string | Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function hitungIuranPerOrang(harga: number): number {
  return Math.ceil(harga / 7 / 1000) * 1000;
}

export function generateNomorKupon(index: number): string {
  return `QRB-1447-${String(index).padStart(4, "0")}`;
}
