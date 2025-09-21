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

function formatPrice(price: string) {
  const num = parseInt(price.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? price : num.toLocaleString("ko-KR");
}

function getChangeColor(change: string) {
  if (change.startsWith("+")) return "text-red-500";
  if (change.startsWith("-")) return "text-blue-500";
  return "text-gray-700";
}

export default function Home() {
  const [gainers, setGainers] = useState<GainerData>([]);
  const [themes, setThemes] = useState<ThemeData>([]);
  const [displayDate, setDisplayDate] = useState<string>("");
  const [openCharts, setOpenCharts] = useState<string[]>([]);

  useEffect(() => {
    const fetchLatestData = async () => {
      let current = new Date();
      for (let i = 0; i < 14; i++) { // 최근 2주 데이터만 검색
        const dateStr = current.toISOString().split("T")[0];
        const gRes = await fetch(`/data/${dateStr}/infostock_gainers.json`);
        if (gRes.ok) {
          setGainers(await gRes.json());
          setDisplayDate(dateStr);

          const tRes = await fetch(`/data/${dateStr}/infostock_themes.json`);
          if (tRes.ok) setThemes(await tRes.json());
          break;
        }
        current.setDate(current.getDate() - 1);
      }
    };
    fetchLatestData();

    const saved = localStorage.getItem("openCharts");
    if (saved) setOpenCharts(JSON.parse(saved));
  }, []);

  const toggleChart = (code: string) => {
    setOpenCharts((prev) => {
      const updated = prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code];
      localStorage.setItem("openCharts", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* 안내문 */}
      <p className="text-sm text-gray-500 mb-1">
        ⏰ 매일 오후 5~6시 업데이트 (주말/휴일엔 마지막 데이터 유지)
      </p>
      <h1 className="text-3xl font-bold mb-6">
        📅 {displayDate || "데이터 없음"} 장 마감 브리핑
      </h1>

      {/* 상한가 및 급등주 */}
      <h2 className="text-2xl font-bold mb-4">📈 상한가 및 급등주</h2>
      {gainers.length === 0 ? (
        <p className="text-gray-500">최근 데이터가 없습니다.</p>
      ) : (
        gainers[0].items.map((item, i) => (
          <div key={i} className="border-b border-gray-200 py-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">
                {item.name} ({item.code})
              </span>
              <span className={`font-bold ${getChangeColor(item.change)}`}>
                {formatPrice(item.price)}원 ({item.change})
              </span>
            </div>

            <p className="text-sm text-gray-700 mt-1">{item.reason}</p>

            {/* 버튼 영역 */}
            <div className="flex gap-2 mt-3">
              <a
                href={`https://finance.naver.com/item/main.naver?code=${item.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600"
              >
                네이버 금융
              </a>
              <button
                onClick={() => toggleChart(item.code)}
                className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-600"
              >
                {openCharts.includes(item.code) ? "차트 닫기" : "차트 보기"}
              </button>
            </div>

            {/* 차트 표시 (PC만) */}
            {openCharts.includes(item.code) && (
              <div className="mt-3 hidden md:block">
                <iframe
                  src={`https://finance.naver.com/item/fchart.naver?code=${item.code}`}
                  title={`${item.name} 차트`}
                  className="w-full h-80 border rounded-md"
                />
              </div>
            )}
            {openCharts.includes(item.code) && (
              <p className="text-xs text-gray-500 mt-2 md:hidden">
                📱 모바일에서는 차트를 보려면 PC로 접속하세요.
              </p>
            )}
          </div>
        ))
      )}

      {/* 특징 테마 */}
      <h2 className="text-2xl font-bold mt-10 mb-4">📝 특징 테마</h2>
      {themes.length === 0 ? (
        <p className="text-gray-500">최근 데이터가 없습니다.</p>
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
