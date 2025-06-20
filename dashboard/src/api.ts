// This file is reserved for making authenticated calls to our backend API,
// which will be used for complex, "platformized" features.

const API_URL = import.meta.env.VITE_API_URL;

export const getPresetContext = async (presetId: string, accessToken: string) => {
    // Example of a future API call
    const response = await fetch(`${API_URL}/api/presets/${presetId}/context`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch preset context');
    }

    return await response.text();
};