self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
  });
  
  self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
  });
  
  // Fetch event to cache assets
  self.addEventListener('fetch', (event) => {
    event.respondWith(
      caches.open('my-cache').then((cache) => {
        return cache.match(event.request).then((response) => {
          return response || fetch(event.request).then((response) => {
            // Cache the new response
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  });
  