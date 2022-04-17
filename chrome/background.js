chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, { url }) => {
    if (changeInfo.status !== 'complete') return;

    if (!/https:\/\/.+roblox.com\/.+\/game-instances/g.test(url)) return;

    chrome.scripting.insertCSS({ target: { tabId }, files: ['styles.css'] });
    chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
});

const func = (place, id) => Roblox.GameLauncher.joinGameInstance(place, id)
chrome.runtime.onMessage.addListener(({ message }, { tab }) => chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args: [message.place, message.id], world: 'MAIN' }));