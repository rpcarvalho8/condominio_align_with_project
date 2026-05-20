import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input, Select } from "../components/ui/Input";
import { formatEuro } from "../lib/utils";
import { Plus, Search, Edit2, Building2, Phone, Mail } from "lucide-react";

export default function FracoesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editFracao, setEditFracao] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ["fracoes"],
    queryFn: async () => (await api.fracoes.$get()).json(),
  });

  const createMut = useMutation({
    mutationFn: async (body: any) => (await api.fracoes.$post({ json: body })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fracoes"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: any) => (await api.fracoes[":id"].$patch({ param: { id }, json: body })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fracoes"] }); closeModal(); },
  });

  const fracoes = (data as any)?.fracoes ?? [];
  const filtered = fracoes.filter((f: any) =>
    f.numero.toLowerCase().includes(search.toLowerCase()) ||
    (f.proprietarioNome || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditFracao(null);
    setForm({ quotaMensal: 45, ativo: true });
    setModalOpen(true);
  }

  function openEdit(f: any) {
    setEditFracao(f);
    setForm({ ...f });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditFracao(null);
    setForm({});
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, quotaMensal: parseFloat(form.quotaMensal), andar: parseInt(form.andar) };
    if (editFracao) {
      updateMut.mutate({ id: editFracao.id, body });
    } else {
      createMut.mutate(body);
    }
  }

  return (
    <>
      <PageHeader
        title="Frações"
        subtitle={`${fracoes.length} frações registadas`}
        breadcrumb={["Gestão Condomínio", "Frações"]}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={13} />
            Nova fração
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Pesquisa */}
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            className="w-full pl-8 pr-3 py-2 text-sm rounded-md border outline-none"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-strong)",
              color: "var(--text-primary)",
            }}
            placeholder="Pesquisar fração ou proprietário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Grid de frações */}
        {isLoading ? (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Building2 size={40} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma fração encontrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((f: any) => (
              <Card key={f.id} className="hover:border-[var(--border-strong)] transition-colors">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: "var(--blue-subtle)", color: "var(--blue-bright)" }}
                      >
                        {f.numero}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Fração {f.numero}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {f.andar === 0 ? "R/C" : `${f.andar}º andar`}
                          {f.permilagem ? ` · ${f.permilagem}‰` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={f.ativo ? "green" : "red"}>
                        {f.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <button
                        className="p-1.5 rounded-md hover:opacity-70 transition-opacity"
                        style={{ color: "var(--text-muted)" }}
                        onClick={() => openEdit(f)}
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {f.proprietarioNome || <span style={{ color: "var(--text-muted)" }}>Sem proprietário</span>}
                    </p>
                    {f.proprietarioEmail && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        <Mail size={11} />
                        {f.proprietarioEmail}
                      </div>
                    )}
                    {f.proprietarioTelefone && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        <Phone size={11} />
                        {f.proprietarioTelefone}
                      </div>
                    )}
                  </div>

                  <div
                    className="mt-3 pt-3 border-t flex items-center justify-between"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Quota mensal</span>
                    <span className="text-sm font-mono font-semibold" style={{ color: "var(--blue-bright)" }}>
                      {formatEuro(f.quotaMensal)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editFracao ? `Editar Fração ${editFracao.numero}` : "Nova Fração"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Número *"
              placeholder="ex: 1A"
              value={form.numero || ""}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              required
            />
            <Input
              label="Andar"
              type="number"
              placeholder="0"
              value={form.andar ?? ""}
              onChange={(e) => setForm({ ...form, andar: e.target.value })}
            />
          </div>
          <Input
            label="Nome do proprietário"
            placeholder="Nome completo"
            value={form.proprietarioNome || ""}
            onChange={(e) => setForm({ ...form, proprietarioNome: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              placeholder="email@exemplo.pt"
              value={form.proprietarioEmail || ""}
              onChange={(e) => setForm({ ...form, proprietarioEmail: e.target.value })}
            />
            <Input
              label="Telefone"
              placeholder="9XX XXX XXX"
              value={form.proprietarioTelefone || ""}
              onChange={(e) => setForm({ ...form, proprietarioTelefone: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="NIF"
              placeholder="123456789"
              value={form.proprietarioNif || ""}
              onChange={(e) => setForm({ ...form, proprietarioNif: e.target.value })}
            />
            <div />
          </div>
          <Input
            label="Morada (para recibos)"
            placeholder="ex: Rua Poeta António Boto, n.º 39, Hab. 2.º B"
            value={form.proprietarioMorada || ""}
            onChange={(e) => setForm({ ...form, proprietarioMorada: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quota mensal (€) *"
              type="number"
              step="0.01"
              placeholder="45.00"
              value={form.quotaMensal ?? ""}
              onChange={(e) => setForm({ ...form, quotaMensal: e.target.value })}
              required
            />
            <Input
              label="Permilagem (‰)"
              type="number"
              step="0.1"
              placeholder="28.5"
              value={form.permilagem ?? ""}
              onChange={(e) => setForm({ ...form, permilagem: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button
              type="submit"
              loading={createMut.isPending || updateMut.isPending}
            >
              {editFracao ? "Guardar alterações" : "Criar fração"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
