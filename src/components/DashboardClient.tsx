"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  DashboardData,
  ProcessoItem,
  ProcessStep,
  EstagioOperacional,
  INTERNAL_STEPS_META,
  EXTERNAL_STEPS_META,
} from "@/lib/sheet-parser";
import {
  RefreshCw,
  Search,
  Tv,
  Minimize2,
  ExternalLink,
  AlertTriangle,
  Check,
  Play,
  Pause,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

interface DashboardClientProps {
  initialData: DashboardData;
}

const REFRESH_INTERVAL_SEC = 30;
const TV_PAGE_INTERVAL_SEC = 12;

function getProcessKey(p: ProcessoItem): string {
  return `${p.ordem}::${p.processoInterno}`;
}

const SHORT_STAGE_LABELS: Record<EstagioOperacional, string> = {
  FASE_INTERNA: "Instrução (Int.)",
  COTACAO_E_ABERTURA: "Abertura / Cotação",
  HABILITACAO_E_HOMOLOGACAO: "Habilit. / Homol.",
  EMPENHO_E_EXECUCAO: "Empenho / AF",
  ENTREGA_E_ENCERRAMENTO: "Almox. / Patrim.",
};

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFase, setSelectedFase] = useState<string>("TODAS");
  const [selectedEstagio, setSelectedEstagio] = useState<EstagioOperacional | "TODOS">("TODOS");
  const [selectedAgente, setSelectedAgente] = useState<string>("TODOS");
  const [selectedModalidade, setSelectedModalidade] = useState<string>("TODAS");
  const [selectedEtapaParada, setSelectedEtapaParada] = useState<string>("TODAS");
  const [onlyPendencias, setOnlyPendencias] = useState<boolean>(false);

  // View & Sort
  const [viewMode, setViewMode] = useState<"MATRIZ" | "RESUMO">("MATRIZ");
  const [sortBy, setSortBy] = useState<"ORDEM" | "PROGRESSO_DESC" | "PROGRESSO_ASC" | "PENDENCIA">("ORDEM");

  // Independent Process Detail Selection (persists across background refreshes)
  const [selectedProcessKey, setSelectedProcessKey] = useState<string | null>(null);

  // TV Mode state (increased default page size since top cards are now compact)
  const [tvMode, setTvMode] = useState(false);
  const [tvAutoRotate, setTvAutoRotate] = useState(true);
  const [tvPageSize, setTvPageSize] = useState<number>(15);
  const [tvCurrentPage, setTvCurrentPage] = useState<number>(0);

  const isFetchingRef = useRef(false);

  const fetchLatestData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/processos?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed fetch");
      const json: DashboardData = await res.json();
      setData(json);
      setSyncError(false);
    } catch {
      setSyncError(true);
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  // Toggle Fullscreen for TV Mode
  const toggleTvMode = useCallback(() => {
    setTvMode((prev) => {
      const next = !prev;
      if (next) {
        setTvCurrentPage(0);
        if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (typeof document !== "undefined" && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Filter and sort processes
  const filteredProcessos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = data.processos.filter((p) => {
      if (onlyPendencias && !p.temPendencia) return false;
      if (selectedFase === "FASE_INTERNA" && p.macroFase !== "FASE_INTERNA") return false;
      if (selectedFase === "FASE_EXTERNA" && p.macroFase !== "FASE_EXTERNA") return false;
      if (selectedEstagio !== "TODOS" && p.estagioOperacional !== selectedEstagio) return false;
      if (selectedAgente !== "TODOS" && p.agente !== selectedAgente) return false;
      if (selectedModalidade !== "TODAS" && p.modalidade !== selectedModalidade) return false;
      if (selectedEtapaParada !== "TODAS") {
        const matchesNext = p.proximaEtapa?.label === selectedEtapaParada;
        const matchesRefazer = p.pendencias.includes(selectedEtapaParada);
        if (!matchesNext && !matchesRefazer) return false;
      }

      if (q) {
        const matchInt = p.processoInterno.toLowerCase().includes(q);
        const matchExt = p.processoExterno.toLowerCase().includes(q);
        const matchObj = p.objetoRaw.toLowerCase().includes(q);
        const matchAg = p.agente.toLowerCase().includes(q);
        const matchMod = p.modalidade.toLowerCase().includes(q);
        if (!matchInt && !matchExt && !matchObj && !matchAg && !matchMod) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "PENDENCIA") {
        if (a.temPendencia !== b.temPendencia) return a.temPendencia ? -1 : 1;
        return a.ordem - b.ordem;
      }
      if (sortBy === "PROGRESSO_DESC") {
        if (b.progressoTotal !== a.progressoTotal) return b.progressoTotal - a.progressoTotal;
        return a.ordem - b.ordem;
      }
      if (sortBy === "PROGRESSO_ASC") {
        if (a.progressoTotal !== b.progressoTotal) return a.progressoTotal - b.progressoTotal;
        return a.ordem - b.ordem;
      }
      return a.ordem - b.ordem;
    });
  }, [
    data.processos,
    searchQuery,
    onlyPendencias,
    selectedFase,
    selectedEstagio,
    selectedAgente,
    selectedModalidade,
    selectedEtapaParada,
    sortBy,
  ]);

  const totalTvPages = Math.max(1, Math.ceil(filteredProcessos.length / tvPageSize));

  // Auto-cycle pages in TV mode (pauses automatically while user is inspecting a process detail)
  useEffect(() => {
    if (!tvMode || !tvAutoRotate || totalTvPages <= 1 || selectedProcessKey !== null) return;
    const interval = setInterval(() => {
      setTvCurrentPage((prev) => (prev + 1) % totalTvPages);
    }, TV_PAGE_INTERVAL_SEC * 1000);
    return () => clearInterval(interval);
  }, [tvMode, tvAutoRotate, totalTvPages, selectedProcessKey]);

  const displayedProcessos = useMemo(() => {
    if (!tvMode || tvPageSize >= filteredProcessos.length) {
      return filteredProcessos;
    }
    const safePage = tvCurrentPage % totalTvPages;
    const start = safePage * tvPageSize;
    return filteredProcessos.slice(start, start + tvPageSize);
  }, [filteredProcessos, tvMode, tvPageSize, tvCurrentPage, totalTvPages]);

  // Resolve the currently selected process for the independent detail view
  const selectedProcesso = useMemo(() => {
    if (!selectedProcessKey) return null;
    const [ordemStr, procInt] = selectedProcessKey.split("::");
    const ordemNum = Number(ordemStr);
    return (
      data.processos.find(
        (p) =>
          (p.ordem === ordemNum && p.processoInterno === procInt) ||
          p.processoInterno === procInt ||
          p.ordem === ordemNum
      ) || null
    );
  }, [data.processos, selectedProcessKey]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedFase !== "TODAS" ||
    selectedEstagio !== "TODOS" ||
    selectedAgente !== "TODOS" ||
    selectedModalidade !== "TODAS" ||
    selectedEtapaParada !== "TODAS" ||
    onlyPendencias;

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedFase("TODAS");
    setSelectedEstagio("TODOS");
    setSelectedAgente("TODOS");
    setSelectedModalidade("TODAS");
    setSelectedEtapaParada("TODAS");
    setOnlyPendencias(false);
    setTvCurrentPage(0);
  };

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#0a110e] text-[#f1f7f4] ${
        tvMode ? "text-base 2xl:text-lg" : "text-sm"
      }`}
    >
      {/* ISOLATED TOP INSTITUTIONAL BAR & 30s BACKGROUND SYNC TIMER */}
      <SyncStatusBar
        updatedAt={data.updatedAt}
        isRefreshing={isRefreshing}
        syncError={syncError}
        onTriggerSync={fetchLatestData}
      />

      {/* COMPACT MAIN INSTITUTIONAL HEADER */}
      <header className="bg-[#111c17] border-b border-[#2f7958]">
        <div className="max-w-[2400px] mx-auto px-3 sm:px-5 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* Official Logo of Câmara Municipal de Bauru */}
            <a
              href="https://www.bauru.sp.leg.br"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 bg-[#f4f7f5] px-2.5 py-1 border-l-4 border-l-[#2f7958] border border-[#345243] focus:outline-none"
              title="Portal da Câmara Municipal de Bauru"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-camara-bauru.png"
                alt="Câmara Municipal de Bauru"
                className={`${tvMode ? "h-9 sm:h-10" : "h-7 sm:h-8"} w-auto object-contain`}
              />
            </a>

            <div className="h-7 w-[1px] bg-[#23382d] hidden sm:block" />

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1
                className={`font-bold uppercase tracking-tight text-[#f1f7f4] leading-none ${
                  tvMode ? "text-lg sm:text-xl 2xl:text-2xl" : "text-sm sm:text-base"
                }`}
              >
                CONTROLE GERAL DE COMPRAS E PROCESSOS
              </h1>
              <span className="text-[11px] text-[#a2c682] font-medium hidden xl:inline tabular-nums">
                • FASE INTERNA (6 ETAPAS) E FASE EXTERNA (18 ETAPAS)
              </span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            {tvMode && (
              <div className="flex items-center border border-[#345243] bg-[#0d1612]">
                <button
                  type="button"
                  onClick={() => setTvAutoRotate((r) => !r)}
                  className="px-2.5 py-1 text-xs font-semibold text-[#a2c682] hover:bg-[#17261f] flex items-center gap-1.5 border-r border-[#345243] cursor-pointer"
                  title="Alternar rotação automática de páginas na TV"
                >
                  {tvAutoRotate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{tvAutoRotate ? "ROTAÇÃO (12s)" : "PAUSADO"}</span>
                </button>
                <select
                  value={tvPageSize}
                  onChange={(e) => {
                    setTvPageSize(Number(e.target.value));
                    setTvCurrentPage(0);
                  }}
                  aria-label="Linhas por página no Modo TV"
                  className="px-2 py-1 text-xs font-semibold text-[#f1f7f4] bg-[#111c17] focus:outline-none cursor-pointer"
                >
                  <option value={12}>12 / tela</option>
                  <option value={15}>15 / tela</option>
                  <option value={20}>20 / tela</option>
                  <option value={30}>Todos (30)</option>
                </select>
                {totalTvPages > 1 && (
                  <div className="px-2 py-1 text-xs font-bold text-[#a2c682] border-l border-[#345243] tabular-nums bg-[#111c17]">
                    PÁG. {(tvCurrentPage % totalTvPages) + 1}/{totalTvPages}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={fetchLatestData}
              disabled={isRefreshing}
              className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wide border border-[#345243] bg-[#17261f] text-[#f1f7f4] hover:bg-[#1f3329] active:bg-[#274034] flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 text-[#a2c682] ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Sincronizando" : "Atualizar"}</span>
            </button>

            <a
              href={data.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wide border border-[#345243] bg-[#17261f] text-[#f1f7f4] hover:bg-[#1f3329] flex items-center gap-1.5"
            >
              <span>Planilha</span>
              <ExternalLink className="w-3 h-3 text-[#a2c682]" />
            </a>

            <button
              type="button"
              onClick={toggleTvMode}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border cursor-pointer ${
                tvMode
                  ? "bg-[#b91c1c] border-[#ef4444] text-white hover:bg-[#991b1b]"
                  : "bg-[#2f7958] border-[#3da174] text-white hover:bg-[#236145]"
              }`}
            >
              {tvMode ? (
                <>
                  <Minimize2 className="w-3 h-3" />
                  <span>Sair TV</span>
                </>
              ) : (
                <>
                  <Tv className="w-3 h-3" />
                  <span>Modo TV</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE CONTAINER - COMPACT SPACING TO MAXIMIZE TABLE ROWS */}
      <main className="flex-1 max-w-[2400px] w-full mx-auto px-3 sm:px-5 py-2.5 space-y-2.5">
        {/* COMPACT KPI STRIP (SINGLE-ROW HIGH-DENSITY METRICS) */}
        <section
          aria-label="Indicadores Gerais"
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 bg-[#111c17] border border-[#23382d]"
        >
          {/* KPI 1: Total */}
          <button
            type="button"
            onClick={clearAllFilters}
            className={`text-left px-3 py-1.5 border-b xl:border-b-0 border-r border-[#23382d] border-l-4 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
              !hasActiveFilters
                ? "border-l-[#a2c682] bg-[#17261f]"
                : "border-l-transparent hover:bg-[#17261f]"
            }`}
          >
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#b4c9be] truncate">
                TOTAL DE PROCESSOS
              </div>
              <div className="text-[10px] text-[#7d998a] truncate tabular-nums">
                Avanço médio: <strong className="text-[#a2c682]">{data.resumo.progressoMedioGeral}%</strong>
              </div>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-[#f1f7f4] tabular-nums shrink-0">
              {data.totalProcessos}
            </span>
          </button>

          {/* KPI 2: Fase Interna */}
          <button
            type="button"
            onClick={() => {
              clearAllFilters();
              setSelectedFase(selectedFase === "FASE_INTERNA" ? "TODAS" : "FASE_INTERNA");
            }}
            className={`text-left px-3 py-1.5 border-b xl:border-b-0 border-r border-[#23382d] border-l-4 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
              selectedFase === "FASE_INTERNA"
                ? "border-l-[#a2c682] bg-[#17261f]"
                : "border-l-transparent hover:bg-[#17261f]"
            }`}
          >
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#b4c9be] truncate">
                FASE INTERNA
              </div>
              <div className="text-[10px] text-[#7d998a] truncate tabular-nums">
                {Math.round((data.resumo.faseInterna / Math.max(1, data.totalProcessos)) * 100)}% • DFD a Presid.
              </div>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-[#f1f7f4] tabular-nums shrink-0">
              {data.resumo.faseInterna}
            </span>
          </button>

          {/* KPI 3: Fase Externa */}
          <button
            type="button"
            onClick={() => {
              clearAllFilters();
              setSelectedFase(selectedFase === "FASE_EXTERNA" ? "TODAS" : "FASE_EXTERNA");
            }}
            className={`text-left px-3 py-1.5 border-b sm:border-b-0 border-r border-[#23382d] border-l-4 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
              selectedFase === "FASE_EXTERNA"
                ? "border-l-[#3da174] bg-[#17261f]"
                : "border-l-transparent hover:bg-[#17261f]"
            }`}
          >
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#b4c9be] truncate">
                FASE EXTERNA
              </div>
              <div className="text-[10px] text-[#7d998a] truncate tabular-nums">
                {Math.round((data.resumo.faseExterna / Math.max(1, data.totalProcessos)) * 100)}% • Cotação a Arq.
              </div>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-[#a2c682] tabular-nums shrink-0">
              {data.resumo.faseExterna}
            </span>
          </button>

          {/* KPI 4: Empenho e Execução */}
          <button
            type="button"
            onClick={() => {
              clearAllFilters();
              setSelectedEstagio(
                selectedEstagio === "EMPENHO_E_EXECUCAO" ? "TODOS" : "EMPENHO_E_EXECUCAO"
              );
            }}
            className={`text-left px-3 py-1.5 border-b sm:border-b-0 border-r border-[#23382d] border-l-4 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
              selectedEstagio === "EMPENHO_E_EXECUCAO"
                ? "border-l-[#3da174] bg-[#17261f]"
                : "border-l-transparent hover:bg-[#17261f]"
            }`}
          >
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#b4c9be] truncate">
                EMPENHO / COMPRA
              </div>
              <div className="text-[10px] text-[#7d998a] truncate">
                Empenho, AF/OS e TCN
              </div>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-[#f1f7f4] tabular-nums shrink-0">
              {data.resumo.emEmpenhoExecucao}
            </span>
          </button>

          {/* KPI 5: Almoxarifado / Patrimônio */}
          <button
            type="button"
            onClick={() => {
              clearAllFilters();
              setSelectedEstagio(
                selectedEstagio === "ENTREGA_E_ENCERRAMENTO" ? "TODOS" : "ENTREGA_E_ENCERRAMENTO"
              );
            }}
            className={`text-left px-3 py-1.5 border-r border-[#23382d] border-l-4 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
              selectedEstagio === "ENTREGA_E_ENCERRAMENTO"
                ? "border-l-[#a2c682] bg-[#17261f]"
                : "border-l-transparent hover:bg-[#17261f]"
            }`}
          >
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#b4c9be] truncate">
                ENTREGA / PATRIMÔNIO
              </div>
              <div className="text-[10px] text-[#7d998a] truncate">
                Etapas finais (22 a 24)
              </div>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-[#3da174] tabular-nums shrink-0">
              {data.resumo.emEntregaEncerramento}
            </span>
          </button>

          {/* KPI 6: Com Pendência (Refazer) */}
          <button
            type="button"
            onClick={() => {
              clearAllFilters();
              setOnlyPendencias(!onlyPendencias);
            }}
            className={`text-left px-3 py-1.5 border-l-4 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
              onlyPendencias
                ? "border-l-[#ef4444] bg-[#2b1114]"
                : data.resumo.comPendencia > 0
                ? "border-l-[#ef4444] bg-[#1f1013] hover:bg-[#2b1114]"
                : "border-l-transparent hover:bg-[#17261f]"
            }`}
          >
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#f87171] flex items-center gap-1 truncate">
                <span>REFAZER / PENDÊNCIA</span>
                {data.resumo.comPendencia > 0 && <AlertTriangle className="w-3 h-3 text-[#ef4444] shrink-0" />}
              </div>
              <div className="text-[10px] text-[#fca5a5] truncate">
                {data.resumo.comPendencia > 0 ? "Proc. 1043/2026" : "Sem pendências"}
              </div>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-[#f87171] tabular-nums shrink-0">
              {data.resumo.comPendencia}
            </span>
          </button>
        </section>

        {/* COMPACT ANALYTICAL STRIP: DISTRIBUIÇÃO, PROCESSOS POR AGENTE & MODALIDADES */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
          {/* COMPACT CARD 1: DISTRIBUIÇÃO POR ESTÁGIO OPERACIONAL (5 COLS) */}
          <div className="lg:col-span-5 bg-[#111c17] border border-[#23382d] flex flex-col">
            <div className="px-3 py-1 bg-[#16241d] border-b border-[#23382d] flex items-center justify-between gap-3">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#a2c682] shrink-0">
                DISTRIBUIÇÃO POR ESTÁGIO
              </h2>
              {/* Inline Segmented Progress Bar */}
              <div className="flex-1 max-w-[200px] h-2 flex bg-[#0a110e] border border-[#23382d] overflow-hidden">
                {data.porEstagio.map((st, idx) => {
                  const colors = [
                    "bg-[#658b61]",
                    "bg-[#3da174]",
                    "bg-[#2f7958]",
                    "bg-[#1e5c40]",
                    "bg-[#a2c682]",
                  ];
                  if (st.count === 0) return null;
                  return (
                    <div
                      key={st.id}
                      style={{ width: `${(st.count / Math.max(1, data.totalProcessos)) * 100}%` }}
                      className={`${colors[idx % colors.length]} h-full border-r border-[#0a110e] last:border-r-0`}
                      title={`${st.label}: ${st.count} processos (${st.percent}%)`}
                    />
                  );
                })}
              </div>
            </div>
            <div className="p-1.5 grid grid-cols-2 sm:grid-cols-5 gap-1 flex-1">
              {data.porEstagio.map((st, idx) => {
                const isSelected = selectedEstagio === st.id;
                const indicatorColors = [
                  "bg-[#658b61]",
                  "bg-[#3da174]",
                  "bg-[#2f7958]",
                  "bg-[#1e5c40]",
                  "bg-[#a2c682]",
                ];
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      setSelectedEstagio(selectedEstagio === st.id ? "TODOS" : st.id)
                    }
                    title={`${st.label} (${st.fase}): ${st.count} processos (${st.percent}%)`}
                    className={`px-2 py-1 text-left border transition-colors cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-[#1d3328] border-[#a2c682]"
                        : "bg-[#0d1612] border-[#1d3027] hover:bg-[#17261f]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 shrink-0 ${indicatorColors[idx % indicatorColors.length]}`} />
                      <span className="text-[10px] font-medium text-[#b4c9be] truncate">
                        {SHORT_STAGE_LABELS[st.id]}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-0.5 tabular-nums">
                      <span className="text-sm font-bold text-[#f1f7f4]">{st.count}</span>
                      <span className="text-[10px] text-[#7d998a]">{st.percent}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* COMPACT CARD 2: PROCESSOS POR AGENTE DE CONTRATAÇÃO (4 COLS) */}
          <div className="lg:col-span-4 bg-[#111c17] border border-[#23382d] flex flex-col">
            <div className="px-3 py-1 bg-[#16241d] border-b border-[#23382d] flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#a2c682]">
                PROCESSOS POR AGENTE
              </h2>
              <span className="text-[10px] text-[#7d998a] tabular-nums">
                Int. / Ext. / Avanço
              </span>
            </div>
            <div className="p-1.5 grid grid-cols-3 gap-1.5 flex-1">
              {data.porAgente.map((ag) => {
                const isSelected = selectedAgente === ag.agente;
                return (
                  <button
                    key={ag.agente}
                    type="button"
                    onClick={() =>
                      setSelectedAgente(selectedAgente === ag.agente ? "TODOS" : ag.agente)
                    }
                    className={`px-2.5 py-1 text-left border transition-colors cursor-pointer flex flex-col justify-between tabular-nums ${
                      isSelected
                        ? "bg-[#1d3328] border-[#a2c682]"
                        : "bg-[#0d1612] border-[#1d3027] hover:bg-[#17261f]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs font-bold text-[#f1f7f4] truncate">
                          {ag.agente}
                        </span>
                        {ag.comPendencia > 0 && (
                          <span
                            className="w-2 h-2 bg-[#ef4444] shrink-0"
                            title={`${ag.comPendencia} processo(s) com REFAZER`}
                          />
                        )}
                      </div>
                      <span className="text-sm font-bold text-[#a2c682] shrink-0">
                        {ag.total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#7d998a] mt-0.5">
                      <span>
                        I:<strong className="text-[#b4c9be]">{ag.faseInterna}</strong> E:
                        <strong className="text-[#3da174]">{ag.faseExterna}</strong>
                      </span>
                      <span className="font-semibold text-[#f1f7f4]">{ag.progressoMedio}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* COMPACT CARD 3: MODALIDADES E RETENÇÕES (3 COLS) */}
          <div className="lg:col-span-3 bg-[#111c17] border border-[#23382d] flex flex-col">
            <div className="px-3 py-1 bg-[#16241d] border-b border-[#23382d] flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#a2c682]">
                MODALIDADES
              </h2>
              <span className="text-[10px] text-[#7d998a]">FILTRO RÁPIDO</span>
            </div>
            <div className="p-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1 flex-1 content-center">
              {data.porModalidade.map((m) => {
                const isSelected = selectedModalidade === m.modalidade;
                const shortMod =
                  m.modalidade === "Compra Direta / Dispensa"
                    ? "Dispensa / Direta"
                    : m.modalidade === "Pregão Eletrônico"
                    ? "Pregão Eletr."
                    : m.modalidade;
                return (
                  <button
                    key={m.modalidade}
                    type="button"
                    onClick={() =>
                      setSelectedModalidade(
                        selectedModalidade === m.modalidade ? "TODAS" : m.modalidade
                      )
                    }
                    title={m.modalidade}
                    className={`px-2 py-1 border text-[11px] flex items-center justify-between gap-1 cursor-pointer transition-colors tabular-nums ${
                      isSelected
                        ? "bg-[#1d3328] border-[#a2c682] font-bold text-[#a2c682]"
                        : "bg-[#0d1612] border-[#1d3027] text-[#f1f7f4] hover:bg-[#17261f]"
                    }`}
                  >
                    <span className="truncate text-[10px]">{shortMod}</span>
                    <span className="font-bold text-[#a2c682] shrink-0">{m.total}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* COMPACT FILTER & CONTROL BAR */}
        {(!tvMode || hasActiveFilters) && (
          <section
            aria-label="Controles de Pesquisa e Filtro"
            className="bg-[#111c17] border border-[#23382d] px-2.5 py-1.5 flex flex-col xl:flex-row xl:items-center justify-between gap-2"
          >
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-[#7d998a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setTvCurrentPage(0);
                  }}
                  placeholder="Buscar processo (ex: 1058/2026) ou objeto..."
                  className="w-full pl-7 pr-6 py-1 text-xs bg-[#0a110e] border border-[#345243] text-[#f1f7f4] placeholder-[#7d998a] focus:outline-none focus:border-[#a2c682]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7d998a] hover:text-[#f1f7f4] cursor-pointer"
                    aria-label="Limpar busca"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Macro-Fase Select */}
              <select
                value={selectedFase}
                onChange={(e) => {
                  setSelectedFase(e.target.value);
                  setTvCurrentPage(0);
                }}
                aria-label="Filtrar por Fase"
                className="px-2 py-1 text-xs bg-[#0a110e] border border-[#345243] text-[#f1f7f4] font-medium focus:outline-none focus:border-[#a2c682] cursor-pointer"
              >
                <option value="TODAS">Fase: Todas ({data.totalProcessos})</option>
                <option value="FASE_INTERNA">Fase Interna ({data.resumo.faseInterna})</option>
                <option value="FASE_EXTERNA">Fase Externa ({data.resumo.faseExterna})</option>
              </select>

              {/* Agente Select */}
              <select
                value={selectedAgente}
                onChange={(e) => {
                  setSelectedAgente(e.target.value);
                  setTvCurrentPage(0);
                }}
                aria-label="Filtrar por Agente de Contratação"
                className="px-2 py-1 text-xs bg-[#0a110e] border border-[#345243] text-[#f1f7f4] font-medium focus:outline-none focus:border-[#a2c682] cursor-pointer"
              >
                <option value="TODOS">Agente: Todos</option>
                {data.porAgente.map((ag) => (
                  <option key={ag.agente} value={ag.agente}>
                    {ag.agente} ({ag.total})
                  </option>
                ))}
              </select>

              {/* Modalidade Select */}
              <select
                value={selectedModalidade}
                onChange={(e) => {
                  setSelectedModalidade(e.target.value);
                  setTvCurrentPage(0);
                }}
                aria-label="Filtrar por Modalidade"
                className="px-2 py-1 text-xs bg-[#0a110e] border border-[#345243] text-[#f1f7f4] font-medium focus:outline-none focus:border-[#a2c682] cursor-pointer"
              >
                <option value="TODAS">Modalidade: Todas</option>
                {data.porModalidade.map((m) => (
                  <option key={m.modalidade} value={m.modalidade}>
                    {m.modalidade} ({m.total})
                  </option>
                ))}
              </select>

              {/* Sort Select */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                aria-label="Ordenar processos"
                className="px-2 py-1 text-xs bg-[#0a110e] border border-[#345243] text-[#f1f7f4] font-medium focus:outline-none focus:border-[#a2c682] cursor-pointer"
              >
                <option value="ORDEM">Ordem (1–30)</option>
                <option value="PENDENCIA">Priorizar Refazer</option>
                <option value="PROGRESSO_DESC">Maior Avanço (%)</option>
                <option value="PROGRESSO_ASC">Menor Avanço (%)</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-2 py-1 text-xs font-bold uppercase text-white bg-[#b91c1c] hover:bg-[#991b1b] flex items-center gap-1 cursor-pointer"
                >
                  <Filter className="w-3 h-3" />
                  <span>Limpar ({filteredProcessos.length}/{data.totalProcessos})</span>
                </button>
              )}
            </div>

            {/* View Switcher & Legend */}
            <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5">
              {/* Sober Dark Legend */}
              <div className="flex items-center gap-2.5 text-[10px] text-[#b4c9be]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-[#2f7958] border border-[#3da174] inline-block" /> Concluído
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 border border-[#f59e0b] bg-[#3b2506] inline-block" /> Atual
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-[#b91c1c] border border-[#ef4444] inline-block" /> Refazer
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-[#0e1713] border border-[#23382d] inline-block" /> Pendente
                </span>
              </div>

              <div className="hidden sm:flex border border-[#345243]">
                <button
                  type="button"
                  onClick={() => setViewMode("MATRIZ")}
                  className={`px-2.5 py-0.5 text-[11px] font-bold uppercase cursor-pointer ${
                    viewMode === "MATRIZ"
                      ? "bg-[#2f7958] text-white"
                      : "bg-[#0a110e] text-[#b4c9be] hover:bg-[#17261f]"
                  }`}
                >
                  Matriz 24 Etapas
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("RESUMO")}
                  className={`px-2.5 py-0.5 text-[11px] font-bold uppercase border-l border-[#345243] cursor-pointer ${
                    viewMode === "RESUMO"
                      ? "bg-[#2f7958] text-white"
                      : "bg-[#0a110e] text-[#b4c9be] hover:bg-[#17261f]"
                  }`}
                >
                  Visão Executiva
                </button>
              </div>
            </div>
          </section>
        )}

        {/* MAIN PROCESS TRACKING SECTION */}
        <section aria-label="Andamento dos Processos" className="bg-[#111c17] border border-[#23382d]">
          <div className="px-3.5 py-1.5 bg-[#004a2f] border-b border-[#2f7958] text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider">
                RELAÇÃO DE PROCESSOS ADMINISTRATIVOS DE COMPRAS
              </h2>
              <span className="text-xs text-[#a2c682] font-semibold tabular-nums">
                Exibindo {displayedProcessos.length} de {filteredProcessos.length} processos
              </span>
            </div>
            <div className="text-[11px] text-[#d5e3dc] hidden md:block">
              Clique em qualquer processo para abrir a ficha detalhada independente das 24 etapas
            </div>
          </div>

          {filteredProcessos.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-[#b4c9be]">
                Nenhum processo corresponde aos critérios de filtro selecionados.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-3 px-4 py-1.5 text-xs font-bold uppercase bg-[#2f7958] text-white hover:bg-[#3da174] cursor-pointer"
              >
                Restaurar Todos os Processos
              </button>
            </div>
          ) : (
            <>
              {/* DESKTOP & TV TABLE VIEW (md and up) */}
              <div className="hidden md:block overflow-x-auto">
                {viewMode === "MATRIZ" ? (
                  <table className="w-full border-collapse text-left tabular-nums">
                    <thead>
                      {/* Group Header Row */}
                      <tr className="bg-[#16241d] border-b border-[#345243] text-[10px] font-bold uppercase tracking-wider text-[#a2c682]">
                        <th className="py-1 px-2 text-center border-r border-[#23382d]">
                          Item
                        </th>
                        <th className="py-1 px-2 text-center bg-[#182921] border-r border-[#345243] text-[#a2c682]">
                          Proc. Int.
                        </th>
                        <th colSpan={2} className="py-1 px-3 border-r border-[#345243]">
                          Identificação do Objeto e Responsável
                        </th>
                        <th
                          colSpan={6}
                          className="py-1 px-2 text-center bg-[#182921] border-r border-[#345243] text-[#a2c682]"
                        >
                          Fase Interna (6 Etapas)
                        </th>
                        <th className="py-1 px-2 text-center bg-[#182921] border-r border-[#345243] text-[#a2c682]">
                          Proc. Ext.
                        </th>
                        <th
                          colSpan={18}
                          className="py-1 px-2 text-center bg-[#14221b] border-r border-[#345243] text-[#a2c682]"
                        >
                          Fase Externa (18 Etapas)
                        </th>
                        <th colSpan={2} className="py-1 px-3 text-center">
                          Situação Atual
                        </th>
                      </tr>

                      {/* Step Column Headers */}
                      <tr className="bg-[#111c17] border-b-2 border-[#2f7958] text-[10px] font-bold uppercase text-[#b4c9be]">
                        <th className="py-1.5 px-2 text-center w-9 border-r border-[#23382d]">#</th>
                        <th className="py-1.5 px-2 w-28 text-center border-r border-[#345243] bg-[#15231c] text-[#f1f7f4]">
                          Nº Interno
                        </th>
                        <th className="py-1.5 px-3 min-w-[230px] max-w-[380px] border-r border-[#23382d]">
                          Objeto / Modalidade
                        </th>
                        <th className="py-1.5 px-2 w-20 border-r border-[#345243]">Agente</th>

                        {/* 6 Internal Step Columns */}
                        {INTERNAL_STEPS_META.map((m, i) => (
                          <th
                            key={m.code}
                            title={m.fullLabel}
                            className={`py-1.5 px-0.5 text-center w-9 bg-[#14211b] ${
                              i === 5 ? "border-r border-[#345243]" : "border-r border-[#23382d]"
                            }`}
                          >
                            <div className="leading-tight text-[9px] font-bold text-[#a2c682]">
                              {m.code}
                            </div>
                          </th>
                        ))}

                        {/* External Process Number - Exact same width & typography as Internal Process Number */}
                        <th className="py-1.5 px-2 w-28 text-center border-r border-[#345243] bg-[#15231c] text-[#f1f7f4]">
                          Nº Externo
                        </th>

                        {/* 18 External Step Columns */}
                        {EXTERNAL_STEPS_META.map((m, i) => (
                          <th
                            key={m.code}
                            title={m.fullLabel}
                            className={`py-1.5 px-0.5 text-center w-9 ${
                              i === 17 ? "border-r border-[#345243]" : "border-r border-[#23382d]"
                            }`}
                          >
                            <div className="leading-tight text-[9px] font-bold text-[#d5e3dc]">
                              {m.code}
                            </div>
                          </th>
                        ))}

                        <th className="py-1.5 px-2.5 w-44 border-r border-[#23382d]">
                          Etapa Atual / Ação
                        </th>
                        <th className="py-1.5 px-2 w-20 text-right">Avanço</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#23382d]">
                      {displayedProcessos.map((proc) => {
                        const pKey = getProcessKey(proc);
                        const isSelected = selectedProcessKey === pKey;
                        const procNumberTextSize = tvMode
                          ? "text-base 2xl:text-lg"
                          : "text-sm";

                        return (
                          <tr
                            key={pKey}
                            onClick={() => setSelectedProcessKey(pKey)}
                            className={`cursor-pointer transition-colors ${
                              proc.temPendencia
                                ? "bg-[#241114] hover:bg-[#30161a]"
                                : isSelected
                                ? "bg-[#1d3328]"
                                : "hover:bg-[#17261f]"
                            }`}
                          >
                            {/* # Ordem */}
                            <td
                              className={`py-1.5 px-2 text-center font-bold border-r border-[#23382d] ${
                                proc.temPendencia
                                  ? "border-l-4 border-l-[#ef4444] text-[#f87171]"
                                  : proc.macroFase === "FASE_EXTERNA"
                                  ? "border-l-4 border-l-[#3da174] text-[#f1f7f4]"
                                  : "border-l-4 border-l-[#658b61] text-[#b4c9be]"
                              }`}
                            >
                              {proc.ordem}
                            </td>

                            {/* Processo Interno - Equal size & prominence to Processo Externo */}
                            <td
                              className={`py-1.5 px-2 text-center font-bold ${procNumberTextSize} text-[#a2c682] bg-[#14211b] border-r border-[#345243] whitespace-nowrap tracking-tight`}
                            >
                              {proc.processoInterno}
                            </td>

                            {/* Objeto + Modalidade */}
                            <td className="py-1.5 px-3 border-r border-[#23382d] max-w-[380px]">
                              <div className="flex items-center gap-1.5">
                                {proc.modalidade !== "Compra Direta / Dispensa" && (
                                  <span className="shrink-0 text-[9px] font-bold uppercase px-1 py-0.2 bg-[#004a2f] border border-[#3da174] text-[#f1f7f4]">
                                    {proc.modalidade}
                                  </span>
                                )}
                                <span
                                  className={`font-medium text-[#f1f7f4] truncate leading-snug ${
                                    tvMode ? "text-sm 2xl:text-base" : "text-xs"
                                  }`}
                                  title={proc.objetoRaw}
                                >
                                  {proc.objeto}
                                </span>
                              </div>
                            </td>

                            {/* Agente */}
                            <td className="py-1.5 px-2 text-xs font-semibold text-[#b4c9be] border-r border-[#345243] whitespace-nowrap">
                              {proc.agente}
                            </td>

                            {/* 6 Internal Steps */}
                            {proc.etapasInternas.map((step, idx) => {
                              const isCurrentNext =
                                !proc.temPendencia &&
                                proc.proximaEtapa?.phase === "INTERNA" &&
                                proc.proximaEtapa?.label === step.fullLabel;
                              return (
                                <MatrixStepCell
                                  key={step.code}
                                  step={step}
                                  isCurrentNext={isCurrentNext}
                                  isLastInGroup={idx === 5}
                                />
                              );
                            })}

                            {/* Processo Externo - Equal size & prominence to Processo Interno */}
                            <td
                              className={`py-1.5 px-2 text-center font-bold ${procNumberTextSize} bg-[#14211b] border-r border-[#345243] whitespace-nowrap tracking-tight`}
                            >
                              {proc.processoExterno ? (
                                <span className="text-[#a2c682]">{proc.processoExterno}</span>
                              ) : (
                                <span className="text-[#526b5e]">—</span>
                              )}
                            </td>

                            {/* 18 External Steps */}
                            {proc.etapasExternas.map((step, idx) => {
                              const isCurrentNext =
                                !proc.temPendencia &&
                                proc.proximaEtapa?.phase === "EXTERNA" &&
                                proc.proximaEtapa?.label === step.fullLabel;
                              return (
                                <MatrixStepCell
                                  key={step.code}
                                  step={step}
                                  isCurrentNext={isCurrentNext}
                                  isLastInGroup={idx === 17}
                                />
                              );
                            })}

                            {/* Etapa Atual / Ação */}
                            <td className="py-1.5 px-2.5 border-r border-[#23382d] text-xs max-w-[180px]">
                              {proc.temPendencia ? (
                                <div className="font-bold text-[#f87171] flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0 text-[#ef4444]" />
                                  <span className="truncate">
                                    REFAZER: {proc.pendencias.join(", ")}
                                  </span>
                                </div>
                              ) : proc.proximaEtapa ? (
                                <div className="font-semibold text-[#fde68a] truncate" title={`Aguardando: ${proc.proximaEtapa.label}`}>
                                  {proc.proximaEtapa.label}
                                </div>
                              ) : (
                                <div className="font-bold text-[#3da174]">
                                  Fluxo Concluído
                                </div>
                              )}
                            </td>

                            {/* Progresso */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <span className="font-bold text-xs text-[#a2c682]">
                                  {proc.progressoTotal}%
                                </span>
                                <Eye className="w-3 h-3 text-[#7d998a]" />
                              </div>
                              <div className="w-full h-1 bg-[#0a110e] mt-0.5">
                                <div
                                  className={`h-full ${
                                    proc.temPendencia ? "bg-[#ef4444]" : "bg-[#3da174]"
                                  }`}
                                  style={{ width: `${proc.progressoTotal}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  /* VISÃO EXECUTIVA RESUMIDA (TABLE) */
                  <table className="w-full border-collapse text-left tabular-nums">
                    <thead>
                      <tr className="bg-[#16241d] border-b-2 border-[#2f7958] text-[11px] font-bold uppercase text-[#a2c682]">
                        <th className="py-2 px-3 w-12 text-center border-r border-[#23382d]">#</th>
                        <th className="py-2 px-3 w-32 text-center border-r border-[#23382d]">Proc. Interno</th>
                        <th className="py-2 px-3 w-32 text-center border-r border-[#23382d]">Proc. Externo</th>
                        <th className="py-2 px-3 border-r border-[#23382d]">Objeto da Contratação</th>
                        <th className="py-2 px-3 w-36 border-r border-[#23382d]">Modalidade</th>
                        <th className="py-2 px-3 w-28 border-r border-[#23382d]">Agente</th>
                        <th className="py-2 px-3 w-48 border-r border-[#23382d]">Estágio Atual</th>
                        <th className="py-2 px-3 w-52 border-r border-[#23382d]">Última Etapa Concluída</th>
                        <th className="py-2 px-3 w-52 border-r border-[#23382d]">Próxima Etapa / Ação</th>
                        <th className="py-2 px-3 w-44">Andamento (24 Etapas)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23382d]">
                      {displayedProcessos.map((proc) => {
                        const pKey = getProcessKey(proc);
                        const isSelected = selectedProcessKey === pKey;
                        const procNumberTextSize = tvMode
                          ? "text-base 2xl:text-lg"
                          : "text-sm";

                        return (
                          <tr
                            key={pKey}
                            onClick={() => setSelectedProcessKey(pKey)}
                            className={`cursor-pointer transition-colors ${
                              proc.temPendencia
                                ? "bg-[#241114] hover:bg-[#30161a]"
                                : isSelected
                                ? "bg-[#1d3328]"
                                : "hover:bg-[#17261f]"
                            }`}
                          >
                            <td
                              className={`py-1.5 px-3 text-center font-bold border-r border-[#23382d] ${
                                proc.temPendencia
                                  ? "border-l-4 border-l-[#ef4444] text-[#f87171]"
                                  : proc.macroFase === "FASE_EXTERNA"
                                  ? "border-l-4 border-l-[#3da174]"
                                  : "border-l-4 border-l-[#658b61]"
                              }`}
                            >
                              {proc.ordem}
                            </td>
                            <td
                              className={`py-1.5 px-3 text-center font-bold ${procNumberTextSize} text-[#a2c682] bg-[#14211b] border-r border-[#23382d] whitespace-nowrap`}
                            >
                              {proc.processoInterno}
                            </td>
                            <td
                              className={`py-1.5 px-3 text-center font-bold ${procNumberTextSize} text-[#a2c682] bg-[#14211b] border-r border-[#23382d] whitespace-nowrap`}
                            >
                              {proc.processoExterno || <span className="text-[#526b5e]">—</span>}
                            </td>
                            <td className="py-1.5 px-3 font-medium text-[#f1f7f4] border-r border-[#23382d]">
                              {proc.objeto}
                            </td>
                            <td className="py-1.5 px-3 text-xs font-semibold text-[#b4c9be] border-r border-[#23382d]">
                              {proc.modalidade}
                            </td>
                            <td className="py-1.5 px-3 font-semibold text-[#f1f7f4] border-r border-[#23382d]">
                              {proc.agente}
                            </td>
                            <td className="py-1.5 px-3 text-xs font-semibold text-[#a2c682] border-r border-[#23382d]">
                              {proc.estagioLabel}
                            </td>
                            <td className="py-1.5 px-3 text-xs border-r border-[#23382d]">
                              {proc.ultimaEtapaConcluida ? (
                                <div>
                                  <span className="font-semibold text-[#f1f7f4]">
                                    {proc.ultimaEtapaConcluida.label}
                                  </span>
                                  <span className="ml-1.5 text-[11px] font-bold text-[#3da174]">
                                    ({proc.ultimaEtapaConcluida.valor})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[#7d998a]">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-xs border-r border-[#23382d]">
                              {proc.temPendencia ? (
                                <span className="font-bold text-[#f87171]">
                                  REFAZER: {proc.pendencias.join(", ")}
                                </span>
                              ) : proc.proximaEtapa ? (
                                <span className="font-semibold text-[#fde68a]">
                                  {proc.proximaEtapa.label}
                                </span>
                              ) : (
                                <span className="font-bold text-[#3da174]">Concluído</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3">
                              <div className="flex items-center justify-between text-xs font-bold mb-1">
                                <span className="text-[#b4c9be]">
                                  {proc.concluidasTotal}/{proc.aplicaveisTotal} etapas
                                </span>
                                <span className="text-[#a2c682]">{proc.progressoTotal}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-[#0a110e]">
                                <div
                                  className={`h-full ${
                                    proc.temPendencia ? "bg-[#ef4444]" : "bg-[#3da174]"
                                  }`}
                                  style={{ width: `${proc.progressoTotal}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SMALL SCREENS / MOBILE RESPONSIVE VIEW (< md) */}
              <div className="md:hidden divide-y divide-[#23382d]">
                {displayedProcessos.map((proc) => {
                  const pKey = getProcessKey(proc);
                  return (
                    <div
                      key={pKey}
                      onClick={() => setSelectedProcessKey(pKey)}
                      className={`p-3 cursor-pointer transition-colors ${
                        proc.temPendencia
                          ? "border-l-4 border-l-[#ef4444] bg-[#241114] hover:bg-[#30161a]"
                          : proc.macroFase === "FASE_EXTERNA"
                          ? "border-l-4 border-l-[#3da174] bg-[#111c17] hover:bg-[#17261f]"
                          : "border-l-4 border-l-[#658b61] bg-[#111c17] hover:bg-[#17261f]"
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Top Identification Bar - Equal font size for Interno and Externo */}
                        <div className="flex items-center justify-between gap-2 tabular-nums">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-1.5 py-0.5 bg-[#004a2f] border border-[#2f7958] text-white text-xs font-bold">
                              #{proc.ordem}
                            </span>
                            <span className="text-sm font-bold text-[#a2c682] bg-[#16241d] px-2 py-0.5 border border-[#345243]">
                              Int: {proc.processoInterno}
                            </span>
                            <span className="text-sm font-bold text-[#a2c682] bg-[#16241d] px-2 py-0.5 border border-[#345243]">
                              Ext: {proc.processoExterno || "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-sm font-bold text-[#a2c682]">
                              {proc.progressoTotal}%
                            </span>
                            <Eye className="w-4 h-4 text-[#7d998a]" />
                          </div>
                        </div>

                        {/* Object & Modality */}
                        <div>
                          {proc.modalidade !== "Compra Direta / Dispensa" && (
                            <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 bg-[#004a2f] text-[#f1f7f4] border border-[#3da174] mr-1.5 mb-1">
                              {proc.modalidade}
                            </span>
                          )}
                          <p className="text-xs font-semibold text-[#f1f7f4] leading-snug">
                            {proc.objeto}
                          </p>
                        </div>

                        {/* Metadata & Current Stage */}
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-[#23382d]">
                          <div>
                            <span className="text-[#7d998a] uppercase font-bold block text-[9px]">
                              Agente Responsável
                            </span>
                            <span className="font-semibold text-[#f1f7f4]">{proc.agente}</span>
                          </div>
                          <div>
                            <span className="text-[#7d998a] uppercase font-bold block text-[9px]">
                              Situação / Próxima Etapa
                            </span>
                            {proc.temPendencia ? (
                              <span className="font-bold text-[#f87171]">
                                REFAZER: {proc.pendencias.join(", ")}
                              </span>
                            ) : proc.proximaEtapa ? (
                              <span className="font-semibold text-[#fde68a]">
                                Aguard.: {proc.proximaEtapa.label}
                              </span>
                            ) : (
                              <span className="font-bold text-[#3da174]">Concluído</span>
                            )}
                          </div>
                        </div>

                        {/* Mini 24-Step Segmented Strip */}
                        <div className="space-y-1 pt-1">
                          <div className="grid grid-cols-24 gap-[2px] h-2">
                            {proc.todasEtapas.map((s) => (
                              <div
                                key={`${proc.ordem}-${s.index}`}
                                title={`${s.fullLabel}: ${s.rawValue || "Pendente"}`}
                                className={`h-full ${
                                  s.status === "REFAZER"
                                    ? "bg-[#ef4444]"
                                    : s.status === "CONCLUIDO"
                                    ? s.phase === "INTERNA"
                                      ? "bg-[#658b61]"
                                      : "bg-[#3da174]"
                                    : s.status === "NA"
                                    ? "bg-[#23382d]"
                                    : "bg-[#0a110e]"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>

      {/* INDEPENDENT PROCESS DETAIL MODAL / DRAWER (Decoupled from background table refresh) */}
      {selectedProcesso && (
        <IndependentProcessDetailModal
          proc={selectedProcesso}
          filteredProcessos={filteredProcessos}
          onSelectProcess={(p) => setSelectedProcessKey(getProcessKey(p))}
          onClose={() => setSelectedProcessKey(null)}
        />
      )}

      {/* INSTITUTIONAL FOOTER */}
      <footer className="bg-[#111c17] border-t border-[#23382d] mt-auto">
        <div className="max-w-[2400px] mx-auto px-3 sm:px-5 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#b4c9be]">
          <div className="flex items-center gap-2">
            <strong className="text-[#a2c682] uppercase">Câmara Municipal de Bauru</strong>
            <span className="text-[#345243]">•</span>
            <span>Praça Dom Pedro II, 1-50 - Centro - Bauru/SP</span>
          </div>
          <div className="tabular-nums text-[11px] text-[#7d998a]">
            Painel de Controle de Compras • Sincronização automática em segundo plano a cada 30 segundos
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ISOLATED TOP SYNC STATUS BAR (Prevents 1s timer ticks from re-rendering the table or detail view) */
function SyncStatusBar({
  updatedAt,
  isRefreshing,
  syncError,
  onTriggerSync,
}: {
  updatedAt: string;
  isRefreshing: boolean;
  syncError: boolean;
  onTriggerSync: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL_SEC);
  const triggerRef = useRef(onTriggerSync);
  triggerRef.current = onTriggerSync;

  useEffect(() => {
    setSecondsLeft(REFRESH_INTERVAL_SEC);
  }, [updatedAt]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return REFRESH_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secondsLeft === REFRESH_INTERVAL_SEC) return;
    if (secondsLeft === 1) {
      const timeout = setTimeout(() => {
        triggerRef.current();
      }, 950);
      return () => clearTimeout(timeout);
    }
  }, [secondsLeft]);

  const formattedUpdatedTime = useMemo(() => {
    try {
      const d = new Date(updatedAt);
      return d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "--:--:--";
    }
  }, [updatedAt]);

  const formattedUpdatedDate = useMemo(() => {
    try {
      const d = new Date(updatedAt);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }, [updatedAt]);

  return (
    <div className="bg-[#071f14] text-white border-b border-[#1c3d2d]">
      <div className="max-w-[2400px] mx-auto px-3 sm:px-5 py-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-wider uppercase text-[#a2c682]">
            PODER LEGISLATIVO • MUNICÍPIO DE BAURU / SP
          </span>
          <span className="hidden md:inline text-[#345243]">|</span>
          <span className="hidden md:inline text-[#b4c9be]">
            DIRETORIA ADMINISTRATIVA • COMPRAS E CONTRATAÇÕES
          </span>
        </div>

        <div className="flex items-center gap-4 tabular-nums">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 ${
                syncError ? "bg-[#ef4444]" : isRefreshing ? "bg-[#a2c682]" : "bg-[#3da174]"
              }`}
            />
            <span className="text-[#b4c9be]">
              Sincronização: <strong className="text-white">{formattedUpdatedTime}</strong>
              <span className="hidden sm:inline text-[#7d998a]"> ({formattedUpdatedDate})</span>
            </span>
          </div>
          <span className="text-[#345243]">|</span>
          <div className="flex items-center gap-1.5 text-[#b4c9be]">
            <span>Próxima leitura:</span>
            <strong className="text-[#a2c682] w-6 text-right inline-block">{secondsLeft}s</strong>
          </div>
        </div>
      </div>
      {/* 30-second progress line */}
      <div className="w-full h-[2px] bg-[#0a110e] overflow-hidden">
        <div
          className="h-full bg-[#3da174] transition-all duration-1000 ease-linear"
          style={{ width: `${((REFRESH_INTERVAL_SEC - secondsLeft) / REFRESH_INTERVAL_SEC) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* MATRIX STEP CELL COMPONENT */
function MatrixStepCell({
  step,
  isCurrentNext,
  isLastInGroup,
}: {
  step: ProcessStep;
  isCurrentNext: boolean;
  isLastInGroup: boolean;
}) {
  const borderClass = isLastInGroup ? "border-r border-[#345243]" : "border-r border-[#1d3027]";
  const tooltip = `${step.fullLabel} (${step.phase === "INTERNA" ? "Fase Interna" : "Fase Externa"}): ${
    step.rawValue || "Pendente"
  }`;

  if (step.status === "REFAZER") {
    return (
      <td title={tooltip} className={`p-0.5 text-center align-middle ${borderClass}`}>
        <div className="w-full h-5 bg-[#b91c1c] border border-[#ef4444] text-white flex items-center justify-center text-[9px] font-bold tracking-tighter">
          REF
        </div>
      </td>
    );
  }

  if (step.status === "CONCLUIDO") {
    const isOk = step.rawValue.toUpperCase() === "OK";
    return (
      <td title={tooltip} className={`p-0.5 text-center align-middle ${borderClass}`}>
        <div
          className={`w-full h-5 ${
            step.phase === "INTERNA"
              ? "bg-[#256347] border border-[#3da174]"
              : "bg-[#1b5239] border border-[#2f7958]"
          } text-[#f1f7f4] flex items-center justify-center text-[9px] font-semibold tracking-tighter overflow-hidden`}
        >
          {isOk ? <Check className="w-3 h-3 stroke-[2.5] text-[#a2c682]" /> : step.rawValue}
        </div>
      </td>
    );
  }

  if (step.status === "NA") {
    return (
      <td
        title={`${step.fullLabel}: Não se aplica (${step.rawValue})`}
        className={`p-0.5 text-center align-middle ${borderClass}`}
      >
        <div className="w-full h-5 bg-[#16231d] text-[#7d998a] flex items-center justify-center text-[9px] font-semibold">
          N/A
        </div>
      </td>
    );
  }

  // PENDENTE
  return (
    <td title={tooltip} className={`p-0.5 text-center align-middle ${borderClass}`}>
      <div
        className={`w-full h-5 flex items-center justify-center text-[9px] ${
          isCurrentNext
            ? "border border-[#f59e0b] bg-[#3b2506] text-[#fde68a] font-bold"
            : "bg-[#0d1612] text-transparent"
        }`}
      >
        {isCurrentNext ? "ATUAL" : "·"}
      </div>
    </td>
  );
}

/* INDEPENDENT PROCESS DETAIL OVERLAY / MODAL */
function IndependentProcessDetailModal({
  proc,
  filteredProcessos,
  onSelectProcess,
  onClose,
}: {
  proc: ProcessoItem;
  filteredProcessos: ProcessoItem[];
  onSelectProcess: (p: ProcessoItem) => void;
  onClose: () => void;
}) {
  // Handle ESC key to close independent view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const currentIndex = useMemo(
    () => filteredProcessos.findIndex((p) => getProcessKey(p) === getProcessKey(proc)),
    [filteredProcessos, proc]
  );

  const prevProc = currentIndex > 0 ? filteredProcessos[currentIndex - 1] : null;
  const nextProc =
    currentIndex >= 0 && currentIndex < filteredProcessos.length - 1
      ? filteredProcessos[currentIndex + 1]
      : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhamento do Processo ${proc.processoInterno}`}
    >
      <div
        className="bg-[#111c17] border-2 border-[#2f7958] w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#071f14] border-b border-[#2f7958] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-[#2f7958] text-white text-xs font-bold uppercase tracking-wider tabular-nums">
              ITEM #{proc.ordem}
            </span>
            <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[#a2c682]">
              FICHA DE ANDAMENTO DO PROCESSO (EXIBIÇÃO INDEPENDENTE)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Prev / Next Navigation */}
            <div className="flex items-center border border-[#345243] bg-[#111c17]">
              <button
                type="button"
                disabled={!prevProc}
                onClick={() => prevProc && onSelectProcess(prevProc)}
                className="px-2.5 py-1 text-xs font-semibold text-[#f1f7f4] hover:bg-[#17261f] disabled:opacity-35 flex items-center gap-1 border-r border-[#345243] cursor-pointer disabled:cursor-default"
                title="Processo Anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              <button
                type="button"
                disabled={!nextProc}
                onClick={() => nextProc && onSelectProcess(nextProc)}
                className="px-2.5 py-1 text-xs font-semibold text-[#f1f7f4] hover:bg-[#17261f] disabled:opacity-35 flex items-center gap-1 cursor-pointer disabled:cursor-default"
                title="Próximo Processo"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <span>Fechar</span>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Independent Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Process Identification & Equal-Size Process Numbers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-[#16241d] border border-[#23382d] p-4">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7d998a]">
                OBJETO DA CONTRATAÇÃO / AQUISIÇÃO
              </div>
              <div className="text-base sm:text-lg font-bold text-[#f1f7f4] leading-snug">
                {proc.objetoRaw}
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#b4c9be]">
                <div>
                  <span className="text-[#7d998a] uppercase font-bold">Agente: </span>
                  <strong className="text-[#f1f7f4]">{proc.agente}</strong>
                </div>
                <div>
                  <span className="text-[#7d998a] uppercase font-bold">Modalidade: </span>
                  <strong className="text-[#a2c682]">{proc.modalidade}</strong>
                </div>
                <div>
                  <span className="text-[#7d998a] uppercase font-bold">Estágio: </span>
                  <strong className="text-[#f1f7f4]">{proc.estagioLabel}</strong>
                </div>
              </div>
            </div>

            {/* Symmetrical, Equal-Font-Size Boxes for Processo Interno and Processo Externo */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
              <div className="bg-[#0d1612] border border-[#345243] p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7d998a]">
                  PROCESSO FASE INTERNA
                </span>
                <span className="text-lg sm:text-xl font-bold text-[#a2c682] mt-1">
                  {proc.processoInterno}
                </span>
                <span className="text-[11px] text-[#b4c9be] mt-1">
                  {proc.concluidasInternas}/{proc.aplicaveisInternas} etapas ({proc.progressoInterno}%)
                </span>
              </div>

              <div className="bg-[#0d1612] border border-[#345243] p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7d998a]">
                  PROCESSO FASE EXTERNA
                </span>
                <span className="text-lg sm:text-xl font-bold text-[#a2c682] mt-1">
                  {proc.processoExterno || "Não instaurado"}
                </span>
                <span className="text-[11px] text-[#b4c9be] mt-1">
                  {proc.concluidasExternas}/{proc.aplicaveisExternas} etapas ({proc.progressoExterno}%)
                </span>
              </div>

              <div className="bg-[#0d1612] border border-[#345243] p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7d998a]">
                  AVANÇO GLOBAL
                </span>
                <span className="text-lg sm:text-xl font-bold text-[#f1f7f4] mt-1">
                  {proc.progressoTotal}%
                </span>
                <div className="w-full h-2 bg-[#16241d] mt-1.5">
                  <div
                    className={`h-full ${
                      proc.temPendencia ? "bg-[#ef4444]" : "bg-[#3da174]"
                    }`}
                    style={{ width: `${proc.progressoTotal}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Current Action / Status Banner */}
          <div
            className={`px-4 py-3 border flex flex-wrap items-center justify-between gap-2 text-xs ${
              proc.temPendencia
                ? "bg-[#2b1114] border-[#ef4444] text-[#fca5a5]"
                : "bg-[#14211b] border-[#345243] text-[#b4c9be]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase text-[#f1f7f4]">Situação Operacional:</span>
              {proc.temPendencia ? (
                <span className="font-bold text-[#f87171]">
                  REFAZER ETAPA(S): {proc.pendencias.join(", ")}
                </span>
              ) : proc.proximaEtapa ? (
                <span>
                  Aguardando <strong className="text-[#fde68a]">{proc.proximaEtapa.label}</strong> (
                  {proc.proximaEtapa.phase === "INTERNA" ? "Fase Interna" : "Fase Externa"})
                </span>
              ) : (
                <span className="font-bold text-[#3da174]">Todas as etapas concluídas</span>
              )}
            </div>
            {proc.ultimaEtapaConcluida && (
              <div className="tabular-nums">
                <span className="text-[#7d998a]">Última etapa concluída: </span>
                <strong className="text-[#a2c682]">
                  {proc.ultimaEtapaConcluida.label} ({proc.ultimaEtapaConcluida.valor})
                </strong>
              </div>
            )}
          </div>

          {/* Detailed 24 Steps Grid (6 Internal + 18 External) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Fase Interna Detail (4 cols) */}
            <div className="lg:col-span-4 bg-[#0d1612] border border-[#345243]">
              <div className="px-3.5 py-2.5 bg-[#182921] border-b border-[#345243] flex items-center justify-between font-bold text-xs text-[#a2c682] tabular-nums">
                <span>FASE INTERNA • PROC. {proc.processoInterno}</span>
                <span>
                  {proc.concluidasInternas}/{proc.aplicaveisInternas} ({proc.progressoInterno}%)
                </span>
              </div>
              <div className="divide-y divide-[#1d3027] tabular-nums text-xs">
                {proc.etapasInternas.map((s, i) => {
                  const isNext =
                    !proc.temPendencia &&
                    proc.proximaEtapa?.phase === "INTERNA" &&
                    proc.proximaEtapa?.label === s.fullLabel;
                  return (
                    <div
                      key={s.code}
                      className={`px-3.5 py-2.5 flex items-center justify-between ${
                        isNext ? "bg-[#261c0a]" : ""
                      }`}
                    >
                      <span className="text-[#f1f7f4] font-medium">
                        {i + 1}. {s.fullLabel}
                      </span>
                      <StepStatusBadge step={s} isNext={isNext} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fase Externa Detail (8 cols) */}
            <div className="lg:col-span-8 bg-[#0d1612] border border-[#345243]">
              <div className="px-3.5 py-2.5 bg-[#182921] border-b border-[#345243] flex items-center justify-between font-bold text-xs text-[#a2c682] tabular-nums">
                <span>
                  FASE EXTERNA • PROC. {proc.processoExterno || "NÃO INSTAURADO"}
                </span>
                <span>
                  {proc.concluidasExternas}/{proc.aplicaveisExternas} ({proc.progressoExterno}%)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#1d3027] tabular-nums text-xs">
                {proc.etapasExternas.map((s, i) => {
                  const isNext =
                    !proc.temPendencia &&
                    proc.proximaEtapa?.phase === "EXTERNA" &&
                    proc.proximaEtapa?.label === s.fullLabel;
                  return (
                    <div
                      key={s.code}
                      className={`px-3.5 py-2.5 flex items-center justify-between ${
                        isNext ? "bg-[#261c0a]" : "bg-[#0d1612]"
                      }`}
                    >
                      <span className="text-[#f1f7f4] font-medium truncate pr-2">
                        {i + 1}. {s.fullLabel}
                      </span>
                      <StepStatusBadge step={s} isNext={isNext} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepStatusBadge({ step, isNext }: { step: ProcessStep; isNext?: boolean }) {
  if (step.status === "REFAZER") {
    return (
      <span className="px-2 py-0.5 bg-[#b91c1c] border border-[#ef4444] text-white font-bold text-[10px] uppercase shrink-0">
        {step.rawValue}
      </span>
    );
  }
  if (step.status === "CONCLUIDO") {
    return (
      <span className="px-2 py-0.5 bg-[#1b5239] text-[#a2c682] border border-[#3da174] font-bold text-[11px] shrink-0">
        {step.rawValue}
      </span>
    );
  }
  if (step.status === "NA") {
    return (
      <span className="text-[#7d998a] font-semibold text-[11px] shrink-0">
        N/A ({step.rawValue})
      </span>
    );
  }
  if (isNext) {
    return (
      <span className="px-2 py-0.5 bg-[#3b2506] border border-[#f59e0b] text-[#fde68a] font-bold text-[10px] uppercase shrink-0">
        AGUARDANDO
      </span>
    );
  }
  return <span className="text-[#526b5e] text-[11px] shrink-0">Pendente</span>;
}
