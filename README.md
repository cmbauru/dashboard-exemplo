# Painel de Controle de Compras e Processos — Câmara Municipal de Bauru

Sistema em **Next.js (App Router + TypeScript + Tailwind CSS)** para acompanhamento do andamento dos processos administrativos de compras e contratações da **Câmara Municipal de Bauru** (Fase Interna com 6 etapas e Fase Externa com 18 etapas).

## Funcionalidades

- **Sincronização em Background (30s):** Leitura automática da planilha oficial do Google Sheets a cada 30 segundos via rota de API (`/api/processos`), sem recarregamento de página, com fallback local automático em caso de indisponibilidade de rede.
- **Identidade Visual Institucional:** Paleta oficial da Câmara Municipal de Bauru (`#004a2f`, `#2f7958`, `#658b61`, `#a2c682`, `#db0a13`) e logotipo oficial.
- **Responsividade Total (Mobile a TVs 4K):**
  - **Telas Pequenas (Smartphones/Tablets):** Fichas estruturadas por processo com barra segmentada de 24 etapas e expansão de detalhes ao toque.
  - **Desktop:** Matriz completa das 24 etapas (6 da Fase Interna + 18 da Fase Externa) e Visão Executiva Resumida.
  - **Modo TV:** Exibição em tela cheia com tipografia ampliada e rotação automática de páginas configurável (8, 10, 15 ou todos os 30 processos por tela, alternando a cada 12 segundos).
- **Indicadores e Filtros Operacionais:**
  - Total de processos, distribuição entre Fase Interna e Fase Externa, estágios operacionais (Instrução, Cotação, Habilitação/Homologação, Empenho/Compra, Almoxarifado/Patrimônio) e destaque imediato para etapas marcadas como `REFAZER`.
  - Carga de processos e avanço médio por Agente de Contratação (`Natália`, `Thiago`, `Rogles`) e por Modalidade.

## Execução Local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Implantação na Vercel

O projeto está configurado para deploy direto na **Vercel**:
1. Importe o repositório na Vercel (Framework Preset: **Next.js**).
2. Nenhuma variável de ambiente obrigatória é necessária (a planilha é lida diretamente via exportação CSV sem cache em `/api/processos`).

