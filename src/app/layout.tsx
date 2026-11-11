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
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#f2f5f3] text-[#111c16] selection:bg-[#004a2f] selection:text-white">
        {children}
      </body>
    </html>
  );
}

