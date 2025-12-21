# ✅ Frontend-implementation: Storefront Checkout med Shipping Options

Hej Customer Portal Team!

Vi har implementerat integrationen med den nya **Storefront Checkout Endpoint** som stödjer shipping options (PostNord integration), stock validation, och order creation i databasen.

---

## ✅ Vad vi har implementerat

### Frontend-ändringar

Vi har uppdaterat `createCheckoutSession`-funktionen i frontend för att använda den nya backend-endpointen istället för att skapa Stripe Checkout sessions direkt:

**Ny endpoint:**
```
POST /storefront/:tenant/checkout
```

**Request payload:**
```javascript
{
  items: [
    {
      variantId: "PRODUCT-SIZE-COLOR",  // Format: PRODUCT-{productId}
      quantity: 1,
      stripePriceId: "price_xxxxx",
      priceSEK: 49900  // Price in öre (cents)
    }
  ],
  customerEmail: "customer@example.com",  // Optional
  successUrl: "https://your-site.com/success?session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "https://your-site.com/cancel",
  recipientAddress: {  // Optional - för PostNord dynamic rates
    address1: "Street Address",
    address2: "Apt/Suite",
    city: "Stockholm",
    postalCode: "12345",
    country: "SE"
  }
}
```

**Response:**
```javascript
{
  success: true,
  checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_...",
  sessionId: "cs_test_...",
  orderId: "...",
  expiresAt: "2025-12-21T21:30:00.000Z"
}
```

### Teknisk implementation

**Kod-exempel:**
```javascript
// Konvertera cart items till nytt format
const items = cartItems.map(item => ({
  variantId: item.variantId || `PRODUCT-${item.productId}`,  // Fallback om variantId saknas
  quantity: item.quantity,
  stripePriceId: getCheckoutPriceId(item),  // Använd campaign price om tillgänglig
  priceSEK: Math.round(item.price * 100)  // Konvertera SEK till öre
}))

const payload = {
  items: items,
  successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancelUrl: `${window.location.origin}/checkout/cancel`
  // recipientAddress är valfritt och kan läggas till senare
}

// Anropa backend endpoint
const response = await fetch(`${API_CONFIG.BASE_URL}/storefront/${API_CONFIG.TENANT}/checkout`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
```

### Migrering från gammal implementation

**FÖRE (gamla implementationen):**
- Använde lokal Express route: `/api/create-checkout-session`
- Skapade Stripe Checkout session direkt i frontend server
- Ingen stock validation
- Inga shipping options
- Ingen order creation i databasen

**EFTER (nya implementationen):**
- Använder backend customer portal endpoint: `/storefront/:tenant/checkout`
- Backend hanterar all Stripe-integration
- ✅ Stock validation innan checkout
- ✅ Automatiska shipping options (PostNord API eller static fallback)
- ✅ Order creation i databasen
- ✅ Stöd för promotion codes via metadata.campaignId

---

## 🔧 Nya funktioner

### 1. Shipping Options

**Automatisk shipping address collection:**
- Aktiveras automatiskt för SE, NO, DK, FI
- PostNord API används för dynamic rates (om aktiverat)
- Fallback till static rates (Standard 50 SEK, Express 100 SEK) om PostNord inte är tillgänglig

**Shipping rates:**
- Om PostNord integration är aktiverad: Dynamiska priser från PostNord Delivery Options API
- Om disabled eller API fail: Static options
  - Standard: 50 SEK
  - Express: 100 SEK

### 2. Stock Validation

Backend validerar stock innan checkout-session skapas:
- Om produkt är out of stock: Returnerar error
- Förhindrar checkout för produkter utan tillräcklig lager

### 3. Order Creation

Orders skapas automatiskt i databasen när checkout-session skapas:
- Order ID returneras i response
- Orders kopplas till Stripe checkout session ID

### 4. Promotion Codes Support

Stöd för kampanjpriser via metadata:
- `metadata.campaignId` kan inkluderas för promotion codes
- Backend hanterar kampanjpriser automatiskt

---

## 📊 Exempel-implementation

**Fullständigt exempel:**

```javascript
async function createCheckout(items, customerEmail) {
  // Konvertera cart items
  const checkoutItems = items.map(item => ({
    variantId: item.variantId || `PRODUCT-${item.productId}`,
    quantity: item.quantity,
    stripePriceId: item.campaignPriceId || item.priceId,
    priceSEK: Math.round(item.price * 100)
  }))

  const payload = {
    items: checkoutItems,
    customerEmail: customerEmail,  // Optional
    successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${window.location.origin}/checkout/cancel`
    // recipientAddress är valfritt - kan läggas till för PostNord dynamic rates
  }

  const response = await fetch(`/storefront/${tenant}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const data = await response.json()
  
  if (data.success) {
    // Redirect to Stripe checkout
    window.location.href = data.checkoutUrl
  } else {
    // Handle error
    console.error('Checkout failed:', data.error)
  }
}
```

---

## 🎯 Fördelar med denna lösning

1. **Centraliserad logik**: All checkout-logik i backend customer portal
2. **Shipping options**: Automatiska shipping options via PostNord eller static fallback
3. **Stock validation**: Förhindrar checkout för out-of-stock produkter
4. **Order management**: Orders skapas automatiskt i databasen
5. **Promotion codes**: Stöd för kampanjpriser via metadata
6. **Förbättrad UX**: Användare ser shipping options direkt i Stripe Checkout

---

## 📝 Ytterligare information

- **Endpoint**: `POST /storefront/:tenant/checkout`
- **Tenant**: `glowhairdressing` (lowercase, no spaces)
- **Fil**: `src/services/api.js` - `createCheckoutSession`-funktionen
- **API Config**: `src/config/api.js` - Nytt endpoint i ENDPOINTS
- **Price format**: Alla priser i öre (cents), t.ex. 49900 = 499.00 SEK

---

## 🔄 Migration Notes

**Viktigt för framtida utveckling:**

1. **Variant ID Format**: Nuvarande produkter har inga size/color variants, så vi använder formatet `PRODUCT-{productId}`. Om produkter får variants i framtiden, uppdatera till formatet `PRODUCT-SIZE-COLOR`.

2. **Recipient Address**: För PostNord dynamic rates kan `recipientAddress` läggas till i payload. Nuvarande implementation samlar in shipping address i Stripe Checkout, men för bättre PostNord-integration kan address skickas direkt.

3. **Campaign Prices**: Backend hanterar nu campaign prices via metadata. Frontend skickar fortfarande campaignPriceId i items, men backend kan även hantera promotion codes via metadata.campaignId.

4. **Customer Email**: `customerEmail` är valfritt. Om det inte skickas, Stripe samlar in det i checkout-sessionen.

---

## 🧪 Testning

För att testa implementationen:

1. **Lägg produkter i varukorg** och gå till checkout
2. **Verifiera shipping options** visas i Stripe Checkout (för SE, NO, DK, FI)
3. **Testa stock validation** - försök checkouta out-of-stock produkt (bör returnera error)
4. **Verifiera order creation** - kontrollera att order skapas i databasen
5. **Testa med campaign prices** - verifiera att kampanjpriser fungerar korrekt

---

## ❓ Frågor

Om ni har frågor om implementationen eller behöver mer information, kontakta oss!

---

**Med vänliga hälsningar,**  
Glow Team

