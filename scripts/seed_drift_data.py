"""
Seed realistic demo Drift Alerts and Update Suggestions for LivingDocs.
Inserts into ws_demo.drift_alert and ws_demo.update_suggestion via docker exec sqlcmd.
"""
import subprocess
import json

SQL_PASSWORD = "LD!940E8AFBB1B97D048E6C17ABF1F7D29DD3952315217DF3F9EF7631EFBDAF6903aZ9"

sql_script = """
SET NOCOUNT ON;

-- 1. Get 3 real documents from ws_demo.document
DECLARE @doc1 UNIQUEIDENTIFIER = 'CB81433E-F36B-1410-87E5-006D67FE522A';
DECLARE @doc2 UNIQUEIDENTIFIER = '0BC0433E-F36B-1410-87CB-006D67FE522A';
DECLARE @doc3 UNIQUEIDENTIFIER = 'CBBE433E-F36B-1410-87CB-006D67FE522A';

-- If doc1 doesn't exist, pick any existing documents
IF NOT EXISTS (SELECT 1 FROM ws_demo.document WHERE id = @doc1)
    SELECT TOP 1 @doc1 = id FROM ws_demo.document ORDER BY created_at DESC;
IF NOT EXISTS (SELECT 1 FROM ws_demo.document WHERE id = @doc2)
    SELECT TOP 1 @doc2 = id FROM ws_demo.document WHERE id != @doc1;
IF NOT EXISTS (SELECT 1 FROM ws_demo.document WHERE id = @doc3)
    SELECT TOP 1 @doc3 = id FROM ws_demo.document WHERE id NOT IN (@doc1, @doc2);

-- Clean old demo drift alerts/suggestions
DELETE FROM ws_demo.update_suggestion;
DELETE FROM ws_demo.drift_alert;

-- Alert 1: Security Signature Drift (High severity, Pending Developer Action)
DECLARE @srcEvent1 UNIQUEIDENTIFIER = NEWID();
DECLARE @alert1 UNIQUEIDENTIFIER = NEWID();
DECLARE @ev1 NVARCHAR(MAX) = N'{"entities":[{"entity":"AdminSecurityConfig","kind":"class","severity":"High","sections":["overview","security-rules"],"message":"Phuong thuc authorizeHttpRequests mo rong phan quyen cho SUPERUSER tai endpoint /api/v1/admin/**","old":"authorizeHttpRequests().requestMatchers(/api/v1/admin/**).hasRole(ADMIN)","new":"authorizeHttpRequests().requestMatchers(/api/v1/admin/**).hasAnyRole(ADMIN, SUPERUSER)"}],"commit":"2554e4485f9c7d0b99a90821df91bc9eda1376ea","file":"backend/src/main/java/com/vendingmachine/admin/config/AdminSecurityConfig.java","diff":"+ .requestMatchers(\\"/api/v1/admin/**\\").hasAnyRole(\\"ADMIN\\", \\\"SUPERUSER\\\")\\n- .requestMatchers(\\"/api/v1/admin/**\\").hasRole(\\"ADMIN\\")"}';

INSERT INTO ws_demo.drift_alert (id, source_event_id, document_id, drift_type, severity, evidence, handling_status, created_at, updated_at)
VALUES (@alert1, @srcEvent1, @doc1, 'Signature', 'High', @ev1, 'Open', DATEADD(MINUTE, -45, SYSUTCDATETIME()), SYSUTCDATETIME());

INSERT INTO ws_demo.update_suggestion (id, document_id, drift_alert_id, origin, content, confidence_score, evidence, status, auto_apply_eligible, created_at, updated_at)
VALUES (NEWID(), @doc1, @alert1, 'drift', N'# Cap nhat Kien truc Bao mat (AdminSecurityConfig)

He thong da mo rong phan quyen endpoint quan tri `/api/v1/admin/**` cho phep ca hai vai tro `ADMIN` va `SUPERUSER` truy cap.

## Quy tac Phan quyen moi
- `ADMIN`: Quan tri toan quyen he thong
- `SUPERUSER`: Giam sat nang cao va tra cuu bao cao doanh thu

## Huong dan kiem thu
Kiem thu quyen truy cap bang cach gui Bearer token cua role `SUPERUSER` den `/api/v1/admin/health`.', 0.88, @ev1, 'Pending Developer Action', 0, DATEADD(MINUTE, -45, SYSUTCDATETIME()), SYSUTCDATETIME());


-- Alert 2: Payment API Semantic Drift (Critical severity, Pending Developer Action)
DECLARE @srcEvent2 UNIQUEIDENTIFIER = NEWID();
DECLARE @alert2 UNIQUEIDENTIFIER = NEWID();
DECLARE @ev2 NVARCHAR(MAX) = N'{"entities":[{"entity":"VnPayPaymentGateway","kind":"class","severity":"Critical","sections":["payment-flow","api-spec"],"message":"Bo sung truong checksum HMAC-SHA512 bat buoc trong callback payload thanh toan","old":"verifySignature(vnp_TxnRef, vnp_Amount, vnp_SecureHash)","new":"verifyHmacSha512(vnp_TxnRef, vnp_Amount, vnp_SecureHash, vnp_SignatureAlgo)"}],"commit":"7d83bf9e45d64bfdbf6aae792c5ce89ca90821df","file":"backend/src/main/java/com/vendingmachine/payment/VnPayPaymentGateway.java","diff":"+ if (!\\"HMACSHA512\\".equalsIgnoreCase(vnp_SignatureAlgo)) throw new SecurityException(\\"Unsupported signature algo\\");"}';

INSERT INTO ws_demo.drift_alert (id, source_event_id, document_id, drift_type, severity, evidence, handling_status, created_at, updated_at)
VALUES (@alert2, @srcEvent2, @doc2, 'Semantic', 'Critical', @ev2, 'Open', DATEADD(MINUTE, -20, SYSUTCDATETIME()), SYSUTCDATETIME());

INSERT INTO ws_demo.update_suggestion (id, document_id, drift_alert_id, origin, content, confidence_score, evidence, status, auto_apply_eligible, created_at, updated_at)
VALUES (NEWID(), @doc2, @alert2, 'drift', N'# Huong dan Tich hop Cong Thanh toan VNPAY v2.1

Tai lieu duoc cap nhat theo chuan bao mat VNPAY moi nhat yeu cau thuat toan chu ky HMAC-SHA512.

## Thay doi quan trong
1. Thuong luong chu ky yeu cau tham so `vnp_SignatureAlgo=HMACSHA512`.
2. Mo rong kiem tra toan ven du lieu voi Secret Key 64 ky tu.
3. Cac request sai thuat toan se bi tu choi voi HTTP 400 Bad Request.', 0.94, @ev2, 'Pending Developer Action', 0, DATEADD(MINUTE, -20, SYSUTCDATETIME()), SYSUTCDATETIME());


-- Alert 3: Referential Drift (Medium severity, Accepted)
DECLARE @srcEvent3 UNIQUEIDENTIFIER = NEWID();
DECLARE @alert3 UNIQUEIDENTIFIER = NEWID();
DECLARE @ev3 NVARCHAR(MAX) = N'{"entities":[{"entity":"OrderController","kind":"class","severity":"Medium","sections":["endpoints"],"message":"Endpoint /api/v1/orders/cancel doi tham so orderId thanh UUID tu Long","old":"cancelOrder(Long orderId)","new":"cancelOrder(UUID orderId)"}],"commit":"1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b","file":"backend/src/main/java/com/vendingmachine/order/OrderController.java","diff":"+ public ResponseEntity<Void> cancelOrder(@PathVariable UUID orderId)"}';

INSERT INTO ws_demo.drift_alert (id, source_event_id, document_id, drift_type, severity, evidence, handling_status, created_at, updated_at)
VALUES (@alert3, @srcEvent3, @doc3, 'Referential', 'Medium', @ev3, 'Handled', DATEADD(DAY, -1, SYSUTCDATETIME()), SYSUTCDATETIME());

INSERT INTO ws_demo.update_suggestion (id, document_id, drift_alert_id, origin, content, confidence_score, evidence, status, auto_apply_eligible, created_at, updated_at)
VALUES (NEWID(), @doc3, @alert3, 'drift', N'# Cap nhat Tham so API Huy Don hang (/api/v1/orders/cancel)

Chuyen doi dinh danh don hang tu dang so nguyen Long sang kieu chuoi UUID theo chuan kien truc phan tan.', 0.82, @ev3, 'Accepted', 0, DATEADD(DAY, -1, SYSUTCDATETIME()), SYSUTCDATETIME());

SELECT COUNT(*) AS alert_count FROM ws_demo.drift_alert;
SELECT COUNT(*) AS suggestion_count FROM ws_demo.update_suggestion;
"""

def main():
    # Write SQL script to temporary container path and run sqlcmd
    write_cmd = [
        "docker", "exec", "-i", "livingdocs-mssql",
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S", "localhost",
        "-U", "sa",
        "-P", SQL_PASSWORD,
        "-C",
        "-d", "livingdocs"
    ]
    proc = subprocess.run(write_cmd, input=sql_script, text=True, capture_output=True)
    print("Return code:", proc.returncode)
    print("STDOUT:", proc.stdout)
    if proc.stderr:
        print("STDERR:", proc.stderr)

if __name__ == "__main__":
    main()
