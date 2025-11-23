---
description: Start an HTTPS tunnel for mobile testing
---

# Start HTTPS Tunnel

To test features like Push Notifications and Location Tracking on mobile, you need a secure HTTPS connection. We will use `localtunnel` to create a temporary public URL.

1. Run the following command in a **new terminal window**:

```bash
npx localtunnel --port 3001
```

2. Copy the URL provided (e.g., `https://heavy-zebra-42.loca.lt`).
3. Open this URL on your mobile device.
4. **Important:** The first time you visit, you might see a "Click to Continue" page. Click the button to access the app.
5. Login as usual.

> [!NOTE]
> This URL will change every time you restart the tunnel.
