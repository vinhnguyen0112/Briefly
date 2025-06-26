// API handler for communicating with the backend server
const SERVER_URL = "http://localhost:3000";

// Check server health
export async function checkServerStatus() {
  try {
    const response = await fetch(`${SERVER_URL}/api/health`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Server health check failed");
    }

    const data = await response.json();
    return {
      success: true,
      status: data.status,
      message: data.message,
    };
  } catch (error) {
    console.error("CocBot: Server health check error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get user info if authenticated
export async function getUserInfo() {
  try {
    // Retrieve stored token
    const { token } = await chrome.storage.local.get("authToken");

    if (!token) {
      return {
        success: false,
        authenticated: false,
        error: "Not authenticated",
      };
    }

    const response = await fetch(`${SERVER_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // If unauthorized, clear token
      if (response.status === 401) {
        await chrome.storage.local.remove("authToken");
      }

      throw new Error("Failed to get user info");
    }

    const data = await response.json();

    return {
      success: true,
      authenticated: true,
      user: data.user,
    };
  } catch (error) {
    console.error("CocBot: Get user info error:", error);
    return {
      success: false,
      authenticated: false,
      error: error.message,
    };
  }
}

// Process a query using the server
export async function processQueryWithServer(pageContent, query) {
  try {
    // Check if we have an auth token
    const { token } = await chrome.storage.local.get("authToken");

    if (!token) {
      // Fall back to local processing if not authenticated
      return {
        success: false,
        error: "Authentication required",
        requiresAuth: true,
      };
    }

    // Send request to server
    const response = await fetch(`${SERVER_URL}/api/query/process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pageContent,
        query,
      }),
    });

    if (!response.ok) {
      // If unauthorized, clear token
      if (response.status === 401) {
        await chrome.storage.local.remove("authToken");
        return {
          success: false,
          error: "Authentication required",
          requiresAuth: true,
        };
      }

      throw new Error("Server query processing failed");
    }

    const data = await response.json();

    return {
      success: true,
      message: data.message,
      model: data.model,
      usage: data.usage,
    };
  } catch (error) {
    console.error("CocBot: Server query processing error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Save API key to the server (if authenticated)
export async function saveApiKeyToServer(apiKey) {
  try {
    // Check if we have an auth token
    const { token } = await chrome.storage.local.get("authToken");

    if (!token) {
      return {
        success: false,
        error: "Authentication required",
        requiresAuth: true,
      };
    }

    // Send request to server
    const response = await fetch(`${SERVER_URL}/api/auth/api-key`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey,
      }),
    });

    if (!response.ok) {
      // If unauthorized, clear token
      if (response.status === 401) {
        await chrome.storage.local.remove("authToken");
        return {
          success: false,
          error: "Authentication required",
          requiresAuth: true,
        };
      }

      throw new Error("Failed to save API key");
    }

    const data = await response.json();

    return {
      success: true,
      message: data.message,
    };
  } catch (error) {
    console.error("CocBot: Save API key error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get user query history
export async function getQueryHistory(page = 1, limit = 20) {
  try {
    // Check if we have an auth token
    const { token } = await chrome.storage.local.get("authToken");

    if (!token) {
      return {
        success: false,
        error: "Authentication required",
        requiresAuth: true,
      };
    }

    // Send request to server
    const response = await fetch(
      `${SERVER_URL}/api/query/history?page=${page}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      // If unauthorized, clear token
      if (response.status === 401) {
        await chrome.storage.local.remove("authToken");
        return {
          success: false,
          error: "Authentication required",
          requiresAuth: true,
        };
      }

      throw new Error("Failed to get query history");
    }

    const data = await response.json();

    return {
      success: true,
      data: data.data,
      pagination: data.pagination,
    };
  } catch (error) {
    console.error("CocBot: Get query history error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get user statistics
export async function getUserStats() {
  try {
    // Check if we have an auth token
    const { token } = await chrome.storage.local.get("authToken");

    if (!token) {
      return {
        success: false,
        error: "Authentication required",
        requiresAuth: true,
      };
    }

    // Send request to server
    const response = await fetch(`${SERVER_URL}/api/user/stats`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // If unauthorized, clear token
      if (response.status === 401) {
        await chrome.storage.local.remove("authToken");
        return {
          success: false,
          error: "Authentication required",
          requiresAuth: true,
        };
      }

      throw new Error("Failed to get user stats");
    }

    const data = await response.json();

    return {
      success: true,
      stats: data.stats,
    };
  } catch (error) {
    console.error("CocBot: Get user stats error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Helper to launch Auth0 login
export function launchAuth() {
  chrome.tabs.create({
    url: `${SERVER_URL}/api/auth/login`,
  });
}
