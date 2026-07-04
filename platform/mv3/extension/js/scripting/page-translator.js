/*******************************************************************************

    ZuBlock visual page translator

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

*/

(( ) => {

'use strict';

/******************************************************************************/

const textOriginals = new WeakMap();
const attrOriginals = new WeakMap();
const pendingRoots = new Set();

const ignoredTags = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS',
    'CODE', 'PRE', 'KBD', 'SAMP',
]);

const translatedAttrs = [ 'placeholder', 'title', 'aria-label' ];
const buttonInputTypes = new Set([ 'button', 'submit', 'reset' ]);

let observer;
let state = {
    enabled: false,
    targetLanguage: 'pt',
    saveTranslations: false,
};
let timer;
let busy = false;
const nativeTranslators = new Map();

/******************************************************************************/

function sendRuntimeMessage(message) {
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage(message, response => {
                if ( chrome.runtime.lastError ) {
                    resolve();
                    return;
                }
                resolve(response);
            });
        } catch {
            resolve();
        }
    });
}

function localRead(key) {
    return new Promise(resolve => {
        try {
            chrome.storage.local.get(key, bin => {
                if ( chrome.runtime.lastError ) {
                    resolve();
                    return;
                }
                resolve(bin?.[key]);
            });
        } catch {
            resolve();
        }
    });
}

function localWrite(key, value) {
    return new Promise(resolve => {
        try {
            chrome.storage.local.set({ [key]: value }, ( ) => {
                resolve(chrome.runtime.lastError ? false : true);
            });
        } catch {
            resolve(false);
        }
    });
}

async function readLocalConfig() {
    return localRead('zublock.pageTranslator');
}

/******************************************************************************/

function normalizeText(text) {
    if ( typeof text !== 'string' ) { return ''; }
    return text.replace(/\s+/g, ' ').trim();
}

function sourceLanguageFromTarget(targetLanguage) {
    return targetLanguage === 'pt' ? 'en' : 'pt';
}

function hasPortugueseSignal(text) {
    return /[áàâãéêíóôõúç]/i.test(text) ||
        /\b(aos?|as|com|configura(?:ção|ções)|da|das|de|do|dos|em|entrar|mais|não|para|por|salvar|uma?|você)\b/i.test(text);
}

function hasEnglishSignal(text) {
    return /\b(a|about|and|for|from|in|is|learn|log|more|of|on|save|settings|sign|the|this|to|with|you)\b/i.test(text);
}

function shouldTranslateText(text, targetLanguage) {
    const normalized = normalizeText(text);
    if ( isUsefulText(normalized) === false ) { return false; }
    const hasPT = hasPortugueseSignal(normalized);
    const hasEN = hasEnglishSignal(normalized);
    if ( targetLanguage === 'pt' && hasPT && hasEN === false ) { return false; }
    if ( targetLanguage === 'en' && hasEN && hasPT === false ) { return false; }
    return true;
}

