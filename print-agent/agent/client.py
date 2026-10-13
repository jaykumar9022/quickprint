"""
QuickPrint Agent API Client
Handles outbound secure HTTPS communication with the QuickPrint server.
"""
import os
import requests
import socket
from typing import Optional, Dict, Any

class QuickPrintApiClient:
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": f"QuickPrint-Agent/1.4.2 ({socket.gethostname()})",
            "X-Agent-Key": self.api_key,
        })

    def register(self, registration_key: str, agent_name: str, printers: list) -> Dict[str, Any]:
        """Registers a newly installed agent instance with the backend."""
        payload = {
            "registrationKey": registration_key,
            "machineHostname": socket.gethostname(),
            "name": agent_name,
            "printers": printers,
        }
        res = self.session.post(f"{self.base_url}/agent/register", json=payload, timeout=self.timeout)
        res.raise_for_status()
        data = res.json()
        self.api_key = data["apiKey"]
        self.session.headers["X-Agent-Key"] = self.api_key
        return data

    def send_heartbeat(self, printers: Optional[list] = None) -> Dict[str, Any]:
        """Sends periodic keep-alive signal and syncs local printer state."""
        payload = {}
        if printers:
            payload["printers"] = printers
        res = self.session.post(f"{self.base_url}/agent/heartbeat", json=payload, timeout=self.timeout)
        res.raise_for_status()
        return res.json()

    def claim_next_job(self) -> Optional[Dict[str, Any]]:
        """Atomically claims the next eligible paid print job in queue."""
        res = self.session.post(f"{self.base_url}/agent/jobs/claim", json={}, timeout=self.timeout)
        res.raise_for_status()
        data = res.json()
        return data.get("job")

    def download_document(self, job_id: str, target_filepath: str) -> str:
        """Downloads document PDF over authorized short-lived HTTPS stream."""
        url = f"{self.base_url}/agent/jobs/{job_id}/document"
        with self.session.get(url, stream=True, timeout=60) as r:
            r.raise_for_status()
            os.makedirs(os.path.dirname(target_filepath), exist_ok=True)
            with open(target_filepath, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        return target_filepath

    def report_event(self, job_id: str, state: str, message: str, spooler_job_id: Optional[str] = None) -> bool:
        """Reports intermediate spooler progression."""
        payload = {
            "state": state,
            "message": message,
            "spoolerJobId": spooler_job_id,
        }
        res = self.session.post(f"{self.base_url}/agent/jobs/{job_id}/events", json=payload, timeout=self.timeout)
        return res.status_code == 200

    def complete_job(self, job_id: str, spooler_job_id: str, message: str = "Spooler received and printed.") -> bool:
        """Confirms successful completion."""
        payload = {
            "spoolerJobId": spooler_job_id,
            "message": message,
        }
        res = self.session.post(f"{self.base_url}/agent/jobs/{job_id}/complete", json=payload, timeout=self.timeout)
        return res.status_code == 200

    def fail_job(self, job_id: str, reason: str, requires_operator_review: bool = True) -> bool:
        """Reports a printing or spooler failure."""
        payload = {
            "reason": reason,
            "requiresOperatorReview": requires_operator_review,
        }
        res = self.session.post(f"{self.base_url}/agent/jobs/{job_id}/fail", json=payload, timeout=self.timeout)
        return res.status_code == 200
