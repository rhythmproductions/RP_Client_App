/**
 * Upload a single file to a Google Drive resumable-upload session URI in
 * one PUT, reporting progress. Returns the Drive fileId. Browser-only
 * (uses XMLHttpRequest for upload progress events).
 */
export function uploadFileToDriveSession(
  file: File,
  sessionUri: string,
  onProgress: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUri);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { id?: string };
          if (!body.id) {
            reject(new Error('Drive did not return a file id.'));
            return;
          }
          resolve(body.id);
        } catch {
          reject(new Error('Could not parse Drive response.'));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during file upload.'));
    xhr.send(file);
  });
}
