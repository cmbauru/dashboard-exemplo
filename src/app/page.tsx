import fs from "fs";
import path from "path";
import { buildDashboardData, DashboardData } from "@/lib/sheet-parser";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHEET_ID = "1d-a0SxYFqjvtPkW1J7nZiNh-9FqpPYQKVJl8BfdtkXw";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const SHEET_VIEW_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;

async function getInitialDashboardData(): Promise<DashboardData> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CamaraBauruDashboard/1.0)",
        Accept: "text/csv,text/plain,*/*",
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const csvText = await res.text();
      if (csvText && csvText.includes("OBJETO")) {
        return buildDashboardData(csvText, "live", SHEET_VIEW_URL);
      }
    }
  } catch {
    // Fallback to local snapshot when offline
  }

  const fallbackPath = path.join(process.cwd(), "src", "data", "fallback-sheet.csv");
  const fallbackCsv = fs.readFileSync(fallbackPath, "utf8");
  return buildDashboardData(fallbackCsv, "fallback", SHEET_VIEW_URL);
}

export default async function HomePage() {
  const initialData = await getInitialDashboardData();
  return <DashboardClient initialData={initialData} />;
}

