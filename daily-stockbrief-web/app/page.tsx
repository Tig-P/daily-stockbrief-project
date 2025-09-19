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
        // ✅ 날짜 폴더를 반영한 경로
        const gainersRes = await fetch(`/data/${today}/infostock_gainers.json`);
        if (gainersRes.ok) {
          setGainers(await gainersRes.json());
        } else {
          console.warn("오늘 상한가/급등 데이터 없음");
        }

        const themesRes = await fetch(`/data/${today}/infostock_themes.json`);
        if (themesRes.ok) {
          setThemes(await themesRes.json());
        } else {
          console.warn("오늘 테마 데이터 없음");
        }
      } catch (err) {
        console.error("데이터 로드 실패:", err);
      }
    };
    fetchData();
  }, [today]);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        📅 {today} 장 마감 브리핑
      </h1>

      <h2 className="text-xl font-bold mb-2">📈 상한가 및 급등주</h2>
      {gainers.length === 0 ? (
        <p className="text-gray-500">오늘 데이터가 없습니다.</p>
      ) : (
        gainers[0].items.map((item, i) => (
          <div key={i} className="border-b border-gray-200 py-3">
            <h3 className="text-lg font-semibold">
              {item.name} ({item.code})
            </h3>
            <p className="text-sm text-gray-700">{item.reason}</p>
          </div>
        ))
      )}

      <h2 className="text-xl font-bold mt-8 mb-2">📝 특징 테마</h2>
      {themes.length === 0 ? (
        <p className="text-gray-500">오늘 데이터가 없습니다.</p>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg shadow">
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {themes[0].body}
          </p>
        </div>
      )}
    </main>
  );
}
