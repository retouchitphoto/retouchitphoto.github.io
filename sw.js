importScripts('/retouchit/sw-toolbox.js');

const config = {
  offlinePage: '/youre-offline/'
};

config.filesToCache = [
  '/',
  config.offlinePage,
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-60x60.png',
  '/apple-touch-icon-60x60-precomposed.png',
  '/apple-touch-icon-76x76.png',
  '/apple-touch-icon-76x76-precomposed.png',
  '/apple-touch-icon-120x120.png',
  '/apple-touch-icon-120x120-precomposed.png',
  '/apple-touch-icon-152x152.png',
  '/apple-touch-icon-152x152-precomposed.png',
  '/apple-touch-icon-180x180.png',
  '/apple-touch-icon-180x180-precomposed.png',
  '/apple-touch-icon-precomposed.png',
  '/browserconfig.xml',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/manifest.json',
  '/mstile-70x70.png',
  '/mstile-150x150.png',
  '/mstile-310x150.png',
  '/mstile-310x310.png',
  '/safari-pinned-tab.svg',
  '/retouchit/hamburger.svg',
  '/retouchit/hamburger-menu.svg',
  '/retouchit/logo.svg'
];

/**
 * Generates a placeholder SVG image of the given size.
 */
function offlineImage(name, width, height) {
  return `<?xml version="1.0"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" version="1.1">
  <g fill="none" fill-rule="evenodd"><path fill="#F8BBD0" d="M0 0h${width}v${height}H0z"/></g>
  <text text-anchor="middle" x="${Math.floor(width / 2)}" y="${Math.floor(height / 2)}">image offline (${name})</text>
<style><![CDATA[
text{
  font: 48px Roboto, Verdana, Helvetica, Arial, sans-serif;
}
]]></style>
</svg>`;
}
/**
 * Returns true if the Accept header contains the given content type string.
 */
function requestAccepts(request, contentType) {
  return request.headers.get('Accept').indexOf(contentType) != -1;
}

/**
 * - one-behind caching 
 * - shows offline page
 * - generates placeholder image for unavailable images
 */
function retouchitPhotoHandler(request, values) {
  // for samples show offline page if offline and samples are not cached
  if (requestAccepts(request, 'text/html')) {
    // never use cached version for AMP CORS requests (e.g. amp-live-list) or pages that shouldn't be cached
    if (request.url.indexOf("__amp_source_origin") != -1) {
      return toolbox.networkOnly(request, values);
    }
    // network first, we always want to get the latest 
    return toolbox.networkFirst(request, values).catch(function() {
      return toolbox.cacheOnly(new Request(config.offlinePage), values)
        .then(function(response) {
          return response || new Response('You\'re offline. Sorry.', {
            status: 500,
            statusText: 'Offline Page Missing'
          });
        });
    });
  }
  // always try to load images from the cache first
  // fallback to placeholder SVG image if offline and image not available
  if (requestAccepts(request, 'image/')) {
    return toolbox.cacheFirst(request, values).catch(function() {
      const url = request.url;
      const fileName = url.substring(url.lastIndexOf('/') + 1);
      // TODO use correct image dimensions
      return new Response(offlineImage(fileName, 1080, 610),
          { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    });
  } else {
    // cache first for all other requests
    return toolbox.cacheFirst(request, values);
  }
}

toolbox.options.debug = false;
toolbox.router.default = toolbox.networkFirst;
toolbox.router.get('/(.*)', retouchitPhotoHandler, {origin: self.location.origin});
// network first amp runtime 
toolbox.router.get('/(.*)', toolbox.networkFirst, {origin: 'https://cdn.ampproject.org'});

toolbox.precache(config.filesToCache);

// Cache the page registering the service worker. Without this, the
// "first" page the user visits is only cached on the second visit,
// since the first load is uncontrolled.
toolbox.precache(
  clients.matchAll({includeUncontrolled: true}).then(l => {
    return l.map(c => c.url);
  })
);

// Claim clients so that the very first page load is controlled by a service
// worker. (Important for responding correctly in offline state.)
self.addEventListener('activate', () => self.clients.claim());

// Make sure the SW the page we register() is the service we use.
self.addEventListener('install', () => self.skipWaiting());