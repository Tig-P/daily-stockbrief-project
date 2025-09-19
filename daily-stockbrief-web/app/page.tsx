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
  const [themes, setThemes] = useState<ThemeData[]>([]);
  const [visibleCharts, setVisibleCharts] = useState<Record<string, boolean>>(
    {}
  );

  const today = new Date().toISOString().split("T")[0];

  // ✅ localStorage에서 차트 상태 불러오기
  useEffect(() => {
    const savedCharts = localStorage.getItem("visibleCharts");
    if (savedCharts) {
      setVisibleCharts(JSON.parse(savedCharts));
    }
  }, []);

  // ✅ 차트 상태가 바뀔 때마다 저장
  useEffect(() => {
    localStorage.setItem("visibleCharts", JSON.stringify(visibleCharts));
  }, [visibleCharts]);

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

  const toggleChart = (code: string) => {
    setVisibleCharts((prev) => {
      const updated = { ...prev, [code]: !prev[code] };
      return updated;
    });
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">
        📅 {today} 장 마감 브리핑
      </h1>

      {/* 상한가/급등주 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">📈 상한가 및 급등주</h2>
        {gainers.length === 0 ? (
          <p className="text-gray-500">오늘 데이터가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gainers[0].items.map((item, i) => (
              <div key={i} className="p-4 border rounded-lg shadow-sm bg-white">
                <h3 className="text-lg font-bold mb-1">
                  {item.name} ({item.code})
                </h3>
                <p className="text-sm text-gray-700 mb-3">{item.reason}</p>

                <div className="flex gap-2">
                  <a
                    href={`https://finance.naver.com/item/main.naver?code=${item.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                  >
                    네이버금융
                  </a>
                  <button
                    onClick={() => toggleChart(item.code)}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                  >
                    {visibleCharts[item.code] ? "차트 닫기" : "차트 보기"}
                  </button>
                </div>

                {/* 클릭 시에만 iframe 로드 */}
                {visibleCharts[item.code] && (
                  <div className="mt-3 w-full h-[400px]">
                    <iframe
                      src={`https://finance.naver.com/item/fchart.naver?code=${item.code}`}
                      className="w-full h-full border rounded-lg"
                      title={`${item.name} 차트`}
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 특징 테마 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">📝 특징 테마</h2>
        {themes.length === 0 ? (
          <p className="text-gray-500">오늘 데이터가 없습니다.</p>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg shadow whitespace-pre-line">
            {themes[0].body}
          </div>
        )}
      </section>
    </main>
  );
}

