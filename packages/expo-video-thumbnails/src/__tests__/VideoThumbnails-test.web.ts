/**
 * @jest-environment jsdom
 */

import * as VideoThumbnails from '../VideoThumbnails';

jest.mock('../ExpoVideoThumbnails', () => require('../ExpoVideoThumbnails.web'));

describe('VideoThumbnails', () => {
  let originalCreateElement: typeof document.createElement;
  let mockedCanvasToDataUrl: jest.Mock<string, [string, number]>;
  let mockedDrawImage: jest.Mock<void, [HTMLVideoElement, number, number, number, number]>;

  beforeEach(() => {
    mockedCanvasToDataUrl = jest.fn(() => 'data:image/jpeg;base64,thumbnail');
    mockedDrawImage = jest.fn();

    originalCreateElement = document.createElement.bind(document);

    jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);

      if (tagName === 'video') {
        return createMockVideoElement(element as HTMLVideoElement) as HTMLElement;
      }

      if (tagName === 'canvas') {
        return createMockCanvasElement(
          element as HTMLCanvasElement,
          mockedDrawImage,
          mockedCanvasToDataUrl
        ) as HTMLElement;
      }

      return element;
    }) as typeof document.createElement);

    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      value: jest.fn(() => 'blob:http://localhost/fetched-video'),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      value: jest.fn(),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a thumbnail from a direct video source', async () => {
    const result = await VideoThumbnails.getThumbnailAsync('https://cdn.example.com/video.mp4', {
      time: 1500,
      quality: 0.75,
    });

    expect(result).toEqual({
      uri: 'data:image/jpeg;base64,thumbnail',
      width: 640,
      height: 360,
    });
    expect(mockedDrawImage).toHaveBeenCalled();
    expect(mockedCanvasToDataUrl).toHaveBeenCalledWith('image/jpeg', 0.75);
  });

  it('uses anonymous CORS for direct network video sources', async () => {
    await VideoThumbnails.getThumbnailAsync('https://cdn.example.com/video.mp4');

    const video = getCreatedVideoElements()[0];
    expect(video?.crossOrigin).toBe('anonymous');
  });

  it('fetches remote sources with headers into a temporary blob URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['video-bytes'], { type: 'video/mp4' }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await VideoThumbnails.getThumbnailAsync('https://secure.example.com/video.mp4', {
      headers: {
        Authorization: 'Bearer demo-token',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://secure.example.com/video.mp4', {
      headers: {
        Authorization: 'Bearer demo-token',
      },
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fetched-video');
  });

  it('clamps out-of-range quality values before encoding the JPEG data URL', async () => {
    await VideoThumbnails.getThumbnailAsync('blob:http://localhost/video', {
      quality: 3,
    });

    expect(mockedCanvasToDataUrl).toHaveBeenCalledWith('image/jpeg', 1);
  });
});

function getCreatedVideoElements(): HTMLVideoElement[] {
  return (document.createElement as jest.Mock).mock.results
    .map((result) => result.value)
    .filter((value): value is HTMLVideoElement => value instanceof HTMLVideoElement);
}

function createMockCanvasElement(
  canvas: HTMLCanvasElement,
  drawImage: jest.Mock<void, [HTMLVideoElement, number, number, number, number]>,
  toDataUrl: jest.Mock<string, [string, number]>
): HTMLCanvasElement {
  Object.defineProperty(canvas, 'getContext', {
    value: jest.fn(() => ({
      drawImage,
    })),
    configurable: true,
  });
  Object.defineProperty(canvas, 'toDataURL', {
    value: toDataUrl,
    configurable: true,
  });

  return canvas;
}

function createMockVideoElement(video: HTMLVideoElement): HTMLVideoElement {
  let currentTime = 0;
  let readyState = 0;

  Object.defineProperty(video, 'videoWidth', {
    value: 640,
    configurable: true,
  });
  Object.defineProperty(video, 'videoHeight', {
    value: 360,
    configurable: true,
  });
  Object.defineProperty(video, 'duration', {
    value: 2,
    configurable: true,
  });
  Object.defineProperty(video, 'readyState', {
    get: () => readyState,
    configurable: true,
  });
  Object.defineProperty(video, 'currentTime', {
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
      setTimeout(() => {
        video.dispatchEvent(new Event('seeked'));
      }, 0);
    },
    configurable: true,
  });
  Object.defineProperty(video, 'load', {
    value: jest.fn(() => {
      readyState = 3;
      setTimeout(() => {
        video.dispatchEvent(new Event('loadeddata'));
      }, 0);
    }),
    configurable: true,
  });
  Object.defineProperty(video, 'pause', {
    value: jest.fn(),
    configurable: true,
  });

  return video;
}
