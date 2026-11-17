# Agent guide

A one-page guide to running an open house with the app.

## First time

1. Open the **Open House** app on the tablet.
2. Choose a 4 to 8 digit PIN. You'll need it every time you open the agent tools, so pick one you'll remember.
3. Pick **Blank listing** to enter a real home, or **Sample listing** to look around first.

## Getting into the agent tools

Press and hold **Open house** in the top-left corner for about a second and a half, until the gold ring fills. Then enter your PIN. Visitors won't find this by accident.

The agent tools lock by themselves after 3 minutes without a touch.

## Before each open house

- **Listing:** enter the address, price, beds, baths, square feet, and a short description. Choose a cover photo (a street view of the front works best). Tap **Save listing**.
- **Rooms and photos:** tap **Add a room** for each room, in the order you'd walk someone through the home. Add photos from the tablet's gallery, add captions if you like, and use the arrows to reorder. The star makes a photo the cover. Everything saves automatically.
- **Settings > Kiosk mode:** turn this on so visitors can't leave the app. Android will ask you to confirm the first time.

When you're done, tap **Lock and return**.

## During the open house

Visitors tap **Sign in** or **See the rooms**. If someone walks away mid-form, the screen clears itself and returns to the welcome screen.

## After the open house

Open the agent tools and go to **Sign-ins**.

- **Export to spreadsheet** sends a CSV file by email, Google Drive, or any app on the tablet. It opens in Excel or Google Sheets.
- If a sync server is set up, sign-ins are also copied there automatically whenever the tablet is online. Everything marked **Synced** is safe on the server, and **Clear synced sign-ins** removes the tablet's copies.

## Moving on to a new home

**Settings > Start a new listing** clears the listing and its photos but keeps all sign-ins.

## If something goes wrong

- **Sign-ins say "Waiting":** the tablet can't reach the server right now. They're safe on the tablet and will send when it's back online. Tap **Sync now** to try immediately.
- **"The server rejected the API key":** re-enter the key in **Settings** exactly as it was set on the server.
- **Forgot the PIN:** there is no way to recover it, by design. Clearing the app's storage (or reinstalling it) resets the tablet, which also deletes the sign-ins stored on it. Any sign-ins already marked **Synced** are safe on your server.
