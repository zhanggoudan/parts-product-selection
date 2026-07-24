from contextlib import redirect_stderr, redirect_stdout
from io import BytesIO, StringIO
import json
import os
import sys
import unittest
from unittest.mock import patch
from urllib.error import URLError
from urllib.request import Request

from scripts.sellersprite_client import (
    SellerSpriteAPIError,
    build_request,
    execute,
    interpret_response,
    main,
    validate_asin,
)


class SellerSpriteClientTests(unittest.TestCase):
    def test_validate_asin_accepts_uppercase_ten_character_asin(self):
        self.assertEqual(validate_asin("B0B7XZT8W7"), "B0B7XZT8W7")

    def test_validate_asin_rejects_invalid_value(self):
        with self.assertRaisesRegex(ValueError, "ASIN"):
            validate_asin("not-an-asin")

    def test_traffic_keyword_request_uses_documented_endpoint_and_body(self):
        request, safe_summary = build_request(
            command="traffic-keywords",
            secret="unit-test-secret",
            marketplace="US",
            asin="B0B7XZT8W7",
            page=1,
            size=50,
            month="202607",
        )

        self.assertEqual(request.full_url, "https://api.sellersprite.com/v1/traffic/keyword")
        self.assertEqual(request.method, "POST")
        self.assertEqual(
            json.loads(request.data.decode("utf-8")),
            {
                "marketplace": "US",
                "asin": "B0B7XZT8W7",
                "page": 1,
                "size": 50,
                "month": "202607",
            },
        )
        self.assertNotIn("unit-test-secret", json.dumps(safe_summary))

    def test_api_permission_error_is_not_treated_as_empty_data(self):
        with self.assertRaises(SellerSpriteAPIError) as context:
            interpret_response(
                {
                    "code": "ERROR_VISIT_MAX",
                    "message": "接口访问次数已达上限",
                    "data": None,
                }
            )

        self.assertEqual(context.exception.code, "ERROR_VISIT_MAX")

    def test_minimal_reviews_cli_uses_endpoint_default_page_size(self):
        stdout = StringIO()
        stderr = StringIO()
        argv = ["sellersprite_client.py", "reviews", "--asin", "B0B7XZT8W7"]
        with (
            patch.dict(os.environ, {"SELLERSPRITE_SECRET_KEY": "unit-test-secret"}),
            patch.object(sys, "argv", argv),
            patch("scripts.sellersprite_client.execute", return_value=[]) as mocked_execute,
            redirect_stdout(stdout),
            redirect_stderr(stderr),
        ):
            exit_code = main()

        self.assertEqual(exit_code, 0)
        self.assertEqual(stderr.getvalue(), "")
        request = mocked_execute.call_args.args[0]
        self.assertEqual(json.loads(request.data.decode("utf-8"))["size"], 10)

    def test_malformed_json_becomes_protocol_error(self):
        request = Request("https://api.sellersprite.com/v1/visits")
        response = BytesIO(b"not-json")
        with patch("scripts.sellersprite_client.urlopen", return_value=response):
            with self.assertRaises(SellerSpriteAPIError) as context:
                execute(request)
        self.assertEqual(context.exception.code, "ERROR_PROTOCOL")

    def test_json_array_becomes_protocol_error(self):
        request = Request("https://api.sellersprite.com/v1/visits")
        response = BytesIO(b"[]")
        with patch("scripts.sellersprite_client.urlopen", return_value=response):
            with self.assertRaises(SellerSpriteAPIError) as context:
                execute(request)
        self.assertEqual(context.exception.code, "ERROR_PROTOCOL")

    def test_timeout_becomes_network_error(self):
        request = Request("https://api.sellersprite.com/v1/visits")
        with patch("scripts.sellersprite_client.urlopen", side_effect=TimeoutError("timed out")):
            with self.assertRaises(SellerSpriteAPIError) as context:
                execute(request)
        self.assertEqual(context.exception.code, "ERROR_NETWORK")

    def test_url_error_becomes_network_error(self):
        request = Request("https://api.sellersprite.com/v1/visits")
        with patch(
            "scripts.sellersprite_client.urlopen",
            side_effect=URLError("connection refused"),
        ):
            with self.assertRaises(SellerSpriteAPIError) as context:
                execute(request)
        self.assertEqual(context.exception.code, "ERROR_NETWORK")


if __name__ == "__main__":
    unittest.main()
