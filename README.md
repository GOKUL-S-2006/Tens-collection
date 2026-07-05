# Ten Collection — jewellery & accessories storefront

A mobile-first storefront: Google sign-in, sellers list products with a photo,
price, description and their GPay QR code, buyers add to cart and "pay" by
scanning the seller's QR and tapping **I've Paid**.

Files:
- `index.html` — all screens (home, product, cart, checkout, sell, account, orders, listings)
- `style.css` — the pink / rose-gold theme
- `app.js` — all logic (Firebase, cart, Cloudinary upload)
- `config.js` — the only file you need to edit

## 1. Cloudinary (required — product photos & QR codes won't upload without this)

1. Sign up free at cloudinary.com and open your **Dashboard**. Copy your **Cloud name**.
2. Go to **Settings → Upload → Upload presets → Add upload preset**.
   - Set **Signing Mode** to **Unsigned** (important — there's no backend server here).
   - Give it a name, e.g. `ten_collection_unsigned`, and save.
3. Open `config.js` and fill in:
   ```js
   const CLOUDINARY_CLOUD_NAME = "your-cloud-name";
   const CLOUDINARY_UPLOAD_PRESET = "ten_collection_unsigned";
   ```

## 2. Firebase — Authentication

You said Google sign-in is already enabled — nothing else to do here. Just make
sure, in **Authentication → Settings → Authorized domains**, that whichever
domain you deploy this to (e.g. `ten-collection.web.app`, or a custom domain)
is in the list. `localhost` is already allowed by default for local testing.

## 3. Firebase — Firestore Database

If you haven't already, go to **Firestore Database → Create database** (start
in production mode) in the Firebase console.

Then paste these **security rules** (Firestore → Rules tab → publish). They let
anyone browse products, but only signed-in users can create listings/orders,
and only the owner can edit or delete their own listing:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /products/{productId} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.sellerId == request.auth.uid;
      allow update, delete: if request.auth != null
                    && resource.data.sellerId == request.auth.uid;
    }

    match /orders/{orderId} {
      allow create: if request.auth != null
                    && request.resource.data.buyerId == request.auth.uid;
      allow read: if request.auth != null
                    && (resource.data.buyerId == request.auth.uid
                        || resource.data.sellerId == request.auth.uid);
      allow update, delete: if false;
    }
  }
}
```

No composite indexes are needed — the app sorts orders/listings on the device
instead of asking Firestore to do it, to avoid the extra setup step.

## 4. Try it locally

Just open `index.html` in a browser — but Google sign-in popups need a real
server origin, not `file://`. Easiest local option:

```bash
cd ten-collection
python3 -m http.server 5500
```
Then visit `http://localhost:5500`.

## 5. Put it online (free)

Easiest: **Firebase Hosting**, since your project already exists.
```bash
npm install -g firebase-tools
firebase login
cd ten-collection
firebase init hosting   # pick your existing "ten-collection" project, public dir = "." 
firebase deploy
```
You'll get a live URL like `https://ten-collection.web.app`. Add that exact
domain under Authentication → Settings → Authorized domains if it isn't
already there.

## How it works, in short

- **Products** live in a Firestore collection called `products` — anyone can
  browse; a signed-in user can add a product (becomes a "seller" automatically,
  no separate signup needed) and can delete their own listings from
  Account → My Listings.
- **Cart** is stored on the device (localStorage), so it's per-device, not
  synced across phones — simplest and fastest for a small store like this.
- **Checkout** groups the cart by seller and shows each seller's own GPay QR
  with the exact amount for their items. Tapping "I've Paid" writes an
  `orders` document — there's no automatic payment verification (GPay has no
  public API for that), so treat it as "buyer confirms they paid"; sellers
  should verify in their own GPay app before shipping.
- **Orders** are visible to the buyer under Account → My Orders.

## Ideas for later (not included, to keep this simple)

- Seller-side "mark as shipped" and order status updates
- Push/email notification to seller when an order comes in
- Product edit screen (currently: delete and re-add)
- Ratings/reviews
