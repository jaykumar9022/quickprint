"""
Unit tests for QuickPrint Windows Print Agent Client and Spooler modules
"""
import pytest
from unittest.mock import MagicMock, patch
from agent.client import QuickPrintApiClient
from agent.spooler import WindowsSpooler

def test_api_client_initialization():
    client = QuickPrintApiClient(base_url="http://localhost:3000/api/v1", api_key="test_key_123")
    assert client.base_url == "http://localhost:3000/api/v1"
    assert client.api_key == "test_key_123"
    assert client.session.headers["X-Agent-Key"] == "test_key_123"

def test_spooler_printer_enumeration():
    spooler = WindowsSpooler(temp_dir="./temp_test_spool")
    printers = spooler.list_installed_printers()
    assert len(printers) > 0
    assert any("HP LaserJet" in p["name"] for p in printers)

@patch("requests.Session.post")
def test_claim_job_success(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "job": {
            "id": "job_999",
            "publicId": "QP-999000",
            "printerName": "HP LaserJet Pro M404dn",
            "config": {"copies": 1, "printSides": "single"}
        }
    }
    mock_post.return_value = mock_response

    client = QuickPrintApiClient(base_url="http://localhost:3000/api/v1", api_key="test_key")
    job = client.claim_next_job()
    assert job is not None
    assert job["publicId"] == "QP-999000"

@patch("requests.Session.post")
def test_heartbeat_dispatch(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"acknowledged": True, "pendingJobsCount": 0}
    mock_post.return_value = mock_response

    client = QuickPrintApiClient(base_url="http://localhost:3000/api/v1", api_key="test_key")
    res = client.send_heartbeat()
    assert res["acknowledged"] is True
