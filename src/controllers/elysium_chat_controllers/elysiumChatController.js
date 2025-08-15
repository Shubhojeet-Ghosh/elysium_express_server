const User = require("../../models/users");

const getUserByEmail = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({
      email: email.toLowerCase(),
      is_profile_complete: true,
    });
    if (!user) {
      return res.json({
        success: false,
        message: "No user found with this email.",
      });
    }
    userPayload = {
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      profile_image_url: user.profile_image_url,
      createdAt: user.createdAt,
    };

    return res.status(200).json({ success: true, user: userPayload });
  } catch (error) {
    console.error("Error fetching user by email:", error);
    return res.json({
      success: false,
      message: "Something went wrong.",
      tech_message: error.message,
    });
  }
};

module.exports = {
  getUserByEmail,
};
