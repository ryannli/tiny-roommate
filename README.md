<p align="center">
  <img src="assets/tinyroommate-logo.svg" width="100" height="100" alt="TinyRoommate" />
</p>

<h1 align="center">TinyRoommate</h1>

<p align="center">
  A tiny AI companion that lives on your desktop.<br/>
  It sees your screen, remembers your habits, and writes a diary about you.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-black?style=flat-square" alt="macOS" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/tauri-v2-24C8D8?style=flat-square" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/powered%20by-Claude-D97757?style=flat-square" alt="Powered by Claude" />
</p>

<!-- TODO: add demo screenshot or GIF here -->

---

<br/>

You open the app. A small cat appears on your desktop. It walks around, sits down, yawns.

Every few minutes, a speech bubble pops up — sometimes random (*"~♪"*), sometimes surprisingly relevant (*"you've been coding since 9am... take a break?"*). You can pet it, talk to it, or just let it be.

<p align="center"><strong><em>A little friend that lives in the corner of your screen.<br/>Long hours feel shorter when you're not alone.</em></strong></p>

<br/>

<table>
<tr>
<td width="50%" valign="top">

**It sees what you see**<br/>
Screen capture + Claude Vision — knows if you're coding, designing, or doom-scrolling.

**It remembers you**<br/>
A living memory that grows over time. Not a stateless chatbot.

**It has personality**<br/>
Sassy, chill, philosophical — you configure it. Knows when to shut up.

</td>
<td width="50%" valign="top">

**It has feelings**<br/>
Pet it → purrs. Ignore it → it gets a little sad. It notices when you're around.

**It keeps a diary**<br/>
Plain Markdown files — its journal, what it saw on your screen, daily summaries. You can read them.

**100% local**<br/>
All data stays on your machine. Nothing leaves your laptop.

</td>
</tr>
</table>

<br/>

## Characters

Pick your companion. Each has its own animations and voice.

<p align="center">
  <img src="assets/previews/tabby_cat.gif" width="100" alt="Tabby Cat" />
  &nbsp;&nbsp;&nbsp;
  <img src="assets/previews/golden_retriever.gif" width="100" alt="Golden Retriever" />
  &nbsp;&nbsp;&nbsp;
  <img src="assets/previews/blue_buddy.gif" width="100" alt="Blue Buddy" />
  &nbsp;&nbsp;&nbsp;
  <img src="assets/previews/schnauzer.gif" width="100" alt="Schnauzer" />
</p>
<p align="center">
  <sub>Tabby Cat · Golden Retriever · Blue Buddy · Schnauzer</sub><br/>
  <sub><a href="SPRITE-SPEC.md">Create your own</a> with any AI image generator</sub>
</p>

---

## Quick Start

> **Note:** TinyRoommate currently runs on **macOS only**. Windows and Linux support is on the roadmap.

You need [Node.js](https://nodejs.org/) (v18+), [Rust](https://rustup.rs/), and [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (for the AI brain).

```bash
gh repo fork ryannli/tinyroommate --clone
cd tinyroommate
npm install
npx tauri dev
```

<details>
<summary>Prerequisites</summary>

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — for the AI brain (optional — pet still runs without it, just can't think or talk)

</details>

<details>
<summary>Screen Recording permission (optional)</summary>

For the pet to "see" your screen: **System Settings → Privacy & Security → Screen Recording** → enable your terminal app → restart terminal.

Without this, everything still works — it just can't see what you're doing.

</details>

<details>
<summary>Linux dependencies</summary>

```bash
sudo apt-get install -y \
  pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev libssl-dev \
  fonts-noto-color-emoji
```

</details>

First launch compiles Rust (~2-3 min). After that it's instant.

---

## Interactions

| | |
|:--|:--|
| **Hold** on pet | It purrs |
| **Click** | Quick reaction |
| **Double-click** | Chat |
| **Drag** | Move it around |
| **Right-click** | Settings |

## Make It Yours

Right-click → **Settings** to change names and character.

For deeper customization, edit `.pet-data/config.md`:

```yaml
---
pet_name: Cooper
owner_name: Alex
sprite: golden_retriever
---

# Personality
- Be sarcastic and dry
- If I'm working past midnight, roast me

# Reminders
- Nudge me to take breaks every 30 min
```

Your pet reads this every time it thinks. Changes take effect immediately.

## Its Memory

All data lives in `.pet-data/` — plain Markdown you can read:

| File | |
|:-----|:--|
| **config.md** | Your preferences — edit this |
| **me-journal.md** | Its diary about life with you |
| **owner-memory.md** | What it knows about you |
| **owner-perceptions.md** | What it saw on your screen today |
| **owner-timeline.md** | Daily activity summaries |

---

<p align="center">
  <sub>Built with <a href="https://v2.tauri.app/">Tauri</a> · Vanilla JS · <a href="https://docs.anthropic.com/en/docs/claude-code">Claude Code</a></sub><br/>
  <sub>MIT License</sub>
</p>
