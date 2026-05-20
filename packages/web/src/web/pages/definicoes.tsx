import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Upload, FileText, CheckCircle2, AlertCircle, Zap, RefreshCw, Wallet, Save } from "lucide-react";
import { api } from "../lib/api";

// ── Saldo editor ─────────────────────────────────────────────────────────────
const SALDO_FIELDS = [
  { key: "saldo_conta_corrente", label: "Saldo Conta Corrente (€)", hint: "Saldo atual da conta bancária principal" },
  { key: "saldo_obras", label: "Fundo Obras / Condomínio (€)", hint: "Saldo acumulado para obras" },
  { key: "saldo_fundo_reserva", label: "Fundo Reserva (€)", hint: "Saldo reserva legal" },
  { key: "atraso_fundo_reserva", label: "Atraso Fundo Reserva (€)", hint: "Montante em falta no fundo reserva" },
];

function SaldosCard() {
  const qc = useQueryClient();
  const { data: config } = useQuery<Record<string, string>>({
    queryKey: ["configuracoes"],
    queryFn: () => fetch("/api/configuracoes").then(r => r.json()),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const getVal = (key: string) =>
    values[key] !== undefined ? values[key] : (config?.[key] ?? "");

  const save = async (key: string) => {
    const val = getVal(key);
    setSaving(key);
    await fetch(`/api/configuracoes/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: val }),
    });
    setSaving(null);
    setSaved(key);
    qc.invalidateQueries({ queryKey: ["configuracoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    setTimeout(() => setSaved(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet size={16} />
          Saldos bancários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Saldos reais das contas — actualizados manualmente com base no extrato bancário.
          Estes valores aparecem no dashboard.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SALDO_FIELDS.map(({ key, label, hint }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                {label}
              </label>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={getVal(key)}
                  onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                  className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-strong)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                  placeholder="0.00"
                />
                <button
                  onClick={() => save(key)}
                  disabled={saving === key}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: saved === key ? "var(--green-subtle)" : "var(--blue-primary)",
                    color: saved === key ? "var(--green)" : "white",
                    border: saved === key ? "1px solid var(--green)" : "none",
                    cursor: saving === key ? "wait" : "pointer",
                  }}
                >
                  {saved === key ? <CheckCircle2 size={12} /> : <Save size={12} />}
                  {saving === key ? "..." : saved === key ? "Guardado" : "Guardar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DefinicoesPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Seed mutation
  const seedMut = useMutation({
    mutationFn: async () => (await api.seed.$post()).json(),
    onSuccess: (data) => {
      qc.invalidateQueries();
      setImportResult({ type: "seed", data });
    },
  });

  // CSV Import mutation
  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/movimentos", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries();
      setImportResult({ type: "import", data });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: any) => {
      setImportResult({ type: "error", message: err.message });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setImportResult(null);
  };

  const handleImport = () => {
    if (selectedFile) importMut.mutate(selectedFile);
  };

  return (
    <>
      <PageHeader
        title="Definições"
        breadcrumb={["Gestão Condomínio", "Definições"]}
      />
      <div className="p-6 space-y-4">

        {/* Saldos */}
        <SaldosCard />

        {/* CSV Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload size={16} />
              Importar movimentos bancários (CSV)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Importa o ficheiro CSV exportado do banco (movimentos do condomínio).
              Atualiza quotas pagas e regista despesas automaticamente.
            </p>

            {/* File zone */}
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
              style={{
                borderColor: selectedFile ? "var(--blue-primary)" : "var(--border-strong)",
                background: selectedFile ? "var(--blue-subtle)" : "var(--bg-secondary)",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText size={18} style={{ color: "var(--blue-primary)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--blue-primary)" }}>
                    {selectedFile.name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : (
                <div>
                  <Upload size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Clica para selecionar o ficheiro CSV
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Formato: exportação banco · codificação latin1
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={handleImport}
              disabled={!selectedFile || importMut.isPending}
              loading={importMut.isPending}
              className="w-full"
            >
              <Upload size={14} />
              {importMut.isPending ? "A importar..." : "Importar movimentos"}
            </Button>

            {/* Result */}
            {importResult && importResult.type === "import" && (
              <div
                className="rounded-lg p-4 space-y-2"
                style={{ background: "var(--green-subtle)", border: "1px solid var(--green)" }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} style={{ color: "var(--green)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--green)" }}>
                    Importação concluída
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>Linhas processadas: <strong>{importResult.data.totalRows}</strong></span>
                  <span>Quotas atualizadas: <strong>{importResult.data.quotasUpdated}</strong></span>
                  <span>Quotas criadas: <strong>{importResult.data.quotasCreated}</strong></span>
                  <span>Despesas criadas: <strong>{importResult.data.despesasCreated}</strong></span>
                  <span>Ignoradas: <strong>{importResult.data.despesasSkipped}</strong></span>
                </div>
                {importResult.data.errors?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium" style={{ color: "var(--amber)" }}>Avisos:</p>
                    <ul className="text-xs mt-1 space-y-1" style={{ color: "var(--text-secondary)" }}>
                      {importResult.data.errors.slice(0, 5).map((e: string, i: number) => (
                        <li key={i}>· {e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {importResult && importResult.type === "error" && (
              <div
                className="rounded-lg p-3 flex items-start gap-2"
                style={{ background: "var(--red-subtle)", border: "1px solid var(--red)" }}
              >
                <AlertCircle size={14} style={{ color: "var(--red)" }} className="mt-0.5 shrink-0" />
                <span className="text-xs" style={{ color: "var(--red)" }}>{importResult.message}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seed data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={16} />
              Dados de demonstração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Reinicia a base de dados com dados de teste (33 frações, quotas 2025–2026, despesas reais).
              <strong className="text-red-400"> Apaga todos os dados atuais.</strong>
            </p>
            <Button
              variant="secondary"
              onClick={() => seedMut.mutate()}
              loading={seedMut.isPending}
            >
              <RefreshCw size={14} />
              {seedMut.isPending ? "A carregar..." : "Recarregar dados de demonstração"}
            </Button>

            {importResult && importResult.type === "seed" && (
              <div
                className="rounded-lg p-3 flex items-center gap-2"
                style={{ background: "var(--green-subtle)", border: "1px solid var(--green)" }}
              >
                <CheckCircle2 size={14} style={{ color: "var(--green)" }} />
                <span className="text-xs" style={{ color: "var(--green)" }}>
                  Seed concluído · {importResult.data.fracoes} frações · {importResult.data.despesas} despesas · {importResult.data.quotas} quotas
                </span>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </>
  );
}
