"""Playwright engine for JS-rendered ecommerce pages."""
from __future__ import annotations

import asyncio
from typing import Any


async def fetch_rendered_html(url: str, scroll: bool = True) -> str:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        )
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            if scroll:
                for _ in range(3):
                    await page.evaluate("window.scrollBy(0, window.innerHeight)")
                    await asyncio.sleep(0.8)
            return await page.content()
        finally:
            await browser.close()


async def screenshot_page(url: str) -> bytes | None:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=45_000)
            return await page.screenshot(full_page=False)
        except Exception:
            return None
        finally:
            await browser.close()
