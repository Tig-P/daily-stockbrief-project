import localFont from "next/font/local";
import "./globals.css";
import AuthButton from "@/components/auth/AuthButton";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        className="bg-gray-50 text-gray-900 font-sans antialiased min-h-screen"
        suppressHydrationWarning
      >
        <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex-shrink-0 flex items-center">
                <a href="/" className="text-xl font-bold text-gray-900 tracking-tight">
                  <span className="text-blue-600">Daily</span>StockBrief
                </a>
              </div>
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                {/* Navigation Links can go here in future */}
              </div>
              <div className="flex items-center">
                 <AuthButton />
              </div>
            </div>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
