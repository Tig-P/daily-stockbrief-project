// app/pages/index.tsx 또는 pages/index.tsx
import fs from "fs";
import path from "path";

interface GainerItem {
  name: string;
  code: string;
  price: string;
  change: string;
  reason: string;
}

interface ThemeItem {
  title: string;
  body: string;
}

interface DataProps {
  gainers: GainerItem[];
  themes: ThemeItem[];
  date: string | null;
}

const WEB_DATA_PATH = path.join(process.cwd(), "public", "data");

export const getServerSideProps = async () => {
  const indexPath = path.join(WEB_DATA_PATH, "index.json");
  let latestDate = "";

  try {
    const indexRaw = fs.readFileSync(indexPath, "utf-8");
    latestDate = JSON.parse(indexRaw).latestDate;
  } catch {
    console.warn("[WARN] index.json 읽기 실패");
    return { props: { gainers: [], themes: [], date: null } };
  }

  let dateToCheck = latestDate;
  let gainers: GainerItem[] = [];
  let themes: ThemeItem[] = [];

  const findExistingJson = (): boolean => {
    let attempts = 14; // 최대 14일 전까지 탐색
    while (attempts > 0) {
      const todayDir = path.join(WEB_DATA_PATH, dateToCheck);
      const gPath = path.join(todayDir, "infostock_gainers.json");
      const tPath = path.join(todayDir, "infostock_themes.json");

      if (fs.existsSync(gPath) || fs.existsSync(tPath)) {
        if (fs.existsSync(gPath)) {
          gainers = JSON.parse(fs.readFileSync(gPath, "utf-8"));
        }
        if (fs.existsSync(tPath)) {
          themes = JSON.parse(fs.readFileSync(tPath, "utf-8"));
        }
        return true;
      }

      // 하루 전으로 이동
      const [y, m, d] = dateToCheck.split("-").map(Number);
      const prevDate = new Date(y, m - 1, d - 1);
      dateToCheck = prevDate.toISOString().slice(0, 10);
      attempts--;
    }
    return false;
  };

  const found = findExistingJson();
  if (!found) {
    console.warn("[INFO] 유효한 JSON을 찾지 못함");
    return { props: { gainers: [], themes: [], date: null } };
  }

  return { props: { gainers, themes, date: dateToCheck } };
};

export default function Home({ gainers, themes, date }: DataProps) {
  if (!date) return <div>데이터가 없습니다.</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h1>증시 요약 ({date})</h1>

      {gainers && gainers.length > 0 && (
        <section>
          <h2>상한가 / 급등 종목</h2>
          <table border={1} cellPadding={5} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>종목명</th>
                <th>코드</th>
                <th>가격</th>
                <th>등락</th>
                <th>사유</th>
              </tr>
            </thead>
            <tbody>
              {gainers.map((item) => (
                <tr key={item.code}>
                  <td>{item.name}</td>
                  <td>{item.code}</td>
                  <td>{item.price}</td>
                  <td>{item.change}</td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {themes && themes.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>특징 테마</h2>
          {themes.map((theme, idx) => (
            <div key={idx} style={{ marginBottom: "1rem" }}>
              <h3>{theme.title}</h3>
              <pre style={{ whiteSpace: "pre-wrap" }}>{theme.body}</pre>
            </div>
          ))}
        </section>
      )}

      {(!gainers || gainers.length === 0) &&
        (!themes || themes.length === 0) && <p>데이터가 없습니다.</p>}
    </div>
  );
}
