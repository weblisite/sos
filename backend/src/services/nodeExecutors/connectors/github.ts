/**
 * GitHub Connector Executor
 * 
 * Executes GitHub connector actions using the GitHub REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface GitHubCredentials {
  access_token: string;
}

/**
 * Create GitHub API client
 */
function createGitHubClient(credentials: GitHubCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a repository
 */
export async function executeGitHubCreateRepository(
  name: string,
  description?: string,
  privateRepo: boolean = false,
  credentials: GitHubCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGitHubClient(credentials);
    
    const repoData: Record<string, unknown> = {
      name,
      private: privateRepo,
    };
    
    if (description) {
      repoData.description = description;
    }

    const response = await client.post('/user/repos', repoData);

    return {
      success: true,
      output: {
        id: response.data.id,
        name: response.data.name,
        full_name: response.data.full_name,
        html_url: response.data.html_url,
        clone_url: response.data.clone_url,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'GitHub repository creation failed',
        code: 'GITHUB_CREATE_REPO_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Create an issue
 */
export async function executeGitHubCreateIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
  credentials: GitHubCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGitHubClient(credentials);
    
    const issueData: Record<string, unknown> = {
      title,
    };
    
    if (body) {
      issueData.body = body;
    }
    if (labels && labels.length > 0) {
      issueData.labels = labels;
    }

    const response = await client.post(`/repos/${owner}/${repo}/issues`, issueData);

    return {
      success: true,
      output: {
        id: response.data.id,
        number: response.data.number,
        title: response.data.title,
        html_url: response.data.html_url,
        state: response.data.state,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'GitHub issue creation failed',
        code: 'GITHUB_CREATE_ISSUE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get repository issues
 */
export async function executeGitHubGetIssues(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  perPage: number = 10,
  credentials: GitHubCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGitHubClient(credentials);
    
    const params = {
      state,
      per_page: perPage,
    };

    const response = await client.get(`/repos/${owner}/${repo}/issues`, { params });

    return {
      success: true,
      output: {
        issues: response.data || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'GitHub get issues failed',
        code: 'GITHUB_GET_ISSUES_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * List repositories
 */
export async function executeGitHubListRepositories(
  type: 'all' | 'owner' | 'member' = 'all',
  perPage: number = 10,
  credentials: GitHubCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGitHubClient(credentials);
    
    const params = {
      type,
      per_page: perPage,
    };

    const response = await client.get('/user/repos', { params });

    return {
      success: true,
      output: {
        repositories: response.data || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'GitHub list repositories failed',
        code: 'GITHUB_LIST_REPOS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute GitHub connector action
 */
export async function executeGitHub(
  actionId: string,
  input: Record<string, unknown>,
  credentials: GitHubCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_repository':
    case 'create_repo':
      const name = input.name as string;
      const description = input.description as string | undefined;
      const privateRepo = (input.private as boolean) || false;
      
      if (!name) {
        return {
          success: false,
          error: {
            message: 'name is required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeGitHubCreateRepository(name, description, privateRepo, credentials);

    case 'create_issue':
      const owner = input.owner as string;
      const repo = input.repo as string;
      const title = input.title as string;
      const body = input.body as string | undefined;
      const labels = input.labels as string[] | undefined;
      
      if (!owner || !repo || !title) {
        return {
          success: false,
          error: {
            message: 'owner, repo, and title are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeGitHubCreateIssue(owner, repo, title, body, labels, credentials);

    case 'get_issues':
      const getOwner = input.owner as string;
      const getRepo = input.repo as string;
      const state = (input.state as 'open' | 'closed' | 'all') || 'open';
      const perPage = (input.perPage as number) || 10;
      
      if (!getOwner || !getRepo) {
        return {
          success: false,
          error: {
            message: 'owner and repo are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeGitHubGetIssues(getOwner, getRepo, state, perPage, credentials);

    case 'list_repositories':
    case 'list_repos':
      const type = (input.type as 'all' | 'owner' | 'member') || 'all';
      const listPerPage = (input.perPage as number) || 10;
      return executeGitHubListRepositories(type, listPerPage, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown GitHub action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

