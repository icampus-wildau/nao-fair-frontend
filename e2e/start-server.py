"""Isolated browser-test backend. Never reads or writes operator data."""

import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "nao-fair-server"))

with TemporaryDirectory(prefix="nao-fair-browser-") as directory:
    os.environ["NAO_FAIR_DB"] = str(Path(directory) / "test.sqlite")
    os.environ["NAO_FAIR_SECRETS"] = str(Path(directory) / "secrets.json")
    # Tests use synthetic credentials only, independent of the operator's environment.
    os.environ.pop("OPENAI_API_KEY", None)
    os.environ.pop("GLADIA_API_KEY", None)
    from nao_fair.test_server import create_test_app

    uvicorn.run(create_test_app(), host="127.0.0.1", port=8001, log_level="warning")
