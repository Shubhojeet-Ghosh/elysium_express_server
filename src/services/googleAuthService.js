const axios = require("axios");

/**
 * Fetches user info from Google using an access token.
 * @param {string} accessToken - The Google OAuth access token.
 * @returns {Promise<{ email: string, firstName: string, lastName: string, imageUrl: string }>}
 */
async function getGoogleUserInfo(accessToken) {
  if (!accessToken) {
    console.log("Access token is missing");
    return null;
  }

  const url = "https://www.googleapis.com/oauth2/v2/userinfo";

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    console.log("Response from Google : ", response.data);
    const { email, given_name, family_name, picture } = response.data;

    return {
      email,
      firstName: given_name,
      lastName: family_name,
      imageUrl: picture,
    };
  } catch (err) {
    // Optionally, you can add more error handling here
    console.log("Invalid or expired Google token");
    return null;
  }
}

module.exports = { getGoogleUserInfo };
