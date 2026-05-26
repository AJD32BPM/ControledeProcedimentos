// ============================================================
// PATENTES (Polícia Militar)
// ============================================================
export const PATENTES = [
  'CEL PM','TEN CEL PM','MAJ PM','CAP PM',
  '1º TEN PM','2º TEN PM','ASP PM','SUB TEN PM',
  '1º SGT PM','2º SGT PM','3º SGT PM','CB PM','SD PM',
];

// ============================================================
// STATUS DE PROCEDIMENTOS
// ============================================================
export const STATUS_CALCULADO = {
  dentro_prazo: {
    label: 'Dentro do prazo',
    bg: '#E8F5E9', text: '#1B5E20', border: '#A5D6A7',
    bgDark: 'rgba(46,125,50,0.18)', textDark: '#86efac',
    icone: '✓',
  },
  proximo_vencimento: {
    label: 'Próximo do vencimento',
    bg: '#FFF8E1', text: '#E65100', border: '#FFCC80',
    bgDark: 'rgba(249,168,37,0.18)', textDark: '#fcd34d',
    icone: '⚠',
  },
  vencido: {
    label: 'Vencido',
    bg: '#FFEBEE', text: '#B71C1C', border: '#EF9A9A',
    bgDark: 'rgba(183,28,28,0.20)', textDark: '#fca5a5',
    icone: '✕',
  },
  sobrestado: {
    label: 'Sobrestado',
    bg: '#F3E5F5', text: '#6A1B9A', border: '#CE93D8',
    bgDark: 'rgba(106,27,154,0.18)', textDark: '#d8b4fe',
    icone: '⏸',
  },
  concluido: {
    label: 'Concluído',
    bg: '#ECEFF1', text: '#37474F', border: '#B0BEC5',
    bgDark: 'rgba(55,71,79,0.30)', textDark: '#94a3b8',
    icone: '✔',
  },
};

// ============================================================
// CÁLCULO DE PRAZOS
// ============================================================
export function calcDataLimite(p) {
  if (!p.data_instauracao) return null;
  const base = new Date(p.data_instauracao + 'T00:00:00');
  const total = (p.prazo_dias || 0) + (p.prorrogacao_dias || 0);
  const fim = new Date(base);
  fim.setDate(fim.getDate() + total);
  return fim;
}

export function diasRestantes(p) {
  const fim = calcDataLimite(p);
  if (!fim) return null;
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  return Math.ceil((fim - hoje) / (1000*60*60*24));
}

export function statusCalculado(p) {
  if (p.status === 'concluido')  return 'concluido';
  if (p.status === 'sobrestado') return 'sobrestado';
  const d = diasRestantes(p);
  if (d === null) return 'dentro_prazo';
  if (d < 0)      return 'vencido';
  if (d <= 5)     return 'proximo_vencimento';
  return 'dentro_prazo';
}

export function formatarData(s) {
  if (!s) return '—';
  const d = typeof s === 'string' ? new Date(s + 'T00:00:00') : s;
  return d.toLocaleDateString('pt-BR');
}

export function hojeISO() {
  const d = new Date();
  d.setHours(0,0,0,0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// ============================================================
// VALIDAÇÕES
// ============================================================
export function validarEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
}

// Recebe um telefone livre e devolve apenas dígitos no formato BR.
// Aceita: "(21) 99999-9999", "21999999999", "+5521999999999"
export function normalizarTelefone(t) {
  if (!t) return '';
  let n = String(t).replace(/\D/g, '');
  if (n.length >= 10 && n.length <= 11 && !n.startsWith('55')) n = '55' + n;
  return n;
}

export function formatarTelefone(t) {
  const n = normalizarTelefone(t);
  if (!n) return '—';
  if (n.length === 13) return `+${n.slice(0,2)} (${n.slice(2,4)}) ${n.slice(4,9)}-${n.slice(9)}`;
  if (n.length === 12) return `+${n.slice(0,2)} (${n.slice(2,4)}) ${n.slice(4,8)}-${n.slice(8)}`;
  return t;
}

// ============================================================
// HASH DE SENHA (browser-compatible bcrypt-like via SubtleCrypto)
// Para simplicidade no plano admin-only, usamos SHA-256 + salt fixo
// derivado do email. Em produção considere migrar para bcrypt server-side.
// ============================================================
export async function hashSenha(senha, email) {
  const salt = 'AJD_2026_' + (email || '').toLowerCase();
  const data = new TextEncoder().encode(salt + ':' + senha);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2,'0'))
    .join('');
}

// ============================================================
// EXPORT CSV
// ============================================================
export function exportarCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => {
      let v = r[h];
      if (v === null || v === undefined) return '';
      v = String(v).replace(/"/g, '""');
      return `"${v}"`;
    }).join(';')),
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
