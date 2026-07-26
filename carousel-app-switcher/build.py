#!/usr/bin/env python3
"""Generate two fully self-contained app-switcher carousel HTML files.

- app-switcher-wide.html  : faithful reproduction of the chrome.dev demo
- app-switcher-popup.html : 380px popup-adapted beautified variant

Both embed the 9 demo images as base64 data URIs and add mouse-wheel
horizontal scrolling.
"""

import base64
import pathlib

SRC = pathlib.Path(__file__).parent / "src" / "img"
OUT = pathlib.Path(__file__).parent

# 注意：codepen 资源编号与原站 alt 顺序是镜像的（1.jpg 实为红碗、9.avif 实为折纸）。
# 以下 alt 已按图片真实内容一一对应（经逐张目检核实）。
IMAGES = [
    ("1.jpg", "image/jpeg", "A minimalist depiction of a white abstract object, possibly a bowl, on a red background with soft lighting."),
    ("2.avif", "image/avif", "A cartoonish figure of a security guard in uniform, wearing dark glasses, standing with a small suitcase on a turquoise background."),
    ("3.avif", "image/avif", "A stylized illustration of two people sitting on swings suspended from a tree at a beach during sunset."),
    ("4.avif", "image/avif", "A stylized illustration of a beach scene at sunset, with people on the shore, palm trees, and a warm sky gradient."),
    ("5.avif", "image/avif", "A cartoonish illustration of a bright purple cup with orange handle and rim on a peach background."),
    ("6.avif", "image/avif", "A detailed close-up of large, blue and white flowers with visible textures and soft lighting."),
    ("7.avif", "image/avif", "A minimalist cartoonish rendering of a light green turtle on a peach-colored background."),
    ("8.avif", "image/avif", "A stylized illustration of a couple walking in the rain, holding an umbrella, against a city backdrop with warm tones and rain."),
    ("9.avif", "image/avif", "A stylized illustration of a pink and blue origami-like figure on a peach-colored background with subtle shadows"),
]


