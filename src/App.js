import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  PATENTES,
  STATUS_CALCULADO,
  calcDataLimite,
  diasRestantes,
  statusCalculado,
  formatarData,
  hojeISO,
  validarEmail,
  normalizarTelefone,
  formatarTelefone,
  hashSenha,
  exportarCSV,
} from './utils';

// ============================================================
// ESTILOS BASE (compartilhados)
// ============================================================
const inp = {
  width:'100%', padding:'10px 14px', borderRadius:8,
  border:'1.5px solid rgba(255,255,255,0.1)', fontSize:14,
  color:'#e2e8f0', background:'rgba(255,255,255,0.04)',
  boxSizing:'border-box', outline:'none',
  transition:'border-color 0.2s, background 0.2s',
};
const lbl = {
  display:'block', fontSize:10, fontWeight:800, color:'#64748b',
  marginBottom:6, textTransform:'uppercase', letterSpacing:1.5,
};
const btnPrimary = {
  display:'block', width:'100%', padding:'13px',
  background:'#fbbf24', color:'#000', border:'none', borderRadius:8,
  fontWeight:800, fontSize:13, cursor:'pointer', marginTop:12,
  letterSpacing:'0.12em', textTransform:'uppercase',
};
const btnGhost = {
  background:'rgba(255,255,255,0.05)', color:'#cbd5e1',
  border:'1px solid rgba(255,255,255,0.1)', borderRadius:8,
  padding:'8px 14px', cursor:'pointer', fontSize:11, fontWeight:700,
  letterSpacing:'0.1em', textTransform:'uppercase',
};
const btnSm = {
  padding:'6px 12px', borderRadius:7, fontWeight:700, fontSize:11,
  cursor:'pointer', border:'none', letterSpacing:'0.06em',
  textTransform:'uppercase',
};

// ============================================================
// COMPONENTES VISUAIS REUTILIZÁVEIS
// ============================================================
function Toast({ msg, tipo }) {
  if (!msg) return null;
  const cores = {
    ok:    { bg:'#1B5E20', border:'#4CAF50' },
    erro:  { bg:'#B71C1C', border:'#EF5350' },
    info:  { bg:'#1565C0', border:'#42A5F5' },
  };
  const c = cores[tipo] || cores.info;
  return (
    <div style={{
      position:'fixed', bottom:24, right:24, zIndex:9999,
      background:c.bg, color:'#fff', padding:'14px 20px',
      borderRadius:10, border:`1px solid ${c.border}`,
      boxShadow:'0 10px 40px rgba(0,0,0,0.4)', fontWeight:600, fontSize:13,
      maxWidth:360,
    }}>{msg}</div>
  );
}

function StatusBadge({ status, dark = false }) {
  const s = STATUS_CALCULADO[status] || STATUS_CALCULADO.dentro_prazo;
  const bg = dark ? s.bgDark : s.bg;
  const tx = dark ? s.textDark : s.text;
  return (
    <span style={{
      background:bg, color:tx, padding:'4px 10px', borderRadius:20,
      fontSize:10, fontWeight:800, letterSpacing:'0.08em',
      textTransform:'uppercase', whiteSpace:'nowrap',
      border:dark ? 'none' : `1px solid ${s.border}`,
    }}>
      {s.icone} {s.label}
    </span>
  );
}

