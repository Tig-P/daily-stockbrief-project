import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-white text-gray-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
