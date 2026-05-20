/**
 * Regenera todos os PDFs de recibos de Jan-Mai 2026
 * Inclui todas as linhas:
 *   - Orçamento (quota condominio)
 *   - Fundo de Reserva (separado)
 *   - Cotas extras (Portão, Elevadores, Incêndio, etc.) — cada uma na sua linha
 *   - Fundo de Obras
 */

import { createClient } from "@libsql/client";
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DB_URL = "libsql://c42c4bf1-3827-4b9b-89d8-132fcb6cc308-runable.aws-us-east-2.turso.io";
const DB_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzkwODcxODYsInAiOnsicnciOnsibnMiOlsiMDE5ZTM5ZGMtMTYwMS03ODY0LTgzYmMtOTIzYjliYzdmZTNkIl19fSwicmlkIjoiYjkzNDYyYmEtYjdmOS00YmUyLWE4ZGItMmNlYWZjNGFhZjg1In0.DF7a7Hd0QmAAUC7evHDeMLlAb00AWIfB2X9YToJgkxYFajGAGuYZh-aJsmbQ6RcgFSl9FFrj6ypdiit1yXOaCQ";

const client = createClient({ url: DB_URL, authToken: DB_TOKEN });

const PDF_DIR = path.join(ROOT, "packages/web/data/recibos");
const LOGO_PATH = path.join(ROOT, "packages/web/public/logo_condominio.png");

let LOGO_B64 = "";
try { LOGO_B64 = fs.readFileSync(LOGO_PATH).toString("base64"); } catch {}

const CONDOMINIO = {
  nome: "Condomínio Urbanização da Fonte",
  morada: "Rua Poeta António Boto, 21, 37 e 39",
  localidade: "4785-390 Trofa",
  nif: "901932027",
};

const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// Quota tipo IDs → nomes descritivos
const QUOTA_TIPO_NOMES = {
  "06d6dd01-04ac-4ea3-8359-ec705f78de7c": "Cota Extra Motor Portão Garagem",
  "4696eef9-bd1f-46ff-a368-47cfd455eeca": "Cota Extra Elevadores",
  "dd16bd50-a2ab-4387-9d70-95822b1a61d7": "Cota Extra Incêndio",
  "3f5a44e9-c9dc-40ca-8b61-a12d9c7352fa": "Cota Extra Indaqua",
};

function formatDate(ts) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatEur(v) {
  return Number(v).toFixed(2).replace(".", ",");
}

