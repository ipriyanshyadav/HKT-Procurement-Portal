from __future__ import annotations
import re
from typing import Any, Optional
from uuid import UUID, uuid4
import httpx
from app.config import settings


IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
ACCOUNT_REGEX = re.compile(r"^[0-9]{9,18}$")


class BankVerificationAdapter:
    def __init__(self):
        pass

    @staticmethod
    def validate_ifsc(ifsc_code: str) -> bool:
        if not ifsc_code:
            return False
        return bool(IFSC_REGEX.match(ifsc_code.strip().upper()))

    @staticmethod
    def validate_account_number(account_number: str) -> bool:
        if not account_number:
            return False
        return bool(ACCOUNT_REGEX.match(account_number.strip()))

    async def initiate_penny_test(
        self,
        vendor_id: UUID,
        account_number: str,
        ifsc_code: str,
        account_holder_name: str,
    ) -> dict[str, Any]:
        cleaned_ifsc = ifsc_code.strip().upper() if ifsc_code else ""
        cleaned_acc = account_number.strip() if account_number else ""

        if not self.validate_ifsc(cleaned_ifsc):
            return {
                "status": "FAILED",
                "is_valid": False,
                "error": "INVALID_IFSC_CODE",
            }
        if not self.validate_account_number(cleaned_acc):
            return {
                "status": "FAILED",
                "is_valid": False,
                "error": "INVALID_ACCOUNT_NUMBER",
            }

        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            try:
                auth = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        "https://api.razorpay.com/v1/fund_accounts/validations",
                        auth=auth,
                        json={
                            "account_number": cleaned_acc,
                            "fund_account": {
                                "account_type": "bank_account",
                                "bank_account": {
                                    "name": account_holder_name,
                                    "ifsc": cleaned_ifsc,
                                    "account_number": cleaned_acc,
                                },
                            },
                            "amount": 100,  # in paise
                            "currency": "INR",
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    return {
                        "status": "PENNY_TEST_INITIATED",
                        "reference": data.get("id", f"RAZORPAY-{uuid4().hex[:12].upper()}"),
                        "amount": 1.00,
                        "raw_response": data,
                    }
            except Exception as e:
                return {
                    "status": "FAILED",
                    "is_valid": False,
                    "error": str(e),
                }

        # Mock / Simulation mode
        ref = f"PENNY-{uuid4().hex[:12].upper()}"
        return {
            "status": "PENNY_TEST_INITIATED",
            "reference": ref,
            "amount": 1.00,
        }

    async def verify_penny_test(self, reference: str, amount_received: float) -> dict[str, Any]:
        if abs(float(amount_received) - 1.00) < 0.01:
            return {
                "status": "VALIDATED",
                "is_valid": True,
                "reference": reference,
            }
        return {
            "status": "FAILED",
            "is_valid": False,
            "reference": reference,
            "error": "AMOUNT_MISMATCH",
        }
