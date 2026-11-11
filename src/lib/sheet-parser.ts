export type StepStatus = "CONCLUIDO" | "PENDENTE" | "REFAZER" | "NA";

export interface ProcessStep {
  index: number;
  phase: "INTERNA" | "EXTERNA";
  code: string;
  shortLabel: string;
  fullLabel: string;
  rawValue: string;
  status: StepStatus;
}

export type MacroFase = "FASE_INTERNA" | "FASE_EXTERNA";

export type EstagioOperacional =
  | "FASE_INTERNA"
  | "COTACAO_E_ABERTURA"
  | "HABILITACAO_E_HOMOLOGACAO"
  | "EMPENHO_E_EXECUCAO"
  | "ENTREGA_E_ENCERRAMENTO";

export interface ProcessoItem {
  ordem: number;
  processoInterno: string;
  processoExterno: string;
  objeto: string;
  objetoRaw: string;
  modalidade: string;
  agente: string;
  macroFase: MacroFase;
  estagioOperacional: EstagioOperacional;
  estagioLabel: string;
  temPendencia: boolean;
  pendencias: string[];
  etapasInternas: ProcessStep[];
  etapasExternas: ProcessStep[];
  todasEtapas: ProcessStep[];
  concluidasInternas: number;
  aplicaveisInternas: number;
  progressoInterno: number;
  concluidasExternas: number;
  aplicaveisExternas: number;
  progressoExterno: number;
  concluidasTotal: number;
  aplicaveisTotal: number;
  progressoTotal: number;
  ultimaEtapaConcluida: {
    label: string;
    phase: "INTERNA" | "EXTERNA";
    valor: string;
  } | null;
  proximaEtapa: {
    label: string;
    phase: "INTERNA" | "EXTERNA";
    isRefazer: boolean;
  } | null;
  ultimaDataRegistrada: string | null;
}

export interface DashboardData {
  updatedAt: string;
  source: "live" | "fallback";
  sheetUrl: string;
  totalProcessos: number;
  resumo: {
    faseInterna: number;
    faseExterna: number;
    comPendencia: number;
    emCotacaoAbertura: number;
    emHabilitacaoHomologacao: number;
    emEmpenhoExecucao: number;
    emEntregaEncerramento: number;
    progressoMedioGeral: number;
  };
  porAgente: {
    agente: string;
    total: number;
    faseInterna: number;
    faseExterna: number;
    comPendencia: number;
    progressoMedio: number;
  }[];
  porModalidade: {
    modalidade: string;
    total: number;
  }[];
  porEstagio: {
    id: EstagioOperacional;
    label: string;
    fase: string;
    count: number;
    percent: number;
  }[];
  gargalosEtapas: {
    label: string;
    shortLabel: string;
    phase: "INTERNA" | "EXTERNA";
    paradosCount: number;
    refazerCount: number;
  }[];
  processos: ProcessoItem[];
}

export const INTERNAL_STEPS_META = [
  { col: 4, code: "DFD", shortLabel: "Receb. DFD", fullLabel: "Recebimento DFD" },
  { col: 5, code: "CONF", shortLabel: "Conformidade", fullLabel: "Conformidade" },
  { col: 6, code: "ORÇ", shortLabel: "Orçamento", fullLabel: "Orçamento" },
  { col: 7, code: "PAR", shortLabel: "Pareceres", fullLabel: "Pareceres" },
  { col: 8, code: "PRES", shortLabel: "Presidente", fullLabel: "Presidente" },
  { col: 9, code: "ARQ-I", shortLabel: "Arquiv. Int.", fullLabel: "Arquivamento (Fase Interna)" },
];

