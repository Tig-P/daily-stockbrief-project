import fs from "fs";
import path from "path";

type Gainer = {
  name: string;
  code: string;
  reason: string;
};

type GainerData = {
  title: string;
  url: string;
  date: string;
  items: Gainer[];
};

type ThemeData = {
  title: string;
  url: string;
  date: string;
  body: string;
};

// 서버에서 JSON 읽기
async function getData() {
  const today = new Date().toISOString().split("T")[0];
  const gainersPath = path.join(process.cwd(), "public", "data", `infostock_gainers_${today}.json`);
  const themesPath = path.join(process.cwd(), "public", "data", `infostock_themes_${today}.json`);

  let gainers: GainerData[] = [];
  let themes: ThemeData[] = [];

  try {
    const rawGainers = fs.readFileSync(gainersPath, "utf-8");
    gainers = JSON.parse(rawGainers);
  } catch (err) {
    console.warn("[WARN] 오늘자 상한가/급등 JSON 파일 없음");
  }

  try {
    const rawThemes = fs.readFileSync(themesPath, "utf-8");
    themes = JSON.parse(rawThemes);
  } catch (err) {
    console.warn("[WARN] 오늘자 테마 JSON 파일 없음");
  }

  return { gainers, themes };
}

function cleanTitle(title: string) {
  return title.replace(/\s*\(증시요약\(\d+\)\)/, "");
}

export default async function Home() {
  const { gainers, themes } = await getData();

  return (
    <main className="p-6 max-w-3xl mx-auto">
      {gainers.length > 0 ? (
        <section className="mb-10">
          <h1 className="text-xl font-bold mb-4">
            {cleanTitle(gainers[0].title)}
          </h1>
          <ul className="space-y-2">
            {gainers[0].items.map((item, idx) => (
              <li key={idx} className="border p-3 rounded-lg">
                <div className="font-semibold">
                  {item.name} ({item.code})
                </div>
                <p className="text-gray-700 text-sm">{item.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-gray-500">오늘 상한가/급등 종목 데이터가 없습니다.</p>
      )}

      {themes.length > 0 ? (
        <section>
          <h1 className="text-xl font-bold mb-4">
            {cleanTitle(themes[0].title)}
          </h1>
          <p className="whitespace-pre-line text-gray-800">{themes[0].body}</p>
        </section>
      ) : (
        <p className="text-gray-500">오늘 특징 테마 데이터가 없습니다.</p>
      )}
    </main>
  );
}

