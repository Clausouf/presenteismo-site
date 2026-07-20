'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ─── Utilitário de exportação Excel (sem dependência externa) ─────────────────
// Gera um arquivo .xlsx mínimo com múltiplas abas usando apenas XML/ZIP nativo.
// Compatível com Excel, Google Sheets e LibreOffice.

function escapeXml(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sheetFromRows(rows: (string | number)[][]): string {
  if (rows.length === 0) return '<sheetData/>';
  const maxCol = Math.max(...rows.map(r => r.length));
  const colLetter = (n: number) => {
    let s = '';
    n++;
    while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const cells = rows.map((row, ri) =>
    row.map((cell, ci) => {
      const ref = `${colLetter(ci)}${ri + 1}`;
      if (typeof cell === 'number') {
        return `<c r="${ref}"><v>${cell}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
    }).join('')
  );
  const sheetData = rows.map((_, ri) => `<row r="${ri + 1}">${cells[ri]}</row>`).join('');
  const lastRef = `${colLetter(maxCol - 1)}${rows.length}`;
  return `<sheetData><dimension ref="A1:${lastRef}"/>${sheetData}</sheetData>`;
}

function buildXlsx(sheets: { name: string; rows: (string | number)[][] }[]): Blob {
  // Monta o ZIP manualmente (formato OOXML sem compressão — stored)
  const enc = new TextEncoder();

  const sheetXmls = sheets.map(
    (s, i) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${sheetFromRows(s.rows)}
</worksheet>`
  );

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('\n    ')}
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n  ')}
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n  ')}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // Monta entradas do ZIP
  type ZipEntry = { name: string; data: Uint8Array };
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRels) },
    ...sheetXmls.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(xml) })),
  ];

  // Serializa ZIP (método stored — sem compressão)
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  const u16 = (n: number) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
  const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };

  function crc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    for (const byte of data) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header
    const localHeader = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, // signature
      0x14, 0x00,             // version needed
      0x00, 0x00,             // flags
      0x00, 0x00,             // compression (stored)
      0x00, 0x00, 0x00, 0x00, // mod time/date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0x00, 0x00,             // extra field length
      ...nameBytes,
    ]);

    // Central directory entry
    const cdEntry = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, // signature
      0x14, 0x00,             // version made by
      0x14, 0x00,             // version needed
      0x00, 0x00,             // flags
      0x00, 0x00,             // compression
      0x00, 0x00, 0x00, 0x00, // mod time/date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0x00, 0x00,             // extra
      0x00, 0x00,             // comment
      0x00, 0x00,             // disk start
      0x00, 0x00,             // internal attr
      0x00, 0x00, 0x00, 0x00, // external attr
      ...u32(offset),
      ...nameBytes,
    ]);

    parts.push(localHeader, entry.data);
    centralDir.push(cdEntry);
    offset += localHeader.length + size;
  }

  const cdOffset = offset;
  const cdSize = centralDir.reduce((a, b) => a + b.length, 0);

  const eocd = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, // signature
    0x00, 0x00,             // disk number
    0x00, 0x00,             // disk with CD
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(cdSize),
    ...u32(cdOffset),
    0x00, 0x00,             // comment length
  ]);

  const allParts = [...parts, ...centralDir, eocd];
  const total = allParts.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const p of allParts) { result.set(p, pos); pos += p.length; }

  return new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardBase({ tipo }: { tipo: 'treinamento' | 'recrutamento' }) {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState({ turmas: [], colabs: [], diario: [], salas: [] });

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [selectedOp, setSelectedOp] = useState('Todas');
  const [selectedTurma, setSelectedTurma] = useState('Todas');

  useEffect(() => {
    async function carregarDados() {
      setLoading(true);
      const [t, c, d, s] = await Promise.all([
        supabase.from('turmas').select('*, operacoes(nome)'),
        supabase.from('colaboradores').select('*'),
        supabase.from('diario_presenca').select('*'),
        supabase.from('salas').select('*')
      ]);
      setRaw({ turmas: t.data || [], colabs: c.data || [], diario: d.data || [], salas: s.data || [] });
      setLoading(false);
    }
    carregarDados();
  }, []);

  const data = useMemo(() => {
    if (loading) return null;

    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const normalize = (s: string) =>
      s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const turmaLookup = new Map();
    raw.turmas.forEach(t => {
      turmaLookup.set(t.numero_turma, t.operacoes?.nome || 'Sem Operação');
    });

    const filteredTurmas = raw.turmas.filter(t =>
      (selectedOp === 'Todas' || t.operacoes?.nome === selectedOp) &&
      (selectedTurma === 'Todas' || t.numero_turma === selectedTurma)
    );
    const validTurmaNumbers = filteredTurmas.map(t => t.numero_turma);

    // ─── PASSO 1: métricas individuais por colaborador ────────────────────────
    const metricsAll = raw.colabs
      .filter(c => validTurmaNumbers.includes(c.numero_turma))
      .map(c => {
        const logs = raw.diario.filter(l =>
          l.matricula === c.matricula &&
          l.numero_turma === c.numero_turma &&
          new Date(l.data) >= startOfMonth &&
          new Date(l.data) <= endOfMonth
        );

        const totalDiasEsperados = logs.length;
        const logsNormalized = logs.map(l => normalize(l.tipo_registro));

        const countAbs      = logsNormalized.filter(t => t.includes('falta')).length;
        const countPresenca = logsNormalized.filter(t => t.includes('presenca') || t.includes('presente')).length;
        const countTO       = logsNormalized.filter(t =>
          ['desistencia', 'desligamento', 'desligamento a pedido'].includes(t)
        ).length;

        // Recrutamento: zero presenças no período (nunca compareceu)
        // Treinamento : pelo menos uma presença no período
        const category: 'recrutamento' | 'treinamento' =
          countPresenca === 0 && countAbs > 0 ? 'recrutamento' : 'treinamento';

        return {
          category,
          matricula: c.matricula,
          nome: c.nome || c.matricula,
          countAbs,
          countTO,
          countPresenca,
          totalDiasEsperados,
          op: turmaLookup.get(c.numero_turma) || 'Sem Operação',
          turma: c.numero_turma,
        };
      });

    // ─── PASSO 2: turmas que têm ao menos 1 pessoa da categoria ──────────────
    const turmasComCategoria = new Set(
      metricsAll.filter(m => m.category === tipo).map(m => m.turma)
    );

    // ─── PASSO 3: ABS/TO por turma com denominador = total da turma ──────────
    const turmasUnicas = [...turmasComCategoria];

    const rankingTurmas = turmasUnicas.map(tNum => {
      const todosDaTurma     = metricsAll.filter(m => m.turma === tNum);
      const categoriaDaTurma = todosDaTurma.filter(m => m.category === tipo);

      const totalDiasEsperadosTurma = todosDaTurma.reduce((acc, m) => acc + m.totalDiasEsperados, 0);
      const absCategoria = categoriaDaTurma.reduce((acc, m) => acc + m.countAbs, 0);
      const toCategoria  = categoriaDaTurma.reduce((acc, m) => acc + m.countTO, 0);

      return {
        turma: tNum,
        op: todosDaTurma[0]?.op || 'Sem Operação',
        abs: totalDiasEsperadosTurma > 0 ? (absCategoria / totalDiasEsperadosTurma) * 100 : 0,
        to:  totalDiasEsperadosTurma > 0 ? (toCategoria  / totalDiasEsperadosTurma) * 100 : 0,
        _absRaw:  absCategoria,
        _toRaw:   toCategoria,
        _diasRaw: totalDiasEsperadosTurma,
      };
    }).sort((a, b) => b.abs - a.abs);

    // ─── PASSO 4: métricas globais ────────────────────────────────────────────
    const totalDiasGlobal = rankingTurmas.reduce((acc, t) => acc + t._diasRaw, 0);
    const totalAbsGlobal  = rankingTurmas.reduce((acc, t) => acc + t._absRaw, 0);
    const totalToGlobal   = rankingTurmas.reduce((acc, t) => acc + t._toRaw,  0);

    // ─── PASSO 5: ranking por operação ───────────────────────────────────────
    const opsUnicas = [...new Set(rankingTurmas.map(t => t.op))];
    const ranking = opsUnicas.map(op => {
      const turmasDaOp = rankingTurmas.filter(t => t.op === op);
      const opDias = turmasDaOp.reduce((acc, t) => acc + t._diasRaw, 0);
      const opAbs  = turmasDaOp.reduce((acc, t) => acc + t._absRaw, 0);
      const opTo   = turmasDaOp.reduce((acc, t) => acc + t._toRaw,  0);
      return {
        nome: op,
        abs: opDias > 0 ? (opAbs / opDias) * 100 : 0,
        to:  opDias > 0 ? (opTo  / opDias) * 100 : 0,
      };
    });

    // ─── PASSO 6: ocupação de salas ───────────────────────────────────────────
    const salaStats = raw.salas.map(s => {
      let diasEmUso = 0;
      for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const isOccupied = filteredTurmas.some(t => {
          if (t.sala !== s.nome) return false;
          const start = new Date(t.data_inicio);
          const end = t.data_fim ? new Date(t.data_fim) : new Date(2099, 11, 31);
          return d >= start && d <= end;
        });
        if (isOccupied) diasEmUso++;
      }
      return {
        name: s.nome,
        dias: diasEmUso,
        turmas: filteredTurmas.filter(t => t.sala === s.nome).map(t => t.numero_turma),
      };
    }).filter(s => s.dias > 0);

    // ─── PASSO 7: dados para exportação Excel ────────────────────────────────
    // Aba 1 — Resumo do Dashboard
    const resumoRows: (string | number)[][] = [
      ['Dashboard', tipo.toUpperCase()],
      ['Período', selectedMonth],
      ['Operação', selectedOp],
      ['Turma', selectedTurma],
      [],
      ['INDICADOR', 'VALOR'],
      ['Turmas Ativas', filteredTurmas.filter(t => t.status === 'Em Andamento').length],
      ['Turmas Finalizadas', filteredTurmas.filter(t => t.status === 'Finalizada').length],
      ['ABS (%)', parseFloat((totalDiasGlobal > 0 ? (totalAbsGlobal / totalDiasGlobal) * 100 : 0).toFixed(2))],
      ['TO (%)', parseFloat((totalDiasGlobal > 0 ? (totalToGlobal / totalDiasGlobal) * 100 : 0).toFixed(2))],
      [],
      ['RANKING POR OPERAÇÃO'],
      ['Operação', 'ABS (%)', 'TO (%)'],
      ...ranking.map(o => [o.nome, parseFloat(o.abs.toFixed(2)), parseFloat(o.to.toFixed(2))]),
    ];

    // Aba 2 — Ranking por Turma
    const rankingRows: (string | number)[][] = [
      ['Turma', 'Operação', 'ABS (%)', 'TO (%)'],
      ...rankingTurmas.map(t => [
        `Turma ${t.turma}`,
        t.op,
        parseFloat(t.abs.toFixed(2)),
        parseFloat(t.to.toFixed(2)),
      ]),
    ];

    // Aba 3 — Diário de Presença (registros brutos do período filtrado)
    const [y, m] = selectedMonth.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end   = new Date(y, m, 0, 23, 59, 59);

    const diarioFiltrado = raw.diario.filter(l =>
      validTurmaNumbers.includes(l.numero_turma) &&
      new Date(l.data) >= start &&
      new Date(l.data) <= end
    );

    const diarioRows: (string | number)[][] = [
      ['Matrícula', 'Turma', 'Operação', 'Data', 'Tipo de Registro', 'Categoria'],
      ...diarioFiltrado.map(l => {
        const colab = metricsAll.find(m => m.matricula === l.matricula && m.turma === l.numero_turma);
        return [
          l.matricula,
          l.numero_turma,
          turmaLookup.get(l.numero_turma) || 'Sem Operação',
          l.data,
          l.tipo_registro,
          colab?.category?.toUpperCase() || '',
        ];
      }),
    ];

    return {
      ativas:      filteredTurmas.filter(t => t.status === 'Em Andamento').length,
      finalizadas: filteredTurmas.filter(t => t.status === 'Finalizada').length,
      abs: totalDiasGlobal > 0 ? (totalAbsGlobal / totalDiasGlobal) * 100 : 0,
      to:  totalDiasGlobal > 0 ? (totalToGlobal  / totalDiasGlobal) * 100 : 0,
      ranking,
      rankingTurmas,
      salaStats,
      // dados para exportação
      exportSheets: { resumoRows, rankingRows, diarioRows },
    };
  }, [loading, raw, tipo, selectedMonth, selectedOp, selectedTurma]);

  // ─── Handler de exportação ────────────────────────────────────────────────
  function handleExport() {
    if (!data) return;
    const blob = buildXlsx([
      { name: 'Resumo Dashboard', rows: data.exportSheets.resumoRows },
      { name: 'Ranking por Turma',  rows: data.exportSheets.rankingRows },
      { name: 'Diário de Presença', rows: data.exportSheets.diarioRows },
    ]);
    const label = tipo === 'treinamento' ? 'Treinamento' : 'Recrutamento';
    downloadBlob(blob, `Dashboard_${label}_${selectedMonth}.xlsx`);
  }

  if (loading || !data) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-4 space-y-4">
      {/* Navegação entre dashboards */}
      <div className="flex gap-2">
        <Link href="/dashboard/treinamento" className={`px-4 py-2 rounded-lg text-sm font-bold ${tipo === 'treinamento' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 border'}`}>Treinamento</Link>
        <Link href="/dashboard/recrutamento" className={`px-4 py-2 rounded-lg text-sm font-bold ${tipo === 'recrutamento' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border'}`}>Recrutamento</Link>
      </div>

      {/* Filtros + botão de exportação */}
      <div className="flex flex-wrap items-center bg-white p-3 rounded-lg shadow gap-3">
        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border p-1.5 text-sm rounded" />
        <select onChange={(e) => setSelectedOp(e.target.value)} className="border p-1.5 text-sm rounded">
          <option value="Todas">Todas Operações</option>
          {[...new Set(raw.turmas.map(t => t.operacoes?.nome).filter(Boolean))].map(op => <option key={op} value={op}>{op}</option>)}
        </select>
        <select onChange={(e) => setSelectedTurma(e.target.value)} className="border p-1.5 text-sm rounded">
          <option value="Todas">Todas Turmas</option>
          {[...new Set(raw.turmas.map(t => t.numero_turma))].map(num => <option key={num} value={num}>Turma {num}</option>)}
        </select>

        {/* ── Botão exportar Excel ── */}
        <button
          onClick={handleExport}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 active:scale-95 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar Excel
        </button>
      </div>

      {/* Cards de indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded shadow border-l-4 border-blue-500"><p className="text-[10px] font-bold text-gray-500">ATIVAS</p><p className="text-lg font-bold">{data.ativas}</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-green-500"><p className="text-[10px] font-bold text-gray-500">FINALIZADAS</p><p className="text-lg font-bold">{data.finalizadas}</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-500"><p className="text-[10px] font-bold text-gray-500">ABS</p><p className="text-lg font-bold">{data.abs.toFixed(1)}%</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-red-500"><p className="text-[10px] font-bold text-gray-500">TO</p><p className="text-lg font-bold">{data.to.toFixed(1)}%</p></div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-3 rounded shadow">
          <h2 className="font-bold text-sm mb-2 text-slate-700">Ranking por Operação</h2>
          {data.ranking.map((o: any, i: number) => (
            <div key={i} className="flex justify-between py-1 border-b text-xs">
              <span>{o.nome}</span>
              <span className="text-yellow-600 font-bold">{o.abs.toFixed(0)}% ABS</span>
              <span className="text-red-600 font-bold">{o.to.toFixed(0)}% TO</span>
            </div>
          ))}
        </div>
        <div className="bg-white p-3 rounded shadow">
          <h2 className="font-bold text-sm mb-2 text-slate-700">Ranking por Turmas (ABS)</h2>
          <div className="max-h-40 overflow-y-auto pr-2">
            {data.rankingTurmas.map((t: any, i: number) => (
              <div key={i} className="flex justify-between py-1 border-b text-xs">
                <span className="font-medium">Turma {t.turma}</span>
                <span className="text-rose-600 font-bold">{t.abs.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Salas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-3 rounded shadow">
          <h2 className="font-bold text-sm mb-2">Ocupação de Salas</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.salaStats} dataKey="dias" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                  {data.salaStats.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-3 rounded shadow overflow-hidden">
          <h2 className="font-bold text-sm mb-2">Detalhes do Ensalamento</h2>
          <table className="w-full text-xs text-left">
            <thead><tr className="border-b"><th className="py-1">Sala</th><th className="py-1">Dias</th><th className="py-1">Turmas</th></tr></thead>
            <tbody>
              {data.salaStats.map((s: any, i: number) => (
                <tr key={i} className="border-b">
                  <td className="py-1.5 font-medium">{s.name}</td>
                  <td className="py-1.5">{s.dias}</td>
                  <td className="py-1.5 truncate">{s.turmas.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
