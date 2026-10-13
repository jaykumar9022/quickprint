# QuickPrint Production Deployment Guide

## 1. Quick Local Development
Run with Node.js & Vite:
```bash
npm install
npm run dev
```
Access at `http://localhost:3000`.

## 2. Docker Compose Deployment
```bash
docker-compose up -d
```
Runs:
- QuickPrint Full-Stack Container (Express + Vite SSR/SPA)
- PostgreSQL Database Container
- Redis Cache / Task Queue

## 3. Windows Print Agent Deployment on Shop Counter PC
1. Install Python 3.10+ on Windows.
2. In terminal:
```cmd
cd print-agent
pip install -r requirements.txt
python main.py --register --key QP-AGENT-SECURE-KEY-8821 --name "Front-Desk-Win11" --server "https://your-domain.com/api/v1"
```
3. Run as background service using NSSM or Windows Task Scheduler:
```cmd
nssm install QuickPrintAgent "C:\Python311\python.exe" "C:\QuickPrint\print-agent\main.py --config C:\QuickPrint\print-agent\config.toml"
nssm start QuickPrintAgent
```
