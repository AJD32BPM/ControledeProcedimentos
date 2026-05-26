/**
 * ============================================================
 * CRON: Notificação automática via WhatsApp Business API
 * ============================================================
 * Roda diariamente às 11h UTC (08h Brasília) via Vercel Cron.
 *
 * Lógica:
 *   - Carrega todos os procedimentos em andamento
 *   - Calcula data limite (instauração + prazo + prorrogação)
 *   - Para cada um que está exatamente a 5 dias ou menos do limite
 *     e ainda não foi notificado, dispara WhatsApp ao encarregado
 *   - Para vencidos não notificados, dispara mensagem de vencimento
 *   - Registra cada disparo na tabela notificacoes_log
 *
 * Variáveis de ambiente necessárias (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (NÃO a anon key — precisa de service role)
 *   WHATSAPP_PHONE_NUMBER_ID    (ID do número Meta Cloud API)
 *   WHATSAPP_ACCESS_TOKEN       (token permanente)
 *   WHATSAPP_TEMPLATE_NAME      (padrão: aviso_prazo_procedimento)
 *   WHATSAPP_TEMPLATE_LANG      (padrão: pt_BR)
 *   CRON_SECRET                 (opcional — proteção contra disparo externo)
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DIAS_AVISO = 5;

function diasAteLimite(p) {
  if (!p.data_instauracao) return null;
  const base = new Date(p.data_instauracao + 'T00:00:00');
  const total = (p.prazo_dias || 0) + (p.prorrogacao_dias || 0);
  const fim = new Date(base);
  fim.setDate(fim.getDate() + total);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24));
}

function normalizarTelefone(t) {
  if (!t) return '';
  let n = String(t).replace(/\D/g, '');
  if (n.length >= 10 && n.length <= 11 && !n.startsWith('55')) n = '55' + n;
  return n;
}

async function enviarWhatsApp(telefone, parametros) {
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: telefone,
    type: 'template',
    template: {
      name: process.env.WHATSAPP_TEMPLATE_NAME || 'aviso_prazo_procedimento',
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: parametros.map(v => ({ type: 'text', text: String(v) })),
        },
      ],
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: json };
}

export default async function handler(req, res) {
  // Proteção opcional: exige header com CRON_SECRET
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  try {
    const { data: procs, error } = await supabase
      .from('procedimentos')
      .select(`
        id, numero, prazo_dias, prorrogacao_dias, data_instauracao, status,
        whatsapp_5d_enviado, whatsapp_vencido_enviado,
        procedimento_tipos(nome),
        encarregados(id, graduacao, nome, telefone)
      `)
      .eq('status', 'andamento');

    if (error) {
      console.error('Erro Supabase:', error);
      return res.status(500).json({ error: 'supabase', detalhe: error.message });
    }

    const resultados = { aviso5d: [], vencido: [], pulados: [] };

    for (const p of procs || []) {
      const dias = diasAteLimite(p);
      if (dias === null) { resultados.pulados.push({ id: p.id, motivo: 'sem_data' }); continue; }

      const tel = normalizarTelefone(p.encarregados?.telefone);
      if (!tel || !p.encarregados) {
        resultados.pulados.push({ id: p.id, motivo: 'sem_encarregado_ou_telefone' });
        continue;
      }

      const nomeEnc = `${p.encarregados.graduacao} ${p.encarregados.nome}`;
      const tipoNome = p.procedimento_tipos?.nome || 'Procedimento';

      // CASO 1 — exatamente 5 dias para vencer (ou menos), e ainda não avisado
      if (dias >= 0 && dias <= DIAS_AVISO && !p.whatsapp_5d_enviado) {
        const r = await enviarWhatsApp(tel, [
          nomeEnc,
          tipoNome,
          p.numero,
          String(dias),
        ]);
        await supabase.from('notificacoes_log').insert({
          procedimento_id: p.id,
          encarregado_id: p.encarregados.id,
          telefone: tel,
          tipo: '5_dias',
          status_envio: r.ok ? 'enviado' : 'erro',
          resposta_api: r.body,
        });
        if (r.ok) {
          await supabase.from('procedimentos').update({ whatsapp_5d_enviado: true }).eq('id', p.id);
        }
        resultados.aviso5d.push({ id: p.id, numero: p.numero, dias, status: r.ok ? 'ok' : 'erro' });
      }

      // CASO 2 — vencido (dias < 0), avisa uma vez
      if (dias < 0 && !p.whatsapp_vencido_enviado) {
        const r = await enviarWhatsApp(tel, [
          nomeEnc,
          tipoNome,
          p.numero,
          String(Math.abs(dias)),
        ]);
        await supabase.from('notificacoes_log').insert({
          procedimento_id: p.id,
          encarregado_id: p.encarregados.id,
          telefone: tel,
          tipo: 'vencido',
          status_envio: r.ok ? 'enviado' : 'erro',
          resposta_api: r.body,
        });
        if (r.ok) {
          await supabase.from('procedimentos').update({ whatsapp_vencido_enviado: true }).eq('id', p.id);
        }
        resultados.vencido.push({ id: p.id, numero: p.numero, atraso: Math.abs(dias), status: r.ok ? 'ok' : 'erro' });
      }
    }

    return res.status(200).json({
      executado_em: new Date().toISOString(),
      total_processados: procs?.length || 0,
      resultados,
    });
  } catch (e) {
    console.error('Erro inesperado:', e);
    return res.status(500).json({ error: 'inesperado', detalhe: e.message });
  }
}
