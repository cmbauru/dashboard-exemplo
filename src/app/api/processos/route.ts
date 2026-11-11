import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { buildDashboardData } from "@/lib/sheet-parser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHEET_ID = "1d-a0SxYFqjvtPkW1J7nZiNh-9FqpPYQKVJl8BfdtkXw";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const SHEET_VIEW_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CamaraBauruDashboard/1.0)",
        Accept: "text/csv,text/plain,*/*",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const csvText = await response.text();
    if (!csvText || !csvText.includes("OBJETO")) {
      throw new Error("Invalid CSV payload");
    }

    const data = buildDashboardData(csvText, "live", SHEET_VIEW_URL);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch {
    try {
      const fallbackPath = path.join(process.cwd(), "src", "data", "fallback-sheet.csv");
      const fallbackCsv = fs.readFileSync(fallbackPath, "utf8");
      const data = buildDashboardData(fallbackCsv, "fallback", SHEET_VIEW_URL);
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    } catch (fallbackErr) {
      return NextResponse.json(
        { error: "Falha ao carregar dados da planilha.", details: String(fallbackErr) },
        { status: 500 }
      );
    }
  }
}

