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


# ---------- 기사 찾기 ----------
async def find_today_article(context, start_page, required_subs: list[str], max_pages: int = 5):
    marks = today_markers()
    today_dash = datetime.now().strftime("%Y-%m-%d")
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

                date_digits = re.findall(r"\d+", date_txt)
                date_only = ""
                if len(date_digits) >= 3:
                    date_only = f"{date_digits[0]}-{date_digits[1].zfill(2)}-{date_digits[2].zfill(2)}"

                if not date_digits or date_only == today_dash or any(mark in date_txt for mark in marks):
                    await news.close()
                    return clean_title(raw_title), url

                try:
                    article_date = datetime.strptime(date_only, "%Y-%m-%d")
                    today = datetime.strptime(today_dash, "%Y-%m-%d")
                    if article_date < today:
                        await news.close()
                        continue
                except Exception:
                    await news.close()
                    return clean_title(raw_title), url

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
        await page.wait_for_load_state("domcontentloaded")

    return None, None


async def scrape_stock_info(context, code: str):
    import re
    def _norm(s: str) -> str:
        return re.sub(r"\s+", " ", s).strip()

    url = f"https://finance.naver.com/item/main.naver?code={code}"
    page = await context.new_page()
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

    trading_value, market_cap, listed_shares = "", "", ""

    # ----- 거래대금 -----
    try:
        # iframe 탐색 (종목에 따라 다를 수 있음)
        target_frame = None
        for f in page.frames:
            try:
                if await f.locator("td:has(span.sptxt:has-text('거래대금'))").count() > 0:
                    target_frame = f
                    break
            except:
                continue
        q = target_frame if target_frame else page

        cell = q.locator("td:has(span.sptxt:has-text('거래대금'))").first

        # blind 값 우선
        try:
            values = await cell.locator("em span.blind").all_inner_texts()
            if values and values[0].strip():
                value = values[0].strip()
                unit = await q.locator("td:has(span.sptxt:has-text('거래대금')) span.sptxt.sp_txt11").first.inner_text()
                trading_value = f"{value} {unit.strip()}"
            else:
                raise Exception("blind empty")
        except:
            # blind 없거나 비어있으면 em 전체 fallback
            try:
                val2 = await cell.locator("em").inner_text()
                unit = await q.locator("td:has(span.sptxt:has-text('거래대금')) span.sptxt.sp_txt11").first.inner_text()
                trading_value = f"{_norm(val2)} {unit.strip()}"
            except:
                trading_value = ""
    except:
        trading_value = ""

    # ----- 시가총액 -----
    try:
        mc = await page.locator("em#_market_sum").first.inner_text()
        market_cap = _norm(mc) + "억원"
    except:
        pass

    # ----- 상장주식수 -----
    try:
        ls = await page.locator("th:has-text('상장주식수') + td em").first.inner_text()
        listed_shares = _norm(ls)
    except:
        pass

    await page.close()
    return trading_value, market_cap, listed_shares


# ---------- 상한가/급등종목 (뉴스에서 기본만) ----------
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


# ---------- 특징 테마 ----------
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

        # 상한가/급등 기사
        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        g_title, g_url = await find_today_article(context, page, ["증시요약(6)"], max_pages=5)
        gainers = []
        if g_url:
            gainers = await scrape_gainers(context, g_url, today_dash)

        # 특징 테마 기사
        await page.goto(BASE_URL, wait_until="load", timeout=60000)
        t_title, t_url = await find_today_article(context, page, ["증시요약(3)"], max_pages=5)
        themes = []
        if t_url:
            themes = await scrape_themes(context, t_url, today_dash)

        # -------- 종목별 상세 정보 보강 --------
        if gainers and gainers[0]["items"]:
            for item in gainers[0]["items"]:
                trading_value, market_cap, listed_shares = await scrape_stock_info(context, item["code"])
                item["trading_value"] = trading_value
                item["market_cap"] = market_cap
                item["listed_shares"] = listed_shares

        # master.json 누적
        if gainers and gainers[0]["items"]:
            master_path = os.path.join(WEB_DATA_PATH, "master.json")
            if os.path.exists(master_path):
                with open(master_path, "r", encoding="utf-8") as f:
                    master_data = json.load(f)
            else:
                master_data = []

            for item in gainers[0]["items"]:
                master_data.append({
                    "date": today_dash,
                    "name": item["name"],
                    "code": item["code"],
                    "price": item["price"],
                    "change": item["change"],
                    "reason": item["reason"],
                    "trading_value": item.get("trading_value", ""),
                    "market_cap": item.get("market_cap", ""),
                    "listed_shares": item.get("listed_shares", "")
                })

            with open(master_path, "w", encoding="utf-8") as f:
                json.dump(master_data, f, ensure_ascii=False, indent=2)

        # 오늘 데이터 저장
        if gainers and gainers[0]["items"]:
            with open(os.path.join(today_dir, "infostock_gainers.json"), "w", encoding="utf-8") as f:
                json.dump(gainers, f, ensure_ascii=False, indent=2)

        if themes and themes[0]["body"]:
            with open(os.path.join(today_dir, "infostock_themes.json"), "w", encoding="utf-8") as f:
                json.dump(themes, f, ensure_ascii=False, indent=2)

        # index.json 갱신
        index_path = os.path.join(WEB_DATA_PATH, "index.json")
        existing_dirs = [
            d for d in os.listdir(WEB_DATA_PATH)
            if os.path.isdir(os.path.join(WEB_DATA_PATH, d)) and re.match(r"\d{4}-\d{2}-\d{2}", d)
        ]
        if existing_dirs:
            latest_date = max(datetime.strptime(d, "%Y-%m-%d") for d in existing_dirs)
            latest_date_str = latest_date.strftime("%Y-%m-%d")
        else:
            latest_date_str = today_dash

        with open(index_path, "w", encoding="utf-8") as idx:
            json.dump({"latestDate": latest_date_str}, idx, ensure_ascii=False, indent=2)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
