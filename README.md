<p align="center">
  <img src="assets/tinyroommate-logo.svg" width="120" height="120" alt="TinyRoommate" />
</p>

<h1 align="center">TinyRoommate</h1>

<h3 align="center">A tiny AI companion that lives on your desktop.</h3>
<p align="center">It sees your screen. It remembers your habits. It writes a diary.</p>

<!-- TODO: add demo GIF -->

<br/>

You open the app. A small cat appears on your desktop.

It walks around. Sits down. Yawns. Every few minutes, a speech bubble pops up — sometimes random (*"~♪"*), sometimes surprisingly relevant (*"you've been coding since 9am... take a break?"*).

You can pet it. Talk to it. Or just let it be.

It's not an assistant. It's a roommate.

<br/>

<table>
<tr>
<td width="50%">

**It sees what you see**
Screen capture + Claude Vision — it knows if you're coding, designing, or doom-scrolling.

**It remembers you**
A living memory that grows over time. Not a stateless chatbot.

**It has personality**
Sassy, chill, philosophical — you configure it. It knows when to shut up.

</td>
<td width="50%">

**It has feelings**
Pet it and it purrs. Ignore it and it gets a little sad. It notices when you're around.

**It keeps a diary**
Plain Markdown files you can read — its own journal, what it saw on your screen, daily summaries.

**100% local**
All data stays on your machine. Nothing leaves your laptop.

</td>
</tr>
</table>

<br/>

## Characters

<p align="center">
  <img src="assets/previews/tabby_cat.gif" width="128" alt="Tabby Cat" />
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/previews/golden_retriever.gif" width="128" alt="Golden Retriever" />
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/previews/blue_buddy.gif" width="128" alt="Blue Buddy" />
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/previews/schnauzer.gif" width="128" alt="Schnauzer" />
</p>
<p align="center">
  <sub><strong>Tabby Cat</strong> · <strong>Golden Retriever</strong> · <strong>Blue Buddy</strong> · <strong>Schnauzer</strong></sub><br/>
  <sub>Want to add your own? See <a href="SPRITE-SPEC.md">Sprite Spec</a> — generate a spritesheet with any AI image tool, drop it in, done.</sub>
</p>

## Quick Start

> **Note:** TinyRoommate currently runs on **macOS only**. Windows and Linux support is on the roadmap.

You need [Node.js](https://nodejs.org/) (v18+), [Rust](https://rustup.rs/), and [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (for the AI brain).

```bash
gh repo fork ryannli/tiny-roommate --clone
cd tinyroommate
npm install
npx tauri dev
```

This is meant to be *your* pet — fork it, customize it, make it weird. First launch compiles Rust (~2-3 min). After that it's instant.

> **No Claude Code?** The pet still runs — walks around, fidgets, reacts to clicks — but can't think, talk, or see your screen. Install Claude Code to unlock its full brain.

### Screen Recording (optional, macOS)

For the pet to "see" your screen, grant permission in **System Settings > Privacy & Security > Screen Recording** for your terminal app, then restart.

## How to Interact

| Action | What happens |
|--------|-------------|
| **Hold** mouse on pet | Pet it — it purrs |
| **Click** | Tap for a quick reaction |
| **Double-click** | Open chat |
| **Drag** | Pick it up and move it around |
| **Right-click** | Settings menu |

## Make It Yours

Right-click > **Settings** to change names and character. For deeper customization, edit `.pet-data/config.md`:

```yaml
---
owner_name: Alex
sprite: golden_retriever
---
```

Everything below the frontmatter is free-form instructions your pet reads every time it thinks:

```markdown
# Personality
- Be sarcastic and dry
- If I'm working past midnight, roast me

# Reminders
- Nudge me to take breaks every 30 min
```

Changes take effect immediately.

## Its Memory

Your pet keeps a journal in `.pet-data/` — all plain Markdown files you can read:

| File | What's inside |
|------|--------------|
| `config.md` | Your preferences — edit this |
| `me-journal.md` | Its personal diary |
| `owner-memory.md` | What it's learned about you over time |
| `owner-perceptions.md` | What it saw on your screen today |
| `owner-timeline.md` | Daily activity summaries |

## Built With

[Tauri v2](https://v2.tauri.app/) · Vanilla JS · [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (Haiku)

## License

MIT
