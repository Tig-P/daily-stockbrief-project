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
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

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
    <main className="p-6 max-w-5xl mx-auto">
      {/* 제목 */}
      <h1 className="text-2xl font-bold mb-6 text-center">
        📅 {today} 장 마감 브리핑
      </h1>

      {/* 상한가/급등주 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">📈 상한가 및 급등주</h2>
        {gainers.length === 0 ? (
          <p className="text-gray-500">오늘 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-10">
            {gainers[0].items.map((item, i) => (
              <div key={i} className="p-4 border rounded-lg shadow-sm bg-white">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold">
                    {item.name} ({item.code})
                  </h3>
                  <a
                    href={`https://finance.naver.com/item/main.naver?code=${item.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                  >
                    네이버금융 열기
                  </a>
                </div>

                <p className="text-sm text-gray-700 mb-4">{item.reason}</p>

                {/* 네이버 증권 차트 iframe */}
                <div className="w-full h-[700px]">
                  <iframe
                    src={`https://finance.naver.com/item/main.naver?code=${item.code}`}
                    className="w-full h-full border rounded-lg"
                    title={`${item.name} 차트`}
                  />
                </div>
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


