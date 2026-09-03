from app.core.constants import AuditAction, PermissionCode, AUDIT_INSERT_ONLY, MAKER_CHECKER_ENFORCED

def test_audit_action_login_success():
    assert isinstance(AuditAction.LOGIN_SUCCESS, str)
    assert AuditAction.LOGIN_SUCCESS == "LOGIN_SUCCESS"

def test_permission_code_attributes():
    assert PermissionCode.RFQ_VIEW_BIDS_BEFORE_OPENING == "rfq.view_bids_before_opening"
    
    # Check total permissions count is >= 100
    attributes = [attr for attr in dir(PermissionCode) if not attr.startswith("__")]
    assert len(attributes) >= 100

def test_audit_insert_only():
    assert AUDIT_INSERT_ONLY is True

def test_maker_checker_enforced():
    assert MAKER_CHECKER_ENFORCED is True
