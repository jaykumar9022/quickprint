# QuickPrint Windows Print Agent

The QuickPrint Windows Print Agent runs as a background service or tray application on the printing shop's local Windows PC.

## Architecture

- Communicates strictly via **outbound HTTPS** to the QuickPrint cloud backend.
- No public inbound ports or router port-forwarding required.
- Heartbeats keep the cloud dashboard updated with agent and printer status.
- Atomically claims verified, paid print jobs from the print queue.
- Downloads PDF documents using secure temporary streams.
- Dispatches documents to Windows Print Spooler with precise settings (Paper Size, Duplex, Color/Monochrome, Number of copies).
- Reports real-time status transitions (`DOWNLOADING` -> `SUBMITTED_TO_SPOOLER` -> `COMPLETED` / `FAILED`).
- Automatically cleans up local temporary files upon print completion.

## Setup Instructions on Shop Windows PC

### 1. Install Prerequisites
- Windows 10 or 11 (64-bit)
- Python 3.10+ installed and added to PATH
- Installed and operational printer drivers (HP, Canon, Epson, Brother, etc.)

### 2. Install Python Dependencies
```cmd
cd print-agent
pip install -r requirements.txt
```

### 3. Register Agent Station
Copy `config.example.toml` to `config.toml` and run:
```cmd
python main.py --register --key QP-AGENT-SECURE-KEY-8821 --name "Main-Counter-Win11" --server "https://your-domain.com/api/v1"
```
Copy the returned `API Key` into `config.toml`.

### 4. Run the Daemon
```cmd
python main.py --config config.toml
```

For continuous 24/7 shop operation, configure as a Windows Service using NSSM (Non-Sucking Service Manager) or Windows Task Scheduler at system startup.
