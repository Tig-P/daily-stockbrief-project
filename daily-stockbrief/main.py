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
    # " (증시요약(3))" 또는 " (증시요약(6))" 같은 꼬리표 제거
    return re.sub(r"\s*\(증시요약\(\d+\)\)", "", title).strip()

def to_abs(url: str) -> str:
    if not url:
        return ""
    return url if url.startswith("http") else f"https://stock.mk.co.kr{url}"

# ---------- 공통: 페이지네이션으로 기사 찾기 ----------
async def find_today_article(context, start_page, required_subs: list[str], max_pages: int = 5):
    """
    리스트 페이지에서 제목에 required_subs 전부 포함되는 링크를 찾고,
    상세 페이지에서 날짜가 '오늘'인지 확인 후 (제목, url)을 반환.
    """
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

        # 상세 들어가서 오늘 기사만 통과
        for raw_title, url in candidates:
            news = await context.new_page()
            try:
                await news.goto(url, wait_until="domcontentloaded", timeout=45000)
                # 날짜 셀렉터 여러가지를 시도
                date_loc = news.locator(".news_date, .date, span.date, .info_date")
                date_txt = ""
                try:
                    date_txt = (await date_loc.first.inner_text(timeout=5000)).strip()
                except Exception:
                    # 못 찾으면 본문 상단에서 텍스트 스캔(최후의 수단)
                    pass

                if any(mark in date_txt for mark in marks):
                    await news.close()
                    return clean_title(raw_title), url  # 오늘 기사 확정
            except PlaywrightTimeoutError:
                pass
            finally:
                await news.close()

        # 다음 페이지
        next_btn = page.locator("a.next, a.paging_next, a:has-text('다음')")
        if page_no == max_pages or await next_btn.count() == 0:
            break
        await next_btn.first.click()
        await page.wait_for_load_state("load")

    return None, None

# ---------- (6) 상한가/급등종목 상세 스크랩 ----------
async def scrape_gainers(context, url: str, date_str: str):
    page = await context.new_page()
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

    items = []
    # 각 종목 row에서 a.popup(종목명/코드) + 사유(td) 매칭
    rows = await page.locator("tr").all()
    for row in rows:
        try:
            a = row.locator("a.popup")
            if await a.count() == 0:
                continue
            raw = (await a.first.inner_text()).replace("\r", "").replace("\t", "").strip()
            # 예) "싸이버원\n(356890)"
            parts = [p for p in raw.split("\n") if p.strip()]
            name = parts[0].strip()
            code = ""
            if len(parts) > 1:
                m = re.search(r"\((\d{4,6})\)", parts[1])
                if m:
                    code = m.group(1)

            # 사유: 일반적으로 두 번째 TD 또는 text-align:left
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

# ---------- (3) 특징 테마 상세 스크랩 ----------
async def scrape_themes(context, url: str, date_str: str):
    page = await context.new_page()
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

    # 본문 셀 스캔 (테이블 td left 정렬 또는 뉴스 본문 p)
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
        # 백업: 일반 본문 영역
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
    os.makedirs(WEB_DATA_PATH, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # (6) 상한가/급등종목 찾기 (제목에 증시요약(6) + 상한가 + 급등)
        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        g_title, g_url = await find_today_article(context, page, ["증시요약(6)", "상한가", "급등"], max_pages=5)

        gainers = []
        if g_url:
            print(f"[INFO] (6) 오늘 기사: {g_title} -> {g_url}")
            gainers = await scrape_gainers(context, g_url, today_dash)
        else:
            print("[WARN] 오늘자 (6) 상한가/급등 기사 미발견")

        # (3) 특징 테마 찾기 (제목에 증시요약(3) + 특징)
        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        t_title, t_url = await find_today_article(context, page, ["증시요약(3)", "특징"], max_pages=5)

        themes = []
        if t_url:
            print(f"[INFO] (3) 오늘 기사: {t_title} -> {t_url}")
            themes = await scrape_themes(context, t_url, today_dash)
        else:
            print("[WARN] 오늘자 (3) 특징 테마 기사 미발견")

        # 저장: 배열 형태 유지 (프론트 코드와 호환)
        with open(os.path.join(WEB_DATA_PATH, f"infostock_gainers_{today_dash}.json"), "w", encoding="utf-8") as f:
            json.dump(gainers, f, ensure_ascii=False, indent=2)
        print(f"[SAVE] {len(gainers)}개 (상한가/급등) → {WEB_DATA_PATH}")

        with open(os.path.join(WEB_DATA_PATH, f"infostock_themes_{today_dash}.json"), "w", encoding="utf-8") as f:
            json.dump(themes, f, ensure_ascii=False, indent=2)
        print(f"[SAVE] {len(themes)}개 (특징 테마) → {WEB_DATA_PATH}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
