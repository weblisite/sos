/**
 * Google Drive Connector Executor
 * 
 * Executes Google Drive connector actions using the Google Drive API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface GoogleDriveCredentials {
  access_token: string;
}

/**
 * Create Google Drive API client
 */
function createGoogleDriveClient(credentials: GoogleDriveCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://www.googleapis.com/drive/v3',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Upload a file to Google Drive
 */
export async function executeGoogleDriveUploadFile(
  name: string,
  content: string, // Base64 encoded or plain text
  mimeType: string = 'text/plain',
  parentFolderId?: string,
  credentials: GoogleDriveCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGoogleDriveClient(credentials);
    
    // First, create the file metadata
    const fileMetadata: Record<string, unknown> = {
      name,
    };
    
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    // Upload the file
    const multipartBoundary = `----WebKitFormBoundary${Date.now()}`;
    const multipartBody = [
      '--' + multipartBoundary,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(fileMetadata),
      '--' + multipartBoundary,
      `Content-Type: ${mimeType}`,
      '',
      content,
      '--' + multipartBoundary + '--',
    ].join('\r\n');

    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      multipartBody,
      {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': `multipart/related; boundary=${multipartBoundary}`,
        },
      }
    );

    return {
      success: true,
      output: {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Google Drive file upload failed',
        code: 'GOOGLE_DRIVE_UPLOAD_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * List files in Google Drive
 */
export async function executeGoogleDriveListFiles(
  query?: string,
  pageSize: number = 10,
  credentials: GoogleDriveCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGoogleDriveClient(credentials);
    
    const params: Record<string, unknown> = {
      pageSize,
      fields: 'files(id, name, mimeType, webViewLink, createdTime, modifiedTime)',
    };
    
    if (query) {
      params.q = query;
    }

    const response = await client.get('/files', { params });

    return {
      success: true,
      output: {
        files: response.data.files || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Google Drive list files failed',
        code: 'GOOGLE_DRIVE_LIST_FILES_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Download a file from Google Drive
 */
export async function executeGoogleDriveDownloadFile(
  fileId: string,
  credentials: GoogleDriveCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGoogleDriveClient(credentials);
    
    // First get file metadata
    const fileResponse = await client.get(`/files/${fileId}`, {
      params: {
        fields: 'id, name, mimeType',
      },
    });

    // Download file content
    const downloadResponse = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
        responseType: 'text',
      }
    );

    return {
      success: true,
      output: {
        id: fileResponse.data.id,
        name: fileResponse.data.name,
        mimeType: fileResponse.data.mimeType,
        content: downloadResponse.data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Google Drive file download failed',
        code: 'GOOGLE_DRIVE_DOWNLOAD_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Google Drive connector action
 */
export async function executeGoogleDrive(
  actionId: string,
  input: Record<string, unknown>,
  credentials: GoogleDriveCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'upload_file':
      const name = input.name as string;
      const content = input.content as string;
      const mimeType = (input.mimeType as string) || 'text/plain';
      const parentFolderId = input.parentFolderId as string | undefined;
      
      if (!name || !content) {
        return {
          success: false,
          error: {
            message: 'name and content are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeGoogleDriveUploadFile(name, content, mimeType, parentFolderId, credentials);

    case 'list_files':
      const query = input.query as string | undefined;
      const pageSize = (input.pageSize as number) || 10;
      return executeGoogleDriveListFiles(query, pageSize, credentials);

    case 'download_file':
      const fileId = input.fileId as string;
      
      if (!fileId) {
        return {
          success: false,
          error: {
            message: 'fileId is required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeGoogleDriveDownloadFile(fileId, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Google Drive action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

