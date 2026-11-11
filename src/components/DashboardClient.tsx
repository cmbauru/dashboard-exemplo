"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Play,
  Pause,
  Filter,
  X,
} from "lucide-react";

interface DashboardClientProps {
  initialData: DashboardData;
}

const REFRESH_INTERVAL_SEC = 30;
const TV_PAGE_INTERVAL_SEC = 12;

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL_SEC);
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
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // TV Mode state
  const [tvMode, setTvMode] = useState(false);
  const [tvAutoRotate, setTvAutoRotate] = useState(true);
  const [tvPageSize, setTvPageSize] = useState<number>(10);
  const [tvCurrentPage, setTvCurrentPage] = useState<number>(0);

  const fetchLatestData = useCallback(async () => {
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
      setIsRefreshing(false);
      setSecondsLeft(REFRESH_INTERVAL_SEC);
    }
  }, []);

  // 30-second background polling + 1s countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          fetchLatestData();
          return REFRESH_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchLatestData]);

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

  // Auto-cycle pages in TV mode
  useEffect(() => {
    if (!tvMode || !tvAutoRotate || totalTvPages <= 1) return;
    const interval = setInterval(() => {
      setTvCurrentPage((prev) => (prev + 1) % totalTvPages);
    }, TV_PAGE_INTERVAL_SEC * 1000);
    return () => clearInterval(interval);
  }, [tvMode, tvAutoRotate, totalTvPages]);

  const displayedProcessos = useMemo(() => {
    if (!tvMode || tvPageSize >= filteredProcessos.length) {
      return filteredProcessos;
    }
    const safePage = tvCurrentPage % totalTvPages;
    const start = safePage * tvPageSize;
    return filteredProcessos.slice(start, start + tvPageSize);
  }, [filteredProcessos, tvMode, tvPageSize, tvCurrentPage, totalTvPages]);

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

  const formattedUpdatedTime = useMemo(() => {
    try {
      const d = new Date(data.updatedAt);
      return d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "--:--:--";
    }
  }, [data.updatedAt]);

  const formattedUpdatedDate = useMemo(() => {
    try {
      const d = new Date(data.updatedAt);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }, [data.updatedAt]);

  return (
    <div className={`min-h-screen flex flex-col bg-[#f2f5f3] text-[#111c16] ${tvMode ? "text-base 2xl:text-lg" : "text-sm"}`}>
      {/* TOP INSTITUTIONAL BAR - CÂMARA MUNICIPAL DE BAURU */}
      <div className="bg-[#004a2f] text-white border-b border-[#003521]">
        <div className="max-w-[2400px] mx-auto px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-wider uppercase text-[#a2c682]">
              PODER LEGISLATIVO • MUNICÍPIO DE BAURU / SP
            </span>
            <span className="hidden md:inline text-[#658b61]">|</span>
            <span className="hidden md:inline text-[#d5e3dc]">
              DIRETORIA ADMINISTRATIVA • COMPRAS E CONTRATAÇÕES
            </span>
          </div>

          <div className="flex items-center gap-4 tabular-nums">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 ${
                  syncError ? "bg-[#db0a13]" : isRefreshing ? "bg-[#a2c682]" : "bg-[#28a745]"
                }`}
              />
              <span className="text-[#d5e3dc]">
                Sincronização: <strong className="text-white">{formattedUpdatedTime}</strong>
                <span className="hidden sm:inline text-[#9ebfb0]"> ({formattedUpdatedDate})</span>
              </span>
            </div>
            <span className="text-[#658b61]">|</span>
            <div className="flex items-center gap-1.5 text-[#d5e3dc]">
              <span>Próxima leitura:</span>
              <strong className="text-white w-6 text-right inline-block">{secondsLeft}s</strong>
            </div>
          </div>
        </div>
        {/* 30-second progress line */}
        <div className="w-full h-[3px] bg-[#003521] overflow-hidden">
          <div
            className="h-full bg-[#2f7958] transition-all duration-1000 ease-linear"
            style={{ width: `${((REFRESH_INTERVAL_SEC - secondsLeft) / REFRESH_INTERVAL_SEC) * 100}%` }}
          />
        </div>
      </div>

      {/* MAIN INSTITUTIONAL HEADER */}
      <header className="bg-white border-b-2 border-[#2f7958]">
        <div className="max-w-[2400px] mx-auto px-3 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-4">
            {/* Official Logo of Câmara Municipal de Bauru */}
            <a
              href="https://www.bauru.sp.leg.br"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 focus:outline-none"
              title="Portal da Câmara Municipal de Bauru"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-camara-bauru.png"
                alt="Câmara Municipal de Bauru"
                className={`${tvMode ? "h-12 sm:h-14" : "h-10 sm:h-12"} w-auto object-contain`}
              />
            </a>

            <div className="h-10 w-[1px] bg-[#d0dbd5] hidden sm:block" />

            <div>
              <h1
                className={`font-bold uppercase tracking-tight text-[#004a2f] leading-tight ${
                  tvMode ? "text-xl sm:text-2xl 2xl:text-3xl" : "text-base sm:text-xl"
                }`}
              >
                CONTROLE GERAL DE COMPRAS E PROCESSOS
              </h1>
              <div className="text-xs text-[#3f5248] font-medium mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
                <span>FASE INTERNA (6 ETAPAS) E FASE EXTERNA (18 ETAPAS)</span>
                <span className="text-[#9eb2a8]">•</span>
                <span>ATUALIZAÇÃO AUTOMÁTICA A CADA 30 SEGUNDOS</span>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {tvMode && (
              <div className="flex items-center border border-[#d0dbd5] bg-[#f2f5f3]">
                <button
                  type="button"
                  onClick={() => setTvAutoRotate((r) => !r)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#004a2f] hover:bg-[#e3ebe6] flex items-center gap-1.5 border-r border-[#d0dbd5] cursor-pointer"
                  title="Alternar rotação automática de páginas na TV"
                >
                  {tvAutoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{tvAutoRotate ? "ROTAÇÃO ATIVA (12s)" : "ROTAÇÃO PAUSADA"}</span>
                </button>
                <select
                  value={tvPageSize}
                  onChange={(e) => {
                    setTvPageSize(Number(e.target.value));
                    setTvCurrentPage(0);
                  }}
                  aria-label="Linhas por página no Modo TV"
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#111c16] bg-white focus:outline-none cursor-pointer"
                >
                  <option value={8}>8 processos / tela</option>
                  <option value={10}>10 processos / tela</option>
                  <option value={15}>15 processos / tela</option>
                  <option value={30}>Todos (30 processos)</option>
                </select>
                {totalTvPages > 1 && (
                  <div className="px-2.5 py-1.5 text-xs font-bold text-[#004a2f] border-l border-[#d0dbd5] tabular-nums bg-white">
                    PÁG. {(tvCurrentPage % totalTvPages) + 1}/{totalTvPages}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={fetchLatestData}
              disabled={isRefreshing}
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide border border-[#9eb2a8] bg-white text-[#111c16] hover:bg-[#f2f5f3] active:bg-[#e3ebe6] flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2f7958] ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Sincronizando" : "Atualizar Agora"}</span>
            </button>

            <a
              href={data.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide border border-[#9eb2a8] bg-white text-[#111c16] hover:bg-[#f2f5f3] flex items-center gap-1.5"
            >
              <span>Planilha Fonte</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#3f5248]" />
            </a>

            <button
              type="button"
              onClick={toggleTvMode}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border cursor-pointer ${
                tvMode
                  ? "bg-[#db0a13] border-[#db0a13] text-white hover:bg-[#b80810]"
                  : "bg-[#004a2f] border-[#004a2f] text-white hover:bg-[#2f7958] hover:border-[#2f7958]"
              }`}
            >
              {tvMode ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Sair do Modo TV</span>
                </>
              ) : (
                <>
                  <Tv className="w-3.5 h-3.5" />
                  <span>Modo TV</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 max-w-[2400px] w-full mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* KPI STRIP - SHARP RECTANGULAR INSTITUTIONAL METRICS */}
        <section aria-label="Indicadores Gerais" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 bg-white border border-[#d0dbd5]">
          {/* KPI 1: Total */}
          <button
            type="button"
            onClick={clearAllFilters}
            className={`text-left p-3 sm:p-4 border-b xl:border-b-0 border-r border-[#d0dbd5] border-t-4 transition-colors cursor-pointer ${
              !hasActiveFilters
                ? "border-t-[#004a2f] bg-[#f7faf8]"
                : "border-t-transparent hover:bg-[#f7faf8]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#3f5248]">
              TOTAL DE PROCESSOS
            </div>
            <div className="mt-1 flex items-baseline justify-between tabular-nums">
              <span className={`font-bold text-[#111c16] ${tvMode ? "text-3xl 2xl:text-4xl" : "text-2xl sm:text-3xl"}`}>
                {data.totalProcessos}
              </span>
              <span className="text-xs font-semibold text-[#2f7958]">
                Média {data.resumo.progressoMedioGeral}%
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-[#64786d] tabular-nums">
              100% da carteira ativa
            </div>
          </button>

          {/* KPI 2: Fase Interna */}
          <button
            type="button"
            onClick={() => {
              clearAllFilters();
              setSelectedFase(selectedFase === "FASE_INTERNA" ? "TODAS" : "FASE_INTERNA");
            }}
            className={`text-left p-3 sm:p-4 border-b xl:border-b-0 border-r border-[#d0dbd5] border-t-4 transition-colors cursor-pointer ${
              selectedFase === "FASE_INTERNA"
                ? "border-t-[#658b61] bg-[#f4f8f4]"
                : "border-t-transparent hover:bg-[#f7faf8]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#3f5248]">
              EM FASE INTERNA
            </div>
            <div className="mt-1 flex items-baseline justify-between tabular-nums">
              <span className={`font-bold text-[#111c16] ${tvMode ? "text-3xl 2xl:text-4xl" : "text-2xl sm:text-3xl"}`}>
                {data.resumo.faseInterna}
              </span>
              <span className="text-xs font-semibold text-[#64786d]">
                {Math.round((data.resumo.faseInterna / Math.max(1, data.totalProcessos)) * 100)}%
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-[#64786d]">
              Instrução (DFD a Presidente)
            </div>
          </button>

          {/* KPI 3: Fase Externa */}
          <button
            type="button"
            onClick={() => {
              clearAllFilters();
              setSelectedFase(selectedFase === "FASE_EXTERNA" ? "TODAS" : "FASE_EXTERNA");
            }}
            className={`text-left p-3 sm:p-4 border-b md:border-b-0 xl:border-b-0 border-r border-[#d0dbd5] border-t-4 transition-colors cursor-pointer ${
              selectedFase === "FASE_EXTERNA"
                ? "border-t-[#2f7958] bg-[#f2f8f5]"
                : "border-t-transparent hover:bg-[#f7faf8]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#3f5248]">
              EM FASE EXTERNA
            </div>
            <div className="mt-1 flex items-baseline justify-between tabular-nums">
              <span className={`font-bold text-[#004a2f] ${tvMode ? "text-3xl 2xl:text-4xl" : "text-2xl sm:text-3xl"}`}>
                {data.resumo.faseExterna}
              </span>
              <span className="text-xs font-semibold text-[#2f7958]">
                {Math.round((data.resumo.faseExterna / Math.max(1, data.totalProcessos)) * 100)}%
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-[#64786d]">
              Cotação, licitação e execução
            </div>
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
            className={`text-left p-3 sm:p-4 border-b md:border-b-0 border-r border-[#d0dbd5] border-t-4 transition-colors cursor-pointer ${
              selectedEstagio === "EMPENHO_E_EXECUCAO"
                ? "border-t-[#004a2f] bg-[#f2f8f5]"
                : "border-t-transparent hover:bg-[#f7faf8]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#3f5248]">
              EM EMPENHO / COMPRA
            </div>
            <div className="mt-1 flex items-baseline justify-between tabular-nums">
              <span className={`font-bold text-[#111c16] ${tvMode ? "text-3xl 2xl:text-4xl" : "text-2xl sm:text-3xl"}`}>
                {data.resumo.emEmpenhoExecucao}
              </span>
              <span className="text-xs font-semibold text-[#3f5248]">
                Etapas 16 a 21
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-[#64786d]">
              Empenho, AF/OS, TCN e Publicação
            </div>
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
            className={`text-left p-3 sm:p-4 border-r border-[#d0dbd5] border-t-4 transition-colors cursor-pointer ${
              selectedEstagio === "ENTREGA_E_ENCERRAMENTO"
                ? "border-t-[#2f7958] bg-[#f2f8f5]"
                : "border-t-transparent hover:bg-[#f7faf8]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#3f5248]">
              ENTREGA / PATRIMÔNIO
            </div>
            <div className="mt-1 flex items-baseline justify-between tabular-nums">
              <span className={`font-bold text-[#2f7958] ${tvMode ? "text-3xl 2xl:text-4xl" : "text-2xl sm:text-3xl"}`}>
                {data.resumo.emEntregaEncerramento}
              </span>
              <span className="text-xs font-semibold text-[#2f7958]">
                Etapas 22 a 24
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-[#64786d]">
              Almoxarifado, patrimônio e arquivo
            </div>
          </button>

          {/* KPI 6: Com Pendência (Refazer) */}
          <button
            type="button"
            onClick={() => {
              clearAllFilters();
              setOnlyPendencias(!onlyPendencias);
            }}
            className={`text-left p-3 sm:p-4 border-t-4 transition-colors cursor-pointer ${
              onlyPendencias
                ? "border-t-[#db0a13] bg-[#fff5f5]"
                : data.resumo.comPendencia > 0
                ? "border-t-[#db0a13] bg-[#fffafa] hover:bg-[#fff0f0]"
                : "border-t-transparent hover:bg-[#f7faf8]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#db0a13] flex items-center justify-between">
              <span>AÇÃO REQUERIDA (REFAZER)</span>
              {data.resumo.comPendencia > 0 && <AlertTriangle className="w-3.5 h-3.5 text-[#db0a13]" />}
            </div>
            <div className="mt-1 flex items-baseline justify-between tabular-nums">
              <span className={`font-bold text-[#db0a13] ${tvMode ? "text-3xl 2xl:text-4xl" : "text-2xl sm:text-3xl"}`}>
                {data.resumo.comPendencia}
              </span>
              <span className="text-xs font-bold text-[#db0a13]">
                {data.resumo.comPendencia > 0 ? "Revisão imediata" : "Sem pendências"}
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-[#7f1d1d] truncate">
              {data.resumo.comPendencia > 0
                ? "Proc. 1043/2026 (Conformidade / Pesq.)"
                : "Nenhuma etapa com ressalva"}
            </div>
          </button>
        </section>

        {/* ANALYTICAL PANELS - 3 SOBER INSTITUTIONAL BLOCKS */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* PANEL 1: DISTRIBUIÇÃO POR ESTÁGIO DO FLUXO (5 COLS) */}
          <div className="lg:col-span-5 bg-white border border-[#d0dbd5] flex flex-col">
            <div className="px-4 py-2.5 bg-[#f7faf8] border-b border-[#d0dbd5] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#004a2f]">
                DISTRIBUIÇÃO POR ESTÁGIO OPERACIONAL
              </h2>
              <span className="text-[11px] font-semibold text-[#64786d] tabular-nums">
                24 ETAPAS DO FLUXO
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              {/* Segmented Macro Bar */}
              <div className="w-full h-3 flex bg-[#e6ece9] overflow-hidden">
                {data.porEstagio.map((st, idx) => {
                  const colors = [
                    "bg-[#658b61]",
                    "bg-[#3d8b68]",
                    "bg-[#2f7958]",
                    "bg-[#004a2f]",
                    "bg-[#002b1b]",
                  ];
                  if (st.count === 0) return null;
                  return (
                    <div
                      key={st.id}
                      style={{ width: `${(st.count / Math.max(1, data.totalProcessos)) * 100}%` }}
                      className={`${colors[idx % colors.length]} h-full border-r border-white last:border-r-0`}
                      title={`${st.label}: ${st.count} processos (${st.percent}%)`}
                    />
                  );
                })}
              </div>

              {/* Stage Table */}
              <div className="divide-y divide-[#e6ece9]">
                {data.porEstagio.map((st, idx) => {
                  const isSelected = selectedEstagio === st.id;
                  const indicatorColors = [
                    "bg-[#658b61]",
                    "bg-[#3d8b68]",
                    "bg-[#2f7958]",
                    "bg-[#004a2f]",
                    "bg-[#002b1b]",
                  ];
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        setSelectedEstagio(selectedEstagio === st.id ? "TODOS" : st.id)
                      }
                      className={`w-full py-1.5 px-2 flex items-center justify-between text-left hover:bg-[#f2f5f3] transition-colors cursor-pointer ${
                        isSelected ? "bg-[#e6f0eb] font-semibold" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2.5 h-2.5 shrink-0 ${indicatorColors[idx % indicatorColors.length]}`} />
                        <span className="text-xs text-[#111c16] truncate">{st.label}</span>
                        <span className="text-[10px] uppercase tracking-wider text-[#64786d] border border-[#d0dbd5] px-1">
                          {st.fase}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        <span className="text-xs font-bold text-[#111c16] w-6 text-right">
                          {st.count}
                        </span>
                        <span className="text-[11px] text-[#64786d] w-9 text-right">
                          {st.percent}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PANEL 2: CARGA POR AGENTE DE CONTRATAÇÃO (4 COLS) */}
          <div className="lg:col-span-4 bg-white border border-[#d0dbd5] flex flex-col">
            <div className="px-4 py-2.5 bg-[#f7faf8] border-b border-[#d0dbd5] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#004a2f]">
                PROCESSOS POR AGENTE DE CONTRATAÇÃO
              </h2>
              <span className="text-[11px] font-semibold text-[#64786d]">
                RESPONSABILIDADE
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <table className="w-full text-xs border-collapse tabular-nums">
                <thead>
                  <tr className="border-b border-[#d0dbd5] text-[#64786d] text-[11px] uppercase">
                    <th className="py-1.5 text-left font-semibold">Agente</th>
                    <th className="py-1.5 text-right font-semibold">Total</th>
                    <th className="py-1.5 text-right font-semibold">Int.</th>
                    <th className="py-1.5 text-right font-semibold">Ext.</th>
                    <th className="py-1.5 text-right font-semibold">Avanço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ece9]">
                  {data.porAgente.map((ag) => {
                    const isSelected = selectedAgente === ag.agente;
                    const share = Math.round((ag.total / Math.max(1, data.totalProcessos)) * 100);
                    return (
                      <tr
                        key={ag.agente}
                        onClick={() =>
                          setSelectedAgente(selectedAgente === ag.agente ? "TODOS" : ag.agente)
                        }
                        className={`hover:bg-[#f2f5f3] cursor-pointer transition-colors ${
                          isSelected ? "bg-[#e6f0eb] font-semibold" : ""
                        }`}
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#111c16]">{ag.agente}</span>
                            {ag.comPendencia > 0 && (
                              <span
                                className="text-[10px] font-bold text-white bg-[#db0a13] px-1 uppercase"
                                title="Possui processo com etapa marcada como REFAZER"
                              >
                                {ag.comPendencia} Refazer
                              </span>
                            )}
                          </div>
                          <div className="w-full h-1.5 bg-[#e6ece9] mt-1">
                            <div
                              className="h-full bg-[#004a2f]"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-[#111c16] align-top">
                          {ag.total}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#64786d] align-top">
                          {ag.faseInterna}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#2f7958] font-medium align-top">
                          {ag.faseExterna}
                        </td>
                        <td className="py-2.5 pl-2 text-right font-semibold text-[#004a2f] align-top">
                          {ag.progressoMedio}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-3 pt-2.5 border-t border-[#e6ece9] flex items-center justify-between text-[11px] text-[#64786d]">
                <span>Clique em um agente para filtrar a matriz</span>
                <span className="tabular-nums font-semibold text-[#3f5248]">
                  Total: {data.totalProcessos} processos
                </span>
              </div>
            </div>
          </div>

          {/* PANEL 3: MODALIDADES & ETAPAS AGUARDANDO AÇÃO (3 COLS) */}
          <div className="lg:col-span-3 bg-white border border-[#d0dbd5] flex flex-col">
            <div className="px-4 py-2.5 bg-[#f7faf8] border-b border-[#d0dbd5] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#004a2f]">
                MODALIDADES E RETENÇÕES
              </h2>
              <span className="text-[11px] font-semibold text-[#64786d]">
                FILTRO RÁPIDO
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              {/* Modalidades */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64786d] mb-1.5">
                  POR MODALIDADE / TIPO
                </div>
                <div className="divide-y divide-[#e6ece9] border border-[#e6ece9]">
                  {data.porModalidade.map((m) => {
                    const isSelected = selectedModalidade === m.modalidade;
                    return (
                      <button
                        key={m.modalidade}
                        type="button"
                        onClick={() =>
                          setSelectedModalidade(
                            selectedModalidade === m.modalidade ? "TODAS" : m.modalidade
                          )
                        }
                        className={`w-full px-2.5 py-1.5 flex items-center justify-between text-xs hover:bg-[#f2f5f3] cursor-pointer ${
                          isSelected ? "bg-[#e6f0eb] font-bold text-[#004a2f]" : "text-[#111c16]"
                        }`}
                      >
                        <span className="truncate">{m.modalidade}</span>
                        <span className="font-bold tabular-nums ml-2">{m.total}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Etapas com processos aguardando */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64786d] mb-1.5">
                  PRINCIPAIS ETAPAS AGUARDANDO AÇÃO
                </div>
                <div className="divide-y divide-[#e6ece9] border border-[#e6ece9]">
                  {data.gargalosEtapas.slice(0, 4).map((g) => {
                    const isSelected = selectedEtapaParada === g.label;
                    return (
                      <button
                        key={g.label}
                        type="button"
                        onClick={() =>
                          setSelectedEtapaParada(
                            selectedEtapaParada === g.label ? "TODAS" : g.label
                          )
                        }
                        className={`w-full px-2.5 py-1.5 flex items-center justify-between text-xs hover:bg-[#f2f5f3] cursor-pointer ${
                          isSelected ? "bg-[#e6f0eb] font-bold" : ""
                        }`}
                      >
                        <span className="truncate text-left text-[#111c16]">{g.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                          {g.refazerCount > 0 && (
                            <span className="px-1 bg-[#db0a13] text-white text-[10px] font-bold">
                              {g.refazerCount} REFAZER
                            </span>
                          )}
                          {g.paradosCount > 0 && (
                            <span className="px-1 bg-[#e6ece9] text-[#111c16] text-[10px] font-semibold">
                              {g.paradosCount} aguard.
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FILTER & CONTROL BAR (Hidden in TV mode unless filters are active) */}
        {(!tvMode || hasActiveFilters) && (
          <section
            aria-label="Controles de Pesquisa e Filtro"
            className="bg-white border border-[#d0dbd5] p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3"
          >
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-[#64786d] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setTvCurrentPage(0);
                  }}
                  placeholder="Pesquisar processo (ex: 1058/2026) ou objeto..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#f7faf8] border border-[#9eb2a8] text-[#111c16] placeholder-[#64786d] focus:outline-none focus:border-[#004a2f] focus:bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64786d] hover:text-[#111c16] cursor-pointer"
                    aria-label="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
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
                className="px-2.5 py-1.5 text-xs bg-[#f7faf8] border border-[#9eb2a8] text-[#111c16] font-medium focus:outline-none focus:border-[#004a2f] cursor-pointer"
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
                className="px-2.5 py-1.5 text-xs bg-[#f7faf8] border border-[#9eb2a8] text-[#111c16] font-medium focus:outline-none focus:border-[#004a2f] cursor-pointer"
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
                className="px-2.5 py-1.5 text-xs bg-[#f7faf8] border border-[#9eb2a8] text-[#111c16] font-medium focus:outline-none focus:border-[#004a2f] cursor-pointer"
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
                className="px-2.5 py-1.5 text-xs bg-[#f7faf8] border border-[#9eb2a8] text-[#111c16] font-medium focus:outline-none focus:border-[#004a2f] cursor-pointer"
              >
                <option value="ORDEM">Ordem da Planilha (1–30)</option>
                <option value="PENDENCIA">Priorizar Pendências (Refazer)</option>
                <option value="PROGRESSO_DESC">Maior Progresso (%)</option>
                <option value="PROGRESSO_ASC">Menor Progresso (%)</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-2.5 py-1.5 text-xs font-bold uppercase text-white bg-[#db0a13] hover:bg-[#b80810] flex items-center gap-1 cursor-pointer"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Limpar Filtros ({filteredProcessos.length}/{data.totalProcessos})</span>
                </button>
              )}
            </div>

            {/* View Switcher & Legend */}
            <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3">
              {/* Sober Legend */}
              <div className="flex items-center gap-3 text-[11px] text-[#3f5248]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#2f7958] inline-block" /> Concluído
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-[#b45309] bg-[#fef3c7] inline-block" /> Etapa Atual
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#db0a13] inline-block" /> Refazer
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#e2e8e5] inline-block" /> Pendente
                </span>
              </div>

              <div className="hidden sm:flex border border-[#9eb2a8]">
                <button
                  type="button"
                  onClick={() => setViewMode("MATRIZ")}
                  className={`px-3 py-1 text-xs font-bold uppercase cursor-pointer ${
                    viewMode === "MATRIZ"
                      ? "bg-[#004a2f] text-white"
                      : "bg-white text-[#3f5248] hover:bg-[#f2f5f3]"
                  }`}
                >
                  Matriz 24 Etapas
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("RESUMO")}
                  className={`px-3 py-1 text-xs font-bold uppercase border-l border-[#9eb2a8] cursor-pointer ${
                    viewMode === "RESUMO"
                      ? "bg-[#004a2f] text-white"
                      : "bg-white text-[#3f5248] hover:bg-[#f2f5f3]"
                  }`}
                >
                  Visão Executiva
                </button>
              </div>
            </div>
          </section>
        )}

        {/* MAIN PROCESS TRACKING SECTION */}
        <section aria-label="Andamento dos Processos" className="bg-white border border-[#d0dbd5]">
          <div className="px-4 py-2.5 bg-[#004a2f] text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                RELAÇÃO DE PROCESSOS ADMINISTRATIVOS DE COMPRAS
              </h2>
              <span className="text-xs text-[#a2c682] font-semibold tabular-nums">
                Exibindo {displayedProcessos.length} de {filteredProcessos.length} processos
              </span>
            </div>
            <div className="text-[11px] text-[#d5e3dc] hidden md:block">
              Clique em qualquer processo para inspecionar datas e despachos de todas as 24 etapas
            </div>
          </div>

          {filteredProcessos.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-semibold text-[#3f5248]">
                Nenhum processo corresponde aos critérios de filtro selecionados.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-3 px-4 py-1.5 text-xs font-bold uppercase bg-[#004a2f] text-white hover:bg-[#2f7958] cursor-pointer"
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
                      <tr className="bg-[#e8efec] border-b border-[#9eb2a8] text-[10px] font-bold uppercase tracking-wider text-[#004a2f]">
                        <th colSpan={4} className="py-1.5 px-3 border-r border-[#9eb2a8]">
                          Identificação do Processo
                        </th>
                        <th
                          colSpan={6}
                          className="py-1.5 px-2 text-center bg-[#dfe9e3] border-r border-[#9eb2a8] text-[#004a2f]"
                        >
                          Fase Interna (6 Etapas)
                        </th>
                        <th className="py-1.5 px-2 text-center bg-[#d5e3dc] border-r border-[#9eb2a8] text-[#004a2f]">
                          Proc. Ext.
                        </th>
                        <th
                          colSpan={18}
                          className="py-1.5 px-2 text-center bg-[#d5e3dc] border-r border-[#9eb2a8] text-[#004a2f]"
                        >
                          Fase Externa (18 Etapas)
                        </th>
                        <th colSpan={2} className="py-1.5 px-3 text-center">
                          Situação Atual
                        </th>
                      </tr>

                      {/* Step Column Headers */}
                      <tr className="bg-[#f7faf8] border-b-2 border-[#004a2f] text-[10px] font-bold uppercase text-[#3f5248]">
                        <th className="py-2 px-2 text-center w-9 border-r border-[#d0dbd5]">#</th>
                        <th className="py-2 px-2.5 w-24 border-r border-[#d0dbd5]">Proc. Int.</th>
                        <th className="py-2 px-3 min-w-[240px] max-w-[380px] border-r border-[#d0dbd5]">
                          Objeto / Modalidade
                        </th>
                        <th className="py-2 px-2 w-20 border-r border-[#9eb2a8]">Agente</th>

                        {/* 6 Internal Step Columns */}
                        {INTERNAL_STEPS_META.map((m, i) => (
                          <th
                            key={m.code}
                            title={m.fullLabel}
                            className={`py-2 px-0.5 text-center w-9 bg-[#f4f8f5] ${
                              i === 5 ? "border-r border-[#9eb2a8]" : "border-r border-[#d0dbd5]"
                            }`}
                          >
                            <div className="leading-tight text-[9px] font-bold text-[#004a2f]">
                              {m.code}
                            </div>
                          </th>
                        ))}

                        {/* External Process Number */}
                        <th className="py-2 px-2 w-24 text-center border-r border-[#9eb2a8] bg-[#eef5f0]">
                          Nº Ext.
                        </th>

                        {/* 18 External Step Columns */}
                        {EXTERNAL_STEPS_META.map((m, i) => (
                          <th
                            key={m.code}
                            title={m.fullLabel}
                            className={`py-2 px-0.5 text-center w-9 ${
                              i === 17 ? "border-r border-[#9eb2a8]" : "border-r border-[#d0dbd5]"
                            }`}
                          >
                            <div className="leading-tight text-[9px] font-bold text-[#111c16]">
                              {m.code}
                            </div>
                          </th>
                        ))}

                        <th className="py-2 px-2.5 w-44 border-r border-[#d0dbd5]">
                          Etapa Atual / Ação
                        </th>
                        <th className="py-2 px-2.5 w-20 text-right">Avanço</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#d0dbd5]">
                      {displayedProcessos.map((proc) => {
                        const isExpanded = expandedRow === proc.ordem;
                        return (
                          <React.Fragment key={proc.ordem}>
                            <tr
                              onClick={() =>
                                setExpandedRow(isExpanded ? null : proc.ordem)
                              }
                              className={`cursor-pointer transition-colors ${
                                proc.temPendencia
                                  ? "bg-[#fff8f8] hover:bg-[#ffefef]"
                                  : isExpanded
                                  ? "bg-[#e8f2ec]"
                                  : "hover:bg-[#f2f7f4]"
                              }`}
                            >
                              {/* # Ordem */}
                              <td
                                className={`py-2 px-2 text-center font-bold border-r border-[#d0dbd5] ${
                                  proc.temPendencia
                                    ? "border-l-4 border-l-[#db0a13] text-[#db0a13]"
                                    : proc.macroFase === "FASE_EXTERNA"
                                    ? "border-l-4 border-l-[#004a2f] text-[#111c16]"
                                    : "border-l-4 border-l-[#658b61] text-[#3f5248]"
                                }`}
                              >
                                {proc.ordem}
                              </td>

                              {/* Processo Interno */}
                              <td className="py-2 px-2.5 font-bold text-[#111c16] border-r border-[#d0dbd5] whitespace-nowrap">
                                {proc.processoInterno}
                              </td>

                              {/* Objeto + Modalidade */}
                              <td className="py-2 px-3 border-r border-[#d0dbd5] max-w-[380px]">
                                <div className="flex items-start gap-1.5">
                                  {proc.modalidade !== "Compra Direta / Dispensa" && (
                                    <span className="shrink-0 text-[10px] font-bold uppercase px-1 py-0.2 bg-[#004a2f] text-white">
                                      {proc.modalidade}
                                    </span>
                                  )}
                                  <span
                                    className={`font-medium text-[#111c16] line-clamp-2 leading-snug ${
                                      tvMode ? "text-sm 2xl:text-base" : "text-xs"
                                    }`}
                                    title={proc.objetoRaw}
                                  >
                                    {proc.objeto}
                                  </span>
                                </div>
                              </td>

                              {/* Agente */}
                              <td className="py-2 px-2 text-xs font-semibold text-[#3f5248] border-r border-[#9eb2a8] whitespace-nowrap">
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

                              {/* Processo Externo */}
                              <td className="py-2 px-2 text-center font-bold text-xs border-r border-[#9eb2a8] bg-[#f7faf8] whitespace-nowrap">
                                {proc.processoExterno ? (
                                  <span className="text-[#004a2f]">{proc.processoExterno}</span>
                                ) : (
                                  <span className="text-[#9eb2a8]">—</span>
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
                              <td className="py-2 px-2.5 border-r border-[#d0dbd5] text-xs">
                                {proc.temPendencia ? (
                                  <div className="font-bold text-[#db0a13] flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">
                                      REFAZER: {proc.pendencias.join(", ")}
                                    </span>
                                  </div>
                                ) : proc.proximaEtapa ? (
                                  <div>
                                    <div className="text-[10px] font-bold uppercase text-[#64786d]">
                                      Aguardando:
                                    </div>
                                    <div className="font-semibold text-[#111c16] truncate">
                                      {proc.proximaEtapa.label}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="font-bold text-[#2f7958]">
                                    Fluxo Concluído
                                  </div>
                                )}
                              </td>

                              {/* Progresso */}
                              <td className="py-2 px-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="font-bold text-xs text-[#004a2f]">
                                    {proc.progressoTotal}%
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-[#64786d]" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-[#64786d]" />
                                  )}
                                </div>
                                <div className="w-full h-1.5 bg-[#e2e8e5] mt-1">
                                  <div
                                    className={`h-full ${
                                      proc.temPendencia ? "bg-[#db0a13]" : "bg-[#2f7958]"
                                    }`}
                                    style={{ width: `${proc.progressoTotal}%` }}
                                  />
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Detail Panel */}
                            {isExpanded && (
                              <tr className="bg-[#f7faf8] border-b-2 border-[#004a2f]">
                                <td colSpan={31} className="p-4">
                                  <ExpandedProcessDetails proc={proc} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  /* VISÃO EXECUTIVA RESUMIDA (TABLE) */
                  <table className="w-full border-collapse text-left tabular-nums">
                    <thead>
                      <tr className="bg-[#f7faf8] border-b-2 border-[#004a2f] text-[11px] font-bold uppercase text-[#3f5248]">
                        <th className="py-2.5 px-3 w-12 text-center border-r border-[#d0dbd5]">#</th>
                        <th className="py-2.5 px-3 w-28 border-r border-[#d0dbd5]">Proc. Interno</th>
                        <th className="py-2.5 px-3 w-28 border-r border-[#d0dbd5]">Proc. Externo</th>
                        <th className="py-2.5 px-3 border-r border-[#d0dbd5]">Objeto da Contratação</th>
                        <th className="py-2.5 px-3 w-36 border-r border-[#d0dbd5]">Modalidade</th>
                        <th className="py-2.5 px-3 w-28 border-r border-[#d0dbd5]">Agente</th>
                        <th className="py-2.5 px-3 w-48 border-r border-[#d0dbd5]">Estágio Atual</th>
                        <th className="py-2.5 px-3 w-52 border-r border-[#d0dbd5]">Última Etapa Concluída</th>
                        <th className="py-2.5 px-3 w-52 border-r border-[#d0dbd5]">Próxima Etapa / Ação</th>
                        <th className="py-2.5 px-3 w-44">Andamento (24 Etapas)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d0dbd5]">
                      {displayedProcessos.map((proc) => {
                        const isExpanded = expandedRow === proc.ordem;
                        return (
                          <React.Fragment key={proc.ordem}>
                            <tr
                              onClick={() => setExpandedRow(isExpanded ? null : proc.ordem)}
                              className={`cursor-pointer transition-colors ${
                                proc.temPendencia
                                  ? "bg-[#fff8f8] hover:bg-[#ffefef]"
                                  : isExpanded
                                  ? "bg-[#e8f2ec]"
                                  : "hover:bg-[#f2f7f4]"
                              }`}
                            >
                              <td
                                className={`py-2.5 px-3 text-center font-bold border-r border-[#d0dbd5] ${
                                  proc.temPendencia
                                    ? "border-l-4 border-l-[#db0a13] text-[#db0a13]"
                                    : proc.macroFase === "FASE_EXTERNA"
                                    ? "border-l-4 border-l-[#004a2f]"
                                    : "border-l-4 border-l-[#658b61]"
                                }`}
                              >
                                {proc.ordem}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-[#111c16] border-r border-[#d0dbd5]">
                                {proc.processoInterno}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-[#004a2f] border-r border-[#d0dbd5]">
                                {proc.processoExterno || "—"}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-[#111c16] border-r border-[#d0dbd5]">
                                {proc.objeto}
                              </td>
                              <td className="py-2.5 px-3 text-xs font-semibold text-[#3f5248] border-r border-[#d0dbd5]">
                                {proc.modalidade}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-[#111c16] border-r border-[#d0dbd5]">
                                {proc.agente}
                              </td>
                              <td className="py-2.5 px-3 text-xs font-semibold text-[#004a2f] border-r border-[#d0dbd5]">
                                {proc.estagioLabel}
                              </td>
                              <td className="py-2.5 px-3 text-xs border-r border-[#d0dbd5]">
                                {proc.ultimaEtapaConcluida ? (
                                  <div>
                                    <span className="font-semibold text-[#111c16]">
                                      {proc.ultimaEtapaConcluida.label}
                                    </span>
                                    <span className="ml-1.5 text-[11px] font-bold text-[#2f7958]">
                                      ({proc.ultimaEtapaConcluida.valor})
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[#64786d]">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-xs border-r border-[#d0dbd5]">
                                {proc.temPendencia ? (
                                  <span className="font-bold text-[#db0a13]">
                                    REFAZER: {proc.pendencias.join(", ")}
                                  </span>
                                ) : proc.proximaEtapa ? (
                                  <span className="font-semibold text-[#b45309]">
                                    {proc.proximaEtapa.label}
                                  </span>
                                ) : (
                                  <span className="font-bold text-[#2f7958]">Concluído</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center justify-between text-xs font-bold mb-1">
                                  <span>
                                    {proc.concluidasTotal}/{proc.aplicaveisTotal} etapas
                                  </span>
                                  <span className="text-[#004a2f]">{proc.progressoTotal}%</span>
                                </div>
                                <div className="w-full h-2 bg-[#e2e8e5]">
                                  <div
                                    className={`h-full ${
                                      proc.temPendencia ? "bg-[#db0a13]" : "bg-[#2f7958]"
                                    }`}
                                    style={{ width: `${proc.progressoTotal}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-[#f7faf8] border-b-2 border-[#004a2f]">
                                <td colSpan={10} className="p-4">
                                  <ExpandedProcessDetails proc={proc} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SMALL SCREENS / MOBILE RESPONSIVE VIEW (< md) */}
              <div className="md:hidden divide-y divide-[#d0dbd5]">
                {displayedProcessos.map((proc) => {
                  const isExpanded = expandedRow === proc.ordem;
                  return (
                    <div
                      key={proc.ordem}
                      className={`p-3 ${
                        proc.temPendencia
                          ? "border-l-4 border-l-[#db0a13] bg-[#fff8f8]"
                          : proc.macroFase === "FASE_EXTERNA"
                          ? "border-l-4 border-l-[#004a2f] bg-white"
                          : "border-l-4 border-l-[#658b61] bg-white"
                      }`}
                    >
                      <div
                        onClick={() => setExpandedRow(isExpanded ? null : proc.ordem)}
                        className="cursor-pointer space-y-2"
                      >
                        {/* Top Identification Bar */}
                        <div className="flex items-center justify-between gap-2 tabular-nums">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-1.5 py-0.5 bg-[#004a2f] text-white text-[11px] font-bold">
                              #{proc.ordem}
                            </span>
                            <span className="text-xs font-bold text-[#111c16]">
                              Int: {proc.processoInterno}
                            </span>
                            {proc.processoExterno && (
                              <span className="text-xs font-bold text-[#2f7958]">
                                • Ext: {proc.processoExterno}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-bold text-[#004a2f]">
                              {proc.progressoTotal}%
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-[#3f5248]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#3f5248]" />
                            )}
                          </div>
                        </div>

                        {/* Object & Modality */}
                        <div>
                          {proc.modalidade !== "Compra Direta / Dispensa" && (
                            <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 bg-[#e6f0eb] text-[#004a2f] border border-[#9eb2a8] mr-1.5 mb-1">
                              {proc.modalidade}
                            </span>
                          )}
                          <p className="text-xs font-semibold text-[#111c16] leading-snug">
                            {proc.objeto}
                          </p>
                        </div>

                        {/* Metadata & Current Stage */}
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-[#e6ece9]">
                          <div>
                            <span className="text-[#64786d] uppercase font-bold block text-[9px]">
                              Agente Responsável
                            </span>
                            <span className="font-semibold text-[#111c16]">{proc.agente}</span>
                          </div>
                          <div>
                            <span className="text-[#64786d] uppercase font-bold block text-[9px]">
                              Situação / Próxima Etapa
                            </span>
                            {proc.temPendencia ? (
                              <span className="font-bold text-[#db0a13]">
                                REFAZER: {proc.pendencias.join(", ")}
                              </span>
                            ) : proc.proximaEtapa ? (
                              <span className="font-semibold text-[#b45309]">
                                Aguard.: {proc.proximaEtapa.label}
                              </span>
                            ) : (
                              <span className="font-bold text-[#2f7958]">Concluído</span>
                            )}
                          </div>
                        </div>

                        {/* Mini 24-Step Segmented Strip */}
                        <div className="space-y-1 pt-1">
                          <div className="grid grid-cols-24 gap-[2px] h-2.5">
                            {proc.todasEtapas.map((s) => (
                              <div
                                key={`${proc.ordem}-${s.index}`}
                                title={`${s.fullLabel}: ${s.rawValue || "Pendente"}`}
                                className={`h-full ${
                                  s.status === "REFAZER"
                                    ? "bg-[#db0a13]"
                                    : s.status === "CONCLUIDO"
                                    ? s.phase === "INTERNA"
                                      ? "bg-[#658b61]"
                                      : "bg-[#2f7958]"
                                    : s.status === "NA"
                                    ? "bg-[#cbd5cf]"
                                    : "bg-[#e2e8e5]"
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-[#64786d] tabular-nums">
                            <span>
                              Fase Interna: {proc.concluidasInternas}/{proc.aplicaveisInternas}
                            </span>
                            <span>
                              Fase Externa: {proc.concluidasExternas}/{proc.aplicaveisExternas}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-[#9eb2a8]">
                          <ExpandedProcessDetails proc={proc} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>

      {/* INSTITUTIONAL FOOTER */}
      <footer className="bg-white border-t border-[#d0dbd5] mt-auto">
        <div className="max-w-[2400px] mx-auto px-3 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#3f5248]">
          <div className="flex items-center gap-2">
            <strong className="text-[#004a2f] uppercase">Câmara Municipal de Bauru</strong>
            <span>•</span>
            <span>Praça Dom Pedro II, 1-50 - Centro - Bauru/SP</span>
          </div>
          <div className="tabular-nums text-[11px] text-[#64786d]">
            Painel de Controle de Compras • Sincronização automática a cada 30 segundos
          </div>
        </div>
      </footer>
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
  const borderClass = isLastInGroup ? "border-r border-[#9eb2a8]" : "border-r border-[#e2e8e5]";
  const tooltip = `${step.fullLabel} (${step.phase === "INTERNA" ? "Fase Interna" : "Fase Externa"}): ${
    step.rawValue || "Pendente"
  }`;

  if (step.status === "REFAZER") {
    return (
      <td
        title={tooltip}
        className={`p-0.5 text-center align-middle ${borderClass}`}
      >
        <div className="w-full h-6 bg-[#db0a13] text-white flex items-center justify-center text-[9px] font-bold tracking-tighter">
          REF
        </div>
      </td>
    );
  }

  if (step.status === "CONCLUIDO") {
    const isOk = step.rawValue.toUpperCase() === "OK";
    return (
      <td
        title={tooltip}
        className={`p-0.5 text-center align-middle ${borderClass}`}
      >
        <div
          className={`w-full h-6 ${
            step.phase === "INTERNA" ? "bg-[#2f7958]" : "bg-[#004a2f]"
          } text-white flex items-center justify-center text-[9px] font-semibold tracking-tighter overflow-hidden`}
        >
          {isOk ? <Check className="w-3 h-3 stroke-[2.5]" /> : step.rawValue}
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
        <div className="w-full h-6 bg-[#edf1ef] text-[#64786d] flex items-center justify-center text-[9px] font-semibold">
          N/A
        </div>
      </td>
    );
  }

  // PENDENTE
  return (
    <td
      title={tooltip}
      className={`p-0.5 text-center align-middle ${borderClass}`}
    >
      <div
        className={`w-full h-6 flex items-center justify-center text-[9px] ${
          isCurrentNext
            ? "border-2 border-[#b45309] bg-[#fef3c7] text-[#b45309] font-bold"
            : "bg-[#eaefec] text-transparent"
        }`}
      >
        {isCurrentNext ? "ATUAL" : "·"}
      </div>
    </td>
  );
}

/* EXPANDED ROW DETAILS COMPONENT */
function ExpandedProcessDetails({ proc }: { proc: ProcessoItem }) {
  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-3 border-b border-[#d0dbd5]">
        <div>
          <div className="text-[11px] font-bold uppercase text-[#004a2f]">
            DETALHAMENTO DE ETAPAS DO PROCESSO #{proc.ordem}
          </div>
          <div className="text-sm font-bold text-[#111c16] mt-0.5">{proc.objetoRaw}</div>
        </div>
        <div className="flex flex-wrap items-center gap-4 tabular-nums text-xs">
          <div>
            <span className="text-[#64786d]">Processo Fase Interna: </span>
            <strong className="text-[#111c16]">{proc.processoInterno}</strong>
          </div>
          <div>
            <span className="text-[#64786d]">Processo Fase Externa: </span>
            <strong className="text-[#004a2f]">{proc.processoExterno || "Não instaurado"}</strong>
          </div>
          <div>
            <span className="text-[#64786d]">Agente: </span>
            <strong className="text-[#111c16]">{proc.agente}</strong>
          </div>
          <div>
            <span className="text-[#64786d]">Modalidade: </span>
            <strong className="text-[#111c16]">{proc.modalidade}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Fase Interna Detail (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-[#d0dbd5]">
          <div className="px-3 py-2 bg-[#e8efec] border-b border-[#d0dbd5] flex items-center justify-between font-bold text-[#004a2f]">
            <span>FASE INTERNA (6 ETAPAS)</span>
            <span className="tabular-nums">
              {proc.concluidasInternas}/{proc.aplicaveisInternas} ({proc.progressoInterno}%)
            </span>
          </div>
          <div className="divide-y divide-[#e6ece9] tabular-nums">
            {proc.etapasInternas.map((s, i) => (
              <div key={s.code} className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[#111c16] font-medium">
                  {i + 1}. {s.fullLabel}
                </span>
                <StepStatusText step={s} />
              </div>
            ))}
          </div>
        </div>

        {/* Fase Externa Detail (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-[#d0dbd5]">
          <div className="px-3 py-2 bg-[#d5e3dc] border-b border-[#d0dbd5] flex items-center justify-between font-bold text-[#004a2f]">
            <span>
              FASE EXTERNA (18 ETAPAS) {proc.processoExterno ? `• PROC. ${proc.processoExterno}` : ""}
            </span>
            <span className="tabular-nums">
              {proc.concluidasExternas}/{proc.aplicaveisExternas} ({proc.progressoExterno}%)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 gap-px bg-[#e6ece9] tabular-nums">
            {proc.etapasExternas.map((s, i) => (
              <div
                key={s.code}
                className="bg-white px-3 py-1.5 flex items-center justify-between"
              >
                <span className="text-[#111c16] font-medium truncate pr-2">
                  {i + 1}. {s.fullLabel}
                </span>
                <StepStatusText step={s} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepStatusText({ step }: { step: ProcessStep }) {
  if (step.status === "REFAZER") {
    return (
      <span className="px-1.5 py-0.5 bg-[#db0a13] text-white font-bold text-[10px] uppercase shrink-0">
        {step.rawValue}
      </span>
    );
  }
  if (step.status === "CONCLUIDO") {
    return (
      <span className="px-1.5 py-0.5 bg-[#e6f2ec] text-[#004a2f] border border-[#9eb2a8] font-bold text-[11px] shrink-0">
        {step.rawValue}
      </span>
    );
  }
  if (step.status === "NA") {
    return (
      <span className="text-[#64786d] font-semibold text-[11px] shrink-0">
        N/A ({step.rawValue})
      </span>
    );
  }
  return <span className="text-[#9eb2a8] text-[11px] shrink-0">Pendente</span>;
}

