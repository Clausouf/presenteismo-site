'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const SALA_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const PALETTE = {
  treinamento: { primary: '#10b981', light: '#d1fae5', text: '#065f46' },
  recrutamento: { primary: '#8b5cf6', light: '#ede9fe', text: '#4c1d95' },
  consolidado: { primary: '#3b82f6', light: '#eff6ff', text: '#1e40af' },
};

// ─── Utilitário de exportação Excel (sem dependência externa) ─────────────────
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
      if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
    }).join('')
  );
  const sheetData = rows.map((_, ri) => `<row r="${ri + 1}">${cells[ri]}</row>`).join('');
  const lastRef = `${colLetter(maxCol - 1)}${rows.length}`;
  return `<sheetData><dimension ref="A1:${lastRef}"/>${sheetData}</sheetData>`;
}

function buildXlsx(sheets: { name: string; rows: (string | number)[][] }[]): Blob {
  const enc = new TextEncoder();
  const sheetXmls = sheets.map(
    s => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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

  type ZipEntry = { name: string; data: Uint8Array };
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRels) },
    ...sheetXmls.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(xml) })),
  ];

  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;
  const u16 = (n: number) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
  const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
  function crc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); table[i] = c; }
    for (const byte of data) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const localHeader = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length), 0x00, 0x00, ...nameBytes,
    ]);
    const cdEntry = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, 0x14, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length),
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, ...u32(offset), ...nameBytes,
    ]);
    parts.push(localHeader, entry.data);
    centralDir.push(cdEntry);
    offset += localHeader.length + size;
  }
  const cdOffset = offset;
  const cdSize = centralDir.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00,
    ...u16(entries.length), ...u16(entries.length), ...u32(cdSize), ...u32(cdOffset), 0x00, 0x00,
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
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Tooltip customizado — gráfico de barras
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value.toFixed(1)}%
        </p>
      ))}
    </div>
  );
};

