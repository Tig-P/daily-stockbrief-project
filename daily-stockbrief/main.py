import asyncio
import json
import os
import re
from datetime import datetime, date
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

BASE_URL = "https://stock.mk.co.kr/news/media/infostock"
WEB_DATA_PATH = "../daily-stockbrief-web/public/data"  # Next.js public/data 경로
KEEP_DAYS = 14  # 최근 14일 유지

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
            except:
                continue

        for raw_title, url in candidates:
            news = await context.new_page()
            try:
                await news.goto(url, wait_until="domcontentloaded", timeout=45000)
                date_loc = news.locator(".news_date, .date, span.date, .info_date")
                date_txt = ""
                try:
                    date_txt = (await date_loc.first.inner_text(timeout=5000)).strip()
                except:
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
                except:
                    pass

            if name and code and reason:
                items.append({"name": name, "code": code, "price": price, "change": change, "reason": reason})
        except:
            continue

    await page.close()
    return [{
        "title": "상한가/급등종목",
        "url": url,
        "date": date_str,
        "items": items
    }]

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
            except:
                continue
    else:
        ps = await page.locator("#news_text p, .news_text p, article p").all()
        for p in ps:
            try:
                txt = (await p.inner_text()).strip()
                if txt:
                    body_lines.append(txt)
            except:
                continue

    await page.close()
    return [{
        "title": "특징 테마",
        "url": url,
        "date": date_str,
        "body": "\n".join(body_lines)
    }]

async def main():
    today_dash = datetime.now().strftime("%Y-%m-%d")
    today_dir = os.path.join(WEB_DATA_PATH, today_dash)
    os.makedirs(today_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        g_title, g_url = await find_today_article(context, page, ["증시요약(6)", "상한가", "급등"], max_pages=5)
        gainers = await scrape_gainers(context, g_url, today_dash) if g_url else []

        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        t_title, t_url = await find_today_article(context, page, ["증시요약(3)", "특징"], max_pages=5)
        themes = await scrape_themes(context, t_url, today_dash) if t_url else []

        with open(os.path.join(today_dir, "infostock_gainers.json"), "w", encoding="utf-8") as f:
            json.dump(gainers, f, ensure_ascii=False, indent=2)
        with open(os.path.join(today_dir, "infostock_themes.json"), "w", encoding="utf-8") as f:
            json.dump(themes, f, ensure_ascii=False, indent=2)

        await browser.close()

    # 📌 날짜 폴더 최신 목록 index.json 생성
    all_dates = sorted(
        [d for d in os.listdir(WEB_DATA_PATH) if os.path.isdir(os.path.join(WEB_DATA_PATH, d))],
        reverse=True
    )
    recent = all_dates[:KEEP_DAYS]
    with open(os.path.join(WEB_DATA_PATH, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"dates": recent}, f, ensure_ascii=False, indent=2)

    # 📌 오래된 폴더 삭제
    for d in all_dates[KEEP_DAYS:]:
        old_path = os.path.join(WEB_DATA_PATH, d)
        try:
            for file in os.listdir(old_path):
                os.remove(os.path.join(old_path, file))
            os.rmdir(old_path)
        except:
            pass

if __name__ == "__main__":
    asyncio.run(main())