function isUsefulText(text) {
    const normalized = normalizeText(text);
    if ( normalized.length < 2 ) { return false; }
    if ( /^[\d\s.,:;!?()[\]{}'"%+\-/*=<>|]+$/.test(normalized) ) {
        return false;
    }
    return /[A-Za-z\u00c0-\u024f]/.test(normalized);
}

function ignoredElement(element) {
    if ( element instanceof Element === false ) { return true; }
    if ( ignoredTags.has(element.localName.toUpperCase()) ) { return true; }
    if ( element.closest('script,style,noscript,template,svg,canvas,code,pre,kbd,samp') ) {
        return true;
    }
    if ( element.closest('[contenteditable=""],[contenteditable="true"]') ) {
        return true;
    }
    return false;
}

function applyWhitespaceShape(before, translated) {
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(before);
    if ( match === null ) { return translated; }
    return `${match[1]}${translated}${match[3]}`;
}

function applyCaseShape(before, translated) {
    const normalized = normalizeText(before);
    if ( normalized.length < 3 || normalized.length > 40 ) { return translated; }
    if ( /[a-z\u00e0-\u024f]/.test(normalized) === false &&
         /[A-Z\u00c0-\u024f]/.test(normalized) ) {
        return translated.toLocaleUpperCase();
    }
    if ( /^[A-Z\u00c0-\u024f][^.!?]{0,38}$/.test(normalized) ) {
        return translated.charAt(0).toLocaleUpperCase() + translated.slice(1);
    }
    return translated;
}

async function readTranslationCache(targetLanguage) {
    const cache = await localRead(`zublock.pageTranslator.cache.${targetLanguage}`);
    return cache instanceof Object && Array.isArray(cache) === false
        ? cache
        : {};
}

async function writeTranslationCache(targetLanguage, cache) {
    const entries = Object.entries(cache);
    if ( entries.length > 2000 ) {
        entries.splice(0, entries.length - 2000);
    }
    return localWrite(
        `zublock.pageTranslator.cache.${targetLanguage}`,
        Object.fromEntries(entries)
    );
}

async function translateOneLocally(text, targetLanguage, cache) {
    const normalized = normalizeText(text);
    if ( normalized === '' ) { return text; }
    if ( shouldTranslateText(normalized, targetLanguage) === false ) {
        return normalized;
    }
    if ( cache instanceof Object && cache[normalized] ) {
        return cache[normalized];
    }

    let translated = await translateWithNativeAPI(normalized, targetLanguage);
    if ( translated === undefined ) {
        translated = await translateWithGoogleEndpoint(normalized, targetLanguage);
    }

    if ( cache instanceof Object ) {
        cache[normalized] = translated;
    }
    return translated;
}

async function translateWithNativeAPI(text, targetLanguage) {
    if ( 'Translator' in self === false ) { return; }
    const sourceLanguage = sourceLanguageFromTarget(targetLanguage);
    const cacheKey = `${sourceLanguage}:${targetLanguage}`;
    try {
        let translator = nativeTranslators.get(cacheKey);
        if ( translator === undefined ) {
            const options = { sourceLanguage, targetLanguage };
            const availability = await self.Translator.availability(options);
            if ( availability === 'unavailable' ) { return; }
            translator = await self.Translator.create(options);
            nativeTranslators.set(cacheKey, translator);
        }
        const translated = await translator.translate(text);
        if ( typeof translated === 'string' && translated.trim() !== '' ) {
            return translated.trim();
        }
    } catch {
    }
}

async function translateWithGoogleEndpoint(text, targetLanguage) {
    const sourceLanguage = sourceLanguageFromTarget(targetLanguage);

    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', sourceLanguage);
    url.searchParams.set('tl', targetLanguage);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);

    let translated = text;
    try {
        const response = await fetch(url.href);
        if ( response.ok ) {
            const data = await response.json();
            if ( Array.isArray(data?.[0]) ) {
                translated = data[0]
                    .map(segment => Array.isArray(segment) ? segment[0] : '')
                    .join('')
                    .trim() || normalized;
            }
        }
    } catch {
    }
    return translated;
}

async function translateTextsLocally(texts, targetLanguage, saveTranslations) {
    const normalizedTexts = texts.map(text => normalizeText(text));
    const uniqueTexts = Array.from(new Set(normalizedTexts))
        .filter(text => shouldTranslateText(text, targetLanguage));
    const cache = saveTranslations
        ? await readTranslationCache(targetLanguage)
        : {};
    const translatedByText = new Map();
    let index = 0;
    const workers = Array.from({ length: 4 }, async ( ) => {
        for (;;) {
            const text = uniqueTexts[index++];
            if ( text === undefined ) { break; }
            const translated = await translateOneLocally(text, targetLanguage, cache);
            translatedByText.set(text, applyCaseShape(text, translated));
        }
    });
    await Promise.all(workers);
    if ( saveTranslations ) {
        await writeTranslationCache(targetLanguage, cache);
    }
    return normalizedTexts.map(text => translatedByText.get(text) || text);
}