// Tooltip customizado — pie chart de salas
const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700">{payload[0].name}</p>
      <p className="text-gray-600">{payload[0].value} dias ocupados</p>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DashboardBase({ tipo }: { tipo: 'treinamento' | 'recrutamento' | 'consolidado' }) {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<{ turmas: any[]; colabs: any[]; diario: any[]; salas: any[] }>({
    turmas: [], colabs: [], diario: [], salas: [],
  });

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
        supabase.from('salas').select('*'),
      ]);
      setRaw({
        turmas: t.data || [],
        colabs: c.data || [],
        diario: d.data || [],
        salas: s.data || [],
      });
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

    const turmaLookup = new Map<string, string>();
    raw.turmas.forEach((t: any) => {
      turmaLookup.set(t.numero_turma, t.operacoes?.nome || 'Sem Operação');
    });

    const filteredTurmas = raw.turmas.filter((t: any) =>
      (selectedOp === 'Todas' || t.operacoes?.nome === selectedOp) &&
      (selectedTurma === 'Todas' || t.numero_turma === selectedTurma)
    );
    const validTurmaNumbers = filteredTurmas.map((t: any) => t.numero_turma);

    // ─── PASSO 1: métricas individuais por colaborador ────────────────────────
    const metricsAll = raw.colabs
      .filter((c: any) => validTurmaNumbers.includes(c.numero_turma))
      .map((c: any) => {
        const logs = raw.diario.filter((l: any) =>
          l.matricula === c.matricula &&
          l.numero_turma === c.numero_turma &&
          new Date(l.data) >= startOfMonth &&
          new Date(l.data) <= endOfMonth
        );

        const totalDiasEsperados = logs.length;
        const logsNormalized = logs.map((l: any) => normalize(l.tipo_registro));

        // ATUALIZAÇÃO: Incluindo desligamento e desistência no cálculo de ABS
        const countAbs = logsNormalized.filter((t: string) =>
          t.includes('falta') || t.includes('desligamento') || t.includes('desistencia')
        ).length;
        const countPresenca = logsNormalized.filter((t: string) => t.includes('presenca') || t.includes('presente')).length;
        const countTO = logsNormalized.filter((t: string) =>
          ['desistencia', 'desligamento', 'desligamento a pedido'].includes(t)
        ).length;

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

    // ─── PASSO 2: turmas que têm ao menos 1 pessoa da categoria (ou todas se consolidado) ──────────────
    const turmasComCategoria = new Set(
      tipo === 'consolidado'
        ? metricsAll.map(m => m.turma)
        : metricsAll.filter(m => m.category === tipo).map(m => m.turma)
    );

    // ─── PASSO 3: ABS/TO por turma ───────────────────────────────────────────────
    const turmasUnicas = [...turmasComCategoria];
    const rankingTurmas = turmasUnicas.map(tNum => {
      const todosDaTurma     = metricsAll.filter(m => m.turma === tNum);
      const categoriaDaTurma = tipo === 'consolidado'
        ? todosDaTurma
        : todosDaTurma.filter(m => m.category === tipo);
      
      const totalDiasEsperadosTurma = todosDaTurma.reduce((acc, m) => acc + m.totalDiasEsperados, 0);
      const absCategoria = categoriaDaTurma.reduce((acc, m) => acc + m.countAbs, 0);
      const totalOperadoresTurma = todosDaTurma.length;
      const operadoresDesligados = categoriaDaTurma.filter(m => m.countTO > 0).length;
      return {
        turma: tNum,
        op: todosDaTurma[0]?.op || 'Sem Operação',
        abs: totalDiasEsperadosTurma > 0 ? (absCategoria / totalDiasEsperadosTurma) * 100 : 0,
        to:  totalOperadoresTurma  > 0 ? (operadoresDesligados / totalOperadoresTurma) * 100 : 0,
        _absRaw:  absCategoria,
        _toRaw:   operadoresDesligados,
        _diasRaw: totalDiasEsperadosTurma,
        _opRaw:   totalOperadoresTurma,
      };
    }).sort((a, b) => b.abs - a.abs);

    // ─── PASSO 4: métricas globais ────────────────────────────────────────────────
    const totalDiasGlobal = rankingTurmas.reduce((acc, t) => acc + t._diasRaw, 0);
    const totalAbsGlobal  = rankingTurmas.reduce((acc, t) => acc + t._absRaw,  0);
    const totalOpGlobal   = rankingTurmas.reduce((acc, t) => acc + t._opRaw,   0);
    const totalToGlobal   = rankingTurmas.reduce((acc, t) => acc + t._toRaw,   0);

    // ─── PASSO 5: ranking por operação ───────────────────────────────────────────
    const opsUnicas = [...new Set(rankingTurmas.map(t => t.op))];
    const ranking = opsUnicas.map(op => {
      const turmasDaOp = rankingTurmas.filter(t => t.op === op);
      const opDias = turmasDaOp.reduce((acc, t) => acc + t._diasRaw, 0);
      const opAbs  = turmasDaOp.reduce((acc, t) => acc + t._absRaw,  0);
      const opOp   = turmasDaOp.reduce((acc, t) => acc + t._opRaw,   0);
      const opTo   = turmasDaOp.reduce((acc, t) => acc + t._toRaw,   0);
      return {
        nome: op,
        abs: opDias > 0 ? (opAbs / opDias) * 100 : 0,
        to:  opOp  > 0 ? (opTo  / opOp)  * 100 : 0,
      };
    });

    // ─── PASSO 6: ocupação de salas ───────────────────────────────────────────
    const salaStats = raw.salas.map((s: any) => {
      let diasEmUso = 0;
      for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const isOccupied = filteredTurmas.some((t: any) => {
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
        turmas: filteredTurmas.filter((t: any) => t.sala === s.nome).map((t: any) => t.numero_turma),
      };
    }).filter((s: any) => s.dias > 0);

    // ─── PASSO 7: dados para exportação Excel ────────────────────────────────
    const resumoRows: (string | number)[][] = [
      ['Dashboard', tipo.toUpperCase()],
      ['Período', selectedMonth],
      ['Operação', selectedOp],
      ['Turma', selectedTurma],
      [],
      ['INDICADOR', 'VALOR'],
      ['Turmas Ativas', filteredTurmas.filter((t: any) => t.status === 'Em Andamento').length],
      ['Turmas Finalizadas', filteredTurmas.filter((t: any) => t.status === 'Finalizada').length],
      ['ABS (%)', parseFloat((totalDiasGlobal > 0 ? (totalAbsGlobal / totalDiasGlobal) * 100 : 0).toFixed(2))],
      ['TO (%)', parseFloat((totalOpGlobal   > 0 ? (totalToGlobal  / totalOpGlobal)  * 100 : 0).toFixed(2))],
      [],
      ['RANKING POR OPERAÇÃO'],
      ['Operação', 'ABS (%)', 'TO (%)'],
      ...ranking.map(o => [o.nome, parseFloat(o.abs.toFixed(2)), parseFloat(o.to.toFixed(2))]),
    ];
    const rankingRows: (string | number)[][] = [
      ['Turma', 'Operação', 'ABS (%)', 'TO (%)'],
      ...rankingTurmas.map(t => [
        `Turma ${t.turma}`, t.op,
        parseFloat(t.abs.toFixed(2)),
        parseFloat(t.to.toFixed(2)),
      ]),
    ];
    const [y, m] = selectedMonth.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end   = new Date(y, m, 0, 23, 59, 59);
    const diarioFiltrado = raw.diario.filter((l: any) =>
      validTurmaNumbers.includes(l.numero_turma) &&
      new Date(l.data) >= start &&
      new Date(l.data) <= end
    );
    const diarioRows: (string | number)[][] = [
      ['Matrícula', 'Turma', 'Operação', 'Data', 'Tipo de Registro', 'Categoria'],
      ...diarioFiltrado.map((l: any) => {
        const colab = metricsAll.find(m => m.matricula === l.matricula && m.turma === l.numero_turma);
        return [
          l.matricula, l.numero_turma,
          turmaLookup.get(l.numero_turma) || 'Sem Operação',
          l.data, l.tipo_registro,
          colab?.category?.toUpperCase() || '',
        ];
      }),
    ];

    return {
      ativas:      filteredTurmas.filter((t: any) => t.status === 'Em Andamento').length,
      finalizadas: filteredTurmas.filter((t: any) => t.status === 'Finalizada').length,
      abs: totalDiasGlobal > 0 ? (totalAbsGlobal / totalDiasGlobal) * 100 : 0,
      to:  totalOpGlobal   > 0 ? (totalToGlobal  / totalOpGlobal)  * 100 : 0,
      ranking,
      rankingTurmas,
      salaStats,
      exportSheets: { resumoRows, rankingRows, diarioRows },
    };
  }, [loading, raw, tipo, selectedMonth, selectedOp, selectedTurma]);

  function handleExport() {
    if (!data) return;
    const blob = buildXlsx([
      { name: 'Resumo Dashboard',  rows: data.exportSheets.resumoRows  },
      { name: 'Ranking por Turma', rows: data.exportSheets.rankingRows },
      { name: 'Diário de Presença', rows: data.exportSheets.diarioRows },
    ]);
    const nomeTipo = tipo === 'treinamento' ? 'Treinamento' : tipo === 'recrutamento' ? 'Recrutamento' : 'Consolidado';
    downloadBlob(blob, `Dashboard_${nomeTipo}_${selectedMonth}.xlsx`);
  }

  const cor = PALETTE[tipo];

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: cor.primary, borderTopColor: 'transparent' }}
          />
          <p className="text-sm text-gray-500">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const maxRankingVal = Math.max(...data.rankingTurmas.map((t: any) => Math.max(t.abs, t.to)), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard de Presença</h1>
            <p className="text-sm text-gray-500 mt-0.5">Acompanhamento de absenteísmo e turnover</p>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-gray-100 p-1 gap-1">
            <Link
              href="/dashboard/treinamento"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tipo === 'treinamento' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: tipo === 'treinamento' ? PALETTE.treinamento.primary : '#d1d5db' }}
              />
              Treinamento
            </Link>
            <Link
              href="/dashboard/recrutamento"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tipo === 'recrutamento' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: tipo === 'recrutamento' ? PALETTE.recrutamento.primary : '#d1d5db' }}
              />
              Recrutamento
            </Link>
            <Link
              href="/dashboard/consolidado"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tipo === 'consolidado' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: tipo === 'consolidado' ? PALETTE.consolidado.primary : '#d1d5db' }}
              />
              Consolidado
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5 max-w-7xl mx-auto">
        {/* ── Barra de filtros ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Período</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Operação</label>
            <select
              value={selectedOp}
              onChange={e => setSelectedOp(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none"
            >
              <option value="Todas">Todas</option>
              {[...new Set(raw.turmas.map((t: any) => t.operacoes?.nome).filter(Boolean))].map(op => (
                <option key={op as string} value={op as string}>{op as string}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Turma</label>
            <select
              value={selectedTurma}
              onChange={e => setSelectedTurma(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none"
            >
              <option value="Todas">Todas</option>
              {[...new Set(raw.turmas.map((t: any) => t.numero_turma))].map(num => (
                <option key={num as string} value={num as string}>Turma {num as string}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 shadow-sm"
            style={{ backgroundColor: '#16a34a' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Exportar Excel
          </button>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Turmas Ativas',
              value: data.ativas,
              suffix: '',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              ),
              color: cor.primary,
              bg: cor.light,
            },
            {
              label: 'Turmas Finalizadas',
              value: data.finalizadas,
              suffix: '',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              ),
              color: '#6b7280',
              bg: '#f3f4f6',
            },
            {
              label: 'Absenteísmo (ABS)',
              value: data.abs.toFixed(1),
              suffix: '%',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              ),
              color: '#d97706',
              bg: '#fef3c7',
            },
            {
              label: 'Turnover (TO)',
              value: data.to.toFixed(1),
              suffix: '%',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
              ),
              color: '#dc2626',
              bg: '#fee2e2',
            },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-3">
              <div className="rounded-lg p-2.5 flex-shrink-0" style={{ backgroundColor: card.bg, color: card.color }}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 truncate">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-none">
                  {card.value}
                  <span className="text-base font-semibold text-gray-500">{card.suffix}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Gráfico de barras: Ranking por Operação ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Ranking por Operação</h2>
              <p className="text-xs text-gray-400 mt-0.5">ABS e TO por operação no período</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-amber-400" /> ABS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-red-500" /> TO
              </span>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.ranking}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'dataMax + 5']}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="abs" name="ABS" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={14} />
                <Bar dataKey="to"  name="TO"  fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Ranking por Turma (ABS + TO) ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Ranking por Turma</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Absenteísmo e turnover por turma — denominador = total da turma
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Turma</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Operação</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ABS</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">TO</th>
                  <th className="py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">Distribuição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.rankingTurmas.map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-semibold text-gray-800">Turma {t.turma}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs">{t.op}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800">
                        {t.abs.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-800">
                        {t.to.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 w-6">ABS</span>
                          <div className="flex-1 bg-amber-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(t.abs / maxRankingVal) * 100}%`, backgroundColor: '#f59e0b' }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 w-6">TO</span>
                          <div className="flex-1 bg-red-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(t.to / maxRankingVal) * 100}%`, backgroundColor: '#ef4444' }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Salas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-gray-800">Ocupação de Salas</h2>
              <p className="text-xs text-gray-400 mt-0.5">Distribuição de dias ocupados por sala</p>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.salaStats}
                    dataKey="dias"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                  >
                    {data.salaStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={SALA_COLORS[index % SALA_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    align="center"
                    iconSize={10}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                    formatter={(value, entry: any) => {
                      const { payload } = entry;
                      const total = data.salaStats.reduce((acc: number, curr: any) => acc + curr.dias, 0);
                      const percent = total > 0 ? ((payload.dias / total) * 100).toFixed(0) : 0;
                      return <span className="text-gray-700 font-medium">{value} ({percent}%)</span>;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-gray-800">Detalhes das Salas</h2>
              <p className="text-xs text-gray-400 mt-0.5">Turmas alocadas em cada sala no período</p>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-52 pr-1">
              {data.salaStats.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: SALA_COLORS[i % SALA_COLORS.length] }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{s.name}</p>
                      <p className="text-[11px] text-gray-400">
                        Turmas: {s.turmas.length > 0 ? s.turmas.join(', ') : 'Nenhuma'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 shadow-xs">
                    {s.dias} {s.dias === 1 ? 'dia' : 'dias'}
                  </span>
                </div>
              ))}
              {data.salaStats.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">Nenhuma sala utilizada no período.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
