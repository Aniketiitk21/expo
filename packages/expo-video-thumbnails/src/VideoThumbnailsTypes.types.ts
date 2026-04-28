// @needsAudit
export type VideoThumbnailsResult = {
  /**
   * URI to the created image (usable as the source for an Image/Video element).
   * On web, this is returned as a JPEG data URL.
   *
   * @platform web
   */
  uri: string;
  /**
   * Width of the created image.
   */
  width: number;
  /**
   * Height of the created image.
   */
  height: number;
};

// @needsAudit
export type VideoThumbnailsOptions = {
  /**
   * A value in range `0.0` - `1.0` specifying quality level of the result image. `1` means no
   * compression (highest quality) and `0` the highest compression (lowest quality).
   */
  quality?: number;
  /**
   * The time position where the image will be retrieved in ms.
   */
  time?: number;
  /**
   * In case `sourceFilename` is a remote URI, `headers` object is passed in a network request.
   * On web, remote sources with headers are fetched into a temporary Blob before thumbnail
   * extraction.
   *
   * @platform web
   */
  headers?: Record<string, string>;
};
