import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  FileText, Download, Mail, Calendar, CheckCircle2,
  AlertCircle, RefreshCw, FileDown, Send, Loader2,
  Bell, ClipboardList,
} from "lucide-react";

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const now = new Date();

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Relatórios mensais ────────────────────────────────────────────────────
function RelatoriosMensaisCard() {
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [sendEmail, setSendEmail] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: lista, refetch: refetchLista } = useQuery<any[]>({
    queryKey: ["relatorios-lista"],
    queryFn: () => fetch("/api/relatorio", {
      headers: { Authorization: `Bearer ${localStorage.getItem("bm_token") ?? ""}` },
    }).then(r => r.json()),
  });

  const gerarMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/relatorio/gerar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("bm_token") ?? ""}`,
        },
        body: JSON.stringify({ mes, ano, sendEmail }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      setResultado(data);
      setErro(null);
      refetchLista();
    },
    onError: (err: any) => {
      setErro(err.message);
      setResultado(null);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList size={16} />
          Relatório Mensal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Gera o relatório mensal completo em PDF: entradas, saídas, morosos, saldos e execução orçamental.
          Pode ser enviado automaticamente por email no último dia de cada mês.
        </p>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Mês</label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="rounded-md border px-3 py-1.5 text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
            >
              {MESES.slice(1).map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Ano</label>
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className="rounded-md border px-3 py-1.5 text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
            >
              {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id="sendEmailRel"
              checked={sendEmail}
              onChange={e => setSendEmail(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="sendEmailRel" className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Enviar por email
            </label>
          </div>
          <Button
            onClick={() => gerarMut.mutate()}
            disabled={gerarMut.isPending}
            loading={gerarMut.isPending}
          >
            <FileDown size={14} />
            {gerarMut.isPending ? "A gerar..." : `Gerar Relatório ${MESES[mes]} ${ano}`}
          </Button>
        </div>

        {/* Info automático */}
        <div
          className="flex items-start gap-2 rounded-lg p-3 text-xs"
          style={{ background: "var(--blue-subtle)", border: "1px solid var(--border-strong)" }}
        >
          <Calendar size={13} style={{ color: "var(--blue-primary)", marginTop: 1 }} className="shrink-0" />
          <span style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>Automático:</strong> o relatório é gerado e enviado automaticamente às 23:00 do último dia de cada mês para {" "}
            <strong>urbanizacaofonte@gmail.com</strong>.
          </span>
        </div>

        {/* Resultado */}
        {resultado && (
          <div
            className="rounded-lg p-3 flex items-center justify-between gap-3"
            style={{ background: "var(--green-subtle)", border: "1px solid var(--green)" }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} style={{ color: "var(--green)" }} />
              <span className="text-sm" style={{ color: "var(--green)" }}>
                PDF gerado com sucesso!
                {resultado.emailEnviado && " · Email enviado ✓"}
              </span>
            </div>
            <a
              href={resultado.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md"
              style={{ background: "var(--green)", color: "white" }}
            >
              <Download size={12} />
              Descarregar PDF
            </a>
          </div>
        )}
        {erro && (
          <div
            className="rounded-lg p-3 flex items-start gap-2"
            style={{ background: "var(--red-subtle)", border: "1px solid var(--red)" }}
          >
            <AlertCircle size={14} style={{ color: "var(--red)" }} className="mt-0.5 shrink-0" />
            <span className="text-xs" style={{ color: "var(--red)" }}>{erro}</span>
          </div>
        )}

        {/* Lista relatórios */}
        {lista && lista.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Relatórios gerados ({lista.length})
            </p>
            <div className="space-y-2">
              {lista.map((r: any) => (
                <div
                  key={r.filename}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={14} style={{ color: "var(--blue-primary)" }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {r.mesNome} {r.ano}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDate(r.geradoEm)} · {formatBytes(r.tamanho)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={r.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                    style={{ color: "var(--blue-primary)", background: "var(--blue-subtle)" }}
                  >
                    <Download size={11} /> PDF
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Avisos de Débito ─────────────────────────────────────────────────────────
function AvisosDebitoCard() {
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [sendEmail, setSendEmail] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: lista, refetch: refetchLista } = useQuery<any[]>({
    queryKey: ["avisos-lista"],
    queryFn: () => fetch("/api/avisos", {
      headers: { Authorization: `Bearer ${localStorage.getItem("bm_token") ?? ""}` },
    }).then(r => r.json()),
  });

  const gerarMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/avisos/gerar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("bm_token") ?? ""}`,
        },
        body: JSON.stringify({ mes, ano, sendEmail }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      setResultado(data);
      setErro(null);
      refetchLista();
    },
    onError: (err: any) => {
      setErro(err.message);
      setResultado(null);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell size={16} />
          Avisos de Débito (Notas de Cobrança)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Gera um aviso de débito em PDF para cada fração com quotas por pagar.
          Inclui todos os meses em atraso. Pode ser enviado por email a cada condómino.
        </p>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Mês de referência</label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="rounded-md border px-3 py-1.5 text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
            >
              {MESES.slice(1).map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Ano</label>
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className="rounded-md border px-3 py-1.5 text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
            >
              {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id="sendEmailAv"
              checked={sendEmail}
              onChange={e => setSendEmail(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="sendEmailAv" className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Enviar por email aos morosos
            </label>
          </div>
          <Button
            onClick={() => gerarMut.mutate()}
            disabled={gerarMut.isPending}
            loading={gerarMut.isPending}
            variant="secondary"
          >
            <Send size={14} />
            {gerarMut.isPending ? "A gerar..." : `Gerar Avisos — ${MESES[mes]} ${ano}`}
          </Button>
        </div>

        {/* Info automático */}
        <div
          className="flex items-start gap-2 rounded-lg p-3 text-xs"
          style={{ background: "var(--amber-subtle, #fffbeb)", border: "1px solid var(--amber, #d97706)22" }}
        >
          <Calendar size={13} style={{ color: "var(--amber, #d97706)", marginTop: 1 }} className="shrink-0" />
          <span style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>Automático:</strong> os avisos são gerados automaticamente no 1.º dia de cada mês às 08:00
            e enviados por email a todos os condóminos com quotas em atraso.
          </span>
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="space-y-3">
            <div
              className="rounded-lg p-3 flex items-center gap-2"
              style={{ background: "var(--green-subtle)", border: "1px solid var(--green)" }}
            >
              <CheckCircle2 size={15} style={{ color: "var(--green)" }} />
              <span className="text-sm" style={{ color: "var(--green)" }}>
                {resultado.gerados} aviso(s) gerado(s) · {resultado.ignorados} ignorado(s) (sem dívidas)
                {resultado.erros?.length > 0 && ` · ${resultado.erros.length} erro(s)`}
              </span>
            </div>

            {/* Lista de avisos gerados */}
            {resultado.avisos?.length > 0 && (
              <div className="space-y-1">
                {resultado.avisos.map((a: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded px-3 py-2 text-xs"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}
                  >
                    <div>
                      <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                        {a.fracaoNumero}
                      </span>
                      <span className="ml-2" style={{ color: "var(--text-secondary)" }}>
                        {a.proprietarioNome}
                      </span>
                      {a.emailEnviado && (
                        <span className="ml-2" style={{ color: "var(--green)" }}>✓ email enviado</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: "var(--red)" }}>
                        €{a.total.toFixed(2).replace(".", ",")}
                      </span>
                      <a
                        href={a.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-0.5 rounded"
                        style={{ color: "var(--blue-primary)", background: "var(--blue-subtle)" }}
                      >
                        <Download size={10} /> PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resultado.erros?.length > 0 && (
              <div className="rounded-lg p-2" style={{ background: "var(--red-subtle)" }}>
                {resultado.erros.map((e: string, i: number) => (
                  <p key={i} className="text-xs" style={{ color: "var(--red)" }}>· {e}</p>
                ))}
              </div>
            )}
          </div>
        )}
        {erro && (
          <div
            className="rounded-lg p-3 flex items-start gap-2"
            style={{ background: "var(--red-subtle)", border: "1px solid var(--red)" }}
          >
            <AlertCircle size={14} style={{ color: "var(--red)" }} className="mt-0.5 shrink-0" />
            <span className="text-xs" style={{ color: "var(--red)" }}>{erro}</span>
          </div>
        )}

        {/* Lista histórico */}
        {lista && lista.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
              Avisos gerados — histórico ({lista.length})
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {lista.map((a: any) => (
                <div
                  key={a.filename}
                  className="flex items-center justify-between rounded px-3 py-2 text-xs"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={12} style={{ color: "var(--text-muted)" }} />
                    <span className="font-mono" style={{ color: "var(--text-primary)" }}>{a.fracaoNumero}</span>
                    <span style={{ color: "var(--text-muted)" }}>{a.mesNome} {a.ano}</span>
                    <span style={{ color: "var(--text-muted)" }}>{formatDate(a.geradoEm)}</span>
                  </div>
                  <a
                    href={a.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-0.5 rounded"
                    style={{ color: "var(--blue-primary)", background: "var(--blue-subtle)" }}
                  >
                    <Download size={10} /> PDF
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RelatoriosPage() {
  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Relatório mensal e avisos de débito"
        breadcrumb={["Gestão Condomínio", "Relatórios"]}
      />
      <div className="p-6 space-y-4">
        <RelatoriosMensaisCard />
        <AvisosDebitoCard />
      </div>
    </>
  );
}
