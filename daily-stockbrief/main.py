import asyncio
import json
import os
import re
from datetime import datetime
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

BASE_URL = "https://stock.mk.co.kr/news/media/infostock"
WEB_DATA_PATH = "../daily-stockbrief-web/public/data"  # Next.js public/data 경로

# ---------- 유틸 ----------
def today_markers() -> list[str]:
    now = datetime.now()
    y = now.year
    m = f"{now.month:02d}"
    d = f"{now.day:02d}"
    return [f"{y}-{m}-{d}", f"{y}.{m}.{d}", f"{y}/{m}/{d}"]

def clean_title(title: str) -> str:
    return re.sub(r"\s*\(증시요약\(\d+\)\)", "", title).strip()

def to_abs(url: str) -> str:
    if not url:
        return ""
    return url if url.startswith("http") else f"https://stock.mk.co.kr{url}"

# ---------- 공통: 기사 찾기 ----------
async def find_today_article(context, start_page, required_subs: list[str], max_pages: int = 5):
    """오늘 날짜의 증시요약 기사를 찾는다 (날짜 숫자만 보고 느슨 매칭, 과거 기사만 reject)."""
    marks = today_markers()
    today_dash = datetime.now().strftime("%Y-%m-%d")
    page = start_page

    for page_no in range(1, max_pages + 1):
        print(f"[DEBUG] 🔎 {page_no}페이지 검색 시작")
        anchors = await page.locator("a").all()
        candidates = []
        for a in anchors:
            try:
                t = (await a.inner_text()).strip()
                if all(s in t for s in required_subs):
                    href = await a.get_attribute("href")
                    if href:
                        candidates.append((t, to_abs(href)))
            except Exception:
                continue

        print(f"[DEBUG] 후보 기사 {len(candidates)}개 발견")

        for raw_title, url in candidates:
            print(f"[DEBUG] 검사중: {raw_title} ({url})")
            news = await context.new_page()
            try:
                await news.goto(url, wait_until="domcontentloaded", timeout=45000)
                date_loc = news.locator(".news_date, .date, span.date, .info_date")
                date_txt = ""
                try:
                    date_txt = (await date_loc.first.inner_text(timeout=5000)).strip()
                except Exception:
                    pass

                print(f"[DEBUG] 날짜텍스트: {date_txt}")

                # 날짜 숫자만 뽑아서 비교
                date_digits = re.findall(r"\d+", date_txt)
                date_only = ""
                if len(date_digits) >= 3:
                    date_only = f"{date_digits[0]}-{date_digits[1].zfill(2)}-{date_digits[2].zfill(2)}"

                # 숫자 없으면 무조건 accept
                if not date_digits:
                    print("[DEBUG] 날짜 숫자 없음 → 기사 채택")
                    await news.close()
                    return clean_title(raw_title), url

                # 오늘 날짜면 확정 accept
                if date_only == today_dash or any(mark in date_txt for mark in marks):
                    print(f"[INFO] ✅ 오늘 기사 확정 → {raw_title}")
                    await news.close()
                    return clean_title(raw_title), url

                # 과거 기사면 reject
                try:
                    article_date = datetime.strptime(date_only, "%Y-%m-%d")
                    today = datetime.strptime(today_dash, "%Y-%m-%d")
                    if article_date < today:
                        print(f"[WARN] 과거 기사 → reject: {date_only}")
                        await news.close()
                        continue
                except Exception:
                    print(f"[DEBUG] 날짜 파싱 실패 → 기사 채택")
                    await news.close()
                    return clean_title(raw_title), url

                # 날짜 다르지만 미래거나 파싱 성공 → 그냥 accept
                print(f"[WARN] 날짜 불일치 ({date_only}), 그래도 기사 채택")
                await news.close()
                return clean_title(raw_title), url

            except PlaywrightTimeoutError:
                print(f"[WARN] 페이지 로딩 타임아웃: {url}")
            finally:
                await news.close()

        # 다음 페이지 이동
        next_btn = page.locator("a.next, a.paging_next, a:has-text('다음')")
        if page_no == max_pages or await next_btn.count() == 0:
            print(f"[DEBUG] 다음 페이지 없음 → 검색 종료")
            break
        await next_btn.first.click()
        await page.wait_for_load_state("networkidle")  # ajax 로딩 대응

    print(f"[WARN] ❌ 오늘자 기사 못 찾음")
    return None, None

