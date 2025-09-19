import asyncio
import json
import os
import re
import shutil
from datetime import datetime, date, timedelta
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

def get_last_weekday_folder(base_path):
    """public/data/에서 가장 최근 평일 폴더 반환"""
    today = datetime.today()
    for delta in range(1, 8):  # 최대 7일 뒤로 탐색
        check_day = today - timedelta(days=delta)
        if check_day.weekday() < 5:  # 평일만
            folder_name = check_day.strftime("%Y-%m-%d")
            candidate = os.path.join(base_path, folder_name)
            if os.path.exists(candidate):
                return candidate
    return None

# ---------- 공통: 페이지네이션으로 기사 찾기 ----------
async def find_today_article(context, start_page, required_subs: list[str], max_pages: int = 5):
    marks = today_markers()
    page = start_page
    for page_no in range(1, max_pages + 1):
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

        for raw_title, url in candidates:
            news = await context.new_page()
            try:
                await news.goto(url, wait_until="domcontentloaded", timeout=45000)
                date_loc = news.locator(".news_date, .date, span.date, .info_date")
                date_txt = ""
                try:
                    date_txt = (await date_loc.first.inner_text(timeout=5000)).strip()
                except Exception:
                    pass

                if any(mark in date_txt for mark in marks):
                    await news.close()
                    return clean_title(raw_title), url
            except PlaywrightTimeoutError:
                pass
            finally:
                await news.close()

        next_btn = page.locator("a.next, a.paging_next, a:has-text('다음')")
        if page_no == max_pages or await next_btn.count() == 0:
            break
        await next_btn.first.click()
        await page.wait_for_load_state("load")

    return None, None

# ---------- (6) 상한가/급등종목 스크랩 ----------
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

            reason = ""
            tds = row.locator("td")
            if await tds.count() >= 2:
                try:
                    reason = (await tds.nth(1).inner_text()).strip()
                except Exception:
                    pass
            if not reason:
                try:
                    reason = (await row.locator('td[style*="text-align:left"]').first.inner_text()).strip()
                except Exception:
                    pass

            if name and code and reason:
                items.append({"name": name, "code": code, "reason": reason})
        except Exception:
            continue

    await page.close()
    return [{
        "title": "상한가/급등종목",
        "url": url,
        "date": date_str,
        "items": items
    }]

# ---------- (3) 특징 테마 스크랩 ----------
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
    today_folder = os.path.join(WEB_DATA_PATH, today_dash)
    os.makedirs(today_folder, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        g_title, g_url = await find_today_article(context, page, ["증시요약(6)", "상한가", "급등"], max_pages=5)

        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        t_title, t_url = await find_today_article(context, page, ["증시요약(3)", "특징"], max_pages=5)

        if not g_url and not t_url:
            # 오늘 기사 없으면 → 주말 모드
            last_weekday_folder = get_last_weekday_folder(WEB_DATA_PATH)
            if last_weekday_folder:
                print(f"[INFO] 오늘 기사 없음 → {last_weekday_folder} 데이터 복사")
                for file_name in ["infostock_gainers.json", "infostock_themes.json"]:
                    src = os.path.join(last_weekday_folder, file_name)
                    dst = os.path.join(today_folder, file_name)
                    if os.path.exists(src):
                        shutil.copy(src, dst)
                await browser.close()
                return

        gainers = await scrape_gainers(context, g_url, today_dash) if g_url else []
        themes = await scrape_themes(context, t_url, today_dash) if t_url else []

        with open(os.path.join(today_folder, "infostock_gainers.json"), "w", encoding="utf-8") as f:
            json.dump(gainers, f, ensure_ascii=False, indent=2)
        with open(os.path.join(today_folder, "infostock_themes.json"), "w", encoding="utf-8") as f:
            json.dump(themes, f, ensure_ascii=False, indent=2)

        print(f"[SAVE] {len(gainers)}개 (상한가/급등) → {today_folder}")
        print(f"[SAVE] {len(themes)}개 (특징 테마) → {today_folder}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
