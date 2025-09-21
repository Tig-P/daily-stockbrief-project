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

// 🔥 최근 14일 날짜 배열 생성
function getRecentDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split("T")[0]); // YYYY-MM-DD
  }
  return dates;
}

export default function Home() {
  const [gainers, setGainers] = useState<GainerData>([]);
  const [themes, setThemes] = useState<ThemeData>([]);
  const [openCharts, setOpenCharts] = useState<string[]>([]);
  const [lastDate, setLastDate] = useState<string>("");

  // 🔥 최근 14일 내 가장 최근 JSON 찾기
  useEffect(() => {
    const fetchData = async () => {
      const dates = getRecentDates();
      for (const date of dates) {
        try {
          const gainersRes = await fetch(`/data/${date}/infostock_gainers.json`);
          if (gainersRes.ok) {
            const g = await gainersRes.json();
            setGainers(g);
            setLastDate(date);
            // themes도 같은 날짜로 로드
            const themesRes = await fetch(`/data/${date}/infostock_themes.json`);
            if (themesRes.ok) setThemes(await themesRes.json());
            break; // 가장 최근 날짜만 사용
          }
        } catch (err) {
          console.warn(`데이터 로드 실패: ${date}`, err);
        }
      }
    };
    fetchData();
  }, []);

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
    <main className="p-6 max-w-6xl mx-auto">
      {/* 안내문 + 날짜 표시 */}
      <p className="text-sm text-gray-500 text-center mb-2">
        🔄 장 마감 후 오후 5시~6시 사이에 자동 업데이트됩니다.
      </p>
      {lastDate && (
        <h1 className="text-2xl font-bold text-center mb-6">
          📅 {lastDate} 장 마감 브리핑
        </h1>
      )}

      <h2 className="text-xl font-bold mb-6">📈 상한가 및 급등주</h2>

      {gainers.length === 0 ? (
        <p className="text-gray-500">최근 14일 데이터가 없습니다.</p>
      ) : (
        gainers[0].items.map((item, i) => (
          <div key={i} className="border-b border-gray-200 py-5">
            {/* 종목명 & 가격 */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {item.name} ({item.code})
              </h3>
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

      <h2 className="text-xl font-bold mt-10 mb-4">📝 특징 테마</h2>
      {themes.length === 0 ? (
        <p className="text-gray-500">최근 14일 데이터가 없습니다.</p>
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
