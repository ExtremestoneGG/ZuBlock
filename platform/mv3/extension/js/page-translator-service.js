/*******************************************************************************

    ZuBlock page translator helper

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

*/

import {
    browser,
    localRead,
    localWrite,
} from './ext.js';

/******************************************************************************/

const STORAGE_KEY = 'zublock.pageTranslator';
const supportedLanguages = new Set([ 'en', 'pt' ]);
const translationCache = new Map();
const nativeTranslators = new Map();

const defaultConfig = {
    enabled: false,
    targetLanguage: 'pt',
    saveTranslations: false,
};

/******************************************************************************/

function normalizeConfig(config = {}) {
    const normalized = { ...defaultConfig };
    if ( config instanceof Object ) {
        normalized.enabled = config.enabled === true;
        normalized.saveTranslations = config.saveTranslations === true;
        if ( supportedLanguages.has(config.targetLanguage) ) {
            normalized.targetLanguage = config.targetLanguage;
        }
    }
    return normalized;
}

export async function getPageTranslatorConfig() {
    return normalizeConfig(await localRead(STORAGE_KEY));
}

export async function setPageTranslatorConfig(patch = {}) {
    const before = await getPageTranslatorConfig();
    const after = normalizeConfig({ ...before, ...patch });
    await localWrite(STORAGE_KEY, after);
    return after;
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
    if ( normalized.length < 2 ) { return false; }
    if ( /^[\d\s.,:;!?()[\]{}'"%+\-/*=<>|]+$/.test(normalized) ) {
        return false;
    }
    if ( /[A-Za-z\u00c0-\u024f]/.test(normalized) === false ) {
        return false;
    }
    const hasPT = hasPortugueseSignal(normalized);
    const hasEN = hasEnglishSignal(normalized);
    if ( targetLanguage === 'pt' && hasPT && hasEN === false ) { return false; }
    if ( targetLanguage === 'en' && hasEN && hasPT === false ) { return false; }
    return true;
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

async function readPersistentCache(targetLanguage) {
    const cache = await localRead(`zublock.pageTranslator.cache.${targetLanguage}`);
    return cache instanceof Object && Array.isArray(cache) === false
        ? cache
        : {};
}

async function writePersistentCache(targetLanguage, cache) {
    const entries = Object.entries(cache);
    if ( entries.length > 2000 ) {
        entries.splice(0, entries.length - 2000);
    }
    await localWrite(
        `zublock.pageTranslator.cache.${targetLanguage}`,
        Object.fromEntries(entries)
    );
}

async function translateOne(text, targetLanguage, persistentCache) {
    const normalized = normalizeText(text);
    if ( normalized === '' ) { return text; }
    if ( shouldTranslateText(normalized, targetLanguage) === false ) {
        return normalized;
    }

    const cacheKey = `${targetLanguage}\n${normalized}`;
    if ( translationCache.has(cacheKey) ) {
        return translationCache.get(cacheKey);
    }
    if ( persistentCache instanceof Object && persistentCache[normalized] ) {
        translationCache.set(cacheKey, persistentCache[normalized]);
        return persistentCache[normalized];
    }

    let translated = await translateWithNativeAPI(normalized, targetLanguage);
    if ( translated === undefined ) {
        translated = await translateWithGoogleEndpoint(normalized, targetLanguage);
    }

    translationCache.set(cacheKey, translated);
    if ( persistentCache instanceof Object ) {
        persistentCache[normalized] = translated;
    }
    if ( translationCache.size > 5000 ) {
        translationCache.delete(translationCache.keys().next().value);
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

export async function translatePageTexts(texts, targetLanguage, saveTranslations = false) {
    if ( supportedLanguages.has(targetLanguage) === false ) { return []; }
    if ( Array.isArray(texts) === false ) { return []; }

    const normalizedTexts = texts.slice(0, 700).map(a => normalizeText(a));
    const uniqueTexts = Array.from(new Set(normalizedTexts))
        .filter(text => shouldTranslateText(text, targetLanguage));
    const translatedByText = new Map();
    const persistentCache = saveTranslations
        ? await readPersistentCache(targetLanguage)
        : undefined;

    let index = 0;
    const workers = Array.from({ length: 4 }, async ( ) => {
        for (;;) {
            const text = uniqueTexts[index++];
            if ( text === undefined ) { break; }
            const translated = await translateOne(text, targetLanguage, persistentCache);
            translatedByText.set(text, applyCaseShape(text, translated));
        }
    });
    await Promise.all(workers);

    if ( saveTranslations ) {
        await writePersistentCache(targetLanguage, persistentCache);
    }

    return normalizedTexts.map(text => translatedByText.get(text) || text);
}

export async function broadcastPageTranslatorConfig(config) {
    const tabs = await browser.tabs.query({
        url: [ 'http://*/*', 'https://*/*' ],
    }).catch(( ) => []);
    await Promise.all(tabs.map(tab => {
        if ( typeof tab.id !== 'number' ) { return; }
        return browser.tabs.sendMessage(tab.id, {
            what: 'pageTranslatorConfigChanged',
            config,
        }).catch(( ) => { });
    }));
}

/******************************************************************************/
