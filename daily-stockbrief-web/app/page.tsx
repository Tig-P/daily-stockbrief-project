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
  const [gainers, setGainers] = useState<GainerData>([]);
  const [themes, setThemes] = useState<ThemeData>([]);
  const [dateFolder, setDateFolder] = useState<string>("");
  const [expandedChart, setExpandedChart] = useState<Record<string, boolean>>({});

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    // 최근 날짜 폴더 가져오기
  useEffect(() => {
    const fetchLatestDate = async () => {
      try {
        const res = await fetch("/data/index.json");
        if (!res.ok) return;
        const idx = await res.json();
        setDateFolder(idx.latestDate);
      } catch {}
    };
    fetchLatestDate();
  }, []);

  // JSON 로드 + 최대 14일 fallback
  useEffect(() => {
    if (!dateFolder) return;

    const fetchData = async () => {
      let attempts = 14;
      let folder = dateFolder;
      while (attempts > 0) {
        try {
          const gainersRes = await fetch(`/data/${folder}/infostock_gainers.json`);
          const themesRes = await fetch(`/data/${folder}/infostock_themes.json`);

          if (gainersRes.ok || themesRes.ok) {
            if (gainersRes.ok) setGainers(await gainersRes.json());
            if (themesRes.ok) setThemes(await themesRes.json());
            setDateFolder(folder);
            return;
          }
        } catch {}
        const [y, m, d] = folder.split("-").map(Number);
        const prev = new Date(y, m - 1, d - 1);
        folder = prev.toISOString().slice(0, 10);
        attempts--;
      }
    };

    fetchData();
  }, [dateFolder]);

  const toggleChart = (code: string) => {
    setExpandedChart((prev) => ({ ...prev, [code]: !prev[code] }));
  };
  
  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* 업데이트 안내 + Contact */}
      <div className="flex justify-center items-center text-center text-sm text-gray-400 mb-2 space-x-4">
        <span>장마감 후 오후 5시 45분~6시 사이 업데이트됩니다</span>
        <span>Contact: enomme@naver.com</span>
      </div>

      <h1 className="text-3xl font-bold text-center mb-8">
        📅 {dateFolder || "로딩중..."} 장 마감 브리핑
      </h1>

      {/* 상한가/급등주 2열 카드 */}
      <h1 className="text-2xl font-bold mb-6">📈 상한가 및 급등주</h1>
      {gainers.length === 0 || !gainers[0].items.length ? (
        <p className="text-gray-500">데이터가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gainers[0].items.map((item, i) => (
            <div key={`${item.code}-${i}`} className="border p-4 rounded-lg shadow hover:shadow-md transition">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">
                  {item.name} ({item.code})
                </h2>
                <span className="text-sm font-bold text-red-500">
                  {item.price} {item.change}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-2">{item.reason}</p>

              <div className="flex gap-2 mt-3 flex-wrap">
                {/* 새창 열기: 네이버 금융 */}
                <a
                  href={`https://finance.naver.com/item/main.naver?code=${item.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600"
                >
                  네이버 금융
                </a>

                {/* PC 버전에서만 차트보기 버튼 */}
                {!isMobile && (
                  <button
                    onClick={() => toggleChart(item.code)}
                    className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-600"
                  >
                    {expandedChart[item.code] ? "차트 닫기" : "차트 보기"}
                  </button>
                )}
              </div>

              {/* iframe 차트 (PC만) */}
              {!isMobile && expandedChart[item.code] && (
                <div className="mt-3 w-full overflow-auto border rounded-lg shadow" style={{ maxHeight: 500 }}>
                  <iframe
                    src={`https://finance.naver.com/item/fchart.naver?code=${item.code}`}
                    width={1200}
                    height={600}
                    frameBorder="0"
                    scrolling="yes"
                    className="rounded-lg"
                  />
                </div>
              )}

              {/* 모바일 안내 */}
              {isMobile && (
                <p className="text-sm text-gray-500 mt-2">
                  차트보기는 PC에서 가능합니다.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 특징 테마 */}
      <h1 className="text-2xl font-bold mt-10 mb-4">📝 특징 테마</h1>
      {themes.length === 0 || !themes[0].body ? (
        <p className="text-gray-500">데이터가 없습니다.</p>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg shadow">
          <p className="whitespace-pre-line text-sm leading-relaxed">{themes[0].body}</p>
        </div>
      )}
    </main>
  );
}
