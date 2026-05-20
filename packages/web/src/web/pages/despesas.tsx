import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { formatEuro, formatDate, CATEGORIAS_DESPESA, getCategoriaColor } from "../lib/utils";
import { Plus, TrendingDown, Trash2, RefreshCw } from "lucide-react";

export default function DespesasPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ categoria: "limpeza", data: new Date().toISOString().split("T")[0] });

  const { data: despesasData, isLoading } = useQuery({
    queryKey: ["despesas"],
    queryFn: async () => (await api.despesas.$get()).json(),
  });

  const { data: fornData } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => (await api.fornecedores.$get()).json(),
  });

  const createMut = useMutation({
    mutationFn: async (body: any) => (await api.despesas.$post({ json: body })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      closeModal();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => (await api.despesas[":id"].$delete({ param: { id } })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const despesas = (despesasData as any)?.despesas ?? [];
  const fornecedores = ((fornData as any)?.fornecedores ?? []).map((f: any) => ({
    value: f.id,
    label: f.nome,
  }));

  const total = despesas.reduce((s: number, d: any) => s + d.despesa.valor, 0);

  function closeModal() {
    setModalOpen(false);
    setForm({ categoria: "limpeza", data: new Date().toISOString().split("T")[0] });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...form,
      valor: parseFloat(form.valor),
      recorrente: !!form.recorrente,
      fornecedorId: form.fornecedorId || null,
    };
    createMut.mutate(body);
  }

  return (
    <>
      <PageHeader
        title="Despesas"
        subtitle={`Total: ${formatEuro(total)}`}
        breadcrumb={["Gestão Condomínio", "Despesas"]}
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={13} />
            Registar despesa
          </Button>
        }
      />

      <div className="p-6 space-y-3">
        {isLoading ? (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>A carregar...</div>
        ) : despesas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
              <TrendingDown size={40} style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sem despesas registadas</p>
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus size={13} />
                Registar despesa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Data", "Descrição", "Categoria", "Fornecedor", "Valor", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {despesas.map((d: any) => (
                    <tr
                      key={d.despesa.id}
                      className="border-b hover:opacity-80 transition-opacity"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        {formatDate(d.despesa.data)}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                        <div className="flex items-center gap-2">
                          <span>{d.despesa.descricao}</span>
                          {d.despesa.recorrente && (
                            <Badge variant="blue">Recorrente</Badge>
                          )}
                        </div>
                        {d.despesa.notas && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{d.despesa.notas}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: getCategoriaColor(d.despesa.categoria) }}
                          />
                          <span className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>
                            {d.despesa.categoria}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {d.fornecedor?.nome || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: "var(--red)" }}>
                        {formatEuro(d.despesa.valor)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="p-1.5 rounded hover:opacity-70 transition-opacity"
                          style={{ color: "var(--text-muted)" }}
                          onClick={() => {
                            if (confirm("Eliminar esta despesa?")) deleteMut.mutate(d.despesa.id);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid var(--border-strong)" }}>
                    <td colSpan={4} className="px-4 py-3 text-xs font-medium text-right" style={{ color: "var(--text-muted)" }}>
                      Total
                    </td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: "var(--red)" }}>
                      {formatEuro(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title="Registar despesa">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Descrição *"
            placeholder="ex: Fatura EDP — Março 2026"
            value={form.descricao || ""}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoria *"
              options={CATEGORIAS_DESPESA}
              value={form.categoria || "limpeza"}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            />
            <Input
              label="Valor (€) *"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.valor || ""}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data *"
              type="date"
              value={form.data || ""}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              required
            />
            {fornecedores.length > 0 && (
              <Select
                label="Fornecedor"
                options={[{ value: "", label: "— Sem fornecedor —" }, ...fornecedores]}
                value={form.fornecedorId || ""}
                onChange={(e) => setForm({ ...form, fornecedorId: e.target.value })}
              />
            )}
          </div>
          <Textarea
            label="Notas"
            rows={2}
            placeholder="Informação adicional..."
            value={form.notas || ""}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.recorrente}
              onChange={(e) => setForm({ ...form, recorrente: e.target.checked })}
              className="rounded"
            />
            <span style={{ color: "var(--text-secondary)" }}>Despesa recorrente (mensal)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={createMut.isPending}>Registar</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
