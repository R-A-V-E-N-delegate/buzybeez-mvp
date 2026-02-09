# BuzyBeez Dev Guide

## Prereqs

- Node.js 20+
- pnpm
- Docker Desktop running
- `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`)

## Install

```bash
pnpm install
```

## Run Orchestrator

```bash
cd packages/orchestrator
pnpm dev
```

This starts the API at `http://localhost:3001` and WS at `ws://localhost:3001/ws`.

## Run UI

```bash
cd packages/canvas-ui
pnpm dev
```

The UI runs at `http://localhost:3000` and loads data from the orchestrator.

## Notes on Docker

- The first bee start will build the image `buzybeez/bee:latest`.
- Bee data is stored under `data/containers/<beeId>`.
- Bee logs are streamed from `data/containers/<beeId>/logs/transcript.jsonl`.

## Auth Scaffold

Optional API auth:

```bash
AUTH_ENABLED=true
BUZYBEEZ_API_KEY=your-key
```

Send with `Authorization: Bearer your-key`.
