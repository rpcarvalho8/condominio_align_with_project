import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import puppeteer from "puppeteer-core";

// ── Config ──────────────────────────────────────────────────────────────────
const DB_URL = "libsql://c42c4bf1-3827-4b9b-89d8-132fcb6cc308-runable.aws-us-east-2.turso.io";
const DB_TOKEN = process.env.DATABASE_AUTH_TOKEN;
const PDF_DIR = "/home/user/buildingmind/packages/web/data/recibos";
const OFFSET = 94;

const db = createClient({ url: DB_URL, authToken: DB_TOKEN });

const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CONDOMINIO = {
  nome: "Condomínio Urbanização da Fonte",
  morada: "Rua Poeta António Boto, 21, 37 e 39",
  localidade: "4785-390 Trofa",
  nif: "901932027",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(typeof d === "number" ? d * 1000 : d);
  return dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildMoradaFracao(fracao) {
  const base = "Rua Poeta António Boto";
  const numEdif = fracao.tipo === "comercial" ? "21" : (parseInt(fracao.numero) <= 14 ? "37" : "39");
  return `${base}, ${numEdif}, ${fracao.andar ?? ""}º - Fração ${fracao.numero}`;
}

// ── HTML builder (same as server) ───────────────────────────────────────────
const LOGO_PATH = "/home/user/buildingmind/packages/web/public/logo_condominio.png";
let LOGO_B64 = "";
try { LOGO_B64 = fs.readFileSync(LOGO_PATH).toString("base64"); } catch {}

function buildReciboHtml({ numeroRecibo, dataDocumento, fracao, proprietario, linhas, total, metodoPagamento }) {
  const logoHtml = LOGO_B64 ? `<img src="data:image/png;base64,${LOGO_B64}" class="logo" alt="Logo">` : "";
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; padding: 30px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
  .logo { height: 60px; }
  .condominio-info { text-align: right; }
  .condominio-info .nome { font-size: 13px; font-weight: 700; color: #1e3a8a; }
  .condominio-info p { font-size: 10px; color: #555; margin-top: 2px; }
  .recibo-info { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .recibo-info .numero { font-size: 16px; font-weight: 700; color: #1e3a8a; }
  .recibo-info .data { font-size: 11px; color: #555; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-item label { font-size: 9px; text-transform: uppercase; color: #9ca3af; display: block; }
  .info-item span { font-size: 11px; color: #1f2937; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead tr { background: #1e3a8a; color: white; }
  thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 7px 10px; font-size: 10px; border-bottom: 1px solid #f1f5f9; }
  .valor-cell { text-align: right; font-weight: 600; }
  .total-row { background: #eff6ff !important; border-top: 2px solid #2563eb; }
  .total-row td { font-weight: 700; font-size: 11px; padding: 9px 10px; }
  .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .pagamento-badge { background: #dcfce7; color: #166534; padding: 5px 12px; border-radius: 20px; font-size: 10px; font-weight: 600; }
  .legal { font-size: 9px; color: #9ca3af; text-align: right; max-width: 300px; }
</style>
</head>
<body>
  <div class="header">
    <div>${logoHtml}</div>
    <div class="condominio-info">
      <div class="nome">${CONDOMINIO.nome}</div>
      <p>${CONDOMINIO.morada}</p>
      <p>${CONDOMINIO.localidade}</p>
      <p>NIF: ${CONDOMINIO.nif}</p>
    </div>
  </div>
  <div class="recibo-info">
    <div class="numero">Recibo n.º ${numeroRecibo}</div>
    <div class="data">Data: ${dataDocumento}</div>
  </div>
  <div class="section">
    <div class="section-title">Dados do Proprietário / Fração</div>
    <div class="info-grid">
      <div class="info-item"><label>Proprietário</label><span>${proprietario.nome}</span></div>
      <div class="info-item"><label>Fração</label><span>${fracao.numero}</span></div>
      <div class="info-item"><label>Morada</label><span>${proprietario.morada}</span></div>
      ${proprietario.nif ? `<div class="info-item"><label>NIF</label><span>${proprietario.nif}</span></div>` : ""}
    </div>
  </div>
  <div class="section">
    <div class="section-title">Descrição</div>
    <table>
      <thead>
        <tr>
          <th>Fração</th><th>Descrição</th><th>Vencimento</th><th>Data Pagamento</th><th style="text-align:right">Valor (€)</th>
        </tr>
      </thead>
      <tbody>
        ${linhas.map(l => `<tr><td>${l.fracao}</td><td>${l.descricao}</td><td>${l.vencimento}</td><td>${l.dataPagamento}</td><td class="valor-cell">${l.valor.toFixed(2)}</td></tr>`).join("")}
        <tr class="total-row"><td colspan="4" style="text-align:right">Total:</td><td class="valor-cell">€ ${total.toFixed(2)}</td></tr>
      </tbody>
    </table>
  </div>
  <div class="footer">
    <div class="pagamento-badge">✓ PAGO — ${metodoPagamento}</div>
    <div class="legal">Documento gerado eletronicamente.<br>Válido sem assinatura.</div>
  </div>
</body>
</html>`;
}

async function htmlToPdf(html, pdfPath) {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: pdfPath, format: "A4", margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }, printBackground: true });
  } finally {
    await browser.close();
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Load all recibos with fracao info
  const res = await db.execute(`
    SELECT r.id, r.fracao_id, r.quota_id, r.mes, r.ano, r.valor, r.numero_recibo, r.pdf_url, r.enviado_email, r.hash_sha256,
           f.numero as fracao_numero, f.proprietario_nome, f.proprietario_email, f.proprietario_nif, f.tipo, f.andar,
           f.proprietario_morada
    FROM recibos r
    JOIN fracoes f ON f.id = r.fracao_id
    ORDER BY r.ano, r.mes, f.numero
  `);
  
  const recibos = res.rows;
  console.log(`Total: ${recibos.length} recibos`);
  
  // 2. Need quota data for each recibo to rebuild HTML
  // Group by fracao+mes+ano, get quotas
  let seq = OFFSET;
  
  for (const rec of recibos) {
    seq++;
    const newNumero = `${rec.ano}.${seq}`;
    const mes = rec.mes;
    const ano = rec.ano;
    const mesNome = MESES[mes];
    
    console.log(`[${seq}/${OFFSET + recibos.length}] ${rec.fracao_numero} ${mes}/${ano}: ${rec.numero_recibo} -> ${newNumero}`);
    
    // Get quotas for this fracao+mes+ano
    const qRes = await db.execute({
      sql: `SELECT * FROM quotas WHERE fracao_id = ? AND mes = ? AND ano = ? AND pago = 1`,
      args: [rec.fracao_id, mes, ano]
    });
    const quotas = qRes.rows;
    
    // Build linhas
    const linhas = [];
    let total = 0;
    let metodoPagamento = "Transferência";
    
    for (const q of quotas) {
      let descricao;
      if (q.tipo === "fundo_reserva") {
        descricao = `${mesNome} ${ano} - Fundo de Reserva`;
      } else if (q.tipo === "extra") {
        descricao = q.observacoes ?? `${mesNome} ${ano} - Quota Extra`;
      } else if (q.tipo === "obras") {
        descricao = q.observacoes ?? `${mesNome} ${ano} - Fundo de Obras`;
      } else {
        descricao = `${mesNome} ${ano} - Orçamento`;
      }
      const dataPag = q.data_pagamento ? new Date(q.data_pagamento * 1000) : new Date();
      if (q.metodo_pagamento) metodoPagamento = q.metodo_pagamento;
      const venc = new Date(ano, mes - 1, 10);
      linhas.push({ fracao: rec.fracao_numero, descricao, vencimento: formatDate(venc), dataPagamento: formatDate(dataPag), valor: q.valor });
      total += q.valor;
      if (q.tipo === "condominio" && q.fundo_reserva && q.fundo_reserva > 0) {
        linhas.push({ fracao: rec.fracao_numero, descricao: `${mesNome} ${ano} - Fundo de Reserva`, vencimento: formatDate(venc), dataPagamento: formatDate(dataPag), valor: q.fundo_reserva });
        total += q.fundo_reserva;
      }
    }
    
    if (linhas.length === 0) {
      // fallback: use stored valor
      const venc = new Date(ano, mes - 1, 10);
      linhas.push({ fracao: rec.fracao_numero, descricao: `${mesNome} ${ano} - Orçamento`, vencimento: formatDate(venc), dataPagamento: formatDate(new Date()), valor: rec.valor });
      total = rec.valor;
    }
    
    const morada = rec.proprietario_morada ?? buildMoradaFracao({ numero: rec.fracao_numero, tipo: rec.tipo, andar: rec.andar });
    const dataDocumento = formatDate(new Date(ano, mes, 0));
    
    const html = buildReciboHtml({
      numeroRecibo: newNumero,
      dataDocumento,
      fracao: { numero: rec.fracao_numero },
      proprietario: { nome: rec.proprietario_nome ?? "Proprietário", morada, localidade: "4785-390 Trofa", nif: rec.proprietario_nif ?? undefined },
      linhas,
      total,
      metodoPagamento,
    });
    
    // Delete old PDF
    const oldFilename = rec.pdf_url?.split("/").pop();
    if (oldFilename) {
      const oldPath = path.join(PDF_DIR, oldFilename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    
    // Generate new PDF
    const safeFracao = rec.fracao_numero.replace(/[^a-zA-Z0-9]/g, "");
    const pdfFilename = `recibo_${ano}_${String(mes).padStart(2, "0")}_${safeFracao}_${newNumero}.pdf`;
    const pdfPath = path.join(PDF_DIR, pdfFilename);
    await htmlToPdf(html, pdfPath);
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    
    // Update DB
    await db.execute({
      sql: `UPDATE recibos SET numero_recibo = ?, pdf_url = ?, hash_sha256 = ? WHERE id = ?`,
      args: [newNumero, `/api/recibos/pdf/${pdfFilename}`, hash, rec.id]
    });
    
    console.log(`  ✓ ${newNumero} (€${total.toFixed(2)})`);
  }
  
  console.log(`\nConcluído! ${recibos.length} recibos resequenciados.`);
}

main().catch(e => { console.error(e); process.exit(1); });