function rememberAttr(element, attrName) {
    let originals = attrOriginals.get(element);
    if ( originals === undefined ) {
        originals = new Map();
        attrOriginals.set(element, originals);
    }
    if ( originals.has(attrName) === false ) {
        originals.set(attrName, element.getAttribute(attrName));
    }
    return originals.get(attrName);
}

function collectTextEntries(root, entries) {
    const doc = root.ownerDocument || document;
    const walker = doc.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;
                if ( ignoredElement(parent) ) {
                    return NodeFilter.FILTER_REJECT;
                }
                return isUsefulText(node.nodeValue)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            },
        }
    );
    for (;;) {
        const node = walker.nextNode();
        if ( node === null ) { break; }
        const original = textOriginals.get(node) || node.nodeValue;
        if ( textOriginals.has(node) === false ) {
            textOriginals.set(node, original);
        }
        entries.push({
            type: 'text',
            node,
            original,
        });
    }
}

function collectAttributeEntries(root, entries) {
    const elements = [];
    if ( root.nodeType === Node.ELEMENT_NODE ) {
        elements.push(root);
    }
    if ( typeof root.querySelectorAll === 'function' ) {
        elements.push(...root.querySelectorAll('[placeholder],[title],[aria-label],input,button'));
    }

    for ( const element of elements ) {
        if ( ignoredElement(element) ) { continue; }
        for ( const attrName of translatedAttrs ) {
            if ( element.hasAttribute(attrName) === false ) { continue; }
            const original = rememberAttr(element, attrName);
            if ( isUsefulText(original) === false ) { continue; }
            entries.push({
                type: 'attr',
                element,
                attrName,
                original,
            });
        }
        if ( element.localName === 'input' ) {
            const type = (element.getAttribute('type') || 'text').toLowerCase();
            if ( buttonInputTypes.has(type) === false ) { continue; }
            const original = rememberAttr(element, 'value');
            if ( isUsefulText(original) === false ) { continue; }
            entries.push({
                type: 'value',
                element,
                original,
            });
        }
    }
}

function collectEntries(root) {
    const entries = [];
    if ( root === null ) { return entries; }
    if ( root.nodeType === Node.TEXT_NODE ) {
        const parent = root.parentElement;
        if ( ignoredElement(parent) === false && isUsefulText(root.nodeValue) ) {
            const original = textOriginals.get(root) || root.nodeValue;
            if ( textOriginals.has(root) === false ) {
                textOriginals.set(root, original);
            }
            entries.push({ type: 'text', node: root, original });
        }
        return entries;
    }
    if ( root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE ) {
        return entries;
    }
    collectTextEntries(root, entries);
    collectAttributeEntries(root, entries);
    return entries;
}

async function translateEntries(entries) {
    if ( entries.length === 0 ) { return; }
    const targetLanguage = state.targetLanguage;
    const saveTranslations = state.saveTranslations;
    const texts = entries.map(entry => entry.original);
    let translatedTexts = await sendRuntimeMessage({
        what: 'translatePageTexts',
        texts,
        targetLanguage,
        saveTranslations,
    }) || [];
    if (
        Array.isArray(translatedTexts) === false ||
        translatedTexts.length !== texts.length
    ) {
        translatedTexts = await translateTextsLocally(
            texts,
            targetLanguage,
            saveTranslations
        );
    }
    if ( state.enabled !== true ) { return; }
    if ( state.targetLanguage !== targetLanguage ) { return; }
    if ( Array.isArray(translatedTexts) === false ) { return; }

    for ( let i = 0; i < entries.length; i++ ) {
        const entry = entries[i];
        const translated = translatedTexts[i];
        if ( typeof translated !== 'string' || translated === '' ) { continue; }
        if ( entry.type === 'text' ) {
            if ( entry.node.isConnected === false ) { continue; }
            entry.node.nodeValue = applyWhitespaceShape(entry.original, translated);
        } else if ( entry.type === 'attr' ) {
            if ( entry.element.isConnected === false ) { continue; }
            entry.element.setAttribute(entry.attrName, translated);
        } else if ( entry.type === 'value' ) {
            if ( entry.element.isConnected === false ) { continue; }
            entry.element.value = translated;
        }
    }
}

