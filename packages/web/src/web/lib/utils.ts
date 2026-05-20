import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function getMesNome(mes: number): string {
  return new Date(2024, mes - 1, 1).toLocaleDateString("pt-PT", { month: "long" });
}

export function getMesNomeCurto(mes: number): string {
  return new Date(2024, mes - 1, 1).toLocaleDateString("pt-PT", { month: "short" });
}

export const CATEGORIAS_DESPESA = [
  { value: "água", label: "Água", color: "#3b82f6" },
  { value: "eletricidade", label: "Eletricidade", color: "#f59e0b" },
  { value: "limpeza", label: "Limpeza", color: "#10b981" },
  { value: "jardim", label: "Jardim", color: "#22c55e" },
  { value: "manutenção", label: "Manutenção", color: "#8b5cf6" },
  { value: "elevadores", label: "Elevadores", color: "#06b6d4" },
  { value: "seguros", label: "Seguros", color: "#f97316" },
  { value: "outros", label: "Outros", color: "#64748b" },
];

export function getCategoriaColor(categoria: string): string {
  return CATEGORIAS_DESPESA.find((c) => c.value === categoria)?.color ?? "#64748b";
}

export const METODOS_PAGAMENTO = [
  { value: "transferência", label: "Transferência Bancária" },
  { value: "mbway", label: "MB Way" },
  { value: "numerário", label: "Numerário" },
  { value: "cheque", label: "Cheque" },
  { value: "débito_direto", label: "Débito Direto" },
];
