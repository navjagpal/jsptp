chrome.app.runtime.onLaunched.addListener(function(data) {
  // App Launched
  chrome.app.window.create('index.html',
    { id: 'main',
      'width': 1200,
      'height': 800
    }, function(win) {  });
});
