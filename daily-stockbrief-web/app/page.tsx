"use client";

import { useEffect, useState } from "react";

type GainerItem = {
  name: string;
  code: string;
  price: string;
  change: string;
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
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [gainers, setGainers] = useState<GainerData>([]);
  const [themes, setThemes] = useState<ThemeData>([]);
  const [openCharts, setOpenCharts] = useState<string[]>([]);

  // 📌 최신 날짜 불러오기
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch("/data/index.json");
        if (res.ok) {
          const data = await res.json();
          if (data.dates?.length > 0) {
            setLatestDate(data.dates[0]); // 최신 날짜
          }
        }
      } catch (e) {
        console.error("index.json 로드 실패", e);
      }
    };
    fetchLatest();
  }, []);

  // 📌 데이터 불러오기
  useEffect(() => {
    if (!latestDate) return;
    const fetchData = async () => {
      try {
        const gRes = await fetch(`/data/${latestDate}/infostock_gainers.json`);
        if (gRes.ok) setGainers(await gRes.json());

        const tRes = await fetch(`/data/${latestDate}/infostock_themes.json`);
        if (tRes.ok) setThemes(await tRes.json());
      } catch (e) {
        console.error("데이터 로드 실패", e);
      }
    };
    fetchData();
  }, [latestDate]);

  const toggleChart = (code: string) => {
    setOpenCharts((prev) => {
      const updated = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      localStorage.setItem("openCharts", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <p className="text-sm text-gray-500 mb-2">⏱ 매일 17:20~18:00 업데이트</p>
      <h1 className="text-3xl font-bold mb-4">
        📅 {latestDate ?? "데이터 없음"} 장 마감 브리핑
      </h1>

      <h2 className="text-2xl font-bold mb-6">📈 상한가 및 급등주</h2>
      {gainers.length === 0 ? (
        <p className="text-gray-500">데이터가 없습니다.</p>
      ) : (
        gainers[0].items.map((item, i) => (
          <div key={i} className="border-b py-4">
            <div className="flex justify-between">
              <span className="font-semibold">{item.name} ({item.code})</span>
              <span className={`text-sm ${item.change?.startsWith("+") ? "text-red-500" : "text-blue-500"}`}>
                {item.price || "-"} {item.change || ""}
              </span>
            </div>
            <p className="text-gray-700 text-sm">{item.reason}</p>

            <div className="flex gap-2 mt-2">
              <a href={`https://finance.naver.com/item/main.naver?code=${item.code}`} target="_blank" className="bg-green-500 text-white px-2 py-1 rounded">
                네이버 금융
              </a>
              <button onClick={() => toggleChart(item.code)} className="bg-blue-500 text-white px-2 py-1 rounded">
                {openCharts.includes(item.code) ? "차트 닫기" : "차트 보기"}
              </button>
            </div>

            {openCharts.includes(item.code) && (
              <iframe
                src={`https://finance.naver.com/item/fchart.naver?code=${item.code}`}
                className="w-full h-80 mt-2 border rounded"
              />
            )}
          </div>
        ))
      )}

      <h2 className="text-2xl font-bold mt-8 mb-4">📝 특징 테마</h2>
      {themes.length === 0 ? (
        <p className="text-gray-500">데이터가 없습니다.</p>
      ) : (
        <div className="bg-gray-50 p-4 rounded shadow">
          <p className="whitespace-pre-line">{themes[0].body}</p>
        </div>
      )}
    </main>
  );
}
