import { runBankSync } from "./packages/web/src/api/routes/bank";

// ─── Configuração ─────────────────────────────────────────────────────────────
const INTERVALO_EM_HORAS = 6;
const INTERVALO_EM_MS    = INTERVALO_EM_HORAS * 60 * 60 * 1000;

// ─── Ciclo seguro (sem sobreposição) ──────────────────────────────────────────
// Padrão setTimeout recursivo dentro de finally:
// o próximo ciclo só é agendado DEPOIS do ciclo atual terminar por completo,
// eliminando qualquer risco de race condition em caso de sync lento.
async function executarCiclo(): Promise<void> {
  console.log(`\n🚀 [${new Date().toISOString()}] A iniciar sincronização bancária automática...`);
  try {
    await runBankSync();
    console.log(`✅ [${new Date().toISOString()}] Sync concluído com sucesso.`);
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Erro crítico durante o sincronismo:`, error);
  } finally {
    // Só agenda o próximo ciclo após este terminar — nunca em paralelo
    console.log(`😴 Próximo ciclo em ${INTERVALO_EM_HORAS}h (${new Date(Date.now() + INTERVALO_EM_MS).toISOString()})...`);
    setTimeout(executarCiclo, INTERVALO_EM_MS);
  }
}

// Arranca imediatamente ao iniciar o processo
executarCiclo();
