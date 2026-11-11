import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Controle Geral de Compras | Câmara Municipal de Bauru",
  description: "Painel de acompanhamento do andamento de processos de compras e contratações da Câmara Municipal de Bauru.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-[#0a110e] text-[#f1f7f4] selection:bg-[#2f7958] selection:text-white">
        {children}
      </body>
    </html>
  );
}