# ---------- (6) 상한가/급등종목 ----------
async def scrape_gainers(context, url: str, date_str: str):
    page = await context.new_page()
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

    items = []
    rows = await page.locator("tr").all()
    for row in rows:
        try:
            a = row.locator("a.popup")
            if await a.count() == 0:
                continue
            raw = (await a.first.inner_text()).replace("\r", "").replace("\t", "").strip()
            parts = [p for p in raw.split("\n") if p.strip()]
            name = parts[0].strip()
            code = ""
            if len(parts) > 1:
                m = re.search(r"\((\d{4,6})\)", parts[1])
                if m:
                    code = m.group(1)

            tds = row.locator("td")
            price, change, reason = "", "", ""
            if await tds.count() >= 3:
                try:
                    price = (await tds.nth(0).inner_text()).strip()
                    change = (await tds.nth(1).inner_text()).strip()
                    reason = (await tds.nth(2).inner_text()).strip()
                except Exception:
                    pass

            if name and code and reason:
                items.append({
                    "name": name,
                    "code": code,
                    "price": price,
                    "change": change,
                    "reason": reason
                })
        except Exception:
            continue

    await page.close()
    return [{
        "title": "상한가/급등종목",
        "url": url,
        "date": date_str,
        "items": items
    }]

# ---------- (3) 특징 테마 ----------
async def scrape_themes(context, url: str, date_str: str):
    page = await context.new_page()
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

    body_lines = []
    cells = await page.locator('td[style*="text-align:left"]').all()
    if cells:
        for td in cells:
            try:
                txt = (await td.inner_text()).strip()
                if txt:
                    body_lines.append(txt)
            except Exception:
                continue
    else:
        ps = await page.locator("#news_text p, .news_text p, article p").all()
        for p in ps:
            try:
                txt = (await p.inner_text()).strip()
                if txt:
                    body_lines.append(txt)
            except Exception:
                continue

    await page.close()
    return [{
        "title": "특징 테마",
        "url": url,
        "date": date_str,
        "body": "\n".join(body_lines)
    }]

# ---------- 메인 ----------
async def main():
    today_dash = datetime.now().strftime("%Y-%m-%d")
    today_dir = os.path.join(WEB_DATA_PATH, today_dash)
    os.makedirs(today_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # (6) 상한가/급등종목
        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        g_title, g_url = await find_today_article(context, page, ["증시요약(6)"], max_pages=5)
        gainers = []
        if g_url:
            print(f"[INFO] (6) 오늘 기사: {g_title} -> {g_url}")
            gainers = await scrape_gainers(context, g_url, today_dash)
        else:
            print("[WARN] 오늘자 (6) 상한가/급등 기사 미발견")

        # (3) 특징 테마
        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        t_title, t_url = await find_today_article(context, page, ["증시요약(3)"], max_pages=5)
        themes = []
        if t_url:
            print(f"[INFO] (3) 오늘 기사: {t_title} -> {t_url}")
            themes = await scrape_themes(context, t_url, today_dash)
        else:
            print("[WARN] 오늘자 (3) 특징 테마 기사 미발견")

        # 저장
        if gainers and gainers[0]["items"]:
            with open(os.path.join(today_dir, "infostock_gainers.json"), "w", encoding="utf-8") as f:
                json.dump(gainers, f, ensure_ascii=False, indent=2)
            print(f"[SAVE] {len(gainers[0]['items'])}개 (상한가/급등) → {today_dir}")
        else:
            print("[INFO] 상한가/급등 데이터 없음 → 저장 생략")

        if themes and themes[0]["body"]:
            with open(os.path.join(today_dir, "infostock_themes.json"), "w", encoding="utf-8") as f:
                json.dump(themes, f, ensure_ascii=False, indent=2)
            print(f"[SAVE] 특징 테마 저장 완료 → {today_dir}")
        else:
            print("[INFO] 특징 테마 데이터 없음 → 저장 생략")

        # 최신 index.json 갱신
        index_path = os.path.join(WEB_DATA_PATH, "index.json")
        with open(index_path, "w", encoding="utf-8") as idx:
            json.dump({"latestDate": today_dash}, idx, ensure_ascii=False, indent=2)
        print(f"[INDEX] latestDate → {today_dash} 갱신 완료")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
