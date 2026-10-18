# Bookmarklet

Use this when the browser extension can't run on a site, for example when a work Chrome policy
blocks extensions on company domains. A bookmarklet runs as part of the page, so extension
policies don't apply to it.

1. Show the bookmarks bar (Chrome: ⌘⇧B, Safari: ⌘⇧B).
2. Right-click it → **Add page…** (Chrome) / **Add Bookmark** (Safari).
3. Name it **DevTools** and paste this as the URL:

```
javascript:(function(){if(window.SafariDevTools){SafariDevTools.toggle();return;}var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/biratdatta/safari-devtools@v1.5.2/standalone/safari-devtools.js';s.dataset.open='true';s.onerror=function(){alert('Safari DevTools could not load: this site blocks outside scripts (Content-Security-Policy).');};document.head.appendChild(s);})();
```

Click it on any page to open or close the panel. It loads after the page, so logs and requests
from before the click aren't captured; reload and click again early if you need them.

The URL pins version `v1.5.2`. After you publish a new version, create a matching git tag
(`git tag v1.4.2 && git push --tags`) and update the number in the bookmark.
