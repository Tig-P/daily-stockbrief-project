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

  // 🔥 최근 날짜 폴더를 먼저 가져옴
  useEffect(() => {
    const fetchLatestDate = async () => {
      try {
        const res = await fetch("/data/index.json");
        if (!res.ok) {
          console.warn("[WARN] index.json 로드 실패");
          return;
        }
        const dates: string[] = await res.json();
        if (dates.length > 0) {
          setDateFolder(dates[dates.length - 1]); // 가장 최근 날짜 선택
        }
      } catch (err) {
        console.error("날짜 인덱스 로드 실패:", err);
      }
    };
    fetchLatestDate();
  }, []);

  // 🔥 최근 날짜 폴더에서 JSON 로드
  useEffect(() => {
    if (!dateFolder) return;
    const fetchData = async () => {
      try {
        const gainersRes = await fetch(`/data/${dateFolder}/infostock_gainers.json`);
        if (gainersRes.ok) setGainers(await gainersRes.json());

        const themesRes = await fetch(`/data/${dateFolder}/infostock_themes.json`);
        if (themesRes.ok) setThemes(await themesRes.json());
      } catch (err) {
        console.error("데이터 로드 실패:", err);
      }
    };
    fetchData();
  }, [dateFolder]);

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h2 className="text-center text-sm text-gray-400 mb-2">
        장마감 후 오후 5~6시 사이 업데이트됩니다
      </h2>
      <h1 className="text-3xl font-bold text-center mb-8">
        📅 {dateFolder || "로딩중..."} 장 마감 브리핑
      </h1>

      {/* 상한가/급등주 */}
      <h1 className="text-2xl font-bold mb-6">📈 상한가 및 급등주</h1>
      {gainers.length === 0 ? (
        <p className="text-gray-500">데이터가 없습니다.</p>
      ) : (
        gainers[0].items.map((item, i) => (
          <div key={i} className="border-b border-gray-200 py-5">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {item.name} ({item.code})
              </h2>
              <span className="text-sm font-bold text-red-500">
                {item.price} {item.change}
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
              <a
                href={`https://finance.naver.com/item/fchart.naver?code=${item.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-600"
              >
                차트 보기
              </a>
            </div>
          </div>
        ))
      )}

      {/* 특징 테마 */}
      <h1 className="text-2xl font-bold mt-10 mb-4">📝 특징 테마</h1>
      {themes.length === 0 ? (
        <p className="text-gray-500">데이터가 없습니다.</p>
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