function schedule(root = document.body || document.documentElement) {
    if ( state.enabled !== true ) { return; }
    if ( root === null ) { return; }
    pendingRoots.add(root);
    if ( timer !== undefined ) { return; }
    timer = self.setTimeout(processPending, 250);
}

async function processPending() {
    timer = undefined;
    if ( busy || state.enabled !== true ) { return; }
    busy = true;
    try {
        const roots = Array.from(pendingRoots);
        pendingRoots.clear();
        const entries = [];
        for ( const root of roots ) {
            entries.push(...collectEntries(root));
            if ( entries.length >= 700 ) { break; }
        }
        await translateEntries(entries.slice(0, 700));
    } finally {
        busy = false;
        if ( pendingRoots.size !== 0 && state.enabled ) {
            schedule();
        }
    }
}

function startObserver() {
    if ( observer !== undefined ) { return; }
    observer = new MutationObserver(mutations => {
        if ( state.enabled !== true ) { return; }
        for ( const mutation of mutations ) {
            if ( mutation.type === 'childList' ) {
                for ( const node of mutation.addedNodes ) {
                    schedule(node);
                }
            } else if ( mutation.type === 'characterData' ) {
                const node = mutation.target;
                if ( textOriginals.has(node) === false ) {
                    schedule(node);
                }
            } else if ( mutation.type === 'attributes' ) {
                schedule(mutation.target);
            }
        }
    });
    observer.observe(document.documentElement, {
        attributeFilter: [ ...translatedAttrs, 'value' ],
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
    });
}

function stopObserver() {
    observer?.disconnect();
    observer = undefined;
}

function restoreOriginals() {
    stopObserver();
    pendingRoots.clear();
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
    for (;;) {
        const node = walker.nextNode();
        if ( node === null ) { break; }
        if ( textOriginals.has(node) ) {
            node.nodeValue = textOriginals.get(node);
        }
    }
    for ( const element of document.querySelectorAll('[placeholder],[title],[aria-label],input') ) {
        const originals = attrOriginals.get(element);
        if ( originals === undefined ) { continue; }
        for ( const [ attrName, value ] of originals ) {
            if ( attrName === 'value' ) {
                element.value = value;
            } else if ( value === null ) {
                element.removeAttribute(attrName);
            } else {
                element.setAttribute(attrName, value);
            }
        }
    }
}

function applyConfig(config = {}) {
    const wasEnabled = state.enabled === true;
    state = {
        enabled: config.enabled === true,
        targetLanguage: config.targetLanguage === 'en' ? 'en' : 'pt',
        saveTranslations: config.saveTranslations === true,
    };
    if ( state.enabled ) {
        startObserver();
        schedule();
    } else if ( wasEnabled ) {
        restoreOriginals();
    }
}

/******************************************************************************/

chrome.runtime.onMessage.addListener((msg, sender, callback) => {
    if ( msg?.what === 'pageTranslatorPing' ) {
        callback?.({
            alive: true,
            enabled: state.enabled,
            targetLanguage: state.targetLanguage,
            saveTranslations: state.saveTranslations,
            textCount: collectEntries(document.body || document.documentElement).length,
        });
        return;
    }
    if ( msg?.what === 'pageTranslatorConfigChanged' ) {
        applyConfig(msg.config);
        callback?.(true);
    }
});

Promise.all([
    readLocalConfig(),
    sendRuntimeMessage({ what: 'getPageTranslatorConfig' }),
]).then(results => {
    applyConfig(results.find(config => config instanceof Object));
}).catch(( ) => { });

/******************************************************************************/

}) ();
