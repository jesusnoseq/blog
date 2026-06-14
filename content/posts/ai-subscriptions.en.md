---
title: "AI subscriptions for DEVs"
date: 2026-06-14T23:55:34+01:00
draft: false
tags: ["AI", "money", "investment","dev"]
categories: ["blog"]
---
We’ve been living with generative AI for a while now, and since then it’s become pretty common to chat with fellow engineers about how LLMs are evolving in agentic programming. I get asked about it a lot, and I also end up asking pretty much everyone I meet—mostly people in the industry, since that’s just the circles I move in—how they’re using AI, whether their companies allow it, or if they’re paying for subscriptions themselves.

As a way to structure my thoughts, and maybe serve as a guide, I’m putting this post together where I’ll compare the different AI subscriptions out there, share some advice, and add a few final reflections.

## TL;DR

The list of models and subscriptions in this post will probably be outdated within a few months. Keeping up to date takes time.

In my opinion, the best approach is not to “marry” any specific company or model, but instead ride the wave as it comes.

## Models

Looking at a model ranking like <https://www.vals.ai/benchmarks/swebench>, we can see that the top—and most expensive—models are from Anthropic (Claude), OpenAI (GPT), and Google (Gemini).

After that, we get models from Chinese companies like GLM, DeepSeek, MiMo, MiniMax, or Qwen, typically at much lower prices.

To put things into perspective, Chinese models are usually a bit behind the frontier models from Anthropic and OpenAI. Could this be partly because they are distilled versions of better models? Possibly. But it’s also reasonable to think that competition is pushing everyone to move fast and close the gap.

In my experience, any model that scores roughly above 70% on SWE-bench already provides a comfortable agentic programming experience.

Obviously, the more powerful the model, the better it becomes at handling longer tasks with fewer mistakes. Notice I say “letting it write” rather than trusting it, delegating, or letting it fully handle things. The larger the task, the higher the cognitive debt, and the harder it becomes to carefully review the generated code.

My current workflow is to give agents short, well-scoped tasks and review every single change. I also use them heavily for code review and spotting potential issues.

## Agentic Tools for Developers

These tools allow AI models to take action. For example, they can search files on a machine, read and write them, execute programs, or fetch information from the internet.

I’ll list the most well-known ones just to give some context. There are definitely more out there, but the goal here isn’t to cover everything exhaustively.

### IDE

Basically AI integrated directly into the IDE—you get a chat panel where you ask questions, request changes, and see them reflected in the editor.

Many of these tools also offer a free tier for agentic usage.

* **Visual Studio Code (VSC)** → Integrated with GitHub Copilot  
* **Cursor** → A VS Code fork with native AI. Agent mode, cloud agents, and Bugbot for code review  
* **Codex** → From OpenAI. A web-based IDE where an agent works autonomously on programming tasks  
* **Devin Desktop (ex-Windsurf)** → Previously known as Windsurf. Cloud agents and its own SWE 1.6 model  
* **Trae** → From ByteDance. “SOLO” mode  

### CLI

We can also use AI agents from the terminal. Interestingly, agents often perform better in this setup—maybe because a plain text environment removes UI distractions and forces more precise instructions.

* **Claude Code** → Anthropic’s CLI for coding. One of the most widely used, and compatible with third-party tools  
* **GitHub CLI** → From Microsoft  
* **Codex CLI** → From OpenAI  
* **OpenCode** → Open source and free. Works with any provider via API keys, Zen (pay-as-you-go), or Go ($10/month)  
* **Crush** → Another Go-based CLI for agentic programming  

## Subscriptions

Over the last few months, AI subscriptions have been increasing in price and/or reducing quotas quite aggressively.

Just this month, June 2026, GitHub Copilot changed the terms of the subscription I was using. It went from being the best value for money to arguably the worst.

Right now I’m trying OpenCode Go—I don’t think I’ll even come close to exhausting the quota.

### Entry-level subscriptions

The table below shows the minimum plan that includes access to coding agents:

| Service            | Plan   | Price (€/month) | Type                       | Quota* | Notes |
|--------------------|--------|-----------------|----------------------------|--------|--------------------------|
| Claude (Anthropic) | Pro    | 20€             | Web + Desktop + CLI        | Tight  | Not compatible with third-party tools |
| ChatGPT (OpenAI)   | Plus   | 20€             | Web + IDE extensions + CLI | Tight  | Not compatible with third-party tools |
| GitHub Copilot     | Pro    | 10€             | IDE + CLI                  | N/A    | Tied to VS Code. Includes autocomplete and code review in GitHub |
| Cursor             | Pro    | 20€             | IDE                        | Tight  | Strong agent mode integrated into its IDE |
| OpenCode Go        | Go     | 10€             | CLI + Desktop + API        | Yes    | $5 first month. Uses open models (GLM-5.1, DeepSeek V4, etc.) |
| Trae               | Pro    | 10€             | IDE                        | Tight  | Not compatible with third-party tools |
| Devin Desktop      | Pro    | 20€             | IDE                        | N/A    | Formerly Windsurf |
| Google AI Plus     | Plus   | 22€             | API + Jules + Antigravity  | Tight  | Includes Jules and Antigravity |

\* Quota: The subscription includes enough tokens/requests for a developer to use it throughout the month without fully exhausting it.

There are also services that offer a limited number of free requests or tokens. I haven’t seen any of them explicitly stating they won’t use your data for their own purposes. Be very careful with `.env` files.

## Reflections

* Conditions change—don’t buy annual subscriptions.
* Try to make your project agnostic to both the model and the IDE you use.
* For local use, 16 GB of VRAM already lets you run interesting models.
* Be careful with new attack vectors and surfaces. Even “skills”, despite being Markdown files, can be dangerous. Dependencies can also be a risk.
* It’s very tempting to always use the most powerful model, but it gets expensive. Match the model to the task.
* If you want to learn something, I’d honestly start building it with the help of a good AI subscription instead of buying a course—especially if the course is expensive or long.
* Frontier model prices may keep increasing, but models that are currently “good enough” for coding will likely become cheaper over time.