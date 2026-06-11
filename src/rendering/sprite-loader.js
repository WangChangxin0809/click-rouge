/**
 * sprite-loader.js — Sprite image loading and caching for Click Rouge.
 *
 * Provides a simple async image-loader that caches loaded <img> elements
 * in a Map keyed by sprite name. Supports single loads and batch preloading
 * from a manifest (assets/sprites/manifest.json).
 *
 * All image URLs are relative to the project root (e.g. "assets/sprites/slime/plat_slime_spritesheet.png").
 *
 * Usage:
 *   import { loadSprite, getSprite, preloadSprites } from './rendering/sprite-loader.js';
 *
 *   // Preload all sprites at game start
 *   const manifest = await fetch('assets/sprites/manifest.json').then(r => r.json());
 *   await preloadSprites(manifest);
 *
 *   // Get a loaded sprite
 *   const img = getSprite('slime');
 */

/** @type {Map<string, HTMLImageElement>} */
const spriteCache = new Map();

/**
 * Load a single PNG sprite image and cache it.
 *
 * @param {string} key  — Sprite identifier (e.g. "slime", "bat")
 * @param {string} url  — Image URL relative to project root
 * @returns {Promise<HTMLImageElement>} The loaded Image object
 */
export async function loadSprite(key, url) {
    // Return cached if already loaded
    const cached = spriteCache.get(key);
    if (cached) {
        return cached;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            spriteCache.set(key, img);
            resolve(img);
        };
        img.onerror = (err) => {
            console.error(`[SpriteLoader] Failed to load sprite "${key}" from "${url}"`);
            reject(new Error(`Failed to load sprite: ${key}`));
        };
        img.src = url;
    });
}

/**
 * Get a cached sprite image by key.
 *
 * @param {string} key — Sprite identifier
 * @returns {HTMLImageElement|undefined} The cached image, or undefined if not loaded
 */
export function getSprite(key) {
    return spriteCache.get(key);
}

/**
 * Batch preload all sprites defined in a manifest object.
 *
 * The manifest should be an object where each key is a sprite name and each
 * value has a `file` property with the relative path to the PNG.
 *
 * @param {Object<string, { file: string }>} manifest — Sprite manifest
 * @returns {Promise<void>} Resolves when all sprites are loaded
 */
export async function preloadSprites(manifest) {
    const promises = [];

    for (const [key, entry] of Object.entries(manifest)) {
        if (!entry.file) {
            console.warn(`[SpriteLoader] Skipping "${key}": no file path`);
            continue;
        }
        const url = `assets/sprites/${entry.file}`;
        promises.push(loadSprite(key, url));
    }

    try {
        await Promise.all(promises);
        console.log(`[SpriteLoader] Preloaded ${promises.length} sprites.`);
    } catch (err) {
        console.error('[SpriteLoader] Some sprites failed to preload:', err);
        throw err;
    }
}

/**
 * Check whether a sprite has been loaded and cached.
 *
 * @param {string} key — Sprite identifier
 * @returns {boolean} True if the sprite is cached
 */
export function hasSprite(key) {
    return spriteCache.has(key);
}