function buildReciboHtml(data) {
  const logoSrc = LOGO_B64 ? `data:image/png;base64,${LOGO_B64}` : "";

  const linhasHtml = data.linhas.map(l => `
    <tr>
      <td>${l.fracao}</td>
      <td>${l.descricao}</td>
      <td>${l.vencimento}</td>
      <td>${l.dataPagamento}</td>
      <td class="right">${formatEur(l.valor)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Calibri", "Arial", sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    background: white;
    padding: 28mm 20mm 20mm 20mm;
    position: relative;
  }
  .corner-tl {
    position: fixed; top: 0; left: 0;
    width: 0; height: 0; border-style: solid;
    border-width: 55px 55px 0 0;
    border-color: #b5a99a transparent transparent transparent;
    opacity: 0.55;
  }
  .corner-br {
    position: fixed; bottom: 0; right: 0;
    width: 0; height: 0; border-style: solid;
    border-width: 0 0 55px 55px;
    border-color: transparent transparent #b5a99a transparent;
    opacity: 0.55;
  }
  .sidebar-line {
    position: fixed; top: 0; right: 18mm;
    width: 1.5px; height: 100%;
    background: #b5a99a; opacity: 0.4;
  }
  .header {
    display: flex; justify-content: flex-end; margin-bottom: 8px;
  }
  .logo-img { width: 130px; opacity: 0.9; }
  .recibo-info { text-align: right; margin-bottom: 20px; }
  .recibo-info .numero { font-size: 13pt; font-weight: bold; }
  .recibo-info .original { font-size: 10pt; color: #555; }
  .recibo-info .data { font-size: 10pt; color: #333; }
  .partes { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .condominio { font-size: 10.5pt; }
  .condominio strong { font-size: 11pt; display: block; margin-bottom: 2px; }
  .destinatario { text-align: left; font-size: 10.5pt; max-width: 52%; }
  .destinatario .label { font-style: italic; color: #555; margin-bottom: 2px; font-size: 9.5pt; }
  .nif-row { margin-bottom: 20px; font-size: 10.5pt; }
  .intro { margin-bottom: 10px; font-size: 10.5pt; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 6px; }
  thead tr { border-bottom: 1.5px solid #333; }
  thead th { padding: 5px 6px; font-weight: 600; text-align: left; font-size: 9.5pt; text-decoration: underline; }
  thead th.right, tbody td.right { text-align: right; }
  tbody tr { border-bottom: 0.5px solid #ddd; }
  tbody td { padding: 5px 6px; vertical-align: top; }
  .total-row {
    display: flex; justify-content: flex-end; gap: 20px;
    border-top: 1px solid #333; padding-top: 4px; margin-top: 2px; font-size: 10pt;
  }
  .total-row .label { font-weight: 600; }
  .total-row .value { font-weight: 600; min-width: 60px; text-align: right; }
  .iva-note { font-size: 8.5pt; color: #555; margin-top: 2px; margin-bottom: 16px; }
  .pagamento { font-size: 10.5pt; margin-bottom: 40px; }
  .pagamento strong { font-weight: 600; }
  .assinatura { margin-top: 20px; font-size: 10.5pt; }
  .assinatura .admin-label { margin-bottom: 30px; }
  .assinatura .nome-italico { font-style: italic; margin-bottom: 4px; }
  .assinatura .linha { width: 200px; border-bottom: 1px solid #333; }
  .pagina { position: fixed; bottom: 10mm; right: 25mm; font-size: 9pt; color: #888; }
</style>
</head>
<body>
  <div class="corner-tl"></div>
  <div class="corner-br"></div>
  <div class="sidebar-line"></div>
  <div class="header">
    ${logoSrc ? `<img class="logo-img" src="${logoSrc}" />` : ""}
  </div>
  <div class="recibo-info">
    <div class="numero">Recibo n.º ${data.numeroRecibo}</div>
    <div class="original">Original</div>
    <div class="data">Data do documento: ${data.dataDocumento}</div>
  </div>
  <div class="partes">
    <div class="condominio">
      <strong>${CONDOMINIO.nome}</strong>
      ${CONDOMINIO.morada}<br>
      ${CONDOMINIO.localidade}<br>
      NIF: ${CONDOMINIO.nif}
    </div>
    <div class="destinatario">
      <div class="label">Exmo/a Sr/a.:</div>
      ${data.proprietarioNome}<br>
      ${data.proprietarioMorada}<br>
      ${data.proprietarioLocalidade}
    </div>
  </div>
  <div class="nif-row">
    ${data.proprietarioNif ? `V/ NIF: ${data.proprietarioNif}` : ""}
  </div>
  <div class="intro">Recebemos de V. Ex.ª o pagamento dos seguintes valores:</div>
  <table>
    <thead>
      <tr>
        <th style="width:8%">Fração</th>
        <th>Descrição</th>
        <th style="width:14%">Vencimento</th>
        <th style="width:18%">Data de pagamento</th>
        <th class="right" style="width:14%">Recebido (€)</th>
      </tr>
    </thead>
    <tbody>
      ${linhasHtml}
    </tbody>
  </table>
  <div class="iva-note">Isento de I.V.A. nos termos do artigo 9.º do n.º 21 do CIVA</div>
  <div class="total-row">
    <span class="label">Total:</span>
    <span class="value">${formatEur(data.total)}</span>
  </div>
  <br><br>
  <div class="pagamento">
    <strong>Pagamento:</strong> ${data.metodoPagamento}
  </div>
  <div class="assinatura">
    <div class="admin-label">A Administração do Condomínio</div>
    <div class="nome-italico">${CONDOMINIO.nome}</div>
    <div class="linha"></div>
  </div>
  <div class="pagina">Página 1 / 1</div>
</body>
</html>`;
}

async function htmlToPdf(html, outPath) {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: outPath, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
}

async function main() {
  // Load quota_tipos
  const tiposResult = await client.execute("SELECT id, nome FROM quota_tipos");
  const tipoNomes = {};
  for (const row of tiposResult.rows) {
    tipoNomes[row.id] = row.nome;
  }

  // Load all recibos Jan-May 2026 with fracao info
  const recibosResult = await client.execute(`
    SELECT r.id, r.numero_recibo, r.mes, r.ano, r.pdf_url,
           f.id as fracao_id, f.numero as fracao_numero,
           f.proprietario_nome, f.proprietario_email, f.proprietario_nif, f.proprietario_morada
    FROM recibos r
    JOIN fracoes f ON f.id = r.fracao_id
    WHERE r.mes IN (1,2,3,4,5) AND r.ano = 2026
    ORDER BY r.mes, f.numero
  `);

  console.log(`Total recibos a regenerar: ${recibosResult.rows.length}`);

  let ok = 0;
  let erros = 0;

  for (const recibo of recibosResult.rows) {
    try {
      const mes = recibo.mes;
      const ano = recibo.ano;
      const mesNome = MESES[mes];
      const fracaoId = recibo.fracao_id;
      const fracaoNumero = recibo.fracao_numero;
      const numeroRecibo = recibo.numero_recibo;

      // Load ALL paid quotas for this fracao/mes/ano
      const quotasResult = await client.execute({
        sql: `SELECT tipo, valor, fundo_reserva, quota_tipo_id, observacoes, data_pagamento, metodo_pagamento
              FROM quotas
              WHERE fracao_id = ? AND mes = ? AND ano = ? AND pago = 1
              ORDER BY tipo`,
        args: [fracaoId, mes, ano]
      });

      const quotas = quotasResult.rows;
      if (quotas.length === 0) {
        console.log(`  SKIP ${fracaoNumero} ${mes}/${ano} — sem quotas pagas`);
        continue;
      }

      const venc = new Date(ano, mes - 1, 10);
      const vencStr = venc.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });

      const linhas = [];
      let total = 0;
      let metodoPagamento = "Transferência";

      for (const q of quotas) {
        const dataPag = q.data_pagamento
          ? new Date(q.data_pagamento * 1000).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })
          : "—";

        if (q.metodo_pagamento) metodoPagamento = q.metodo_pagamento;

        if (q.tipo === "condominio") {
          // Linha 1: Orçamento
          linhas.push({
            fracao: fracaoNumero,
            descricao: `${mesNome} ${ano} - Orçamento`,
            vencimento: vencStr,
            dataPagamento: dataPag,
            valor: q.valor,
          });
          total += Number(q.valor);

          // Linha 2: Fundo de Reserva (se existir)
          if (q.fundo_reserva && Number(q.fundo_reserva) > 0) {
            linhas.push({
              fracao: fracaoNumero,
              descricao: `${mesNome} ${ano} - Fundo de Reserva`,
              vencimento: vencStr,
              dataPagamento: dataPag,
              valor: Number(q.fundo_reserva),
            });
            total += Number(q.fundo_reserva);
          }

        } else if (q.tipo === "extra") {
          // Linha separada por tipo de extra
          let descricao;
          if (q.quota_tipo_id && tipoNomes[q.quota_tipo_id]) {
            descricao = `${mesNome} ${ano} - ${tipoNomes[q.quota_tipo_id]}`;
          } else {
            descricao = q.observacoes ?? `${mesNome} ${ano} - Cota Extra`;
          }
          linhas.push({
            fracao: fracaoNumero,
            descricao,
            vencimento: vencStr,
            dataPagamento: dataPag,
            valor: Number(q.valor),
          });
          total += Number(q.valor);

        } else if (q.tipo === "obras") {
          const descricao = q.observacoes ?? `${mesNome} ${ano} - Fundo de Obras`;
          linhas.push({
            fracao: fracaoNumero,
            descricao,
            vencimento: vencStr,
            dataPagamento: dataPag,
            valor: Number(q.valor),
          });
          total += Number(q.valor);

        } else if (q.tipo === "fundo_reserva") {
          linhas.push({
            fracao: fracaoNumero,
            descricao: `${mesNome} ${ano} - Fundo de Reserva`,
            vencimento: vencStr,
            dataPagamento: dataPag,
            valor: Number(q.valor),
          });
          total += Number(q.valor);
        }
      }

      // dataDocumento = last day of month
      const lastDay = new Date(ano, mes, 0);
      const dataDocumento = lastDay.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });

      const html = buildReciboHtml({
        numeroRecibo,
        dataDocumento,
        proprietarioNome: recibo.proprietario_nome ?? "Proprietário",
        proprietarioMorada: recibo.proprietario_morada ?? "Rua Poeta António Boto, Urbanização da Fonte",
        proprietarioLocalidade: "4785-390 Trofa",
        proprietarioNif: recibo.proprietario_nif,
        linhas,
        total,
        metodoPagamento,
      });

      // Find existing PDF file
      const existingPdfUrl = recibo.pdf_url; // e.g. /api/recibos/pdf/recibo_2026_01_AA_2026.95.pdf
      const existingFilename = existingPdfUrl?.split("/").pop();
      const pdfPath = path.join(PDF_DIR, existingFilename);

      await htmlToPdf(html, pdfPath);

      // Update hash in DB
      const pdfBuffer = fs.readFileSync(pdfPath);
      const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
      
      // Update valor in DB to match what's actually in the PDF (includes extras + obras)
      await client.execute({
        sql: "UPDATE recibos SET valor = ?, hash_sha256 = ? WHERE id = ?",
        args: [total, hash, recibo.id],
      });

      console.log(`✓ ${fracaoNumero} ${mes}/${ano} — ${numeroRecibo} — ${linhas.length} linhas — €${total.toFixed(2)}`);
      ok++;
    } catch (err) {
      console.error(`✗ Erro em recibo ${recibo.numero_recibo}:`, err.message);
      erros++;
    }
  }

  console.log(`\nConcluído: ${ok} PDFs regenerados, ${erros} erros`);
}

main().catch(console.error);
