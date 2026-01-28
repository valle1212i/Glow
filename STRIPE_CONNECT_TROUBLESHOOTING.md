# Stripe Connect Troubleshooting Guide

## Error: "Stripe Connect-kontot har inte aktiverat kortbetalningar ännu"

This error occurs when the backend (Source Portal) detects that the Stripe Connect account hasn't completed onboarding or enabled card payments.

---

## What This Error Means

The error message indicates:
- The Stripe Connect account exists but hasn't completed the onboarding process
- Card payments haven't been enabled for the Connect account
- The backend is checking the Connect account's capabilities and rejecting the checkout request

---

## Where to Check

### 1. Backend Configuration (Source Portal)

The error is coming from the backend endpoint:
```
POST /storefront/{tenant}/checkout
```

**Check the backend logs** for more details about:
- Which Stripe Connect account ID is being used
- What specific capability check is failing
- Any additional error details

### 2. Stripe Dashboard

**For the Connect Account:**
1. Log into Stripe Dashboard
2. Go to **Connect** → **Accounts**
3. Find the Connect account for `glowhairdressing`
4. Check the account status:
   - Is onboarding complete?
   - Are card payments enabled?
   - Are there any pending requirements?

**For the Platform Account:**
1. Check that the platform account has Connect enabled
2. Verify the Connect account is properly linked
3. Ensure the account has the necessary permissions

### 3. Backend Environment Variables

The backend needs these environment variables (check in Google Cloud or backend deployment):

**Required:**
- `STRIPE_SECRET_KEY` - Platform account secret key
- `STRIPE_CONNECT_ACCOUNT_ID` or similar - Connect account ID for the tenant
- Or the Connect account ID should be stored in the database for the tenant

**Check:**
- Are these variables set correctly in Google Cloud?
- Is the Connect account ID correctly associated with the tenant `glowhairdressing`?
- Has the backend been redeployed after adding these variables?

---

## Common Issues and Solutions

### Issue 1: Connect Account Not Linked to Tenant

**Symptom:** Backend can't find the Connect account for the tenant

**Solution:**
- Verify the Connect account ID is stored in the database for tenant `glowhairdressing`
- Check that the tenant configuration includes the Stripe Connect account ID
- Ensure the backend is reading the correct tenant configuration

### Issue 2: Onboarding Not Complete

**Symptom:** Connect account exists but onboarding is incomplete

**Solution:**
1. Go to Stripe Dashboard → Connect → Accounts
2. Find the Connect account
3. Complete any pending onboarding steps:
   - Business information
   - Bank account details
   - Identity verification
   - Enable card payments

### Issue 3: Card Payments Not Enabled

**Symptom:** Onboarding complete but card payments disabled

**Solution:**
1. In Stripe Dashboard, go to the Connect account
2. Navigate to **Settings** → **Payment methods**
3. Enable **Card payments**
4. Save changes

### Issue 4: Backend Not Checking Account Status Correctly

**Symptom:** Account is configured correctly but backend still rejects

**Solution:**
- Check backend logs for the exact error
- Verify the backend code is checking the correct account capabilities
- Ensure the backend is using the correct Stripe API version
- Check if there's a caching issue (try redeploying backend)

---

## Verification Steps

### 1. Check Backend Logs

Look for logs from the `/storefront/{tenant}/checkout` endpoint:
```bash
# In Google Cloud Console or backend logs
# Look for errors related to:
- Stripe Connect account
- Card payments capability
- Account onboarding status
```

### 2. Verify Connect Account Status via Stripe API

You can verify the account status using Stripe API:

```javascript
// Check account capabilities
const account = await stripe.accounts.retrieve('acct_xxxxx')
console.log('Capabilities:', account.capabilities)
console.log('Charges enabled:', account.charges_enabled)
console.log('Payouts enabled:', account.payouts_enabled)
console.log('Details submitted:', account.details_submitted)
```

### 3. Test Backend Endpoint Directly

Test the backend endpoint directly to see the full error:

```bash
curl -X POST https://source-database-809785351172.europe-north1.run.app/storefront/glowhairdressing/checkout \
  -H "Content-Type: application/json" \
  -H "X-Tenant: glowhairdressing" \
  -d '{
    "items": [{
      "variantId": "VOL1",
      "quantity": 1,
      "stripePriceId": "price_1SXiB5P6vvUUervCJrci0zWq"
    }],
    "successUrl": "https://example.com/success",
    "cancelUrl": "https://example.com/cancel"
  }'
```

---

## Next Steps

1. **Check backend logs** for detailed error information
2. **Verify Connect account status** in Stripe Dashboard
3. **Confirm environment variables** are set correctly in Google Cloud
4. **Test the backend endpoint** directly to see the full error response
5. **Contact backend team** if the Connect account appears correctly configured but errors persist

---

## Related Files

- `server.js` - Tenant backend that forwards requests to Source Portal backend
- `src/services/api.js` - Frontend checkout implementation
- Backend Source Portal - Handles Stripe Connect account validation

---

## Additional Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe Connect Account Capabilities](https://stripe.com/docs/connect/account-capabilities)
- [Stripe Connect Onboarding](https://stripe.com/docs/connect/onboarding)
