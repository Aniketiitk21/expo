const JPEG_MIME_TYPE = 'image/jpeg';
const JPEG_TIME_EPSILON_SECONDS = 0.001;
const HAVE_CURRENT_DATA = 2;
export default {
    async getThumbnail(sourceFilename, options = {}) {
        const requestedQuality = normalizeQuality(options.quality);
        const resolvedSource = await resolveVideoSourceAsync(sourceFilename, options.headers ?? {});
        const video = createVideoElement(resolvedSource.uri, resolvedSource.shouldUseAnonymousCors);
        try {
            await waitForVideoMetadataAsync(video);
            const requestedTimeSeconds = normalizeRequestedTimeSeconds(options.time);
            const seekTime = clampSeekTimeToDuration(requestedTimeSeconds, video.duration);
            await waitForVideoFrameAsync(video, seekTime);
            return renderThumbnail(video, requestedQuality);
        }
        finally {
            cleanupVideoElement(video);
            resolvedSource.release();
        }
    },
};
async function resolveVideoSourceAsync(sourceFilename, headers) {
    if (Object.keys(headers).length === 0) {
        return {
            uri: sourceFilename,
            release: () => { },
            shouldUseAnonymousCors: isHttpSource(sourceFilename),
        };
    }
    if (!isHttpSource(sourceFilename)) {
        return {
            uri: sourceFilename,
            release: () => { },
            shouldUseAnonymousCors: false,
        };
    }
    const response = await fetch(sourceFilename, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch the video source. Received HTTP ${response.status}.`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    return {
        uri: objectUrl,
        release: () => URL.revokeObjectURL(objectUrl),
        shouldUseAnonymousCors: false,
    };
}
function createVideoElement(sourceUri, shouldUseAnonymousCors) {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    if (shouldUseAnonymousCors) {
        video.crossOrigin = 'anonymous';
    }
    video.src = sourceUri;
    video.load();
    return video;
}
async function waitForVideoMetadataAsync(video) {
    if (video.readyState >= HAVE_CURRENT_DATA) {
        return;
    }
    await waitForEventAsync(video, 'loadeddata');
}
async function waitForVideoFrameAsync(video, targetTimeSeconds) {
    if (video.readyState < HAVE_CURRENT_DATA) {
        await waitForEventAsync(video, 'loadeddata');
    }
    if (targetTimeSeconds <= 0 ||
        Math.abs(video.currentTime - targetTimeSeconds) < JPEG_TIME_EPSILON_SECONDS) {
        return;
    }
    const seekPromise = waitForEventAsync(video, 'seeked');
    video.currentTime = targetTimeSeconds;
    await seekPromise;
}
function renderThumbnail(video, quality) {
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        throw new Error('Failed to generate a thumbnail because the video dimensions are unavailable.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context == null) {
        throw new Error('Failed to generate a thumbnail because the canvas context is unavailable.');
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
        return {
            uri: canvas.toDataURL(JPEG_MIME_TYPE, quality),
            width: canvas.width,
            height: canvas.height,
        };
    }
    catch {
        throw new Error('Failed to generate a thumbnail because the video source is not readable on web. Make sure the source is same-origin or CORS-enabled.');
    }
}
function cleanupVideoElement(video) {
    try {
        video.pause();
        video.removeAttribute('src');
        video.load();
    }
    catch {
        // Best-effort cleanup to release browser media resources.
    }
}
function normalizeQuality(quality) {
    if (typeof quality !== 'number' || !Number.isFinite(quality)) {
        return 1;
    }
    return Math.min(1, Math.max(0, quality));
}
function normalizeRequestedTimeSeconds(timeMs) {
    if (typeof timeMs !== 'number' || !Number.isFinite(timeMs)) {
        return 0;
    }
    return Math.max(0, timeMs) / 1000;
}
function clampSeekTimeToDuration(requestedTimeSeconds, durationSeconds) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return requestedTimeSeconds;
    }
    return Math.min(requestedTimeSeconds, Math.max(durationSeconds - JPEG_TIME_EPSILON_SECONDS, 0));
}
function isHttpSource(sourceFilename) {
    try {
        const url = new URL(sourceFilename, window.location.href);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function waitForEventAsync(video, eventName) {
    return new Promise((resolve, reject) => {
        const onSuccess = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject(new Error('Failed to load the video frame required to generate a thumbnail.'));
        };
        const cleanup = () => {
            video.removeEventListener(eventName, onSuccess);
            video.removeEventListener('error', onError);
        };
        video.addEventListener(eventName, onSuccess, { once: true });
        video.addEventListener('error', onError, { once: true });
    });
}
//# sourceMappingURL=ExpoVideoThumbnails.web.js.map