def data_uri(name: str, mime: str) -> str:
    b64 = base64.b64encode((SRC / name).read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def slides() -> str:
    parts = []
    for name, mime, alt in IMAGES:
        parts.append(
            f'      <li class="carousel__slide"><figure>'
            f'<img src="{data_uri(name, mime)}" alt="{alt}"></figure></li>'
        )
    return "\n".join(parts)


WHEEL_JS = """<script>
  // 鼠标滚轮 → 横向滚动（vertical wheel pans the carousel horizontally）
  const scroller = document.querySelector('.carousel');
  scroller.addEventListener('wheel', (e) => {
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!delta) return;
    e.preventDefault();
    scroller.scrollBy({ left: delta * 1.2, behavior: 'instant' });
  }, { passive: false });
</script>"""

# 宽屏版：初始对齐到第一张卡片（跳过 25cqi 前导空白，与原站 snap 稳定态一致）
ALIGN_JS = """<script>
  // 初始对齐到首张卡片（scroll-snap start 对齐点）；用 instant 绕过 smooth 动画
  requestAnimationFrame(() => {
    const first = scroller.querySelector('.carousel__slide:last-child');
    if (first) scroller.scrollTo({ left: Math.max(0, first.offsetLeft - 16), behavior: 'instant' });
  });
</script>"""

# CSS shared by both variants (mechanics ported 1:1 from the original demo)
CORE_CSS = """
/* ── 核心机制（移植自 chrome.dev/carousel app-switcher） ── */
.carousel {
  anchor-name: --carousel;
  container-type: size;
  list-style: none;
  margin: 0;
  display: grid;
  grid-auto-flow: column;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
@media (prefers-reduced-motion: no-preference) {
  .carousel { scroll-behavior: smooth; }
}
.carousel::before, .carousel::after { content: ""; display: block; }

.carousel__slide { scroll-snap-align: start; }
.carousel__slide:nth-child(1)  { order: 10; z-index: 1; }
.carousel__slide:nth-child(2)  { order: 9;  z-index: 2; }
.carousel__slide:nth-child(3)  { order: 8;  z-index: 3; }
.carousel__slide:nth-child(4)  { order: 7;  z-index: 4; }
.carousel__slide:nth-child(5)  { order: 6;  z-index: 5; }
.carousel__slide:nth-child(6)  { order: 5;  z-index: 6; }
.carousel__slide:nth-child(7)  { order: 4;  z-index: 7; }
.carousel__slide:nth-child(8)  { order: 3;  z-index: 8; }
.carousel__slide:nth-child(9)  { order: 2;  z-index: 9; }

/* 滑出视口的卡片变为惰性（不可聚焦/不可交互） */
.carousel--offscreen-inert .carousel__slide {
  animation: offscreen-inert linear both;
  animation-timeline: view(x);
}
@keyframes offscreen-inert {
  entry 0%, exit 100% { interactivity: inert; }
  entry 100%, exit 0% { interactivity: auto; }
}

.carousel figure {
  flex-shrink: 0;
  margin: 0;
  block-size: 100cqb;
  aspect-ratio: 9/16;
  background: #d8d8d8;
  box-shadow: 0 10px 30px rgba(12, 18, 36, 0.22);
  border-radius: 20px;
  overflow: clip;
  display: flex;
}
.carousel figure > img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  display: block;
}

/* 滚动驱动动画：卡片从左侧飞入 */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .carousel figure {
      animation: slide-in linear both;
      animation-timeline: view(x);
      animation-range: cover -75cqi contain 20cqi;
    }
  }
}
@keyframes slide-in {
  0% { transform: translate(-100cqi) scale(0.75); }
}

/* CSS 原生滚动按钮（Chrome 135+） */
.carousel::scroll-button(*) {
  z-index: 20;
  cursor: pointer;
  position: absolute;
  position-anchor: --carousel;
  inline-size: 44px;
  aspect-ratio: 1;
  display: flex;
  place-items: center;
  place-content: center;
  font-size: 18px;
  color: #0c1224;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(12, 18, 36, 0.25);
  border-radius: 50%;
  transition: transform 0.2s ease, opacity 0.3s ease, background-color 0.2s ease;
}
.carousel::scroll-button(left) {
  content: "\\2190" / "Scroll Left";   /* ← */
  position-area: center inline-start;
  margin-inline-start: 14px;
}
.carousel::scroll-button(right) {
  content: "\\2192" / "Scroll Right";  /* → */
  position-area: center inline-end;
  margin-inline-end: 14px;
}
.carousel::scroll-button(*):not(:disabled):hover {
  background: rgba(255, 255, 255, 0.9);
  transform: scale(1.1);
}
.carousel::scroll-button(*):disabled {
  opacity: 0.25;
  cursor: default;
}
"""

WIDE_CSS = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: #ffffff;
  color: #0c1224;
}
header.intro {
  max-inline-size: 860px;
  margin: 0 auto;
  padding: 56px 24px 8px;
}
header.intro .kicker {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6a7496;
  margin-bottom: 10px;
}
header.intro h1 { font-size: 34px; margin: 0 0 12px; letter-spacing: -0.02em; }
header.intro p { font-size: 15px; line-height: 1.7; color: #3d465e; margin: 0; }
header.intro .hint {
  margin-top: 14px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  color: #6a7496;
}
.stage { padding-block: 12px 56px; }

.carousel {
  inline-size: 100%;
  block-size: min(60svh, 720px);
  gap: 1rem;
  padding-inline: 1rem;
  scroll-padding-inline: 1rem;
  padding-block: 30px 60px;
}
.carousel::before { order: 0;  inline-size: 25cqi; }
.carousel::after  { order: 11; inline-size: 90cqi; }
@container (width < 480px) {
  .carousel figure { block-size: 50cqb; }
}

footer.note {
  max-inline-size: 860px;
  margin: 0 auto;
  padding: 0 24px 48px;
  font-size: 12px;
  color: #8a93ad;
  line-height: 1.7;
}
""" + CORE_CSS

POPUP_CSS = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  min-block-size: 100svh;
  display: grid;
  place-items: center;
  background: #e9e7e0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: #0c1224;
}

/* 预览用 popup 外壳（嵌入扩展时可去掉 .popup-shell 的边框/阴影） */
.popup-shell {
  inline-size: 380px;
  block-size: 560px;
  background: #f5f3ee;
  border: 1.5px solid #0c1224;
  border-radius: 14px;
  box-shadow: 8px 8px 0 rgba(12, 18, 36, 0.85);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.popup-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #ffffff;
  border-bottom: 1.5px solid #0c1224;
}
.popup-head .title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.popup-head .hint {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 9px;
  color: #6a7496;
}

.stage {
  flex: 1;
  min-block-size: 0;
  display: flex;
}

.carousel {
  inline-size: 100%;
  block-size: 100%;
  gap: 10px;
  padding-inline: 10px;
  scroll-padding-inline: 10px;
  padding-block: 16px;
}
.carousel::before { order: 0;  inline-size: 10cqi; }
.carousel::after  { order: 11; inline-size: 26cqi; }
.carousel__slide { scroll-snap-align: center; }
.carousel figure {
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(12, 18, 36, 0.25);
}

.popup-foot {
  flex: 0 0 auto;
  padding: 8px 14px;
  background: #ffffff;
  border-top: 1.5px solid #0c1224;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 9px;
  color: #6a7496;
  text-align: center;
}
""" + CORE_CSS

# popup 版本按钮略小
POPUP_CSS += """
.carousel::scroll-button(*) {
  inline-size: 34px;
  font-size: 14px;
  border: 1.5px solid #0c1224;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 2px 2px 0 rgba(12, 18, 36, 0.6);
}
"""

WIDE_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App Switcher Carousel · 宽屏复刻版</title>
<style>%%CSS%%</style>
</head>
<body>
  <header class="intro">
    <span class="kicker">CSS Scroll-Driven Carousel · 复刻自 chrome.dev/carousel</span>
    <h1>App Switcher</h1>
    <p>This carousel is akin to the Android and iOS app switcher experiences where a user
    horizontally pans through their apps and then chooses one. Most of the work is done
    with scroll driven animations, but the scroll button affordance adds a nice "web
    style" flare to the experience.</p>
    <div class="hint">操作方式：鼠标滚轮 · 触控板横滑 · 拖拽 · ← / → 滚动按钮</div>
  </header>

  <div class="stage">
    <div role="region" aria-label="App Switcher carousel demo">
      <ul class="carousel carousel--offscreen-inert" aria-live="polite">
%%SLIDES%%
      </ul>
    </div>
  </div>

  <footer class="note">
    自包含复刻版：9 张演示图片已内嵌为 data URI；新增鼠标滚轮横滚；CSS 机制（scroll-snap /
    scroll-driven animations / ::scroll-button / offscreen-inert）移植自 chrome.dev 的
    Carousel Gallery（需 Chrome 135+ 获得完整效果，旧浏览器退化为普通横向滚动）。
  </footer>

%%WHEEL%%
</body>
</html>
"""

POPUP_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App Switcher Carousel · popup 适配版</title>
<style>%%CSS%%</style>
</head>
<body>
  <div class="popup-shell">
    <header class="popup-head">
      <span class="title">App Switcher</span>
      <span class="hint">滚轮 · 拖拽 · 按钮</span>
    </header>

    <div class="stage">
      <div role="region" aria-label="App Switcher carousel demo" style="display:contents">
        <ul class="carousel carousel--offscreen-inert" aria-live="polite">
%%SLIDES%%
        </ul>
      </div>
    </div>

    <footer class="popup-foot">9 张图片已内嵌 · 滚轮横滚 · Chrome 135+ 完整动效</footer>
  </div>

%%WHEEL%%
</body>
</html>
"""


def main() -> None:
    slides_html = slides()
    wide = WIDE_HTML.replace("%%CSS%%", WIDE_CSS).replace("%%SLIDES%%", slides_html).replace("%%WHEEL%%", WHEEL_JS + "\n" + ALIGN_JS)
    popup = POPUP_HTML.replace("%%CSS%%", POPUP_CSS).replace("%%SLIDES%%", slides_html).replace("%%WHEEL%%", WHEEL_JS)
    (OUT / "app-switcher-wide.html").write_text(wide, encoding="utf-8")
    (OUT / "app-switcher-popup.html").write_text(popup, encoding="utf-8")
    print(f"wide : {len(wide)/1024:.0f} KB")
    print(f"popup: {len(popup)/1024:.0f} KB")


if __name__ == "__main__":
    main()
