"""
QuickPrint Polling Worker Loop
Orchestrates agent polling, atomic job claiming, document verification, spooler execution, and error handling.
"""
import time
import os
import logging
from typing import Optional
from .client import QuickPrintApiClient
from .spooler import WindowsSpooler

logger = logging.getLogger("QuickPrint.Poller")

class AgentPoller:
    def __init__(
        self,
        client: QuickPrintApiClient,
        spooler: WindowsSpooler,
        poll_interval: int = 3,
        heartbeat_interval: int = 15,
        temp_dir: str = "./temp_spool",
    ):
        self.client = client
        self.spooler = spooler
        self.poll_interval = poll_interval
        self.heartbeat_interval = heartbeat_interval
        self.temp_dir = temp_dir
        self.running = False
        self._last_heartbeat = 0.0

    def start(self):
        """Starts the main polling loop."""
        self.running = True
        logger.info(f"Agent worker loop initialized. Polling every {self.poll_interval}s, heartbeat every {self.heartbeat_interval}s.")

        while self.running:
            try:
                now = time.time()
                # 1. Send heartbeat if elapsed
                if now - self._last_heartbeat >= self.heartbeat_interval:
                    self._do_heartbeat()
                    self._last_heartbeat = now

                # 2. Check and process jobs
                self._poll_and_process()

            except Exception as err:
                logger.error(f"Unexpected error in agent loop: {err}", exc_info=True)

            time.sleep(self.poll_interval)

    def stop(self):
        """Stops the worker loop gracefully."""
        self.running = False
        logger.info("Agent worker stopped.")

    def _do_heartbeat(self):
        try:
            printers = self.spooler.list_installed_printers()
            res = self.client.send_heartbeat(printers)
            logger.debug(f"Heartbeat acknowledged: {res}")
        except Exception as e:
            logger.warning(f"Failed to send heartbeat: {e}")

    def _poll_and_process(self):
        job = None
        try:
            job = self.client.claim_next_job()
        except Exception as e:
            logger.warning(f"Error querying pending jobs: {e}")
            return

        if not job:
            return # No jobs waiting

        job_id = job["id"]
        public_id = job.get("publicId", job_id)
        printer_name = job.get("printerName")
        config = job.get("config", {})

        logger.info(f"==> Successfully claimed Job [{public_id}] (ID: {job_id}) for [{printer_name}]")

        temp_pdf_path = os.path.join(self.temp_dir, f"{job_id}.pdf")

        try:
            # 1. Report DOWNLOADING state
            self.client.report_event(job_id, "DOWNLOADING", "Agent is downloading document to local spool queue.")

            # 2. Download PDF
            self.client.download_document(job_id, temp_pdf_path)
            logger.info(f"Downloaded document for Job [{public_id}] to {temp_pdf_path}")

            # 3. Report SUBMITTED_TO_SPOOLER
            self.client.report_event(job_id, "SUBMITTED_TO_SPOOLER", f"Forwarding to printer {printer_name}...")

            # 4. Print via Spooler
            spooler_job_id = self.spooler.print_pdf(temp_pdf_path, printer_name, config)

            # 5. Report Complete
            self.client.complete_job(
                job_id,
                spooler_job_id,
                message=f"Document dispatched to {printer_name} (Spooler ID: {spooler_job_id})"
            )
            logger.info(f"==> Job [{public_id}] completed successfully.")

        except Exception as err:
            logger.error(f"Error printing job [{public_id}]: {err}")
            self.client.fail_job(job_id, reason=str(err), requires_operator_review=True)
        finally:
            # Secure clean-up of temporary files
            if os.path.exists(temp_pdf_path):
                try:
                    os.remove(temp_pdf_path)
                    logger.debug(f"Cleaned up temporary spool file: {temp_pdf_path}")
                except Exception as clean_err:
                    logger.warning(f"Failed to remove temp file {temp_pdf_path}: {clean_err}")
