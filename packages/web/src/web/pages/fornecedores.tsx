import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { getCategoriaColor, CATEGORIAS_DESPESA } from "../lib/utils";
import { Plus, Star, Phone, Mail, Globe, Edit2, Users } from "lucide-react";

export default function FornecedoresPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({ categoria: "limpeza", ativo: true });

  const { data, isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => (await api.fornecedores.$get()).json(),
  });

  const createMut = useMutation({
    mutationFn: async (body: any) => (await api.fornecedores.$post({ json: body })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: any) => (await api.fornecedores[":id"].$patch({ param: { id }, json: body })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); closeModal(); },
  });

  const fornecedores = (data as any)?.fornecedores ?? [];

  function openCreate() {
    setEditItem(null);
    setForm({ categoria: "limpeza", ativo: true });
    setModalOpen(true);
  }

  function openEdit(f: any) {
    setEditItem(f);
    setForm({ ...f });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditItem(null);
    setForm({ categoria: "limpeza", ativo: true });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, avaliacao: form.avaliacao ? parseFloat(form.avaliacao) : null };
    if (editItem) {
      updateMut.mutate({ id: editItem.id, body });
    } else {
      createMut.mutate(body);
    }
  }

  return (
    <>
      <PageHeader
        title="Fornecedores"
        subtitle={`${fornecedores.length} fornecedores registados`}
        breadcrumb={["Gestão Condomínio", "Fornecedores"]}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={13} />
            Novo fornecedor
          </Button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>A carregar...</div>
        ) : fornecedores.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
              <Users size={40} style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sem fornecedores</p>
              <Button size="sm" onClick={openCreate}><Plus size={13} /> Adicionar</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {fornecedores.map((f: any) => (
              <Card key={f.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: getCategoriaColor(f.categoria) }}
                      />
                      <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                        {f.categoria}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {f.avaliacao && (
                        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--amber)" }}>
                          <Star size={11} fill="currentColor" />
                          {f.avaliacao.toFixed(1)}
                        </div>
                      )}
                      <button
                        onClick={() => openEdit(f)}
                        className="p-1 rounded hover:opacity-70 transition-opacity"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                    {f.nome}
                  </p>
                  {f.nif && (
                    <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>NIF: {f.nif}</p>
                  )}
                  <div className="space-y-1">
                    {f.telefone && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        <Phone size={11} />
                        <a href={`tel:${f.telefone}`} className="hover:opacity-80">{f.telefone}</a>
                      </div>
                    )}
                    {f.email && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        <Mail size={11} />
                        <a href={`mailto:${f.email}`} className="hover:opacity-80 truncate">{f.email}</a>
                      </div>
                    )}
                    {f.website && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        <Globe size={11} />
                        <a href={f.website} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 truncate">
                          {f.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                  </div>
                  {f.notas && (
                    <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{f.notas}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editItem ? "Editar fornecedor" : "Novo fornecedor"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome *"
            placeholder="Nome da empresa ou prestador"
            value={form.nome || ""}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoria"
              options={CATEGORIAS_DESPESA}
              value={form.categoria || "limpeza"}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            />
            <Input
              label="NIF"
              placeholder="500000000"
              value={form.nif || ""}
              onChange={(e) => setForm({ ...form, nif: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Telefone"
              placeholder="9XX XXX XXX"
              value={form.telefone || ""}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="geral@empresa.pt"
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <Input
            label="Website"
            placeholder="https://empresa.pt"
            value={form.website || ""}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
          <Input
            label="Avaliação (1.0 – 5.0)"
            type="number"
            step="0.1"
            min="1"
            max="5"
            placeholder="4.5"
            value={form.avaliacao ?? ""}
            onChange={(e) => setForm({ ...form, avaliacao: e.target.value })}
          />
          <Textarea
            label="Notas"
            rows={2}
            placeholder="Observações internas..."
            value={form.notas || ""}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {editItem ? "Guardar" : "Criar fornecedor"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
