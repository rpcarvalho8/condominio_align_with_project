import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { authClient, clearToken } from "../lib/auth";
import { api } from "../lib/api";

type PortalData = {
  fracao: {
    numero: string;
    andar: number | null;
    proprietarioNome: string | null;
    proprietarioEmail: string | null;
    proprietarioTelefone: string | null;
    quotaMensal: number;
    permilagem: number | null;
  };
  quotas: Array<{
    id: string;
    mes: number;
    ano: number;
    valor: number;
    tipo: string;
    pago: boolean;
    dataPagamento: string | null;
    metodoPagamento: string | null;
    observacoes: string | null;
  }>;
  recibos: Array<{
    id: string;
    numeroRecibo: string | null;
    valor: number;
    pdfUrl: string | null;
    createdAt: string;
  }>;
  resumo: {
    totalDívida: number;
    totalPago: number;
    quotasPendentes: number;
    quotasPagas: number;
  };
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatEur(v: number) {
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function tipoLabel(tipo: string) {
  const map: Record<string, string> = {
    condominio: "Condomínio",
    obras: "Obras",
    extra: "Extra",
    fundo_reserva: "Fundo Reserva",
  };
  return map[tipo] ?? tipo;
}

export default function PortalPage() {
  const [, navigate] = useLocation();
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"quotas" | "recibos">("quotas");
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());

  useEffect(() => {
    if (isPending) return;
    if (!session) { navigate("/login"); return; }
    const user = session.user as any;
    // Admins don't use portal — go to dashboard
    if (user?.role === "admin") { navigate("/"); return; }
    loadData();
  }, [session, isPending]);

  async function loadData() {
    try {
      const res = await fetch("/api/portal/minha-fracao", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("bm_token") ?? ""}`,
        },
      });
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await authClient.signOut();
    clearToken();
    navigate("/login");
  }

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">A carregar...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Sem fração associada à sua conta.</p>
          <p className="text-gray-600 text-sm">Contacte o administrador do condomínio.</p>
          <button onClick={handleLogout} className="mt-6 text-blue-400 hover:underline text-sm">
            Sair
          </button>
        </div>
      </div>
    );
  }

  const quotasDoAno = data.quotas.filter(q => q.ano === anoFiltro);
  const anos = [...new Set(data.quotas.map(q => q.ano))].sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm">Gestão Condomínio</p>
              <p className="text-gray-500 text-xs">Fração {data.fracao.numero}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm transition">
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome + Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h1 className="text-xl font-semibold mb-1">
            Olá, {data.fracao.proprietarioNome ?? session?.user?.name}
          </h1>
          <p className="text-gray-400 text-sm">Fração {data.fracao.numero} · Permilagem: {data.fracao.permilagem?.toFixed(1) ?? "—"}‰</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {data.fracao.proprietarioEmail && (
              <div>
                <span className="text-gray-500">Email</span>
                <p className="text-gray-200">{data.fracao.proprietarioEmail}</p>
              </div>
            )}
            {data.fracao.proprietarioTelefone && (
              <div>
                <span className="text-gray-500">Telefone</span>
                <p className="text-gray-200">{data.fracao.proprietarioTelefone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Quota Mensal</p>
            <p className="text-lg font-bold text-white">{formatEur(data.fracao.quotaMensal)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Em Dívida</p>
            <p className={`text-lg font-bold ${data.resumo.totalDívida > 0 ? "text-red-400" : "text-green-400"}`}>
              {formatEur(data.resumo.totalDívida)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Pago</p>
            <p className="text-lg font-bold text-green-400">{formatEur(data.resumo.totalPago)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Pendentes</p>
            <p className={`text-lg font-bold ${data.resumo.quotasPendentes > 0 ? "text-amber-400" : "text-gray-400"}`}>
              {data.resumo.quotasPendentes}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setTab("quotas")}
              className={`flex-1 py-3 text-sm font-medium transition ${tab === "quotas" ? "text-white border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-300"}`}
            >
              Quotas
            </button>
            <button
              onClick={() => setTab("recibos")}
              className={`flex-1 py-3 text-sm font-medium transition ${tab === "recibos" ? "text-white border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-300"}`}
            >
              Recibos
            </button>
          </div>

          {tab === "quotas" && (
            <div className="p-4">
              {/* Year filter */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-500 text-sm">Ano:</span>
                <div className="flex gap-1">
                  {anos.map(ano => (
                    <button
                      key={ano}
                      onClick={() => setAnoFiltro(ano)}
                      className={`px-3 py-1 rounded-lg text-sm transition ${anoFiltro === ano ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                    >
                      {ano}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quotas grid */}
              <div className="space-y-2">
                {quotasDoAno.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">Sem quotas para {anoFiltro}</p>
                ) : (
                  quotasDoAno.map(q => (
                    <div key={q.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${q.pago ? "bg-green-400" : "bg-amber-400"}`} />
                        <div>
                          <p className="text-sm font-medium">{MESES[q.mes - 1]} {q.ano}</p>
                          <p className="text-xs text-gray-500">{tipoLabel(q.tipo)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${q.pago ? "text-green-400" : "text-amber-400"}`}>
                          {formatEur(q.valor)}
                        </p>
                        {q.pago && q.dataPagamento && (
                          <p className="text-xs text-gray-500">
                            Pago em {new Date(q.dataPagamento).toLocaleDateString("pt-PT")}
                          </p>
                        )}
                        {!q.pago && (
                          <p className="text-xs text-amber-500/70">Pendente</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "recibos" && (
            <div className="p-4">
              {data.recibos.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">Sem recibos emitidos</p>
              ) : (
                <div className="space-y-2">
                  {data.recibos.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{r.numeroRecibo ?? "—"}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(r.createdAt).toLocaleDateString("pt-PT")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-green-400">{formatEur(r.valor)}</p>
                        {r.pdfUrl && (
                          <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Note */}
        <p className="text-center text-gray-600 text-xs">
          Para questões sobre pagamentos contacte a administração do condomínio.
        </p>
      </main>
    </div>
  );
}
