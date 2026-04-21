chrome.runtime.onInstalled.addListener(() => {
  console.log('RBStats extension installed.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_JSON') {
    const fetchOptions = {
        method: request.method || 'GET',
        headers: request.headers || {},
        credentials: 'include'
    };
    
    if (request.body) {
        fetchOptions.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    }

    fetch(request.url, fetchOptions)
      .then(async response => {
        const text = await response.text();
        let json = null;
        try { json = JSON.parse(text); } catch(e) {}
        
        if (!response.ok) {
            return sendResponse({ 
                success: false, 
                status: response.status, 
                error: `HTTP ${response.status}`, 
                data: json 
            });
        }
        sendResponse({ success: true, data: json });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; 
  }
});
