const API_BASE_URL = (import.meta.env.VITE_API_URL || ''); // Default to relative path for same-origin requests

export const fetchWithTimeout = async (url, options = {}) => {
    const { timeout = 300000, ...fetchOptions } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    // Handle relative URLs
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    try {
        const response = await fetch(fullUrl, {
            ...fetchOptions,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export { API_BASE_URL };