function SectionTitle({ icone, titulo, sub }) {
  return (
    <div style={{ marginBottom:18, paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
        <div style={{ width:3, height:22, background:'#fbbf24' }} />
        <h2 className="font-heading" style={{ color:'#fff', fontWeight:700, fontSize:24, margin:0 }}>
          {icone} {titulo}
        </h2>
      </div>
      {sub && <p style={{ color:'#475569', fontSize:12, marginLeft:13 }}>{sub}</p>}
    </div>
  );
}

function CardKPI({ valor, label, cor, icone, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:'#0d1a2e',
      border:'1px solid rgba(255,255,255,0.06)',
      borderLeft:`4px solid ${cor}`,
      borderRadius:12, padding:'18px 20px',
      cursor:onClick ? 'pointer' : 'default',
      transition:'transform 0.15s, border-color 0.15s',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.transform='translateY(-2px)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <span style={{ color:'#64748b', fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase' }}>{label}</span>
        <span style={{ fontSize:22 }}>{icone}</span>
      </div>
      <div className="font-heading" style={{ color:'#fff', fontWeight:700, fontSize:36, lineHeight:1 }}>{valor}</div>
    </div>
  );
}

// ============================================================
// LOGIN
// ============================================================
function TelaLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro]   = useState('');
  const [loading, setLoading] = useState(false);

  async function entrar() {
    setErro('');
    if (!validarEmail(email)) { setErro('Email inválido.'); return; }
    if (!senha) { setErro('Informe a senha.'); return; }
    setLoading(true);
    try {
      const hash = await hashSenha(senha, email);
      const { data } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('ativo', true)
        .single();
      if (!data || data.senha_hash !== hash) {
        setErro('Email ou senha incorretos.');
      } else {
        await supabase.from('admins').update({ ultimo_acesso: new Date().toISOString() }).eq('id', data.id);
        onLogin(data);
      }
    } catch (e) {
      setErro('Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ color:'#475569', fontSize:12, marginBottom:20 }}>
        Acesso restrito a administradores autorizados.
      </p>
      <label style={lbl}>Email</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="seu.email@instituicao.gov.br" style={{ ...inp, marginBottom:14 }} autoComplete="username" />
      <label style={lbl}>Senha</label>
      <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && entrar()} placeholder="••••••••"
        style={{ ...inp, marginBottom:6 }} autoComplete="current-password" />
      {erro && <p style={{ color:'#f87171', fontSize:12, marginBottom:4 }}>{erro}</p>}
      <button onClick={entrar} disabled={loading} style={btnPrimary}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ procedimentos, tipos, onIrPara }) {
  const total = procedimentos.length;
  const porStatus = procedimentos.reduce((acc, p) => {
    const s = statusCalculado(p);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const dentro = porStatus.dentro_prazo || 0;
  const proximo = porStatus.proximo_vencimento || 0;
  const vencido = porStatus.vencido || 0;
  const sobrestado = porStatus.sobrestado || 0;
  const concluido = porStatus.concluido || 0;
  const ativos = total - concluido;

  const porTipo = tipos.map(t => ({
    nome: t.nome,
    quantidade: procedimentos.filter(p => p.tipo_id === t.id && p.status !== 'concluido').length,
  })).filter(t => t.quantidade > 0);

  const pieData = [
    { name:'Dentro do prazo',   value:dentro,     fill:'#22c55e' },
    { name:'Próximo do venc.',  value:proximo,    fill:'#f59e0b' },
    { name:'Vencidos',          value:vencido,    fill:'#ef4444' },
    { name:'Sobrestados',       value:sobrestado, fill:'#a855f7' },
  ].filter(d => d.value > 0);

  const proximosFim = procedimentos
    .filter(p => p.status === 'andamento')
    .map(p => ({ ...p, _dias: diasRestantes(p) }))
    .filter(p => p._dias !== null && p._dias <= 10)
    .sort((a, b) => a._dias - b._dias)
    .slice(0, 6);

  return (
    <div>
      <SectionTitle icone="📊" titulo="Dashboard" sub="Visão geral dos procedimentos administrativos em andamento" />

      <div style={{
        display:'grid', gap:14,
        gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))',
        marginBottom:24,
      }}>
        <CardKPI valor={total}      label="Total cadastrados" cor="#fbbf24" icone="📋" onClick={() => onIrPara('procedimentos')} />
        <CardKPI valor={ativos}     label="Em andamento"      cor="#3b82f6" icone="⚡" onClick={() => onIrPara('procedimentos')} />
        <CardKPI valor={dentro}     label="Dentro do prazo"   cor="#22c55e" icone="✓" />
        <CardKPI valor={proximo}    label="Próx. vencimento"  cor="#f59e0b" icone="⚠" />
        <CardKPI valor={vencido}    label="Vencidos"          cor="#ef4444" icone="✕" />
        <CardKPI valor={sobrestado} label="Sobrestados"       cor="#a855f7" icone="⏸" />
      </div>

      <div style={{ display:'grid', gap:18, gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))', marginBottom:24 }}>
        {/* Pizza por status */}
        <div style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'18px 20px' }}>
          <h3 style={{ color:'#fbbf24', fontSize:11, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:14 }}>
            Distribuição por status
          </h3>
          {pieData.length === 0 ? (
            <div style={{ textAlign:'center', color:'#475569', padding:60, fontSize:13 }}>Sem procedimentos ativos</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'#0a1428', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8 }} />
                <Legend wrapperStyle={{ fontSize:11, color:'#cbd5e1' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Barras por tipo */}
        <div style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'18px 20px' }}>
          <h3 style={{ color:'#fbbf24', fontSize:11, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:14 }}>
            Procedimentos ativos por tipo
          </h3>
          {porTipo.length === 0 ? (
            <div style={{ textAlign:'center', color:'#475569', padding:60, fontSize:13 }}>Sem dados ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porTipo} margin={{ top:5, right:8, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="nome" stroke="#64748b" fontSize={10} angle={-15} textAnchor="end" height={56} interval={0} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background:'#0a1428', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8 }} />
                <Bar dataKey="quantidade" fill="#fbbf24" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Próximos vencimentos */}
      <div style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'18px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ color:'#fbbf24', fontSize:11, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase', margin:0 }}>
            ⏰ Próximos a vencer (≤ 10 dias)
          </h3>
          <button onClick={() => onIrPara('procedimentos')} style={btnGhost}>Ver todos →</button>
        </div>
        {proximosFim.length === 0 ? (
          <div style={{ textAlign:'center', color:'#475569', padding:30, fontSize:13 }}>Nenhum procedimento próximo do vencimento 🎉</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {proximosFim.map(p => (
              <div key={p.id} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
                background:'rgba(255,255,255,0.02)', padding:'10px 14px', borderRadius:8,
                borderLeft:`3px solid ${p._dias < 0 ? '#ef4444' : p._dias <= 5 ? '#f59e0b' : '#22c55e'}`,
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#fff', fontSize:13, fontWeight:700 }}>
                    {p.tipo_nome} · Nº {p.numero}
                  </div>
                  <div style={{ color:'#64748b', fontSize:11, marginTop:2 }}>
                    Encarregado: {p.encarregado_label || '—'} · Limite: {formatarData(calcDataLimite(p))}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="font-heading" style={{
                    color:p._dias < 0 ? '#ef4444' : p._dias <= 5 ? '#fbbf24' : '#22c55e',
                    fontWeight:700, fontSize:22, lineHeight:1,
                  }}>
                    {p._dias < 0 ? `${Math.abs(p._dias)}` : p._dias}
                  </div>
                  <div style={{ color:'#64748b', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase' }}>
                    {p._dias < 0 ? 'dias atrasado' : 'dias restantes'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MODAL DE PROCEDIMENTO (criar / editar)
// ============================================================
function ModalProcedimento({ proc, tipos, encarregados, onFechar, onSalvar, adminId }) {
  const [f, setF] = useState(proc || {
    numero:'',
    tipo_id: tipos[0]?.id || '',
    encarregado_id:'',
    data_instauracao: hojeISO(),
    prazo_dias: tipos[0]?.prazo_dias || 30,
    prorrogacao_dias: 0,
    data_prorrogacao: null,
    status:'andamento',
    portaria_numero:'',
    portaria_data: null,
    objeto:'',
    observacoes:'',
    data_conclusao: null,
    desfecho:'',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Quando troca o tipo, atualiza o prazo padrão (se ainda for igual ao default anterior)
  function handleTipo(novoTipoId) {
    const tipo = tipos.find(t => t.id === novoTipoId);
    setF(prev => ({ ...prev, tipo_id: novoTipoId, prazo_dias: tipo?.prazo_dias || prev.prazo_dias }));
  }

  function set(k, v) { setF(prev => ({ ...prev, [k]: v })); }

  async function salvar() {
    setErro('');
    if (!f.numero.trim()) { setErro('Informe o número do procedimento.'); return; }
    if (!f.tipo_id) { setErro('Selecione o tipo.'); return; }
    if (!f.data_instauracao) { setErro('Informe a data de instauração.'); return; }
    if (!f.prazo_dias || f.prazo_dias < 1) { setErro('Prazo inválido.'); return; }

    setSalvando(true);
    const payload = {
      numero: f.numero.trim(),
      tipo_id: f.tipo_id,
      encarregado_id: f.encarregado_id || null,
      data_instauracao: f.data_instauracao,
      prazo_dias: Number(f.prazo_dias),
      prorrogacao_dias: Number(f.prorrogacao_dias) || 0,
      data_prorrogacao: f.data_prorrogacao || null,
      status: f.status,
      portaria_numero: f.portaria_numero || null,
      portaria_data: f.portaria_data || null,
      objeto: f.objeto || null,
      observacoes: f.observacoes || null,
      data_conclusao: f.data_conclusao || null,
      desfecho: f.desfecho || null,
    };

    let res;
    if (proc?.id) {
      res = await supabase.from('procedimentos').update(payload).eq('id', proc.id);
    } else {
      res = await supabase.from('procedimentos').insert({ ...payload, created_by: adminId });
    }
    setSalvando(false);
    if (res.error) { setErro('Erro ao salvar: ' + res.error.message); return; }

    await supabase.from('historico_procedimento').insert({
      procedimento_id: proc?.id || null,
      admin_id: adminId,
      acao: proc?.id ? 'edicao' : 'criacao',
      detalhes: `Procedimento ${proc?.id ? 'editado' : 'criado'}: ${f.numero}`,
    });

    onSalvar();
  }

  const tipo = tipos.find(t => t.id === f.tipo_id);
  const maxProrrog = tipo?.prorrogacao_dias || 0;
  const podeProrrogar = maxProrrog > 0;

  return (
    <div onClick={onFechar} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'#0d1a2e', borderRadius:14, padding:'24px 28px',
        maxWidth:720, width:'100%', maxHeight:'90vh', overflow:'auto',
        border:'1px solid rgba(255,255,255,0.08)',
        boxShadow:'0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 className="font-heading" style={{ color:'#fff', fontSize:22, fontWeight:700 }}>
            {proc?.id ? '✏️ Editar Procedimento' : '➕ Novo Procedimento'}
          </h2>
          <button onClick={onFechar} style={{ ...btnGhost, padding:'6px 12px' }}>✕</button>
        </div>

        <div style={{ display:'grid', gap:14, gridTemplateColumns:'1fr 1fr' }}>
          <div>
            <label style={lbl}>Nº do procedimento *</label>
            <input value={f.numero} onChange={e => set('numero', e.target.value)} placeholder="Ex: 001/2026" style={inp} />
          </div>
          <div>
            <label style={lbl}>Tipo *</label>
            <select value={f.tipo_id} onChange={e => handleTipo(e.target.value)} style={inp}>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Data de instauração *</label>
            <input type="date" value={f.data_instauracao || ''} onChange={e => set('data_instauracao', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Encarregado</label>
            <select value={f.encarregado_id || ''} onChange={e => set('encarregado_id', e.target.value)} style={inp}>
              <option value="">— sem encarregado —</option>
              {encarregados.map(e => <option key={e.id} value={e.id}>{e.graduacao} {e.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Prazo (dias) *</label>
            <input type="number" min="1" value={f.prazo_dias} onChange={e => set('prazo_dias', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>
              Prorrogação (dias)
              {tipo && <span style={{ color:'#64748b', textTransform:'none', letterSpacing:0, marginLeft:6, fontSize:10 }}>
                — máx. {maxProrrog}
              </span>}
            </label>
            <input
              type="number" min="0" max={maxProrrog}
              value={f.prorrogacao_dias || 0}
              onChange={e => set('prorrogacao_dias', Math.min(Number(e.target.value), maxProrrog))}
              disabled={!podeProrrogar}
              style={{ ...inp, opacity:podeProrrogar ? 1 : 0.5 }}
            />
          </div>

          <div>
            <label style={lbl}>Status</label>
            <select value={f.status} onChange={e => set('status', e.target.value)} style={inp}>
              <option value="andamento">Em andamento</option>
              <option value="sobrestado">Sobrestado</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Data da prorrogação</label>
            <input type="date" value={f.data_prorrogacao || ''} onChange={e => set('data_prorrogacao', e.target.value || null)} style={inp} />
          </div>

          <div style={{ gridColumn:'span 2', marginTop:10, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ color:'#fbbf24', fontSize:10, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:12 }}>
              Origem (portaria)
            </h3>
          </div>
          <div>
            <label style={lbl}>Nº da portaria</label>
            <input value={f.portaria_numero || ''} onChange={e => set('portaria_numero', e.target.value)} style={inp} placeholder="Ex: PORT 045/2026" />
          </div>
          <div>
            <label style={lbl}>Data da portaria</label>
            <input type="date" value={f.portaria_data || ''} onChange={e => set('portaria_data', e.target.value || null)} style={inp} />
          </div>

          <div style={{ gridColumn:'span 2' }}>
            <label style={lbl}>Objeto / assunto</label>
            <textarea value={f.objeto || ''} onChange={e => set('objeto', e.target.value)} style={{ ...inp, minHeight:60, resize:'vertical' }} placeholder="Resumo do que está sendo apurado..." />
          </div>

          <div style={{ gridColumn:'span 2' }}>
            <label style={lbl}>Observações / histórico</label>
            <textarea value={f.observacoes || ''} onChange={e => set('observacoes', e.target.value)} style={{ ...inp, minHeight:80, resize:'vertical' }} placeholder="Andamentos, diligências realizadas, decisões..." />
          </div>

          {f.status === 'concluido' && (
            <>
              <div style={{ gridColumn:'span 2', marginTop:10, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ color:'#fbbf24', fontSize:10, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:12 }}>
                  Conclusão
                </h3>
              </div>
              <div>
                <label style={lbl}>Data da conclusão</label>
                <input type="date" value={f.data_conclusao || ''} onChange={e => set('data_conclusao', e.target.value || null)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Desfecho</label>
                <input value={f.desfecho || ''} onChange={e => set('desfecho', e.target.value)} style={inp} placeholder="Ex: Arquivado, Indiciado..." />
              </div>
            </>
          )}
        </div>

        {erro && <p style={{ color:'#f87171', fontSize:12, marginTop:14 }}>{erro}</p>}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:24 }}>
          <button onClick={onFechar} style={btnGhost}>Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            style={{ ...btnSm, background:'#fbbf24', color:'#000', padding:'10px 24px', fontSize:12 }}>
            {salvando ? 'Salvando...' : (proc?.id ? 'Salvar alterações' : 'Cadastrar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TABELA DE PROCEDIMENTOS
// ============================================================
function TelaProcedimentos({ procedimentos, tipos, encarregados, onRecarregar, adminId, toast }) {
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [editando, setEditando] = useState(null);  // null=fechado, objeto=editar, {} = novo

  function excluir(p) {
    if (!window.confirm(`Excluir o procedimento Nº ${p.numero}?`)) return;
    supabase.from('procedimentos').delete().eq('id', p.id).then(({ error }) => {
      if (error) toast('Erro ao excluir: ' + error.message, 'erro');
      else { toast('Procedimento excluído.', 'ok'); onRecarregar(); }
    });
  }

  const filtrados = procedimentos.filter(p => {
    if (filtroTipo && p.tipo_id !== filtroTipo) return false;
    if (filtroStatus && statusCalculado(p) !== filtroStatus) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const txt = `${p.numero} ${p.tipo_nome} ${p.encarregado_label || ''} ${p.objeto || ''}`.toLowerCase();
      if (!txt.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    // Vencidos primeiro, depois próximos, depois andamento, sobrestado, concluído
    const ordem = { vencido:0, proximo_vencimento:1, dentro_prazo:2, sobrestado:3, concluido:4 };
    return ordem[statusCalculado(a)] - ordem[statusCalculado(b)];
  });

  function exportar() {
    const rows = filtrados.map(p => ({
      numero: p.numero,
      tipo: p.tipo_nome,
      encarregado: p.encarregado_label || '',
      instauracao: formatarData(p.data_instauracao),
      prazo: p.prazo_dias,
      prorrogacao: p.prorrogacao_dias || 0,
      limite: formatarData(calcDataLimite(p)),
      dias_restantes: diasRestantes(p),
      status: STATUS_CALCULADO[statusCalculado(p)]?.label,
      objeto: p.objeto || '',
    }));
    exportarCSV(rows, `procedimentos_${hojeISO()}.csv`);
  }

  return (
    <div>
      <SectionTitle icone="📋" titulo="Procedimentos" sub={`${procedimentos.length} cadastrados · ${filtrados.length} exibidos`} />

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'flex-end' }}>
        <div style={{ flex:'1 1 220px' }}>
          <label style={lbl}>Buscar</label>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nº, tipo, encarregado, objeto..." style={inp} />
        </div>
        <div style={{ flex:'1 1 160px' }}>
          <label style={lbl}>Tipo</label>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={inp}>
            <option value="">Todos</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div style={{ flex:'1 1 160px' }}>
          <label style={lbl}>Status</label>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={inp}>
            <option value="">Todos</option>
            {Object.entries(STATUS_CALCULADO).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={exportar} style={btnGhost}>⬇ CSV</button>
        <button onClick={() => setEditando({})} style={{ ...btnGhost, background:'#fbbf24', color:'#000', borderColor:'#fbbf24' }}>
          + Novo procedimento
        </button>
      </div>

      <div style={{
        background:'#0a1428', border:'1px solid rgba(255,255,255,0.05)', borderRadius:12,
        overflow:'auto', maxHeight:'70vh',
      }}>
        <table className="tbl-proc">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Tipo</th>
              <th>Encarregado</th>
              <th>Instauração</th>
              <th>Prazo</th>
              <th>Limite</th>
              <th>Dias rest.</th>
              <th>Status</th>
              <th style={{ textAlign:'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'#475569' }}>
                {procedimentos.length === 0 ? 'Nenhum procedimento cadastrado. Clique em "Novo procedimento" para começar.' : 'Nenhum resultado para os filtros aplicados.'}
              </td></tr>
            )}
            {filtrados.map(p => {
              const st = statusCalculado(p);
              const dr = diasRestantes(p);
              const limite = calcDataLimite(p);
              const rowClass =
                st === 'vencido' ? 'row-vencido' :
                st === 'proximo_vencimento' ? 'row-proximo' :
                st === 'sobrestado' ? 'row-sobrestado' :
                st === 'concluido' ? 'row-concluido' : '';
              return (
                <tr key={p.id} className={rowClass}>
                  <td style={{ fontWeight:700, color:'#fff' }}>{p.numero}</td>
                  <td>{p.tipo_nome}</td>
                  <td style={{ fontSize:12 }}>{p.encarregado_label || <span style={{ color:'#475569' }}>—</span>}</td>
                  <td style={{ fontSize:12 }}>{formatarData(p.data_instauracao)}</td>
                  <td style={{ fontSize:12 }}>
                    {p.prazo_dias}d
                    {p.prorrogacao_dias > 0 && <span style={{ color:'#a855f7', marginLeft:4 }}>+{p.prorrogacao_dias}d</span>}
                  </td>
                  <td style={{ fontSize:12 }}>{formatarData(limite)}</td>
                  <td style={{ textAlign:'center' }}>
                    {st === 'concluido' || st === 'sobrestado' ? (
                      <span style={{ color:'#475569' }}>—</span>
                    ) : (
                      <span className={dr !== null && dr <= 5 && dr >= 0 ? 'pulse-warn' : (dr < 0 ? 'pulse-danger' : '')}
                        style={{
                          display:'inline-block', minWidth:36, padding:'4px 8px', borderRadius:6,
                          fontWeight:800, fontSize:13,
                          background: dr < 0 ? '#7f1d1d' : dr <= 5 ? '#78350f' : '#14532d',
                          color: dr < 0 ? '#fca5a5' : dr <= 5 ? '#fcd34d' : '#86efac',
                        }}>
                        {dr}
                      </span>
                    )}
                  </td>
                  <td><StatusBadge status={st} dark /></td>
                  <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                    <button onClick={() => setEditando(p)} style={{ ...btnSm, background:'rgba(251,191,36,0.15)', color:'#fbbf24', marginRight:6 }} title="Editar">✏️</button>
                    <button onClick={() => excluir(p)} style={{ ...btnSm, background:'rgba(239,68,68,0.15)', color:'#f87171' }} title="Excluir">🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando !== null && (
        <ModalProcedimento
          proc={editando.id ? editando : null}
          tipos={tipos}
          encarregados={encarregados}
          adminId={adminId}
          onFechar={() => setEditando(null)}
          onSalvar={() => { setEditando(null); onRecarregar(); toast('Procedimento salvo!', 'ok'); }}
        />
      )}
    </div>
  );
}

// ============================================================
// ENCARREGADOS (CRUD)
// ============================================================
function TelaEncarregados({ encarregados, onRecarregar, toast }) {
  const [f, setF] = useState({ graduacao:'CB PM', nome:'', rg:'', telefone:'' });
  const [editandoId, setEditandoId] = useState(null);

  async function salvar() {
    if (!f.nome.trim()) { toast('Informe o nome.', 'erro'); return; }
    const payload = {
      graduacao: f.graduacao,
      nome: f.nome.trim().toUpperCase(),
      rg: f.rg || null,
      telefone: normalizarTelefone(f.telefone) || null,
    };
    let res;
    if (editandoId) res = await supabase.from('encarregados').update(payload).eq('id', editandoId);
    else            res = await supabase.from('encarregados').insert(payload);
    if (res.error) toast('Erro: ' + res.error.message, 'erro');
    else {
      toast(editandoId ? 'Encarregado atualizado.' : 'Encarregado cadastrado.', 'ok');
      setF({ graduacao:'CB PM', nome:'', rg:'', telefone:'' });
      setEditandoId(null);
      onRecarregar();
    }
  }

  function editar(e) {
    setF({ graduacao:e.graduacao, nome:e.nome, rg:e.rg || '', telefone:e.telefone || '' });
    setEditandoId(e.id);
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  async function excluir(e) {
    if (!window.confirm(`Excluir o encarregado ${e.nome}?`)) return;
    const { error } = await supabase.from('encarregados').delete().eq('id', e.id);
    if (error) toast('Erro: ' + error.message, 'erro');
    else { toast('Excluído.', 'ok'); onRecarregar(); }
  }

  return (
    <div>
      <SectionTitle icone="👮" titulo="Encarregados" sub={`${encarregados.length} cadastrados`} />

      <div style={{
        background:'#0d1a2e', border:'1px solid rgba(255,255,255,0.06)',
        borderRadius:12, padding:'18px 20px', marginBottom:20,
      }}>
        <h3 style={{ color:'#fbbf24', fontSize:11, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:14 }}>
          {editandoId ? 'Editar encarregado' : 'Novo encarregado'}
        </h3>
        <div style={{ display:'grid', gap:12, gridTemplateColumns:'140px 1fr 160px 200px auto', alignItems:'flex-end' }}>
          <div>
            <label style={lbl}>Graduação</label>
            <select value={f.graduacao} onChange={e => setF({ ...f, graduacao: e.target.value })} style={inp}>
              {PATENTES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Nome completo</label>
            <input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="NOME COMPLETO" style={inp} />
          </div>
          <div>
            <label style={lbl}>RG / Matrícula</label>
            <input value={f.rg} onChange={e => setF({ ...f, rg: e.target.value })} placeholder="000000-0" style={inp} />
          </div>
          <div>
            <label style={lbl}>Telefone (WhatsApp)</label>
            <input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} placeholder="(21) 99999-9999" style={inp} />
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {editandoId && <button onClick={() => { setF({ graduacao:'CB PM', nome:'', rg:'', telefone:'' }); setEditandoId(null); }} style={btnGhost}>Cancelar</button>}
            <button onClick={salvar} style={{ ...btnGhost, background:'#fbbf24', color:'#000', borderColor:'#fbbf24' }}>
              {editandoId ? 'Salvar' : '+ Adicionar'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ background:'#0a1428', border:'1px solid rgba(255,255,255,0.05)', borderRadius:12, overflow:'hidden' }}>
        <table className="tbl-proc">
          <thead>
            <tr>
              <th>Graduação</th><th>Nome</th><th>RG</th><th>Telefone</th><th style={{ textAlign:'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {encarregados.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:30, color:'#475569' }}>Nenhum encarregado cadastrado.</td></tr>
            )}
            {encarregados.map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight:700, color:'#fbbf24' }}>{e.graduacao}</td>
                <td style={{ color:'#fff' }}>{e.nome}</td>
                <td>{e.rg || <span style={{ color:'#475569' }}>—</span>}</td>
                <td style={{ fontSize:12 }}>{formatarTelefone(e.telefone)}</td>
                <td style={{ textAlign:'right' }}>
                  <button onClick={() => editar(e)} style={{ ...btnSm, background:'rgba(251,191,36,0.15)', color:'#fbbf24', marginRight:6 }}>✏️</button>
                  <button onClick={() => excluir(e)} style={{ ...btnSm, background:'rgba(239,68,68,0.15)', color:'#f87171' }}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// CONFIGURAÇÕES DE TIPOS DE PROCEDIMENTOS (prazos editáveis)
// ============================================================
function TelaTipos({ tipos, onRecarregar, toast }) {
  async function salvar(id, campo, valor) {
    const { error } = await supabase.from('procedimento_tipos').update({ [campo]: Number(valor) }).eq('id', id);
    if (error) toast('Erro: ' + error.message, 'erro');
    else { toast('Atualizado.', 'ok'); onRecarregar(); }
  }

  return (
    <div>
      <SectionTitle icone="⚙️" titulo="Tipos de Procedimentos & Prazos"
        sub="Edite os prazos padrão de cada tipo. Os prazos só afetam procedimentos novos — os existentes mantêm o prazo salvo." />

      <div style={{ background:'#0a1428', border:'1px solid rgba(255,255,255,0.05)', borderRadius:12, overflow:'hidden' }}>
        <table className="tbl-proc">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Prazo padrão (dias)</th>
              <th>Prorrogação máxima (dias)</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {tipos.map(t => (
              <tr key={t.id}>
                <td style={{ color:'#fff', fontWeight:700 }}>{t.nome}</td>
                <td>
                  <input type="number" min="1" defaultValue={t.prazo_dias}
                    onBlur={e => { if (Number(e.target.value) !== t.prazo_dias) salvar(t.id, 'prazo_dias', e.target.value); }}
                    style={{ ...inp, maxWidth:120 }} />
                </td>
                <td>
                  <input type="number" min="0" defaultValue={t.prorrogacao_dias}
                    onBlur={e => { if (Number(e.target.value) !== t.prorrogacao_dias) salvar(t.id, 'prorrogacao_dias', e.target.value); }}
                    style={{ ...inp, maxWidth:120 }} />
                </td>
                <td style={{ color:'#fbbf24', fontWeight:700 }}>{t.prazo_dias + t.prorrogacao_dias} dias</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// ADMINISTRADORES (gestão de usuários)
// ============================================================
function TelaAdmins({ adminLogado, toast }) {
  const [admins, setAdmins] = useState([]);
  const [novo, setNovo] = useState({ email:'', nome:'', graduacao:'CAP PM', senha:'' });

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('admins').select('*').order('created_at', { ascending: true });
    setAdmins(data || []);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function criar() {
    if (!validarEmail(novo.email)) { toast('Email inválido.', 'erro'); return; }
    if (!novo.nome) { toast('Informe o nome.', 'erro'); return; }
    if (!novo.senha || novo.senha.length < 6) { toast('Senha deve ter ao menos 6 caracteres.', 'erro'); return; }
    const hash = await hashSenha(novo.senha, novo.email);
    const { error } = await supabase.from('admins').insert({
      email: novo.email.toLowerCase(),
      nome: novo.nome.toUpperCase(),
      graduacao: novo.graduacao,
      senha_hash: hash,
    });
    if (error) toast('Erro: ' + error.message, 'erro');
    else { toast('Administrador criado.', 'ok'); setNovo({ email:'', nome:'', graduacao:'CAP PM', senha:'' }); carregar(); }
  }

  async function alternarAtivo(a) {
    if (a.id === adminLogado.id) { toast('Você não pode desativar a si mesmo.', 'erro'); return; }
    const { error } = await supabase.from('admins').update({ ativo: !a.ativo }).eq('id', a.id);
    if (error) toast('Erro: ' + error.message, 'erro');
    else { toast(a.ativo ? 'Administrador desativado.' : 'Administrador reativado.', 'ok'); carregar(); }
  }

  async function resetarSenha(a) {
    const nova = window.prompt(`Nova senha para ${a.nome} (mín. 6 caracteres):`);
    if (!nova || nova.length < 6) return;
    const hash = await hashSenha(nova, a.email);
    const { error } = await supabase.from('admins').update({ senha_hash: hash }).eq('id', a.id);
    if (error) toast('Erro: ' + error.message, 'erro');
    else toast('Senha redefinida.', 'ok');
  }

  return (
    <div>
      <SectionTitle icone="🔐" titulo="Administradores" sub="Apenas administradores ativos podem acessar o sistema." />

      <div style={{
        background:'#0d1a2e', border:'1px solid rgba(255,255,255,0.06)',
        borderRadius:12, padding:'18px 20px', marginBottom:20,
      }}>
        <h3 style={{ color:'#fbbf24', fontSize:11, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:14 }}>
          Cadastrar novo administrador
        </h3>
        <div style={{ display:'grid', gap:12, gridTemplateColumns:'140px 1fr 1.2fr 1fr auto', alignItems:'flex-end' }}>
          <div>
            <label style={lbl}>Graduação</label>
            <select value={novo.graduacao} onChange={e => setNovo({ ...novo, graduacao:e.target.value })} style={inp}>
              {PATENTES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Nome</label>
            <input value={novo.nome} onChange={e => setNovo({ ...novo, nome:e.target.value })} placeholder="NOME COMPLETO" style={inp} />
          </div>
          <div>
            <label style={lbl}>Email</label>
            <input value={novo.email} onChange={e => setNovo({ ...novo, email:e.target.value })} placeholder="email@instituicao.gov.br" style={inp} />
          </div>
          <div>
            <label style={lbl}>Senha</label>
            <input type="password" value={novo.senha} onChange={e => setNovo({ ...novo, senha:e.target.value })} placeholder="Mín. 6 caracteres" style={inp} />
          </div>
          <button onClick={criar} style={{ ...btnGhost, background:'#fbbf24', color:'#000', borderColor:'#fbbf24' }}>+ Adicionar</button>
        </div>
      </div>

      <div style={{ background:'#0a1428', border:'1px solid rgba(255,255,255,0.05)', borderRadius:12, overflow:'hidden' }}>
        <table className="tbl-proc">
          <thead>
            <tr>
              <th>Graduação</th><th>Nome</th><th>Email</th>
              <th>Status</th><th>Último acesso</th><th style={{ textAlign:'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(a => (
              <tr key={a.id} style={{ opacity: a.ativo ? 1 : 0.5 }}>
                <td style={{ color:'#fbbf24', fontWeight:700 }}>{a.graduacao}</td>
                <td style={{ color:'#fff' }}>{a.nome}{a.id === adminLogado.id && <span style={{ color:'#22c55e', fontSize:10, marginLeft:6 }}>(você)</span>}</td>
                <td style={{ fontSize:12 }}>{a.email}</td>
                <td>
                  <span style={{
                    fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:10, letterSpacing:'0.1em',
                    background: a.ativo ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: a.ativo ? '#22c55e' : '#f87171',
                  }}>
                    {a.ativo ? 'ATIVO' : 'INATIVO'}
                  </span>
                </td>
                <td style={{ fontSize:11, color:'#94a3b8' }}>
                  {a.ultimo_acesso ? new Date(a.ultimo_acesso).toLocaleString('pt-BR') : 'Nunca'}
                </td>
                <td style={{ textAlign:'right' }}>
                  <button onClick={() => resetarSenha(a)} style={{ ...btnSm, background:'rgba(59,130,246,0.15)', color:'#60a5fa', marginRight:6 }}>🔑</button>
                  <button onClick={() => alternarAtivo(a)} style={{ ...btnSm,
                    background: a.ativo ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    color: a.ativo ? '#f87171' : '#22c55e',
                  }}>{a.ativo ? '🚫' : '✓'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// HEADER + SIDEBAR
// ============================================================
function TopBar({ admin, onSair }) {
  return (
    <div style={{
      background:'#070f1e', borderTop:'3px solid #fbbf24',
      padding:'13px 24px', display:'flex', alignItems:'center', justifyContent:'space-between',
      borderBottom:'1px solid rgba(255,255,255,0.05)',
      boxShadow:'0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          width:38, height:38, background:'linear-gradient(135deg, #fbbf24, #d97706)',
          borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
          fontWeight:900, color:'#0a1428', fontSize:14, letterSpacing:0.5,
        }}>AJD</div>
        <div>
          <div className="font-heading" style={{ color:'#fff', fontWeight:700, fontSize:15, letterSpacing:0.5 }}>
            AJD — Controle de Procedimentos
          </div>
          <div style={{ color:'#475569', fontSize:9, fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase' }}>
            Procedimentos Administrativos · v1.0
          </div>
        </div>
      </div>
      {admin && (
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ color:'#fff', fontSize:12, fontWeight:700 }}>{admin.graduacao} {admin.nome}</div>
            <div style={{ color:'#475569', fontSize:10 }}>{admin.email}</div>
          </div>
          <button onClick={onSair} style={btnGhost}>← Sair</button>
        </div>
      )}
    </div>
  );
}

function MenuLateral({ aba, setAba }) {
  const itens = [
    { id:'dashboard',     label:'Dashboard',     icone:'📊' },
    { id:'procedimentos', label:'Procedimentos', icone:'📋' },
    { id:'encarregados',  label:'Encarregados',  icone:'👮' },
    { id:'tipos',         label:'Tipos & Prazos', icone:'⚙️' },
    { id:'admins',        label:'Administradores', icone:'🔐' },
  ];
  return (
    <div style={{
      background:'#0a1428', borderRadius:12,
      border:'1px solid rgba(255,255,255,0.05)',
      padding:14, display:'flex', flexDirection:'column', gap:4,
    }}>
      {itens.map(i => (
        <button key={i.id} onClick={() => setAba(i.id)} style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'11px 14px', borderRadius:8,
          background: aba === i.id ? 'rgba(251,191,36,0.12)' : 'transparent',
          color: aba === i.id ? '#fbbf24' : '#94a3b8',
          border: aba === i.id ? '1px solid rgba(251,191,36,0.25)' : '1px solid transparent',
          cursor:'pointer', fontWeight:700, fontSize:13,
          textAlign:'left', letterSpacing:'0.04em',
          transition:'all 0.15s',
        }}>
          <span style={{ fontSize:16 }}>{i.icone}</span>
          {i.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// APP RAIZ
// ============================================================
export default function App() {
  const [admin, setAdmin] = useState(null);
  const [aba, setAba] = useState('dashboard');
  const [procedimentos, setProcedimentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [encarregados, setEncarregados] = useState([]);
  const [toastMsg, setToastMsg] = useState({ msg:'', tipo:'info' });
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sessão
  useEffect(() => {
    try {
      const s = sessionStorage.getItem('ajd_admin');
      if (s) setAdmin(JSON.parse(s));
    } catch {}
  }, []);

  function fazerLogin(a) {
    sessionStorage.setItem('ajd_admin', JSON.stringify(a));
    setAdmin(a);
  }

  function sair() {
    sessionStorage.removeItem('ajd_admin');
    setAdmin(null);
    setAba('dashboard');
  }

  function toast(msg, tipo = 'info') {
    setToastMsg({ msg, tipo });
    setTimeout(() => setToastMsg({ msg:'', tipo:'info' }), 3500);
  }

  // Loader de dados
  const carregar = useCallback(async () => {
    const [pRes, tRes, eRes] = await Promise.all([
      supabase.from('procedimentos').select('*, procedimento_tipos(nome), encarregados(graduacao, nome, telefone)').order('created_at', { ascending: false }),
      supabase.from('procedimento_tipos').select('*').order('ordem'),
      supabase.from('encarregados').select('*').order('nome'),
    ]);
    const procs = (pRes.data || []).map(p => ({
      ...p,
      tipo_nome: p.procedimento_tipos?.nome || p.tipo_id,
      encarregado_label: p.encarregados ? `${p.encarregados.graduacao} ${p.encarregados.nome}` : null,
      encarregado_telefone: p.encarregados?.telefone || null,
    }));
    setProcedimentos(procs);
    setTipos(tRes.data || []);
    setEncarregados(eRes.data || []);
  }, []);

  useEffect(() => {
    if (admin) carregar();
  }, [admin, carregar]);

  // ============== LOGIN SCREEN ==============
  if (!admin) {
    return (
      <div style={{ minHeight:'100vh', background:'#070f1e' }}>
        <TopBar admin={null} />
        <div className="login-split" style={{
          minHeight:'calc(100vh - 58px)',
          flexDirection: isDesktop ? 'row' : 'column',
        }}>
          {isDesktop && (
            <div className="login-left" style={{
              display:'flex', flexDirection:'column', justifyContent:'flex-end',
              width:'58%', flexShrink:0, position:'relative',
              padding:'0 48px 64px 64px', overflow:'hidden',
              background:'linear-gradient(135deg, #0a1428 0%, #1a3a5c 100%)',
            }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'#fbbf24' }} />
              <div style={{ position:'relative', zIndex:1 }}>
                <div style={{
                  width:88, height:88, marginBottom:20,
                  background:'linear-gradient(135deg, #fbbf24, #d97706)',
                  borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:900, color:'#0a1428', fontSize:30, letterSpacing:1,
                  boxShadow:'0 12px 32px rgba(0,0,0,0.5)',
                }}>AJD</div>
                <p style={{ color:'#fbbf24', fontSize:10, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase', margin:'0 0 14px' }}>
                  Assessoria Jurídica · Procedimentos
                </p>
                <h1 className="font-heading" style={{ color:'#fff', fontWeight:700, fontSize:64, lineHeight:1, margin:'0 0 10px', letterSpacing:'-1px' }}>
                  Controle de<br/>Procedimentos
                </h1>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
                  <div style={{ width:48, height:1, background:'#fbbf24' }} />
                  <span style={{ color:'#94a3b8', fontSize:13, letterSpacing:'0.12em' }}>Administrativos · Disciplinares</span>
                </div>
                <p style={{ color:'#cbd5e1', fontSize:16, fontWeight:500, margin:'0 0 8px', maxWidth:420, lineHeight:1.5 }}>
                  Gestão de Averiguações, IPMs, Sindicâncias, Inquéritos e Pareceres Técnicos com controle automático de prazos.
                </p>
                <ul style={{ color:'#94a3b8', fontSize:12, lineHeight:1.9, marginTop:18, listStyle:'none', padding:0 }}>
                  <li>✓ Alertas visuais de vencimento</li>
                  <li>✓ Notificação automática via WhatsApp</li>
                  <li>✓ Prorrogação conforme legislação</li>
                  <li>✓ Histórico e auditoria</li>
                </ul>
              </div>
            </div>
          )}

          <div className="login-right" style={{ flex: isDesktop ? 1 : 'initial', width: isDesktop ? 'auto' : '100%' }}>
            <div style={{ width:'100%', maxWidth:360 }}>
              <div style={{ marginBottom:32 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                  <div style={{ width:28, height:1, background:'#fbbf24' }} />
                  <span style={{ color:'#fbbf24', fontSize:9, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase' }}>Acesso Restrito</span>
                </div>
                <h2 className="font-heading" style={{ color:'#fff', fontWeight:700, fontSize:48, margin:'0 0 8px', lineHeight:1 }}>Entrar</h2>
                <p style={{ color:'#475569', fontSize:12, margin:0 }}>Acesso restrito a administradores.</p>
              </div>
              <TelaLogin onLogin={fazerLogin} />
              <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:32 }}>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.04)' }} />
                <span style={{ fontSize:9, color:'#334155', fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase' }}>AJD · Sistema Interno</span>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.04)' }} />
              </div>
            </div>
          </div>
        </div>
        <Toast msg={toastMsg.msg} tipo={toastMsg.tipo} />
      </div>
    );
  }

  // ============== APP LOGADO ==============
  return (
    <div style={{ minHeight:'100vh', background:'#070f1e' }}>
      <TopBar admin={admin} onSair={sair} />
      <div style={{
        maxWidth:1400, margin:'24px auto', padding:'0 16px',
        display:'grid', gap:18,
        gridTemplateColumns: isDesktop ? '220px 1fr' : '1fr',
      }}>
        <MenuLateral aba={aba} setAba={setAba} />
        <div style={{
          background:'#0d1a2e', border:'1px solid rgba(255,255,255,0.05)',
          borderRadius:12, padding:'28px 26px', color:'#e2e8f0',
          boxShadow:'0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.25)',
        }}>
          {aba === 'dashboard'     && <Dashboard procedimentos={procedimentos} tipos={tipos} onIrPara={setAba} />}
          {aba === 'procedimentos' && <TelaProcedimentos procedimentos={procedimentos} tipos={tipos} encarregados={encarregados} onRecarregar={carregar} adminId={admin.id} toast={toast} />}
          {aba === 'encarregados'  && <TelaEncarregados encarregados={encarregados} onRecarregar={carregar} toast={toast} />}
          {aba === 'tipos'         && <TelaTipos tipos={tipos} onRecarregar={carregar} toast={toast} />}
          {aba === 'admins'        && <TelaAdmins adminLogado={admin} toast={toast} />}
        </div>
      </div>
      <Toast msg={toastMsg.msg} tipo={toastMsg.tipo} />
    </div>
  );
}
