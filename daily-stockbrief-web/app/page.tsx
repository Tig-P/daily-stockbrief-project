"use client";

import { useEffect, useState, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

type GainerItem = {
  name: string;
  code: string;
  price: string;
  change?: string;
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

function formatPrice(price?: string) {
  if (!price) return "-";
  const num = parseInt(price.replace(/[^0-9]/g, ""), 10);
  if (isNaN(num)) return price;
  return num.toLocaleString("ko-KR");
}

function getChangeColor(change?: string) {
  if (!change) return "text-gray-700";
  if (change.startsWith("+")) return "text-red-500";
  if (change.startsWith("-")) return "text-blue-500";
  return "text-gray-700";
}

function getArrow(change?: string) {
  if (!change) return "";
  if (change.startsWith("+")) return "▲";
  if (change.startsWith("-")) return "▼";
  return "";
}

export default function Home() {
  const [gainers, setGainers] = useState<GainerData>([]);
  const [themes, setThemes] = useState<ThemeData>([]);
  const [openCharts, setOpenCharts] = useState<string[]>([]);
  const [chartType, setChartType] = useState<"day" | "week" | "month" | "1" | "5" | "10">("day");
  const chartRefs = useRef<{ [key: string]: Chart }>({});
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

  useEffect(() => {
    const saved = localStorage.getItem("openCharts");
    if (saved) setOpenCharts(JSON.parse(saved));
  }, []);

  const getFChartUrl = (code: string) => {
    // 일봉, 주봉, 월봉, 분봉
    if (chartType === "day") return `https://fchart.stock.naver.com/siseJson.naver?symbol=${code}&requestType=0&timeframe=day`;
    if (chartType === "week") return `https://fchart.stock.naver.com/siseJson.naver?symbol=${code}&requestType=0&timeframe=week`;
    if (chartType === "month") return `https://fchart.stock.naver.com/siseJson.naver?symbol=${code}&requestType=0&timeframe=month`;
    // 분봉
    return `https://fchart.stock.naver.com/siseJson.naver?symbol=${code}&requestType=1&timeframe=${chartType}`;
  };

  const toggleChart = async (item: GainerItem) => {
    setOpenCharts((prev) => {
      let updated;
      if (prev.includes(item.code)) {
        chartRefs.current[item.code]?.destroy();
        updated = prev.filter((c) => c !== item.code);
      } else {
        updated = [...prev, item.code];
      }
      localStorage.setItem("openCharts", JSON.stringify(updated));
      return updated;
    });

    if (!openCharts.includes(item.code)) {
      await fetchChartData(item.code);
    }
  };

  const fetchChartData = async (code: string) => {
    try {
      const res = await fetch(getFChartUrl(code));
      const text = await res.text();
      const jsonText = text.replace(/^[^\[]+|\;$/g, "");
      const data = JSON.parse(jsonText);

      const dates: string[] = [];
      const prices: number[] = [];
      for (const item of data[1]) {
        dates.push(item[0]);
        prices.push(Number(item[4]));
      }

      const ctx = document.getElementById(`chart-${code}`) as HTMLCanvasElement;
      if (!ctx) return;

      chartRefs.current[code]?.destroy();
      const chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: dates.reverse(),
          datasets: [
            {
              label: `${code} 종가`,
              data: prices.reverse(),
              borderColor: "rgb(34,197,94)",
              backgroundColor: "rgba(34,197,94,0.2)",
              tension: 0.2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: { mode: "index" } },
          scales: { x: { display: true }, y: { display: true } },
        },
      });
      chartRefs.current[code] = chart;
    } catch (err) {
      console.error("차트 데이터 로드 실패:", err);
    }
  };

  const changeChartType = (type: "day" | "week" | "month" | "1" | "5" | "10", code: string) => {
    setChartType(type);
    fetchChartData(code);
  };

  return (
    <main className="p-6 max-w-6xl mx-auto relative">
      <div className="fixed top-4 right-4 text-xs text-gray-700 bg-white/70 px-2 py-1 rounded shadow z-50">
        contact: enomme@naver.com
      </div>

      <h1 className="text-2xl font-bold mb-6">📈 상한가 및 급등주</h1>

      {gainers.length === 0 ? (
        <p className="text-gray-500">오늘 데이터가 없습니다.</p>
      ) : (
        gainers[0].items.map((item, i) => (
          <div key={i} className="border-b border-gray-200 py-5">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {item.name} ({item.code})
              </h2>
              <span className={`text-sm font-bold ${getChangeColor(item.change)}`}>
                {formatPrice(item.price)}원 {getArrow(item.change)}
                {item.change ?? ""}
              </span>
            </div>

            <p className="text-sm text-gray-700 mt-1">{item.reason}</p>

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
                onClick={() => toggleChart(item)}
                className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-600"
              >
                {openCharts.includes(item.code) ? "차트 닫기" : "차트 보기"}
              </button>
            </div>

            {openCharts.includes(item.code) && (
              <>
                {/* 기간 선택 버튼 */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    { label: "일봉", type: "day" },
                    { label: "주봉", type: "week" },
                    { label: "월봉", type: "month" },
                    { label: "1분", type: "1" },
                    { label: "5분", type: "5" },
                    { label: "10분", type: "10" },
                  ].map((b) => (
                    <button
                      key={b.type}
                      className={`px-2 py-1 rounded text-xs ${
                        chartType === b.type ? "bg-blue-600 text-white" : "bg-gray-200"
                      }`}
                      onClick={() => changeChartType(b.type as any, item.code)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 h-[400px] md:h-80">
                  <canvas id={`chart-${item.code}`} className="w-full h-full" />
                </div>
              </>
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
