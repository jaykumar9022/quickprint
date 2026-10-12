"""
QuickPrint Windows Print Agent - Main Entrypoint
CLI application for running the automated print station on the shop's local Windows computer.
"""
import os
import sys
import logging
import argparse
try:
    import toml
except ImportError:
    toml = None

from agent.client import QuickPrintApiClient
from agent.spooler import WindowsSpooler
from agent.poller import AgentPoller

def setup_logging(level: str = "INFO"):
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

def main():
    parser = argparse.ArgumentParser(description="QuickPrint Windows Automated Print Station Agent")
    parser.add_argument("--config", default="config.toml", help="Path to config.toml file")
    parser.add_argument("--register", action="store_true", help="Register this station using shop registration key")
    parser.add_argument("--key", help="Registration key (used with --register)")
    parser.add_argument("--name", default="Shop-Win-Station", help="Friendly name of this agent station")
    parser.add_argument("--server", default="http://localhost:3000/api/v1", help="QuickPrint API base URL")

    args = parser.parse_args()
    setup_logging()
    logger = logging.getLogger("QuickPrint.Main")

    # Load configuration
    config_data = {}
    if os.path.exists(args.config) and toml:
        try:
            with open(args.config, "r") as f:
                config_data = toml.load(f)
        except Exception as e:
            logger.warning(f"Could not parse {args.config}: {e}")

    server_url = config_data.get("server", {}).get("api_base_url", args.server)
    api_key = config_data.get("agent", {}).get("api_key", "agent_sec_token_991823719283")
    spool_dir = config_data.get("printer", {}).get("temp_storage_dir", "./temp_spool")

    spooler = WindowsSpooler(temp_dir=spool_dir)

    if args.register:
        reg_key = args.key or config_data.get("agent", {}).get("registration_key")
        if not reg_key:
            logger.error("Registration key required. Pass via --key or in config.toml")
            sys.exit(1)
        client = QuickPrintApiClient(base_url=server_url, api_key="")
        printers = spooler.list_installed_printers()
        logger.info(f"Registering station '{args.name}' with server {server_url}...")
        try:
            res = client.register(reg_key, args.name, printers)
            logger.info("Registration successful!")
            logger.info(f"Agent ID: {res['agentId']}")
            logger.info(f"API Key:  {res['apiKey']}")
            logger.info("Save this API key in your config.toml under [agent].api_key")
        except Exception as err:
            logger.error(f"Registration failed: {err}")
            sys.exit(1)
        return

    logger.info("=====================================================")
    logger.info(" QuickPrint Windows Automated Print Station Daemon ")
    logger.info("=====================================================")
    logger.info(f"Server URL:     {server_url}")
    logger.info(f"Target Spool:   {spool_dir}")
    printers = spooler.list_installed_printers()
    logger.info(f"Detected {len(printers)} printer(s):")
    for p in printers:
        logger.info(f"  * {p['name']} (Default: {p.get('isDefault')}, Duplex: {p.get('supportsDuplex')})")

    client = QuickPrintApiClient(base_url=server_url, api_key=api_key)
    poller = AgentPoller(client=client, spooler=spooler, temp_dir=spool_dir)

    try:
        poller.start()
    except KeyboardInterrupt:
        logger.info("Shutting down agent by operator interrupt...")
        poller.stop()

if __name__ == "__main__":
    main()