export const EXTERNAL_STEPS_META = [
  { col: 11, code: "INI", shortLabel: "Inicial", fullLabel: "Inicial" },
  { col: 12, code: "DOCS", shortLabel: "Docs Aprov.", fullLabel: "DOCs Aprovados" },
  { col: 13, code: "RES", shortLabel: "Req. Reserva", fullLabel: "Requisição Reserva" },
  { col: 14, code: "PUB-1", shortLabel: "Publicações", fullLabel: "Publicações" },
  { col: 15, code: "PESQ", shortLabel: "Pesq. Preços", fullLabel: "Pesquisa de Preços" },
  { col: 16, code: "MAPA", shortLabel: "Mapa Preços", fullLabel: "Mapa de Preços" },
  { col: 17, code: "HAB", shortLabel: "Habilitação", fullLabel: "Habilitação" },
  { col: 18, code: "FRAC", shortLabel: "Fracionam.", fullLabel: "Fracionamento" },
  { col: 19, code: "HOM", shortLabel: "Homologação", fullLabel: "Homologação" },
  { col: 20, code: "S-EMP", shortLabel: "Solic. Emp.", fullLabel: "Solicitação de Empenho" },
  { col: 21, code: "N-EMP", shortLabel: "Nota Emp.", fullLabel: "Nota de Empenho" },
  { col: 22, code: "AF/OS", shortLabel: "AF / OS", fullLabel: "AF / OS" },
  { col: 23, code: "COMP", shortLabel: "Conf. Compra", fullLabel: "Confirmação de Compra" },
  { col: 24, code: "TCN", shortLabel: "TCN", fullLabel: "TCN" },
  { col: 25, code: "PUB-2", shortLabel: "Publicação", fullLabel: "Publicação" },
  { col: 26, code: "ALMOX", shortLabel: "Almoxarifado", fullLabel: "Requisitante e Almoxarifado" },
  { col: 27, code: "PATR", shortLabel: "Patrimônio", fullLabel: "Patrimônio" },
  { col: 28, code: "ARQ-F", shortLabel: "Arquiv. Final", fullLabel: "Arquivamento (Fase Externa)" },
];

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur.trim());
        cur = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cur.trim());
        rows.push(row);
        row = [];
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  if (cur || row.length > 0) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

function classifyStepValue(raw: string): StepStatus {
  const val = (raw || "").trim().toUpperCase();
  if (!val) return "PENDENTE";
  if (val.includes("REFAZER") || val.includes("PENDENTE") || val.includes("ERRO")) {
    return "REFAZER";
  }
  if (val === "-" || val === "NA" || val === "N/A" || val === "NÃO SE APLICA") {
    return "NA";
  }
  return "CONCLUIDO";
}

function extractModalityAndObject(rawObj: string): { modalidade: string; objeto: string } {
  const trimmed = (rawObj || "").trim();
  const match = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) {
    return {
      modalidade: "Compra Direta / Dispensa",
      objeto: trimmed,
    };
  }
  const tag = match[1].trim().toUpperCase();
  const rest = match[2].trim() || trimmed;
  let modalidade = match[1].trim();

  if (tag.includes("PREGAO") || tag.includes("PREGÃO")) {
    modalidade = "Pregão Eletrônico";
  } else if (tag.includes("CONCORRÊNCIA") || tag.includes("CONCORRENCIA")) {
    modalidade = "Concorrência";
  } else if (tag.includes("INEXIGIBILIDADE")) {
    modalidade = "Inexigibilidade";
  } else if (tag.includes("ADITIVO")) {
    modalidade = "Termo Aditivo";
  } else if (tag.includes("DISPENSA")) {
    modalidade = "Dispensa";
  }

  return { modalidade, objeto: rest };
}

