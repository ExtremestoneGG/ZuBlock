/*******************************************************************************

    ZuBlock - Twitch helper
    Copyright (C) 2026 ZuBlock contributors

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

*******************************************************************************/

// The Chromium PAC approach is adapted from TTV LOL PRO's GPL-3.0 proxy flow:
// https://github.com/younesaassila/ttv-lol-pro

/******************************************************************************/

const STORAGE_KEY = 'zublockTwitchShieldEnabled';
const DEFAULT_PROXY = 'chromium.api.cdn-perfprod.com:2023';

const twitchHostnames = new Set([ 'www.twitch.tv', 'm.twitch.tv' ]);
const openedTwitchTabs = new Set();

let enabled = true;
let active = false;
let initialized = false;

const proxyAPI = typeof chrome === 'object' &&
                 chrome !== null &&
                 chrome.proxy instanceof Object
    ? chrome.proxy
    : undefined;

const canControlProxy = proxyAPI instanceof Object &&
                        proxyAPI.settings instanceof Object;

/******************************************************************************/

const hostnameFromURL = url => {
    if ( typeof url !== 'string' || url === '' ) { return ''; }
    try {
        return new URL(url).hostname.toLowerCase();
    }
    catch {
    }
    return '';
};

const isTwitchURL = url => twitchHostnames.has(hostnameFromURL(url));

const pacScriptData = proxy => `
function FindProxyForURL(url, host) {
    if (/^passport\\.twitch\\.tv$/i.test(host)) {
        return "PROXY ${proxy}; DIRECT";
    }
    if (/^usher\\.ttvnw\\.net$/i.test(host)) {
        return "PROXY ${proxy}; DIRECT";
    }
    if (/^(?:[a-z0-9-]+\\.playlist\\.(?:live-video|ttvnw)\\.net|video-weaver\\.[a-z0-9-]+\\.hls\\.ttvnw\\.net)$/i.test(host)) {
        return "PROXY ${proxy}; DIRECT";
    }
    if (/^gql\\.twitch\\.tv$/i.test(host)) {
        return "PROXY ${proxy}; DIRECT";
    }
    return "DIRECT";
}
`;

const setProxy = () => {
    if ( canControlProxy === false ) { return; }
    proxyAPI.settings.set({
        value: {
            mode: 'pac_script',
            pacScript: {
                data: pacScriptData(DEFAULT_PROXY),
            },
        },
        scope: 'regular',
    });
    active = true;
};

const clearProxy = () => {
    if ( canControlProxy === false ) { return; }
    proxyAPI.settings.clear({ scope: 'regular' });
    active = false;
};

const refreshProxyState = () => {
    if ( enabled && openedTwitchTabs.size !== 0 ) {
        setProxy();
    } else if ( active ) {
        clearProxy();
    }
};

const rememberTab = tab => {
    if ( tab instanceof Object === false ) { return; }
    const { id } = tab;
    if ( typeof id !== 'number' ) { return; }
    const url = tab.url || tab.pendingUrl || '';
    if ( isTwitchURL(url) ) {
        openedTwitchTabs.add(id);
    } else {
        openedTwitchTabs.delete(id);
    }
};

const loadEnabledState = async ( ) => {
    const bin = await vAPI.storage.get({ [STORAGE_KEY]: true });
    enabled = bin[STORAGE_KEY] !== false;
};

const initializeOpenTabs = async ( ) => {
    openedTwitchTabs.clear();
    const tabs = await vAPI.tabs.query({
        url: [
            'https://www.twitch.tv/*',
            'https://m.twitch.tv/*',
        ],
    });
    for ( const tab of tabs ) {
        rememberTab(tab);
    }
};

const initListeners = () => {
    browser.tabs.onCreated.addListener(tab => {
        rememberTab(tab);
        refreshProxyState();
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if ( changeInfo.url === undefined && changeInfo.status !== 'loading' ) {
            return;
        }
        rememberTab(Object.assign({ id: tabId }, tab));
        refreshProxyState();
    });

    browser.tabs.onRemoved.addListener(tabId => {
        openedTwitchTabs.delete(tabId);
        refreshProxyState();
    });

    if ( browser.tabs.onReplaced instanceof Object ) {
        browser.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
            openedTwitchTabs.delete(removedTabId);
            vAPI.tabs.get(addedTabId).then(tab => {
                rememberTab(tab);
                refreshProxyState();
            });
        });
    }
};

/******************************************************************************/

export const getTwitchShieldPopupData = hostname => ({
    active,
    enabled,
    available: canControlProxy,
    isTwitch: twitchHostnames.has(hostname),
    proxy: DEFAULT_PROXY,
});

export const setTwitchShieldEnabled = async state => {
    enabled = state !== false;
    await vAPI.storage.set({ [STORAGE_KEY]: enabled });
    refreshProxyState();
    return enabled;
};

export const initTwitchShield = async ( ) => {
    if ( initialized ) { return; }
    initialized = true;
    if ( vAPI.webextFlavor.soup.has('chromium') === false ) { return; }
    await loadEnabledState();
    initListeners();
    await initializeOpenTabs();
    refreshProxyState();
};

/******************************************************************************/
