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
  if (isNaN(num)) return price;
  return num.toLocaleString("ko-KR");
}

function getChangeColor(change: string) {
  if (change.startsWith("+")) return "text-red-500";
  if (change.startsWith("-")) return "text-blue-500";
  return "text-gray-700";
}

function getArrow(change: string) {
  if (change.startsWith("+")) return "▲";
  if (change.startsWith("-")) return "▼";
  return "";
}

export default function Home() {
  const [gainers, setGainers] = useState<GainerData>([]);
  const [themes, setThemes] = useState<ThemeData>([]);
  const [openCharts, setOpenCharts] = useState<string[]>([]);
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

  // 🔥 localStorage에서 차트 열림 상태 복구
  useEffect(() => {
    const saved = localStorage.getItem("openCharts");
    if (saved) {
      setOpenCharts(JSON.parse(saved));
    }
  }, []);

  // 🔥 차트 열기/닫기 toggle + 저장
  const toggleChart = (code: string) => {
    setOpenCharts((prev) => {
      let updated;
      if (prev.includes(code)) {
        updated = prev.filter((c) => c !== code);
      } else {
        updated = [...prev, code];
      }
      localStorage.setItem("openCharts", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <main className="p-6 max-w-6xl mx-auto relative">
      {/* 🔹 항상 우측 상단 고정 contact */}
      <div className="fixed top-4 right-4 text-xs text-gray-500 bg-white/70 px-2 py-1 rounded shadow z-50">
        contact: enomme@naver.com
      </div>

      <h1 className="text-2xl font-bold mb-6">📈 상한가 및 급등주</h1>

      {gainers.length === 0 ? (
        <p className="text-gray-500">오늘 데이터가 없습니다.</p>
      ) : (
        gainers[0].items.map((item, i) => (
          <div key={i} className="border-b border-gray-200 py-5">
            {/* 종목명 & 가격 */}
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {item.name} ({item.code})
              </h2>
              <span className={`text-sm font-bold ${getChangeColor(item.change)}`}>
                {formatPrice(item.price)}원 {getArrow(item.change)}
                {item.change}
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

            {/* 차트 표시 */}
            {openCharts.includes(item.code) && (
              <div className="mt-3">
                <iframe
                  src={`https://finance.naver.com/item/fchart.naver?code=${item.code}`}
                  title={`${item.name} 차트`}
                  className="w-full h-80 border rounded-md"
                />
              </div>
            )}
          </div>
        ))
      )}

      <h1 className="text-2xl font-bold mt-10 mb-4">📝 특징 테마</h1>
      {themes.length === 0 ? (
        <p className="text-gray-500">오늘 데이터가 없습니다.</p>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg shadow">
          <p className="whitespace-pre-line text-sm leading-relaxed">{themes[0].body}</p>
        </div>
      )}
    </main>
  );
}
