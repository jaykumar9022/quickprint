# QuickPrint Windows Print Agent Technical Specification

## 1. Operating Model
The Print Agent operates as an unattended Windows service or background worker running on the shop counter PC.
The PC connects to physical printers via USB or local Gigabit Ethernet / Wi-Fi.

## 2. Key Modules
- **`agent/client.py`**: Authenticated HTTPS REST client communicating with the cloud server using API key credentials.
- **`agent/poller.py`**: Heartbeat dispatcher (every 15s) and job claim loop (every 3s).
- **`agent/spooler.py`**: Direct integration with Windows Win32 Print Spooler (`win32print`, `win32api`). Configures DEVMODE structures:
  - `dmCopies`: Exact copy multiplier
  - `dmColor`: DMCOLOR_MONOCHROME (1) or DMCOLOR_COLOR (2)
  - `dmDuplex`: DMDUP_SIMPLEX (1) or DMDUP_VERTICAL (2)
  - `dmPaperSize`: DMPAPER_A4 (9), DMPAPER_LEGAL (5), DMPAPER_A3 (8)
- **`main.py`**: Entry point with CLI support (`--register`, `--config`, `--name`).

## 3. Print Job Lifecycle States
1. `QUEUED`: Verified paid job in cloud database.
2. `CLAIMED`: Agent claims lock atomically with agent ID.
3. `DOWNLOADING`: Streamed over HTTPS to `C:\QuickPrint\TempSpool\<job_id>.pdf`.
4. `SUBMITTED_TO_SPOOLER`: Dispatched into Windows print queue with configured DEVMODE.
5. `COMPLETED`: Handover confirmed; temporary local files deleted securely.
6. `NEEDS_OPERATOR_REVIEW` / `FAILED`: Hardware paper jam or low toner; halts retry until operator investigates.
