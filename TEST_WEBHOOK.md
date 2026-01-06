# Test Webhook Endpoints

## Test the webhook is working

### 1. Test locally first
```powershell
# Test local webhook (without /api prefix)
Invoke-WebRequest `
  -Uri http://localhost:5051/transaction/webhook/cashfree `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"TEST123"}}}'

# Test local webhook (with /api prefix)
Invoke-WebRequest `
  -Uri http://localhost:5051/api/transaction/webhook/cashfree `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"TEST123"}}}'
```

### 2. Test Railway deployment
```powershell
# Test Railway webhook (without /api prefix)
Invoke-WebRequest `
  -Uri https://msi-server-production.up.railway.app/transaction/webhook/cashfree `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"TEST123"}}}'

# Test Railway webhook (with /api prefix)
Invoke-WebRequest `
  -Uri https://msi-server-production.up.railway.app/api/transaction/webhook/cashfree `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"TEST123"}}}'
```

### 3. Test debug endpoints
```powershell
# Test webhook status
Invoke-WebRequest `
  -Uri https://msi-server-production.up.railway.app/debug/webhook-status `
  -Method GET

# Test simple webhook
Invoke-WebRequest `
  -Uri https://msi-server-production.up.railway.app/debug/test-webhook `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"test":"data"}'
```

### 4. Check Railway logs
After testing, check Railway logs to see:
- ✅ "🔔 Cashfree Webhook Received"
- ✅ "📍 Path: /transaction/webhook/cashfree" or "/api/..."
- ✅ "✅ Payment completed in XXXms"
- Or error details if something went wrong

## What was fixed

1. **Route Path Mismatch**: Added both `/transaction/webhook/cashfree` AND `/api/transaction/webhook/cashfree` routes
2. **Error Handling**: Wrapped webhook handler in try-catch to prevent crashes
3. **Commission Processing**: Wrapped commission processing in separate try-catch (non-critical)
4. **Logging**: Added detailed error logging with stack traces
5. **Test Endpoints**: Added `/debug/test-webhook` and `/debug/webhook-status` for debugging
