# Iubenda Fallback

This project provides CSS and JavaScript for displaying a fallback message when an embedded element is blocked by Iubenda consent settings.

## Files

- `iubenda-fallback.css` contains the fallback component styles.
- `iubenda-fallback.js` contains the fallback behavior.

Both files are required for the fallback to work and display correctly.

## Installation

### CSS

Add the following jsDelivr CDN link inside the page's `<head>`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/marketer-UX/iubenda-fallback@main/iubenda-fallback.css">
```

The stylesheet should load before the page content is rendered.

### JavaScript

Add the following jsDelivr CDN script near the end of the page, before the closing `</body>` tag:

```html
<script src="https://cdn.jsdelivr.net/gh/marketer-UX/iubenda-fallback@main/iubenda-fallback.js"></script>
```

Make sure the Iubenda scripts and configuration required by the website are also present.

## Where to add the code in Webflow

Choose the location based on where the fallback is needed:

- **One page only:** add the CSS link and JavaScript script to that page's custom code settings. Put the CSS link in the page's **Inside `<head>` tag** field and the JavaScript script in the **Before `</body>` tag** field.
- **Entire project:** add the files in **Project Settings → Custom Code**. Put the CSS link in **Head code** and the JavaScript script in **Footer code**.

Avoid loading the same file both globally and at page level. Include each file only once on a page.

## Recommended workflow

1. Add the CSS and JavaScript in the appropriate page or project settings.
2. Publish the website to the Webflow test/staging domain first.
3. Test the affected embeds with consent granted, denied, and not yet selected.
4. Check the layout on desktop and mobile and confirm that the browser console has no related errors.
5. If everything works as expected, publish the changes to the production domain or domains.

Do not publish directly to production without testing the integration on the staging domain first.
