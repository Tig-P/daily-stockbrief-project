"use client";

import { useEffect, useState } from "react";

type GainerItem = {
  name: string;
  code: string;
  reason: string;
};

type GainerData = {
  title: string;
  url: string;
  date: string;
  items: GainerItem[];
}[];

type ThemeData = {
  title: string;
  url: string;
  date: string;
  body: string;
}[];

export default function Home() {
  const [gainers, setGainers] = useState<GainerData>([]);
  const [themes, setThemes] = useState<ThemeData>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const gainersRes = await fetch(`/data/${today}/infostock_gainers.json`);
        if (gainersRes.ok) setGainers(await gainersRes.json());

        const themesRes = await fetch(`/data/${today}/infostock_themes.json`);
        if (themesRes.ok) setThemes(await themesRes.json());
      } catch (err) {
        console.error("데이터 로드 실패:", err);
      }
    };
    fetchData();
  }, [today]);

  return (
    <main className="p-6 max-w-4xl mx-auto font-sans">
      {/* 제목 */}
      <h1 className="text-3xl font-bold mb-6 text-center">
        📅 {today} 장 마감 브리핑
      </h1>

      {/* 상한가/급등주 섹션 */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">📈 상한가 및 급등주</h2>
        {gainers.length === 0 ? (
          <p className="text-gray-500">오늘 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {gainers[0].items.map((item, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">
                    {item.name} ({item.code})
                  </h3>
                  <div className="flex gap-2">
                    {/* 네이버 금융 버튼 */}
                    <a
                      href={`https://finance.naver.com/item/main.nhn?code=${item.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition"
                    >
                      네이버 금융
                    </a>
                    {/* 차트 보기 버튼 */}
                    <button
                      onClick={() =>
                        setSelectedCode(selectedCode === item.code ? null : item.code)
                      }
                      className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      {selectedCode === item.code ? "차트 닫기" : "차트 보기"}
                    </button>
                  </div>
                </div>
                <p className="text-gray-700 text-sm">{item.reason}</p>

                {/* TradingView 차트 */}
                {selectedCode === item.code && (
                  <div className="mt-4 w-full h-[400px] border rounded-lg overflow-hidden">
                    <iframe
                      src={`https://s.tradingview.com/widgetembed/?symbol=KRX:${item.code}&interval=15&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=light`}
                      style={{ width: "100%", height: "100%" }}
                      frameBorder="0"
                      allowTransparency
                      scrolling="no"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 특징 테마 섹션 */}
      <section>
        <h2 className="text-2xl font-bold mb-4">📝 특징 테마</h2>
        {themes.length === 0 ? (
          <p className="text-gray-500">오늘 데이터가 없습니다.</p>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg shadow">
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {themes[0].body}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