function normalizeAgentName(raw: string): string {
  const clean = (raw || "").trim();
  if (!clean) return "Não atribuído";
  if (clean.toLowerCase() === "natalia" || clean.toLowerCase() === "natália") {
    return "Natália";
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function buildDashboardData(
  csvText: string,
  source: "live" | "fallback",
  sheetUrl: string
): DashboardData {
  const rows = parseCSV(csvText);
  const processos: ProcessoItem[] = [];

  for (let r = 2; r < rows.length; r++) {
    const line = rows[r];
    if (!line || line.length < 4) continue;

    const procInt = (line[1] || "").trim();
    const objRaw = (line[2] || "").trim();
    if (!procInt && !objRaw) continue;

    const ordemNum = parseInt(line[0] || String(processos.length + 1), 10) || processos.length + 1;
    const procExt = (line[10] || "").trim();
    const agente = normalizeAgentName(line[3] || "");
    const { modalidade, objeto } = extractModalityAndObject(objRaw);

    const etapasInternas: ProcessStep[] = INTERNAL_STEPS_META.map((meta, idx) => {
      const rawValue = (line[meta.col] || "").trim();
      return {
        index: idx,
        phase: "INTERNA",
        code: meta.code,
        shortLabel: meta.shortLabel,
        fullLabel: meta.fullLabel,
        rawValue,
        status: classifyStepValue(rawValue),
      };
    });

    const etapasExternas: ProcessStep[] = EXTERNAL_STEPS_META.map((meta, idx) => {
      const rawValue = (line[meta.col] || "").trim();
      return {
        index: idx + INTERNAL_STEPS_META.length,
        phase: "EXTERNA",
        code: meta.code,
        shortLabel: meta.shortLabel,
        fullLabel: meta.fullLabel,
        rawValue,
        status: classifyStepValue(rawValue),
      };
    });

    const todasEtapas = [...etapasInternas, ...etapasExternas];

    const aplicaveisInternas = etapasInternas.filter((s) => s.status !== "NA").length;
    const concluidasInternas = etapasInternas.filter((s) => s.status === "CONCLUIDO").length;
    const progressoInterno =
      aplicaveisInternas > 0 ? Math.round((concluidasInternas / aplicaveisInternas) * 100) : 0;

    const aplicaveisExternas = etapasExternas.filter((s) => s.status !== "NA").length;
    const concluidasExternas = etapasExternas.filter((s) => s.status === "CONCLUIDO").length;
    const progressoExterno =
      aplicaveisExternas > 0 ? Math.round((concluidasExternas / aplicaveisExternas) * 100) : 0;

    const aplicaveisTotal = aplicaveisInternas + aplicaveisExternas;
    const concluidasTotal = concluidasInternas + concluidasExternas;
    const progressoTotal =
      aplicaveisTotal > 0 ? Math.round((concluidasTotal / aplicaveisTotal) * 100) : 0;

    const pendencias = todasEtapas
      .filter((s) => s.status === "REFAZER")
      .map((s) => s.fullLabel);
    const temPendencia = pendencias.length > 0;

    const hasExternalActivity = Boolean(procExt) || concluidasExternas > 0 || etapasExternas.some((s) => s.status === "REFAZER");
    const macroFase: MacroFase = hasExternalActivity ? "FASE_EXTERNA" : "FASE_INTERNA";

    // Determine Last Completed Step
    let ultimaEtapaConcluida: ProcessoItem["ultimaEtapaConcluida"] = null;
    let ultimaDataRegistrada: string | null = null;
    for (let i = todasEtapas.length - 1; i >= 0; i--) {
      if (todasEtapas[i].status === "CONCLUIDO") {
        ultimaEtapaConcluida = {
          label: todasEtapas[i].fullLabel,
          phase: todasEtapas[i].phase,
          valor: todasEtapas[i].rawValue,
        };
        break;
      }
    }

    for (let i = todasEtapas.length - 1; i >= 0; i--) {
      const val = todasEtapas[i].rawValue;
      if (/^\d{2}\/\d{2}(\/\d{2,4})?$/.test(val)) {
        ultimaDataRegistrada = val;
        break;
      }
    }

    // Determine Next / Current Action Step
    let proximaEtapa: ProcessoItem["proximaEtapa"] = null;
    const firstRefazer = todasEtapas.find((s) => s.status === "REFAZER");
    if (firstRefazer) {
      proximaEtapa = {
        label: firstRefazer.fullLabel,
        phase: firstRefazer.phase,
        isRefazer: true,
      };
    } else {
      // Find first pending step after the last completed step, or first pending overall if in internal phase
      const stepsToSearch = hasExternalActivity ? etapasExternas : todasEtapas;
      const firstPending = stepsToSearch.find((s) => s.status === "PENDENTE");
      if (firstPending) {
        proximaEtapa = {
          label: firstPending.fullLabel,
          phase: firstPending.phase,
          isRefazer: false,
        };
      }
    }

    // Determine Detailed Operational Stage
    // External indices:
    // 0..5: INICIAL to MAPA DE PREÇOS (Cotação e Abertura)
    // 6..8: HABILITAÇÃO to HOMOLOGAÇÃO (Habilitação e Homologação)
    // 9..14: SOLICITAÇÃO DE EMPENHO to PUBLICAÇÃO (Empenho e Execução)
    // 15..17: REQUISITANTE/ALMOXARIFADO to ARQUIVAMENTO (Entrega e Encerramento)
    let estagioOperacional: EstagioOperacional = "FASE_INTERNA";
    let estagioLabel = "Fase Interna (Instrução)";

    if (macroFase === "FASE_EXTERNA") {
      let highestExternalIdx = -1;
      for (let i = etapasExternas.length - 1; i >= 0; i--) {
        if (etapasExternas[i].status === "CONCLUIDO") {
          highestExternalIdx = i;
          break;
        }
      }
      if (highestExternalIdx >= 15) {
        estagioOperacional = "ENTREGA_E_ENCERRAMENTO";
        estagioLabel = "Almoxarifado / Patrimônio";
      } else if (highestExternalIdx >= 9) {
        estagioOperacional = "EMPENHO_E_EXECUCAO";
        estagioLabel = "Empenho / Contratação";
      } else if (highestExternalIdx >= 6) {
        estagioOperacional = "HABILITACAO_E_HOMOLOGACAO";
        estagioLabel = "Habilitação / Homologação";
      } else {
        estagioOperacional = "COTACAO_E_ABERTURA";
        estagioLabel = "Abertura / Pesquisa de Preços";
      }
    }

    processos.push({
      ordem: ordemNum,
      processoInterno: procInt,
      processoExterno: procExt,
      objeto,
      objetoRaw: objRaw,
      modalidade,
      agente,
      macroFase,
      estagioOperacional,
      estagioLabel,
      temPendencia,
      pendencias,
      etapasInternas,
      etapasExternas,
      todasEtapas,
      concluidasInternas,
      aplicaveisInternas,
      progressoInterno,
      concluidasExternas,
      aplicaveisExternas,
      progressoExterno,
      concluidasTotal,
      aplicaveisTotal,
      progressoTotal,
      ultimaEtapaConcluida,
      proximaEtapa,
      ultimaDataRegistrada,
    });
  }

  const totalProcessos = processos.length;
  const faseInterna = processos.filter((p) => p.macroFase === "FASE_INTERNA").length;
  const faseExterna = processos.filter((p) => p.macroFase === "FASE_EXTERNA").length;
  const comPendencia = processos.filter((p) => p.temPendencia).length;

  const emCotacaoAbertura = processos.filter((p) => p.estagioOperacional === "COTACAO_E_ABERTURA").length;
  const emHabilitacaoHomologacao = processos.filter((p) => p.estagioOperacional === "HABILITACAO_E_HOMOLOGACAO").length;
  const emEmpenhoExecucao = processos.filter((p) => p.estagioOperacional === "EMPENHO_E_EXECUCAO").length;
  const emEntregaEncerramento = processos.filter((p) => p.estagioOperacional === "ENTREGA_E_ENCERRAMENTO").length;

  const progressoMedioGeral =
    totalProcessos > 0
      ? Math.round(processos.reduce((acc, p) => acc + p.progressoTotal, 0) / totalProcessos)
      : 0;

  // Group by Agent
  const agentMap = new Map<string, ProcessoItem[]>();
  for (const p of processos) {
    const list = agentMap.get(p.agente) || [];
    list.push(p);
    agentMap.set(p.agente, list);
  }
  const porAgente = Array.from(agentMap.entries())
    .map(([agente, list]) => ({
      agente,
      total: list.length,
      faseInterna: list.filter((x) => x.macroFase === "FASE_INTERNA").length,
      faseExterna: list.filter((x) => x.macroFase === "FASE_EXTERNA").length,
      comPendencia: list.filter((x) => x.temPendencia).length,
      progressoMedio: Math.round(
        list.reduce((acc, x) => acc + x.progressoTotal, 0) / list.length
      ),
    }))
    .sort((a, b) => b.total - a.total);

  // Group by Modality
  const modMap = new Map<string, number>();
  for (const p of processos) {
    modMap.set(p.modalidade, (modMap.get(p.modalidade) || 0) + 1);
  }
  const porModalidade = Array.from(modMap.entries())
    .map(([modalidade, total]) => ({ modalidade, total }))
    .sort((a, b) => b.total - a.total);

  // Group by Operational Stage
  const porEstagio: DashboardData["porEstagio"] = [
    {
      id: "FASE_INTERNA",
      label: "Instrução e Planejamento",
      fase: "Fase Interna",
      count: faseInterna,
      percent: totalProcessos > 0 ? Math.round((faseInterna / totalProcessos) * 100) : 0,
    },
    {
      id: "COTACAO_E_ABERTURA",
      label: "Abertura e Cotação de Preços",
      fase: "Fase Externa",
      count: emCotacaoAbertura,
      percent: totalProcessos > 0 ? Math.round((emCotacaoAbertura / totalProcessos) * 100) : 0,
    },
    {
      id: "HABILITACAO_E_HOMOLOGACAO",
      label: "Habilitação e Homologação",
      fase: "Fase Externa",
      count: emHabilitacaoHomologacao,
      percent: totalProcessos > 0 ? Math.round((emHabilitacaoHomologacao / totalProcessos) * 100) : 0,
    },
    {
      id: "EMPENHO_E_EXECUCAO",
      label: "Empenho, AF/OS e Publicação",
      fase: "Fase Externa",
      count: emEmpenhoExecucao,
      percent: totalProcessos > 0 ? Math.round((emEmpenhoExecucao / totalProcessos) * 100) : 0,
    },
    {
      id: "ENTREGA_E_ENCERRAMENTO",
      label: "Almoxarifado e Patrimônio",
      fase: "Fase Externa",
      count: emEntregaEncerramento,
      percent: totalProcessos > 0 ? Math.round((emEntregaEncerramento / totalProcessos) * 100) : 0,
    },
  ];

  // Bottlenecks (which next step has the most processes waiting on it)
  const bottleneckMap = new Map<
    string,
    { label: string; shortLabel: string; phase: "INTERNA" | "EXTERNA"; paradosCount: number; refazerCount: number }
  >();

  for (const p of processos) {
    for (const s of p.todasEtapas) {
      if (s.status === "REFAZER") {
        const cur = bottleneckMap.get(s.fullLabel) || {
          label: s.fullLabel,
          shortLabel: s.shortLabel,
          phase: s.phase,
          paradosCount: 0,
          refazerCount: 0,
        };
        cur.refazerCount += 1;
        bottleneckMap.set(s.fullLabel, cur);
      }
    }
    if (p.proximaEtapa && !p.proximaEtapa.isRefazer) {
      const key = p.proximaEtapa.label;
      const cur = bottleneckMap.get(key) || {
        label: p.proximaEtapa.label,
        shortLabel: p.proximaEtapa.label,
        phase: p.proximaEtapa.phase,
        paradosCount: 0,
        refazerCount: 0,
      };
      cur.paradosCount += 1;
      bottleneckMap.set(key, cur);
    }
  }

  const gargalosEtapas = Array.from(bottleneckMap.values())
    .sort((a, b) => b.refazerCount * 10 + b.paradosCount - (a.refazerCount * 10 + a.paradosCount))
    .slice(0, 6);

  return {
    updatedAt: new Date().toISOString(),
    source,
    sheetUrl,
    totalProcessos,
    resumo: {
      faseInterna,
      faseExterna,
      comPendencia,
      emCotacaoAbertura,
      emHabilitacaoHomologacao,
      emEmpenhoExecucao,
      emEntregaEncerramento,
      progressoMedioGeral,
    },
    porAgente,
    porModalidade,
    porEstagio,
    gargalosEtapas,
    processos,
  };
}

